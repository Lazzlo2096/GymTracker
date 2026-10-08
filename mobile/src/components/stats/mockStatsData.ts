import type {
  StatsChartPoint,
  StatsGymVisit,
  StatsKpiSnapshot,
  StatsMetricId,
  StatsPeriodId,
  StatsStreak,
  StatsTopExercise,
  StatsWorkoutTypeSlice,
} from "@/components/stats/types";

/** Тестовые KPI по периодам (не из API). */
export const MOCK_STATS_KPI_BY_PERIOD: Record<StatsPeriodId, StatsKpiSnapshot> = {
  "7d": {
    workouts: 4,
    durationMinutes: 268,
    tonnageKg: 4820,
    exercises: 18,
    deltaWorkouts: "+1 к прошлой неделе",
    deltaDuration: "+32 мин",
    deltaTonnage: "+6%",
    deltaExercises: "+2",
  },
  "30d": {
    workouts: 14,
    durationMinutes: 920,
    tonnageKg: 16840,
    exercises: 62,
    deltaWorkouts: "+3 к прошлому месяцу",
    deltaDuration: "+1 ч 10 мин",
    deltaTonnage: "+4%",
    deltaExercises: "+8",
  },
  "3m": {
    workouts: 38,
    durationMinutes: 2640,
    tonnageKg: 47200,
    exercises: 168,
    deltaWorkouts: "+5 за квартал",
    deltaDuration: "+3 ч 20 мин",
    deltaTonnage: "+11%",
    deltaExercises: "+22",
  },
  year: {
    workouts: 142,
    durationMinutes: 9840,
    tonnageKg: 186400,
    exercises: 612,
    deltaWorkouts: "+18 к прошлому году",
    deltaDuration: "+12 ч",
    deltaTonnage: "+9%",
    deltaExercises: "+74",
  },
  all: {
    workouts: 218,
    durationMinutes: 15120,
    tonnageKg: 284600,
    exercises: 940,
    deltaWorkouts: "за всё время",
    deltaDuration: "252 ч в зале",
    deltaTonnage: "284.6 т",
    deltaExercises: "940 упр.",
  },
};

const CHART_7D: Record<StatsMetricId, StatsChartPoint[]> = {
  sessions: [
    { label: "пн", value: 0 },
    { label: "вт", value: 1 },
    { label: "ср", value: 0 },
    { label: "чт", value: 1 },
    { label: "пт", value: 0 },
    { label: "сб", value: 1 },
    { label: "вс", value: 1 },
  ],
  duration: [
    { label: "пн", value: 0 },
    { label: "вт", value: 68 },
    { label: "ср", value: 0 },
    { label: "чт", value: 54 },
    { label: "пт", value: 0 },
    { label: "сб", value: 72 },
    { label: "вс", value: 74 },
  ],
  tonnage: [
    { label: "пн", value: 0 },
    { label: "вт", value: 1240 },
    { label: "ср", value: 0 },
    { label: "чт", value: 980 },
    { label: "пт", value: 0 },
    { label: "сб", value: 1320 },
    { label: "вс", value: 1280 },
  ],
  exercises: [
    { label: "пн", value: 0 },
    { label: "вт", value: 5 },
    { label: "ср", value: 0 },
    { label: "чт", value: 4 },
    { label: "пт", value: 0 },
    { label: "сб", value: 5 },
    { label: "вс", value: 4 },
  ],
};

const CHART_30D: Record<StatsMetricId, StatsChartPoint[]> = {
  sessions: [
    { label: "1", value: 2 },
    { label: "8", value: 3 },
    { label: "15", value: 4 },
    { label: "22", value: 3 },
    { label: "29", value: 2 },
  ],
  duration: [
    { label: "1", value: 128 },
    { label: "8", value: 196 },
    { label: "15", value: 224 },
    { label: "22", value: 188 },
    { label: "29", value: 184 },
  ],
  tonnage: [
    { label: "1", value: 2400 },
    { label: "8", value: 3600 },
    { label: "15", value: 4200 },
    { label: "22", value: 3100 },
    { label: "29", value: 3540 },
  ],
  exercises: [
    { label: "1", value: 8 },
    { label: "8", value: 14 },
    { label: "15", value: 16 },
    { label: "22", value: 12 },
    { label: "29", value: 12 },
  ],
};

