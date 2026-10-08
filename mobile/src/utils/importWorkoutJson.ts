import { Platform } from "react-native";
import { File } from "expo-file-system";

import { apiFetch, parseErrorDetail } from "@/api/client";
import { markWorkoutsListStale } from "@/events/workoutsListEvents";
import { emit } from "@/utils/eventBus";

type UserGymBrief = {
  id?: number;
  name?: string | null;
};

type WorkoutImportExercise = {
  exercise_in_catalog_id?: number | null;
  order_index?: number;
  sets_json?: unknown[];
  timeline?: unknown[];
  planned_sets_count?: number | null;
  planned_sets?: number | null;
  note?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type WorkoutImportPayload = {
  workout_date: string;
  day_title?: string | null;
  note?: string | null;
  user_gym_id?: number | null;
  user_gym?: UserGymBrief | null;
  exercises?: WorkoutImportExercise[];
  timeline?: WorkoutImportExercise[];
};

type ImportGymRow = {
  id?: number;
  name?: string;
  address?: string | null;
  is_favorite?: boolean;
  rating?: number | null;
  review_text?: string | null;
  last_visited_at?: string | null;
  tags?: string[];
};

type ImportCatalogRow = {
  id?: number;
  name?: string;
  notes?: string | null;
  muscle_group?: string | null;
  exercise_type?: string | null;
  machine_location?: string | null;
  machine_settings?: Record<string, unknown> | null;
  icon?: string | null;
  user_gym_id?: number | null;
  user_gym?: UserGymBrief | null;
};

type ImportWorkoutRow = {
  workout_date?: string;
  day_title?: string | null;
  note?: string | null;
  user_gym_id?: number | null;
  user_gym?: UserGymBrief | null;
  exercises?: WorkoutImportExercise[];
};

export type DataDumpImportPayload = {
  user_gyms: ImportGymRow[];
  exercises_in_catalog: ImportCatalogRow[];
  workouts: ImportWorkoutRow[];
};

export type ImportJsonResult = {
  kind: "dump" | "single";
  gymsCreated: number;
  catalogCreated: number;
  workoutsCreated: number;
  firstWorkoutId: number | null;
};

type ImportRollbackState = {
  workoutIds: number[];
  catalogIds: number[];
  gymIds: number[];
};

function pickJsonTextOnWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json,text/json";
    input.style.display = "none";

    const finish = (value: string | null) => {
      input.remove();
      resolve(value);
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      void file
        .text()
        .then((text) => finish(text))
        .catch(() => finish(null));
    };

    document.body.appendChild(input);
    input.click();
  });
}

/** Открывает выбор JSON-файла и возвращает его текст или null при отмене. */
export async function pickWorkoutJsonText(): Promise<string | null> {
  if (Platform.OS === "web") {
    return pickJsonTextOnWeb();
  }

  const pickResult = await File.pickFileAsync({
    mimeTypes: ["application/json", "text/json", "text/plain"],
  });
  if (pickResult.canceled) {
    return null;
  }

  return pickResult.result.text();
}

function parseJsonRoot(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Файл не является корректным JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Ожидается JSON-объект.");
  }

  return parsed as Record<string, unknown>;
}

function isFullDataDump(obj: Record<string, unknown>): boolean {
  return (
    obj.export_version != null ||
    Array.isArray(obj.user_gyms) ||
    Array.isArray(obj.exercises_in_catalog)
  );
}

function asObjectArray<T extends object>(value: unknown): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is T => !!item && typeof item === "object");
}

export function parseDataDumpImportJson(text: string): DataDumpImportPayload {
  const obj = parseJsonRoot(text);

  return {
    user_gyms: asObjectArray<ImportGymRow>(obj.user_gyms),
    exercises_in_catalog: asObjectArray<ImportCatalogRow>(obj.exercises_in_catalog),
    workouts: asObjectArray<ImportWorkoutRow>(obj.workouts),
  };
}

