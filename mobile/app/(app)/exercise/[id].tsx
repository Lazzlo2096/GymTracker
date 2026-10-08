import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FloatingAddButton, { FAB_LIST_PADDING_BOTTOM } from "@/components/ui/FloatingAddButton";
import SegmentedTabs, { type SegmentedTabItem } from "@/components/ui/SegmentedTabs";
import DisplaySettingsModal from "@/components/modals/DisplaySettingsModal";
import WorkoutActionsSheet, {
  EXERCISE_DETAIL_ACTIONS,
  EXERCISE_STOP_ACTION,
} from "@/components/modals/WorkoutActionsSheet";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import PasteExerciseSetsJsonModal from "@/components/modals/PasteExerciseSetsJsonModal";
import TabSets from "@/components/exercise/TabSets";
import TabTimer, { type ExerciseTimerPhase } from "@/components/exercise/TabTimer";
import ExerciseHeaderSubtitle from "@/components/exercise/ExerciseHeaderSubtitle";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import { useGoBackWithScreenEnter } from "@/components/navigation/ScreenEnterFrame";
import { metricToken } from "@/components/workouts/metricIcon";
import { apiFetch, parseErrorDetail } from "@/api/client";
import type { GuardedFocusLoadResult } from "@/hooks/useGuardedFocusLoad";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useTraceScreen } from "@/debug/useTraceScreen";
import {
  catalogIdFromExerciseRow,
  buildReplaceExerciseCatalogHref,
  exerciseLogFromRow,
  fetchExerciseInWorkout,
  plannedSetsFromExerciseRow,
  plannedSetsJsonFromExerciseRow,
  type PreloadedExerciseSnapshot,
  workoutIdFromExerciseRow,
} from "@/api/exerciseInWorkout";
import { useCatalogUi } from "@/theme/catalogUi";
import { on } from "@/utils/eventBus";
import { markWorkoutsListStale } from "@/events/workoutsListEvents";
import { EXERCISE_UPDATED_EVENT, parseExerciseUpdatedPayload } from "@/utils/exerciseUpdatedEvent";
import { formatMachineSettings } from "@/utils/machineSettingsText";
import {
  loadExerciseEditCompletedSetOnFinish,
  loadExerciseShowSetTextFields,
  loadExerciseShowTimerView1,
  loadExerciseTimerFillViewport,
  saveExerciseEditCompletedSetOnFinish,
  saveExerciseShowTimerView1,
  saveExerciseTimerFillViewport,
} from "@/utils/uiPreferences";
import {
  SCREEN_HEADER_TOP_PADDING,
} from "@/theme/screenChrome";
import {
  createEmptyNextSetDraft,
  type NextSetDraft,
} from "@/domain/nextSetDraft";
import { type } from "@/theme/typography";

const HEADER_ICON_ROW_HEIGHT = 42;

type ExerciseTabId = "timer" | "sets";

type MetaLoadState = "loading" | "ready" | "error";

const EXERCISE_SCREEN_TABS: readonly SegmentedTabItem<ExerciseTabId>[] = [
  { id: "timer", label: "Таймер", icon: "timer", nativeId: "exercise-screen-tab-timer" },
  { id: "sets", label: "Подходы", icon: "format-list-bulleted", nativeId: "exercise-screen-tab-sets" },
];

type ExerciseMetaLoad = {
  workoutIdForBack: number | null;
  preloadedExercise: PreloadedExerciseSnapshot;
  exerciseTitle: string;
  catalogExerciseId: number | null;
  muscleGroup: string | null;
  exerciseNotes: string | null;
  machineSettingsText: string | null;
};

