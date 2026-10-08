import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  GestureResponderEvent,
  ListRenderItemInfo,
  Platform,
  Pressable,
  PressableProps,
  SectionList,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import CatalogExerciseFormModal from "@/components/modals/CatalogExerciseFormModal";
import { useTraceScreen } from "@/debug/useTraceScreen";
import FilterSelectModal from "@/components/modals/FilterSelectModal";
import { ExerciseGlyph } from "@/components/exercise/ExerciseGlyph";
import { BarbellOutlineIcon } from "@/components/icons/WorkoutFigmaIcons";
import ScreenEnterFrame, { useGoBackWithScreenEnter } from "@/components/navigation/ScreenEnterFrame";
import {
  FAB_BOTTOM_OFFSET,
  useFabScrollPadding,
} from "@/components/navigation/bottomTabBarInset";
import FloatingAddButton, {
  FAB_PICK_ACTIONS_PADDING_RIGHT,
} from "@/components/ui/FloatingAddButton";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import PickModeBottomPanel from "@/components/ui/PickModeBottomPanel";
import {
  MetricIconCircle,
  metricToken,
  useMetricChipSize,
} from "@/components/workouts/metricIcon";
import { createWorkoutListItemStyles } from "@/components/workouts/workoutListItem.styles";
import type { WorkoutMetricIconKind } from "@/components/icons/WorkoutFigmaIcons";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { replaceExerciseInWorkoutCatalog } from "@/api/exerciseInWorkout";
import { fetchWorkoutDetailById } from "@/api/workoutDetail";
import { appendCatalogExercisesToWorkoutTemplate } from "@/api/workoutTemplates";
import { emitWorkoutDetailUpdated } from "@/events/workoutDetailEvents";
import { markWorkoutsListStale } from "@/events/workoutsListEvents";
import {
  TEMPLATE_CATALOG_PICK_EVENT,
  type TemplateCatalogPickPayload,
} from "@/components/plans/templateCatalogPick";
import { exerciseTypeLabel } from "@/constants/exerciseType";
import { emit, on } from "@/utils/eventBus";
import { pressableStyle } from "@/utils/pressableStyles";
import { useAppTheme } from "@/theme/appTheme";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import {
  SCREEN_HEADER_BOTTOM_MARGIN,
  SCREEN_HEADER_TOP_PADDING,
} from "@/theme/screenChrome";
import { fonts, type } from "@/theme/typography";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

const DEFAULT_MUSCLE_GROUPS = [
  "Грудь",
  "Спина",
  "Ноги",
  "Плечи",
  "Руки",
  "Пресс",
  "Кардио",
  "Другое",
];

const FILTERS_SINGLE_ROW_MAX_WIDTH = 504;

type CatalogSortId = "popularity" | "name" | "created";
type CatalogExerciseTypeId = "all" | "weighted" | "bodyweight" | "machine";

type CatalogFilters = {
  muscleGroup: string;
  exerciseType: CatalogExerciseTypeId;
  sortId: CatalogSortId;
};

const DEFAULT_FILTERS: CatalogFilters = {
  muscleGroup: "",
  exerciseType: "all",
  sortId: "popularity",
};

const SORT_OPTIONS = [
  { id: "popularity" as const, labelChip: "популярные", labelList: "По популярности" },
  { id: "name" as const, labelChip: "название", labelList: "По названию" },
  { id: "created" as const, labelChip: "новые", labelList: "Недавно добавленные" },
];

const EXERCISE_TYPE_OPTIONS = [
  { id: "all", label: "Все типы" },
  { id: "weighted", label: "С весом" },
  { id: "bodyweight", label: "Собственный вес" },
  { id: "machine", label: "Тренажёр" },
];

type ExerciseRow = {
  id: number;
  user_id: number;
  name: string;
  notes?: string | null;
  muscle_group?: string | null;
  exercise_type?: string | null;
  machine_location?: string | null;
  icon?: string | null;
  created_at: string;
};

type ExerciseLogStats = {
  exercise_in_catalog_id: number;
  total_sets: number;
  best_weight_kg: number | null;
  reps_min: number | null;
  reps_max: number | null;
  planned_sets_hint: number | null;
};

type CatalogLogSummary = {
  by_exercise: ExerciseLogStats[];
};

