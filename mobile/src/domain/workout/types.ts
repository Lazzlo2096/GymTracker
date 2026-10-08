import type { MaterialCommunityIcons } from "@expo/vector-icons";

export type TimelineEvent = {
  type: "mark" | "set" | "comment" | "rest";
  isPlanned?: boolean;
  datetime?: string;
  comment?: string | null;
  mark_type?: "start" | "end";
  weight_kg?: number | null;
  weight?: number | null;
  weight_string?: string | null;
  reps?: number | null;
  reps_string?: string | null;
  set_seconds?: number | null;
  heart_rate_right_after?: number | null;
  rating?: number | null;
  reached_failure?: boolean | null;
  effort_level?: string | null;
  rest_seconds?: number | null;
  rest?: number | null;
};

export type ExerciseSet = {
  id: string;
  number: number;
  weightText: string;
  reps: number;
  repsText: string;
  restText?: string | null;
  setNote?: string | null;
  restNote?: string | null;
};

export type WorkoutSetApiEntry = TimelineEvent;

export type WorkoutExerciseApiEntry = {
  id: number | string;
  exercise_in_catalog_id?: number | null;
  order_index?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
  sets_json?: WorkoutSetApiEntry[] | null;
  timeline?: WorkoutSetApiEntry[] | null;
  planned_sets_json?: WorkoutSetApiEntry[] | null;
  is_active?: boolean | null;
};

export type WorkoutExercise = {
  id: string;
  time: string;
  title: string;
  order: number;
  setsCount: number;
  tonnageKg: number;
  bestSet: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  sets: ExerciseSet[];
  timeline: TimelineEvent[];
  isActive: boolean;
  /** Снимок строки API — единый источник для локального patch без GET. */
  apiEntry: WorkoutExerciseApiEntry;
};

export type WorkoutDetail = {
  id: string;
  dayTitle: string;
  workoutDateAt: Date;
  workoutDateFullText: string;
  gymName?: string | null;
  userGymId?: number | null;
  note?: string | null;
  exercisesCount: number;
  tonnageKg: number;
  durationMinutes: number | null;
  isActive: boolean;
  setsCount: number;
  maxWeightKg: number;
  exercises: WorkoutExercise[];
};

export type WorkoutDetailApiResponse = {
  id: number | string;
  workout_date?: string;
  day_title?: string | null;
  user_gym_id?: number | null;
  user_gym?: { id?: number; name?: string | null } | null;
  note?: string | null;
  tonnage_kg?: number | null;
  duration_minutes?: number | null;
  is_active?: boolean | null;
  exercises?: WorkoutExerciseApiEntry[] | null;
  timeline?: WorkoutExerciseApiEntry[] | null;
};

export type ExerciseActionId =
  | "add_set"
  | "edit_exercise"
  | "paste_sets_json"
  | "delete_exercise";
export type EventActionId = "edit" | "delete";

export type ContextMenuTarget =
  | { type: "exercise"; exerciseId: string; exercise: WorkoutExercise }
  | { type: "event"; exerciseId: string; eventIndex: number; event: TimelineEvent };
