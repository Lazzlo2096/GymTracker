import type { StatsBucketId, StatsMetricId, StatsPeriodId } from "@/components/stats/types";

export const STATS_PERIOD_LABELS: Record<StatsPeriodId, string> = {
  "7d": "7 дней",
  "30d": "30 дней",
  "3m": "3 месяца",
  year: "Год",
  all: "Всё время",
};

export const STATS_METRIC_LABELS: Record<StatsMetricId, string> = {
  sessions: "Сессии",
  duration: "Время",
  tonnage: "Тоннаж",
  exercises: "Упр.",
};

export const STATS_BUCKET_LABELS: Record<StatsBucketId, string> = {
  day: "По дням",
  week: "По неделям",
  month: "По месяцам",
  quarter: "По кварталам",
  year: "По годам",
};

export const STATS_BUCKET_OPTIONS: readonly StatsBucketId[] = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
] as const;