type ExerciseSection = {
  title: string;
  count: number;
  data: ExerciseRow[];
};

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

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
      Animated.spring(scale, { toValue: pressScale, speed: 35, bounciness: 5, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: pressOpacity, duration: 110, useNativeDriver: true }),
    ]).start();
  }

  function animateOut() {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, speed: 35, bounciness: 5, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }

  return (
    <AnimatedPressableBase
      {...props}
      style={[
        style,
        Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null,
        { transform: [{ scale }], opacity },
      ]}
      onPressIn={(e) => {
        animateIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateOut();
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressableBase>
  );
}

function sortChipLabel(sortId: CatalogSortId): string {
  return SORT_OPTIONS.find((o) => o.id === sortId)?.labelChip ?? "популярные";
}

function typeChipLabel(typeId: CatalogExerciseTypeId): string {
  return EXERCISE_TYPE_OPTIONS.find((o) => o.id === typeId)?.label ?? "Все типы";
}

function muscleChipLabel(muscleGroup: string): string {
  if (!muscleGroup) return "Все группы";
  return muscleGroup;
}

function matchesExerciseType(
  ex: ExerciseRow,
  typeId: CatalogExerciseTypeId,
  stats: ExerciseLogStats | undefined,
): boolean {
  if (typeId === "all") return true;
  if (typeId === "machine") return Boolean(ex.machine_location?.trim());
  if (typeId === "weighted") return stats?.best_weight_kg != null && stats.best_weight_kg > 0;
  if (typeId === "bodyweight") {
    return !ex.machine_location?.trim() && !(stats?.best_weight_kg != null && stats.best_weight_kg > 0);
  }
  return true;
}

function filterExercises(
  rows: ExerciseRow[],
  filters: CatalogFilters,
  statsByCatalogId: Map<number, ExerciseLogStats>,
): ExerciseRow[] {
  return rows.filter((ex) => {
    if (filters.muscleGroup && ex.muscle_group !== filters.muscleGroup) return false;
    const st = statsByCatalogId.get(ex.id);
    if (!matchesExerciseType(ex, filters.exerciseType, st)) return false;
    return true;
  });
}

function sortExercises(
  rows: ExerciseRow[],
  sortId: CatalogSortId,
  statsByCatalogId: Map<number, ExerciseLogStats>,
): ExerciseRow[] {
  const arr = [...rows];
  const pop = (id: number) => statsByCatalogId.get(id)?.total_sets ?? 0;
  if (sortId === "popularity") {
    arr.sort((a, b) => pop(b.id) - pop(a.id) || a.name.localeCompare(b.name, "ru"));
  } else if (sortId === "name") {
    arr.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  } else {
    arr.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  }
  return arr;
}

function groupByMuscleGroup(exercises: ExerciseRow[]): ExerciseSection[] {
  const map = new Map<string, ExerciseRow[]>();
  const order: string[] = [];

  for (const ex of exercises) {
    const key = ex.muscle_group?.trim() || "Без группы";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(ex);
  }

  return order.map((title) => {
    const data = map.get(title)!;
    return { title, count: data.length, data };
  });
}

function getExerciseWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return "упражнение";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "упражнения";
  return "упражнений";
}

function formatRepsRange(stats: ExerciseLogStats | undefined): string {
  if (!stats) return "—";
  const { reps_min: min, reps_max: max } = stats;
  if (min != null && max != null) {
    if (min === max) return `${min}`;
    return `${min}–${max}`;
  }
  if (min != null) return `${min}+`;
  if (max != null) return `до ${max}`;
  return "—";
}

function mergedMuscleOptionsForForm(exercises: ExerciseRow[]): { id: string; label: string }[] {
  const fromData = new Set<string>();
  for (const ex of exercises) {
    const g = ex.muscle_group?.trim();
    if (g) fromData.add(g);
  }
  const merged = [...DEFAULT_MUSCLE_GROUPS];
  for (const g of fromData) {
    if (!merged.includes(g)) merged.push(g);
  }
  merged.sort((a, b) => a.localeCompare(b, "ru"));
  return merged.map((g) => ({ id: g, label: g }));
}

