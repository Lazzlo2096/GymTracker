import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  PressableProps,
  TextInput,
  useWindowDimensions,
  ListRenderItemInfo,
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
  Alert,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFabScrollPadding } from "@/components/navigation/bottomTabBarInset";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import DatePickerPopover from "@/components/modals/DatePickerPopover";
import DisplaySettingsModal from "@/components/modals/DisplaySettingsModal";
import FilterSelectModal from "@/components/modals/FilterSelectModal";
import WorkoutActionsSheet, {
  WORKOUT_HISTORY_ACTIONS,
  type WorkoutActionId,
} from "@/components/modals/WorkoutActionsSheet";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import ScreenEnterFrame from "@/components/navigation/ScreenEnterFrame";
import FloatingAddButton from "@/components/ui/FloatingAddButton";
import ActiveStatusDot from "@/components/ui/ActiveStatusDot";
import ScreenTitleRowIconButton, {
  screenTitleRowIconCircleStyle,
} from "@/components/ui/ScreenTitleRowIconButton";
import { loadWorkoutsShowTileMetrics, saveWorkoutsShowTileMetrics } from "@/utils/uiPreferences";
import { useAuth } from "@/context/AuthContext";
import { useTraceScreen } from "@/debug/useTraceScreen";
import {
  createWorkoutListItemStyles,
  workoutListItemTitleMetrics,
  workoutListItemStyles,
} from "@/components/workouts/workoutListItem.styles";
import {
  MetricIconCircle,
  metricToken,
  useMetricChipSize,
  type MetricVariant,
} from "@/components/workouts/metricIcon";
import { BarbellOutlineIcon, type WorkoutMetricIconKind } from "@/components/icons/WorkoutFigmaIcons";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { createQuickWorkout } from "@/utils/createQuickWorkout";
import { runRepeatWorkoutFlow } from "@/utils/repeatWorkout";
import { downloadUserDataDump } from "@/utils/downloadUserDataDump";
import { importWorkoutFromJsonFile } from "@/utils/importWorkoutJson";
import { on } from "@/utils/eventBus";
import { WORKOUTS_LIST_STALE_EVENT, markWorkoutsListStale } from "@/events/workoutsListEvents";
import { useFocusGatedReload } from "@/hooks/useFocusGatedReload";
import { fonts, type } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import {
  SCREEN_HEADER_BOTTOM_MARGIN,
  SCREEN_HEADER_TOP_PADDING,
} from "@/theme/screenChrome";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

/** Значение `workout_type` у записи; «Все» только в фильтре. */
export type WorkoutTypeId =
  | "strength"
  | "cardio"
  | "mobility"
  | "mixed"
  | "technique"
  | "home";

export type WorkoutTypeFilterId = "all" | WorkoutTypeId;

export type WorkoutSortId =
  | "date_desc"
  | "date_asc"
  | "duration_desc"
  | "duration_asc"
  | "tonnage_desc"
  | "tonnage_asc"
  | "exercises_desc"
  | "exercises_asc";

export type WorkoutSortOption = {
  id: WorkoutSortId;
  /** Короткая подпись в чипе после «Сортировка:». */
  labelChip: string;
  /** Подпись в выпадающем списке. */
  labelList: string;
};

export type WorkoutTypeFilterItem = {
  id: WorkoutTypeFilterId;
  label: string;
};

/** Мок: варианты сортировки списка истории (под будущий picker). */
export const MOCK_WORKOUT_SORT_OPTIONS: WorkoutSortOption[] = [
  { id: "date_desc", labelChip: "дата ↓", labelList: "Дата: сначала новые" },
  { id: "date_asc", labelChip: "дата ↑", labelList: "Дата: сначала старые" },
  { id: "duration_desc", labelChip: "длительность ↓", labelList: "Длительность: по убыванию" },
  { id: "duration_asc", labelChip: "длительность ↑", labelList: "Длительность: по возрастанию" },
  { id: "tonnage_desc", labelChip: "тоннаж ↓", labelList: "Тоннаж: по убыванию" },
  { id: "tonnage_asc", labelChip: "тоннаж ↑", labelList: "Тоннаж: по возрастанию" },
  { id: "exercises_desc", labelChip: "упражнения ↓", labelList: "Упражнений: по убыванию" },
  { id: "exercises_asc", labelChip: "упражнения ↑", labelList: "Упражнений: по возрастанию" },
];

/** Мок: фильтр «Тип» тренировки. */
export const MOCK_WORKOUT_TYPE_FILTERS: WorkoutTypeFilterItem[] = [
  { id: "all", label: "Все" },
  { id: "strength", label: "Силовая" },
  { id: "cardio", label: "Кардио" },
  { id: "mobility", label: "Мобилити / растяжка" },
  { id: "mixed", label: "Смешанная" },
  { id: "technique", label: "Техника" },
  { id: "home", label: "Домашняя" },
];

/** Первый пункт «Все типы» + конкретные типы (для multiselect-модалки). */
const WORKOUT_TYPE_MULTI_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "Все типы" },
  ...MOCK_WORKOUT_TYPE_FILTERS.filter((item) => item.id !== "all"),
];

function formatWorkoutTypeChipLabel(selectedTypes: WorkoutTypeId[]): string {
  if (selectedTypes.length === 0) return "Все";
  if (selectedTypes.length === 1) {
    const row = MOCK_WORKOUT_TYPE_FILTERS.find((item) => item.id === selectedTypes[0]);
    return row?.label ?? selectedTypes[0];
  }
  const n = selectedTypes.length;
  const word =
    n % 10 === 1 && n % 100 !== 11
      ? "тип"
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
        ? "типа"
        : "типов";
  return `${n} ${word}`;
}

type Workout = {
  id: string;
  workout_date: string;
  workout_type: WorkoutTypeId;
  gym_name?: string | null;
  day_title?: string | null;
  note?: string | null;
  exercises_count: number;
  tonnage_kg: number;
  duration_minutes?: number | null;
  is_active?: boolean;
};

function formatWorkoutDeleteConfirmMessage(w: Workout | null): string {
  if (!w) return "";
  return w.day_title?.trim()
    ? `«${w.day_title}» будет удалена. Восстановить данные будет нельзя.`
    : "Запись будет удалена. Восстановить данные будет нельзя.";
}

type WorkoutSection = {
  title: string;
  count: number;
  data: Workout[];
};

type DatePopoverTarget = "from" | "to";

type WorkoutApiItem = {
  id: number | string;
  workout_date: string;
  workout_type?: string | null;
  user_gym?: { id?: number; name?: string | null } | null;
  day_title?: string | null;
  note?: string | null;
  exercises_count?: number | null;
  tonnage_kg?: number | null;
  duration_minutes?: number | null;
  is_active?: boolean | null;
  exercises?: unknown[];
  timeline?: unknown[];
};