/**
 * Из JSON одной тренировки берём только поля для создания.
 * Игнорируются: id, user_id, created_at и вычисляемые поля.
 */
export function parseWorkoutImportJson(text: string): WorkoutImportPayload {
  const obj = parseJsonRoot(text);
  const workoutDateRaw = typeof obj.workout_date === "string" ? obj.workout_date.trim() : "";
  const workoutDate = workoutDateRaw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) {
    throw new Error("В JSON должна быть дата тренировки (workout_date в формате YYYY-MM-DD).");
  }

  const exercisesRaw = obj.exercises ?? obj.timeline;
  const exercises = Array.isArray(exercisesRaw)
    ? exercisesRaw.filter((item): item is WorkoutImportExercise => !!item && typeof item === "object")
    : undefined;

  return {
    workout_date: workoutDate,
    day_title: typeof obj.day_title === "string" ? obj.day_title : obj.day_title == null ? null : undefined,
    note: typeof obj.note === "string" ? obj.note : obj.note == null ? null : undefined,
    user_gym_id: typeof obj.user_gym_id === "number" ? obj.user_gym_id : null,
    user_gym:
      obj.user_gym && typeof obj.user_gym === "object" && !Array.isArray(obj.user_gym)
        ? (obj.user_gym as UserGymBrief)
        : null,
    exercises,
  };
}

async function loadOwnedUserGyms(): Promise<UserGymBrief[]> {
  const response = await apiFetch("/api/v1/user_gyms/");
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    return [];
  }
  return (Array.isArray(data) ? data : []) as UserGymBrief[];
}

type OwnedCatalogRow = { id: number; name: string };

async function loadOwnedCatalog(): Promise<OwnedCatalogRow[]> {
  const response = await apiFetch("/api/v1/exercises_in_catalog/?limit=500");
  const data = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(data)) {
    return [];
  }

  const rows: OwnedCatalogRow[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const id = Number((item as { id?: unknown }).id);
    const name = typeof (item as { name?: unknown }).name === "string"
      ? (item as { name: string }).name.trim()
      : "";
    if (Number.isFinite(id) && id > 0 && name) {
      rows.push({ id, name });
    }
  }
  return rows;
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function resolveUserGymIdFromMaps(
  workout: Pick<WorkoutImportPayload, "user_gym_id" | "user_gym">,
  ownedGyms: UserGymBrief[],
  gymIdMap: Map<number, number>,
): number | null {
  const sourceId =
    typeof workout.user_gym_id === "number"
      ? workout.user_gym_id
      : typeof workout.user_gym?.id === "number"
        ? workout.user_gym.id
        : null;

  if (sourceId != null) {
    const mapped = gymIdMap.get(sourceId);
    if (mapped != null) {
      return mapped;
    }
  }

  const wantedName = workout.user_gym?.name?.trim();
  if (!wantedName) {
    return null;
  }

  const match = ownedGyms.find((gym) => gym.name?.trim() === wantedName);
  return typeof match?.id === "number" ? match.id : null;
}

async function createWorkoutFromImport(
  payload: Pick<WorkoutImportPayload, "workout_date" | "day_title" | "note">,
  userGymId: number | null,
): Promise<number> {
  const response = await apiFetch("/api/v1/workouts/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workout_date: payload.workout_date,
      day_title: payload.day_title ?? null,
      note: payload.note ?? null,
      user_gym_id: userGymId,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(body));
  }

  const id = Number((body as { id?: unknown }).id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Сервер не вернул id тренировки.");
  }
  return id;
}

async function deleteWorkoutQuietly(workoutId: number): Promise<void> {
  await apiFetch(`/api/v1/workouts/${workoutId}`, { method: "DELETE" }).catch(() => {});
}

async function deleteCatalogQuietly(catalogId: number): Promise<void> {
  await apiFetch(`/api/v1/exercises_in_catalog/${catalogId}`, { method: "DELETE" }).catch(
    () => {},
  );
}

