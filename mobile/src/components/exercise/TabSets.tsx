import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View, Alert } from "react-native";
import { apiFetch, parseErrorDetail } from "@/api/client";
import {
  fetchExerciseInWorkout,
  exerciseLogFromRow,
  plannedSetsFromExerciseRow,
  plannedSetsJsonFromExerciseRow,
} from "@/api/exerciseInWorkout";
import { on } from "@/utils/eventBus";
import {
  applyExerciseUpdatedPayload,
  emitExerciseUpdated,
  EXERCISE_UPDATED_EVENT,
} from "@/utils/exerciseUpdatedEvent";
import TimelineEntryCreateModal from "@/components/modals/TimelineEntryCreateModal";
import ExerciseView1Panel from "@/components/exercise/ExerciseView1Panel";
import {
  countSetEntriesInPlannedJson,
  timelineEventFromLogEntry,
} from "@/utils/exerciseTimeline";
import { getExerciseSetProgress, getPlanProgressColor } from "@/utils/exerciseSetProgress";
import type { ExerciseTimerPhase } from "@/components/exercise/TabTimer";
import type { NextSetDraft } from "@/domain/nextSetDraft";
import { createEmptyNextSetDraft } from "@/domain/nextSetDraft";
import { useCatalogUi } from "@/theme/catalogUi";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import { fonts, type } from "@/theme/typography";

type LogEntry = Record<string, unknown>;

function pickExerciseLogEntries(ex: unknown): LogEntry[] {
  if (!ex || typeof ex !== "object") return [];
  return exerciseLogFromRow(ex as Record<string, unknown>);
}

function fmtIntSpace(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function setsWordRu(n: number): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return "подходов";
  if (n1 === 1) return "подход";
  if (n1 >= 2 && n1 <= 4) return "подхода";
  return "подходов";
}

export type { NextSetDraft };

type Props = {
  exerciseId: number | null;
  /** Журнал с экрана /exercise/[id] — без повторного fetch на первом кадре. */
  preloadedLog?: Record<string, unknown>[] | null;
  preloadedPlannedSets?: number | null;
  preloadedPlannedSetsJson?: Record<string, unknown>[] | null;
  /** Как на вебе: кнопка «Перейти к таймеру». */
  onGoToTimer?: () => void;
  onAddSet?: () => void;
  /** Открыть модалку «Новый подход» один раз (например, из тренировки ?addSet=1). */
  autoOpenCreate?: boolean;
  onAutoOpenCreateConsumed?: () => void;
  /** Регистрация действия «+» для FAB на экране (как на /workouts). */
  onRegisterAddSet?: (openCreate: () => void) => void;
  /** Горизонтальные отступы блоков контента (0, если padding задан экраном). */
  contentInsetHorizontal?: number;
  /** Черновик веса/повторов с вкладки «Таймер» для строки «Текущий» подход. */
  nextSetDraft?: NextSetDraft;
  /** Фаза таймера: «Текущий» placeholder только при `set`. */
  timerPhase?: ExerciseTimerPhase;
  /** Вкладка «Подходы» активна — иначе не делаем GET без payload. */
  isActive?: boolean;
  /** Поля «Вес (текст)» и «Повторения (текст)» в Вид 1 и модалках. */
  showSetTextFields?: boolean;
};

/**
 * Вкладка «Подходы»: журнал сетов (в т.ч. mark_type из таймера), редактирование через модалку.
 * Отображение меток согласовано с `frontend/src/tabs/TabSets.jsx`.
 */
