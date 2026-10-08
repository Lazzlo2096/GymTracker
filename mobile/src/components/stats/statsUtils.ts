import type {
  StatsActivityHeatmapRange,
  StatsActivityHeatmapDay,
  StatsHeatmapIntensity,
  StatsPeriodId,
} from "@/components/stats/types";

export function parseStatsDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toStatsDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addStatsDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getStatsHeatmapIntensity(
  date: Date,
  days: Record<string, StatsActivityHeatmapDay>,
): StatsHeatmapIntensity {
  return days[toStatsDateKey(date)]?.intensity ?? 0;
}

export function getStatsHeatmapDayNote(
  dateKey: string,
  days: Record<string, StatsActivityHeatmapDay>,
): string | null {
  const note = days[dateKey]?.note?.trim();
  return note || null;
}

function getStatsWeekdayRowIndex(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function alignStatsDateToMonday(date: Date): Date {
  const aligned = new Date(date);
  aligned.setDate(aligned.getDate() - getStatsWeekdayRowIndex(aligned));
  return aligned;
}

function alignStatsDateToSunday(date: Date): Date {
  const aligned = new Date(date);
  const daysUntilSunday = (7 - aligned.getDay()) % 7;
  aligned.setDate(aligned.getDate() + daysUntilSunday);
  return aligned;
}

export function getStatsWeekAnchorDate(week: (Date | null)[]): Date | null {
  return week.find((date) => date !== null) ?? null;
}

export function getStatsCalendarWeeks(range: StatsActivityHeatmapRange): (Date | null)[][] {
  const rangeStart = parseStatsDate(range.start);
  const rangeEnd = parseStatsDate(range.end);
  const gridStart = alignStatsDateToMonday(rangeStart);
  const gridEnd = alignStatsDateToSunday(rangeEnd);

  const weeks: (Date | null)[][] = [];
  let current = gridStart;

  while (current <= gridEnd) {
    const week = Array.from({ length: 7 }, (_, rowIndex) => {
      const date = addStatsDays(current, rowIndex);
      if (date < rangeStart || date > rangeEnd) {
        return null;
      }
      return date;
    });
    weeks.push(week);
    current = addStatsDays(current, 7);
  }

  return weeks;
}

export function getStatsMonthLabel(date: Date): string {
  const month = date.getMonth();
  const year = date.getFullYear();

  const labels = [
    "янв.",
    "февр.",
    "мар.",
    "апр.",
    "мая",
    "июн.",
    "июл.",
    "авг.",
    "сент.",
    "окт.",
    "нояб.",
    "дек.",
  ];

  if (month === 0 || month === 9) {
    return `${labels[month]} ${year}`;
  }

  return labels[month];
}

/** Подпись диапазона календаря: `2025 авг. — 2026 авг.`. */
export function formatStatsHeatmapPeriod(range: StatsActivityHeatmapRange): string {
  const start = parseStatsDate(range.start);
  const end = parseStatsDate(range.end);
  return `${formatHeatmapPeriodEndpoint(start)} — ${formatHeatmapPeriodEndpoint(end)}`;
}

function formatHeatmapPeriodEndpoint(date: Date): string {
  const labels = [
    "янв.",
    "февр.",
    "мар.",
    "апр.",
    "мая",
    "июн.",
    "июл.",
    "авг.",
    "сент.",
    "окт.",
    "нояб.",
    "дек.",
  ];
  return `${date.getFullYear()} ${labels[date.getMonth()]}`;
}

/** Заголовок дня для модалки комментария: «9 февр. 2026». */
export function formatStatsHeatmapDayTitle(dateKey: string): string {
  const date = parseStatsDate(dateKey.slice(0, 10));
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatStatsDaysCount(count: number): string {
  const value = Math.abs(Math.trunc(count));
  const mod100 = value % 100;
  const mod10 = value % 10;

  if (mod100 >= 11 && mod100 <= 14) return `${value} дней`;
  if (mod10 === 1) return `${value} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${value} дня`;
  return `${value} дней`;
}

export function formatStatsCurrentStreakLabel(days: number): string {
  return `${formatStatsDaysCount(days)} подряд`;
}

export function formatStatsBestStreakHint(bestDays: number): string {
  return `Лучшая серия: ${formatStatsDaysCount(bestDays)}`;
}

export function formatStatsStreakDate(isoDay: string): string {
  const date = parseStatsDate(isoDay.slice(0, 10));
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Границы периода чипов статистики для запросов к diary / спискам. */
export function getStatsPeriodDateRange(
  period: StatsPeriodId,
  now = new Date(),
): { startDate: Date | null; endDate: Date | null } {
  if (period === "all") {
    return { startDate: null, endDate: null };
  }

  const endDate = new Date(now);
  const startDate = new Date(now);
  switch (period) {
    case "7d":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(startDate.getDate() - 30);
      break;
    case "3m":
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case "year":
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }
  startDate.setHours(0, 0, 0, 0);
  return { startDate, endDate };
}

/** Относительная дата: сегодня / вчера / N дней назад / дата. */
export function formatStatsRelativeDay(isoDay: string | null | undefined, now = new Date()): string {
  if (!isoDay) return "—";
  const day = parseStatsDate(isoDay.slice(0, 10));
  const today = startOfLocalDay(now);
  const target = startOfLocalDay(day);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0) return "сегодня";
  if (diffDays === 1) return "вчера";
  if (diffDays > 1 && diffDays < 30) return `${diffDays} дн. назад`;
  return day.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatStatsMetricValue(metric: string, value: number): string {
  if (metric === "duration") {
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    if (hours <= 0) return `${mins} мин`;
    return `${hours} ч ${mins} мин`;
  }
  if (metric === "tonnage") {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1).replace(".", ",")} т`;
    }
    return `${value} кг`;
  }
  return String(value);
}
