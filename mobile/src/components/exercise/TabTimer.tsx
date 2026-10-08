import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, parseErrorDetail } from "@/api/client";
import {
  catalogIdFromExerciseRow,
  exerciseLogFromRow,
  fetchExerciseInWorkout,
  plannedSetsFromExerciseRow,
  plannedSetsJsonFromExerciseRow,
} from "@/api/exerciseInWorkout";
import { on } from "@/utils/eventBus";
import {
  applyExerciseUpdatedPayload,
  emitExerciseUpdated,
  EXERCISE_UPDATED_EVENT,
} from "@/utils/exerciseUpdatedEvent";
import ExerciseView1Panel from "@/components/exercise/ExerciseView1Panel";
import {
  logEntryToNextSetDraft,
  nextSetDraftToSetPayload,
  formatNextSetDraftRepsLabel,
  formatNextSetDraftWeightLabel,
  type NextSetDraft,
} from "@/domain/nextSetDraft";
import { inferActiveTimerFromLog } from "@/utils/exerciseTimeline";
import { getExerciseSetProgress, getPlanProgressColor } from "@/utils/exerciseSetProgress";
import { formatTime } from "@/utils/time";
import { playRestOvertimeAlert, REST_OVERTIME_RED_TIMER } from "@/utils/restOvertimeAlert";
import {
  DEFAULT_REST_TARGET_SEC,
  loadRestTargetSec,
  restDurationPartsFromSeconds,
  saveRestTargetSec,
} from "@/utils/restDurationPreferences";
import { useCatalogUi } from "@/theme/catalogUi";
import { colors } from "@/theme/colors";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import { fonts, type } from "@/theme/typography";
import SetEditorModal from "@/components/modals/SetEditorModal";
import { parseSetEffortLevel } from "@/utils/workoutSetEffort";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

const PHASES = { IDLE: "idle", SET: "set", REST: "rest" } as const;
export type ExerciseTimerPhase = (typeof PHASES)[keyof typeof PHASES];
type Phase = ExerciseTimerPhase;

const REST_PRESETS_SEC = [30, 60, 120, 180, 240, 300] as const;

function pickExerciseLogEntries(ex: unknown): Record<string, unknown>[] {
  if (!ex || typeof ex !== "object") return [];
  return exerciseLogFromRow(ex as Record<string, unknown>);
}

function isSetLikeEntry(item: Record<string, unknown> | null | undefined): boolean {
  if (!item) return false;
  const t = item.type;
  if (t === "mark" || t === "rest" || t === "comment") return false;
  if (t === "set") return true;
  return (
    item.reps != null ||
    (typeof item.reps_string === "string" && item.reps_string.trim() !== "") ||
    item.weight != null ||
    item.weight_kg != null ||
    (typeof item.weight_string === "string" && item.weight_string.trim() !== "") ||
    parseSetEffortLevel(item.effort_level) != null ||
    item.set_time != null ||
    item.set_seconds != null
  );
}

function setsWordRu(n: number): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return "подходов";
  if (n1 === 1) return "подход";
  if (n1 >= 2 && n1 <= 4) return "подхода";
  return "подходов";
}

function normalizeDurationPart(value: string, max: number | null = null) {
  if (value.trim() === "") return { display: "", numeric: 0 };
  let parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) parsed = 0;
  if (max != null && parsed > max) parsed = max;
  return { display: String(parsed), numeric: parsed };
}

type Props = {
  exerciseId: number | null;
  /** Журнал и мета с экрана /exercise/[id] — без повторного fetch до первого кадра. */
  preloadedLog?: Record<string, unknown>[] | null;
  preloadedPlannedSets?: number | null;
  preloadedPlannedSetsJson?: Record<string, unknown>[] | null;
  preloadedExerciseRow?: Record<string, unknown> | null;
  registerStopExercise?: (stopExercise: () => void) => void;
  /** Горизонтальные отступы блоков контента (0, если padding задан экраном). */
  contentInsetHorizontal?: number;
  nextSetDraft: NextSetDraft;
  onNextSetDraftChange: (draft: NextSetDraft) => void;
  onTimerPhaseChange?: (phase: ExerciseTimerPhase) => void;
  /** Вкладка «Таймер» активна — иначе не делаем GET без payload. */
  isActive?: boolean;
  /** Поля «Вес (текст)» и «Повторения (текст)» в Вид 1 и модалках. */
  showSetTextFields?: boolean;
  /** Блок «Вид 1» на вкладке «Таймер». */
  showView1OnTimer?: boolean;
  /** Уместить таймер на экран без скролла (без списка подходов). */
  fillViewport?: boolean;
  /** Открывать редактор подхода сразу после кнопки «Завершить подход». */
  editCompletedSetOnFinish?: boolean;
  /** Выключить автопоказ редактора завершённого подхода из самой модалки. */
  onDisableCompletedSetAutoEdit?: () => void;
};

/**
 * Вкладка «Таймер»: старт без заранее добавленных подходов, марка начала упражнения,
 * подходы с длительностью (set_seconds), отдых отдельной записью type rest (rest_seconds ≥ 0),
 * без паузы и без кнопки «Пропустить».
 */
