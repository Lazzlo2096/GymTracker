import { fmtDuration } from "@/utils/time";
import { parseSetEffortLevel, type SetEffortLevel } from "@/utils/workoutSetEffort";
import {
  entryHasResolvableWeight,
  resolveWeightKg,
  resolveWeightString,
} from "@/domain/weightComposition";

export type ExerciseTimelineEvent = {
  type: "mark" | "set" | "comment" | "rest";
  /** Запись из planned_sets_json (ещё не выполнена). */
  isPlanned?: boolean;
  datetime?: string;
  comment?: string | null;
  mark_type?: "start" | "end";
  weight_kg?: number | null;
  weight?: number | null;
  weight_string?: string | null;
  reps?: number | null;
  reps_string?: string | null;
  set_seconds?: number | null;
  heart_rate_right_after?: number | null;
  rating?: number | null;
  reached_failure?: boolean | null;
  effort_level?: SetEffortLevel | null;
  rest_seconds?: number | null;
  rest?: number | null;
};

export type ExerciseLogEntry = Record<string, unknown>;

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function timelineEventDurationSeconds(event: ExerciseTimelineEvent): number {
  if (event.type === "set") {
    return (
      parseClockLikeToSeconds(event.set_seconds) ??
      parseClockLikeToSeconds((event as Record<string, unknown>).set_time) ??
      0
    );
  }
  if (event.type === "rest") {
    const raw = event.rest_seconds ?? event.rest ?? 0;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Math.max(0, Math.round(raw));
    }
    return parseClockLikeToSeconds(raw) ?? 0;
  }
  return 0;
}

function parseClockLikeToSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const parts = raw.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 1) return Math.round(parts[0]);
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return null;
}

function isSetLikeEntry(item: ExerciseLogEntry): boolean {
  return (
    item.type === "set" ||
    item.reps != null ||
    (typeof item.reps_string === "string" && item.reps_string.trim() !== "") ||
    item.weight != null ||
    item.weight_kg != null ||
    (typeof item.weight_string === "string" && item.weight_string.trim() !== "") ||
    entryHasResolvableWeight(item) ||
    parseSetEffortLevel(item.effort_level) != null ||
    item.set_time != null ||
    item.set_seconds != null
  );
}

export function timelineEventFromLogEntry(item: ExerciseLogEntry): ExerciseTimelineEvent | null {
  if (item.type === "mark" || item.mark_type === "start" || item.mark_type === "end") {
    return {
      type: "mark",
      mark_type: item.mark_type === "end" ? "end" : "start",
      datetime: typeof item.datetime === "string" ? item.datetime : undefined,
      comment: typeof item.comment === "string" ? item.comment : null,
    };
  }

  if (item.type === "comment") {
    return {
      type: "comment",
      datetime: typeof item.datetime === "string" ? item.datetime : undefined,
      comment: typeof item.comment === "string" ? item.comment : null,
    };
  }

  const restRaw = item.rest ?? item.rest_seconds;
  const hasRest = restRaw != null && restRaw !== "";

  if (item.type === "rest" || (hasRest && !isSetLikeEntry(item))) {
    return {
      type: "rest",
      datetime: typeof item.datetime === "string" ? item.datetime : undefined,
      comment: typeof item.comment === "string" ? item.comment : null,
      rest_seconds: optionalNumber(item.rest_seconds) ?? optionalNumber(item.rest),
      rest: optionalNumber(item.rest) ?? optionalNumber(item.rest_seconds),
    };
  }

  if (isSetLikeEntry(item)) {
    const resolvedKg = resolveWeightKg(item);
    const resolvedString = resolveWeightString(item);
    return {
      type: "set",
      datetime: typeof item.datetime === "string" ? item.datetime : undefined,
      comment: typeof item.comment === "string" ? item.comment : null,
      weight_kg: resolvedKg,
      weight: resolvedKg,
      weight_string: resolvedString,
      reps: optionalNumber(item.reps),
      reps_string:
        typeof item.reps_string === "string" && item.reps_string.trim()
          ? item.reps_string.trim()
          : null,
      set_seconds:
        optionalNumber(item.set_seconds) ??
        parseClockLikeToSeconds(item.set_time),
      heart_rate_right_after: optionalNumber(item.heart_rate_right_after),
      rating: optionalNumber(item.rating),
      reached_failure:
        typeof item.reached_failure === "boolean" ? item.reached_failure : null,
      effort_level: parseSetEffortLevel(item.effort_level),
    };
  }

  return null;
}

