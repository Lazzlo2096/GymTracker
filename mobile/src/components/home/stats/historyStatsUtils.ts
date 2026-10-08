import {
  MOCK_ACTIVE_PERIODS,
  MOCK_CALENDAR_RANGE,
} from "@/components/home/stats/mockHistoryStatsData";

export function parseHistoryStatsDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toHistoryStatsDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addHistoryStatsDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isInsidePeriod(dateKey: string, start: string, end: string): boolean {
  return dateKey >= start && dateKey <= end;
}

export function getHistoryStatsActivityIntensity(date: Date): 0 | 1 | 2 {
  const key = toHistoryStatsDateKey(date);

  const isActive = MOCK_ACTIVE_PERIODS.some((period) =>
    isInsidePeriod(key, period.start, period.end),
  );

  if (!isActive) return 0;

  const day = date.getDate();
  return day % 3 === 0 || day % 5 === 0 ? 2 : 1;
}

export function getHistoryStatsCalendarWeeks(): Date[][] {
  const start = parseHistoryStatsDate(MOCK_CALENDAR_RANGE.start);
  const end = parseHistoryStatsDate(MOCK_CALENDAR_RANGE.end);

  const weeks: Date[][] = [];
  let current = start;

  while (current <= end) {
    const week = Array.from({ length: 7 }, (_, index) => addHistoryStatsDays(current, index));
    weeks.push(week);
    current = addHistoryStatsDays(current, 7);
  }

  return weeks;
}

export function getHistoryStatsMonthLabel(date: Date): string {
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

  if (month === 1) {
    return `${labels[month]} ${year}`;
  }

  return labels[month];
}
