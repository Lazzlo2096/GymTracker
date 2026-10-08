import React from "react";
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Animated,
  Easing,
  Platform,
  Share,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useTraceScreen } from "@/debug/useTraceScreen";
import { trace } from "@/debug/traceLog";
import ScreenEnterFrame, {
  useGoBackWithScreenEnter,
} from "@/components/navigation/ScreenEnterFrame";
import WorkoutActionsSheet, {
  WORKOUT_DETAIL_ACTIONS,
  EXERCISE_PASTE_SETS_JSON_ACTION,
  type ActionRow,
} from "@/components/modals/WorkoutActionsSheet";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import PasteExerciseSetsJsonModal from "@/components/modals/PasteExerciseSetsJsonModal";
import DatePickerPopover from "@/components/modals/DatePickerPopover";
import WorkoutFieldCenterDialog, {
  type WorkoutFieldCenterDialogField,
} from "@/components/modals/WorkoutFieldCenterDialog";
import FloatingAddButton from "@/components/ui/FloatingAddButton";
import ActiveStatusDot from "@/components/ui/ActiveStatusDot";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import SnapHorizontalScroll from "@/components/ui/SnapHorizontalScroll";
import { computeWorkoutDuration } from "@/utils/workoutDuration";
import {
  createWorkoutListItemStyles,
  workoutListItemStyles,
} from "@/components/workouts/workoutListItem.styles";
import {
  METRIC_SNAP_GAP,
  metricSnapItemWidth,
  workoutScreenHorizontalPadding,
} from "@/components/workouts/metricSnapLayout";
import {
  METRIC_ICON_SIZES,
  MetricIconCircle,
  metricToken,
  useMetricChipSize,
  type MetricVariant,
} from "@/components/workouts/metricIcon";
import { BarbellOutlineIcon, type WorkoutMetricIconKind } from "@/components/icons/WorkoutFigmaIcons";
import ExerciseView1Panel from "@/components/exercise/ExerciseView1Panel";
import {
  buildReplaceExerciseCatalogHref,
  catalogIdFromExerciseRow,
  exerciseLogFromRow,
  plannedSetsJsonFromExerciseRow,
} from "@/api/exerciseInWorkout";
import { fetchWorkoutDetailById } from "@/api/workoutDetail";
import {
  patchWorkoutDetailFromExerciseLog,
  patchWorkoutDetailFromExerciseUpdate,
  removeExerciseFromWorkoutDetail,
} from "@/domain/workout/patchWorkoutDetailFromExercise";
import type {
  ContextMenuTarget,
  TimelineEvent,
  WorkoutDetail,
  WorkoutExercise,
} from "@/domain/workout/types";
import {
  formatDateForApiPatch,
  formatFullDateFromCalendarDay,
  isSameCalendarDay,
  startOfDay,
} from "@/domain/workout/workoutDetailMapper";
import {
  emitWorkoutDetailUpdated,
  parseWorkoutDetailUpdatedPayload,
  WORKOUT_DETAIL_UPDATED_EVENT,
  workoutDetailIdsMatch,
} from "@/events/workoutDetailEvents";
import { markWorkoutsListStale } from "@/events/workoutsListEvents";
import { useFocusGatedReload } from "@/hooks/useFocusGatedReload";
import {
  EXERCISE_UPDATED_EVENT,
  exerciseLogFromSetApiResponse,
  parseExerciseUpdatedPayload,
} from "@/utils/exerciseUpdatedEvent";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { on } from "@/utils/eventBus";
import { runRepeatWorkoutFlow } from "@/utils/repeatWorkout";
import { useAppTheme } from "@/theme/appTheme";
import { plaqueListShadow, PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import { fonts, type } from "@/theme/typography";
import { SCREEN_HEADER_TOP_PADDING } from "@/theme/screenChrome";

const globalTextBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

function formatWorkoutDeleteConfirmMessage(workout: WorkoutDetail | null): string {
  if (!workout) return "";
  return workout.dayTitle?.trim()
    ? `«${workout.dayTitle}» будет удалена. Восстановить данные будет нельзя.`
    : "Запись будет удалена. Восстановить данные будет нельзя.";
}

export default function WorkoutDetailScreen() {
  useTraceScreen("workout/[id]");
  const theme = useAppTheme();
  styles = React.useMemo(() => createStyles(theme), [theme]);
  runtimeWorkoutListItemStyles = React.useMemo(
    () => createWorkoutListItemStyles(theme),
    [theme]
  );
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const router = useRouter();
  const goBack = useGoBackWithScreenEnter("/workouts");
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [workout, setWorkout] = React.useState<WorkoutDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [workoutMenuVisible, setWorkoutMenuVisible] = React.useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = React.useState(false);
  const [entityDeleteConfirmVisible, setEntityDeleteConfirmVisible] = React.useState(false);
  const [entityDeleteConfirm, setEntityDeleteConfirm] = React.useState<
    | { kind: "exercise"; exercise: WorkoutExercise }
    | { kind: "event"; exerciseId: string; eventIndex: number; label: string }
    | null
  >(null);
  const [datePickerVisible, setDatePickerVisible] = React.useState(false);
  const [patchingWorkoutDate, setPatchingWorkoutDate] = React.useState(false);
  const [metaEditor, setMetaEditor] = React.useState<{
    kind: WorkoutFieldCenterDialogField;
    draft: string;
  } | null>(null);
  /** Отдельно от metaEditor: false даёт Modal fade-out, metaEditor чистится в onDismiss без мигания заголовка. */
  const [fieldDialogVisible, setFieldDialogVisible] = React.useState(false);
  const [patchingMeta, setPatchingMeta] = React.useState(false);
  const [repeatingWorkout, setRepeatingWorkout] = React.useState(false);

  const infoCardEditsLocked = patchingMeta || patchingWorkoutDate;

  const openFieldEditor = React.useCallback((kind: WorkoutFieldCenterDialogField, draft: string) => {
    setMetaEditor({ kind, draft });
    setFieldDialogVisible(true);
  }, []);

  const closeFieldDialogWithFade = React.useCallback(() => {
    if (!patchingMeta) setFieldDialogVisible(false);
  }, [patchingMeta]);

  const onFieldDialogDismissed = React.useCallback(() => {
    setMetaEditor(null);
  }, []);

  /** Меню «⋯» упражнения/события: target не обнулять с visible=false — см. modalDismissContract.ts */
  const [contextMenuVisible, setContextMenuVisible] = React.useState(false);
  const [contextMenuTarget, setContextMenuTarget] = React.useState<ContextMenuTarget | null>(null);
  const [pasteSetsJsonVisible, setPasteSetsJsonVisible] = React.useState(false);
  const [pasteSetsJsonTarget, setPasteSetsJsonTarget] = React.useState<{
    exerciseId: number;
    initialText: string;
  } | null>(null);

  const horizontalPadding = width >= 400 ? 20 : 16;
  const catalogNameCacheRef = React.useRef(new Map<number, string>());

  const fetchWorkoutDetail = React.useCallback(
    () => fetchWorkoutDetailById(workoutId, catalogNameCacheRef.current),
    [workoutId],
  );

  const handleWorkoutLoaded = React.useCallback((data: WorkoutDetail) => {
    setWorkout(data);
    setError(null);
  }, []);

  const {
    loading,
    reload,
    invalidateInFlightLoads,
    applyLocalData,
  } = useGuardedFocusLoad({
    enabled: Number.isFinite(workoutId) && workoutId > 0,
    load: fetchWorkoutDetail,
    onSuccess: handleWorkoutLoaded,
    onError: (message, { silent }) => {
      if (silent) {
        Alert.alert("Не удалось обновить", message);
        return;
      }
      setWorkout(null);
      setError(message);
    },
    onDisabled: () => {
      setWorkout(null);
      setError("Некорректный id тренировки");
    },
  });

  const { refreshIfFocused } = useFocusGatedReload(reload);
  const workoutRef = React.useRef(workout);
  workoutRef.current = workout;

  React.useEffect(() => {
    const unsubDetail = on(WORKOUT_DETAIL_UPDATED_EVENT, (payload) => {
      const parsed = parseWorkoutDetailUpdatedPayload(payload);
      if (!parsed || !workoutDetailIdsMatch(workoutId, parsed.workoutId)) return;
      applyLocalData(parsed.detail);
    });
    const unsubExercise = on(EXERCISE_UPDATED_EVENT, (payload) => {
      const exercisePayload = parseExerciseUpdatedPayload(payload);
      const current = workoutRef.current;
      if (!exercisePayload || !current) return;
      const next = patchWorkoutDetailFromExerciseUpdate(
        current,
        exercisePayload,
        catalogNameCacheRef.current,
      );
      if (!next) return;
      trace("STATE", "workout detail isActive", {
        workoutId: next.id,
        workoutActive: next.isActive,
        exercises: next.exercises.map((e) => ({ id: e.id, isActive: e.isActive })),
      });
      applyLocalData(next);
      emitWorkoutDetailUpdated(next);
    });
    return () => {
      unsubDetail();
      unsubExercise();
    };
  }, [applyLocalData, workoutId]);

  const handleWorkoutMenuAction = React.useCallback(
    (action: string) => {
      switch (action) {
        case "delete":
          setDeleteConfirmVisible(true);
          break;
        case "share": {
          const w = workout;
          if (!w) break;
          const title = w.dayTitle?.trim() || "Тренировка";
          const lines = [title, w.workoutDateFullText, w.gymName, w.note].filter(Boolean);
          Share.share({ message: lines.join("\n") }).catch(() => {});
          break;
        }
        case "repeat":
          runRepeatWorkoutFlow({
            sourceWorkoutId: workoutId,
            router,
            isBusy: () => repeatingWorkout,
            setBusy: setRepeatingWorkout,
            onInvalidId: () =>
              Alert.alert("Ошибка", "Некорректный идентификатор тренировки."),
            onError: (message) => Alert.alert("Не удалось повторить тренировку", message),
          });
          break;
        case "duplicate_template":
        case "duplicate_session":
        case "compare":
        case "exercise_progress":
          Alert.alert("Скоро", "Действие будет доступно в следующих версиях.");
          break;
        default:
          break;
      }
    },
    [repeatingWorkout, router, workout, workoutId],
  );

  const openContextMenu = React.useCallback((target: ContextMenuTarget) => {
    setContextMenuTarget(target);
    setContextMenuVisible(true);
  }, []);

  const handleConfirmEntityDelete = React.useCallback(() => {
    const pending = entityDeleteConfirm;
    if (!pending) return;
    setEntityDeleteConfirmVisible(false);

    void (async () => {
      try {
        const currentWorkout = workoutRef.current;
        if (!currentWorkout) return;

        if (pending.kind === "exercise") {
          const eiwId = Number(pending.exercise.id);
          if (!Number.isFinite(eiwId)) {
            throw new Error("Некорректный идентификатор упражнения.");
          }
          const response = await apiFetch(`/api/v1/exercises_in_workout/${eiwId}`, {
            method: "DELETE",
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(parseErrorDetail(payload));
          const next = removeExerciseFromWorkoutDetail(currentWorkout, pending.exercise.id);
          if (next) {
            applyLocalData(next);
            emitWorkoutDetailUpdated(next);
          }
        } else {
          const eiwId = Number(pending.exerciseId);
          if (!Number.isFinite(eiwId) || eiwId <= 0) {
            throw new Error("Не удалось определить упражнение для этой записи.");
          }
          const response = await apiFetch(
            `/api/v1/exercises_in_workout/${eiwId}/set/${pending.eventIndex}`,
            { method: "DELETE" },
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(parseErrorDetail(payload));
          const log = exerciseLogFromSetApiResponse(payload);
          if (log) {
            const next = patchWorkoutDetailFromExerciseLog(
              currentWorkout,
              eiwId,
              log,
              catalogNameCacheRef.current,
            );
            if (next) {
              applyLocalData(next);
              emitWorkoutDetailUpdated(next);
            }
          } else {
            refreshIfFocused({ silent: true });
          }
        }
        markWorkoutsListStale();
      } catch (e) {
        Alert.alert(
          "Не удалось удалить",
          e instanceof Error ? e.message : "Попробуйте ещё раз.",
        );
      }
    })();
  }, [applyLocalData, entityDeleteConfirm, refreshIfFocused]);

  const handleContextMenuAction = React.useCallback(
    (action: string) => {
      const target = contextMenuTarget;
      setContextMenuVisible(false);
      if (!target) return;

      if (target.type === "exercise") {
        const { exercise } = target;
        switch (action) {
          case "open":
            router.push(`/exercise/${exercise.id}`);
            break;
          case "add_set":
            router.push(`/exercise/${exercise.id}?addSet=1`);
            break;
          case "edit_exercise":
            router.push(
              buildReplaceExerciseCatalogHref(Number(exercise.id), {
                seedCatalogId: catalogIdFromExerciseRow(exercise.apiEntry),
                returnTo: `/workout/${workoutId}`,
              }),
            );
            break;
          case "paste_sets_json": {
            const eiwId = Number(exercise.id);
            setTimeout(() => {
              setPasteSetsJsonTarget({
                exerciseId: eiwId,
                initialText: JSON.stringify(exerciseLogFromRow(exercise.apiEntry), null, 2),
              });
              setPasteSetsJsonVisible(true);
            }, 300);
            break;
          }
          case "delete_exercise":
            setTimeout(() => {
              setEntityDeleteConfirm({ kind: "exercise", exercise });
              setEntityDeleteConfirmVisible(true);
            }, 300);
            break;
          default:
            Alert.alert("Скоро", `Действие "${action}" для упражнения будет реализовано позже.`);
        }
      } else {
        const { event, eventIndex, exerciseId } = target;
        switch (action) {
          case "edit":
            Alert.alert("Редактировать событие", `${event.type} #${eventIndex + 1}`);
            break;
          case "delete": {
            const kindRu =
              event.type === "set"
                ? "подход"
                : event.type === "mark"
                  ? "маркер"
                  : event.type === "rest"
                    ? "отдых"
                    : event.type === "comment"
                      ? "комментарий"
                      : "запись";
            setTimeout(() => {
              setEntityDeleteConfirm({
                kind: "event",
                exerciseId,
                eventIndex,
                label: kindRu,
              });
              setEntityDeleteConfirmVisible(true);
            }, 300);
            break;
          }
          default:
            Alert.alert("Скоро", `Действие "${action}" для события ${event.type} будет реализовано позже.`);
        }
      }
    },
    [contextMenuTarget, router, workoutId],
  );

  const persistWorkoutDate = React.useCallback(
    async (next: Date | null, currentWorkout: WorkoutDetail) => {
      if (!next) return;
      const normalized = startOfDay(next);
      if (isSameCalendarDay(normalized, currentWorkout.workoutDateAt)) return;

      setPatchingWorkoutDate(true);
      try {
        const response = await apiFetch(`/api/v1/workouts/${workoutId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workout_date: formatDateForApiPatch(normalized) }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseErrorDetail(payload));
        }
        const fullText = formatFullDateFromCalendarDay(normalized);
        setWorkout((prev) =>
          prev ? { ...prev, workoutDateAt: normalized, workoutDateFullText: fullText } : null,
        );
        markWorkoutsListStale();
      } catch (e) {
        Alert.alert(
          "Не удалось сохранить дату",
          e instanceof Error ? e.message : "Попробуйте ещё раз.",
        );
      } finally {
        setPatchingWorkoutDate(false);
      }
    },
    [workoutId],
  );

  const saveMetaEditor = React.useCallback(async () => {
    if (!metaEditor || !workout) return;
    const { kind, draft } = metaEditor;
    const trimmed = draft.trim();
    let body: Record<string, string | null> = {};
    let unchanged = false;

    if (kind === "day_title") {
      const prev = workout.dayTitle.trim();
      if (trimmed === prev) unchanged = true;
      else body.day_title = trimmed || null;
    } else {
      const prev = (workout.note ?? "").trim();
      if (trimmed === prev) unchanged = true;
      else body.note = trimmed || null;
    }

    if (unchanged) {
      closeFieldDialogWithFade();
      return;
    }

    setPatchingMeta(true);
    try {
      const response = await apiFetch(`/api/v1/workouts/${workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseErrorDetail(payload));
      }

      if (kind === "day_title") {
        setWorkout((prev) => (prev ? { ...prev, dayTitle: trimmed } : null));
      } else {
        setWorkout((prev) => (prev ? { ...prev, note: trimmed || null } : null));
      }
      setFieldDialogVisible(false);
      markWorkoutsListStale();
    } catch (e) {
      Alert.alert(
        "Не удалось сохранить",
        e instanceof Error ? e.message : "Попробуйте ещё раз.",
      );
    } finally {
      setPatchingMeta(false);
    }
  }, [closeFieldDialogWithFade, metaEditor, workout, workoutId]);

  const handleDeleteWorkout = React.useCallback(() => {
    if (!Number.isFinite(workoutId)) return;
    void (async () => {
      try {
        const response = await apiFetch(`/api/v1/workouts/${workoutId}`, {
          method: "DELETE",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseErrorDetail(payload));
        }

        setDeleteConfirmVisible(false);
        markWorkoutsListStale();
        goBack();
      } catch (err) {
        Alert.alert(
          "Ошибка удаления",
          err instanceof Error ? err.message : "Не удалось удалить тренировку.",
        );
      }
    })();
  }, [goBack, workoutId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.stateText}>Загружаем тренировку...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !workout) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Не удалось открыть тренировку</Text>
          <Text style={styles.stateText}>{error ?? "Данные недоступны."}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              void reload({ force: true });
            }}
          >
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <ScreenEnterFrame>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: 96,
            },
            Platform.OS === "web" ? styles.contentWebOverflowVisible : null,
          ]}
        >
          <WorkoutHeader
            workout={workout}
            onBack={() => goBack()}
            onOpenMenu={() => setWorkoutMenuVisible(true)}
          />

          <WorkoutInfoCard
            workout={workout}
            editsLocked={infoCardEditsLocked}
            onPressDateRow={
              infoCardEditsLocked ? undefined : () => setDatePickerVisible(true)
            }
            onEditDayTitle={() => openFieldEditor("day_title", workout.dayTitle)}
            onEditGym={() => {
              const qs = new URLSearchParams({
                pickForWorkout: String(workoutId),
              });
              if (workout.userGymId != null) {
                qs.set("initialGymId", String(workout.userGymId));
              }
              invalidateInFlightLoads();
              router.push(`/gyms?${qs.toString()}`);
            }}
            onEditNote={() => openFieldEditor("note", workout.note ?? "")}
          />

          <ExercisesHeader />

          <ExercisesList
            exercises={workout.exercises}
            onPressExercise={(ex) => router.push(`/exercise/${ex.id}`)}
            onOpenExerciseMenu={(ex) =>
              openContextMenu({ type: "exercise", exerciseId: ex.id, exercise: ex })
            }
          />

          <WorkoutSummary workout={workout} />
        </ScrollView>

        <FloatingAddButton
          onPress={() => {
            invalidateInFlightLoads();
            router.push(`/exercise_catalog?pickForWorkout=${encodeURIComponent(String(workoutId))}`);
          }}
          accessibilityLabel="Добавить упражнение"
        />

        <WorkoutActionsSheet
          visible={workoutMenuVisible}
          title="Действия"
          subtitle={workout.dayTitle?.trim() || null}
          actions={WORKOUT_DETAIL_ACTIONS}
          onClose={() => setWorkoutMenuVisible(false)}
          onSelect={handleWorkoutMenuAction}
        />

        {/* Context menu for exercises and timeline events */}
        <WorkoutActionsSheet
          visible={contextMenuVisible}
          title={
            contextMenuTarget?.type === "exercise"
              ? "Действия с упражнением"
              : "Действия с событием"
          }
          subtitle={
            contextMenuTarget
              ? contextMenuTarget.type === "exercise"
                ? contextMenuTarget.exercise.title
                : `${contextMenuTarget.event.type} #${contextMenuTarget.eventIndex + 1}`
              : null
          }
          actions={
            contextMenuTarget?.type === "exercise"
              ? ([
                  { id: "open", label: "Открыть", icon: "open-outline" },
                  { id: "add_set", label: "Добавить подход", icon: "add-circle-outline" },
                  { id: "edit_exercise", label: "Редактировать упражнение", icon: "create-outline" },
                  EXERCISE_PASTE_SETS_JSON_ACTION,
                  { id: "delete_exercise", label: "Удалить упражнение", icon: "trash-outline", destructive: true },
                ] as ActionRow[])
              : ([
                  { id: "edit", label: "Редактировать", icon: "create-outline" },
                  { id: "delete", label: "Удалить", icon: "trash-outline", destructive: true },
                ] as ActionRow[])
          }
          onClose={() => setContextMenuVisible(false)}
          onDismiss={() => setContextMenuTarget(null)}
          onSelect={handleContextMenuAction}
        />

        <WorkoutDeleteConfirmModal
          visible={deleteConfirmVisible}
          title="Удалить тренировку?"
          message={formatWorkoutDeleteConfirmMessage(workout)}
          onCancel={() => setDeleteConfirmVisible(false)}
          onConfirm={handleDeleteWorkout}
        />

        <WorkoutDeleteConfirmModal
          visible={entityDeleteConfirmVisible}
          title={
            entityDeleteConfirm?.kind === "exercise"
              ? "Удалить упражнение?"
              : "Удалить запись?"
          }
          message={
            entityDeleteConfirm?.kind === "exercise"
              ? `Удалить «${entityDeleteConfirm.exercise.title}» из тренировки? Подходы и записи таймера будут удалены. Восстановить данные будет нельзя.`
              : entityDeleteConfirm?.kind === "event"
                ? `Удалить ${entityDeleteConfirm.label} из журнала упражнения? Восстановить данные будет нельзя.`
                : ""
          }
          onCancel={() => setEntityDeleteConfirmVisible(false)}
          onConfirm={handleConfirmEntityDelete}
          onDismiss={() => setEntityDeleteConfirm(null)}
        />

        {pasteSetsJsonTarget ? (
          <PasteExerciseSetsJsonModal
            visible={pasteSetsJsonVisible}
            exerciseId={pasteSetsJsonTarget.exerciseId}
            initialText={pasteSetsJsonTarget.initialText}
            onClose={() => setPasteSetsJsonVisible(false)}
            onDismiss={() => setPasteSetsJsonTarget(null)}
            onApplied={() => refreshIfFocused({ silent: true })}
          />
        ) : null}

        <DatePickerPopover
          visible={datePickerVisible}
          selectedDate={workout.workoutDateAt}
          screenWidth={width}
          screenHeight={height}
          topInset={insets.top}
          bottomInset={insets.bottom}
          onClose={() => setDatePickerVisible(false)}
          onSelectDate={(next) => {
            setDatePickerVisible(false);
            void persistWorkoutDate(next, workout);
          }}
        />

        {metaEditor ? (
          <WorkoutFieldCenterDialog
            visible={fieldDialogVisible}
            field={metaEditor.kind}
            draft={metaEditor.draft}
            onChangeDraft={(t) =>
              setMetaEditor((prev) => (prev ? { ...prev, draft: t } : null))
            }
            saving={patchingMeta}
            onCancel={closeFieldDialogWithFade}
            onSave={() => void saveMetaEditor()}
            onDismiss={onFieldDialogDismissed}
          />
        ) : null}
      </ScreenEnterFrame>
    </SafeAreaView>
  );
}

