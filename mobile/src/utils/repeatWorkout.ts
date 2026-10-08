import { apiFetch, parseErrorDetail } from "@/api/client";
import { markWorkoutsListStale } from "@/events/workoutsListEvents";

export type RepeatWorkoutOptions = {
  workout_date?: string;
  day_title?: string;
  /** false — не эмитить workouts:list-stale (например перед уходом на деталь). */
  markListStale?: boolean;
};

/** Создаёт запланированную копию тренировки по выполненной (POST .../repeat). */
export async function repeatWorkout(
  sourceWorkoutId: number,
  options: RepeatWorkoutOptions = {},
): Promise<number> {
  const body: RepeatWorkoutOptions = {};
  if (options.workout_date) body.workout_date = options.workout_date;
  if (options.day_title) body.day_title = options.day_title;

  const response = await apiFetch(
    `/api/v1/workouts/${sourceWorkoutId}/repeat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
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

type RouterLike = { push: (href: string) => void };

export type RepeatWorkoutFlowParams = {
  sourceWorkoutId: number;
  router: RouterLike;
  isBusy: () => boolean;
  setBusy: (busy: boolean) => void;
  onInvalidId?: () => void;
  onError?: (message: string) => void;
  /** Пометить список устаревшим локально без немедленного GET (перед push на деталь). */
  markListStaleLocally?: () => void;
};

/** Повторяет тренировку и открывает новую (как FAB «+» после create). */
export function runRepeatWorkoutFlow(params: RepeatWorkoutFlowParams): void {
  const { sourceWorkoutId, router, isBusy, setBusy, onInvalidId, onError, markListStaleLocally } =
    params;
  if (!Number.isFinite(sourceWorkoutId) || sourceWorkoutId <= 0) {
    onInvalidId?.();
    return;
  }
  if (isBusy()) return;

  setBusy(true);
  void (async () => {
    try {
      const id = await repeatWorkout(sourceWorkoutId, {
        markListStale: !markListStaleLocally,
      });
      markListStaleLocally?.();
      router.push(`/workout/${id}`);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  })();
}