export default function ExerciseScreen() {
  useTraceScreen("exercise/[id]");
  const catalogUi = useCatalogUi();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 400 ? 20 : 16;
  const styles = useMemo(
    () => createStyles(catalogUi, horizontalPadding),
    [catalogUi, horizontalPadding],
  );
  const router = useRouter();
  const { id, addSet } = useLocalSearchParams<{ id: string; addSet?: string }>();
  const exerciseId = Number(id);
  const [workoutIdForBack, setWorkoutIdForBack] = useState<number | null>(null);
  const goBack = useGoBackWithScreenEnter(
    workoutIdForBack != null ? `/workout/${workoutIdForBack}` : "/workouts",
  );
  const [tab, setTab] = useState<"timer" | "sets">("timer");
  const [autoOpenSetCreate, setAutoOpenSetCreate] = useState(false);
  const addSetConsumedRef = useRef(false);
  const [exerciseTitle, setExerciseTitle] = useState("Упражнение");
  const [metaLoadState, setMetaLoadState] = useState<MetaLoadState>("loading");
  const [preloadedExercise, setPreloadedExercise] = useState<PreloadedExerciseSnapshot | null>(null);
  const [muscleGroup, setMuscleGroup] = useState<string | null>(null);
  const [exerciseNotes, setExerciseNotes] = useState<string | null>(null);
  const [machineSettingsText, setMachineSettingsText] = useState<string | null>(null);
  const [catalogExerciseId, setCatalogExerciseId] = useState<number | null>(null);
  const stopExerciseRef = useRef<() => void>(() => {});
  const addSetRef = useRef<(() => void) | null>(null);
  const [nextSetDraft, setNextSetDraft] = useState<NextSetDraft>(createEmptyNextSetDraft);
  const [timerPhase, setTimerPhase] = useState<ExerciseTimerPhase>("idle");
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);
  const [exerciseMenuVisible, setExerciseMenuVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [pasteSetsJsonVisible, setPasteSetsJsonVisible] = useState(false);
  const [pasteSetsJsonTarget, setPasteSetsJsonTarget] = useState<{
    exerciseId: number;
    initialText: string;
  } | null>(null);
  const [showSetTextFields, setShowSetTextFields] = useState(true);
  const [showTimerView1, setShowTimerView1] = useState(false);
  const [timerFillViewport, setTimerFillViewport] = useState(false);
  const [editCompletedSetOnFinish, setEditCompletedSetOnFinish] = useState(true);

  useEffect(() => {
    void loadExerciseShowSetTextFields().then(setShowSetTextFields);
    void loadExerciseShowTimerView1().then(setShowTimerView1);
    void loadExerciseTimerFillViewport().then(setTimerFillViewport);
    void loadExerciseEditCompletedSetOnFinish().then(setEditCompletedSetOnFinish);
  }, []);

  const handleEditCompletedSetOnFinishChange = useCallback((next: boolean) => {
    setEditCompletedSetOnFinish(next);
    void saveExerciseEditCompletedSetOnFinish(next);
  }, []);

  const handleTimerPhaseChange = useCallback((phase: ExerciseTimerPhase) => {
    setTimerPhase(phase);
  }, []);

  const registerAddSet = useCallback((handler: () => void) => {
    addSetRef.current = handler;
  }, []);

  const registerStopExercise = useCallback((fn: () => void) => {
    stopExerciseRef.current = fn;
  }, []);

  const exerciseMenuActions = useMemo(
    () =>
      timerPhase === "idle"
        ? EXERCISE_DETAIL_ACTIONS
        : [EXERCISE_STOP_ACTION, ...EXERCISE_DETAIL_ACTIONS],
    [timerPhase],
  );

  const handleExerciseMenuAction = useCallback(
    (action: string) => {
      setExerciseMenuVisible(false);
      switch (action) {
        case "add_set":
          setTab("sets");
          setAutoOpenSetCreate(true);
          addSetRef.current?.();
          break;
        case "edit_exercise":
          router.push(
            buildReplaceExerciseCatalogHref(exerciseId, {
              seedCatalogId: catalogExerciseId,
            }),
          );
          break;
        case "paste_sets_json":
          setPasteSetsJsonTarget({
            exerciseId,
            initialText: JSON.stringify(preloadedExercise?.log ?? [], null, 2),
          });
          setPasteSetsJsonVisible(true);
          break;
        case "delete_exercise":
          setTimeout(() => setDeleteConfirmVisible(true), 300);
          break;
        case "stop_exercise":
          void stopExerciseRef.current();
          break;
        default:
          break;
      }
    },
    [catalogExerciseId, exerciseId, preloadedExercise?.log, router],
  );

  const handleDeleteExercise = useCallback(() => {
    setDeleteConfirmVisible(false);
    void (async () => {
      try {
        const response = await apiFetch(`/api/v1/exercises_in_workout/${exerciseId}`, {
          method: "DELETE",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(parseErrorDetail(payload));
        markWorkoutsListStale();
        goBack();
      } catch (e) {
        Alert.alert(
          "Не удалось удалить",
          e instanceof Error ? e.message : "Попробуйте ещё раз.",
        );
      }
    })();
  }, [exerciseId, goBack]);

  const fetchExerciseMeta = useCallback(async (): Promise<
    GuardedFocusLoadResult<ExerciseMetaLoad>
  > => {
    const ex = await fetchExerciseInWorkout(exerciseId);
    const preloadedExercise: PreloadedExerciseSnapshot = {
      log: exerciseLogFromRow(ex),
      plannedSets: plannedSetsFromExerciseRow(ex),
      plannedSetsJson: plannedSetsJsonFromExerciseRow(ex),
      row: ex,
    };

    let nextTitle = "Упражнение";
    const note = ex.note;
    if (typeof note === "string" && note.trim()) {
      nextTitle = note.trim();
    }

    const cid = catalogIdFromExerciseRow(ex);
    if (cid == null) {
      return {
        kind: "success",
        data: {
          workoutIdForBack: workoutIdFromExerciseRow(ex),
          preloadedExercise,
          exerciseTitle: nextTitle,
          catalogExerciseId: null,
          muscleGroup: null,
          exerciseNotes: null,
          machineSettingsText: null,
        },
      };
    }

    const r2 = await apiFetch(`/api/v1/exercises_in_catalog/${cid}`);
    if (!r2.ok) {
      return {
        kind: "success",
        data: {
          workoutIdForBack: workoutIdFromExerciseRow(ex),
          preloadedExercise,
          exerciseTitle: nextTitle,
          catalogExerciseId: cid,
          muscleGroup: null,
          exerciseNotes: null,
          machineSettingsText: null,
        },
      };
    }

    const c = (await r2.json()) as {
      name?: unknown;
      muscle_group?: unknown;
      notes?: unknown;
      machine_settings?: Record<string, unknown> | string | null;
    };
    if (c && typeof c.name === "string" && c.name.trim()) {
      nextTitle = c.name.trim();
    }
    const mg = c.muscle_group;
    const notes = c.notes;
    const formattedSettings = formatMachineSettings(c.machine_settings ?? null);

    return {
      kind: "success",
      data: {
        workoutIdForBack: workoutIdFromExerciseRow(ex),
        preloadedExercise,
        exerciseTitle: nextTitle,
        catalogExerciseId: cid,
        muscleGroup: typeof mg === "string" && mg.trim() ? mg.trim() : null,
        exerciseNotes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        machineSettingsText: formattedSettings.trim() ? formattedSettings : null,
      },
    };
  }, [exerciseId]);

  const applyExerciseMeta = useCallback((meta: ExerciseMetaLoad) => {
    setWorkoutIdForBack(meta.workoutIdForBack);
    setPreloadedExercise(meta.preloadedExercise);
    setExerciseTitle(meta.exerciseTitle);
    setCatalogExerciseId(meta.catalogExerciseId);
    setMuscleGroup(meta.muscleGroup);
    setExerciseNotes(meta.exerciseNotes);
    setMachineSettingsText(meta.machineSettingsText);
    setMetaLoadState("ready");
  }, []);

  const { reload: reloadMeta } = useGuardedFocusLoad({
    enabled: Number.isFinite(exerciseId) && exerciseId > 0,
    load: fetchExerciseMeta,
    onSuccess: applyExerciseMeta,
    onError: (_message, { silent }) => {
      if (!silent) {
        setMetaLoadState("error");
      }
    },
    onDisabled: () => {
      setMetaLoadState("error");
    },
  });

  useEffect(() => {
    return on("catalog:updated", () => {
      void reloadMeta({ silent: true });
    });
  }, [reloadMeta]);

  const isFirstExerciseMountRef = useRef(true);

  useEffect(() => {
    addSetConsumedRef.current = false;
    setNextSetDraft(createEmptyNextSetDraft());
    setTimerPhase("idle");
    setMetaLoadState("loading");
    setPreloadedExercise(null);
    if (!Number.isFinite(exerciseId) || exerciseId <= 0) return;
    if (isFirstExerciseMountRef.current) {
      isFirstExerciseMountRef.current = false;
      return;
    }
    void reloadMeta({ force: true });
  }, [exerciseId, reloadMeta]);

  useEffect(() => {
    return on(EXERCISE_UPDATED_EVENT, (payload) => {
      const update = parseExerciseUpdatedPayload(payload);
      if (!update || update.exerciseId !== exerciseId) return;
      if (
        !Array.isArray(update.log) &&
        update.plannedSets === undefined &&
        !Array.isArray(update.plannedSetsJson)
      ) {
        return;
      }
      setPreloadedExercise((prev) => {
        if (!prev) return prev;
        return {
          log: Array.isArray(update.log) ? update.log : prev.log,
          plannedSets: update.plannedSets !== undefined ? update.plannedSets : prev.plannedSets,
          plannedSetsJson: Array.isArray(update.plannedSetsJson)
            ? [...update.plannedSetsJson]
            : prev.plannedSetsJson,
          row: prev.row,
        };
      });
    });
  }, [exerciseId]);

  useEffect(() => {
    if (String(addSet) !== "1" || addSetConsumedRef.current) return;
    addSetConsumedRef.current = true;
    setTab("sets");
    setAutoOpenSetCreate(true);
    try {
      router.setParams({ addSet: undefined });
    } catch {
      /* ignore */
    }
  }, [addSet, router]);

  if (!Number.isFinite(exerciseId)) {
    return (
      <View style={styles.center}>
        <Text>Некорректный id</Text>
      </View>
    );
  }

  if (metaLoadState === "loading") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, styles.center]}>
          <ActivityIndicator size="large" color={catalogUi.accent} />
        </View>
      </>
    );
  }

  if (metaLoadState === "error") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, styles.center]}>
          <Text style={styles.errorText}>Не удалось загрузить упражнение</Text>
          <Pressable
            onPress={() => {
              void reloadMeta({ force: true });
            }}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Повторить загрузку"
          >
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const violetFg = metricToken("violet", catalogUi.dark).fg;

  const openCatalogExercise = catalogExerciseId
    ? () => router.push(`/exercise-in-catalog/${catalogExerciseId}`)
    : undefined;

  const scrollBottomPadding =
    tab === "sets" ? FAB_LIST_PADDING_BOTTOM + insets.bottom : 24 + insets.bottom;
  const timerCompactFit = tab === "timer" && !showTimerView1 && timerFillViewport;

  const screenBody = (
    <>
      <View style={styles.header}>
        <ScreenTitleRowIconButton
          hitSlop={12}
          onPress={() => goBack()}
          accessibilityLabel="Назад"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={violetFg} />
        </ScreenTitleRowIconButton>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitleMain} accessibilityRole="header">
            Таймер
          </Text>
        </View>

        <View style={styles.headerActions}>
          <ScreenTitleRowIconButton
            nativeID="exercise-screen-display-settings-button"
            testID="exercise-screen-display-settings-button"
            onPress={() => setDisplaySettingsOpen(true)}
            accessibilityLabel="Настройки отображения"
            style={{ marginLeft: 8 }}
          >
            <MaterialCommunityIcons name="cog" size={22} color={violetFg} />
          </ScreenTitleRowIconButton>

          <ScreenTitleRowIconButton
            onPress={() => setExerciseMenuVisible(true)}
            accessibilityLabel="Меню упражнения"
            style={{ marginLeft: 8 }}
          >
            <MaterialCommunityIcons name="dots-vertical" size={24} color={violetFg} />
          </ScreenTitleRowIconButton>
        </View>
      </View>

      <ExerciseHeaderSubtitle
        name={exerciseTitle}
        muscleGroup={muscleGroup}
        notes={exerciseNotes}
        machineSettings={machineSettingsText}
        onPress={openCatalogExercise}
        accessibilityLabel={
          catalogExerciseId ? "Открыть упражнение в каталоге" : undefined
        }
      />

      <SegmentedTabs
        tabs={EXERCISE_SCREEN_TABS}
        value={tab}
        onChange={setTab}
        trackNativeId="exercise-screen-tabs"
        indicatorNativeId="exercise-screen-tab-indicator"
        labelSize="md"
      />

      <View
        style={
          tab !== "timer"
            ? styles.tabPaneCollapsed
            : timerCompactFit
              ? styles.tabPaneFill
              : undefined
        }
      >
        <TabTimer
          key={exerciseId}
          exerciseId={exerciseId}
          isActive={tab === "timer"}
          preloadedLog={preloadedExercise?.log}
          preloadedPlannedSets={preloadedExercise?.plannedSets ?? null}
          preloadedPlannedSetsJson={preloadedExercise?.plannedSetsJson ?? null}
          preloadedExerciseRow={preloadedExercise?.row ?? null}
          registerStopExercise={registerStopExercise}
          contentInsetHorizontal={0}
          onTimerPhaseChange={handleTimerPhaseChange}
          nextSetDraft={nextSetDraft}
          onNextSetDraftChange={setNextSetDraft}
          showSetTextFields={showSetTextFields}
          showView1OnTimer={showTimerView1}
          fillViewport={timerCompactFit}
          editCompletedSetOnFinish={editCompletedSetOnFinish}
          onDisableCompletedSetAutoEdit={() => handleEditCompletedSetOnFinishChange(false)}
        />
      </View>
      {tab === "sets" ? (
        <TabSets
          key={exerciseId}
          exerciseId={exerciseId}
          isActive
          preloadedLog={preloadedExercise?.log}
          preloadedPlannedSets={preloadedExercise?.plannedSets ?? null}
          preloadedPlannedSetsJson={preloadedExercise?.plannedSetsJson ?? null}
          onGoToTimer={() => setTab("timer")}
          autoOpenCreate={autoOpenSetCreate}
          onAutoOpenCreateConsumed={() => setAutoOpenSetCreate(false)}
          onRegisterAddSet={registerAddSet}
          contentInsetHorizontal={0}
          nextSetDraft={nextSetDraft}
          timerPhase={timerPhase}
          showSetTextFields={showSetTextFields}
        />
      ) : null}
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        {timerCompactFit ? (
          <View style={styles.scrollFill}>
            <View
              style={[
                styles.screen,
                styles.screenFill,
                { paddingBottom: Math.max(insets.bottom, 8) },
              ]}
            >
              {screenBody}
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.screen}>{screenBody}</View>
          </ScrollView>
        )}
        {tab === "sets" ? (
          <FloatingAddButton
            accessibilityLabel="Добавить запись"
            onPress={() => addSetRef.current?.()}
          />
        ) : null}
      </View>

      <DisplaySettingsModal
        visible={displaySettingsOpen}
        onClose={() => setDisplaySettingsOpen(false)}
        items={[
          {
            id: "timer_view1",
            label: "Список подходов на таймере",
            description:
              "Показывать журнал подходов, отдыхов и комментариев над таймером",
            value: showTimerView1,
            onValueChange: (next) => {
              setShowTimerView1(next);
              void saveExerciseShowTimerView1(next);
            },
          },
          {
            id: "timer_fill_viewport",
            label: "Таймер на весь экран",
            description:
              "Если список подходов скрыт — умещать таймер на экран без прокрутки",
            value: timerFillViewport,
            onValueChange: (next) => {
              setTimerFillViewport(next);
              void saveExerciseTimerFillViewport(next);
            },
          },
          {
            id: "edit_completed_set_on_finish",
            label: "Редактировать только что сделаный подход",
            description:
              "После кнопки «Завершить подход» сразу открывать редактор сохранённого подхода",
            value: editCompletedSetOnFinish,
            onValueChange: handleEditCompletedSetOnFinishChange,
          },
        ]}
      />

      <WorkoutActionsSheet
        visible={exerciseMenuVisible}
        title="Действия с упражнением"
        subtitle={exerciseTitle}
        actions={exerciseMenuActions}
        onClose={() => setExerciseMenuVisible(false)}
        onSelect={handleExerciseMenuAction}
      />

      <WorkoutDeleteConfirmModal
        visible={deleteConfirmVisible}
        title="Удалить упражнение?"
        message={`Удалить «${exerciseTitle}» из тренировки? Подходы и записи таймера будут удалены. Восстановить данные будет нельзя.`}
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={handleDeleteExercise}
      />

      {pasteSetsJsonTarget ? (
        <PasteExerciseSetsJsonModal
          visible={pasteSetsJsonVisible}
          exerciseId={pasteSetsJsonTarget.exerciseId}
          initialText={pasteSetsJsonTarget.initialText}
          onClose={() => setPasteSetsJsonVisible(false)}
          onDismiss={() => setPasteSetsJsonTarget(null)}
          onApplied={() => void reloadMeta({ silent: true })}
        />
      ) : null}
    </>
  );
}