export default function TabSets({
  exerciseId,
  preloadedLog = null,
  preloadedPlannedSets = null,
  preloadedPlannedSetsJson = null,
  onGoToTimer: _onGoToTimer,
  onAddSet,
  autoOpenCreate,
  onAutoOpenCreateConsumed,
  onRegisterAddSet,
  contentInsetHorizontal = 16,
  nextSetDraft = createEmptyNextSetDraft(),
  timerPhase = "idle",
  isActive = true,
  showSetTextFields = true,
}: Props) {
  const catalogUi = useCatalogUi();
  const styles = useMemo(
    () => createStyles(catalogUi, contentInsetHorizontal),
    [catalogUi, contentInsetHorizontal],
  );
  const hasInitialSnapshot = preloadedLog != null;
  const skipFirstFetchRef = useRef(hasInitialSnapshot);
  const [log, setLog] = useState<LogEntry[]>(preloadedLog ?? []);
  const [plannedSets, setPlannedSets] = useState<number | null>(
    hasInitialSnapshot ? preloadedPlannedSets : null,
  );
  const [plannedSetsJson, setPlannedSetsJson] = useState<LogEntry[]>(
    hasInitialSnapshot && preloadedPlannedSetsJson ? preloadedPlannedSetsJson : [],
  );
  const [loading, setLoading] = useState(!hasInitialSnapshot);
  const [error, setError] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState("");
  const autoOpenedRef = useRef(false);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    if (preloadedPlannedSetsJson == null) return;
    setPlannedSetsJson([...preloadedPlannedSetsJson]);
  }, [preloadedPlannedSetsJson]);

  const applyPayloadUpdate = useCallback(
    (payload: unknown) =>
      applyExerciseUpdatedPayload(payload, exerciseId, {
        onLog: (nextLog, plannedSets) => {
          setLog(nextLog);
          if (plannedSets !== undefined) setPlannedSets(plannedSets);
        },
        onPlannedOnly: (plannedSets) => {
          setPlannedSets(plannedSets);
        },
        onPlannedJson: (nextPlannedJson) => {
          setPlannedSetsJson([...nextPlannedJson]);
        },
      }),
    [exerciseId],
  );

  const fetchExercise = useCallback(async (options?: { silent?: boolean }) => {
    if (!exerciseId) return;
    try {
      if (!options?.silent) setLoading(true);
      setError("");
      const ex = await fetchExerciseInWorkout(exerciseId);
      setLog(pickExerciseLogEntries(ex));
      setPlannedSets(plannedSetsFromExerciseRow(ex));
      setPlannedSetsJson(plannedSetsJsonFromExerciseRow(ex));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  const savePlannedSets = useCallback(
    async (raw?: string) => {
      if (!exerciseId) return false;

      let plannedValue: number | null;
      const trimmed = (raw ?? "").trim();
      if (trimmed === "") {
        plannedValue = null;
      } else {
        const n = parseInt(trimmed, 10);
        if (!Number.isFinite(n) || n < 1) return false;
        plannedValue = n;
      }

      const r = await apiFetch(`/api/v1/exercises_in_workout/${exerciseId}/planned_sets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planned_sets_count: plannedValue }),
      });
      const rawResp = await r.json().catch(() => ({}));
      if (!r.ok) {
        Alert.alert("Ошибка", parseErrorDetail(rawResp));
        return false;
      }
      const saved =
        (rawResp as { planned_sets_count?: unknown; planned_sets?: unknown }).planned_sets_count ??
        (rawResp as { planned_sets?: unknown }).planned_sets;
      const nextPlanned =
        typeof saved === "number" && Number.isFinite(saved) ? Math.round(saved) : plannedValue;
      setPlannedSets(nextPlanned);
      emitExerciseUpdated({ exerciseId, plannedSets: nextPlanned });
      return true;
    },
    [exerciseId],
  );

  const handleExerciseUpdated = useCallback(
    (payload?: unknown) => {
      if (applyPayloadUpdate(payload)) return;
      if (!isActiveRef.current) return;
      void fetchExercise({ silent: true });
    },
    [applyPayloadUpdate, fetchExercise],
  );

  useEffect(() => {
    if (skipFirstFetchRef.current) {
      skipFirstFetchRef.current = false;
      return on(EXERCISE_UPDATED_EVENT, handleExerciseUpdated);
    }
    void fetchExercise();
    return on(EXERCISE_UPDATED_EVENT, handleExerciseUpdated);
  }, [fetchExercise, handleExerciseUpdated]);

  useEffect(() => {
    if (!autoOpenCreate) {
      autoOpenedRef.current = false;
      return;
    }
    if (!exerciseId || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    setCreateModalOpen(true);
    onAutoOpenCreateConsumed?.();
  }, [autoOpenCreate, exerciseId, onAutoOpenCreateConsumed]);

  function openCreate() {
    setCreateModalOpen(true);
  }

  const openCreateAction = useCallback(() => {
    if (onAddSet) {
      onAddSet();
      return;
    }
    openCreate();
  }, [onAddSet]);

  useEffect(() => {
    onRegisterAddSet?.(openCreateAction);
  }, [onRegisterAddSet, openCreateAction]);

  const setProgress = getExerciseSetProgress(log);
  const loggedSetCount = setProgress.loggedSetCount;
  const doneSetsCount = loggedSetCount;
  const plannedSetCountFromJson = countSetEntriesInPlannedJson(plannedSetsJson);
  const effectivePlannedSets =
    plannedSetCountFromJson > 0 ? plannedSetCountFromJson : plannedSets;
  const hasExplicitPlan = effectivePlannedSets != null && effectivePlannedSets > 0;
  const planCountColor = getPlanProgressColor(doneSetsCount, effectivePlannedSets, catalogUi);

  const openPlanModal = () => {
    setPlanDraft(hasExplicitPlan && plannedSets != null ? String(plannedSets) : "3");
    setPlanModalOpen(true);
  };

  const totalVolumeKg = useMemo(() => {
    let sum = 0;
    for (const item of log) {
      const event = timelineEventFromLogEntry(item);
      if (!event || event.type !== "set") continue;
      const w = Number(event.weight_kg ?? event.weight);
      const reps = Number(event.reps);
      if (Number.isFinite(w) && Number.isFinite(reps)) sum += w * reps;
    }
    return sum;
  }, [log]);

  if (!exerciseId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Выберите упражнение</Text>
      </View>
    );
  }

  return (
    <View style={styles.content}>
      {loading ? <Text style={styles.muted}>Загрузка…</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <View style={styles.statsCard}>
        <Pressable style={styles.statCol} onPress={openPlanModal} hitSlop={8}>
          <View style={styles.statIconCircle}>
            <MaterialCommunityIcons name="calendar" size={18} color={catalogUi.accent} />
          </View>
          <Text style={styles.statLabel}>План</Text>
          {hasExplicitPlan && effectivePlannedSets != null ? (
            <Text style={[styles.statValue, { color: planCountColor }]}>
              {`${effectivePlannedSets} ${setsWordRu(effectivePlannedSets)}`}
            </Text>
          ) : (
            <Text style={[styles.statValue, styles.statValueAction]}>Задать</Text>
          )}
        </Pressable>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <View style={styles.statIconCircle}>
            <MaterialCommunityIcons name="check-circle" size={18} color={catalogUi.accent} />
          </View>
          <Text style={styles.statLabel}>Выполнено</Text>
          <Text
            style={[
              styles.statValue,
              hasExplicitPlan && effectivePlannedSets != null && { color: planCountColor },
            ]}
          >
            {hasExplicitPlan && effectivePlannedSets != null
              ? `${doneSetsCount} из ${effectivePlannedSets}`
              : doneSetsCount}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <View style={styles.statIconCircle}>
            <MaterialCommunityIcons name="weight" size={18} color={catalogUi.accent} />
          </View>
          <Text style={styles.statLabel}>Общий объём</Text>
          <Text style={styles.statValue}>{fmtIntSpace(totalVolumeKg)} кг</Text>
        </View>
      </View>

      <ExerciseView1Panel
        exerciseId={exerciseId}
        contentInsetHorizontal={contentInsetHorizontal}
        liveLog={log}
        livePlannedSetsJson={plannedSetsJson}
        initialLog={preloadedLog ?? undefined}
        initialPlannedSets={preloadedPlannedSets}
        initialPlannedSetsJson={
          preloadedPlannedSetsJson ?? (hasInitialSnapshot ? plannedSetsJson : undefined)
        }
        nextSetDraft={nextSetDraft}
        timerPhase={timerPhase}
        showSetTextFields={showSetTextFields}
      />

      <TimelineEntryCreateModal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        exerciseId={exerciseId}
        showSetTextFields={showSetTextFields}
      />

      <Modal
        visible={planModalOpen}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setPlanModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPlanModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>План подходов</Text>
            <Text style={styles.modalLab}>Сколько подходов планируете? Пустое поле — сброс.</Text>
            <TextInput
              style={styles.modalInput}
              value={planDraft}
              onChangeText={setPlanDraft}
              keyboardType="number-pad"
              placeholder="Например: 4"
              placeholderTextColor={catalogUi.textPlaceholder}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setPlanModalOpen(false)}>
                <Text style={styles.modalCancel}>Отмена</Text>
              </Pressable>
              <Pressable
                style={styles.modalSave}
                onPress={() => {
                  void savePlannedSets(planDraft).then((ok) => {
                    if (ok) setPlanModalOpen(false);
                  });
                }}
              >
                <Text style={styles.modalSaveText}>Сохранить</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (catalogUi: ReturnType<typeof useCatalogUi>, hPad: number) =>
  StyleSheet.create({
  content: { backgroundColor: catalogUi.pageBg },
  screen: { flex: 1, backgroundColor: catalogUi.pageBg },
  center: { padding: 24, alignItems: "center" },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: catalogUi.textMuted,
    textAlign: "center",
    paddingHorizontal: hPad,
    paddingTop: 12,
  },
  err: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: catalogUi.dark ? "#FCA5A5" : "#dc2626",
    marginBottom: 8,
    paddingHorizontal: hPad,
  },

  statsCard: {
    flexDirection: "row",
    marginHorizontal: hPad,
    marginTop: 12,
    backgroundColor: catalogUi.cardBg,
    borderRadius: PLAQUE_RADIUS,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statCol: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: catalogUi.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statDivider: { width: 1, height: 54, backgroundColor: catalogUi.border, alignSelf: "center" },
  statLabel: { ...type.caption, fontFamily: fonts.regular, color: catalogUi.textMuted, marginTop: 6 },
  statValue: { ...type.statTileValue, fontFamily: fonts.bold, color: catalogUi.text, marginTop: 4, textAlign: "center" },
  statValueAction: { color: catalogUi.accent },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: catalogUi.cardBg,
    borderRadius: PLAQUE_RADIUS,
    padding: 20,
  },
  modalTitle: { ...type.modalTitle, color: catalogUi.text, marginBottom: 12, fontSize: 18, lineHeight: 24 },
  modalLab: { ...type.label, color: catalogUi.textMuted, marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: catalogUi.border,
    borderRadius: 12,
    padding: 12,
    ...type.body,
    marginBottom: 12,
    fontFamily: fonts.regular,
    color: catalogUi.text,
  },
  modalBtns: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  modalCancel: { ...type.bodyMedium, color: catalogUi.textMuted },
  modalSave: {
    backgroundColor: catalogUi.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalSaveText: { ...type.bodyMedium, color: "#FFFFFF", fontFamily: fonts.semiBold },
});
