import { apiFetch, parseErrorDetail } from "@/api/client";
import { toIsoDateOnly } from "@/utils/ageFromBirthDate";
import { markWorkoutsListStale } from "@/events/workoutsListEvents";

/** Заголовок дня по умолчанию при создании с FAB «+». */
export const NEW_WORKOUT_DEFAULT_TITLE = "Новая тренировка";

/**
 * Календарный «сегодня» пользователя в формате API (`YYYY-MM-DD`).
 * Используем локальные getFullYear/getMonth/getDate — не UTC — чтобы дата на сервере
 * (PostgreSQL `date`) совпадала с тем, что пользователь видит в пикере и в списке.
 */
export function workoutDateTodayForApi(reference: Date = new Date()): string {
  return toIsoDateOnly(reference);
}

export type CreateQuickWorkoutOptions = {
  userGymId?: number | null;
  /** false — не эмитить workouts:list-stale (например перед уходом на деталь). */
  markListStale?: boolean;
};

/** Создаёт тренировку на сегодня с названием «Новая тренировка». */
export async function createQuickWorkout(
  options: CreateQuickWorkoutOptions = {},
): Promise<number> {
  const body: Record<string, unknown> = {
    workout_date: workoutDateTodayForApi(),
    day_title: NEW_WORKOUT_DEFAULT_TITLE,
    note: null,
  };
  if (
    typeof options.userGymId === "number" &&
    Number.isFinite(options.userGymId) &&
    options.userGymId > 0
  ) {
    body.user_gym_id = options.userGymId;
  }

  const response = await apiFetch("/api/v1/workouts/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
  const id = Number((payload as { id?: unknown }).id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Сервер не вернул id тренировки");
  }
  if (options.markListStale !== false) {
    markWorkoutsListStale();
  }
  return id;
}
