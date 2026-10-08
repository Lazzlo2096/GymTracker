import { apiFetch, parseErrorDetail } from "@/api/client";

/** GET /api/v1/exercises_in_workout/{id} — одна запись упражнения в тренировке. */
export async function fetchExerciseInWorkout(
  exerciseInWorkoutId: number,
): Promise<Record<string, unknown>> {
  const r = await apiFetch(`/api/v1/exercises_in_workout/${exerciseInWorkoutId}`);
  if (!r.ok) {
    throw new Error(`Ошибка ${r.status}`);
  }
  const data = await r.json();
  if (!data || typeof data !== "object") {
    throw new Error("Пустой ответ");
  }
  return data as Record<string, unknown>;
}

export function workoutIdFromExerciseRow(ex: Record<string, unknown>): number | null {
  const raw = ex.workout_id ?? ex.workout;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object" && "id" in raw) {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
  }
  return null;
}

export function catalogIdFromExerciseRow(ex: Record<string, unknown>): number | null {
  const raw = ex.exercise_in_catalog_id ?? ex.exercise;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object" && "id" in raw) {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
  }
  return null;
}

export function plannedSetsFromExerciseRow(ex: Record<string, unknown>): number | null {
  const ps = ex.planned_sets_count ?? ex.planned_sets;
  if (typeof ps === "number" && Number.isFinite(ps) && ps > 0) return Math.round(ps);
  return null;
}

/** Запланированный таймлайн (set/rest) из planned_sets_json. */
export function plannedSetsJsonFromExerciseRow(
  ex: Record<string, unknown>,
): Record<string, unknown>[] {
  if (Array.isArray(ex.planned_sets_json)) {
    return ex.planned_sets_json as Record<string, unknown>[];
  }
  return [];
}

/** Журнал упражнения (sets / timeline / sets_json) из ответа API. */
export function exerciseLogFromRow(ex: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(ex.sets)) return ex.sets as Record<string, unknown>[];
  if (Array.isArray(ex.timeline)) return ex.timeline as Record<string, unknown>[];
  if (Array.isArray(ex.sets_json)) return ex.sets_json as Record<string, unknown>[];
  return [];
}

export type PreloadedExerciseSnapshot = {
  log: Record<string, unknown>[];
  plannedSets: number | null;
  plannedSetsJson: Record<string, unknown>[];
  row: Record<string, unknown>;
};

export function buildReplaceExerciseCatalogHref(
  exerciseInWorkoutId: number,
  options?: { seedCatalogId?: number | null; returnTo?: string },
): string {
  const qs = new URLSearchParams({
    replaceExerciseInWorkout: String(exerciseInWorkoutId),
  });
  const seed = options?.seedCatalogId;
  if (seed != null && Number.isFinite(seed) && seed > 0) {
    qs.set("seedCatalogId", String(seed));
  }
  if (options?.returnTo?.startsWith("/")) {
    qs.set("returnTo", options.returnTo);
  }
  return `/exercise_catalog?${qs.toString()}`;
}

/** PATCH exercise_in_catalog_id — смена упражнения в тренировке без потери журнала. */
export async function replaceExerciseInWorkoutCatalog(
  exerciseInWorkoutId: number,
  catalogId: number,
): Promise<void> {
  const response = await apiFetch(`/api/v1/exercises_in_workout/${exerciseInWorkoutId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exercise_in_catalog_id: catalogId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
}

export function parseExerciseSetsJsonInput(text: string): Record<string, unknown>[] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Вставьте JSON-массив подходов.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Некорректный JSON. Проверьте скобки и кавычки.");
  }

  if (Array.isArray(parsed)) {
    return parsed as Record<string, unknown>[];
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const nested = obj.sets_json ?? obj.timeline ?? obj.sets;
    if (Array.isArray(nested)) {
      return nested as Record<string, unknown>[];
    }
  }

  throw new Error("Ожидается массив записей или объект с полем sets_json / timeline.");
}

/** PATCH sets_json — замена журнала подходов целиком (debug). */
export async function patchExerciseSetsJson(
  exerciseInWorkoutId: number,
  setsJson: Record<string, unknown>[],
): Promise<void> {
  const response = await apiFetch(`/api/v1/exercises_in_workout/${exerciseInWorkoutId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sets_json: setsJson }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
}
