import type { WorkoutDetail } from "@/domain/workout/types";
import { emit } from "@/utils/eventBus";

export const WORKOUT_DETAIL_UPDATED_EVENT = "workout:detail-updated";

export type WorkoutDetailUpdatedPayload = {
  workoutId: number;
  detail: WorkoutDetail;
};

export function emitWorkoutDetailUpdated(detail: WorkoutDetail): void {
  const workoutId = Number(detail.id);
  if (!Number.isFinite(workoutId) || workoutId <= 0) return;
  emit(WORKOUT_DETAIL_UPDATED_EVENT, {
    workoutId,
    detail,
  } satisfies WorkoutDetailUpdatedPayload);
}

export function parseWorkoutDetailUpdatedPayload(
  payload: unknown,
): WorkoutDetailUpdatedPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as WorkoutDetailUpdatedPayload;
  if (typeof row.workoutId !== "number" || !Number.isFinite(row.workoutId)) return null;
  if (!row.detail || typeof row.detail !== "object") return null;
  return row;
}

export function workoutDetailIdsMatch(a: number, b: number | string): boolean {
  return a === Number(b);
}