export default function TabTimer({
  exerciseId,
  preloadedLog = null,
  preloadedPlannedSets = null,
  preloadedPlannedSetsJson = null,
  preloadedExerciseRow = null,
  registerStopExercise,
  contentInsetHorizontal = 16,
  nextSetDraft,
  onNextSetDraftChange,
  onTimerPhaseChange,
  isActive = true,
  showSetTextFields = true,
  showView1OnTimer = false,
  fillViewport = false,
  editCompletedSetOnFinish = true,
  onDisableCompletedSetAutoEdit,
}: Props) {
  const catalogUi = useCatalogUi();
  const styles = useMemo(
    () => createStyles(catalogUi, contentInsetHorizontal),
    [catalogUi, contentInsetHorizontal],
  );
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>(PHASES.IDLE);
  const [timePassed, setTimePassed] = useState(0);
  const [sets, setSets] = useState<Record<string, unknown>[]>([]);
  const [exerciseData, setExerciseData] = useState<{ planned_sets: number | null }>({ planned_sets: null });
  const [plannedSetsJson, setPlannedSetsJson] = useState<Record<string, unknown>[]>(() =>
    Array.isArray(preloadedPlannedSetsJson) ? [...preloadedPlannedSetsJson] : [],
  );
  const [plannedSetsInput, setPlannedSetsInput] = useState("");
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState("");
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [restMinutesDraft, setRestMinutesDraft] = useState("1");
  const [restSecondsDraft, setRestSecondsDraft] = useState("0");
  const [restSelectedPresets, setRestSelectedPresets] = useState<Set<number>>(() => new Set());
  const [restTargetSec, setRestTargetSec] = useState(DEFAULT_REST_TARGET_SEC);
  const [restMinutes, setRestMinutes] = useState("1");
  const [restSeconds, setRestSeconds] = useState("0");
  const [nextSetDraftEditorVisible, setNextSetDraftEditorVisible] = useState(false);
  const [completedSetEditorVisible, setCompletedSetEditorVisible] = useState(false);
  const [completedSetEditorPayload, setCompletedSetEditorPayload] = useState<{
    setIdx: number;
    initial: Record<string, unknown>;
  } | null>(null);
  const [compactRingSize, setCompactRingSize] = useState(260);

  const handleRingSlotLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const size = Math.floor(Math.min(260, width, height));
    if (size <= 0) return;
    const next = Math.max(132, size);
    setCompactRingSize((prev) => (prev === next ? prev : next));
  }, []);

  const openNextSetDraftEditor = useCallback(() => {
    setNextSetDraftEditorVisible(true);
  }, []);

  const phaseStartedAtRef = useRef(Date.now());
  const prevPhaseRef = useRef<Phase>(PHASES.IDLE);
  const timePassedRef = useRef(0);
  const exerciseIdRef = useRef(exerciseId);
  const setsRef = useRef<Record<string, unknown>[]>([]);
  const phaseRef = useRef<Phase>(PHASES.IDLE);
  const lastLoadedExerciseIdRef = useRef<number | null>(null);
  const prevRestElapsedRef = useRef(0);
  const skipRestOvertimeAlertRef = useRef(false);
  const restScopeRef = useRef<{ catalogExerciseId: number | null; workoutExerciseId: number | null }>({
    catalogExerciseId: null,
    workoutExerciseId: null,
  });
  const restTargetSecRef = useRef(DEFAULT_REST_TARGET_SEC);
  const preloadedSnapshotRef = useRef<{
    exerciseId: number | null;
    log: Record<string, unknown>[];
    plannedSets: number | null;
    row: Record<string, unknown> | null;
  } | null>(null);
  const exerciseDataRef = useRef(exerciseData);
  const isActiveRef = useRef(isActive);

  const applyOptimisticLog = useCallback((nextLog: Record<string, unknown>[]) => {
    setsRef.current = nextLog;
    setSets(nextLog);
  }, []);

  const appendOptimisticEntry = useCallback(
    (entry: Record<string, unknown>) => {
      const previousLog = setsRef.current;
      applyOptimisticLog([...previousLog, entry]);
      return previousLog;
    },
    [applyOptimisticLog],
  );

  const appendOptimisticEntries = useCallback(
    (entries: Record<string, unknown>[]) => {
      const previousLog = setsRef.current;
      if (entries.length > 0) {
        applyOptimisticLog([...previousLog, ...entries]);
      }
      return previousLog;
    },
    [applyOptimisticLog],
  );

  const applyExerciseSnapshot = useCallback(
    (
      exId: number,
      log: Record<string, unknown>[],
      planned: number | null,
      row: Record<string, unknown> | null,
      options?: { forceTimerSync?: boolean; syncTimerPhase?: boolean },
    ) => {
      setsRef.current = log;
      setSets(log);
      lastLoadedExerciseIdRef.current = exId;
      setExerciseData({ planned_sets: planned });
      setPlannedSetsInput(planned != null ? String(planned) : "");

      if (row) {
        restScopeRef.current = {
          catalogExerciseId: catalogIdFromExerciseRow(row),
          workoutExerciseId: exId,
        };
      }

      if (options?.syncTimerPhase === false) return;

      const activeTimer = inferActiveTimerFromLog(log);
      const locallyActive = phaseRef.current !== PHASES.IDLE;

      if (!activeTimer) {
        setPhase(PHASES.IDLE);
        setTimePassed(0);
        phaseStartedAtRef.current = Date.now();
        prevPhaseRef.current = PHASES.IDLE;
      } else if (!locallyActive || options?.forceTimerSync) {
        const nextPhase = activeTimer.phase === "rest" ? PHASES.REST : PHASES.SET;
        setPhase(nextPhase);
        phaseStartedAtRef.current = activeTimer.phaseStartedAtMs;
        prevPhaseRef.current = nextPhase;
        setTimePassed(activeTimer.elapsedSec);
        if (nextPhase === PHASES.REST && activeTimer.elapsedSec > restTargetSecRef.current) {
          skipRestOvertimeAlertRef.current = true;
        }
      }
    },
    [],
  );

  useEffect(() => {
    exerciseIdRef.current = exerciseId;
  }, [exerciseId]);

  useEffect(() => {
    timePassedRef.current = timePassed;
  }, [timePassed]);

  useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    restTargetSecRef.current = restTargetSec;
  }, [restTargetSec]);

  useEffect(() => {
    exerciseDataRef.current = exerciseData;
  }, [exerciseData]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const applyRestDuration = useCallback((nextMinutes: string, nextSeconds: string) => {
    const safeMinutes = normalizeDurationPart(nextMinutes);
    const safeSeconds = normalizeDurationPart(nextSeconds, 59);
    const totalSeconds = Math.max(5, Math.min(600, safeMinutes.numeric * 60 + safeSeconds.numeric));
    setRestMinutes(safeMinutes.display);
    setRestSeconds(safeSeconds.display);
    setRestTargetSec(totalSeconds);
    void saveRestTargetSec(restScopeRef.current, totalSeconds);
  }, []);

  const buildSetEntryPayload = useCallback(
    (elapsed: number): Record<string, unknown> =>
      nextSetDraftToSetPayload(nextSetDraft, elapsed),
    [nextSetDraft],
  );

  useEffect(() => {
    onTimerPhaseChange?.(phase);
  }, [phase, onTimerPhaseChange]);

  const applyPayloadUpdate = useCallback(
    (payload: unknown) => {
      const exId = exerciseIdRef.current;
      return applyExerciseUpdatedPayload(payload, exId, {
        onLog: (log, plannedSets) => {
          if (!exId) return;
          const planned =
            plannedSets !== undefined ? plannedSets : exerciseDataRef.current.planned_sets;
          applyExerciseSnapshot(exId, log, planned, null, { syncTimerPhase: false });
        },
        onPlannedOnly: (plannedSets) => {
          setExerciseData({ planned_sets: plannedSets });
          setPlannedSetsInput(plannedSets != null ? String(plannedSets) : "");
        },
        onPlannedJson: (nextPlannedJson) => {
          setPlannedSetsJson([...nextPlannedJson]);
        },
      });
    },
    [applyExerciseSnapshot],
  );

  const loadExercise = useCallback(async () => {
    const exId = exerciseIdRef.current;
    if (!exId) return;
    try {
      const ex = await fetchExerciseInWorkout(exId);
      const planned = plannedSetsFromExerciseRow(ex);
      const log = pickExerciseLogEntries(ex);

      let effectiveRestTargetSec = restTargetSecRef.current;
      const isNewExercise = lastLoadedExerciseIdRef.current !== exId;
      if (isNewExercise) {
        const cid = catalogIdFromExerciseRow(ex);
        restScopeRef.current = { catalogExerciseId: cid, workoutExerciseId: exId };
        const savedRest = await loadRestTargetSec(restScopeRef.current);
        if (savedRest != null) {
          effectiveRestTargetSec = savedRest;
          const parts = restDurationPartsFromSeconds(savedRest);
          setRestMinutes(parts.minutes);
          setRestSeconds(parts.seconds);
          setRestTargetSec(savedRest);
        }
      }

      applyExerciseSnapshot(exId, log, planned, ex, { forceTimerSync: isNewExercise });
      setPlannedSetsJson(plannedSetsJsonFromExerciseRow(ex));
      if (effectiveRestTargetSec !== restTargetSecRef.current) {
        restTargetSecRef.current = effectiveRestTargetSec;
      }
    } catch {
      /* ignore */
    }
  }, [applyExerciseSnapshot]);

  const handleExerciseUpdated = useCallback(
    (payload?: unknown) => {
      if (applyPayloadUpdate(payload)) return;
      if (!isActiveRef.current) return;
      void loadExercise();
    },
    [applyPayloadUpdate, loadExercise],
  );

  const postTimelineEntry = useCallback(
    async (
      exId: number,
      body: Record<string, unknown>,
      options?: { silent?: boolean; skipApply?: boolean },
    ) => {
      const r = await apiFetch(`/api/v1/exercises_in_workout/${exId}/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = (await r.json().catch(() => ({}))) as {
        added_set?: Record<string, unknown>;
        all_sets?: Record<string, unknown>[];
      };
      if (!r.ok) throw new Error(parseErrorDetail(raw));
      const allSets = Array.isArray(raw.all_sets) ? raw.all_sets : [];
      if (!options?.skipApply) {
        applyExerciseSnapshot(exId, allSets, exerciseDataRef.current.planned_sets, null, {
          syncTimerPhase: false,
        });
      }
      if (!options?.silent) {
        emitExerciseUpdated({ exerciseId: exId, log: allSets });
      }
      const setIdx = allSets.length > 0 ? allSets.length - 1 : -1;
      const initial =
        raw.added_set && typeof raw.added_set === "object"
          ? raw.added_set
          : setIdx >= 0
            ? allSets[setIdx]
            : null;
      return { setIdx, initial, allSets };
    },
    [applyExerciseSnapshot],
  );

  useLayoutEffect(() => {
    if (!exerciseId || preloadedLog == null) return;
    preloadedSnapshotRef.current = {
      exerciseId,
      log: preloadedLog,
      plannedSets: preloadedPlannedSets,
      row: preloadedExerciseRow,
    };
    const isNewExercise = lastLoadedExerciseIdRef.current !== exerciseId;
    applyExerciseSnapshot(exerciseId, preloadedLog, preloadedPlannedSets, preloadedExerciseRow, {
      forceTimerSync: isNewExercise,
      syncTimerPhase: isNewExercise,
    });
    if (Array.isArray(preloadedPlannedSetsJson)) {
      setPlannedSetsJson([...preloadedPlannedSetsJson]);
    }
  }, [
    applyExerciseSnapshot,
    exerciseId,
    preloadedExerciseRow,
    preloadedLog,
    preloadedPlannedSets,
    preloadedPlannedSetsJson,
  ]);

  useEffect(() => {
    if (!Array.isArray(preloadedPlannedSetsJson)) return;
    setPlannedSetsJson([...preloadedPlannedSetsJson]);
  }, [preloadedPlannedSetsJson]);

  useEffect(() => {
    const hadPreload =
      preloadedSnapshotRef.current?.exerciseId === exerciseId && preloadedLog != null;
    if (!hadPreload) {
      lastLoadedExerciseIdRef.current = null;
      setPhase(PHASES.IDLE);
      setTimePassed(0);
      phaseStartedAtRef.current = Date.now();
      prevPhaseRef.current = PHASES.IDLE;
      restScopeRef.current = { catalogExerciseId: null, workoutExerciseId: exerciseId };
      const defaultParts = restDurationPartsFromSeconds(DEFAULT_REST_TARGET_SEC);
      setRestMinutes(defaultParts.minutes);
      setRestSeconds(defaultParts.seconds);
      setRestTargetSec(DEFAULT_REST_TARGET_SEC);
      void loadExercise();
    } else {
      const scope = preloadedExerciseRow
        ? {
            catalogExerciseId: catalogIdFromExerciseRow(preloadedExerciseRow),
            workoutExerciseId: exerciseId,
          }
        : { catalogExerciseId: null, workoutExerciseId: exerciseId };
      restScopeRef.current = scope;
      void (async () => {
        const savedRest = await loadRestTargetSec(scope);
        if (savedRest == null) return;
        const parts = restDurationPartsFromSeconds(savedRest);
        setRestMinutes(parts.minutes);
        setRestSeconds(parts.seconds);
        setRestTargetSec(savedRest);
      })();
    }
    return on(EXERCISE_UPDATED_EVENT, handleExerciseUpdated);
  }, [exerciseId, handleExerciseUpdated, loadExercise, preloadedExerciseRow, preloadedLog]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (phase === PHASES.SET || phase === PHASES.REST) {
      prevPhaseRef.current = phase;
      const syncElapsed = () => {
        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - phaseStartedAtRef.current) / 1000),
        );
        setTimePassed(elapsed);
      };
      syncElapsed();
      interval = setInterval(syncElapsed, 250);
    } else {
      prevPhaseRef.current = phase;
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== PHASES.REST) {
      prevRestElapsedRef.current = 0;
      return;
    }
    if (skipRestOvertimeAlertRef.current) {
      skipRestOvertimeAlertRef.current = false;
      prevRestElapsedRef.current = timePassed;
      return;
    }
    const prev = prevRestElapsedRef.current;
    if (prev <= restTargetSec && timePassed > restTargetSec) {
      void playRestOvertimeAlert();
    }
    prevRestElapsedRef.current = timePassed;
  }, [phase, timePassed, restTargetSec]);

  const persistAndEndExercise = useCallback(async (): Promise<boolean> => {
    const exId = exerciseIdRef.current;
    if (!exId) return false;
    const ph = phaseRef.current;
    const previousLog = setsRef.current;
    const elapsed = Math.max(0, Math.floor((Date.now() - phaseStartedAtRef.current) / 1000));
    const optimisticEntries: Record<string, unknown>[] = [];
    if (ph === PHASES.SET && elapsed > 0) {
      optimisticEntries.push(buildSetEntryPayload(elapsed));
    } else if (ph === PHASES.REST) {
      optimisticEntries.push({ type: "rest", rest_seconds: elapsed });
    }
    if (ph !== PHASES.IDLE) {
      optimisticEntries.push({
        type: "mark",
        mark_type: "end",
        datetime: new Date().toISOString(),
      });
      appendOptimisticEntries(optimisticEntries);
      setPhase(PHASES.IDLE);
      setTimePassed(0);
      prevPhaseRef.current = PHASES.IDLE;
    }
    try {
      let latestLog: Record<string, unknown>[] = setsRef.current;
      if (ph === PHASES.SET) {
        if (elapsed > 0) {
          const created = await postTimelineEntry(exId, buildSetEntryPayload(elapsed), {
            silent: true,
            skipApply: true,
          });
          latestLog = created.allSets;
        }
      } else if (ph === PHASES.REST) {
        const created = await postTimelineEntry(
          exId,
          { type: "rest", rest_seconds: elapsed },
          { silent: true, skipApply: true },
        );
        latestLog = created.allSets;
      }
      if (ph !== PHASES.IDLE) {
        const created = await postTimelineEntry(exId, {
          type: "mark",
          mark_type: "end",
          datetime: new Date().toISOString(),
        }, { silent: true });
        latestLog = created.allSets;
        emitExerciseUpdated({ exerciseId: exId, log: latestLog });
      }
      return true;
    } catch (e) {
      applyOptimisticLog(previousLog);
      setPhase(ph);
      setTimePassed(elapsed);
      phaseStartedAtRef.current = Date.now() - elapsed * 1000;
      prevPhaseRef.current = ph;
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось сохранить");
      return false;
    }
  }, [appendOptimisticEntries, applyOptimisticLog, buildSetEntryPayload, postTimelineEntry]);

  const stopExercise = useCallback(async () => {
    const ok = await persistAndEndExercise();
    if (!ok) return;
  }, [persistAndEndExercise]);

  useEffect(() => {
    registerStopExercise?.(stopExercise);
    return () => registerStopExercise?.(() => {});
  }, [registerStopExercise, stopExercise]);

  const startFirstSet = useCallback(async () => {
    const exId = exerciseIdRef.current;
    if (!exId) return;
    const startedAt = new Date().toISOString();
    const previousLog = appendOptimisticEntry({
      type: "mark",
      mark_type: "start",
      datetime: startedAt,
    });
    setPhase(PHASES.SET);
    setTimePassed(0);
    phaseStartedAtRef.current = Date.now();
    prevPhaseRef.current = PHASES.SET;
    try {
      await postTimelineEntry(exId, {
        type: "mark",
        mark_type: "start",
        datetime: startedAt,
      });
    } catch (e) {
      applyOptimisticLog(previousLog);
      setPhase(PHASES.IDLE);
      setTimePassed(0);
      phaseStartedAtRef.current = Date.now();
      prevPhaseRef.current = PHASES.IDLE;
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось начать упражнение");
    }
  }, [appendOptimisticEntry, applyOptimisticLog, postTimelineEntry]);

  const finishSet = useCallback(async () => {
    const exId = exerciseIdRef.current;
    if (!exId || phaseRef.current !== PHASES.SET) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - phaseStartedAtRef.current) / 1000));
    const setPayload = buildSetEntryPayload(elapsed);
    const previousLog = appendOptimisticEntry(setPayload);
    setPhase(PHASES.REST);
    setTimePassed(0);
    phaseStartedAtRef.current = Date.now();
    prevPhaseRef.current = PHASES.REST;
    try {
      const created = await postTimelineEntry(exId, setPayload);
      if (editCompletedSetOnFinish && created.setIdx >= 0 && created.initial) {
        setCompletedSetEditorPayload({ setIdx: created.setIdx, initial: created.initial });
        setCompletedSetEditorVisible(true);
      }
    } catch (e) {
      applyOptimisticLog(previousLog);
      setPhase(PHASES.SET);
      setTimePassed(elapsed);
      phaseStartedAtRef.current = Date.now() - elapsed * 1000;
      prevPhaseRef.current = PHASES.SET;
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось сохранить подход");
    }
  }, [
    appendOptimisticEntry,
    applyOptimisticLog,
    buildSetEntryPayload,
    editCompletedSetOnFinish,
    postTimelineEntry,
  ]);

  const finishRest = useCallback(async () => {
    const exId = exerciseIdRef.current;
    if (!exId || phaseRef.current !== PHASES.REST) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - phaseStartedAtRef.current) / 1000));
    const restPayload = { type: "rest", rest_seconds: elapsed };
    const previousLog = appendOptimisticEntry(restPayload);
    setPhase(PHASES.SET);
    setTimePassed(0);
    phaseStartedAtRef.current = Date.now();
    prevPhaseRef.current = PHASES.SET;
    try {
      await postTimelineEntry(exId, restPayload);
    } catch (e) {
      applyOptimisticLog(previousLog);
      setPhase(PHASES.REST);
      setTimePassed(elapsed);
      phaseStartedAtRef.current = Date.now() - elapsed * 1000;
      prevPhaseRef.current = PHASES.REST;
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось сохранить отдых");
    }
  }, [appendOptimisticEntry, applyOptimisticLog, postTimelineEntry]);

  const endExerciseEarly = useCallback(async () => {
    const ok = await persistAndEndExercise();
    if (!ok) return;
  }, [persistAndEndExercise]);

  const savePlannedSets = useCallback(
    async (raw?: string | number) => {
      const exId = exerciseIdRef.current;
      if (!exId) return false;

      let plannedValue: number | null;
      if (typeof raw === "number") {
        if (!Number.isFinite(raw) || raw < 1) return false;
        plannedValue = raw;
      } else {
        const trimmed = (raw !== undefined ? raw : plannedSetsInput).trim();
        if (trimmed === "") {
          plannedValue = null;
        } else {
          const n = parseInt(trimmed, 10);
          if (!Number.isFinite(n) || n < 1) return false;
          plannedValue = n;
        }
      }

      const r = await apiFetch(`/api/v1/exercises_in_workout/${exId}/planned_sets`, {
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
      setPlannedSetsInput(nextPlanned != null ? String(nextPlanned) : "");
      setExerciseData({ planned_sets: nextPlanned });
      emitExerciseUpdated({ exerciseId: exId, plannedSets: nextPlanned });
      return true;
    },
    [plannedSetsInput],
  );

  const timerProgress = getExerciseSetProgress(sets);
  const doneSetsCount = timerProgress.loggedSetCount;
  const loggedSetCount = timerProgress.loggedSetCount;
  const totalPlanned = exerciseData.planned_sets;
  const hasExplicitPlan = totalPlanned != null && totalPlanned > 0;
  const planCountColor = getPlanProgressColor(doneSetsCount, totalPlanned, catalogUi);
  const nextSetIndex = loggedSetCount + 1;

  const centerDisplaySec = phase === PHASES.REST ? restTargetSec - timePassed : timePassed;
  const restOvertime = phase === PHASES.REST && timePassed > restTargetSec;
  const restOvertimeRed = REST_OVERTIME_RED_TIMER && restOvertime;
  const timerAccentColor = restOvertimeRed ? colors.error : catalogUi.accent;
  const timerAccentSoft = restOvertimeRed ? colors.dangerBg : catalogUi.accentSoft;
  const ringProgress =
    phase === PHASES.REST
      ? restTargetSec > 0
        ? Math.min(1, timePassed / restTargetSec)
        : 0
      : phase === PHASES.SET
        ? 1
        : 0;

  const openPlanModal = () => {
    setPlanDraft((plannedSetsInput || "").trim() || (totalPlanned != null ? String(totalPlanned) : "3"));
    setPlanModalOpen(true);
  };

  const openRestModal = () => {
    setRestSelectedPresets(new Set());
    setRestMinutesDraft(restMinutes);
    setRestSecondsDraft(restSeconds);
    setRestModalOpen(true);
  };

  const writeRestDurationDraft = (totalSec: number) => {
    const safeTotal = Math.max(0, totalSec);
    setRestMinutesDraft(String(Math.floor(safeTotal / 60)));
    setRestSecondsDraft(String(safeTotal % 60));
  };

  const sumRestPresets = (presets: Set<number>) => {
    let total = 0;
    for (const presetSec of presets) total += presetSec;
    return total;
  };

  const applyRestDurationDraft = (nextMinutes: string, nextSeconds: string) => {
    const safeMinutes = normalizeDurationPart(nextMinutes);
    const safeSeconds = normalizeDurationPart(nextSeconds, 59);
    setRestMinutesDraft(safeMinutes.display);
    setRestSecondsDraft(safeSeconds.display);
    setRestSelectedPresets(new Set());
  };

  const toggleRestPreset = (sec: number) => {
    const nextSelected = new Set(restSelectedPresets);
    if (nextSelected.has(sec)) nextSelected.delete(sec);
    else nextSelected.add(sec);
    setRestSelectedPresets(nextSelected);
    writeRestDurationDraft(sumRestPresets(nextSelected));
  };

  const saveRestModal = () => {
    applyRestDuration(restMinutesDraft, restSecondsDraft);
    setRestModalOpen(false);
  };

  const ringDiameter = fillViewport ? compactRingSize : 260;
  const STROKE = 12;
  const R = (ringDiameter - STROKE) / 2;
  const C = ringDiameter / 2;
  const circ = 2 * Math.PI * R;
  const dashOffset = circ * (1 - ringProgress);
  const ringInnerSize = ringDiameter * (200 / 260);

  if (!exerciseId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Выберите упражнение</Text>
      </View>
    );
  }

  const timerRing = (
    <View
      style={[
        styles.ringWrap,
        fillViewport && styles.ringWrapCompact,
        fillViewport ? { width: ringDiameter, height: ringDiameter } : null,
      ]}
    >
      <Svg width={ringDiameter} height={ringDiameter} style={styles.svg}>
        <Circle cx={C} cy={C} r={R} stroke={timerAccentSoft} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={C}
          cy={C}
          r={R}
          stroke={timerAccentColor}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${C}, ${C})`}
        />
      </Svg>
      <View
        style={[
          styles.ringInner,
          fillViewport ? { width: ringInnerSize, height: ringInnerSize } : null,
        ]}
        pointerEvents="none"
      >
        {phase === PHASES.REST ? (
          <>
            <Text style={[styles.timeBig, { color: timerAccentColor }]}>
              {formatTime(timePassed)}
            </Text>
            <Text style={[styles.timeElapsed, restOvertimeRed && { color: colors.error }]}>
              {formatTime(centerDisplaySec)}
            </Text>
          </>
        ) : (
          <Text style={[styles.timeBig, phase !== PHASES.IDLE && { color: timerAccentColor }]}>
            {formatTime(centerDisplaySec)}
          </Text>
        )}
        <Text style={[styles.timeSub, restOvertimeRed && { color: colors.error }]}>
          {phase === PHASES.REST
            ? restOvertime
              ? "Превышен отдых"
              : "Идёт отдых"
            : phase === PHASES.SET
              ? "Идёт подход"
              : "Готов к старту"}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.content, fillViewport && styles.contentFill]}>
      {showView1OnTimer ? (
        <ExerciseView1Panel
          exerciseId={exerciseId}
          contentInsetHorizontal={contentInsetHorizontal}
          liveLog={sets}
          livePlannedSetsJson={plannedSetsJson}
          initialLog={preloadedLog ?? undefined}
          initialPlannedSets={preloadedPlannedSets}
          initialPlannedSetsJson={preloadedPlannedSetsJson ?? undefined}
          nextSetDraft={nextSetDraft}
          timerPhase={phase}
          showSetTextFields={showSetTextFields}
          onEditNextSetDraft={openNextSetDraftEditor}
          liveTimerElapsedSec={timePassed}
        />
      ) : null}

      <View style={[styles.infoCard, fillViewport && styles.infoCardCompact]}>
        <View style={styles.infoCol}>
          <View style={styles.infoIconCircle}>
            <MaterialCommunityIcons name="calendar" size={18} color={catalogUi.accent} />
          </View>
          <Text style={styles.infoLabel}>План</Text>
          <Pressable onPress={openPlanModal} hitSlop={8}>
            {hasExplicitPlan && totalPlanned != null ? (
              <Text style={[styles.infoValue, { color: planCountColor }]}>
                {`${totalPlanned} ${setsWordRu(totalPlanned)}`}
              </Text>
            ) : (
              <Text style={[styles.infoValue, styles.infoValueAction]}>Задать</Text>
            )}
          </Pressable>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoCol}>
          <View style={styles.infoIconCircle}>
            <MaterialCommunityIcons name="check-circle" size={18} color={catalogUi.accent} />
          </View>
          <Text style={styles.infoLabel}>Выполнено</Text>
          <Text style={[styles.infoValue, hasExplicitPlan && totalPlanned != null && { color: planCountColor }]}>
            {hasExplicitPlan && totalPlanned != null
              ? `${doneSetsCount} из ${totalPlanned}`
              : doneSetsCount}
          </Text>
        </View>
        <View style={styles.infoDivider} />
        <Pressable style={styles.infoCol} onPress={openRestModal} hitSlop={8}>
          <View style={styles.infoIconCircle}>
            <MaterialCommunityIcons name="timer-sand" size={18} color={catalogUi.accent} />
          </View>
          <Text style={styles.infoLabel}>Отдых</Text>
          <Text style={styles.infoValue} {...textBreakProps}>
            {formatTime(restTargetSec)}
          </Text>
        </Pressable>
      </View>

      {fillViewport ? (
        <View style={styles.ringFlexSlot} onLayout={handleRingSlotLayout}>
          {timerRing}
        </View>
      ) : (
        timerRing
      )}

      <View style={fillViewport ? styles.compactBottom : undefined}>
      <View style={[styles.timerActions, fillViewport && styles.timerActionsCompact]}>
        {phase === PHASES.IDLE ? (
          <Pressable style={styles.btnStart} onPress={() => void startFirstSet()}>
            <MaterialCommunityIcons name="dumbbell" size={20} color="#FFFFFF" />
            <Text style={styles.btnStartText}>Начать подход</Text>
          </Pressable>
        ) : null}

        {phase === PHASES.SET ? (
          <View style={styles.dualBtnRow}>
            <Pressable style={styles.btnPrimaryHalf} onPress={() => void finishSet()}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
              <Text style={styles.btnHalfText} numberOfLines={2}>
                Завершить подход
              </Text>
            </Pressable>
            <Pressable style={styles.btnOutlineHalf} onPress={() => void endExerciseEarly()}>
              <MaterialCommunityIcons name="stop-circle" size={18} color={catalogUi.accent} />
              <Text style={styles.btnHalfOutlineText} numberOfLines={2}>
                Завершить упражнение
              </Text>
            </Pressable>
          </View>
        ) : null}

        {phase === PHASES.REST ? (
          <View style={styles.dualBtnRow}>
            <Pressable style={styles.btnPrimaryHalf} onPress={() => void finishRest()}>
              <MaterialCommunityIcons name="timer-sand" size={18} color="#FFFFFF" />
              <Text style={styles.btnHalfText} numberOfLines={2}>
                Закончить отдых
              </Text>
            </Pressable>
            <Pressable style={styles.btnOutlineHalf} onPress={() => void endExerciseEarly()}>
              <MaterialCommunityIcons name="stop-circle" size={18} color={catalogUi.accent} />
              <Text style={styles.btnHalfOutlineText} numberOfLines={2}>
                Завершить упражнение
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Pressable
        style={[styles.nextSetCardWrap, fillViewport && styles.nextSetCardWrapCompact]}
        onPress={openNextSetDraftEditor}
        accessibilityRole="button"
        accessibilityLabel="Редактировать следующий подход"
      >
        <View style={[styles.infoCard, styles.infoCardWithBorderLabel]}>
          <View style={styles.infoCol}>
            <View style={styles.infoIconCircle}>
              <MaterialCommunityIcons name="counter" size={18} color={catalogUi.accent} />
            </View>
            <Text style={styles.infoLabel}>Подход</Text>
            <Text style={styles.infoValue}>{nextSetIndex}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <View style={styles.infoIconCircle}>
              <MaterialCommunityIcons name="weight" size={18} color={catalogUi.accent} />
            </View>
            <Text style={styles.infoLabel}>Вес</Text>
            <Text style={styles.infoValue} numberOfLines={2}>
              {formatNextSetDraftWeightLabel(nextSetDraft)}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <View style={styles.infoIconCircle}>
              <MaterialCommunityIcons name="repeat" size={18} color={catalogUi.accent} />
            </View>
            <Text style={styles.infoLabel}>Повт.</Text>
            <Text style={styles.infoValue} numberOfLines={2}>
              {formatNextSetDraftRepsLabel(nextSetDraft)}
            </Text>
          </View>
        </View>
        <View style={styles.nextSetBorderLabel} pointerEvents="none">
          <Text style={styles.nextSetBorderLabelText}>
            {phase === PHASES.SET ? "Текущий подход" : "Следующий подход"}
          </Text>
        </View>
      </Pressable>
      </View>

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

      <Modal
        visible={restModalOpen}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setRestModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRestModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Время отдыха</Text>
            <Text style={styles.modalLab}>Быстрый выбор</Text>
            <View style={styles.modalPresetWrap}>
              {REST_PRESETS_SEC.map((sec) => {
                const active = restSelectedPresets.has(sec);
                return (
                  <Pressable
                    key={sec}
                    style={[styles.modalPresetChip, active && styles.modalPresetChipActive]}
                    onPress={() => toggleRestPreset(sec)}
                  >
                    <Text style={[styles.modalPresetChipText, active && styles.modalPresetChipTextActive]}>
                      {formatTime(sec)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.paramRow}>
              <View style={styles.paramCell}>
                <Text style={styles.modalLab}>Минуты</Text>
                <TextInput
                  style={styles.modalInput}
                  value={restMinutesDraft}
                  onChangeText={(value) => applyRestDurationDraft(value, restSecondsDraft)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={catalogUi.textPlaceholder}
                />
              </View>
              <View style={styles.paramCell}>
                <Text style={styles.modalLab}>Секунды</Text>
                <TextInput
                  style={styles.modalInput}
                  value={restSecondsDraft}
                  onChangeText={(value) => applyRestDurationDraft(restMinutesDraft, value)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={catalogUi.textPlaceholder}
                />
              </View>
            </View>
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setRestModalOpen(false)}>
                <Text style={styles.modalCancel}>Отмена</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={saveRestModal}>
                <Text style={styles.modalSaveText}>Сохранить</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {exerciseId ? (
        <SetEditorModal
          visible={nextSetDraftEditorVisible}
          onClose={() => setNextSetDraftEditorVisible(false)}
          exerciseId={exerciseId}
          setIdx={null}
          initial={nextSetDraft}
          mode="draft"
          presentation="center"
          primaryLabel="Готово"
          showSetTextFields={showSetTextFields}
          onDraftSave={(entry) => onNextSetDraftChange(logEntryToNextSetDraft(entry))}
        />
      ) : null}

      {completedSetEditorPayload && exerciseId ? (
        <SetEditorModal
          visible={completedSetEditorVisible}
          onClose={() => setCompletedSetEditorVisible(false)}
          onDismiss={() => setCompletedSetEditorPayload(null)}
          exerciseId={exerciseId}
          setIdx={completedSetEditorPayload.setIdx}
          initial={completedSetEditorPayload.initial}
          mode="edit"
          presentation="center"
          primaryLabel="Готово"
          showSetTextFields={showSetTextFields}
          onDisableAutoEdit={onDisableCompletedSetAutoEdit}
        />
      ) : null}
    </View>
  );
}

const createStyles = (catalogUi: ReturnType<typeof useCatalogUi>, hPad: number) => {
  const primaryFill = catalogUi.accent;

  const btnPressableCenter = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 12,
  };

  const btnTextCenter = {
    textAlign: "center" as const,
    ...(Platform.OS === "android"
      ? ({ includeFontPadding: false, textAlignVertical: "center" } as const)
      : {}),
  };

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: catalogUi.pageBg },
    content: { backgroundColor: catalogUi.pageBg },
    contentFill: {
      flex: 1,
      minHeight: 0,
    },
    center: { padding: 24, alignItems: "center" },
    muted: { fontFamily: fonts.regular, color: catalogUi.textMuted },
    nextSetCardWrap: {
      position: "relative",
      marginHorizontal: hPad,
      marginTop: 24,
    },
    nextSetCardWrapCompact: {
      marginTop: 10,
    },
    nextSetBorderLabel: {
      position: "absolute",
      top: 0,
      left: 10,
      zIndex: 1,
      transform: [{ translateY: -8 }],
      paddingHorizontal: 6,
    },
    nextSetBorderLabelText: {
      ...type.caption,
      fontFamily: fonts.semiBold,
      color: catalogUi.textMuted,
    },
    infoCard: {
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
    infoCardCompact: {
      marginTop: 8,
      flexShrink: 0,
    },
    infoCardWithBorderLabel: {
      marginHorizontal: 0,
      marginTop: 0,
    },
    infoCol: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
    infoIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: catalogUi.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    infoDivider: { width: 1, height: 54, backgroundColor: catalogUi.border, alignSelf: "center" },
    infoLabel: {
      ...type.caption,
      fontFamily: fonts.regular,
      color: catalogUi.textMuted,
      marginTop: 6,
    },
    infoValue: {
      ...type.statTileValue,
      fontFamily: fonts.bold,
      color: catalogUi.text,
      marginTop: 4,
      textAlign: "center",
    },
    infoValueAction: {
      color: catalogUi.accent,
    },
    infoInput: {
      ...type.statTileValue,
      fontFamily: fonts.bold,
      color: catalogUi.text,
      marginTop: 4,
      minWidth: 48,
      width: "100%",
      textAlign: "center",
      paddingVertical: 0,
      paddingHorizontal: 4,
    },
    ringWrap: {
      alignSelf: "center",
      marginTop: 24,
      width: 260,
      height: 260,
      alignItems: "center",
      justifyContent: "center",
    },
    ringWrapCompact: {
      marginTop: 0,
    },
    ringFlexSlot: {
      flex: 1,
      minHeight: 0,
      justifyContent: "center",
      alignItems: "center",
    },
    compactBottom: {
      flexShrink: 0,
    },
    svg: { position: "absolute" },
    ringInner: { alignItems: "center", justifyContent: "center", width: 200, height: 200 },
    timeBig: { ...type.display, color: catalogUi.text, letterSpacing: -1 },
    timeSub: {
      ...type.body,
      color: catalogUi.textMuted,
      textAlign: "center",
      marginTop: 8,
      paddingHorizontal: 12,
    },
    timeElapsed: {
      fontFamily: fonts.semiBold,
      fontSize: 16,
      lineHeight: 20,
      color: catalogUi.textMuted,
      textAlign: "center",
      marginTop: 2,
      letterSpacing: -0.3,
    },
    paramRow: {
      flexDirection: "row",
      gap: 10,
    },
    paramCell: {
      flex: 1,
      minWidth: 0,
    },
    timerActions: {
      marginHorizontal: hPad,
      marginTop: 16,
    },
    timerActionsCompact: {
      marginTop: 8,
    },
    btnStart: {
      backgroundColor: primaryFill,
      borderRadius: 16,
      ...btnPressableCenter,
    },
    btnStartText: { ...type.button, color: "#FFFFFF", ...btnTextCenter, flexShrink: 1 },
    dualBtnRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "stretch",
    },
    btnPrimaryHalf: {
      flex: 1,
      minWidth: 0,
      backgroundColor: primaryFill,
      borderRadius: 16,
      ...btnPressableCenter,
    },
    btnOutlineHalf: {
      flex: 1,
      minWidth: 0,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: catalogUi.accent,
      backgroundColor: catalogUi.cardBg,
      ...btnPressableCenter,
    },
    btnHalfText: {
      ...type.button,
      fontSize: 13,
      lineHeight: 16,
      color: "#FFFFFF",
      ...btnTextCenter,
      flexShrink: 1,
    },
    btnHalfOutlineText: {
      ...type.button,
      fontSize: 13,
      lineHeight: 16,
      color: catalogUi.accent,
      ...btnTextCenter,
      flexShrink: 1,
    },
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
    modalPresetWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    modalPresetChip: {
      minWidth: "30%",
      flexGrow: 1,
      minHeight: 40,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 12,
      backgroundColor: catalogUi.pageBg,
      alignItems: "center",
      justifyContent: "center",
    },
    modalPresetChipActive: {
      backgroundColor: catalogUi.accentSoft,
    },
    modalPresetChipText: {
      ...type.chip,
      color: catalogUi.text,
      textAlign: "center",
    },
    modalPresetChipTextActive: {
      color: catalogUi.accent,
    },
    modalBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 8 },
    modalCancel: {
      ...type.buttonGhost,
      color: catalogUi.textMuted,
      paddingVertical: 10,
      paddingHorizontal: 8,
      ...btnTextCenter,
    },
    modalSave: {
      backgroundColor: primaryFill,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    modalSaveText: { ...type.button, color: "#FFFFFF", ...btnTextCenter },
  });
};
