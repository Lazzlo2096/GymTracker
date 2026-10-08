import type { ActivePeriod, QuarterPoint, Streak } from "@/components/home/stats/types";

/** Захардкоженные данные превью — без привязки к API. */
export const MOCK_HISTORY_CHART_DATA: QuarterPoint[] = [
  { month: "янв.", year: "2023", value: 11 },
  { month: "апр.", value: 6 },
  { month: "июл.", value: 11 },
  { month: "окт.", value: 6 },

  { month: "янв.", year: "2024", value: 8 },
  { month: "апр.", value: 18 },
  { month: "июл.", value: 25 },
  { month: "окт.", value: 22 },

  { month: "янв.", year: "2025", value: 36 },
  { month: "апр.", value: 29 },
  { month: "июл.", value: 35 },
  { month: "окт.", value: 33 },

  { month: "янв.", year: "2026", value: 35 },
  { month: "апр.", value: 15 },
];

export const MOCK_BEST_STREAKS: Streak[] = [
  { start: "26 апр. 2026 г.", days: 37, end: "1 июн. 2026 г." },
  { start: "26 янв. 2026 г.", days: 68, end: "3 апр. 2026 г." },
  { start: "3 окт. 2025 г.", days: 40, end: "11 нояб. 2025 г." },
  { start: "6 авг. 2025 г.", days: 29, end: "3 сент. 2025 г." },
  { start: "11 апр. 2025 г.", days: 60, end: "9 июн. 2025 г." },
  { start: "24 дек. 2024 г.", days: 81, end: "14 мар. 2025 г." },
  { start: "27 июл. 2024 г.", days: 93, end: "27 окт. 2024 г." },
  { start: "29 февр. 2024 г.", days: 48, end: "16 апр. 2024 г." },
];

export const MOCK_ACTIVE_PERIODS: ActivePeriod[] = [
  { start: "2026-01-26", end: "2026-04-03" },
  { start: "2026-04-26", end: "2026-06-01" },
];

export const MOCK_MARKED_DATES = new Set([
  "2026-02-09",
  "2026-02-16",
  "2026-02-18",
  "2026-02-22",
  "2026-03-10",
  "2026-03-26",
  "2026-03-31",
  "2026-04-02",
  "2026-04-07",
  "2026-04-09",
  "2026-04-11",
  "2026-04-14",
  "2026-04-16",
  "2026-04-18",
  "2026-04-22",
  "2026-04-25",
  "2026-05-20",
  "2026-05-27",
]);

export const MOCK_CALENDAR_RANGE = {
  start: "2026-02-09",
  end: "2026-06-14",
} as const;
