import { apiFetch, parseErrorDetail } from "@/api/client";

export type WorkoutTypeId =
  | "strength"
  | "cardio"
  | "mobility"
  | "mixed"
  | "technique"
  | "home";

export type WorkoutSummary = {
  id: string;
  workout_date: string;
  workout_type: WorkoutTypeId;
  gym_name?: string | null;
  day_title?: string | null;
  note?: string | null;
  exercises_count: number;
  tonnage_kg: number;
  duration_minutes?: number | null;
  is_active?: boolean;
};

type WorkoutApiItem = {
  id: number | string;
  workout_date: string;
  workout_type?: string | null;
  user_gym?: { id?: number; name?: string | null } | null;
  day_title?: string | null;
  note?: string | null;
  exercises_count?: number | null;
  tonnage_kg?: number | null;
  duration_minutes?: number | null;
  is_active?: boolean | null;
  exercises?: unknown[];
  timeline?: unknown[];
};

type WorkoutListApiResponse = {
  items?: WorkoutApiItem[];
  has_more?: boolean;
};

const WORKOUT_TYPE_ID_SET = new Set<WorkoutTypeId>([
  "strength",
  "cardio",
  "mobility",
  "mixed",
  "technique",
  "home",
]);

function normalizeWorkoutType(value: unknown): WorkoutTypeId {
  if (typeof value === "string" && WORKOUT_TYPE_ID_SET.has(value as WorkoutTypeId)) {
    return value as WorkoutTypeId;
  }
  return "mixed";
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function mapWorkoutFromApi(item: WorkoutApiItem): WorkoutSummary {
  const exercisesCount = toFiniteNumber(item.exercises_count, -1);
  const fallbackExercises = Array.isArray(item.exercises)
    ? item.exercises.length
    : Array.isArray(item.timeline)
      ? item.timeline.length
      : 0;

  return {
    id: String(item.id),
    workout_date: item.workout_date,
    workout_type: normalizeWorkoutType(item.workout_type),
    gym_name:
      typeof item.user_gym?.name === "string" && item.user_gym.name.trim()
        ? item.user_gym.name.trim()
        : null,
    day_title: item.day_title ?? null,
    note: item.note ?? null,
    exercises_count: exercisesCount >= 0 ? exercisesCount : fallbackExercises,
    tonnage_kg: toFiniteNumber(item.tonnage_kg),
    duration_minutes: toFiniteNumber(item.duration_minutes, -1) >= 0
      ? toFiniteNumber(item.duration_minutes, 0)
      : null,
    is_active: item.is_active === true,
  };
}

export function formatDateForApiQuery(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(reference: Date, days: number): Date {
  const next = new Date(reference);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatWorkoutNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatWorkoutDuration(minutes?: number | null): string {
  if (!minutes) return "—";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours <= 0) return `${mins} мин`;

  return `${hours} ч ${mins} мин`;
}

export function workoutCountLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return "тренировка";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "тренировки";
  }
  return "тренировок";
}

export async function fetchWorkoutSummaries(
  params: URLSearchParams,
): Promise<WorkoutSummary[]> {
  const response = await apiFetch(`/api/v1/workouts/?${params.toString()}`);
  const body = (await response.json().catch(() => ({}))) as WorkoutListApiResponse;
  if (!response.ok) {
    throw new Error(parseErrorDetail(body));
  }
  return Array.isArray(body.items) ? body.items.map(mapWorkoutFromApi) : [];
}