type WorkoutListApiResponse = {
  items?: WorkoutApiItem[];
  has_more?: boolean;
  /** Ключ «YYYY-M» (M = 0..11), полное число тренировок в месяце при текущих фильтрах. */
  counts_by_month?: Record<string, number>;
};

const WORKOUTS_PAGE_LIMIT = 20;
const WORKOUT_TYPE_ID_SET = new Set<WorkoutTypeId>([
  "strength",
  "cardio",
  "mobility",
  "mixed",
  "technique",
  "home",
]);

function normalizeWorkoutType(value: unknown): WorkoutTypeId {
  if (typeof value === "string" && WORKOUT_TYPE_ID_SET.has(value as WorkoutTypeId)) {
    return value as WorkoutTypeId;
  }
  return "mixed";
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function mapWorkoutFromApi(item: WorkoutApiItem): Workout {
  const exercisesCount = toFiniteNumber(item.exercises_count, -1);
  const fallbackExercises = Array.isArray(item.exercises)
    ? item.exercises.length
    : Array.isArray(item.timeline)
      ? item.timeline.length
      : 0;

  return {
    id: String(item.id),
    workout_date: item.workout_date,
    workout_type: normalizeWorkoutType(item.workout_type),
    gym_name:
      typeof item.user_gym?.name === "string" && item.user_gym.name.trim()
        ? item.user_gym.name.trim()
        : null,
    day_title: item.day_title ?? null,
    note: item.note ?? null,
    exercises_count: exercisesCount >= 0 ? exercisesCount : fallbackExercises,
    tonnage_kg: toFiniteNumber(item.tonnage_kg),
    duration_minutes: toFiniteNumber(item.duration_minutes, -1) >= 0
      ? toFiniteNumber(item.duration_minutes, 0)
      : null,
    is_active: item.is_active === true,
  };
}

function getApiSort(sortId: WorkoutSortId): {
  sort: "workout_date" | "tonnage" | "created_at";
  order: "asc" | "desc";
} {
  switch (sortId) {
    case "date_asc":
    case "duration_asc":
    case "exercises_asc":
      return { sort: "workout_date", order: "asc" };
    case "tonnage_desc":
      return { sort: "tonnage", order: "desc" };
    case "tonnage_asc":
      return { sort: "tonnage", order: "asc" };
    case "duration_desc":
    case "exercises_desc":
    case "date_desc":
    default:
      return { sort: "workout_date", order: "desc" };
  }
}

function formatDateForApiQuery(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const WEEKDAYS_RU = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
const EMULATE_PAGE_LOADING = false;
const SKELETON_CARD_HEIGHT = 88;
const SKELETON_CARD_GAP = 12;
const BOTTOM_NAV_HEIGHT = 78;
const LOADING_VIEW_BOTTOM_OFFSET = 12;
const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
let runtimeWorkoutListItemStyles = workoutListItemStyles;

type AnimatedPressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
  pressOpacity?: number;
};

function AnimatedPressable({
  style,
  children,
  onPressIn,
  onPressOut,
  pressScale = 0.97,
  pressOpacity = 0.88,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function animateIn() {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: pressScale,
        speed: 35,
        bounciness: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: pressOpacity,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function animateOut() {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        speed: 35,
        bounciness: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handlePressIn(event: GestureResponderEvent) {
    animateIn();
    onPressIn?.(event);
  }

  function handlePressOut(event: GestureResponderEvent) {
    animateOut();
    onPressOut?.(event);
  }

  return (
    <AnimatedPressableBase
      {...props}
      style={[
        style,
        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
        { transform: [{ scale }], opacity },
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {children}
    </AnimatedPressableBase>
  );
}

export default function WorkoutHistoryScreen() {
  useTraceScreen("workouts");
  const theme = useAppTheme();
  styles = useMemo(() => createStyles(theme), [theme]);
  runtimeWorkoutListItemStyles = useMemo(() => createWorkoutListItemStyles(theme), [theme]);
  const router = useRouter();
  const pathname = usePathname();
  const isWorkoutsListRoute = pathname === "/workouts";
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listBottomPad = useFabScrollPadding();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [monthCountsByKey, setMonthCountsByKey] = useState<Record<string, number>>({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isEndReached, setIsEndReached] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [headerHeight, setHeaderHeight] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [datePopoverVisible, setDatePopoverVisible] = useState(false);
  const [datePopoverTarget, setDatePopoverTarget] = useState<DatePopoverTarget>("from");
  const [sortId, setSortId] = useState<WorkoutSortId>(MOCK_WORKOUT_SORT_OPTIONS[0].id);
  /** Пустой массив = все типы (для запроса на backend). */
  const [selectedWorkoutTypeIds, setSelectedWorkoutTypeIds] = useState<WorkoutTypeId[]>([]);
  const [filterSelectOpen, setFilterSelectOpen] = useState(false);
  const [filterSelectKind, setFilterSelectKind] = useState<"sort" | "type">("sort");
  /** Данные для меню «⋯»; не обнуляем сразу при закрытии — иначе заголовок исчезает во время анимации. */
  const [workoutMenuWorkout, setWorkoutMenuWorkout] = useState<Workout | null>(null);
  const [workoutMenuVisible, setWorkoutMenuVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [isDeletingWorkout, setIsDeletingWorkout] = useState(false);
  /** Цель удаления: ref + отложенная очистка после закрытия модалки, чтобы во fade не мигал текст. */
  const deleteTargetWorkoutRef = useRef<Workout | null>(null);
  const deleteConfirmOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteConfirmCleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isImportingJsonRef = useRef(false);
  const isDownloadingDumpRef = useRef(false);
  const shimmerProgress = useRef(new Animated.Value(0)).current;
  const [creatingWorkout, setCreatingWorkout] = useState(false);
  const [repeatingWorkout, setRepeatingWorkout] = useState(false);
  const [showWorkoutTileMetrics, setShowWorkoutTileMetrics] = useState(true);
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);

  useEffect(() => {
    void loadWorkoutsShowTileMetrics().then(setShowWorkoutTileMetrics);
  }, []);


  useEffect(() => {
    return () => {
      if (deleteConfirmOpenTimer.current) {
        clearTimeout(deleteConfirmOpenTimer.current);
      }
      if (deleteConfirmCleanupTimer.current) {
        clearTimeout(deleteConfirmCleanupTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (EMULATE_PAGE_LOADING) return;
    const id = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 320);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let isActive = true;

    const startShimmer = () => {
      if (!isActive) return;
      shimmerProgress.setValue(0);

      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && isActive) {
          startShimmer();
        }
      });
    };

    startShimmer();

    return () => {
      isActive = false;
      shimmerProgress.stopAnimation();
      shimmerProgress.setValue(0);
    };
  }, [shimmerProgress]);

  const shimmerTranslate = useMemo(
    () =>
      shimmerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-140, 280],
      }),
    [shimmerProgress],
  );

  const loadWorkoutsPage = useCallback(
    async ({ offset, append }: { offset: number; append: boolean }) => {
      const sort = getApiSort(sortId);
      const params = new URLSearchParams();
      params.set("limit", String(WORKOUTS_PAGE_LIMIT));
      params.set("offset", String(offset));
      params.set("sort", sort.sort);
      params.set("order", sort.order);
      if (dateFrom) params.set("date_from", formatDateForApiQuery(dateFrom));
      if (dateTo) params.set("date_to", formatDateForApiQuery(dateTo));
      if (searchQuery) params.set("q", searchQuery);

      const response = await apiFetch(`/api/v1/workouts/?${params.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseErrorDetail(payload));
      }

      const body = payload as WorkoutListApiResponse;
      const rows = Array.isArray(body.items) ? body.items.map(mapWorkoutFromApi) : [];

      setListError(null);
      setWorkouts((prev) => (append ? [...prev, ...rows] : rows));
      setIsEndReached(!body.has_more);
      if (body.counts_by_month && typeof body.counts_by_month === "object") {
        setMonthCountsByKey(body.counts_by_month);
      } else if (!append) {
        setMonthCountsByKey({});
      }
    },
    [dateFrom, dateTo, searchQuery, sortId],
  );

  const listReadyRef = useRef(false);

  const {
    loading: focusListLoading,
    reload: reloadWorkoutsList,
    invalidateInFlightLoads,
  } = useGuardedFocusLoad({
    enabled: !EMULATE_PAGE_LOADING,
    shouldReloadOnFocus: () => isWorkoutsListRoute,
    routeReady: isWorkoutsListRoute,
    load: async () => {
      try {
        await loadWorkoutsPage({ offset: 0, append: false });
        return { kind: "success", data: undefined };
      } catch (error) {
        return {
          kind: "error",
          message:
            error instanceof Error ? error.message : "Не удалось загрузить тренировки.",
        };
      }
    },
    onSuccess: () => {
      listReadyRef.current = true;
    },
    onError: (message, { silent }) => {
      if (silent) {
        setListError(message);
        return;
      }
      setWorkouts([]);
      setMonthCountsByKey({});
      setIsEndReached(true);
      setListError(message);
    },
    onDisabled: () => {},
  });

  useEffect(() => {
    if (!listReadyRef.current) return;
    void reloadWorkoutsList({ force: true });
  }, [loadWorkoutsPage, reloadWorkoutsList]);

  const { markStale: markWorkoutsListStaleLocal, refreshIfFocused: refreshWorkoutsListIfFocused } =
    useFocusGatedReload(reloadWorkoutsList);

  useEffect(() => {
    return on(WORKOUTS_LIST_STALE_EVENT, () => {
      refreshWorkoutsListIfFocused({ force: true });
    });
  }, [refreshWorkoutsListIfFocused]);

  const isPageLoading = EMULATE_PAGE_LOADING || focusListLoading;

  const sections = useMemo(() => {
    if (isPageLoading) return [];
    return groupWorkoutsByMonth(workouts, monthCountsByKey);
  }, [isPageLoading, workouts, monthCountsByKey]);
  const hasWorkouts = sections.some((section) => section.data.length > 0);
  const loadingSkeletonCount = useMemo(() => {
    const availableHeight =
      height - insets.bottom - BOTTOM_NAV_HEIGHT - headerHeight - LOADING_VIEW_BOTTOM_OFFSET;
    const itemHeight = SKELETON_CARD_HEIGHT + SKELETON_CARD_GAP;
    return Math.max(1, Math.floor(availableHeight / itemHeight));
  }, [height, insets.bottom, headerHeight]);
  const loadingSkeletons = useMemo(
    () => Array.from({ length: loadingSkeletonCount }, (_, index) => `skeleton-${index}`),
    [loadingSkeletonCount],
  );

  const horizontalPadding = width >= 400 ? 20 : 16;

  function handleEndReached() {
    if (isPageLoading) return;
    if (isLoadingMore || isEndReached) return;

    setIsLoadingMore(true);
    void loadWorkoutsPage({ offset: workouts.length, append: true })
      .catch((error) => {
        setListError(
          error instanceof Error ? error.message : "Не удалось подгрузить тренировки.",
        );
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  }

  function handleHeaderLayout(event: LayoutChangeEvent) {
    const measuredHeight = Math.round(event.nativeEvent.layout.height);
    if (measuredHeight > 0 && measuredHeight !== headerHeight) {
      setHeaderHeight(measuredHeight);
    }
  }

  function openDatePopover(target: DatePopoverTarget) {
    setDatePopoverTarget(target);
    setDatePopoverVisible(true);
  }

  function handlePickDateFrom() {
    openDatePopover("from");
  }

  function handlePickDateTo() {
    openDatePopover("to");
  }

  function openFilterSelect(kind: "sort" | "type") {
    setFilterSelectKind(kind);
    setFilterSelectOpen(true);
  }

  function handleSortSelect(id: string) {
    setSortId(id as WorkoutSortId);
  }

  function handleWorkoutTypeToggle(id: string) {
    if (id === "all") {
      setSelectedWorkoutTypeIds([]);
      return;
    }
    const typeId = id as WorkoutTypeId;
    setSelectedWorkoutTypeIds((prev) => {
      if (prev.includes(typeId)) {
        return prev.filter((x) => x !== typeId);
      }
      return [...prev, typeId];
    });
  }

  function downloadFullDataDump() {
    if (!user) {
      Alert.alert(
        "Нет профиля",
        "Не удалось определить пользователя. Выйдите из аккаунта и войдите снова.",
      );
      return;
    }
    if (isDownloadingDumpRef.current) return;

    isDownloadingDumpRef.current = true;
    void (async () => {
      try {
        await downloadUserDataDump(user.id);
      } catch (error) {
        Alert.alert(
          "Не удалось скачать дамп",
          error instanceof Error ? error.message : "Попробуйте ещё раз.",
        );
      } finally {
        isDownloadingDumpRef.current = false;
      }
    })();
  }

  function openImportWorkoutFromJson() {
    if (!user) {
      Alert.alert(
        "Нет профиля",
        "Не удалось определить пользователя. Выйдите из аккаунта и войдите снова.",
      );
      return;
    }
    if (isImportingJsonRef.current) return;

    isImportingJsonRef.current = true;
    void (async () => {
      try {
        const result = await importWorkoutFromJsonFile();
        if (result == null) return;

        if (result.kind === "single" && result.firstWorkoutId != null) {
          router.push(`/workout/${result.firstWorkoutId}`);
          return;
        }

        Alert.alert(
          "Импорт завершён",
          [
            `Залов добавлено: ${result.gymsCreated}`,
            `Упражнений в каталоге: ${result.catalogCreated}`,
            `Тренировок: ${result.workoutsCreated}`,
          ].join("\n"),
        );
      } catch (error) {
        Alert.alert(
          "Не удалось импортировать",
          error instanceof Error ? error.message : "Проверьте JSON и попробуйте ещё раз.",
        );
      } finally {
        isImportingJsonRef.current = false;
      }
    })();
  }

  function openWorkoutMenu(workout: Workout) {
    setWorkoutMenuWorkout(workout);
    setWorkoutMenuVisible(true);
  }

  function openWorkoutDetails(workout: Workout) {
    router.push(`/workout/${workout.id}`);
  }

  function createAndOpenWorkout() {
    if (!user) {
      Alert.alert(
        "Нет профиля",
        "Не удалось определить пользователя. Выйдите из аккаунта и войдите снова.",
      );
      return;
    }
    if (creatingWorkout) return;

    setCreatingWorkout(true);
    void (async () => {
      try {
        const id = await createQuickWorkout({ markListStale: false });
        markWorkoutsListStaleLocal();
        invalidateInFlightLoads();
        router.push(`/workout/${id}`);
      } catch (e) {
        Alert.alert(
          "Не удалось создать тренировку",
          e instanceof Error ? e.message : "Попробуйте ещё раз.",
        );
      } finally {
        setCreatingWorkout(false);
      }
    })();
  }

  function closeWorkoutMenu() {
    setWorkoutMenuVisible(false);
  }

  function closeDeleteConfirm() {
    setDeleteConfirmVisible(false);
    if (deleteConfirmCleanupTimer.current) {
      clearTimeout(deleteConfirmCleanupTimer.current);
    }
    deleteConfirmCleanupTimer.current = setTimeout(() => {
      deleteConfirmCleanupTimer.current = null;
      deleteTargetWorkoutRef.current = null;
    }, 450);
  }

  function confirmDeleteWorkout() {
    const target = deleteTargetWorkoutRef.current;
    if (!target || isDeletingWorkout) return;

    setIsDeletingWorkout(true);
    void (async () => {
      try {
        const response = await apiFetch(`/api/v1/workouts/${target.id}`, {
          method: "DELETE",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseErrorDetail(payload));
        }

        closeDeleteConfirm();
        setWorkouts((prev) => prev.filter((workout) => workout.id !== target.id));
        markWorkoutsListStale();
        Alert.alert("Удалено", "Тренировка удалена.");
      } catch (error) {
        Alert.alert(
          "Ошибка удаления",
          error instanceof Error ? error.message : "Не удалось удалить тренировку.",
        );
      } finally {
        setIsDeletingWorkout(false);
      }
    })();
  }

  function handleWorkoutMenuAction(action: WorkoutActionId) {
    const w = workoutMenuWorkout;
    if (!w) return;

    switch (action) {
      case "open":
        openWorkoutDetails(w);
        break;
      case "select":
        Alert.alert("Скоро", "Массовый выбор тренировок появится в следующих версиях.");
        break;
      case "repeat":
        runRepeatWorkoutFlow({
          sourceWorkoutId: Number(w.id),
          router,
          isBusy: () => repeatingWorkout,
          setBusy: setRepeatingWorkout,
          markListStaleLocally: () => {
            markWorkoutsListStaleLocal();
            invalidateInFlightLoads();
          },
          onInvalidId: () =>
            Alert.alert("Ошибка", "Некорректный идентификатор тренировки."),
          onError: (message) => Alert.alert("Не удалось повторить тренировку", message),
        });
        break;
      case "duplicate_template":
      case "duplicate_session":
      case "compare":
      case "exercise_progress":
      case "hide_from_stats":
        Alert.alert("Скоро", "Действие будет доступно в следующих версиях.");
        break;
      case "share": {
        const title = w.day_title?.trim() || "Тренировка";
        const dateRu = formatDateForFilter(new Date(w.workout_date));
        const lines = [title, dateRu, w.gym_name, w.note].filter(Boolean);
        Share.share({ message: lines.join("\n") }).catch(() => {});
        break;
      }
      case "delete": {
        if (deleteConfirmCleanupTimer.current) {
          clearTimeout(deleteConfirmCleanupTimer.current);
          deleteConfirmCleanupTimer.current = null;
        }
        deleteTargetWorkoutRef.current = w;
        if (deleteConfirmOpenTimer.current) {
          clearTimeout(deleteConfirmOpenTimer.current);
        }
        deleteConfirmOpenTimer.current = setTimeout(() => {
          deleteConfirmOpenTimer.current = null;
          setDeleteConfirmVisible(true);
        }, 320);
        break;
      }
      default:
        break;
    }
  }

  function handleSelectPopoverDate(nextDate: Date | null) {
    if (!nextDate) {
      if (datePopoverTarget === "from") {
        setDateFrom(null);
      } else {
        setDateTo(null);
      }
      setDatePopoverVisible(false);
      return;
    }

    const normalized = startOfDay(nextDate);
    if (datePopoverTarget === "from") {
      setDateFrom(normalized);
      setDateTo((prevTo) => (prevTo && prevTo < normalized ? normalized : prevTo));
    } else {
      setDateTo(normalized);
      setDateFrom((prevFrom) => (prevFrom && prevFrom > normalized ? normalized : prevFrom));
    }
    setDatePopoverVisible(false);
  }

  return (
    <View style={styles.safeArea}>
      <ScreenEnterFrame direction="none">
        <SectionList
        testID="workouts-list"
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: isPageLoading ? LOADING_VIEW_BOTTOM_OFFSET : listBottomPad,
          },
        ]}
        scrollEnabled={!isPageLoading}
        ListHeaderComponent={
          <View
            nativeID="workouts-list-header"
            onLayout={handleHeaderLayout}
          >
            <Header
              dateFrom={dateFrom}
              dateTo={dateTo}
              sortId={sortId}
              searchInput={searchInput}
              selectedWorkoutTypeIds={selectedWorkoutTypeIds}
              onSearchInputChange={setSearchInput}
              onPickDateFrom={handlePickDateFrom}
              onPickDateTo={handlePickDateTo}
              onOpenSortSelect={() => openFilterSelect("sort")}
              onOpenTypeSelect={() => openFilterSelect("type")}
              onOpenDisplaySettings={() => setDisplaySettingsOpen(true)}
              onImportWorkoutFromJson={openImportWorkoutFromJson}
              onDownloadFullDataDump={downloadFullDataDump}
              onScheduleToggle={() => router.push("/schedule-workouts")}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <MonthHeader title={section.title} count={section.count} />
        )}
        renderItem={({ item }: ListRenderItemInfo<Workout>) => (
          <WorkoutCard
            workout={item}
            showMetrics={showWorkoutTileMetrics}
            onOpen={openWorkoutDetails}
            onOpenMenu={openWorkoutMenu}
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {isPageLoading ? (
              <>
                <SkeletonMonthHeader shimmerTranslate={shimmerTranslate} />
                {loadingSkeletons.map((skeletonId) => (
                  <SkeletonCard
                    key={skeletonId}
                    shimmerTranslate={shimmerTranslate}
                    showMetrics={showWorkoutTileMetrics}
                  />
                ))}
              </>
            ) : listError && !hasWorkouts ? (
              <View style={styles.emptyStateWrap}>
                <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
                <Text style={styles.emptyStateTitle}>Не удалось загрузить тренировки</Text>
                <Text style={styles.errorStateText}>{listError}</Text>
              </View>
            ) : !hasWorkouts ? (
              <View style={styles.emptyStateWrap}>
                <BarbellOutlineIcon
                  size={22}
                  color={metricToken("green", theme.dark).fg}
                />
                <Text style={styles.emptyStateTitleMuted}>Тренировок пока нет</Text>
                <Text style={styles.emptyStateText}>
                  Добавьте первую тренировку или измените фильтры периода.
                </Text>
              </View>
            ) : isLoadingMore ? (
              <View style={styles.endMessage}>
                <ActivityIndicator size="small" color={theme.textMuted} />
                <Text style={styles.endMessageText}>Загружаем ещё...</Text>
              </View>
            ) : !isEndReached ? null : (
              <View style={styles.endMessage}>
                <Ionicons name="flag" size={14} color={theme.textMuted} />
                <Text style={styles.endMessageText}>Больше нет тренировок</Text>
              </View>
            )}
          </View>
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
      />

      <FloatingAddButton
        onPress={createAndOpenWorkout}
        disabled={creatingWorkout}
        accessibilityLabel="Добавить тренировку"
      />

      <DatePickerPopover
        visible={datePopoverVisible}
        selectedDate={datePopoverTarget === "from" ? dateFrom : dateTo}
        allowClear
        screenWidth={width}
        screenHeight={height}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onClose={() => setDatePopoverVisible(false)}
        onSelectDate={handleSelectPopoverDate}
      />

      <FilterSelectModal
        visible={filterSelectOpen && filterSelectKind === "sort"}
        title="Сортировка"
        options={MOCK_WORKOUT_SORT_OPTIONS.map((option) => ({
          id: option.id,
          label: option.labelList,
        }))}
        selectedId={sortId}
        onSelect={handleSortSelect}
        onClose={() => setFilterSelectOpen(false)}
      />

      <FilterSelectModal
        variant="multi"
        visible={filterSelectOpen && filterSelectKind === "type"}
        title="Тип тренировки"
        options={WORKOUT_TYPE_MULTI_OPTIONS}
        selectedIds={
          selectedWorkoutTypeIds.length === 0 ? ["all"] : selectedWorkoutTypeIds
        }
        onToggle={handleWorkoutTypeToggle}
        onClose={() => setFilterSelectOpen(false)}
      />

      <WorkoutActionsSheet
        visible={workoutMenuVisible}
        actions={WORKOUT_HISTORY_ACTIONS}
        subtitle={
          workoutMenuWorkout?.day_title?.trim()
            ? workoutMenuWorkout.day_title
            : workoutMenuWorkout
              ? "Тренировка"
              : null
        }
        onClose={closeWorkoutMenu}
        onDismiss={() => setWorkoutMenuWorkout(null)}
        onSelect={handleWorkoutMenuAction}
      />

      <WorkoutDeleteConfirmModal
        visible={deleteConfirmVisible}
        title="Удалить тренировку?"
        message={formatWorkoutDeleteConfirmMessage(deleteTargetWorkoutRef.current)}
        onCancel={closeDeleteConfirm}
        onConfirm={confirmDeleteWorkout}
      />

      <DisplaySettingsModal
        visible={displaySettingsOpen}
        onClose={() => setDisplaySettingsOpen(false)}
        items={[
          {
            id: "tile_metrics",
            label: "Блок статистики",
            description: "Показывать статистику на карточках тренировок",
            value: showWorkoutTileMetrics,
            onValueChange: (next) => {
              setShowWorkoutTileMetrics(next);
              void saveWorkoutsShowTileMetrics(next);
            },
          },
        ]}
      />
      </ScreenEnterFrame>
    </View>
  );
}

function Header({
  dateFrom,
  dateTo,
  sortId,
  searchInput,
  selectedWorkoutTypeIds,
  onSearchInputChange,
  onPickDateFrom,
  onPickDateTo,
  onOpenSortSelect,
  onOpenTypeSelect,
  onOpenDisplaySettings,
  onImportWorkoutFromJson,
  onDownloadFullDataDump,
  onScheduleToggle,
  screenTitle = "История тренировок",
  toggleButtonVariant = "schedule",
}: {
  dateFrom: Date | null;
  dateTo: Date | null;
  sortId: WorkoutSortId;
  searchInput: string;
  selectedWorkoutTypeIds: WorkoutTypeId[];
  onSearchInputChange: (value: string) => void;
  onPickDateFrom: () => void;
  onPickDateTo: () => void;
  onOpenSortSelect: () => void;
  onOpenTypeSelect: () => void;
  onOpenDisplaySettings: () => void;
  onImportWorkoutFromJson?: () => void;
  onDownloadFullDataDump?: () => void;
  onScheduleToggle?: () => void;
  screenTitle?: string;
  toggleButtonVariant?: "schedule" | "history";
}) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();
  const filtersSingleRow = windowWidth <= FILTERS_SINGLE_ROW_MAX_WIDTH;
  const toggleButtonNativeId =
    toggleButtonVariant === "history"
      ? "workouts-history-header-history-toggle-button"
      : "workouts-history-header-schedule-toggle-button";
  const sortChip =
    MOCK_WORKOUT_SORT_OPTIONS.find((option) => option.id === sortId)?.labelChip ?? "";
  const typeLabel = formatWorkoutTypeChipLabel(selectedWorkoutTypeIds);
  const iconCal = filtersSingleRow ? 14 : 17;
  const iconSliders = filtersSingleRow ? 14 : 16;
  const iconSort = filtersSingleRow ? 15 : 18;
  const iconChevron = filtersSingleRow ? 11 : 13;

  const dateFromLabel = filtersSingleRow
    ? `с ${formatDateForFilterChipCompact(dateFrom)}`
    : `с ${formatDateForFilterNullable(dateFrom)}`;
  const dateToLabel = filtersSingleRow
    ? `по ${formatDateForFilterChipCompact(dateTo)}`
    : `по ${formatDateForFilterNullable(dateTo)}`;
  const typeChipLabel = filtersSingleRow ? typeLabel : `Тип: ${typeLabel}`;
  const sortChipLabel = filtersSingleRow ? sortChip : `Сортировка: ${sortChip}`;

  return (
    <View
      nativeID="workouts-history-header"
      style={styles.header}
    >
      <View nativeID="workouts-list-header-title-row" style={styles.titleRow}>
        <Text style={styles.screenTitle}>{screenTitle}</Text>

        <View
          nativeID="workouts-history-header-actions"
          testID="workouts-history-header-actions"
          style={styles.titleActions}
        >
          <AnimatedPressable
            nativeID="workouts-history-header-analytics-button"
            testID="workouts-history-header-analytics-button"
            style={screenTitleRowIconCircleStyle(theme.cardSoft)}
            accessibilityRole="button"
            accessibilityLabel="Аналитика"
          >
            <MaterialCommunityIcons name="chart-line" size={19} color={metricToken("blue", theme.dark).fg} />
          </AnimatedPressable>

          <ScreenTitleRowIconButton
            nativeID={toggleButtonNativeId}
            testID={toggleButtonNativeId}
            accessibilityLabel="Прошедшие и предстоящие тренировки"
            onPress={onScheduleToggle}
            style={{ marginLeft: 8 }}
          >
            <MaterialCommunityIcons
              name={toggleButtonVariant === "history" ? "history" : "calendar-clock"}
              size={20}
              color={metricToken("teal", theme.dark).fg}
            />
          </ScreenTitleRowIconButton>

          {onDownloadFullDataDump ? (
            <ScreenTitleRowIconButton
              nativeID="workouts-history-header-download-dump-button"
              testID="workouts-history-header-download-dump-button"
              onPress={onDownloadFullDataDump}
              accessibilityLabel="Скачать полный дамп: тренировки, каталог упражнений и залы"
              style={{ marginLeft: 8 }}
            >
              <Ionicons
                name="archive-outline"
                size={20}
                color={metricToken("amber", theme.dark).fg}
              />
            </ScreenTitleRowIconButton>
          ) : null}

          {onImportWorkoutFromJson ? (
            <ScreenTitleRowIconButton
              nativeID="workouts-history-header-import-json-button"
              testID="workouts-history-header-import-json-button"
              onPress={onImportWorkoutFromJson}
              accessibilityLabel="Загрузить данные из JSON: залы, каталог и тренировки"
              style={{ marginLeft: 8 }}
            >
              <Ionicons
                name="clipboard-outline"
                size={20}
                color={metricToken("green", theme.dark).fg}
              />
            </ScreenTitleRowIconButton>
          ) : null}

          <ScreenTitleRowIconButton
            nativeID="workouts-history-header-settings-button"
            testID="workouts-history-header-settings-button"
            onPress={onOpenDisplaySettings}
            accessibilityLabel="Настройки отображения"
            style={{ marginLeft: 8 }}
          >
            <MaterialCommunityIcons
              name="cog"
              size={22}
              color={metricToken("violet", theme.dark).fg}
            />
          </ScreenTitleRowIconButton>
        </View>
      </View>

      <View nativeID="workouts-list-header-search" style={styles.searchBox}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          placeholder="Поиск по названию, месту, заметке"
          placeholderTextColor={theme.textPlaceholder}
          style={styles.searchInput}
          value={searchInput}
          onChangeText={onSearchInputChange}
        />
      </View>

      <View nativeID="workouts-list-header-filters" style={[styles.filtersRow, filtersSingleRow && styles.filtersRowSingleLine]}>
        <FilterChip
          icon={<Ionicons name="calendar-outline" size={iconCal} color={theme.text} />}
          label={dateFromLabel}
          compact={filtersSingleRow}
          onPress={onPickDateFrom}
        />

        <FilterChip
          icon={<Ionicons name="calendar-outline" size={iconCal} color={theme.text} />}
          label={dateToLabel}
          compact={filtersSingleRow}
          onPress={onPickDateTo}
        />

        <FilterChip
          icon={<Ionicons name="options-outline" size={iconSliders} color={theme.text} />}
          label={typeChipLabel}
          rightIcon={
            <Ionicons name="chevron-down" size={iconChevron} color={theme.text} />
          }
          compact={filtersSingleRow}
          onPress={onOpenTypeSelect}
        />

        <FilterChip
          icon={<Ionicons name="swap-vertical" size={iconSort} color={theme.accent} />}
          label={sortChipLabel}
          accent
          compact={filtersSingleRow}
          onPress={onOpenSortSelect}
        />
      </View>
    </View>
  );
}

function FilterChip({
  icon,
  label,
  rightIcon,
  accent = false,
  compact = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  rightIcon?: React.ReactNode;
  accent?: boolean;
  compact?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
}) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <AnimatedPressable
      style={[styles.filterChip, compact && styles.filterChipCompact]}
      onPress={onPress}
    >
      {icon}
      <Text
        style={[
          styles.filterChipText,
          accent && styles.filterChipTextAccent,
          compact && styles.filterChipTextCompact,
          compact && styles.filterChipLabelShrink,
        ]}
        {...textBreakProps}
      >
        {label}
      </Text>
      {rightIcon}
    </AnimatedPressable>
  );
}

function MonthHeader({ title, count }: { title: string; count: number }) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <MonthHeaderLayout>
      <Text style={styles.monthTitle}>{title}</Text>

      <View style={styles.monthCountPill}>
        <Text style={styles.monthCountText}>
          {count} {getWorkoutWord(count)}
        </Text>
      </View>
    </MonthHeaderLayout>
  );
}

function MonthHeaderLayout({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return <View style={[styles.monthHeader, style]}>{children}</View>;
}

function WorkoutCard({
  workout,
  showMetrics,
  onOpen,
  onOpenMenu,
}: {
  workout: Workout;
  showMetrics: boolean;
  onOpen: (workout: Workout) => void;
  onOpenMenu: (workout: Workout) => void;
}) {
  const theme = useAppTheme();
  const date = new Date(workout.workout_date);

  const day = date.getDate();
  const monthShort = date.toLocaleString("ru-RU", { month: "short" }).replace(".", "");
  const weekday = WEEKDAYS_RU[date.getDay()];

  return (
    <AnimatedPressable
      testID={`workouts-list-item-${workout.id}`}
      style={[
        runtimeWorkoutListItemStyles.card,
        showMetrics && runtimeWorkoutListItemStyles.cardWithMetrics,
      ]}
      pressScale={0.985}
      pressOpacity={0.93}
      onPress={() => onOpen(workout)}
      onLongPress={() => onOpenMenu(workout)}
    >
      <WorkoutDateBlockLayout>
        <Text style={runtimeWorkoutListItemStyles.dateDay}>{day}</Text>
        <Text style={runtimeWorkoutListItemStyles.dateMonth}>{monthShort}</Text>

        <View style={runtimeWorkoutListItemStyles.weekdayPill}>
          <Text style={runtimeWorkoutListItemStyles.weekdayText}>{weekday}</Text>
        </View>
      </WorkoutDateBlockLayout>

      <View style={runtimeWorkoutListItemStyles.verticalDivider} />

      <WorkoutCardContentLayout>
        <View style={runtimeWorkoutListItemStyles.cardTopRow}>
          <View style={runtimeWorkoutListItemStyles.titleWithActiveDot}>
            <ActiveStatusDot
              visible={workout.is_active === true}
              traceContext={`workouts/${workout.id}`}
            />
            <Text style={runtimeWorkoutListItemStyles.workoutTitle} {...textBreakProps}>
              {workout.day_title || "Тренировка"}
            </Text>
          </View>

          <AnimatedPressable
            hitSlop={12}
            pressScale={0.9}
            pressOpacity={0.75}
            onPress={(event) => {
              event.stopPropagation();
              onOpenMenu(workout);
            }}
          >
            <MaterialCommunityIcons name="dots-vertical" size={19} color={theme.text} />
          </AnimatedPressable>
        </View>

        {!!workout.gym_name && (
          <WorkoutMetaRowLayout>
            <Ionicons name="location-outline" size={15} color={theme.accent} />
            <Text style={runtimeWorkoutListItemStyles.locationText} {...textBreakProps}>
              {workout.gym_name}
            </Text>
          </WorkoutMetaRowLayout>
        )}

        {!!workout.note && (
          <WorkoutMetaRowLayout>
            <Ionicons name="document-text-outline" size={14} color={theme.textMuted} />
            <Text style={runtimeWorkoutListItemStyles.noteText} {...textBreakProps}>
              {workout.note}
            </Text>
          </WorkoutMetaRowLayout>
        )}

        {showMetrics && (
          <View
            style={runtimeWorkoutListItemStyles.metricsRow}
            testID={`workouts-list-item-${workout.id}-metrics`}
          >
            <MetricItem
              testID={`workouts-list-item-${workout.id}-metric-exercises`}
              kind="volume"
              value={`${workout.exercises_count} упр.`}
              label="Объём"
            />

            <MetricItem
              testID={`workouts-list-item-${workout.id}-metric-tonnage`}
              kind="tonnage"
              value={`${formatNumber(workout.tonnage_kg)} кг`}
              label="Тоннаж"
            />

            <MetricItem
              testID={`workouts-list-item-${workout.id}-metric-duration`}
              kind="duration"
              value={formatDuration(workout.duration_minutes)}
              label="Длит."
            />
          </View>
        )}
      </WorkoutCardContentLayout>
    </AnimatedPressable>
  );
}

function WorkoutDateBlockLayout({ children }: { children: React.ReactNode }) {
  return <View style={runtimeWorkoutListItemStyles.dateBlock}>{children}</View>;
}

function WorkoutCardContentLayout({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[runtimeWorkoutListItemStyles.cardContent, style]}>{children}</View>;
}

function WorkoutMetaRowLayout({ children }: { children: React.ReactNode }) {
  return <View style={runtimeWorkoutListItemStyles.metaRow}>{children}</View>;
}

function MetricItem({
  kind,
  value,
  label,
  testID,
}: {
  kind: WorkoutMetricIconKind;
  value: string;
  label: string;
  testID?: string;
}) {
  const chipSize = useMetricChipSize();
  return (
    <MetricItemLayout testID={testID}>
      <MetricIconCircle figmaKind={kind} size={chipSize} />

      <View style={runtimeWorkoutListItemStyles.metricTextBlock}>
        <Text style={runtimeWorkoutListItemStyles.metricValue} {...textBreakProps}>
          {value}
        </Text>
        <Text style={runtimeWorkoutListItemStyles.metricLabel} {...textBreakProps}>
          {label}
        </Text>
      </View>
    </MetricItemLayout>
  );
}

function MetricItemLayout({
  testID,
  children,
}: {
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={runtimeWorkoutListItemStyles.metricItem} testID={testID}>
      {children}
    </View>
  );
}

function SkeletonMetricItem({
  testID,
  shimmerTranslate,
}: {
  testID: string;
  shimmerTranslate: Animated.AnimatedInterpolation<number>;
}) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const chipSize = useMetricChipSize();
  return (
    <MetricItemLayout testID={testID}>
      <ShimmerBlock
        style={{
          width: chipSize,
          height: chipSize,
          borderRadius: chipSize / 2,
        }}
        translateX={shimmerTranslate}
      />

      <View style={runtimeWorkoutListItemStyles.metricTextBlock}>
        <ShimmerBlock
          style={[styles.skeletonMetricLine, styles.skeletonMetricValueLine]}
          translateX={shimmerTranslate}
        />
        <ShimmerBlock
          style={[styles.skeletonMetricLine, styles.skeletonMetricLabelLine]}
          translateX={shimmerTranslate}
        />
      </View>
    </MetricItemLayout>
  );
}

function SkeletonCard({
  shimmerTranslate,
  showMetrics = true,
}: {
  shimmerTranslate: Animated.AnimatedInterpolation<number>;
  showMetrics?: boolean;
}) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View
      style={[
        runtimeWorkoutListItemStyles.card,
        showMetrics && runtimeWorkoutListItemStyles.cardWithMetrics,
      ]}
    >
      <WorkoutDateBlockLayout>
        <ShimmerBlock style={styles.skeletonDateDay} translateX={shimmerTranslate} />
        <ShimmerBlock style={styles.skeletonDateMonth} translateX={shimmerTranslate} />
        <ShimmerBlock
          style={[runtimeWorkoutListItemStyles.weekdayPill, styles.skeletonWeekdayPill]}
          translateX={shimmerTranslate}
        />
      </WorkoutDateBlockLayout>

      <View style={runtimeWorkoutListItemStyles.verticalDivider} />

      <WorkoutCardContentLayout>
        <View style={runtimeWorkoutListItemStyles.cardTopRow}>
          <ShimmerBlock style={styles.skeletonTitleLine} translateX={shimmerTranslate} />
        </View>
        <WorkoutMetaRowLayout>
          <ShimmerBlock style={styles.skeletonMetaLine} translateX={shimmerTranslate} />
        </WorkoutMetaRowLayout>
        <WorkoutMetaRowLayout>
          <ShimmerBlock style={styles.skeletonNoteLine} translateX={shimmerTranslate} />
        </WorkoutMetaRowLayout>

        {showMetrics && (
          <View style={runtimeWorkoutListItemStyles.metricsRow} testID="workouts-skeleton-metrics">
            <SkeletonMetricItem
              testID="workouts-skeleton-metric-exercises"
              shimmerTranslate={shimmerTranslate}
            />
            <SkeletonMetricItem
              testID="workouts-skeleton-metric-tonnage"
              shimmerTranslate={shimmerTranslate}
            />
            <SkeletonMetricItem
              testID="workouts-skeleton-metric-duration"
              shimmerTranslate={shimmerTranslate}
            />
          </View>
        )}
      </WorkoutCardContentLayout>
    </View>
  );
}

function SkeletonMonthHeader({
  shimmerTranslate,
}: {
  shimmerTranslate: Animated.AnimatedInterpolation<number>;
}) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <MonthHeaderLayout style={styles.skeletonMonthHeader}>
      <ShimmerBlock
        style={styles.skeletonMonthTitle}
        translateX={shimmerTranslate}
      />
      <ShimmerBlock
        style={[styles.monthCountPill, styles.skeletonMonthPill]}
        translateX={shimmerTranslate}
      />
    </MonthHeaderLayout>
  );
}

function ShimmerBlock({
  style,
  translateX,
}: {
  style: StyleProp<ViewStyle>;
  translateX: Animated.AnimatedInterpolation<number>;
}) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[style, styles.shimmerBase]}>
      <AnimatedLinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.65)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.shimmerOverlay, { transform: [{ translateX }] }]}
      />
    </View>
  );
}

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/** Порядок секций и строк внутри месяца совпадает с порядком в списке с бэкенда. */
function groupWorkoutsByMonth(
  workouts: Workout[],
  countsByMonth?: Record<string, number>,
): WorkoutSection[] {
  const map = new Map<string, Workout[]>();
  const monthOrder: string[] = [];

  for (const workout of workouts) {
    const date = new Date(workout.workout_date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;

    if (!map.has(key)) {
      map.set(key, []);
      monthOrder.push(key);
    }

    map.get(key)!.push(workout);
  }

  return monthOrder.map((key) => {
    const data = map.get(key)!;
    const [year, month] = key.split("-").map(Number);
    const totalInMonth = countsByMonth?.[key];

    return {
      title: `${MONTHS_RU[month]} ${year}`,
      count:
        typeof totalInMonth === "number" && Number.isFinite(totalInMonth)
          ? totalInMonth
          : data.length,
      data,
    };
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDuration(minutes?: number | null): string {
  if (!minutes) return "—";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours <= 0) return `${mins} мин`;

  return `${hours} ч ${mins} мин`;
}

function getWorkoutWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return "тренировка";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "тренировки";
  }

  return "тренировок";
}

function formatDateForFilter(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatDateForFilterNullable(date: Date | null): string {
  if (!date) return "дата";
  return formatDateForFilter(date);
}

/** Укороченная дата для узкого ряда фильтров (одна строка на ~412 logical px). */
function formatDateForFilterChipCompact(date: Date | null): string {
  if (!date) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const nowY = new Date().getFullYear();
  if (y === nowY) return `${day}.${month}`;
  return `${day}.${month}.${String(y).slice(-2)}`;
}

/** Порог ширины экрана (логические px ≈ CSS px), ниже которого все фильтры — в одну строку. */
const FILTERS_SINGLE_ROW_MAX_WIDTH = 504;

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
  },

  listContent: {
    paddingTop: SCREEN_HEADER_TOP_PADDING,
  },

  header: {
    marginBottom: SCREEN_HEADER_BOTTOM_MARGIN,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  titleActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  screenTitle: {
    ...type.screenTitle,
    flex: 1,
    minWidth: 0,
    color: theme.text,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.8,
  },

  searchBox: {
    height: 50,
    borderRadius: PLAQUE_RADIUS,
    borderWidth: 0,
    backgroundColor: theme.card,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    color: theme.text,
    paddingVertical: 0,
  },

  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  filtersRowSingleLine: {
    flexWrap: "nowrap",
    gap: 4,
  },

  filterChip: {
    minHeight: 40,
    borderRadius: PLAQUE_RADIUS,
    borderWidth: 0,
    backgroundColor: theme.card,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  filterChipCompact: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    paddingHorizontal: 5,
    gap: 3,
  },

  filterChipText: {
    ...type.chip,
    color: theme.text,
  },

  filterChipTextCompact: {
    ...type.label,
    fontFamily: fonts.semiBold,
    lineHeight: 16,
  },

  filterChipLabelShrink: {
    flex: 1,
    minWidth: 0,
  },

  filterChipTextAccent: {
    color: theme.accent,
  },

  monthHeader: {
    marginTop: 2,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  monthTitle: {
    ...type.sectionAccent,
    color: theme.text,
    letterSpacing: -0.3,
  },

  monthCountPill: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.cardSoft,
  },

  monthCountText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: theme.textMuted,
  },

  footer: {
    paddingTop: 4,
  },

  skeletonMonthHeader: {
    marginTop: -2,
  },

  skeletonMonthTitle: {
    width: 154,
    height: 24,
    borderRadius: 8,
  },

  skeletonMonthPill: {
    width: 104,
    borderRadius: 15,
    paddingHorizontal: 0,
  },

  skeletonDateDay: {
    width: 26,
    height: 32,
    borderRadius: 8,
  },

  skeletonDateMonth: {
    width: 34,
    height: 16,
    borderRadius: 6,
    marginTop: 4,
  },

  skeletonWeekdayPill: {
    width: 34,
    height: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  skeletonTitleLine: {
    width: "74%",
    height: workoutListItemTitleMetrics.lineHeight,
    borderRadius: 7,
  },

  skeletonMetaLine: {
    width: "52%",
    height: 14,
    borderRadius: 6,
  },

  skeletonNoteLine: {
    width: "66%",
    height: 13,
    borderRadius: 6,
  },

  skeletonMetricLine: {
    borderRadius: 5,
  },

  skeletonMetricValueLine: {
    width: "78%",
    height: 11,
    marginBottom: 4,
  },

  skeletonMetricLabelLine: {
    width: "56%",
    height: 9,
  },

  shimmerBase: {
    overflow: "hidden",
    backgroundColor: theme.border,
  },

  shimmerOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 120,
  },

  endMessage: {
    height: 36,
    marginTop: 4,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  endMessageText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: theme.textMuted,
  },

  emptyStateWrap: {
    minHeight: 120,
    borderRadius: PLAQUE_RADIUS,
    backgroundColor: theme.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 6,
    shadowColor: "#24213A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 1,
  },

  emptyStateTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
    color: theme.text,
  },

  emptyStateTitleMuted: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
    color: theme.textMuted,
  },

  emptyStateText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    color: theme.textMuted,
  },

  errorStateText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    color: theme.danger,
  },

  });

let styles = createStyles({
  dark: false,
  bg: "#F8F7FC",
  card: "#FFFFFF",
  cardSoft: "#EDE9FE",
  text: "#11142D",
  textMuted: "#5C5870",
  border: "#E6E3F0",
  divider: "#ECEAF2",
  overlay: "rgba(24, 20, 40, 0.45)",
  accent: "#6D28D9",
  accentMuted: "#8B7CAD",
  accentSoft: "#EDE9FE",
  white: "#FFFFFF",
  danger: "#dc2626",
  switchOff: "#DADCE6",
  switchThumb: "#FFFFFF",
});
