function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function getCalendarDayKey(measuredAt: string): string {
  const date = new Date(measuredAt);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatWeightDiaryDayLabel(measuredAt: string, now = new Date()): string {
  const date = new Date(measuredAt);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameCalendarDay(date, now)) return "Сегодня";
  if (isSameCalendarDay(date, yesterday)) return "Вчера";

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

export function formatWeightDiaryMeasuredTime(measuredAt: string): string {
  return new Date(measuredAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ДД.ММ.ГГГГ для формы измерения. */
export function formatWeightFormDate(measuredAt: string | null, now = new Date()): string {
  const d = measuredAt ? new Date(measuredAt) : now;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** ЧЧ:ММ для формы измерения. */
export function formatWeightFormTime(measuredAt: string | null, now = new Date()): string {
  const d = measuredAt ? new Date(measuredAt) : now;
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Локальная дата/время → ISO 8601 для API. */
export function parseWeightFormMeasuredAt(dateStr: string, timeStr: string): string | null {
  const dateMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed.toISOString();
}
