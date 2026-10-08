/** Локальный календарный день → `YYYY-MM-DD` (как у PostgreSQL `date` в JSON). */
export function toIsoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Разбор `YYYY-MM-DD` в дату по локальному календарю (без UTC-сдвига). */
export function parseIsoDateOnlyLocal(iso: string | null | undefined): Date | null {
  if (iso == null || typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return null;
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}

/** Полных лет на дату `reference` (по умолчанию сегодня). */
export function ageCompletedYears(birth: Date, reference: Date = new Date()): number {
  let age = reference.getFullYear() - birth.getFullYear();
  const rm = reference.getMonth();
  const rd = reference.getDate();
  const bm = birth.getMonth();
  const bd = birth.getDate();
  if (rm < bm || (rm === bm && rd < bd)) age -= 1;
  return age;
}

export function ageCompletedYearsFromIso(
  iso: string | null | undefined,
  reference: Date = new Date(),
): number | null {
  const d = parseIsoDateOnlyLocal(iso);
  if (!d) return null;
  const a = ageCompletedYears(d, reference);
  if (a < 0 || a > 150) return null;
  return a;
}
