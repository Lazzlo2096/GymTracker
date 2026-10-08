import { buildExerciseTimelineFromPlannedJson } from "@/utils/exerciseTimeline";
import { computeWorkoutDuration, isExerciseActive } from "@/utils/workoutDuration";
import type {
  ExerciseSet,
  TimelineEvent,
  WorkoutDetail,
  WorkoutDetailApiResponse,
  WorkoutExercise,
  WorkoutExerciseApiEntry,
  WorkoutSetApiEntry,
} from "./types";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** API отдаёт дату как YYYY-MM-DD — парсим в локальный календарный день без сдвига UTC. */
export function parseWorkoutDateFromApiDayField(isoDay: string): Date {
  const trimmed = isoDay.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) return startOfDay(new Date());
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (![y, mo, day].every((n) => Number.isFinite(n))) return startOfDay(new Date());
  return startOfDay(new Date(y, mo - 1, day));
}

export function formatFullDateFromCalendarDay(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

export function formatDateForApiPatch(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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

function formatClockFromIso(iso: unknown): string | null {
  const d = parseIsoDate(iso);
  if (!d) return null;
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExerciseTimeFallbackFromTimeline(rawTimeline: WorkoutSetApiEntry[]): string | null {
  let total = 0;
  for (const row of rawTimeline) {
    const setSec =
      parseClockLikeToSeconds((row as Record<string, unknown>).set_seconds) ??
      parseClockLikeToSeconds((row as Record<string, unknown>).set_time);
    const restSec = parseClockLikeToSeconds((row as Record<string, unknown>).rest_seconds);
    if (setSec != null) total += setSec;
    if (restSec != null) total += restSec;
  }
  if (total <= 0) return null;
  return formatClock(total);
}

function timelineEventDurationSeconds(event: TimelineEvent): number {
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

/**
 * Подставляет `datetime` для подходов/отдыха без метки времени:
 * от START (или start_time упражнения) + сумма длительностей предыдущих set/rest.
 * Время события — момент его начала (первый подход = START).
 */
function enrichTimelineWithComputedDatetimes(
  timeline: TimelineEvent[],
  exerciseStartTime?: string | null,
): TimelineEvent[] {
  if (!timeline.length) return timeline;

  let anchorMs: number | null = null;
  const startMark = timeline.find(
    (e) => e.type === "mark" && e.mark_type === "start" && e.datetime?.trim(),
  );
  if (startMark?.datetime) {
    const d = parseIsoDate(startMark.datetime);
    if (d) anchorMs = d.getTime();
  }
  if (anchorMs == null && exerciseStartTime) {
    const d = parseIsoDate(exerciseStartTime);
    if (d) anchorMs = d.getTime();
  }

  let offsetSec = 0;

  return timeline.map((event) => {
    const explicit = event.datetime?.trim() ? parseIsoDate(event.datetime) : null;

    if (explicit) {
      if (event.type === "mark" && event.mark_type === "start") {
        anchorMs = explicit.getTime();
        offsetSec = 0;
      } else if (anchorMs != null && (event.type === "set" || event.type === "rest")) {
        offsetSec =
          Math.max(0, Math.round((explicit.getTime() - anchorMs) / 1000)) +
          timelineEventDurationSeconds(event);
      }
      return { ...event, datetime: explicit.toISOString() };
    }

    if (anchorMs == null) {
      return event;
    }

    const inferred = new Date(anchorMs + offsetSec * 1000).toISOString();
    const enriched = { ...event, datetime: inferred };

    if (event.type === "set" || event.type === "rest") {
      offsetSec += timelineEventDurationSeconds(event);
    }

    return enriched;
  });
}

/** Длительность отдыха для таймлайна: явные «мин» / «с». */
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

function maxWeightKgFromApiEntry(exercise: WorkoutExerciseApiEntry): number {
  const rawTimeline = Array.isArray(exercise.sets_json)
    ? exercise.sets_json
    : Array.isArray(exercise.timeline)
      ? exercise.timeline
      : [];
  const setEntries = rawTimeline.filter(
    (item): item is WorkoutSetApiEntry => item?.type === "set",
  );
  let maxWeightKg = 0;
  for (const setEntry of setEntries) {
    const weight = optionalNumber(setEntry.weight_kg) ?? optionalNumber(setEntry.weight);
    maxWeightKg = Math.max(maxWeightKg, weight ?? 0);
  }
  return maxWeightKg;
}

export function mapWorkoutExerciseFromApi(
  exercise: WorkoutExerciseApiEntry,
  fallbackOrder: number,
  catalogNameById?: Map<number, string>,
): {
  workoutExercise: WorkoutExercise;
  setsCount: number;
  tonnageKg: number;
  maxWeightKg: number;
} {
  const rawTimeline = Array.isArray(exercise.sets_json)
    ? exercise.sets_json
    : Array.isArray(exercise.timeline)
      ? exercise.timeline
      : [];

  const order = optionalNumber(exercise.order_index) ?? fallbackOrder;
  const derivedActive = isExerciseActive({
    order_index: order,
    sets_json: rawTimeline,
    start_time: exercise.start_time,
    end_time: exercise.end_time,
  });
  const isActive =
    rawTimeline.length > 0
      ? derivedActive
      : typeof exercise.is_active === "boolean"
        ? exercise.is_active
        : derivedActive;

  const setEntries = rawTimeline.filter(
    (item): item is WorkoutSetApiEntry => item?.type === "set",
  );

  let tonnageKg = 0;
  let maxWeightKg = 0;
  let bestWeight = 0;
  let bestReps = 0;

  const mappedSets: ExerciseSet[] = setEntries.map((setEntry, index) => {
    const weight = optionalNumber(setEntry.weight_kg) ?? optionalNumber(setEntry.weight);
    const reps = optionalNumber(setEntry.reps);
    const validReps = reps ? Math.max(0, Math.round(reps)) : 0;
    const validWeight = weight ?? 0;

    tonnageKg += validWeight * validReps;
    maxWeightKg = Math.max(maxWeightKg, validWeight);

    if (validWeight > bestWeight || (validWeight === bestWeight && validReps > bestReps)) {
      bestWeight = validWeight;
      bestReps = validReps;
    }

    const restSeconds =
      optionalNumber(setEntry.rest_seconds) ?? optionalNumber(setEntry.rest);
    const setComment = typeof setEntry.comment === "string" ? setEntry.comment.trim() : "";

    return {
      id: `${exercise.id}-set-${index + 1}`,
      number: index + 1,
      weightText: [
        weight !== null ? `${formatNumber(weight)} кг` : null,
        typeof setEntry.weight_string === "string" && setEntry.weight_string.trim()
          ? setEntry.weight_string.trim()
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "—",
      reps: validReps,
      repsText:
        [
          validReps > 0 ? `${formatNumber(validReps)} раз` : null,
          typeof setEntry.reps_string === "string" && setEntry.reps_string.trim()
            ? setEntry.reps_string.trim()
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "—",
      restText: restSeconds !== null ? formatClock(Math.round(restSeconds)) : null,
      setNote: setComment || null,
    };
  });

  const firstTimelineWithDatetime = rawTimeline.find(
    (item) => typeof item?.datetime === "string" && item.datetime.trim(),
  );
  const time =
    formatClockFromIso(exercise.start_time) ??
    formatClockFromIso(firstTimelineWithDatetime?.datetime) ??
    formatClockFromIso(exercise.end_time) ??
    formatExerciseTimeFallbackFromTimeline(rawTimeline) ??
    "--:--";

  let title = `Упражнение #${order + 1}`;
  if (typeof exercise.note === "string" && exercise.note.trim()) {
    title = exercise.note.trim();
  } else if (exercise.exercise_in_catalog_id) {
    const cid = Number(exercise.exercise_in_catalog_id);
    const fromCatalog = catalogNameById?.get(cid);
    title = fromCatalog?.trim()
      ? fromCatalog.trim()
      : `Упражнение из каталога #${exercise.exercise_in_catalog_id}`;
  }

  const logTimeline: TimelineEvent[] = enrichTimelineWithComputedDatetimes(
    rawTimeline.map((item) => ({
      type: (item.type as TimelineEvent["type"]) || "set",
      datetime: item.datetime,
      comment: item.comment,
      mark_type: item.mark_type,
      weight_kg: item.weight_kg,
      weight: item.weight,
      weight_string: item.weight_string,
      reps: item.reps,
      reps_string: item.reps_string,
      set_seconds: item.set_seconds,
      heart_rate_right_after: item.heart_rate_right_after,
      rating: item.rating,
      reached_failure: item.reached_failure,
      effort_level: item.effort_level,
      rest_seconds: item.rest_seconds,
      rest: item.rest,
    })),
    exercise.start_time,
  );

  const plannedRaw = Array.isArray(exercise.planned_sets_json)
    ? exercise.planned_sets_json
    : [];
  const plannedTimeline: TimelineEvent[] = buildExerciseTimelineFromPlannedJson(
    plannedRaw as Record<string, unknown>[],
  ).map((event) => ({ ...event, isPlanned: true }));

  const timeline: TimelineEvent[] = [...logTimeline, ...plannedTimeline];

  const workoutExercise: WorkoutExercise = {
    id: String(exercise.id),
    time,
    title,
    order,
    setsCount: mappedSets.length,
    tonnageKg,
    bestSet:
      bestWeight > 0 || bestReps > 0
        ? `${formatNumber(bestWeight)} кг × ${bestReps} повт.`
        : "—",
    icon: "dumbbell",
    sets: mappedSets,
    timeline,
    isActive,
    apiEntry: exercise,
  };

  return {
    workoutExercise,
    setsCount: mappedSets.length,
    tonnageKg,
    maxWeightKg,
  };
}

export function mapWorkoutDetailFromApi(
  apiWorkout: WorkoutDetailApiResponse,
  catalogNameById?: Map<number, string>,
): WorkoutDetail {
  const workoutDateRaw =
    typeof apiWorkout.workout_date === "string" && apiWorkout.workout_date.trim()
      ? apiWorkout.workout_date
      : new Date().toISOString().slice(0, 10);
  const workoutDateAt = parseWorkoutDateFromApiDayField(workoutDateRaw);

  const rawExercises = Array.isArray(apiWorkout.exercises)
    ? apiWorkout.exercises
    : Array.isArray(apiWorkout.timeline)
      ? apiWorkout.timeline
      : [];
  const normalizedExercises = rawExercises.filter(
    (item): item is WorkoutExerciseApiEntry =>
      !!item &&
      typeof item === "object" &&
      "id" in item &&
      (typeof item.id === "number" || typeof item.id === "string"),
  );

  let setsCount = 0;
  let tonnageFromExercises = 0;
  let maxWeightKg = 0;

  const mappedExercises = normalizedExercises.map((exercise, index) => {
    const mapped = mapWorkoutExerciseFromApi(exercise, index + 1, catalogNameById);
    setsCount += mapped.setsCount;
    tonnageFromExercises += mapped.tonnageKg;
    maxWeightKg = Math.max(maxWeightKg, mapped.maxWeightKg);
    return mapped.workoutExercise;
  });

  let durationMinutes = optionalNumber(apiWorkout.duration_minutes);
  const durationFromTimeline = computeWorkoutDuration(normalizedExercises);
  if (durationFromTimeline.minutes != null) {
    durationMinutes = durationFromTimeline.minutes;
  }
  const isActive =
    typeof apiWorkout.is_active === "boolean"
      ? apiWorkout.is_active
      : durationFromTimeline.isActive;

  return {
    id: String(apiWorkout.id),
    dayTitle:
      typeof apiWorkout.day_title === "string" && apiWorkout.day_title.trim()
        ? apiWorkout.day_title.trim()
        : "",
    workoutDateAt,
    workoutDateFullText: formatFullDateFromCalendarDay(workoutDateAt),
    gymName:
      typeof apiWorkout.user_gym?.name === "string" && apiWorkout.user_gym.name.trim()
        ? apiWorkout.user_gym.name.trim()
        : null,
    userGymId:
      typeof apiWorkout.user_gym_id === "number"
        ? apiWorkout.user_gym_id
        : typeof apiWorkout.user_gym?.id === "number"
          ? apiWorkout.user_gym.id
          : null,
    note:
      typeof apiWorkout.note === "string" && apiWorkout.note.trim()
        ? apiWorkout.note.trim()
        : null,
    exercisesCount: mappedExercises.length,
    tonnageKg: optionalNumber(apiWorkout.tonnage_kg) ?? tonnageFromExercises,
    durationMinutes,
    isActive,
    setsCount,
    maxWeightKg,
    exercises: mappedExercises,
  };
}

export function reaggregateWorkoutDetail(
  workout: WorkoutDetail,
  exercises: WorkoutExercise[],
): WorkoutDetail {
  let setsCount = 0;
  let tonnageKg = 0;
  let maxWeightKg = 0;

  for (const exercise of exercises) {
    setsCount += exercise.setsCount;
    tonnageKg += exercise.tonnageKg;
    maxWeightKg = Math.max(maxWeightKg, maxWeightKgFromApiEntry(exercise.apiEntry));
  }

  const apiEntries = exercises.map((exercise) => exercise.apiEntry);
  const durationFromTimeline = computeWorkoutDuration(apiEntries);

  return {
    ...workout,
    exercises,
    exercisesCount: exercises.length,
    setsCount,
    tonnageKg,
    maxWeightKg,
    durationMinutes: durationFromTimeline.minutes,
    isActive: durationFromTimeline.isActive,
  };
}