const CHART_3M: Record<StatsMetricId, StatsChartPoint[]> = {
  sessions: [
    { label: "янв.", value: 11 },
    { label: "февр.", value: 13 },
    { label: "мар.", value: 14 },
  ],
  duration: [
    { label: "янв.", value: 720 },
    { label: "февр.", value: 840 },
    { label: "мар.", value: 920 },
  ],
  tonnage: [
    { label: "янв.", value: 14200 },
    { label: "февр.", value: 15800 },
    { label: "мар.", value: 16840 },
  ],
  exercises: [
    { label: "янв.", value: 48 },
    { label: "февр.", value: 54 },
    { label: "мар.", value: 62 },
  ],
};

const CHART_YEAR: Record<StatsMetricId, StatsChartPoint[]> = {
  sessions: [
    { label: "янв.", sublabel: "2025", value: 8 },
    { label: "апр.", value: 11 },
    { label: "июл.", value: 14 },
    { label: "окт.", value: 12 },
    { label: "янв.", sublabel: "2026", value: 14 },
    { label: "апр.", value: 12 },
  ],
  duration: [
    { label: "янв.", sublabel: "2025", value: 520 },
    { label: "апр.", value: 680 },
    { label: "июл.", value: 820 },
    { label: "окт.", value: 760 },
    { label: "янв.", sublabel: "2026", value: 880 },
    { label: "апр.", value: 920 },
  ],
  tonnage: [
    { label: "янв.", sublabel: "2025", value: 10200 },
    { label: "апр.", value: 14800 },
    { label: "июл.", value: 17200 },
    { label: "окт.", value: 15600 },
    { label: "янв.", sublabel: "2026", value: 16400 },
    { label: "апр.", value: 16840 },
  ],
  exercises: [
    { label: "янв.", sublabel: "2025", value: 32 },
    { label: "апр.", value: 44 },
    { label: "июл.", value: 52 },
    { label: "окт.", value: 48 },
    { label: "янв.", sublabel: "2026", value: 58 },
    { label: "апр.", value: 62 },
  ],
};

const CHART_ALL: Record<StatsMetricId, StatsChartPoint[]> = {
  sessions: [
    { label: "2023", value: 28 },
    { label: "2024", value: 64 },
    { label: "2025", value: 96 },
    { label: "2026", value: 30 },
  ],
  duration: [
    { label: "2023", value: 1920 },
    { label: "2024", value: 4320 },
    { label: "2025", value: 6480 },
    { label: "2026", value: 2400 },
  ],
  tonnage: [
    { label: "2023", value: 28400 },
    { label: "2024", value: 68200 },
    { label: "2025", value: 124800 },
    { label: "2026", value: 63200 },
  ],
  exercises: [
    { label: "2023", value: 120 },
    { label: "2024", value: 280 },
    { label: "2025", value: 420 },
    { label: "2026", value: 120 },
  ],
};

export const MOCK_STATS_CHART_BY_PERIOD: Record<
  StatsPeriodId,
  Record<StatsMetricId, StatsChartPoint[]>
> = {
  "7d": CHART_7D,
  "30d": CHART_30D,
  "3m": CHART_3M,
  year: CHART_YEAR,
  all: CHART_ALL,
};

export const MOCK_STATS_PERIOD_LABELS: Record<StatsPeriodId, string> = {
  "7d": "7 дней",
  "30d": "30 дней",
  "3m": "3 месяца",
  year: "Год",
  all: "Всё время",
};

export const MOCK_STATS_METRIC_LABELS: Record<StatsMetricId, string> = {
  sessions: "Сессии",
  duration: "Время",
  tonnage: "Тоннаж",
  exercises: "Упр.",
};

export const MOCK_STATS_CURRENT_STREAK = {
  days: 5,
  label: "5 дней подряд",
  hint: "Лучшая серия: 68 дней",
};

export const MOCK_STATS_BEST_STREAKS: StatsStreak[] = [
  { start: "26 апр. 2026 г.", days: 37, end: "1 июн. 2026 г." },
  { start: "26 янв. 2026 г.", days: 68, end: "3 апр. 2026 г." },
  { start: "3 окт. 2025 г.", days: 40, end: "11 нояб. 2025 г." },
  { start: "6 авг. 2025 г.", days: 29, end: "3 сент. 2025 г." },
  { start: "11 апр. 2025 г.", days: 60, end: "9 июн. 2025 г." },
];

