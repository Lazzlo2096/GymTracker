export type StatsPeriodId = "7d" | "30d" | "3m" | "year" | "all";

export type StatsBucketId = "day" | "week" | "month" | "quarter" | "year";

export type StatsMetricId = "sessions" | "duration" | "tonnage" | "exercises";

export type StatsChartPoint = {
  label: string;
  sublabel?: string;
  value: number;
};

export type StatsKpiSnapshot = {
  workouts: number;
  durationMinutes: number;
  tonnageKg: number;
  exercises: number;
  deltaWorkouts: string;
  deltaDuration: string;
  deltaTonnage: string;
  deltaExercises: string;
};

export type StatsStreak = {
  start: string;
  end: string;
  days: number;
};

export type StatsStreaksRhythm = {
  current_streak_days: number;
  best_streaks: StatsStreak[];
};

export type StatsWorkoutTypeSlice = {
  id: string;
  label: string;
  count: number;
  percent: number;
};

export type StatsTopExercise = {
  id: number;
  name: string;
  sets: number;
  tonnageKg: number;
  bestWeightKg: number;
};

export type StatsGymVisit = {
  id: number;
  name: string;
  visitCount: number;
  lastVisitedLabel: string;
};

export type StatsHeatmapIntensity = 0 | 1 | 2;

export type StatsActivityHeatmapRange = {
  start: string;
  end: string;
};

export type StatsActivityHeatmapDay = {
  intensity: 1 | 2;
  note?: string | null;
};

export type StatsActivityHeatmap = {
  range: StatsActivityHeatmapRange;
  /** Дата YYYY-MM-DD → день с intensity и optional note. */
  days: Record<string, StatsActivityHeatmapDay>;
};
