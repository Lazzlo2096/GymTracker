import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { pickImageFromLibrary } from "@/permissions";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import CatalogExerciseFormModal from "@/components/modals/CatalogExerciseFormModal";
import { useTraceScreen } from "@/debug/useTraceScreen";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import { ExerciseGlyph } from "@/components/exercise/ExerciseGlyph";
import ScreenEnterFrame, { useGoBackWithScreenEnter } from "@/components/navigation/ScreenEnterFrame";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import SnapHorizontalScroll from "@/components/ui/SnapHorizontalScroll";
import {
  METRIC_SNAP_GAP,
  metricSnapItemWidth,
  workoutScreenHorizontalPadding,
} from "@/components/workouts/metricSnapLayout";
import {
  MetricIconCircle,
  metricToken,
  useMetricChipSize,
  type MetricVariant,
} from "@/components/workouts/metricIcon";
import type { WorkoutMetricIconKind } from "@/components/icons/WorkoutFigmaIcons";
import { apiFetch, parseErrorDetail } from "@/api/client";
import type { GuardedFocusLoadResult } from "@/hooks/useGuardedFocusLoad";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import TextFieldModal from "@/components/profile/modals/TextFieldModal";
import { exerciseTypeLabel } from "@/constants/exerciseType";
import { on, emit } from "@/utils/eventBus";
import { openMediaUrl } from "@/utils/openMedia";
import { pressableStyle } from "@/utils/pressableStyles";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { deleteExerciseCatalogImage } from "@/utils/deleteExerciseCatalogImage";
import {
  formatMachineSettings,
  parseMachineSettingsText,
} from "@/utils/machineSettingsText";
import { uploadExerciseCatalogImage } from "@/utils/uploadExerciseCatalogImage";
import { useAppTheme } from "@/theme/appTheme";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import { fonts, type } from "@/theme/typography";

/** Зазор под компактной шапкой детального экрана (меньше, чем на списках). */
const DETAIL_HEADER_BOTTOM_MARGIN = 12;

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

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