function WorkoutHeader({
  workout,
  onBack,
  onOpenMenu,
}: {
  workout: WorkoutDetail;
  onBack: () => void;
  onOpenMenu: () => void;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.header}>
      <ScreenTitleRowIconButton
        hitSlop={12}
        onPress={onBack}
        accessibilityLabel="Назад"
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={metricToken("violet", theme.dark).fg}
        />
      </ScreenTitleRowIconButton>

      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerTitle} {...globalTextBreakProps}>
          Тренировка
        </Text>
      </View>

      <ScreenTitleRowIconButton onPress={onOpenMenu} accessibilityLabel="Меню тренировки">
        <MaterialCommunityIcons
          name="dots-vertical"
          size={24}
          color={metricToken("violet", theme.dark).fg}
        />
      </ScreenTitleRowIconButton>
    </View>
  );
}

function WorkoutInfoCard({
  workout,
  onPressDateRow,
  editsLocked,
  onEditDayTitle,
  onEditGym,
  onEditNote,
}: {
  workout: WorkoutDetail;
  onPressDateRow?: () => void;
  editsLocked: boolean;
  onEditDayTitle: () => void;
  onEditGym: () => void;
  onEditNote: () => void;
}) {
  const theme = useAppTheme();
  const title = workout.dayTitle?.trim() ?? "";

  return (
    <View style={styles.infoCard}>
      <Pressable
        onPress={() => !editsLocked && onEditDayTitle()}
        disabled={editsLocked}
        style={({ pressed }) => [styles.infoRow, styles.infoTitleRow, pressed && styles.infoRowPressed]}
        accessibilityRole="button"
        accessibilityLabel="Название дня, изменить"
      >
        <View style={styles.infoTitleWithActiveDot}>
          <ActiveStatusDot visible={workout.isActive} traceContext={`workout/${workout.id}/header`} />
          <Text style={[styles.infoCardTitleFlex, !title && styles.infoCardTitlePlaceholder]}>
            {title || "Название дня"}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.textMuted}
          style={styles.infoRowChevron}
        />
      </Pressable>

      <InfoRow
        icon={<Ionicons name="calendar-outline" size={22} color={theme.text} />}
        text={workout.workoutDateFullText}
        onPress={editsLocked ? undefined : onPressDateRow}
        alwaysShowChevron
        accessibilityLabel="Дата тренировки, изменить"
      />

      <InfoRow
        icon={
          <Ionicons
            name="location-outline"
            size={22}
            color={theme.accent}
            style={{ transform: [{ translateX: -1 }] }}
          />
        }
        text={workout.gymName ?? ""}
        placeholder="Зал"
        accent={!!(workout.gymName ?? "").trim()}
        onPress={editsLocked ? undefined : onEditGym}
        alwaysShowChevron
        accessibilityLabel="Зал, изменить"
      />

      <InfoRow
        icon={<MaterialCommunityIcons name="comment-text" size={22} color={theme.text} />}
        text={workout.note ?? ""}
        placeholder="Заметка"
        muted={!(workout.note ?? "").trim()}
        onPress={editsLocked ? undefined : onEditNote}
        alwaysShowChevron
        accessibilityLabel="Заметка, изменить"
      />
    </View>
  );
}

