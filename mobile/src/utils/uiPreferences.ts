import * as SecureStore from "expo-secure-store";

const WORKOUTS_SHOW_TILE_METRICS_KEY = "ui.workouts.showTileMetrics";
const EXERCISE_SHOW_SET_TEXT_FIELDS_KEY = "ui.exercise.showSetTextFields";
const EXERCISE_SHOW_TIMER_VIEW1_KEY = "ui.exercise.showTimerView1";
const EXERCISE_TIMER_FILL_VIEWPORT_KEY = "ui.exercise.timerFillViewport";
const EXERCISE_EDIT_COMPLETED_SET_ON_FINISH_KEY = "ui.exercise.editCompletedSetOnFinish";

export async function loadWorkoutsShowTileMetrics(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(WORKOUTS_SHOW_TILE_METRICS_KEY);
    if (raw === "0") return false;
    return true;
  } catch {
    return true;
  }
}

export async function saveWorkoutsShowTileMetrics(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(WORKOUTS_SHOW_TILE_METRICS_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export async function loadExerciseShowSetTextFields(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(EXERCISE_SHOW_SET_TEXT_FIELDS_KEY);
    if (raw === "0") return false;
    return true;
  } catch {
    return true;
  }
}

export async function saveExerciseShowSetTextFields(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(EXERCISE_SHOW_SET_TEXT_FIELDS_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export async function loadExerciseShowTimerView1(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(EXERCISE_SHOW_TIMER_VIEW1_KEY);
    if (raw === "1") return true;
    return false;
  } catch {
    return false;
  }
}

export async function saveExerciseShowTimerView1(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(EXERCISE_SHOW_TIMER_VIEW1_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export async function loadExerciseTimerFillViewport(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(EXERCISE_TIMER_FILL_VIEWPORT_KEY);
    if (raw === "1") return true;
    return false;
  } catch {
    return false;
  }
}

export async function saveExerciseTimerFillViewport(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(EXERCISE_TIMER_FILL_VIEWPORT_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export async function loadExerciseEditCompletedSetOnFinish(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(EXERCISE_EDIT_COMPLETED_SET_ON_FINISH_KEY);
    if (raw === "0") return false;
    return true;
  } catch {
    return true;
  }
}

export async function saveExerciseEditCompletedSetOnFinish(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(EXERCISE_EDIT_COMPLETED_SET_ON_FINISH_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}
