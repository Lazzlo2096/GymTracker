import type { TemplatePlannedSetMock } from "@/components/plans/types";

/** Подпись одной записи плана (подход или отдых). */
export function formatTemplatePlannedSetLabel(entry: TemplatePlannedSetMock): string {
  if (entry.type === "rest") {
    const sec = entry.rest_seconds;
    if (sec >= 60) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return s > 0 ? `отдых ${m}:${String(s).padStart(2, "0")}` : `отдых ${m} мин`;
    }
    return `отдых ${sec} с`;
  }

  const weight =
    entry.weight_label?.trim() ||
    (entry.weight_kg != null ? `${entry.weight_kg} кг` : "—");
  const reps =
    entry.reps_label?.trim() ||
    (entry.reps != null ? String(entry.reps) : "—");
  return `${weight} × ${reps}`;
}

/** Заголовок строки в редакторе плана (номер подхода или «Отдых»). */
export function formatTemplatePlannedEntryHeading(
  entry: TemplatePlannedSetMock,
  index: number,
  planned: TemplatePlannedSetMock[],
): string {
  if (entry.type === "rest") return "Отдых";
  const setNumber = planned.slice(0, index + 1).filter((row) => row.type === "set").length;
  return `Подход ${setNumber}`;
}

/** Число рабочих подходов в плане упражнения. */
export function countTemplateWorkingSets(planned: TemplatePlannedSetMock[]): number {
  return planned.filter((entry) => entry.type === "set").length;
}