async function deleteGymQuietly(gymId: number): Promise<void> {
  await apiFetch(`/api/v1/user_gyms/${gymId}`, { method: "DELETE" }).catch(() => {});
}

async function rollbackImport(state: ImportRollbackState): Promise<void> {
  for (const workoutId of [...state.workoutIds].reverse()) {
    await deleteWorkoutQuietly(workoutId);
  }
  for (const catalogId of [...state.catalogIds].reverse()) {
    await deleteCatalogQuietly(catalogId);
  }
  for (const gymId of [...state.gymIds].reverse()) {
    await deleteGymQuietly(gymId);
  }
}

function exerciseSetsJson(exercise: WorkoutImportExercise): unknown[] {
  if (Array.isArray(exercise.sets_json)) {
    return exercise.sets_json;
  }
  if (Array.isArray(exercise.timeline)) {
    return exercise.timeline;
  }
  return [];
}

async function createExerciseInWorkout(
  workoutId: number,
  exercise: WorkoutImportExercise,
  fallbackOrder: number,
  catalogIdMap: Map<number, number>,
): Promise<void> {
  const sourceCatalogId =
    typeof exercise.exercise_in_catalog_id === "number"
      ? exercise.exercise_in_catalog_id
      : null;
  const catalogId =
    sourceCatalogId != null ? (catalogIdMap.get(sourceCatalogId) ?? null) : null;

  const response = await apiFetch("/api/v1/exercises_in_workout/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workout_id: workoutId,
      exercise_in_catalog_id: catalogId,
      order_index:
        typeof exercise.order_index === "number" ? exercise.order_index : fallbackOrder,
      sets_json: exerciseSetsJson(exercise),
      note: exercise.note ?? null,
      ...(exercise.start_time ? { start_time: exercise.start_time } : {}),
      ...(exercise.end_time ? { end_time: exercise.end_time } : {}),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(body));
  }

  const exerciseId = Number((body as { id?: unknown }).id);
  const plannedSets = exercise.planned_sets_count ?? exercise.planned_sets;
  if (!Number.isFinite(exerciseId) || plannedSets == null) {
    return;
  }

  const plannedResponse = await apiFetch(
    `/api/v1/exercises_in_workout/${exerciseId}/planned_sets`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planned_sets_count: plannedSets }),
    },
  );
  const plannedBody = await plannedResponse.json().catch(() => ({}));
  if (!plannedResponse.ok) {
    throw new Error(parseErrorDetail(plannedBody));
  }
}

async function importGymsFromDump(
  gyms: ImportGymRow[],
  ownedGyms: UserGymBrief[],
  rollback: ImportRollbackState,
): Promise<{ gymIdMap: Map<number, number>; gymsCreated: number }> {
  const gymIdMap = new Map<number, number>();
  const existingByName = new Map<string, number>();
  let gymsCreated = 0;

  for (const gym of ownedGyms) {
    if (typeof gym.id === "number" && typeof gym.name === "string" && gym.name.trim()) {
      existingByName.set(normalizeNameKey(gym.name), gym.id);
    }
  }

  for (const gym of gyms) {
    const oldId = typeof gym.id === "number" ? gym.id : null;
    const name = typeof gym.name === "string" ? gym.name.trim() : "";
    if (!name) {
      continue;
    }

    const existingId = existingByName.get(normalizeNameKey(name));
    if (existingId != null) {
      if (oldId != null) {
        gymIdMap.set(oldId, existingId);
      }
      continue;
    }

    const response = await apiFetch("/api/v1/user_gyms/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        address: gym.address ?? null,
        is_favorite: Boolean(gym.is_favorite),
        rating: gym.rating ?? null,
        review_text: gym.review_text ?? null,
        last_visited_at: gym.last_visited_at ?? null,
        tags: Array.isArray(gym.tags) ? gym.tags : [],
        gallery_urls: [],
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(parseErrorDetail(body));
    }

    const newId = Number((body as { id?: unknown }).id);
    if (!Number.isFinite(newId) || newId <= 0) {
      throw new Error("Сервер не вернул id зала.");
    }

    existingByName.set(normalizeNameKey(name), newId);
    rollback.gymIds.push(newId);
    gymsCreated += 1;
    if (oldId != null) {
      gymIdMap.set(oldId, newId);
    }
  }

  return { gymIdMap, gymsCreated };
}