export default function ExerciseCatalog2Screen() {
  useTraceScreen("exercise_catalog");
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const itemStyles = useMemo(() => createWorkoutListItemStyles(theme), [theme]);
  const router = useRouter();
  const params = useLocalSearchParams<{
    pickForWorkout?: string;
    pickForTemplate?: string;
    pickForTemplateSlot?: string;
    templateExercisesCount?: string;
    seedCatalogId?: string;
    returnTo?: string;
    replaceExerciseInWorkout?: string;
  }>();
  const pickForWorkoutId = Number(params.pickForWorkout);
  const pickWorkoutMode = Number.isFinite(pickForWorkoutId) && pickForWorkoutId > 0;
  const pickReplaceExerciseId = Number(params.replaceExerciseInWorkout);
  const pickReplaceExerciseMode =
    Number.isFinite(pickReplaceExerciseId) && pickReplaceExerciseId > 0;
  const pickForTemplateId = Number(params.pickForTemplate);
  const pickTemplateMode =
    Number.isFinite(pickForTemplateId) && pickForTemplateId > 0;
  const pickForTemplateSlot =
    typeof params.pickForTemplateSlot === "string"
      ? params.pickForTemplateSlot.trim()
      : "";
  const pickTemplateSlotMode = pickForTemplateSlot.length > 0;
  const templateExercisesCountRaw = Number(params.templateExercisesCount);
  const templateExercisesCount =
    Number.isFinite(templateExercisesCountRaw) && templateExercisesCountRaw >= 0
      ? Math.trunc(templateExercisesCountRaw)
      : undefined;
  const multiSelectPickMode = pickWorkoutMode || pickTemplateSlotMode || pickTemplateMode;
  const pickReturnTo =
    typeof params.returnTo === "string" && params.returnTo.startsWith("/")
      ? params.returnTo
      : pickReplaceExerciseMode
        ? `/exercise/${pickReplaceExerciseId}`
        : pickTemplateMode
          ? `/plan-template/${pickForTemplateId}`
          : "/plans";
  const pickMode = multiSelectPickMode || pickReplaceExerciseMode;
  const goBack = useGoBackWithScreenEnter(
    pickWorkoutMode
      ? `/workout/${pickForWorkoutId}`
      : pickReplaceExerciseMode
        ? pickReturnTo
        : pickTemplateMode
          ? `/plan-template/${pickForTemplateId}`
          : pickTemplateSlotMode
            ? pickReturnTo
            : undefined,
  );
  const { width } = useWindowDimensions();
  const listBottomPad = useFabScrollPadding(pickMode ? 100 : 20);
  const horizontalPadding = width >= 400 ? 20 : 16;

  const [list, setList] = useState<ExerciseRow[]>([]);
  const [logSummary, setLogSummary] = useState<CatalogLogSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [filterSelectOpen, setFilterSelectOpen] = useState(false);
  const [filterSelectKind, setFilterSelectKind] = useState<"muscle" | "type" | "sort">("sort");

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ExerciseRow | null>(null);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<number[]>([]);
  const [confirmingPick, setConfirmingPick] = useState(false);

  useEffect(() => {
    if (!pickWorkoutMode && !pickTemplateSlotMode && !pickTemplateMode && !pickReplaceExerciseMode) {
      setSelectedCatalogIds([]);
      return;
    }
    if (pickTemplateSlotMode || pickReplaceExerciseMode) {
      const seed = Number(params.seedCatalogId);
      setSelectedCatalogIds(
        Number.isFinite(seed) && seed > 0 ? [seed] : [],
      );
      return;
    }
    setSelectedCatalogIds([]);
  }, [
    pickWorkoutMode,
    pickForWorkoutId,
    pickTemplateSlotMode,
    pickForTemplateSlot,
    pickTemplateMode,
    pickForTemplateId,
    pickReplaceExerciseMode,
    pickReplaceExerciseId,
    params.seedCatalogId,
  ]);

  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput.trim()), 320);
    return () => clearTimeout(id);
  }, [searchInput]);

  const statsByCatalogId = useMemo(() => {
    const m = new Map<number, ExerciseLogStats>();
    for (const row of logSummary?.by_exercise ?? []) {
      m.set(row.exercise_in_catalog_id, row);
    }
    return m;
  }, [logSummary]);

  const muscleFilterOptions = useMemo(() => {
    const fromData = new Set<string>();
    for (const ex of list) {
      const g = ex.muscle_group?.trim();
      if (g) fromData.add(g);
    }
    const merged = [...DEFAULT_MUSCLE_GROUPS];
    for (const g of fromData) {
      if (!merged.includes(g)) merged.push(g);
    }
    merged.sort((a, b) => a.localeCompare(b, "ru"));
    return [{ id: "", label: "Все группы" }, ...merged.map((g) => ({ id: g, label: g }))];
  }, [list]);

  const muscleOptionsForForm = useMemo(() => mergedMuscleOptionsForForm(list), [list]);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (searchQuery) qs.set("q", searchQuery);
      qs.set("limit", "500");

      const [rList, rLog] = await Promise.all([
        apiFetch(`/api/v1/exercises_in_catalog/?${qs.toString()}`),
        apiFetch("/api/v1/exercises_in_catalog/log_summary"),
      ]);
      if (!rList.ok) throw new Error(`Каталог: HTTP ${rList.status}`);
      if (!rLog.ok) throw new Error(`Сводка: HTTP ${rLog.status}`);
      const data = (await rList.json()) as ExerciseRow[];
      const log = (await rLog.json()) as CatalogLogSummary;
      setList(Array.isArray(data) ? data : []);
      setLogSummary(log);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить каталог.");
      setList([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    void load();
    return on("catalog:updated", load);
  }, [load]);

  const sortedList = useMemo(() => {
    const filtered = filterExercises(list, filters, statsByCatalogId);
    return sortExercises(filtered, filters.sortId, statsByCatalogId);
  }, [list, filters, statsByCatalogId]);

  const sections = useMemo(() => {
    if (isLoading) return [];
    return groupByMuscleGroup(sortedList);
  }, [isLoading, sortedList]);

  const totalCount = sortedList.length;
  const hasExercises = totalCount > 0;

  function openFilterSelect(kind: "muscle" | "type" | "sort") {
    setFilterSelectKind(kind);
    setFilterSelectOpen(true);
  }

  function openCreateModal() {
    setEditing(null);
    setModalMode("create");
    setModalVisible(true);
  }

  function openEditModal(exercise: ExerciseRow) {
    setEditing(exercise);
    setModalMode("edit");
    setModalVisible(true);
  }

  const selectionOrderById = useMemo(() => {
    const map = new Map<number, number>();
    selectedCatalogIds.forEach((id, index) => map.set(id, index + 1));
    return map;
  }, [selectedCatalogIds]);

  const toggleCatalogSelection = useCallback((catalogId: number) => {
    setSelectedCatalogIds((prev) => {
      if (pickReplaceExerciseMode) {
        return prev[0] === catalogId ? [] : [catalogId];
      }
      if (prev.includes(catalogId)) {
        return prev.filter((id) => id !== catalogId);
      }
      return [...prev, catalogId];
    });
  }, [pickReplaceExerciseMode]);

  const clearCatalogSelection = useCallback(() => {
    setSelectedCatalogIds([]);
  }, []);

  const confirmCatalogSelection = useCallback(() => {
    if (confirmingPick) return;

    if (pickReplaceExerciseMode) {
      if (selectedCatalogIds.length === 0) {
        return;
      }

      const catalogId = selectedCatalogIds[0];
      void (async () => {
        setConfirmingPick(true);
        try {
          await replaceExerciseInWorkoutCatalog(pickReplaceExerciseId, catalogId);
          emit("catalog:updated");
          markWorkoutsListStale();
          goBack();
        } catch (e) {
          Alert.alert(
            "Не удалось заменить",
            e instanceof Error ? e.message : "Попробуйте ещё раз.",
          );
        } finally {
          setConfirmingPick(false);
        }
      })();
      return;
    }

    if (pickTemplateSlotMode) {
      if (selectedCatalogIds.length === 0) {
        emit(TEMPLATE_CATALOG_PICK_EVENT, {
          slotId: pickForTemplateSlot,
          exercises: [],
        } satisfies TemplateCatalogPickPayload);
        goBack();
        return;
      }

      const exercises = selectedCatalogIds
        .map((catalogId) => {
          const row = list.find((item) => item.id === catalogId);
          if (!row) return null;
          return {
            catalogId: row.id,
            name: row.name,
            muscle_group: row.muscle_group ?? null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);

      if (exercises.length === 0) return;

      emit(TEMPLATE_CATALOG_PICK_EVENT, {
        slotId: pickForTemplateSlot,
        exercises,
      } satisfies TemplateCatalogPickPayload);
      goBack();
      return;
    }

    if (pickTemplateMode) {
      if (selectedCatalogIds.length === 0) {
        return;
      }

      void (async () => {
        setConfirmingPick(true);
        try {
          await appendCatalogExercisesToWorkoutTemplate(
            String(pickForTemplateId),
            selectedCatalogIds,
            { existingExercisesCount: templateExercisesCount },
          );
          goBack();
        } catch (e) {
          Alert.alert(
            "Не удалось добавить",
            e instanceof Error ? e.message : "Попробуйте ещё раз.",
          );
        } finally {
          setConfirmingPick(false);
        }
      })();
      return;
    }

    if (!pickWorkoutMode || selectedCatalogIds.length === 0) {
      return;
    }

    void (async () => {
      setConfirmingPick(true);
      try {
        for (const catalogId of selectedCatalogIds) {
          const response = await apiFetch(
            `/api/v1/workouts/${pickForWorkoutId}/add_exercise/${catalogId}`,
            { method: "POST" },
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(parseErrorDetail(payload));
          }
        }
        const workoutId = Number(pickForWorkoutId);
        const detailResult = await fetchWorkoutDetailById(workoutId);
        if (detailResult.kind === "success") {
          emitWorkoutDetailUpdated(detailResult.data);
        }
        markWorkoutsListStale();
        goBack();
      } catch (e) {
        Alert.alert(
          "Не удалось добавить",
          e instanceof Error ? e.message : "Попробуйте ещё раз.",
        );
      } finally {
        setConfirmingPick(false);
      }
    })();
  }, [
    confirmingPick,
    goBack,
    list,
    pickForTemplateSlot,
    pickForTemplateId,
    pickForWorkoutId,
    pickReplaceExerciseId,
    pickReplaceExerciseMode,
    pickTemplateMode,
    pickTemplateSlotMode,
    pickWorkoutMode,
    selectedCatalogIds,
    templateExercisesCount,
  ]);

  const pickModePrimaryDisabled =
    confirmingPick ||
    ((pickWorkoutMode || pickTemplateMode || pickReplaceExerciseMode) &&
      selectedCatalogIds.length === 0);

  const pickModePrimaryLabel = pickReplaceExerciseMode
    ? "Заменить"
    : pickTemplateSlotMode && selectedCatalogIds.length === 0
      ? "Без упражнений"
      : `Выбрать (${selectedCatalogIds.length})`;

  const selectedCount = selectedCatalogIds.length;

  return (
    <View style={styles.safeArea}>
      <ScreenEnterFrame direction="none">
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isLoading}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: horizontalPadding, paddingBottom: listBottomPad },
          ]}
          ListHeaderComponent={
            <>
              <CatalogHeader
                searchInput={searchInput}
                filters={filters}
                pickMode={pickMode}
                onBack={pickMode ? () => goBack() : undefined}
                onSearchInputChange={setSearchInput}
                onOpenMuscleSelect={() => openFilterSelect("muscle")}
                onOpenTypeSelect={() => openFilterSelect("type")}
                onOpenSortSelect={() => openFilterSelect("sort")}
              />
              {pickReplaceExerciseMode ? (
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.textMuted,
                    marginBottom: 12,
                  }}
                >
                  Выберите одно упражнение из каталога — журнал подходов сохранится.
                </Text>
              ) : pickTemplateSlotMode ? (
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.textMuted,
                    marginBottom: 12,
                  }}
                >
                  Выберите одно или несколько упражнений для шаблона.
                </Text>
              ) : pickTemplateMode ? (
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.textMuted,
                    marginBottom: 12,
                  }}
                >
                  Выберите упражнения для добавления в шаблон.
                </Text>
              ) : null}
            </>
          }
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.count} />
          )}
          renderItem={({ item }: ListRenderItemInfo<ExerciseRow>) => (
            <ExerciseCard
              exercise={item}
              stats={statsByCatalogId.get(item.id)}
              itemStyles={itemStyles}
              pickMode={pickMode}
              singleSelectPickMode={pickReplaceExerciseMode}
              selectionOrder={selectionOrderById.get(item.id) ?? null}
              onToggleSelect={
                pickMode ? () => toggleCatalogSelection(item.id) : undefined
              }
              onOpen={() => {
                if (pickMode) {
                  toggleCatalogSelection(item.id);
                  return;
                }
                router.push(`/exercise-in-catalog/${item.id}`);
              }}
              onEdit={() => openEditModal(item)}
            />
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              {isLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={theme.textMuted} />
                  <Text style={styles.loadingText}>Загружаем каталог…</Text>
                </View>
              ) : error && !hasExercises ? (
                <View style={styles.emptyStateWrap}>
                  <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
                  <Text style={styles.emptyStateTitle}>Не удалось загрузить каталог</Text>
                  <Text style={styles.errorStateText}>{error}</Text>
                </View>
              ) : !hasExercises ? (
                <View style={styles.emptyStateWrap}>
                  <BarbellOutlineIcon size={22} color={metricToken("green", theme.dark).fg} />
                  <Text style={styles.emptyStateTitleMuted}>Упражнений пока нет</Text>
                  <Text style={styles.emptyStateText}>
                    Добавьте первое упражнение или измените фильтры.
                  </Text>
                </View>
              ) : (
                <View style={styles.endMessage}>
                  <Text style={styles.endMessageText}>
                    {totalCount} {getExerciseWord(totalCount)}
                  </Text>
                </View>
              )}
            </View>
          }
        />

        {pickMode ? (
          <PickModeBottomPanel
            hint={
              pickReplaceExerciseMode
                ? "Выберите упражнение для замены"
                : pickTemplateSlotMode
                  ? "Выберите упражнения для шаблона"
                  : pickTemplateMode
                    ? "Выберите упражнения для добавления в шаблон"
                    : "Выберите упражнения для добавления в тренировку"
            }
            bottom={FAB_BOTTOM_OFFSET}
            paddingLeft={horizontalPadding}
            paddingRight={FAB_PICK_ACTIONS_PADDING_RIGHT}
          >
              <Pressable
                style={pressableStyle(
                  [
                    styles.pickActionBtn,
                    styles.pickActionBtnGhost,
                    { borderColor: theme.border },
                    selectedCount === 0 && styles.pickActionBtnDisabled,
                  ],
                  { pressed: { opacity: 0.88 }, disabled: selectedCount === 0 || confirmingPick },
                )}
                onPress={clearCatalogSelection}
                disabled={selectedCount === 0 || confirmingPick}
                accessibilityRole="button"
                accessibilityLabel="Очистить выбор"
              >
                <Text
                  style={[
                    styles.pickActionBtnGhostText,
                    { color: theme.textMuted },
                    selectedCount === 0 && styles.pickActionBtnTextDisabled,
                  ]}
                  {...textBreakProps}
                >
                  Очистить выбор
                </Text>
              </Pressable>
              <Pressable
                style={pressableStyle(
                  [
                    styles.pickActionBtn,
                    styles.pickActionBtnPrimary,
                    { backgroundColor: theme.accent },
                    pickModePrimaryDisabled && styles.pickActionBtnDisabled,
                  ],
                  {
                    pressed: { opacity: 0.88 },
                    disabled: pickModePrimaryDisabled,
                  },
                )}
                onPress={confirmCatalogSelection}
                disabled={pickModePrimaryDisabled}
                accessibilityRole="button"
                accessibilityLabel={pickModePrimaryLabel}
              >
                {confirmingPick ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.pickActionBtnPrimaryText} {...textBreakProps}>
                    {pickModePrimaryLabel}
                  </Text>
                )}
              </Pressable>
          </PickModeBottomPanel>
        ) : null}

        <FloatingAddButton
          accessibilityLabel="Добавить упражнение"
          onPress={openCreateModal}
          disabled={pickMode && confirmingPick}
        />

        <FilterSelectModal
          visible={filterSelectOpen && filterSelectKind === "sort"}
          title="Сортировка"
          options={SORT_OPTIONS.map((o) => ({ id: o.id, label: o.labelList }))}
          selectedId={filters.sortId}
          onSelect={(id) => setFilters((prev) => ({ ...prev, sortId: id as CatalogSortId }))}
          onClose={() => setFilterSelectOpen(false)}
        />

        <FilterSelectModal
          visible={filterSelectOpen && filterSelectKind === "muscle"}
          title="Группа мышц"
          options={muscleFilterOptions}
          selectedId={filters.muscleGroup}
          onSelect={(id) => setFilters((prev) => ({ ...prev, muscleGroup: id }))}
          onClose={() => setFilterSelectOpen(false)}
        />

        <FilterSelectModal
          visible={filterSelectOpen && filterSelectKind === "type"}
          title="Тип нагрузки"
          options={EXERCISE_TYPE_OPTIONS}
          selectedId={filters.exerciseType}
          onSelect={(id) =>
            setFilters((prev) => ({ ...prev, exerciseType: id as CatalogExerciseTypeId }))
          }
          onClose={() => setFilterSelectOpen(false)}
        />

        <CatalogExerciseFormModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          mode={modalMode}
          exercise={editing}
          muscleSelectOptions={muscleOptionsForForm}
        />
      </ScreenEnterFrame>
    </View>
  );
}

