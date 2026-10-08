/**
 * Дата/время для query-параметров API.
 *
 * Предпочтительный формат (договорённость):
 * `2026-07-05T210000Z` — дата с дефисами, время без `:`.
 */

/** ISO query UTC: `2026-07-05T210000Z`. */
export function toIso8601QueryDateTimeUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/:/g, "")
    .replace(/\.\d{3}/, "");
}

/** Сериализация Date / строки в query-формат; null → null. */
export function serializeIso8601QueryDateTime(
  value: Date | string | null | undefined,
): string | null {
  if (value == null) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return toIso8601QueryDateTimeUtc(value);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    // Уже hybrid / произвольная строка — отдать как есть.
    return trimmed;
  }
  return toIso8601QueryDateTimeUtc(parsed);
}