const createStyles = (
  catalogUi: ReturnType<typeof useCatalogUi>,
  horizontalPadding: number,
) =>
  StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    root: {
      flex: 1,
      backgroundColor: catalogUi.pageBg,
    },
    scroll: {
      flex: 1,
    },
    scrollFill: {
      flex: 1,
    },
    screen: {
      paddingHorizontal: horizontalPadding,
      paddingTop: SCREEN_HEADER_TOP_PADDING,
    },
    screenFill: {
      flex: 1,
      minHeight: 0,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      gap: 6,
    },
    headerTitleBlock: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 8,
      minHeight: HEADER_ICON_ROW_HEIGHT,
      justifyContent: "center",
    },
    headerTitleMain: {
      ...type.screenTitle,
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.8,
      color: catalogUi.text,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    tabPaneCollapsed: {
      height: 0,
      overflow: "hidden",
      opacity: 0,
      pointerEvents: "none",
    },
    tabPaneFill: {
      flex: 1,
      minHeight: 0,
    },
    errorText: {
      ...type.muted,
      color: catalogUi.textMuted,
      marginBottom: 12,
      textAlign: "center",
    },
    retryButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: catalogUi.accentSoft,
    },
    retryButtonText: {
      ...type.label,
      color: catalogUi.accent,
    },
  });
