import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "timer.restTargetSec.v1";

const DEFAULT_REST_TARGET_SEC = 60;

function storageKey(scope: { catalogExerciseId?: number | null; workoutExerciseId?: number | null }): string | null {
  if (scope.catalogExerciseId != null) {
    return `${KEY_PREFIX}:catalog:${scope.catalogExerciseId}`;
  }
  if (scope.workoutExerciseId != null) {
    return `${KEY_PREFIX}:workout:${scope.workoutExerciseId}`;
  }
  return null;
}

function parseRestTargetSec(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 5 || n > 600) return null;
  return n;
}

export function restDurationPartsFromSeconds(totalSeconds: number): {
  minutes: string;
  seconds: string;
} {
  const safe = Math.max(5, Math.min(600, Math.round(totalSeconds)));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return { minutes: String(minutes), seconds: String(seconds) };
}

/** Целевое время отдыха (сохраняется между сессиями и refresh). */
export async function loadRestTargetSec(scope: {
  catalogExerciseId?: number | null;
  workoutExerciseId?: number | null;
}): Promise<number | null> {
  const key = storageKey(scope);
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    return parseRestTargetSec(raw);
  } catch {
    return null;
  }
}

export async function saveRestTargetSec(
  scope: { catalogExerciseId?: number | null; workoutExerciseId?: number | null },
  totalSeconds: number,
): Promise<void> {
  const key = storageKey(scope);
  if (!key) return;
  const safe = Math.max(5, Math.min(600, Math.round(totalSeconds)));
  try {
    await AsyncStorage.setItem(key, String(safe));
  } catch {
    /* ignore */
  }
}

export { DEFAULT_REST_TARGET_SEC };
