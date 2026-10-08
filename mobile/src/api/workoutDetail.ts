import { apiFetch, parseErrorDetail } from "@/api/client";
import {
  mapWorkoutDetailFromApi,
} from "@/domain/workout/workoutDetailMapper";
import type { WorkoutDetail, WorkoutDetailApiResponse } from "@/domain/workout/types";
import type { GuardedFocusLoadResult } from "@/hooks/useGuardedFocusLoad";

async function loadCatalogNames(
  apiWorkout: WorkoutDetailApiResponse,
  cache: Map<number, string>,
): Promise<void> {
  const rawExercises = Array.isArray(apiWorkout.exercises)
    ? apiWorkout.exercises
    : Array.isArray(apiWorkout.timeline)
      ? apiWorkout.timeline
      : [];
  const catalogIds = Array.from(
    new Set(
      rawExercises
        .map((ex) =>
          ex && typeof ex === "object" && "exercise_in_catalog_id" in ex
            ? Number((ex as { exercise_in_catalog_id?: unknown }).exercise_in_catalog_id)
            : NaN,
        )
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
  const missingIds = catalogIds.filter((cid) => !cache.has(cid));
  if (missingIds.length === 0) return;

  const results = await Promise.all(
    missingIds.map(async (cid) => {
      try {
        const r = await apiFetch(`/api/v1/exercises_in_catalog/${cid}`);
        if (!r.ok) return null;
        const c = (await r.json()) as { id?: unknown; name?: unknown };
        const name = typeof c?.name === "string" ? c.name.trim() : "";
        return name ? ({ id: cid, name } as const) : null;
      } catch {
        return null;
      }
    }),
  );
  for (const row of results) {
    if (row) cache.set(row.id, row.name);
  }
}

/** Единая точка загрузки детали тренировки с API → domain `WorkoutDetail`. */
export async function fetchWorkoutDetailById(
  workoutId: number,
  catalogNameCache: Map<number, string> = new Map(),
): Promise<GuardedFocusLoadResult<WorkoutDetail>> {
  if (!Number.isFinite(workoutId) || workoutId <= 0) {
    return { kind: "error", message: "Некорректный id тренировки" };
  }

  const response = await apiFetch(`/api/v1/workouts/${workoutId}`);
  const payload = await response.json().catch(() => ({}));
  if (response.status === 404) {
    return { kind: "not_found" };
  }
  if (!response.ok) {
    return {
      kind: "error",
      message: parseErrorDetail(payload),
    };
  }

  const apiWorkout = payload as WorkoutDetailApiResponse;
  await loadCatalogNames(apiWorkout, catalogNameCache);
  return {
    kind: "success",
    data: mapWorkoutDetailFromApi(apiWorkout, catalogNameCache),
  };
}

/** Разбор тела PATCH/POST workout в domain-модель. */
export async function mapWorkoutDetailFromApiResponse(
  payload: unknown,
  catalogNameCache: Map<number, string> = new Map(),
): Promise<WorkoutDetail | null> {
  if (!payload || typeof payload !== "object") return null;
  const apiWorkout = payload as WorkoutDetailApiResponse;
  await loadCatalogNames(apiWorkout, catalogNameCache);
  return mapWorkoutDetailFromApi(apiWorkout, catalogNameCache);
}