function InfoRow({
  icon,
  text,
  accent = false,
  muted = false,
  placeholder,
  onPress,
  /** Шеврон для редактируемых строк: не скрывать при временной блокировке (оверлей другого редактора). */
  alwaysShowChevron = false,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  text: string;
  accent?: boolean;
  muted?: boolean;
  placeholder?: string;
  onPress?: () => void;
  alwaysShowChevron?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const trimmed = String(text ?? "").trim();
  const isEmpty = !trimmed;
  const display = isEmpty && placeholder ? placeholder : String(text ?? "");
  const showAsPlaceholder = isEmpty && !!placeholder;
  const resolvedAccent = accent && !showAsPlaceholder;
  const resolvedMuted = muted || showAsPlaceholder;

  const textBlock = (
    <Text
      {...globalTextBreakProps}
      style={[
        styles.infoText,
        resolvedAccent && styles.infoTextAccent,
        resolvedMuted && styles.infoTextMuted,
        showAsPlaceholder && styles.infoTextPlaceholder,
      ]}
    >
      {display}
    </Text>
  );

  const showTrailingChevron = !!(onPress || alwaysShowChevron);

  const rowContent = (
    <>
      <View style={styles.infoIcon}>{icon}</View>
      {textBlock}
      {showTrailingChevron ? (
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={styles.infoRowChevron} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.infoRow, pressed && styles.infoRowPressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {rowContent}
      </Pressable>
    );
  }

  return <View style={styles.infoRow}>{rowContent}</View>;
}

function useWorkoutDurationMinutes(workout: WorkoutDetail): number | null {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!workout.isActive) return;
    const id = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(id);
  }, [workout.isActive]);

  return React.useMemo(() => {
    if (!workout.isActive) return workout.durationMinutes;
    const fromExercises = computeWorkoutDuration(
      workout.exercises.map((exercise) => ({
        order_index: exercise.order,
        timeline: exercise.timeline,
      })),
    );
    return fromExercises.minutes ?? workout.durationMinutes;
  }, [workout.isActive, workout.durationMinutes, workout.exercises, tick]);
}