/** Дата → день (intensity + optional note). */
export const MOCK_STATS_HEATMAP_DAYS: Record<
  string,
  { intensity: 1 | 2; note?: string }
> = {
  "2025-10-03": { intensity: 2 },
  "2025-10-07": { intensity: 1 },
  "2025-10-11": { intensity: 2 },
  "2025-10-18": { intensity: 1 },
  "2025-10-25": { intensity: 2 },
  "2025-11-02": { intensity: 1 },
  "2025-11-08": { intensity: 2 },
  "2025-11-11": { intensity: 1 },
  "2025-12-02": { intensity: 1 },
  "2025-12-09": { intensity: 2 },
  "2025-12-16": { intensity: 1 },
  "2025-12-24": { intensity: 2 },
  "2026-01-08": { intensity: 1 },
  "2026-01-15": { intensity: 2 },
  "2026-01-22": { intensity: 1 },
  "2026-01-26": { intensity: 2 },
  "2026-02-03": { intensity: 1 },
  "2026-02-09": { intensity: 2, note: "Хорошая тренировка ног, колено не беспокоило. Добавил разминку 10 мин." },
  "2026-02-16": { intensity: 1 },
  "2026-02-18": { intensity: 2 },
  "2026-02-22": { intensity: 1 },
  "2026-03-10": { intensity: 2 },
  "2026-03-18": { intensity: 1 },
  "2026-03-26": { intensity: 2, note: "После болезни — лёгкий объём. Сохранил технику на жиме." },
  "2026-03-31": { intensity: 1 },
  "2026-04-02": { intensity: 2 },
  "2026-04-07": { intensity: 1 },
  "2026-04-09": { intensity: 2 },
  "2026-04-11": { intensity: 1 },
  "2026-04-14": { intensity: 2 },
  "2026-04-16": { intensity: 1 },
  "2026-04-18": { intensity: 2, note: "ПРи в становой: 140×3. Настроение огонь." },
  "2026-04-22": { intensity: 1 },
  "2026-04-25": { intensity: 2 },
  "2026-04-26": { intensity: 2 },
  "2026-05-20": { intensity: 1 },
  "2026-05-27": { intensity: 2, note: "Зал был переполнен, сократил отдых. Заметка: взять пояс в следующий раз." },
  "2026-06-01": { intensity: 2 },
  "2026-06-08": { intensity: 1 },
  "2026-06-11": { intensity: 2 },
};

export const MOCK_STATS_HEATMAP_RANGE = {
  start: "2025-10-01",
  end: "2026-06-14",
} as const;

export const MOCK_STATS_WORKOUT_TYPES: StatsWorkoutTypeSlice[] = [
  { id: "strength", label: "Силовая", count: 62, percent: 44 },
  { id: "mixed", label: "Смешанная", count: 28, percent: 20 },
  { id: "cardio", label: "Кардио", count: 22, percent: 15 },
  { id: "mobility", label: "Мобилити", count: 18, percent: 13 },
  { id: "home", label: "Домашняя", count: 12, percent: 8 },
];

export const MOCK_STATS_TOP_EXERCISES: StatsTopExercise[] = [
  { id: 1, name: "Жим лёжа", sets: 84, tonnageKg: 28400, bestWeightKg: 100 },
  { id: 2, name: "Присед со штангой", sets: 72, tonnageKg: 35200, bestWeightKg: 120 },
  { id: 3, name: "Становая тяга", sets: 48, tonnageKg: 41800, bestWeightKg: 140 },
  { id: 4, name: "Подтягивания", sets: 96, tonnageKg: 0, bestWeightKg: 0 },
  { id: 5, name: "Жим гантелей", sets: 56, tonnageKg: 12400, bestWeightKg: 36 },
];

export const MOCK_STATS_GYM_VISITS: StatsGymVisit[] = [
  { id: 1, name: "World Gym", visitCount: 47, lastVisitedLabel: "3 дня назад" },
  { id: 2, name: "Iron Hall", visitCount: 28, lastVisitedLabel: "12 дней назад" },
  { id: 3, name: "Дома", visitCount: 12, lastVisitedLabel: "вчера" },
];
