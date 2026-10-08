/** Длительность тренировки: START первого упражнения → END последнего (или «сейчас», если ещё идёт). */

export type WorkoutExerciseDurationSource = {
  order_index?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  sets_json?: TimelineMarkSource[] | null;
  timeline?: TimelineMarkSource[] | null;
};

type TimelineMarkSource = {
  type?: string;
  mark_type?: "start" | "end";
  datetime?: string | null;
};

export type WorkoutDurationResult = {
  minutes: number | null;
  isActive: boolean;
};

function parseIsoMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function iterSets(exercise: WorkoutExerciseDurationSource): TimelineMarkSource[] {
  const raw = exercise.sets_json ?? exercise.timeline;
  return Array.isArray(raw) ? raw : [];
}

function exerciseOrderIndex(exercise: WorkoutExerciseDurationSource, fallback: number): number {
  return typeof exercise.order_index === "number" && Number.isFinite(exercise.order_index)
    ? exercise.order_index
    : fallback;
}

export function exerciseStartMs(exercise: WorkoutExerciseDurationSource): number | null {
  for (const item of iterSets(exercise)) {
    if (item.type === "mark" && item.mark_type === "start") {
      const ms = parseIsoMs(item.datetime);
      if (ms != null) return ms;
    }
  }
  return parseIsoMs(exercise.start_time);
}

export function exerciseEndMs(exercise: WorkoutExerciseDurationSource): number | null {
  const items = iterSets(exercise);
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.type === "mark" && item.mark_type === "end") {
      const ms = parseIsoMs(item.datetime);
      if (ms != null) return ms;
    }
  }
  return parseIsoMs(exercise.end_time);
}

export function isExerciseActive(exercise: WorkoutExerciseDurationSource): boolean {
  let openSession = false;
  for (const item of iterSets(exercise)) {
    const markType = item.mark_type;
    if (item.type === "mark" && markType === "start") {
      openSession = true;
    } else if (item.type === "mark" && markType === "end") {
      openSession = false;
    } else if (markType === "start") {
      openSession = true;
    } else if (markType === "end") {
      openSession = false;
    }
  }
  return openSession;
}

export function isWorkoutActive(exercises: WorkoutExerciseDurationSource[]): boolean {
  return exercises.some((exercise) => isExerciseActive(exercise));
}

export function computeWorkoutDuration(
  exercises: WorkoutExerciseDurationSource[],
  nowMs: number = Date.now(),
): WorkoutDurationResult {
  if (!exercises.length) {
    return { minutes: null, isActive: false };
  }

  const sorted = [...exercises]
    .map((exercise, index) => ({ exercise, index }))
    .sort((a, b) => exerciseOrderIndex(a.exercise, a.index) - exerciseOrderIndex(b.exercise, b.index));

  const first = sorted[0]?.exercise;
  const last = sorted[sorted.length - 1]?.exercise;
  if (!first || !last) {
    return { minutes: null, isActive: false };
  }

  const startMs = exerciseStartMs(first);
  if (startMs == null) {
    return { minutes: null, isActive: isWorkoutActive(exercises) };
  }

  const endMs = exerciseEndMs(last);
  const end = endMs ?? nowMs;
  const minutes = Math.max(0, Math.floor((end - startMs) / 60000));

  return { minutes, isActive: isWorkoutActive(exercises) };
}