function CatalogHeader({
  searchInput,
  filters,
  pickMode = false,
  onBack,
  onSearchInputChange,
  onOpenMuscleSelect,
  onOpenTypeSelect,
  onOpenSortSelect,
}: {
  searchInput: string;
  filters: CatalogFilters;
  pickMode?: boolean;
  onBack?: () => void;
  onSearchInputChange: (value: string) => void;
  onOpenMuscleSelect: () => void;
  onOpenTypeSelect: () => void;
  onOpenSortSelect: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();
  const filtersSingleRow = windowWidth <= FILTERS_SINGLE_ROW_MAX_WIDTH;
  const iconSliders = filtersSingleRow ? 14 : 16;
  const iconSort = filtersSingleRow ? 15 : 18;
  const iconChevron = filtersSingleRow ? 11 : 13;

  const muscleLabel = filtersSingleRow
    ? muscleChipLabel(filters.muscleGroup)
    : `Группа: ${muscleChipLabel(filters.muscleGroup)}`;
  const typeLabel = filtersSingleRow
    ? typeChipLabel(filters.exerciseType)
    : `Тип: ${typeChipLabel(filters.exerciseType)}`;
  const sortLabel = filtersSingleRow
    ? sortChipLabel(filters.sortId)
    : `Сортировка: ${sortChipLabel(filters.sortId)}`;

  return (
    <View style={styles.header}>
      <View style={[styles.titleRow, pickMode && styles.titleRowPick]}>
        {pickMode && onBack ? (
          <ScreenTitleRowIconButton hitSlop={12} onPress={onBack} accessibilityLabel="Назад">
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={metricToken("violet", theme.dark).fg}
            />
          </ScreenTitleRowIconButton>
        ) : null}
        <View style={pickMode ? styles.headerTitleBlockPick : styles.titleTextWrap}>
          <Text style={styles.screenTitle} {...textBreakProps}>
            Каталог упражнений
          </Text>
        </View>
        <View style={styles.titleActions}>
          {!pickMode ? (
            <ScreenTitleRowIconButton accessibilityLabel="Каталог упражнений">
              <MaterialCommunityIcons
                name="dumbbell"
                size={19}
                color={metricToken("blue", theme.dark).fg}
              />
            </ScreenTitleRowIconButton>
          ) : (
            <View style={styles.titleSideSpacer} />
          )}
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          placeholder="Поиск по названию"
          placeholderTextColor={theme.textPlaceholder}
          style={styles.searchInput}
          value={searchInput}
          onChangeText={onSearchInputChange}
        />
      </View>

      <View style={[styles.filtersRow, filtersSingleRow && styles.filtersRowSingleLine]}>
        <FilterChip
          icon={<Ionicons name="body-outline" size={iconSliders} color={theme.text} />}
          label={muscleLabel}
          active={filters.muscleGroup !== ""}
          compact={filtersSingleRow}
          onPress={onOpenMuscleSelect}
        />
        <FilterChip
          icon={<Ionicons name="options-outline" size={iconSliders} color={theme.text} />}
          label={typeLabel}
          active={filters.exerciseType !== "all"}
          rightIcon={<Ionicons name="chevron-down" size={iconChevron} color={theme.text} />}
          compact={filtersSingleRow}
          onPress={onOpenTypeSelect}
        />
        <FilterChip
          icon={<Ionicons name="swap-vertical" size={iconSort} color={theme.accent} />}
          label={sortLabel}
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
  active = false,
  compact = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  rightIcon?: React.ReactNode;
  accent?: boolean;
  active?: boolean;
  compact?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <AnimatedPressable
      style={[
        styles.filterChip,
        compact && styles.filterChipCompact,
        active && styles.filterChipActive,
      ]}
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

function SectionHeader({ title, count }: { title: string; count: number }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.monthHeader}>
      <Text style={styles.monthTitle}>{title}</Text>
      <View style={styles.monthCountPill}>
        <Text style={styles.monthCountText}>
          {count} {getExerciseWord(count)}
        </Text>
      </View>
    </View>
  );
}

function ExerciseCard({
  exercise,
  stats,
  itemStyles,
  pickMode = false,
  singleSelectPickMode = false,
  selectionOrder = null,
  onToggleSelect,
  onOpen,
  onEdit,
}: {
  exercise: ExerciseRow;
  stats: ExerciseLogStats | undefined;
  itemStyles: ReturnType<typeof createWorkoutListItemStyles>;
  pickMode?: boolean;
  singleSelectPickMode?: boolean;
  selectionOrder?: number | null;
  onToggleSelect?: () => void;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const theme = useAppTheme();
  const cardStyles = useMemo(() => createStyles(theme), [theme]);
  const typeLabel = exerciseTypeLabel(exercise.exercise_type);
  const sets = stats?.total_sets ?? 0;
  const bestKg = stats?.best_weight_kg;
  const reps = formatRepsRange(stats);
  const isSelected = selectionOrder != null;

  return (
    <AnimatedPressable
      style={[itemStyles.card, itemStyles.cardWithMetrics, pickMode && cardStyles.cardPickMode]}
      pressScale={0.985}
      pressOpacity={0.93}
      onPress={pickMode ? onToggleSelect : onOpen}
      onLongPress={pickMode ? undefined : onEdit}
      delayLongPress={450}
    >
      {pickMode ? (
        <View style={cardStyles.selectionMarker} pointerEvents="none">
          {isSelected ? (
            <View style={[cardStyles.selectionCircleFilled, { backgroundColor: theme.accent }]}>
              {singleSelectPickMode ? (
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              ) : (
                <Text style={cardStyles.selectionCircleText}>{selectionOrder}</Text>
              )}
            </View>
          ) : (
            <View
              style={[
                cardStyles.selectionCircleEmpty,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
          )}
        </View>
      ) : null}
      <View style={itemStyles.dateBlock}>
        <View style={[itemStyles.weekdayPill, { paddingHorizontal: 0, paddingVertical: 0, backgroundColor: "transparent" }]}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.cardSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ExerciseGlyph
              name={exercise.icon ?? undefined}
              size={22}
              dark={theme.dark}
              color={metricToken("blue", theme.dark).fg}
            />
          </View>
        </View>
      </View>

      <View style={itemStyles.verticalDivider} />

      <View style={itemStyles.cardContent}>
        <View style={itemStyles.cardTopRow}>
          <Text style={itemStyles.workoutTitle} {...textBreakProps}>
            {exercise.name}
          </Text>
          {!pickMode ? (
            <AnimatedPressable
              hitSlop={12}
              pressScale={0.9}
              pressOpacity={0.75}
              onPress={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={19} color={theme.text} />
            </AnimatedPressable>
          ) : null}
        </View>

        {typeLabel ? (
          <View style={itemStyles.metaRow}>
            <Ionicons name="barbell-outline" size={15} color={theme.accent} />
            <Text style={itemStyles.locationText} {...textBreakProps}>
              {typeLabel}
            </Text>
          </View>
        ) : null}

        {exercise.machine_location?.trim() ? (
          <View style={itemStyles.metaRow}>
            <Ionicons name="location-outline" size={14} color={theme.textMuted} />
            <Text style={itemStyles.noteText} {...textBreakProps}>
              {exercise.machine_location.trim()}
            </Text>
          </View>
        ) : exercise.notes?.trim() ? (
          <View style={itemStyles.metaRow}>
            <Ionicons name="document-text-outline" size={14} color={theme.textMuted} />
            <Text style={itemStyles.noteText} numberOfLines={1} {...textBreakProps}>
              {exercise.notes.trim()}
            </Text>
          </View>
        ) : null}

        <View style={itemStyles.metricsRow}>
          <ExerciseMetricItem
            itemStyles={itemStyles}
            kind="volume"
            value={`${sets}`}
            label="Подходы"
          />
          <ExerciseMetricItem
            itemStyles={itemStyles}
            kind="tonnage"
            value={bestKg != null && bestKg > 0 ? `${Math.round(bestKg)} кг` : "—"}
            label="Макс. вес"
          />
          <ExerciseMetricItem itemStyles={itemStyles} kind="duration" value={reps} label="Повторы" />
        </View>
      </View>
    </AnimatedPressable>
  );
}

function ExerciseMetricItem({
  itemStyles,
  kind,
  value,
  label,
}: {
  itemStyles: ReturnType<typeof createWorkoutListItemStyles>;
  kind: WorkoutMetricIconKind;
  value: string;
  label: string;
}) {
  const chipSize = useMetricChipSize();

  return (
    <View style={itemStyles.metricItem}>
      <MetricIconCircle figmaKind={kind} size={chipSize} />
      <View style={itemStyles.metricTextBlock}>
        <Text style={itemStyles.metricValue} {...textBreakProps}>
          {value}
        </Text>
        <Text style={itemStyles.metricLabel} {...textBreakProps}>
          {label}
        </Text>
      </View>
    </View>
  );
}

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
      minHeight: 42,
      marginBottom: 24,
      gap: 6,
    },
    titleRowPick: {
      alignItems: "flex-start",
    },
    titleTextWrap: {
      flex: 1,
      minWidth: 0,
      minHeight: 42,
      justifyContent: "center",
    },
    headerTitleBlockPick: {
      flex: 1,
      minWidth: 0,
      minHeight: 42,
      paddingHorizontal: 8,
      justifyContent: "center",
    },
    titleActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    titleSideSpacer: {
      width: 42,
      height: 42,
    },
    screenTitle: {
      ...type.screenTitle,
      minWidth: 0,
      color: theme.text,
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.8,
    },
    searchBox: {
      height: 50,
      borderRadius: PLAQUE_RADIUS,
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
      alignItems: "center",
    },
    filtersRowSingleLine: {
      flexWrap: "nowrap",
      gap: 4,
    },
    filterChip: {
      minHeight: 40,
      borderRadius: PLAQUE_RADIUS,
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
    filterChipActive: {
      backgroundColor: theme.accentSoft,
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
      flex: 1,
      minWidth: 0,
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
    loadingWrap: {
      minHeight: 80,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    loadingText: {
      fontFamily: fonts.semiBold,
      fontSize: 14,
      color: theme.textMuted,
    },
    endMessage: {
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    endMessageText: {
      fontFamily: fonts.semiBold,
      fontSize: 14,
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
      shadowOffset: { width: 0, height: 4 },
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
    cardPickMode: {
      overflow: "visible",
    },
    selectionMarker: {
      position: "absolute",
      top: 10,
      left: 10,
      zIndex: 2,
    },
    selectionCircleEmpty: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
    },
    selectionCircleFilled: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    selectionCircleText: {
      fontFamily: fonts.bold,
      fontSize: 13,
      lineHeight: 16,
      color: "#FFFFFF",
    },
    pickActionBtn: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      borderRadius: PLAQUE_RADIUS,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    pickActionBtnGhost: {
      borderWidth: 1,
      backgroundColor: theme.card,
    },
    pickActionBtnPrimary: {},
    pickActionBtnDisabled: {
      opacity: 0.45,
    },
    pickActionBtnGhostText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
    },
    pickActionBtnPrimaryText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      lineHeight: 16,
      color: "#FFFFFF",
      textAlign: "center",
    },
    pickActionBtnTextDisabled: {
      opacity: 0.7,
    },
  });