function ExercisesHeader() {
  return (
    <View style={styles.exercisesHeader}>
      <Text style={styles.sectionTitle}>Упражнения</Text>
    </View>
  );
}

function ExercisesList({
  exercises,
  onPressExercise,
  onOpenExerciseMenu,
}: {
  exercises: WorkoutExercise[];
  onPressExercise?: (exercise: WorkoutExercise) => void;
  onOpenExerciseMenu?: (exercise: WorkoutExercise) => void;
}) {
  const [expandedExerciseIds, setExpandedExerciseIds] = React.useState<
    Record<string, boolean>
  >({});

  function toggleExercise(exerciseId: string) {
    setExpandedExerciseIds((current) => ({
      ...current,
      [exerciseId]: !current[exerciseId],
    }));
  }

  if (exercises.length === 0) {
    return <ExercisesEmptyState />;
  }

  return (
    <View nativeID="workout-exercises-list" style={styles.exercisesList}>
      {exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          isExpanded={!!expandedExerciseIds[exercise.id]}
          onToggle={() => toggleExercise(exercise.id)}
          onPressExercise={onPressExercise}
          onOpenMenu={onOpenExerciseMenu}
        />
      ))}
    </View>
  );
}

function ExercisesEmptyState() {
  const theme = useAppTheme();

  return (
    <View nativeID="workout-exercises-list" style={styles.exercisesList}>
      <View style={styles.emptyStateWrap}>
        <BarbellOutlineIcon size={22} color={metricToken("green", theme.dark).fg} />
        <Text style={styles.emptyStateTitle}>Упражнений пока нет</Text>
        <Text style={styles.emptyStateText}>Добавьте первое упражнение с помощью кнопки «+».</Text>
      </View>
    </View>
  );
}

