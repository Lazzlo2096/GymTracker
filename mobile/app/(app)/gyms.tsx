import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { pickImageFromLibrary } from "@/permissions";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  PressableProps,
  ScrollView,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { useBottomTabBarScrollPadding } from "@/components/navigation/bottomTabBarInset";
import { useGoBackWithScreenEnter } from "@/components/navigation/ScreenEnterFrame";
import type { Href } from "expo-router";
import FloatingAddButton, {
  FAB_BOTTOM_OFFSET,
  FAB_PICK_ACTIONS_PADDING_RIGHT,
} from "@/components/ui/FloatingAddButton";
import SegmentedTabs, { type SegmentedTabItem } from "@/components/ui/SegmentedTabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { useTraceScreen } from "@/debug/useTraceScreen";
import { emit } from "@/utils/eventBus";
import { fetchWorkoutDetailById } from "@/api/workoutDetail";
import { emitWorkoutDetailUpdated } from "@/events/workoutDetailEvents";
import { markWorkoutsListStale } from "@/events/workoutsListEvents";
import { useCatalogUi } from "@/theme/catalogUi";
import { metricToken } from "@/components/workouts/metricIcon";
import { plaqueListShadow, PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import PickModeBottomPanel from "@/components/ui/PickModeBottomPanel";
import SnapHorizontalScroll from "@/components/ui/SnapHorizontalScroll";
import { pressableStyle } from "@/utils/pressableStyles";
import { SCREEN_HEADER_BOTTOM_MARGIN, SCREEN_HEADER_TOP_PADDING } from "@/theme/screenChrome";
import { fonts, type } from "@/theme/typography";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import WorkoutActionsSheet, { type ActionRow } from "@/components/modals/WorkoutActionsSheet";
import { downloadMediaUrl, openMediaUrl } from "@/utils/openMedia";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { uploadUserGymGalleryPhoto } from "@/utils/uploadUserGymPhoto";

type PendingPhoto = { uri: string; mimeType?: string | null };

function gymPhotoActions(path: string) {
  Alert.alert("Фото", undefined, [
    {
      text: "Открыть",
      onPress: () => {
        void openMediaUrl(path).catch((e) =>
          Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось открыть")
        );
      },
    },
    {
      text: "Скачать",
      onPress: () => {
        void downloadMediaUrl(path).catch((e) =>
          Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось скачать")
        );
      },
    },
    { text: "Отмена", style: "cancel" },
  ]);
}

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

export type UserGymDto = {
  id: number;
  user_id: number;
  name: string;
  address: string | null;
  is_favorite: boolean;
  rating: number | null;
  review_text: string | null;
  review_updated_at: string | null;
  last_visited_at: string | null;
  tags: string[];
  gallery_urls: string[];
  visit_count: number;
  last_workout_date: string | null;
  created_at: string;
};

const TAG_OPTIONS = ["Чисто", "Просторно", "Много тренажёров", "Многолюдно"] as const;

function normalizeGym(raw: Record<string, unknown>): UserGymDto {
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((x): x is string => typeof x === "string") : [];
  const gallery_urls = Array.isArray(raw.gallery_urls)
    ? raw.gallery_urls.filter((x): x is string => typeof x === "string")
    : [];
  return {
    id: Number(raw.id),
    user_id: Number(raw.user_id),
    name: typeof raw.name === "string" ? raw.name : "",
    address: typeof raw.address === "string" ? raw.address : null,
    is_favorite: Boolean(raw.is_favorite),
    rating: typeof raw.rating === "number" ? raw.rating : null,
    review_text: typeof raw.review_text === "string" ? raw.review_text : null,
    review_updated_at: typeof raw.review_updated_at === "string" ? raw.review_updated_at : null,
    last_visited_at: typeof raw.last_visited_at === "string" ? raw.last_visited_at : null,
    tags,
    gallery_urls,
    visit_count: typeof raw.visit_count === "number" ? raw.visit_count : 0,
    last_workout_date: typeof raw.last_workout_date === "string" ? raw.last_workout_date : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : "",
  };
}

function formatRuShort(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function relativeRu(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  const days = Math.floor(diff / (86400 * 1000));
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн. назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  if (days < 365) return `${Math.floor(days / 30)} мес. назад`;
  return `${Math.floor(days / 365)} г. назад`;
}

function parseDdMmYyyy(s: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);
  const d = new Date(yy, mm - 1, dd, 12, 0, 0);
  if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d.toISOString();
}

function visitLabel(g: UserGymDto): string {
  const iso = g.last_workout_date || (g.last_visited_at ? g.last_visited_at.slice(0, 10) : null);
  if (!iso) return "Ещё не посещён";
  return `Посещён: ${formatRuShort(iso)}`;
}

type TabKey = "all" | "visited" | "favorites";

const GYM_FILTER_TABS: readonly SegmentedTabItem<TabKey>[] = [
  { id: "all", label: "Все", nativeId: "gyms-filter-tab-all" },
  { id: "visited", label: "Посещённые", nativeId: "gyms-filter-tab-visited" },
  { id: "favorites", label: "Избранные", nativeId: "gyms-filter-tab-favorites" },
];

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

type GymPickTarget =
  | { kind: "workout"; id: number }
  | { kind: "profile" }
  | { kind: "catalogExercise"; id: number };

function parseGymPickTarget(params: {
  pickForWorkout?: string;
  pickForProfile?: string;
  pickForCatalogExercise?: string;
}): GymPickTarget | null {
  const catalogExerciseId = Number(params.pickForCatalogExercise);
  if (Number.isFinite(catalogExerciseId) && catalogExerciseId > 0) {
    return { kind: "catalogExercise", id: catalogExerciseId };
  }
  const pickProfile = params.pickForProfile;
  if (pickProfile === "1" || pickProfile === "true") {
    return { kind: "profile" };
  }
  const workoutId = Number(params.pickForWorkout);
  if (Number.isFinite(workoutId) && workoutId > 0) {
    return { kind: "workout", id: workoutId };
  }
  return null;
}

function pickModeSubtitle(target: GymPickTarget): string {
  switch (target.kind) {
    case "workout":
      return "Выберите зал для тренировки или сохраните без зала";
    case "profile":
      return "Выберите зал по умолчанию или сохраните без зала";
    case "catalogExercise":
      return "Выберите зал для упражнения или сохраните без зала";
  }
}

export default function GymsScreen() {
  useTraceScreen("gyms");
  const catalogUi = useCatalogUi();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 400 ? 20 : 16;
  const styles = useMemo(
    () => createStyles(catalogUi, horizontalPadding),
    [catalogUi, horizontalPadding],
  );
  const router = useRouter();
  const params = useLocalSearchParams<{
    pickForWorkout?: string;
    pickForProfile?: string;
    pickForCatalogExercise?: string;
    initialGymId?: string;
  }>();
  const pickTarget = parseGymPickTarget(params);
  const pickMode = pickTarget != null;
  const pickBackFallback = useMemo((): Href | undefined => {
    if (!pickTarget) return undefined;
    switch (pickTarget.kind) {
      case "workout":
        return `/workout/${pickTarget.id}`;
      case "profile":
        return "/profile";
      case "catalogExercise":
        return `/exercise-in-catalog/${pickTarget.id}`;
    }
  }, [pickTarget]);
  const goBack = useGoBackWithScreenEnter(pickBackFallback);
  const pickScopeKey = [
    params.pickForWorkout ?? "",
    params.pickForProfile ?? "",
    params.pickForCatalogExercise ?? "",
  ].join("|");
  const initialGymIdParam = Number(params.initialGymId);
  const initialGymId =
    Number.isFinite(initialGymIdParam) && initialGymIdParam > 0 ? initialGymIdParam : null;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [gyms, setGyms] = useState<UserGymDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"name" | "visit" | "rating">("visit");
  const [onlyWithReview, setOnlyWithReview] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<UserGymDto | null>(null);
  const [menuGym, setMenuGym] = useState<UserGymDto | null>(null);
  const [gymPendingArchive, setGymPendingArchive] = useState<UserGymDto | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<number | null>(initialGymId);
  const [confirmingPick, setConfirmingPick] = useState(false);

  useEffect(() => {
    if (!pickMode) {
      setSelectedGymId(null);
      return;
    }
    setSelectedGymId(initialGymId);
  }, [initialGymId, pickMode, pickScopeKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/v1/user_gyms/");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as unknown[];
      setGyms(Array.isArray(data) ? data.map((x) => normalizeGym(x as Record<string, unknown>)) : []);
    } catch {
      setGyms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = [...gyms];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.address && g.address.toLowerCase().includes(q))
      );
    }
    if (tab === "visited") list = list.filter((g) => g.visit_count > 0);
    if (tab === "favorites") list = list.filter((g) => g.is_favorite);
    if (onlyWithReview) list = list.filter((g) => (g.review_text || "").trim().length > 0);
    list.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, "ru");
      if (sortMode === "rating") {
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        return rb - ra;
      }
      const da = a.last_workout_date || a.last_visited_at || "";
      const db = b.last_workout_date || b.last_visited_at || "";
      return db.localeCompare(da);
    });
    return list;
  }, [gyms, search, tab, sortMode, onlyWithReview]);

  const visitedCount = useMemo(() => gyms.filter((g) => g.visit_count > 0).length, [gyms]);
  const lastReviewRel = useMemo(() => {
    let best: string | null = null;
    let bestT = 0;
    for (const g of gyms) {
      if (!g.review_text?.trim() || !g.review_updated_at) continue;
      const t = new Date(g.review_updated_at).getTime();
      if (t > bestT) {
        bestT = t;
        best = g.review_updated_at;
      }
    }
    return relativeRu(best);
  }, [gyms]);

  const favCount = useMemo(() => gyms.filter((g) => g.is_favorite).length, [gyms]);
  const favWithReview = useMemo(
    () => gyms.filter((g) => g.is_favorite && (g.review_text || "").trim()).length,
    [gyms]
  );

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (g: UserGymDto) => {
    setEditing(g);
    setEditorOpen(true);
  };

  const gymMenuActions = (g: UserGymDto): ActionRow[] => [
    {
      id: "favorite",
      label: g.is_favorite ? "Убрать из избранного" : "В избранное",
      icon: g.is_favorite ? "heart-dislike-outline" : "heart-outline",
    },
    { id: "edit", label: "Редактировать", icon: "create-outline" },
    { id: "archive", label: "Архивировать", icon: "archive-outline", destructive: true },
  ];

  const handleGymMenuSelect = (actionId: string) => {
    const g = menuGym;
    if (!g) return;
    if (actionId === "favorite") {
      void (async () => {
        try {
          const r = await apiFetch(`/api/v1/user_gyms/${g.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_favorite: !g.is_favorite }),
          });
          if (!r.ok) throw new Error(parseErrorDetail(await r.json().catch(() => ({}))));
          await load();
        } catch (e) {
          Alert.alert("Ошибка", e instanceof Error ? e.message : "");
        }
      })();
      return;
    }
    if (actionId === "edit") {
      openEdit(g);
      return;
    }
    if (actionId === "archive") {
      setGymPendingArchive(g);
    }
  };

  const sectionTitle = tab === "favorites" ? "Любимые залы" : "Недавно посещённые";

  const bottomPad = useBottomTabBarScrollPadding(pickMode ? 116 : 32);
  const selectedCount = selectedGymId != null ? 1 : 0;

  const toggleGymSelection = useCallback((gymId: number) => {
    setSelectedGymId((prev) => (prev === gymId ? null : gymId));
  }, []);

  const clearGymSelection = useCallback(() => {
    setSelectedGymId(null);
  }, []);

  const confirmGymSelection = useCallback(() => {
    if (!pickTarget || confirmingPick) return;

    if (selectedGymId === initialGymId) {
      goBack();
      return;
    }

    void (async () => {
      setConfirmingPick(true);
      try {
        let response: Response;
        if (pickTarget.kind === "workout") {
          response = await apiFetch(`/api/v1/workouts/${pickTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_gym_id: selectedGymId }),
          });
        } else if (pickTarget.kind === "profile") {
          response = await apiFetch("/api/v1/auth/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preferred_user_gym_id: selectedGymId }),
          });
        } else {
          response = await apiFetch(`/api/v1/exercises_in_catalog/${pickTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_gym_id: selectedGymId }),
          });
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseErrorDetail(payload));
        }
        if (pickTarget.kind === "workout") {
          markWorkoutsListStale();
          const detailResult = await fetchWorkoutDetailById(pickTarget.id);
          if (detailResult.kind === "success") {
            emitWorkoutDetailUpdated(detailResult.data);
          }
        } else if (pickTarget.kind === "profile") {
          emit("profile:updated");
        } else {
          emit("catalog:updated");
        }
        goBack();
      } catch (e) {
        Alert.alert(
          "Не удалось сохранить зал",
          e instanceof Error ? e.message : "Попробуйте ещё раз.",
        );
      } finally {
        setConfirmingPick(false);
      }
    })();
  }, [confirmingPick, goBack, initialGymId, pickTarget, selectedGymId]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={[styles.titleRow, pickMode && styles.titleRowPick]}>
            {pickMode ? (
              <ScreenTitleRowIconButton
                onPress={() => goBack()}
                hitSlop={12}
                accessibilityLabel="Назад"
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={24}
                  color={metricToken("violet", catalogUi.dark).fg}
                />
              </ScreenTitleRowIconButton>
            ) : null}
            <View style={pickMode ? styles.headerTitleBlockPick : styles.titleTextWrap}>
              <Text style={styles.screenTitle} {...textBreakProps}>
                Залы
              </Text>
            </View>
            <View style={styles.titleActions}>
              {!pickMode ? (
                <ScreenTitleRowIconButton
                  onPress={() => setFilterOpen(true)}
                  hitSlop={8}
                  accessibilityLabel="Фильтр и сортировка"
                >
                  <MaterialCommunityIcons
                    name="tune-variant"
                    size={22}
                    color={metricToken("violet", catalogUi.dark).fg}
                  />
                </ScreenTitleRowIconButton>
              ) : (
                <View style={styles.titleSideSpacer} />
              )}
            </View>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={catalogUi.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Поиск по названию или месту"
              placeholderTextColor={catalogUi.textPlaceholder}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <SegmentedTabs
            tabs={GYM_FILTER_TABS}
            value={tab}
            onChange={setTab}
            trackNativeId="gyms-filter-tabs"
            indicatorNativeId="gyms-filter-tab-indicator"
            style={{ marginBottom: 12 }}
          />

          <View style={styles.statsRow}>
          {tab === "favorites" ? (
            <>
              <View style={styles.statCard}>
                <View style={styles.statIconCircle}>
                  <Ionicons name="heart" size={20} color={catalogUi.accent} />
                </View>
                <Text style={styles.statLab}>В избранном</Text>
                <Text style={styles.statVal}>{favCount}</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statIconCircle}>
                  <Ionicons name="chatbubble-outline" size={20} color={catalogUi.accent} />
                </View>
                <Text style={styles.statLab}>Есть отзывы</Text>
                <Text style={styles.statVal}>{favWithReview}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.statCard}>
                <View style={styles.statIconCircle}>
                  <Ionicons name="location-outline" size={20} color={catalogUi.accent} />
                </View>
                <Text style={styles.statLab}>Посещено залов</Text>
                <Text style={styles.statVal}>{visitedCount}</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statIconCircle}>
                  <Ionicons name="calendar-outline" size={20} color={catalogUi.accent} />
                </View>
                <Text style={styles.statLab}>Последний отзыв</Text>
                <Text style={styles.statVal}>{lastReviewRel ?? "—"}</Text>
              </View>
            </>
          )}
        </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={catalogUi.accent} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(g) => String(g.id)}
            contentContainerStyle={{ paddingBottom: bottomPad }}
            ListHeaderComponent={<Text style={styles.sectionTitle}>{sectionTitle}</Text>}
            ListEmptyComponent={
              <Text style={styles.empty}>Нет залов по фильтру. Нажмите «+», чтобы добавить.</Text>
            }
            renderItem={({ item: g }) => (
              <GymCard
                catalogUi={catalogUi}
                styles={styles}
                gym={g}
                tab={tab}
                pickMode={pickMode}
                isSelected={selectedGymId === g.id}
                onToggleSelect={pickMode ? () => toggleGymSelection(g.id) : undefined}
                onMenu={() => setMenuGym(g)}
                onMyReview={() => openEdit(g)}
                onPhotos={async () => {
                  const asset = await pickImageFromLibrary({ quality: 0.85 });
                  if (!asset?.uri) return;
                  try {
                    await uploadUserGymGalleryPhoto(
                      g.id,
                      asset.uri,
                      asset.mimeType,
                    );
                    await load();
                  } catch (e) {
                    Alert.alert("Ошибка", e instanceof Error ? e.message : "");
                  }
                }}
                onOpen={() =>
                  pickMode
                    ? toggleGymSelection(g.id)
                    : Alert.alert(
                        g.name,
                        g.address?.trim() ? g.address : "Адрес не указан. Добавьте его при редактировании."
                      )
                }
                onRemoveFavorite={async () => {
                  try {
                    const r = await apiFetch(`/api/v1/user_gyms/${g.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ is_favorite: false }),
                    });
                    if (!r.ok) throw new Error(await r.text());
                    await load();
                  } catch (e) {
                    Alert.alert("Ошибка", e instanceof Error ? e.message : "");
                  }
                }}
              />
            )}
          />
        )}

        {pickMode && pickTarget ? (
          <PickModeBottomPanel
            hint={pickModeSubtitle(pickTarget)}
            bottom={FAB_BOTTOM_OFFSET}
            paddingLeft={horizontalPadding}
            paddingRight={FAB_PICK_ACTIONS_PADDING_RIGHT}
          >
              <Pressable
                style={pressableStyle(
                  [
                    styles.pickActionBtn,
                    styles.pickActionBtnGhost,
                    { borderColor: catalogUi.border },
                    selectedCount === 0 && styles.pickActionBtnDisabled,
                  ],
                  { pressed: { opacity: 0.88 }, disabled: selectedCount === 0 || confirmingPick },
                )}
                onPress={clearGymSelection}
                disabled={selectedCount === 0 || confirmingPick}
                accessibilityRole="button"
                accessibilityLabel="Очистить выбор"
              >
                <Text
                  style={[
                    styles.pickActionBtnGhostText,
                    { color: catalogUi.textMuted },
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
                    { backgroundColor: catalogUi.accent },
                    confirmingPick && styles.pickActionBtnDisabled,
                  ],
                  { pressed: { opacity: 0.88 }, disabled: confirmingPick },
                )}
                onPress={confirmGymSelection}
                disabled={confirmingPick}
                accessibilityRole="button"
                accessibilityLabel={
                  selectedCount > 0 ? `Выбрать ${selectedCount}` : "Сохранить без зала"
                }
              >
                {confirmingPick ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.pickActionBtnPrimaryText} {...textBreakProps}>
                    {selectedCount > 0 ? `Выбрать (${selectedCount})` : "Без зала"}
                  </Text>
                )}
              </Pressable>
          </PickModeBottomPanel>
        ) : null}

        <FloatingAddButton
          onPress={openNew}
          accessibilityLabel="Добавить зал"
          disabled={pickMode && confirmingPick}
        />
      </View>

      <Modal
        visible={filterOpen}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.filterCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.filterTitle}>Фильтр и сортировка</Text>
            <Text style={styles.filterSub}>Сортировка</Text>
            {(
              [
                ["name", "По названию"],
                ["visit", "По дате посещения"],
                ["rating", "По оценке"],
              ] as const
            ).map(([k, lab]) => (
              <Pressable
                key={k}
                style={pressableStyle([styles.filterRow, sortMode === k && styles.filterRowActive], {
                  pressed: { opacity: 0.88 },
                })}
                onPress={() => setSortMode(k)}
              >
                <Text style={[styles.filterRowText, sortMode === k && styles.filterRowTextActive]}>{lab}</Text>
                {sortMode === k ? <Ionicons name="checkmark" size={20} color={catalogUi.accent} /> : null}
              </Pressable>
            ))}
            <Pressable
              style={pressableStyle(styles.filterRow, { pressed: { opacity: 0.88 } })}
              onPress={() => setOnlyWithReview((v) => !v)}
            >
              <Text style={styles.filterRowText}>Только с отзывом</Text>
              <Ionicons name={onlyWithReview ? "checkbox" : "square-outline"} size={22} color={catalogUi.accent} />
            </Pressable>
            <Pressable
              style={pressableStyle(styles.filterClose, { pressed: { opacity: 0.88 } })}
              onPress={() => setFilterOpen(false)}
            >
              <Text style={styles.filterCloseText}>Готово</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <GymEditorModal
        catalogUi={catalogUi}
        styles={styles}
        visible={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={load}
      />

      <WorkoutActionsSheet
        visible={menuGym != null}
        title={menuGym?.name ?? "Зал"}
        actions={menuGym ? gymMenuActions(menuGym) : []}
        onClose={() => setMenuGym(null)}
        onDismiss={() => setMenuGym(null)}
        onSelect={handleGymMenuSelect}
      />

      <WorkoutDeleteConfirmModal
        visible={gymPendingArchive != null}
        title="Архивировать зал?"
        message={
          gymPendingArchive
            ? `«${gymPendingArchive.name}» скроется из списка. Тренировки с этим залом сохранятся.`
            : ""
        }
        confirmLabel="Архивировать"
        onCancel={() => setGymPendingArchive(null)}
        onConfirm={() => {
          const g = gymPendingArchive;
          if (!g) return;
          setGymPendingArchive(null);
          void (async () => {
            try {
              const r = await apiFetch(`/api/v1/user_gyms/${g.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_archived: true }),
              });
              if (!r.ok) throw new Error(parseErrorDetail(await r.json().catch(() => ({}))));
              await load();
            } catch (e) {
              Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось архивировать");
            }
          })();
        }}
      />
    </>
  );
}

function GymCard({
  catalogUi,
  styles,
  gym: g,
  tab,
  pickMode = false,
  isSelected = false,
  onToggleSelect,
  onMenu,
  onMyReview,
  onPhotos,
  onOpen,
  onRemoveFavorite,
}: {
  catalogUi: ReturnType<typeof useCatalogUi>;
  styles: ReturnType<typeof createStyles>;
  gym: UserGymDto;
  tab: TabKey;
  pickMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onMenu: () => void;
  onMyReview: () => void;
  onPhotos: () => void;
  onOpen: () => void;
  onRemoveFavorite: () => void;
}) {
  const cover = g.gallery_urls[0] ? resolveMediaUrl(g.gallery_urls[0]) : null;
  const ratingStr = g.rating != null ? String(g.rating) : "—";

  const cardBody = (
    <>
      {pickMode ? (
        <View style={styles.selectionMarker} pointerEvents="none">
          {isSelected ? (
            <View style={[styles.selectionCircleFilled, { backgroundColor: catalogUi.accent }]}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            </View>
          ) : (
            <View
              style={[
                styles.selectionCircleEmpty,
                { borderColor: catalogUi.border, backgroundColor: catalogUi.cardBg },
              ]}
            />
          )}
        </View>
      ) : null}
      <View style={styles.cardTop}>
        <View style={styles.cardImgWrap}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cardImg} />
          ) : (
            <View style={[styles.cardImg, styles.cardImgPh]}>
              <Ionicons name="image-outline" size={36} color={catalogUi.accentMuted} />
            </View>
          )}
          {g.is_favorite ? (
            <View style={styles.favBadge}>
              <Ionicons name="heart" size={12} color="#fff" />
              <Text style={styles.favBadgeTxt}>В избранном</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.cardRight}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} {...textBreakProps}>
              {g.name}
            </Text>
            {!pickMode ? (
              <Pressable onPress={onMenu} hitSlop={10}>
                <Ionicons name="ellipsis-vertical" size={20} color={catalogUi.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {g.address ? (
            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={14} color={catalogUi.accent} />
              <Text style={styles.addrTxt} {...textBreakProps}>
                {g.address}
              </Text>
            </View>
          ) : null}
          <View style={styles.rateRow}>
            <Ionicons name="star" size={14} color={catalogUi.accent} />
            <Text style={styles.rateTxt}>{ratingStr}</Text>
            <Text style={styles.dot}> · </Text>
            <Text style={styles.visitTxt}>{visitLabel(g)}</Text>
          </View>
        </View>
      </View>
      {g.review_text ? (
        <Text style={styles.snippet} {...textBreakProps}>
          {g.review_text}
        </Text>
      ) : null}
      {!pickMode ? (
        <>
          <SnapHorizontalScroll itemWidth={56} gap={8} style={styles.thumbRow}>
            {g.gallery_urls.slice(0, 3).map((u, i) => (
              <Pressable key={`${u}-${i}`} onPress={() => gymPhotoActions(u)}>
                <Image source={{ uri: resolveMediaUrl(u) }} style={styles.thumb} />
              </Pressable>
            ))}
            {g.gallery_urls.length === 0 ? (
              <View style={[styles.thumb, styles.thumbPh]}>
                <Text style={styles.thumbPhTxt}>Нет фото</Text>
              </View>
            ) : null}
          </SnapHorizontalScroll>
          {tab === "favorites" ? (
            <View style={styles.cardBtns}>
              <Pressable style={pressableStyle(styles.cardBtn, { pressed: { opacity: 0.88 } })} onPress={onOpen}>
                <Ionicons name="open-outline" size={18} color={catalogUi.text} />
                <Text style={styles.cardBtnTxt}>Открыть</Text>
              </Pressable>
              <Pressable
                style={pressableStyle(styles.cardBtn, { pressed: { opacity: 0.88 } })}
                onPress={onRemoveFavorite}
              >
                <Ionicons name="trash-outline" size={18} color={catalogUi.text} />
                <Text style={styles.cardBtnTxt}>Убрать</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cardBtns}>
              <Pressable
                style={pressableStyle(styles.cardBtn, { pressed: { opacity: 0.88 } })}
                onPress={onMyReview}
              >
                <Ionicons name="pencil-outline" size={18} color={catalogUi.text} />
                <Text style={styles.cardBtnTxt}>Мой отзыв</Text>
              </Pressable>
              <Pressable
                style={pressableStyle(styles.cardBtn, { pressed: { opacity: 0.88 } })}
                onPress={onPhotos}
              >
                <Ionicons name="images-outline" size={18} color={catalogUi.text} />
                <Text style={styles.cardBtnTxt}>{g.gallery_urls.length} фото</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : null}
    </>
  );

  if (pickMode) {
    return (
      <AnimatedPressable
        style={[styles.card, styles.cardPickMode]}
        pressScale={0.985}
        pressOpacity={0.93}
        onPress={onToggleSelect ?? onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${isSelected ? "Снять выбор" : "Выбрать"} зал ${g.name}`}
      >
        {cardBody}
      </AnimatedPressable>
    );
  }

  return <View style={styles.card}>{cardBody}</View>;
}

function GymEditorModal({
  catalogUi,
  styles,
  visible,
  initial,
  onClose,
  onSaved,
}: {
  catalogUi: ReturnType<typeof useCatalogUi>;
  styles: ReturnType<typeof createStyles>;
  visible: boolean;
  initial: UserGymDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [visitStr, setVisitStr] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  React.useEffect(() => {
    if (!visible) return;
    if (initial) {
      setName(initial.name);
      setAddress(initial.address ?? "");
      const iso = initial.last_workout_date || (initial.last_visited_at ? initial.last_visited_at.slice(0, 10) : "");
      if (iso) {
        const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
        setVisitStr(
          `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
        );
      } else setVisitStr("");
      setRating(initial.rating ?? 0);
      setReview(initial.review_text ?? "");
      setTags([...initial.tags]);
      setPendingPhotos([]);
      setFav(initial.is_favorite);
    } else {
      setName("");
      setAddress("");
      const d = new Date();
      setVisitStr(
        `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
      );
      setRating(4);
      setReview("");
      setTags([]);
      setPendingPhotos([]);
      setFav(false);
    }
    setErr("");
  }, [visible, initial]);

  const toggleTag = (t: string) => {
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  };

  const pickPhoto = async () => {
    const asset = await pickImageFromLibrary({ quality: 0.85 });
    if (!asset?.uri) return;
    setPendingPhotos((p) => [
      ...p,
      { uri: asset.uri, mimeType: asset.mimeType ?? null },
    ]);
  };

  const removePending = (uri: string) =>
    setPendingPhotos((p) => p.filter((x) => x.uri !== uri));

  const save = async () => {
    const n = name.trim();
    if (!n) {
      setErr("Введите название зала");
      return;
    }
    const visitIso = visitStr.trim() ? parseDdMmYyyy(visitStr.trim()) : null;
    if (visitStr.trim() && !visitIso) {
      setErr("Дата в формате ДД.ММ.ГГГГ");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      if (initial) {
        const r = await apiFetch(`/api/v1/user_gyms/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: n,
            address: address.trim() || null,
            last_visited_at: visitIso,
            rating: rating > 0 ? rating : null,
            review_text: review.trim() || null,
            tags,
            is_favorite: fav,
            gallery_urls: initial.gallery_urls,
          }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(parseErrorDetail(d));
        }
        for (const photo of pendingPhotos) {
          await uploadUserGymGalleryPhoto(initial.id, photo.uri, photo.mimeType);
        }
      } else {
        const r = await apiFetch("/api/v1/user_gyms/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: n,
            address: address.trim() || null,
            last_visited_at: visitIso,
            rating: rating > 0 ? rating : null,
            review_text: review.trim() || null,
            tags,
            is_favorite: fav,
            gallery_urls: [],
          }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(parseErrorDetail(d));
        }
        const created = (await r.json()) as Record<string, unknown>;
        const id = Number(created.id);
        if (Number.isFinite(id)) {
          for (const photo of pendingPhotos) {
            await uploadUserGymGalleryPhoto(id, photo.uri, photo.mimeType);
          }
        }
      }
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{initial ? "Редактировать зал" : "Новый зал"}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={catalogUi.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.lab}>Название зала</Text>
            <TextInput
              style={styles.inp}
              value={name}
              onChangeText={setName}
              placeholder="Например: World Class"
              placeholderTextColor={catalogUi.textPlaceholder}
            />
            <Text style={styles.lab}>Адрес / локация</Text>
            <TextInput
              style={styles.inp}
              value={address}
              onChangeText={setAddress}
              placeholder="Введите адрес"
              placeholderTextColor={catalogUi.textPlaceholder}
            />
            <Text style={styles.lab}>Дата посещения</Text>
            <TextInput
              style={styles.inp}
              value={visitStr}
              onChangeText={setVisitStr}
              placeholder="ДД.ММ.ГГГГ"
              placeholderTextColor={catalogUi.textPlaceholder}
            />
            <View style={styles.favRow}>
              <Text style={styles.labInline}>В избранном</Text>
              <Pressable onPress={() => setFav((v) => !v)}>
                <Ionicons name={fav ? "heart" : "heart-outline"} size={28} color={catalogUi.accent} />
              </Pressable>
            </View>
            <Text style={styles.lab}>Оценка</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable key={i} onPress={() => setRating(i)}>
                  <Ionicons name={i <= rating ? "star" : "star-outline"} size={32} color={catalogUi.accent} />
                </Pressable>
              ))}
            </View>
            <Text style={styles.lab}>Отзыв</Text>
            <TextInput
              style={[styles.inp, styles.textArea]}
              value={review}
              onChangeText={setReview}
              placeholder="Что понравилось, что можно улучшить..."
              placeholderTextColor={catalogUi.textPlaceholder}
              multiline
            />
            <Text style={styles.lab}>Фотографии</Text>
            <SnapHorizontalScroll gap={8} style={styles.photoStrip} contentContainerStyle={styles.photoStripContent}>
              {(initial?.gallery_urls ?? []).map((u) => (
                <Pressable key={u} onPress={() => gymPhotoActions(u)}>
                  <Image source={{ uri: resolveMediaUrl(u) }} style={styles.photoThumb} />
                </Pressable>
              ))}
              {pendingPhotos.map((photo) => (
                <View key={photo.uri} style={styles.photoThumbWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  <Pressable
                    style={pressableStyle(styles.photoDel, { pressed: { opacity: 0.88 } })}
                    onPress={() => removePending(photo.uri)}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={pressableStyle(styles.photoAdd, { pressed: { opacity: 0.88 } })}
                onPress={pickPhoto}
              >
                <Ionicons name="add" size={28} color={catalogUi.accent} />
                <Text style={styles.photoAddTxt}>Добавить</Text>
              </Pressable>
            </SnapHorizontalScroll>
            <Text style={styles.lab}>Особенности</Text>
            <View style={styles.tagsRow}>
              {TAG_OPTIONS.map((t) => {
                const on = tags.includes(t);
                return (
                  <Pressable
                    key={t}
                    style={pressableStyle([styles.tagChip, on && styles.tagChipOn], {
                      pressed: { opacity: 0.88 },
                    })}
                    onPress={() => toggleTag(t)}
                  >
                    {on ? <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} /> : null}
                    <Text style={[styles.tagChipTxt, on && styles.tagChipTxtOn]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <View style={styles.sheetFooter}>
              <Pressable onPress={onClose} disabled={busy}>
                <Text style={styles.cancelTxt}>Отмена</Text>
              </Pressable>
              <Pressable
                style={pressableStyle(styles.saveBtn, { pressed: { opacity: 0.88 }, disabled: busy })}
                onPress={() => void save()}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Сохранить</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (
  catalogUi: ReturnType<typeof useCatalogUi>,
  horizontalPadding: number,
) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: catalogUi.pageBg,
    paddingTop: SCREEN_HEADER_TOP_PADDING,
    paddingHorizontal: horizontalPadding,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  header: {
    marginBottom: SCREEN_HEADER_BOTTOM_MARGIN,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 6,
    minHeight: 42,
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
  screenTitle: {
    ...type.screenTitle,
    minWidth: 0,
    color: catalogUi.text,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.8,
  },
  titleSideSpacer: {
    width: 42,
    height: 42,
  },
  searchBox: {
    height: 50,
    borderRadius: PLAQUE_RADIUS,
    backgroundColor: catalogUi.cardBg,
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
    color: catalogUi.text,
    paddingVertical: 0,
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: catalogUi.cardBg,
    borderRadius: PLAQUE_RADIUS,
    padding: 14,
    alignItems: "center",
    ...plaqueListShadow(),
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: catalogUi.iconCircleBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statLab: { fontFamily: fonts.regular, fontSize: 12, color: catalogUi.textMuted, textAlign: "center" },
  statVal: { fontFamily: fonts.bold, fontSize: 14, color: catalogUi.accent, marginTop: 4 },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: catalogUi.text,
    marginBottom: 10,
    marginTop: 12,
  },
  empty: { fontFamily: fonts.regular, color: catalogUi.textMuted, textAlign: "center", marginTop: 24 },
  card: {
    backgroundColor: catalogUi.cardBg,
    borderRadius: PLAQUE_RADIUS,
    padding: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    position: "relative",
    overflow: "hidden",
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
    backgroundColor: catalogUi.cardBg,
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
  cardTop: { flexDirection: "row", gap: 10 },
  cardImgWrap: { position: "relative", width: 96 },
  cardImg: { width: 96, height: 110, borderRadius: 12, backgroundColor: catalogUi.border },
  cardImgPh: { alignItems: "center", justifyContent: "center" },
  cardRight: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: catalogUi.text,
    marginRight: 8,
  },
  addrRow: { flexDirection: "row", gap: 4, marginTop: 4, alignItems: "flex-start" },
  addrTxt: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: catalogUi.textMuted },
  rateRow: { flexDirection: "row", alignItems: "center", marginTop: 8, flexWrap: "wrap" },
  rateTxt: { fontFamily: fonts.bold, fontSize: 13, color: catalogUi.accent, marginLeft: 4 },
  dot: { color: catalogUi.textMuted },
  visitTxt: { fontFamily: fonts.regular, fontSize: 12, color: catalogUi.textMuted },
  snippet: { fontFamily: fonts.regular, fontSize: 12, color: catalogUi.textMuted, marginTop: 10, lineHeight: 18 },
  thumbRow: { marginTop: 10, flexDirection: "row" },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: catalogUi.border },
  thumbPh: { alignItems: "center", justifyContent: "center" },
  thumbPhTxt: { fontSize: 10, color: catalogUi.textMuted, fontFamily: fonts.regular },
  cardBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  cardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: catalogUi.iconCircleBg,
  },
  cardBtnTxt: { fontFamily: fonts.semiBold, fontSize: 14, color: catalogUi.text },
  favBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: catalogUi.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  favBadgeTxt: { color: "#fff", fontSize: 10, fontFamily: fonts.bold, maxWidth: 72 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  filterCard: {
    backgroundColor: catalogUi.cardBg,
    borderRadius: 16,
    padding: 16,
  },
  filterTitle: { fontFamily: fonts.extraBold, fontSize: 20, color: catalogUi.text, marginBottom: 12 },
  filterSub: { fontFamily: fonts.semiBold, fontSize: 13, color: catalogUi.textMuted, marginBottom: 8 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  filterRowActive: { backgroundColor: catalogUi.iconCircleBg, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  filterRowText: { fontFamily: fonts.regular, fontSize: 14, color: catalogUi.text },
  filterRowTextActive: { fontFamily: fonts.bold, color: catalogUi.accent },
  filterClose: { marginTop: 16, alignItems: "center" },
  filterCloseText: { fontFamily: fonts.bold, fontSize: 14, color: catalogUi.accent },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: catalogUi.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginBottom: 12,
  },
  sheetTitle: { fontFamily: fonts.extraBold, fontSize: 20, color: catalogUi.text },
  lab: { fontFamily: fonts.semiBold, fontSize: 13, color: catalogUi.textMuted, marginBottom: 6, marginTop: 8 },
  favRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingVertical: 4,
  },
  labInline: { fontFamily: fonts.semiBold, fontSize: 14, color: catalogUi.text },
  inp: {
    backgroundColor: catalogUi.border,
    borderRadius: 12,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: catalogUi.text,
  },
  textArea: { minHeight: 88, textAlignVertical: "top" },
  starsRow: { flexDirection: "row", gap: 8, marginVertical: 8 },
  photoStrip: { marginBottom: 8 },
  photoStripContent: { paddingRight: 8 },
  photoThumb: { width: 72, height: 72, borderRadius: 10 },
  photoThumbWrap: { position: "relative", width: 72, height: 72 },
  photoDel: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    padding: 2,
  },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: catalogUi.iconCircleBg,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddTxt: { fontSize: 10, color: catalogUi.accent, fontFamily: fonts.semiBold, marginTop: 2 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: catalogUi.iconCircleBg,
  },
  tagChipOn: { backgroundColor: catalogUi.accent },
  tagChipTxt: { fontFamily: fonts.semiBold, fontSize: 13, color: catalogUi.text },
  tagChipTxtOn: { color: "#fff" },
  err: { color: "#c00", fontFamily: fonts.regular, marginTop: 8 },
  sheetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  cancelTxt: { fontFamily: fonts.semiBold, fontSize: 14, color: catalogUi.textMuted, padding: 8 },
  saveBtn: {
    backgroundColor: catalogUi.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 140,
    alignItems: "center",
  },
  saveBtnTxt: { fontFamily: fonts.bold, fontSize: 14, color: "#fff" },
  });