async function importCatalogFromDump(
  items: ImportCatalogRow[],
  ownedCatalog: OwnedCatalogRow[],
  gymIdMap: Map<number, number>,
  rollback: ImportRollbackState,
): Promise<{ catalogIdMap: Map<number, number>; catalogCreated: number }> {
  const catalogIdMap = new Map<number, number>();
  const existingByName = new Map<string, number>();
  let catalogCreated = 0;

  for (const item of ownedCatalog) {
    existingByName.set(normalizeNameKey(item.name), item.id);
  }

  for (const item of items) {
    const oldId = typeof item.id === "number" ? item.id : null;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) {
      continue;
    }

    let catalogId = existingByName.get(normalizeNameKey(name));

    if (catalogId == null) {
      const response = await apiFetch("/api/v1/exercises_in_catalog/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          notes: item.notes ?? null,
          muscle_group: item.muscle_group ?? null,
          exercise_type: item.exercise_type ?? null,
          machine_location: item.machine_location ?? null,
          machine_settings: item.machine_settings ?? null,
          icon: item.icon ?? "barbell",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseErrorDetail(body));
      }

      catalogId = Number((body as { id?: unknown }).id);
      if (!Number.isFinite(catalogId) || catalogId <= 0) {
        throw new Error("Сервер не вернул id упражнения каталога.");
      }

      existingByName.set(normalizeNameKey(name), catalogId);
      rollback.catalogIds.push(catalogId);
      catalogCreated += 1;

      const sourceGymId =
        typeof item.user_gym_id === "number"
          ? item.user_gym_id
          : typeof item.user_gym?.id === "number"
            ? item.user_gym.id
            : null;
      const mappedGymId = sourceGymId != null ? gymIdMap.get(sourceGymId) : null;
      if (mappedGymId != null) {
        const patchResponse = await apiFetch(`/api/v1/exercises_in_catalog/${catalogId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_gym_id: mappedGymId }),
        });
        const patchBody = await patchResponse.json().catch(() => ({}));
        if (!patchResponse.ok) {
          throw new Error(parseErrorDetail(patchBody));
        }
      }
    }

    if (oldId != null && catalogId != null) {
      catalogIdMap.set(oldId, catalogId);
    }
  }

  return { catalogIdMap, catalogCreated };
}

async function importWorkoutsFromDump(
  workouts: ImportWorkoutRow[],
  ownedGyms: UserGymBrief[],
  gymIdMap: Map<number, number>,
  catalogIdMap: Map<number, number>,
  rollback: ImportRollbackState,
): Promise<{ workoutIds: number[] }> {
  const workoutIds: number[] = [];
  const sorted = [...workouts].sort((a, b) => {
    const dateA = typeof a.workout_date === "string" ? a.workout_date : "";
    const dateB = typeof b.workout_date === "string" ? b.workout_date : "";
    return dateA.localeCompare(dateB);
  });

  for (const workout of sorted) {
    const workoutDateRaw =
      typeof workout.workout_date === "string" ? workout.workout_date.trim() : "";
    const workoutDate = workoutDateRaw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) {
      continue;
    }

    const userGymId = resolveUserGymIdFromMaps(workout, ownedGyms, gymIdMap);
    const workoutId = await createWorkoutFromImport(workout, userGymId);
    rollback.workoutIds.push(workoutId);
    workoutIds.push(workoutId);

    const exercises = [...(workout.exercises ?? [])].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
    );

    for (let index = 0; index < exercises.length; index += 1) {
      await createExerciseInWorkout(workoutId, exercises[index], index, catalogIdMap);
    }
  }

  return { workoutIds };
}

/** Импорт полного дампа: залы, каталог, тренировки. profile и user_weights игнорируются. */
export async function importDataDumpFromJsonText(text: string): Promise<ImportJsonResult> {
  const payload = parseDataDumpImportJson(text);
  const rollback: ImportRollbackState = { workoutIds: [], catalogIds: [], gymIds: [] };

  try {
    const [ownedGyms, ownedCatalog] = await Promise.all([
      loadOwnedUserGyms(),
      loadOwnedCatalog(),
    ]);

    const { gymIdMap, gymsCreated } = await importGymsFromDump(
      payload.user_gyms,
      ownedGyms,
      rollback,
    );

    const mergedGyms = [...ownedGyms];
    for (const [oldId, newId] of gymIdMap) {
      if (!mergedGyms.some((gym) => gym.id === newId)) {
        const source = payload.user_gyms.find((gym) => gym.id === oldId);
        mergedGyms.push({ id: newId, name: source?.name ?? null });
      }
    }

    const { catalogIdMap, catalogCreated } = await importCatalogFromDump(
      payload.exercises_in_catalog,
      ownedCatalog,
      gymIdMap,
      rollback,
    );

    const { workoutIds } = await importWorkoutsFromDump(
      payload.workouts,
      mergedGyms,
      gymIdMap,
      catalogIdMap,
      rollback,
    );

    markWorkoutsListStale();
    emit("catalog:updated");

    return {
      kind: "dump",
      gymsCreated,
      catalogCreated,
      workoutsCreated: workoutIds.length,
      firstWorkoutId: workoutIds[0] ?? null,
    };
  } catch (error) {
    await rollbackImport(rollback);
    throw error;
  }
}

/** Импорт одной тренировки из JSON (обратная совместимость). */
export async function importSingleWorkoutFromJsonText(text: string): Promise<ImportJsonResult> {
  const payload = parseWorkoutImportJson(text);
  const [ownedGyms, ownedCatalog] = await Promise.all([
    loadOwnedUserGyms(),
    loadOwnedCatalog(),
  ]);

  const catalogIdMap = new Map<number, number>();
  for (const item of ownedCatalog) {
    catalogIdMap.set(item.id, item.id);
  }

  const rollback: ImportRollbackState = { workoutIds: [], catalogIds: [], gymIds: [] };

  try {
    const userGymId = resolveUserGymIdFromMaps(payload, ownedGyms, new Map());
    const workoutId = await createWorkoutFromImport(payload, userGymId);
    rollback.workoutIds.push(workoutId);

    const exercises = [...(payload.exercises ?? [])].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
    );

    for (let index = 0; index < exercises.length; index += 1) {
      await createExerciseInWorkout(workoutId, exercises[index], index, catalogIdMap);
    }

    markWorkoutsListStale();

    return {
      kind: "single",
      gymsCreated: 0,
      catalogCreated: 0,
      workoutsCreated: 1,
      firstWorkoutId: workoutId,
    };
  } catch (error) {
    await rollbackImport(rollback);
    throw error;
  }
}

/** Импорт JSON: полный дамп или одна тренировка. */
export async function importFromJsonText(text: string): Promise<ImportJsonResult> {
  const root = parseJsonRoot(text);
  if (isFullDataDump(root)) {
    return importDataDumpFromJsonText(text);
  }
  return importSingleWorkoutFromJsonText(text);
}

/** Выбор JSON-файла и импорт. Возвращает null при отмене выбора файла. */
export async function importWorkoutFromJsonFile(): Promise<ImportJsonResult | null> {
  const text = await pickWorkoutJsonText();
  if (text == null) {
    return null;
  }
  return importFromJsonText(text);
}
