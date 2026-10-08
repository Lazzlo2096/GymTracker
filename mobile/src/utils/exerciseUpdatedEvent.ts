import { emit } from "@/utils/eventBus";

export const EXERCISE_UPDATED_EVENT = "exercise:updated";

export type ExerciseUpdatedPayload = {
  exerciseId: number;
  log?: Record<string, unknown>[];
  plannedSets?: number | null;
  plannedSetsJson?: Record<string, unknown>[];
};

export function emitExerciseUpdated(payload: ExerciseUpdatedPayload): void {
  emit(EXERCISE_UPDATED_EVENT, payload);
}

export function parseExerciseUpdatedPayload(payload: unknown): ExerciseUpdatedPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as ExerciseUpdatedPayload;
  if (typeof p.exerciseId !== "number" || !Number.isFinite(p.exerciseId)) return null;
  return p;
}

/** Журнал из ответа POST/PUT/DELETE set API. */
export function exerciseLogFromSetApiResponse(data: unknown): Record<string, unknown>[] | undefined {
  if (!data || typeof data !== "object") return undefined;
  const row = data as Record<string, unknown>;
  if (Array.isArray(row.all_sets)) return row.all_sets as Record<string, unknown>[];
  if (Array.isArray(row.remaining_sets)) return row.remaining_sets as Record<string, unknown>[];
  if (Array.isArray(row.updated_sets)) return row.updated_sets as Record<string, unknown>[];
  return undefined;
}

/** planned_sets_json из ответа planned_set API. */
export function exercisePlannedJsonFromSetApiResponse(
  data: unknown,
): Record<string, unknown>[] | undefined {
  if (!data || typeof data !== "object") return undefined;
  const row = data as Record<string, unknown>;
  if (Array.isArray(row.all_planned_sets)) {
    return row.all_planned_sets as Record<string, unknown>[];
  }
  if (Array.isArray(row.remaining_planned_sets)) {
    return row.remaining_planned_sets as Record<string, unknown>[];
  }
  return undefined;
}

export function emitExerciseUpdatedFromSetApiResponse(
  exerciseId: number,
  data: unknown,
): void {
  const log = exerciseLogFromSetApiResponse(data);
  const plannedSetsJson = exercisePlannedJsonFromSetApiResponse(data);
  emitExerciseUpdated({
    exerciseId,
    ...(log !== undefined ? { log } : {}),
    ...(plannedSetsJson !== undefined ? { plannedSetsJson } : {}),
  });
}

export type ExerciseTimelineSource = "log" | "planned";

/** Применить payload локально; `true` — полный GET не нужен. */
export function applyExerciseUpdatedPayload(
  payload: unknown,
  exerciseId: number | null | undefined,
  handlers: {
    onLog: (log: Record<string, unknown>[], plannedSets?: number | null) => void;
    onPlannedOnly: (plannedSets: number | null) => void;
    onPlannedJson?: (plannedSetsJson: Record<string, unknown>[]) => void;
  },
): boolean {
  const p = parseExerciseUpdatedPayload(payload);
  if (p == null || exerciseId == null || p.exerciseId !== exerciseId) return false;
  if (Array.isArray(p.plannedSetsJson)) {
    handlers.onPlannedJson?.(p.plannedSetsJson);
    return true;
  }
  if (Array.isArray(p.log)) {
    handlers.onLog(p.log, p.plannedSets);
    return true;
  }
  if (p.plannedSets !== undefined) {
    handlers.onPlannedOnly(p.plannedSets);
    return true;
  }
  return false;
}
