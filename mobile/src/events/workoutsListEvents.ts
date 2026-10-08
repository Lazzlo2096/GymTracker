import { emit } from "@/utils/eventBus";

/** Список тренировок устарел — перезагрузка только при focus экрана списка. */
export const WORKOUTS_LIST_STALE_EVENT = "workouts:list-stale";

export function markWorkoutsListStale(): void {
  emit(WORKOUTS_LIST_STALE_EVENT);
}