function WorkoutExerciseExpandedPanel({ exercise }: { exercise: WorkoutExercise }) {
  const exerciseId = Number(exercise.id);
  const apiEntry = exercise.apiEntry as Record<string, unknown>;
  const liveLog = React.useMemo(() => exerciseLogFromRow(apiEntry), [apiEntry]);
  const livePlannedSetsJson = React.useMemo(
    () => plannedSetsJsonFromExerciseRow(apiEntry),
    [apiEntry],
  );

  if (!Number.isFinite(exerciseId) || exerciseId <= 0) return null;

  return (
    <View style={styles.setsDropdown}>
      <ExerciseView1Panel
        exerciseId={exerciseId}
        contentInsetHorizontal={12}
        liveLog={liveLog}
        livePlannedSetsJson={livePlannedSetsJson}
        initialLog={liveLog}
        initialPlannedSetsJson={livePlannedSetsJson}
      />
    </View>
  );
}

function ExerciseCard({
  exercise,
  isExpanded,
  onToggle,
  onPressExercise,
  onOpenMenu,
}: {
  exercise: WorkoutExercise;
  isExpanded: boolean;
  onToggle: () => void;
  onPressExercise?: (exercise: WorkoutExercise) => void;
  onOpenMenu?: (exercise: WorkoutExercise) => void;
}) {
  const theme = useAppTheme();
  const chevronAnim = React.useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const dropdownAnim = React.useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const [dropdownContentHeight, setDropdownContentHeight] = React.useState(0);

  React.useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 360,
      easing: Easing.bezier(0.22, 0.78, 0.24, 1),
      useNativeDriver: true,
    }).start();
  }, [chevronAnim, isExpanded]);

  React.useEffect(() => {
    Animated.timing(dropdownAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 320,
      easing: Easing.bezier(0.22, 0.78, 0.24, 1),
      useNativeDriver: false,
    }).start();
  }, [dropdownAnim, isExpanded]);

  const leftArmRotate = chevronAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["36deg", "8deg", "-36deg"],
  });

  const rightArmRotate = chevronAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-36deg", "-8deg", "36deg"],
  });

  const leftArmBendSkew = chevronAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "18deg", "0deg"],
  });

  const rightArmBendSkew = chevronAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "-18deg", "0deg"],
  });

  const armPress = chevronAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.72, 1],
  });

  const dropdownHeight = dropdownAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(dropdownContentHeight, 1)],
  });

  return (
    <View style={styles.exerciseCardWrapper}>
      <View style={styles.exerciseCardShell}>
      <View
        testID="workout-exercises-list-item"
        style={[
          runtimeWorkoutListItemStyles.card,
          styles.exerciseCardBase,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Открыть упражнение: ${exercise.title}`}
          onPress={() => onPressExercise?.(exercise)}
          style={styles.exerciseCardMainPressable}
        >
          <View
            nativeID={`workout-exercise-left-column-${exercise.order}`}
            style={styles.exerciseLeftColumn}
          >
            <View
              nativeID={`workout-exercise-icon-${exercise.order}`}
              style={styles.exerciseIconCircle}
            >
              <MaterialCommunityIcons
                name={exercise.icon}
                size={30}
                color={theme.accent}
              />
            </View>
            <Text style={styles.exerciseTime}>{exercise.time}</Text>
          </View>

          <View style={runtimeWorkoutListItemStyles.verticalDivider} />

          <View style={runtimeWorkoutListItemStyles.cardContent}>
            <View style={[styles.exerciseCardTopRow, styles.exerciseTitleBlock]}>
              <View
                style={[
                  runtimeWorkoutListItemStyles.titleWithActiveDot,
                  styles.exerciseTitleWithActiveDot,
                ]}
              >
                <ActiveStatusDot
                  visible={exercise.isActive}
                  traceContext={`workout-exercise/${exercise.id}`}
                />
                <Text
                  style={[
                    runtimeWorkoutListItemStyles.workoutTitle,
                    styles.workoutDetailExerciseTitle,
                  ]}
                  {...(Platform.OS === "android"
                    ? ({ hyphenationFrequency: "none" } as const)
                    : {})}
                  {...(Platform.OS === "ios"
                    ? ({ lineBreakStrategyIOS: "push-out" } as const)
                    : {})}
                >
                  {exercise.title}
                </Text>
              </View>
            </View>

          <View style={styles.exerciseOrderRow}>
            <View
              style={[
                runtimeWorkoutListItemStyles.weekdayPill,
                styles.exerciseOrderPillBelowTitle,
              ]}
            >
              <Text
                nativeID={`workout-exercise-order-${exercise.order}`}
                style={[runtimeWorkoutListItemStyles.weekdayText, styles.workoutDetailExercisePillText]}
                {...(Platform.OS === "android"
                  ? ({ hyphenationFrequency: "none" } as const)
                  : {})}
                {...(Platform.OS === "ios"
                  ? ({ lineBreakStrategyIOS: "push-out" } as const)
                  : {})}
              >
                #{exercise.order + 1} в тренировке
              </Text>
            </View>
          </View>

          <View
            nativeID={`workout-exercise-metrics-${exercise.id}`}
            style={[runtimeWorkoutListItemStyles.metricsRow, styles.exerciseMetricsRow]}
          >
            <ExerciseMetricItem figmaKind="volume" value={`${exercise.setsCount} подх.`} variant="green" />

            <ExerciseMetricItem
              figmaKind="tonnage"
              value={`${formatNumber(exercise.tonnageKg)} кг`}
              variant="blue"
            />

            <ExerciseMetricItem figmaKind="best" value={exercise.bestSet} variant="teal" />
          </View>
        </View>
        </Pressable>

        <View style={styles.exerciseActionsColumn}>
          <Pressable
            hitSlop={12}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded ? "Свернуть подходы" : "Показать подходы"
            }
          >
            <Animated.View style={styles.exerciseChevronWrap}>
              <Animated.View
                style={[
                  styles.exerciseChevronArm,
                  styles.exerciseChevronArmLeft,
                  {
                    transform: [
                      { rotate: leftArmRotate },
                      { skewX: leftArmBendSkew },
                      { scaleY: armPress },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.exerciseChevronArm,
                  styles.exerciseChevronArmRight,
                  {
                    transform: [
                      { rotate: rightArmRotate },
                      { skewX: rightArmBendSkew },
                      { scaleY: armPress },
                    ],
                  },
                ]}
              />
            </Animated.View>
          </Pressable>
          <Pressable
            hitSlop={12}
            style={styles.exerciseMenuHit}
            onPress={() => onOpenMenu?.(exercise)}
            accessibilityRole="button"
            accessibilityLabel="Меню упражнения"
          >
            <MaterialCommunityIcons name="dots-vertical" size={19} color={theme.text} />
          </Pressable>
        </View>
      </View>
      <Animated.View
        pointerEvents={isExpanded ? "auto" : "none"}
        style={[
          styles.setsDropdownAnimated,
          {
            height: dropdownHeight,
          },
        ]}
      >
        <View
          onLayout={(event) =>
            setDropdownContentHeight(event.nativeEvent.layout.height)
          }
        >
          <WorkoutExerciseExpandedPanel exercise={exercise} />
        </View>
      </Animated.View>
      </View>
    </View>
  );
}

function ExerciseMetricItem({
  figmaKind,
  materialIcon,
  value,
  label,
  variant,
}: {
  figmaKind?: WorkoutMetricIconKind;
  materialIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  value: string;
  label?: string;
  variant: MetricVariant;
}) {
  const chipSize = useMetricChipSize();
  const textBreakProps =
    Platform.OS === "android"
      ? ({ hyphenationFrequency: "none" } as const)
      : Platform.OS === "ios"
        ? ({ lineBreakStrategyIOS: "push-out" } as const)
        : {};

  return (
    <View
      style={[
        runtimeWorkoutListItemStyles.metricItem,
        !label && styles.workoutDetailExerciseMetricItemNoLabel,
      ]}
    >
      <MetricIconCircle
        figmaKind={figmaKind}
        materialIcon={materialIcon}
        variant={variant}
        size={chipSize}
      />
      <View
        style={[
          runtimeWorkoutListItemStyles.metricTextBlock,
          !label && styles.workoutDetailExerciseMetricTextBlockNoLabel,
        ]}
      >
        <Text
          {...textBreakProps}
          style={[runtimeWorkoutListItemStyles.metricValue, styles.workoutDetailExerciseMetricValue]}
        >
          {value}
        </Text>
        {label ? (
          <Text
            {...textBreakProps}
            style={[runtimeWorkoutListItemStyles.metricLabel, styles.workoutDetailExerciseMetricLabel]}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function WorkoutSummary({ workout }: { workout: WorkoutDetail }) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const durationMinutes = useWorkoutDurationMinutes(workout);
  const summaryCardWidth = React.useMemo(() => {
    const pad = workoutScreenHorizontalPadding(screenWidth);
    return metricSnapItemWidth(screenWidth - pad * 2);
  }, [screenWidth]);

  const pageGutter = workoutScreenHorizontalPadding(screenWidth);
  const webBleedLeft = pageGutter + insets.left;
  const webBleedRight = pageGutter + insets.right;

  return (
    <View style={[styles.summaryBlock, Platform.OS === "web" && styles.summaryBlockWeb]}>
      <Text style={styles.summaryTitle}>Итоги тренировки</Text>

      <SnapHorizontalScroll
        itemWidth={summaryCardWidth}
        gap={METRIC_SNAP_GAP}
        clipItemOverflow={false}
        bleedGutterLeft={Platform.OS === "web" ? webBleedLeft : undefined}
        bleedGutterRight={Platform.OS === "web" ? webBleedRight : undefined}
        contentPaddingVertical={10}
        contentPaddingHorizontal={6}
        contentContainerStyle={styles.summaryCardsRow}
      >
        <SummaryCard
          figmaKind="duration"
          label="Длит."
          value={formatDuration(durationMinutes)}
          variant="teal"
        />

        <SummaryCard
          figmaKind="volume"
          label="Кол-во упр."
          value={`${workout.exercisesCount} упр.`}
          variant="green"
        />

        <SummaryCard figmaKind="tonnage" label="Тоннаж" value={`${formatNumber(workout.tonnageKg)} кг`} variant="blue" />

        <SummaryCard
          figmaKind="maxWeight"
          label="Макс. вес"
          value={workout.maxWeightKg > 0 ? `${formatNumber(workout.maxWeightKg)} кг` : "—"}
          variant="blue"
        />

        <SummaryCard
          figmaKind="sets"
          label="Кол-во подх."
          value={`${workout.setsCount} подх.`}
          variant="violet"
        />
      </SnapHorizontalScroll>
    </View>
  );
}

function summaryTextBreakProps() {
  if (Platform.OS === "android") return { hyphenationFrequency: "none" as const };
  if (Platform.OS === "ios") return { lineBreakStrategyIOS: "push-out" as const };
  return {};
}

function SummaryCard({
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
  const chipSize = useMetricChipSize();
  const tb = summaryTextBreakProps();

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
          <Text style={styles.summaryValue} {...tb}>
            {value}
          </Text>
          <Text style={[styles.summaryLabel, { textAlign: "left" }]} {...tb}>
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours <= 0) return `${mins} мин`;

  return `${hours} ч ${mins} мин`;
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
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

  content: {
    paddingTop: SCREEN_HEADER_TOP_PADDING,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    /** Как `titleRow` → searchBox на /workouts. */
    marginBottom: 24,
    gap: 6,
  },

  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    minHeight: 42,
    justifyContent: "center",
  },

  headerTitle: {
    ...type.screenTitle,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.8,
    color: theme.text,
  },

  infoCard: {
    borderRadius: PLAQUE_RADIUS,
    borderWidth: 0,
    backgroundColor: theme.card,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 14,

    shadowColor: "#24213A",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 2,
  },

  infoRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  infoRowPressed: {
    opacity: 0.78,
  },

  infoRowChevron: {
    marginLeft: 4,
    alignSelf: "center",
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

  infoTextAccent: {
    color: theme.accent,
  },

  infoTextMuted: {
    color: theme.textMuted,
  },

  exercisesHeader: {
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
  },

  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.extraBold,
    color: theme.text,
    letterSpacing: -0.35,
  },

  exercisesList: {
    marginBottom: 18,
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
    color: theme.textMuted,
  },

  emptyStateText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    color: theme.textMuted,
  },

  exerciseCardWrapper: {
    marginBottom: 14,
  },

  exerciseCardShell: {
    borderRadius: PLAQUE_RADIUS,
    borderWidth: 0,
    backgroundColor: theme.card,
    overflow: "hidden",

    shadowColor: "#24213A",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 2,
  },

  exerciseCardBase: {
    marginBottom: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  exerciseCardMainPressable: {
    flex: 1,
    flexDirection: "row",
    minWidth: 0,
  },

  exerciseActionsColumn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    alignSelf: "flex-start",
    marginLeft: 4,
  },

  exerciseLeftColumn: {
    width: 62,
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
  },

  exerciseIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: theme.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  exerciseTime: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 13,
    fontFamily: fonts.bold,
    color: theme.textMuted,
    textAlign: "center",
  },

  exerciseCardTopRow: {
    alignItems: "flex-start",
    marginBottom: 4,
  },

  exerciseTitleBlock: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },

  exerciseTitleWithActiveDot: {
    marginRight: 0,
    alignSelf: "stretch",
    alignItems: "center",
  },

  /** Компактнее общего списка тренировок: только экран детали. */
  workoutDetailExerciseTitle: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.25,
  },

  workoutDetailExercisePillText: {
    fontSize: 9,
    lineHeight: 12,
  },

  workoutDetailExerciseMetricValue: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
  },

  workoutDetailExerciseMetricItemNoLabel: {
    alignItems: "center",
  },

  workoutDetailExerciseMetricTextBlockNoLabel: {
    justifyContent: "center",
  },

  workoutDetailExerciseMetricLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontFamily: fonts.regular,
  },

  exerciseOrderRow: {
    marginBottom: 4,
    alignSelf: "stretch",
  },

  exerciseOrderPillBelowTitle: {
    marginTop: 0,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },

  exerciseMenuHit: {
    flexShrink: 0,
  },

  exerciseChevronWrap: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  exerciseChevronArm: {
    position: "absolute",
    width: 13,
    height: 1.6,
    borderRadius: 2,
    backgroundColor: theme.accent,
    top: 10,
  },

  exerciseChevronArmLeft: {
    right: 10,
  },

  exerciseChevronArmRight: {
    left: 10,
  },

  exerciseMetricsRow: {
    marginTop: 14,
    flexWrap: "wrap",
    rowGap: 8,
    columnGap: 8,
  },

  setsDropdownAnimated: {
    overflow: "hidden",
  },

  setsDropdown: {
    borderTopWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    paddingBottom: 10,
    overflow: "hidden",
  },

  summaryBlock: {
    marginTop: 2,
  },

  summaryBlockWeb: {
    overflow: "visible",
    zIndex: 1,
  },

  contentWebOverflowVisible: {
    overflow: "visible",
  },

  summaryTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.extraBold,
    color: theme.text,
    marginBottom: 10,
    letterSpacing: -0.28,
  },

  summaryCardsRow: {
    alignItems: "flex-start",
  },

  /** Внешняя оболочка: место под размытие тени (plaqueListShadow). */
  summaryCardShell: {
    width: "100%",
    paddingBottom: 24,
    paddingHorizontal: 4,
    overflow: "visible",
  },

  summaryCard: {
    width: "100%",
    minHeight: 68,
    borderRadius: PLAQUE_RADIUS,
    borderWidth: 0,
    backgroundColor: theme.card,
    paddingHorizontal: 13,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",

    ...plaqueListShadow(),
  },

  summaryIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },

  summaryGreen: {
    backgroundColor: metricToken("green", theme.dark).circle,
  },

  summaryBlue: {
    backgroundColor: metricToken("blue", theme.dark).circle,
  },

  summaryAmber: {
    backgroundColor: metricToken("amber", theme.dark).circle,
  },

  summaryTeal: {
    backgroundColor: metricToken("teal", theme.dark).circle,
  },

  summaryViolet: {
    backgroundColor: metricToken("violet", theme.dark).circle,
  },

  summaryTextBlock: {
    flex: 1,
    minWidth: 0,
  },

  summaryLabel: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.semiBold,
    color: theme.textMuted,
  },

  summaryValue: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: fonts.semiBold,
    color: theme.text,
  },

  infoTitleRow: {
    marginBottom: 6,
    paddingLeft: 3,
  },

  infoTitleWithActiveDot: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  infoCardTitleFlex: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.extraBold,
    color: theme.text,
    letterSpacing: -0.45,
  },

  infoCardTitlePlaceholder: {
    color: theme.textMuted,
  },

  infoTextPlaceholder: {
    color: theme.textMuted,
    fontFamily: fonts.semiBold,
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

let runtimeWorkoutListItemStyles = workoutListItemStyles;