type ExerciseInCatalog = {
  id: number;
  user_id: number;
  name: string;
  notes?: string | null;
  muscle_group?: string | null;
  exercise_type?: string | null;
  machine_location?: string | null;
  machine_settings?: Record<string, unknown> | string | null;
  icon?: string | null;
  image?: string | null;
  created_at?: string | null;
  user_gym?: { id?: number; name?: string | null } | null;
  user_gym_id?: number | null;
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

type CatalogDetailLoad = {
  exercise: ExerciseInCatalog;
  muscleOpts: { id: string; label: string }[];
  stats: ExerciseLogStats | null;
};

function mergedMuscleOptions(exercises: { muscle_group?: string | null }[]): { id: string; label: string }[] {
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

function formatCreatedAt(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRepsRange(stats: ExerciseLogStats | null | undefined): string {
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

function gymDisplayName(exercise: ExerciseInCatalog): string {
  const fromBrief = exercise.user_gym?.name?.trim();
  if (fromBrief) return fromBrief;
  return "";
}

export default function ExerciseInCatalogDetailScreen() {
  useTraceScreen("exercise-in-catalog/[id]");
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const goBack = useGoBackWithScreenEnter("/exercise_catalog");
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalogId = Number(id);
  const horizontalPadding = workoutScreenHorizontalPadding(width);
  const insets = useSafeAreaInsets();

  const [exercise, setExercise] = useState<ExerciseInCatalog | null>(null);
  const [stats, setStats] = useState<ExerciseLogStats | null>(null);
  const [muscleOpts, setMuscleOpts] = useState<{ id: string; label: string }[]>(
    DEFAULT_MUSCLE_GROUPS.map((g) => ({ id: g, label: g })),
  );
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [deletePhotoConfirmOpen, setDeletePhotoConfirmOpen] = useState(false);
  const [machineSettingsOpen, setMachineSettingsOpen] = useState(false);
  const [machineLocationOpen, setMachineLocationOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);

  const summaryCardWidth = useMemo(
    () => metricSnapItemWidth(width - horizontalPadding * 2),
    [horizontalPadding, width],
  );

  const fetchCatalogDetail = useCallback(async (): Promise<
    GuardedFocusLoadResult<CatalogDetailLoad>
  > => {
    const [rEx, rList, rLog] = await Promise.all([
      apiFetch(`/api/v1/exercises_in_catalog/${catalogId}`),
      apiFetch("/api/v1/exercises_in_catalog/?limit=500"),
      apiFetch("/api/v1/exercises_in_catalog/log_summary"),
    ]);
    if (!rEx.ok) {
      return { kind: "not_found" };
    }
    const ex = (await rEx.json()) as ExerciseInCatalog;
    let nextMuscleOpts = DEFAULT_MUSCLE_GROUPS.map((g) => ({ id: g, label: g }));
    if (rList.ok) {
      const lst = (await rList.json()) as ExerciseInCatalog[];
      nextMuscleOpts = mergedMuscleOptions(Array.isArray(lst) ? lst : []);
    }
    let nextStats: ExerciseLogStats | null = null;
    if (rLog.ok) {
      const log = (await rLog.json()) as CatalogLogSummary;
      nextStats =
        log.by_exercise?.find((b) => b.exercise_in_catalog_id === catalogId) ?? null;
    }
    return {
      kind: "success",
      data: { exercise: ex, muscleOpts: nextMuscleOpts, stats: nextStats },
    };
  }, [catalogId]);

  const {
    loading,
    reload,
    invalidateInFlightLoads,
  } = useGuardedFocusLoad({
    enabled: Number.isFinite(catalogId) && catalogId > 0,
    load: fetchCatalogDetail,
    onSuccess: (data) => {
      setExercise(data.exercise);
      setMuscleOpts(data.muscleOpts);
      setStats(data.stats);
      setError(null);
    },
    onNotFound: () => {
      setExercise(null);
      setStats(null);
      setError("Упражнение не найдено");
    },
    onError: (message) => {
      setExercise(null);
      setStats(null);
      setError(message);
    },
    onDisabled: () => {
      setExercise(null);
      setStats(null);
      setError("Некорректный id упражнения");
    },
  });

  useEffect(() => {
    return on("catalog:updated", () => {
      void reload({ silent: true });
    });
  }, [reload]);

  const imageUri = resolveMediaUrl(exercise?.image);
  const hasJournalStats = (stats?.total_sets ?? 0) > 0;

  const runDeletePhoto = useCallback(async () => {
    if (!Number.isFinite(catalogId) || deletingPhoto || uploadingPhoto) return;
    setDeletePhotoConfirmOpen(false);
    setDeletingPhoto(true);
    try {
      await deleteExerciseCatalogImage(catalogId);
      emit("catalog:updated");
      await reload({ silent: true });
    } catch (e) {
      Alert.alert(
        "Не удалось удалить фото",
        e instanceof Error ? e.message : "Попробуйте ещё раз.",
      );
    } finally {
      setDeletingPhoto(false);
    }
  }, [catalogId, deletingPhoto, reload, uploadingPhoto]);

  const pickPhoto = useCallback(async () => {
    if (!Number.isFinite(catalogId) || uploadingPhoto || deletingPhoto) return;
    const asset = await pickImageFromLibrary({ quality: 0.85 });
    if (!asset?.uri) return;
    setUploadingPhoto(true);
    try {
      await uploadExerciseCatalogImage(catalogId, asset.uri, asset.mimeType);
      emit("catalog:updated");
      await reload({ silent: true });
    } catch (e) {
      Alert.alert(
        "Не удалось загрузить фото",
        e instanceof Error ? e.message : "Попробуйте ещё раз.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  }, [catalogId, deletingPhoto, reload, uploadingPhoto]);
  const machineSettingsText = formatMachineSettings(exercise?.machine_settings ?? null);
  const machineLocationText = exercise?.machine_location?.trim() ?? "";

  const saveMachineLocation = useCallback(
    async (text: string) => {
      if (!Number.isFinite(catalogId)) return;
      const machine_location = text.trim() || null;
      const response = await apiFetch(`/api/v1/exercises_in_catalog/${catalogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machine_location }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseErrorDetail(payload));
      }
      emit("catalog:updated");
      await reload({ silent: true });
    },
    [catalogId, reload],
  );

  const saveMachineSettings = useCallback(
    async (text: string) => {
      if (!Number.isFinite(catalogId)) return;
      const machine_settings = parseMachineSettingsText(text);
      const response = await apiFetch(`/api/v1/exercises_in_catalog/${catalogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machine_settings }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseErrorDetail(payload));
      }
      emit("catalog:updated");
      await reload({ silent: true });
    },
    [catalogId, reload],
  );

  const notesText = exercise?.notes?.trim() ?? "";

  const saveNotes = useCallback(
    async (text: string) => {
      if (!Number.isFinite(catalogId)) return;
      const notes = text.trim() || null;
      const response = await apiFetch(`/api/v1/exercises_in_catalog/${catalogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseErrorDetail(payload));
      }
      emit("catalog:updated");
      await reload({ silent: true });
    },
    [catalogId, reload],
  );

  const exerciseName = exercise?.name?.trim() ?? "";

  const saveName = useCallback(
    async (text: string) => {
      if (!Number.isFinite(catalogId)) return;
      const name = text.trim();
      if (!name) {
        throw new Error("Введите название упражнения");
      }
      if (name === exerciseName) return;
      const response = await apiFetch(`/api/v1/exercises_in_catalog/${catalogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseErrorDetail(payload));
      }
      emit("catalog:updated");
      await reload({ silent: true });
    },
    [catalogId, exerciseName, reload],
  );

  const gymName = exercise ? gymDisplayName(exercise) : "";

  if (!Number.isFinite(catalogId)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Некорректный id</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.stateText}>Загружаем упражнение…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !exercise) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Не удалось открыть упражнение</Text>
          <Text style={styles.stateText}>{error ?? "Данные недоступны."}</Text>
          <Pressable style={styles.retryButton} onPress={() => void reload({ force: true })}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const typeLabel = exerciseTypeLabel(exercise.exercise_type);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <ScreenEnterFrame>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: horizontalPadding, paddingBottom: 32 },
            Platform.OS === "web" ? styles.contentWebOverflowVisible : null,
          ]}
        >
          <DetailHeader
            onBack={() => goBack()}
            onEdit={() => setEditOpen(true)}
          />

          <View style={styles.infoCard}>
            <Pressable
              style={pressableStyle(styles.infoTitleRow, { pressed: { opacity: 0.88 } })}
              onPress={() => setNameOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Изменить название упражнения"
              accessibilityHint="Нажмите, чтобы изменить"
            >
              <Text style={[styles.infoCardTitle, styles.infoCardTitleFlex]} {...textBreakProps}>
                {exercise.name}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </Pressable>

            {imageUri ? (
              <View style={styles.heroInlineImageOuter} pointerEvents="box-none">
                <View style={styles.heroInlineImageClip}>
                  <Pressable
                    style={styles.heroInlineImagePressable}
                    onPress={() => {
                      if (exercise.image) {
                        void openMediaUrl(exercise.image).catch((e) =>
                          Alert.alert(
                            "Ошибка",
                            e instanceof Error ? e.message : "Не удалось открыть фото",
                          ),
                        );
                      }
                    }}
                    accessibilityLabel="Открыть фото упражнения"
                  >
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.heroInlineImage}
                      contentFit="cover"
                      accessibilityLabel={`Изображение: ${exercise.name}`}
                    />
                  </Pressable>
                </View>
                <Pressable
                  style={pressableStyle(styles.heroImageDel, { pressed: { opacity: 0.88 } })}
                  onPress={() => setDeletePhotoConfirmOpen(true)}
                  disabled={deletingPhoto || uploadingPhoto}
                  hitSlop={12}
                  accessibilityLabel="Удалить фото"
                >
                  {deletingPhoto ? (
                    <ActivityIndicator size="small" color={theme.danger} />
                  ) : (
                    <Ionicons name="close" size={18} color={theme.danger} />
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.heroInlineIconWrap}>
                <View style={styles.heroInlineIconCircle}>
                  <ExerciseGlyph
                    name={exercise.icon ?? undefined}
                    size={44}
                    dark={theme.dark}
                    color={metricToken("violet", theme.dark).fg}
                  />
                </View>
              </View>
            )}

            <View style={styles.photoAddRow}>
              <Pressable
                style={pressableStyle(styles.photoAdd, { pressed: { opacity: 0.88 } })}
                onPress={() => void pickPhoto()}
                disabled={uploadingPhoto || deletingPhoto}
                accessibilityLabel="Добавить фото"
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <>
                    <Ionicons name="add" size={28} color={theme.accent} />
                    <Text style={styles.photoAddTxt}>Добавить</Text>
                  </>
                )}
              </Pressable>
            </View>

            {(typeLabel || exercise.muscle_group) ? (
              <View style={styles.pillRow}>
                {typeLabel ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{typeLabel}</Text>
                  </View>
                ) : null}
                {exercise.muscle_group ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{exercise.muscle_group}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <InfoRow
              icon={<Ionicons name="business-outline" size={22} color={theme.accent} />}
              text={gymName}
              placeholder="Зал"
              accent={Boolean(gymName)}
              onPress={() => {
                const qs = new URLSearchParams({
                  pickForCatalogExercise: String(catalogId),
                });
                const initialGymId = exercise?.user_gym_id ?? exercise?.user_gym?.id ?? null;
                if (initialGymId != null) {
                  qs.set("initialGymId", String(initialGymId));
                }
                invalidateInFlightLoads();
                router.push(`/gyms?${qs.toString()}`);
              }}
              accessibilityHint="Нажмите, чтобы изменить"
            />

            <InfoRow
              icon={<Ionicons name="location-outline" size={22} color={theme.accent} />}
              text={machineLocationText}
              placeholder="Где стоит в зале"
              accent={Boolean(machineLocationText)}
              onPress={() => setMachineLocationOpen(true)}
              accessibilityHint="Нажмите, чтобы изменить"
            />

            <InfoRow
              icon={<MaterialCommunityIcons name="tune-variant" size={22} color={theme.text} />}
              text={machineSettingsText}
              placeholder="Настройки тренажёра"
              multiline
              onPress={() => setMachineSettingsOpen(true)}
              accessibilityHint="Нажмите, чтобы изменить"
            />

            <InfoRow
              icon={<Ionicons name="time-outline" size={22} color={theme.textMuted} />}
              text={formatCreatedAt(exercise.created_at)}
              placeholder="Дата добавления"
              muted
            />
          </View>

          <Pressable
            style={pressableStyle(styles.notesCard, { pressed: { opacity: 0.88 } })}
            onPress={() => setNotesOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={notesText ? "Изменить заметку" : "Добавить заметку"}
            accessibilityHint="Нажмите, чтобы изменить"
          >
            <View style={styles.notesTitleRow}>
              <Text style={styles.notesTitle}>Заметка</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </View>
            <Text
              style={[styles.notesBody, !notesText && styles.notesBodyPlaceholder]}
              {...textBreakProps}
            >
              {notesText || "Добавить заметку"}
            </Text>
          </Pressable>

          {hasJournalStats ? (
            <View style={[styles.summaryBlock, Platform.OS === "web" && styles.summaryBlockWeb]}>
              <Text style={styles.summaryTitle}>По журналу</Text>
              <SnapHorizontalScroll
                itemWidth={summaryCardWidth}
                gap={METRIC_SNAP_GAP}
                clipItemOverflow={false}
                bleedGutterLeft={Platform.OS === "web" ? horizontalPadding + insets.left : undefined}
                bleedGutterRight={Platform.OS === "web" ? horizontalPadding + insets.right : undefined}
                contentPaddingVertical={8}
                contentPaddingHorizontal={4}
                contentContainerStyle={styles.summaryCardsRow}
              >
                <SummaryMetricCard
                  figmaKind="sets"
                  label="Подходов"
                  value={String(stats?.total_sets ?? 0)}
                  variant="violet"
                />
                <SummaryMetricCard
                  figmaKind="maxWeight"
                  label="Макс. вес"
                  value={
                    stats?.best_weight_kg != null && stats.best_weight_kg > 0
                      ? `${Math.round(stats.best_weight_kg)} кг`
                      : "—"
                  }
                  variant="blue"
                />
                <SummaryMetricCard
                  figmaKind="duration"
                  label="Повторы"
                  value={formatRepsRange(stats)}
                  variant="teal"
                />
                {stats?.planned_sets_hint != null && stats.planned_sets_hint > 0 ? (
                  <SummaryMetricCard
                    materialIcon="target"
                    label="План подх."
                    value={String(stats.planned_sets_hint)}
                    variant="amber"
                  />
                ) : null}
              </SnapHorizontalScroll>
              <Pressable
                style={pressableStyle(styles.historyButton, { pressed: { opacity: 0.88 } })}
                onPress={() => router.push(`/exercise-in-catalog/${catalogId}/sets-history`)}
                accessibilityRole="button"
                accessibilityLabel="Открыть график подходов по дням"
              >
                <View style={styles.historyButtonIcon}>
                  <MaterialCommunityIcons
                    name="chart-bar"
                    size={20}
                    color={metricToken("violet", theme.dark).fg}
                  />
                </View>
                <View style={styles.historyButtonTextBlock}>
                  <Text style={styles.historyButtonTitle}>График подходов по дням</Text>
                  <Text style={styles.historyButtonSub}>Динамика рабочих подходов из тренировок</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        <CatalogExerciseFormModal
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          mode="edit"
          exercise={exercise}
          muscleSelectOptions={muscleOpts}
        />

        <WorkoutDeleteConfirmModal
          visible={deletePhotoConfirmOpen}
          title="Удалить фото?"
          message="Изображение будет убрано из упражнения."
          onCancel={() => setDeletePhotoConfirmOpen(false)}
          onConfirm={() => void runDeletePhoto()}
        />

        <TextFieldModal
          visible={machineLocationOpen}
          title="Где стоит в зале"
          initial={machineLocationText}
          placeholder="Например: зал A, ряд 2, тренажёр 5"
          onClose={() => setMachineLocationOpen(false)}
          onSave={saveMachineLocation}
        />

        <TextFieldModal
          visible={machineSettingsOpen}
          title="Настройки тренажёра"
          initial={machineSettingsText}
          placeholder={"seat_height: 3\nknee_pad: 5\ngrip: wide"}
          multiline
          onClose={() => setMachineSettingsOpen(false)}
          onSave={saveMachineSettings}
        />

        <TextFieldModal
          visible={notesOpen}
          title="Заметка"
          initial={notesText}
          placeholder="Текст заметки"
          multiline
          onClose={() => setNotesOpen(false)}
          onSave={saveNotes}
        />

        <TextFieldModal
          visible={nameOpen}
          title="Название упражнения"
          initial={exerciseName}
          placeholder="Например: Жим лёжа"
          onClose={() => setNameOpen(false)}
          onSave={saveName}
        />
      </ScreenEnterFrame>
    </SafeAreaView>
  );
}

const SCREEN_HEADER_TITLE = "Упражнение в каталоге";

function DetailHeader({
  onBack,
  onEdit,
}: {
  onBack: () => void;
  onEdit: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <ScreenTitleRowIconButton onPress={onBack} accessibilityLabel="Назад" hitSlop={12}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={metricToken("violet", theme.dark).fg}
        />
      </ScreenTitleRowIconButton>

      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerTitle} numberOfLines={1} {...textBreakProps}>
          {SCREEN_HEADER_TITLE}
        </Text>
      </View>

      <ScreenTitleRowIconButton onPress={onEdit} accessibilityLabel="Редактировать">
        <MaterialCommunityIcons
          name="pencil-outline"
          size={22}
          color={metricToken("violet", theme.dark).fg}
        />
      </ScreenTitleRowIconButton>
    </View>
  );
}

function InfoRow({
  icon,
  text,
  placeholder,
  accent = false,
  muted = false,
  multiline = false,
  onPress,
  accessibilityHint,
}: {
  icon: React.ReactNode;
  text: string;
  placeholder?: string;
  accent?: boolean;
  muted?: boolean;
  multiline?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const trimmed = String(text ?? "").trim();
  const isEmpty = !trimmed;
  const display = isEmpty && placeholder ? placeholder : String(text ?? "");
  const showAsPlaceholder = isEmpty && !!placeholder;

  const rowStyle = [styles.infoRow, multiline && styles.infoRowMultiline, onPress && styles.infoRowPressable];
  const label = placeholder ?? "Поле";

  const content = (
    <>
      <View style={styles.infoIcon}>{icon}</View>
      <Text
        {...textBreakProps}
        style={[
          styles.infoText,
          accent && !showAsPlaceholder && styles.infoTextAccent,
          (muted || showAsPlaceholder) && styles.infoTextMuted,
          showAsPlaceholder && styles.infoTextPlaceholder,
          multiline && styles.infoTextMultiline,
        ]}
      >
        {display}
      </Text>
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={styles.infoRowChevron} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={pressableStyle(rowStyle, { pressed: { opacity: 0.88 } })}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={isEmpty ? `Добавить: ${label}` : `Изменить: ${label}`}
        accessibilityHint={accessibilityHint}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

function SummaryMetricCard({
  figmaKind,
  materialIcon,
  label,
  value,
  variant,
}: {
  figmaKind?: WorkoutMetricIconKind;
  materialIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
  variant: MetricVariant;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chipSize = useMetricChipSize();

  return (
    <View style={styles.summaryCardShell}>
      <View style={styles.summaryCard}>
        <MetricIconCircle
          figmaKind={figmaKind}
          materialIcon={materialIcon}
          variant={variant}
          size={chipSize}
          marginRight={7}
        />
        <View style={styles.summaryTextBlock}>
          <Text style={styles.summaryLabel} {...textBreakProps}>
            {label}
          </Text>
          <Text style={styles.summaryValue} {...textBreakProps}>
            {value}
          </Text>
        </View>
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
    content: {
      paddingTop: 12,
    },
    stateWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      gap: 10,
    },
    stateTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontFamily: fonts.extraBold,
      color: theme.text,
      textAlign: "center",
    },
    stateText: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: theme.textMuted,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 4,
      minHeight: 42,
      borderRadius: 10,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accent,
    },
    retryButtonText: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: fonts.bold,
      color: theme.white,
    },
    header: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: DETAIL_HEADER_BOTTOM_MARGIN,
      gap: 6,
    },
    headerTitleBlock: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 8,
    },
    headerTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontFamily: fonts.extraBold,
      color: theme.text,
      letterSpacing: -0.55,
    },
    heroInlineImageOuter: {
      position: "relative",
      marginTop: 4,
    },
    heroInlineImageClip: {
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.cardSoft,
    },
    heroInlineImagePressable: {
      width: "100%",
    },
    heroInlineImage: {
      width: "100%",
      height: 168,
    },
    heroImageDel: {
      position: "absolute",
      top: 8,
      right: 8,
      zIndex: 10,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#24213A",
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 10,
    },
    heroInlineIconWrap: {
      alignItems: "center",
      marginTop: 4,
    },
    heroInlineIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.cardSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    photoAddRow: {
      flexDirection: "row",
      marginTop: 10,
      marginBottom: 12,
    },
    photoAdd: {
      width: 72,
      height: 72,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    photoAddTxt: {
      fontSize: 10,
      color: theme.accent,
      fontFamily: fonts.semiBold,
      marginTop: 2,
    },
    summaryBlock: {
      marginTop: 4,
      marginBottom: 8,
    },
    summaryBlockWeb: {
      overflow: "visible",
      zIndex: 1,
    },
    contentWebOverflowVisible: {
      overflow: "visible",
    },
    summaryTitle: {
      ...type.sectionAccent,
      fontSize: 18,
      lineHeight: 24,
      color: theme.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    summaryCardsRow: {
      flexDirection: "row",
    },
    historyButton: {
      marginTop: 10,
      minHeight: 64,
      borderRadius: PLAQUE_RADIUS,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      shadowColor: "#24213A",
      shadowOpacity: 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    historyButtonIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accentSoft,
    },
    historyButtonTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    historyButtonTitle: {
      fontFamily: fonts.bold,
      fontSize: 14,
      lineHeight: 20,
      color: theme.text,
    },
    historyButtonSub: {
      marginTop: 2,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 16,
      color: theme.textMuted,
    },
    summaryCardShell: {
      flexGrow: 0,
      flexShrink: 0,
    },
    summaryCard: {
      minHeight: 72,
      borderRadius: PLAQUE_RADIUS,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#24213A",
      shadowOpacity: 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    summaryTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    summaryLabel: {
      ...type.statTileLabel,
      color: theme.textMuted,
    },
    summaryValue: {
      ...type.statTileValue,
      color: theme.text,
      marginTop: 2,
    },
    infoCard: {
      borderRadius: PLAQUE_RADIUS,
      backgroundColor: theme.card,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 10,
      marginBottom: 14,
      shadowColor: "#24213A",
      shadowOpacity: 0.05,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    infoTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
      marginHorizontal: -4,
      paddingHorizontal: 4,
      borderRadius: 8,
    },
    infoCardTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 18,
      lineHeight: 24,
      color: theme.text,
      letterSpacing: -0.4,
    },
    infoCardTitleFlex: {
      flex: 1,
      minWidth: 0,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 10,
    },
    pill: {
      alignSelf: "flex-start",
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    pillText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: theme.accent,
    },
    infoRow: {
      minHeight: 30,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    infoRowMultiline: {
      alignItems: "flex-start",
      paddingTop: 2,
    },
    infoRowPressable: {
      marginHorizontal: -4,
      paddingHorizontal: 4,
      borderRadius: 8,
    },
    infoRowChevron: {
      marginLeft: 4,
      flexShrink: 0,
    },
    infoIcon: {
      width: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    infoText: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: fonts.semiBold,
      color: theme.text,
    },
    infoTextMultiline: {
      lineHeight: 20,
    },
    infoTextAccent: {
      color: theme.accent,
    },
    infoTextMuted: {
      color: theme.textMuted,
      fontFamily: fonts.regular,
    },
    infoTextPlaceholder: {
      fontFamily: fonts.regular,
    },
    notesCard: {
      borderRadius: PLAQUE_RADIUS,
      backgroundColor: theme.card,
      paddingHorizontal: 18,
      paddingVertical: 16,
      marginBottom: 14,
      shadowColor: "#24213A",
      shadowOpacity: 0.05,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    notesTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    notesTitle: {
      fontFamily: fonts.bold,
      fontSize: 16,
      lineHeight: 22,
      color: theme.text,
    },
    notesBody: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: theme.text,
    },
    notesBodyPlaceholder: {
      color: theme.textMuted,
    },
  });