export function timelineEventFromPlannedEntry(
  item: ExerciseLogEntry,
): ExerciseTimelineEvent | null {
  const entryType = item.type;
  if (entryType === "set" || isSetLikeEntry(item)) {
    const resolvedKg = resolveWeightKg(item);
    const resolvedString = resolveWeightString(item);
    const event: ExerciseTimelineEvent = {
      type: "set",
      isPlanned: true,
      weight_kg: resolvedKg,
      weight: resolvedKg,
      weight_string: resolvedString,
      reps: optionalNumber(item.reps),
      reps_string:
        typeof item.reps_string === "string" && item.reps_string.trim()
          ? item.reps_string.trim()
          : null,
    };
    if (
      event.weight_kg == null &&
      !event.weight_string &&
      event.reps == null &&
      !event.reps_string
    ) {
      return null;
    }
    return event;
  }

  if (entryType === "rest") {
    const restSeconds =
      optionalNumber(item.rest_seconds) ?? optionalNumber(item.rest);
    if (restSeconds == null) return null;
    return {
      type: "rest",
      isPlanned: true,
      rest_seconds: restSeconds,
      rest: restSeconds,
    };
  }

  return null;
}

export function buildExerciseTimelineFromPlannedJson(
  plannedJson: ExerciseLogEntry[],
): ExerciseTimelineEvent[] {
  const planned: ExerciseTimelineEvent[] = [];
  for (const item of plannedJson) {
    if (!item || typeof item !== "object") continue;
    const mapped = timelineEventFromPlannedEntry(item);
    if (mapped) planned.push(mapped);
  }
  return planned;
}

export function countSetEntriesInPlannedJson(plannedJson: ExerciseLogEntry[]): number {
  return buildExerciseTimelineFromPlannedJson(plannedJson).filter((e) => e.type === "set")
    .length;
}

export type ActiveTimerPhase = "set" | "rest";

export type ActiveTimerState = {
  phase: ActiveTimerPhase;
  /** Unix ms when the current phase started. */
  phaseStartedAtMs: number;
  /** Seconds elapsed in the current phase (floored). */
  elapsedSec: number;
};

function markDatetimeMs(item: ExerciseLogEntry): number | null {
  const raw = item.datetime ?? item.time;
  return parseIsoDate(raw)?.getTime() ?? null;
}

/** Index of the latest open session start (no matching end mark after it). */
export function findOpenSessionStartIndex(log: ExerciseLogEntry[]): number | null {
  let lastStartIdx: number | null = null;
  for (let i = 0; i < log.length; i += 1) {
    const item = log[i];
    if (!item || typeof item !== "object") continue;
    const event = timelineEventFromLogEntry(item);
    if (!event || event.type !== "mark") continue;
    if (event.mark_type === "start") lastStartIdx = i;
    else if (event.mark_type === "end") lastStartIdx = null;
  }
  return lastStartIdx;
}

/**
 * If sets_json has an open exercise session (start without end), infer timer phase
 * and elapsed time from mark datetime + completed set/rest durations.
 */
export function inferActiveTimerFromLog(
  log: ExerciseLogEntry[],
  nowMs: number = Date.now(),
): ActiveTimerState | null {
  const startIdx = findOpenSessionStartIndex(log);
  if (startIdx == null) return null;

  const startRow = log[startIdx];
  if (!startRow || typeof startRow !== "object") return null;

  const startMs = markDatetimeMs(startRow);
  if (startMs == null) return null;

  let phase: ActiveTimerPhase = "set";
  let accumulatedSec = 0;

  for (let i = startIdx + 1; i < log.length; i += 1) {
    const item = log[i];
    if (!item || typeof item !== "object") continue;
    const event = timelineEventFromLogEntry(item);
    if (!event) continue;
    if (event.type === "mark") continue;
    if (event.type === "set") {
      phase = "rest";
      accumulatedSec += timelineEventDurationSeconds(event);
    } else if (event.type === "rest") {
      phase = "set";
      accumulatedSec += timelineEventDurationSeconds(event);
    }
  }

  const phaseStartedAtMs = startMs + accumulatedSec * 1000;
  const elapsedSec = Math.max(0, Math.floor((nowMs - phaseStartedAtMs) / 1000));

  return { phase, phaseStartedAtMs, elapsedSec };
}

/** Длительность отдыха из события → `м:сс` (вид 1 списка подходов, таймер). */
export function formatRestEventMmSs(event: ExerciseTimelineEvent): string {
  if (event.type !== "rest") return "—";
  return fmtDuration(timelineEventDurationSeconds(event));
}

export function formatRestDurationLabel(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (minutes > 0 && seconds > 0) {
    return `${minutes} мин ${seconds} с`;
  }
  if (minutes > 0) {
    return `${minutes} мин`;
  }
  if (seconds > 0) {
    return `0 мин ${seconds} с`;
  }
  return "0 с";
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Время события журнала на `/exercise/[id]`: сегодня — чч:мм; иначе дата + время; другой год — с годом. */
export function formatTimelineEventTime(datetime?: string, now: Date = new Date()): string {
  if (!datetime) return "--:--";
  const parsed = parseIsoDate(datetime);
  if (!parsed) return "--:--";

  const time = parsed.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isSameCalendarDay(parsed, now)) {
    return time;
  }

  const sameYear = parsed.getFullYear() === now.getFullYear();
  const datePart = parsed.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });

  return `${datePart}, ${time}`;
}
