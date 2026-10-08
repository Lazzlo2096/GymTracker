import { apiFetch, parseErrorDetail } from "@/api/client";
import { saveJsonFile } from "@/utils/saveJsonFile";

const DUMP_VERSION = 1;
const WORKOUTS_PAGE_SIZE = 100;
const CATALOG_PAGE_SIZE = 500;
const WEIGHTS_PAGE_SIZE = 500;
const WORKOUT_DETAILS_BATCH_SIZE = 8;

type PaginatedWorkoutsResponse = {
  items?: { id?: unknown }[];
  has_more?: boolean;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
  return payload as T;
}

async function fetchAllWorkoutIds(): Promise<number[]> {
  const ids: number[] = [];
  let offset = 0;

  while (true) {
    const body = await fetchJson<PaginatedWorkoutsResponse>(
      `/api/v1/workouts/?limit=${WORKOUTS_PAGE_SIZE}&offset=${offset}&sort=workout_date&order=asc`,
    );
    const items = Array.isArray(body.items) ? body.items : [];

    for (const item of items) {
      const id = Number(item.id);
      if (Number.isFinite(id) && id > 0) {
        ids.push(id);
      }
    }

    if (!body.has_more || items.length === 0) {
      break;
    }
    offset += items.length;
  }

  return ids;
}

async function fetchAllWorkouts(): Promise<unknown[]> {
  const ids = await fetchAllWorkoutIds();
  const workouts: unknown[] = [];

  for (let index = 0; index < ids.length; index += WORKOUT_DETAILS_BATCH_SIZE) {
    const batch = ids.slice(index, index + WORKOUT_DETAILS_BATCH_SIZE);
    const rows = await Promise.all(batch.map((id) => fetchJson(`/api/v1/workouts/${id}`)));
    workouts.push(...rows);
  }

  return workouts;
}

async function fetchPaginatedList(path: string, pageSize: number): Promise<unknown[]> {
  const all: unknown[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchJson<unknown[]>(`${path}?limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(page) || page.length === 0) {
      break;
    }
    all.push(...page);
    if (page.length < pageSize) {
      break;
    }
    offset += page.length;
  }

  return all;
}

function buildDumpFilename(userId: number): string {
  const datePart = new Date().toISOString().slice(0, 10);
  return `gymtracker-dump-user${userId}-${datePart}.json`;
}

export type UserDataDump = {
  export_version: number;
  exported_at: string;
  profile: unknown;
  user_gyms: unknown;
  exercises_in_catalog: unknown[];
  workouts: unknown[];
  user_weights: unknown[];
};

/** Собирает полный дамп данных пользователя и сохраняет его как JSON-файл. */
export async function downloadUserDataDump(userId: number): Promise<void> {
  const [profile, userGyms, exercisesInCatalog, workouts, userWeights] = await Promise.all([
    fetchJson("/api/v1/auth/me"),
    fetchJson("/api/v1/user_gyms/"),
    fetchPaginatedList("/api/v1/exercises_in_catalog/", CATALOG_PAGE_SIZE),
    fetchAllWorkouts(),
    fetchPaginatedList("/api/v1/user_weights/", WEIGHTS_PAGE_SIZE).catch(() => []),
  ]);

  const dump: UserDataDump = {
    export_version: DUMP_VERSION,
    exported_at: new Date().toISOString(),
    profile,
    user_gyms: userGyms,
    exercises_in_catalog: exercisesInCatalog,
    workouts,
    user_weights: userWeights,
  };

  const json = JSON.stringify(dump, null, 2);
  await saveJsonFile(
    json,
    buildDumpFilename(userId),
    "Скачать полный дамп данных",
  );
}
