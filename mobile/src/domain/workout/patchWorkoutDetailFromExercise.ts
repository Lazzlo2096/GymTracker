import type { ExerciseUpdatedPayload } from "@/utils/exerciseUpdatedEvent";
import { isExerciseActive } from "@/utils/workoutDuration";
import {
  mapWorkoutExerciseFromApi,
  reaggregateWorkoutDetail,
} from "./workoutDetailMapper";
import type { WorkoutDetail, WorkoutExercise, WorkoutSetApiEntry } from "./types";

/** Локально обновить одно упражнение в детали тренировки из payload exercise:updated. */
export function patchWorkoutDetailFromExerciseUpdate(
  workout: WorkoutDetail,
  payload: ExerciseUpdatedPayload,
  catalogNameById?: Map<number, string>,
): WorkoutDetail | null {
  const exerciseId = String(payload.exerciseId);
  const index = workout.exercises.findIndex((e) => e.id === exerciseId);
  if (index < 0) return null;

  const current = workout.exercises[index];
  const setsJson = Array.isArray(payload.log)
    ? (payload.log as WorkoutSetApiEntry[])
    : current.apiEntry.sets_json;
  const apiEntry = {
    ...current.apiEntry,
    ...(Array.isArray(payload.log) ? { sets_json: setsJson } : {}),
    ...(Array.isArray(payload.plannedSetsJson)
      ? { planned_sets_json: payload.plannedSetsJson as WorkoutSetApiEntry[] }
      : {}),
  };
  apiEntry.is_active = isExerciseActive({
    order_index: apiEntry.order_index,
    sets_json: apiEntry.sets_json,
    start_time: apiEntry.start_time,
    end_time: apiEntry.end_time,
  });

  const mapped = mapWorkoutExerciseFromApi(apiEntry, current.order, catalogNameById);
  const exercises = workout.exercises.slice();
  exercises[index] = mapped.workoutExercise;
  return reaggregateWorkoutDetail(workout, exercises);
}

/** Удалить упражнение из детали без GET. */
export function removeExerciseFromWorkoutDetail(
  workout: WorkoutDetail,
  exerciseId: string,
): WorkoutDetail | null {
  const exercises = workout.exercises.filter((e) => e.id !== exerciseId);
  if (exercises.length === workout.exercises.length) return null;
  return reaggregateWorkoutDetail(workout, exercises);
}

/** Применить полный журнал упражнения из ответа DELETE set API. */
export function patchWorkoutDetailFromExerciseLog(
  workout: WorkoutDetail,
  exerciseId: number,
  log: Record<string, unknown>[],
  catalogNameById?: Map<number, string>,
): WorkoutDetail | null {
  return patchWorkoutDetailFromExerciseUpdate(
    workout,
    { exerciseId, log },
    catalogNameById,
  );
}

export function findWorkoutExercise(
  workout: WorkoutDetail,
  exerciseId: number | string,
): WorkoutExercise | undefined {
  return workout.exercises.find((e) => e.id === String(exerciseId));
}
