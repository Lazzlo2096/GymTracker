type LogEntry = Record<string, unknown>;

import { parseSetEffortLevel } from "@/utils/workoutSetEffort";
import { entryHasResolvableWeight } from "@/domain/weightComposition";

function isSetLikeEntry(item: LogEntry | null | undefined): boolean {
  if (!item) return false;
  const t = item.type;
  if (t === "mark" || t === "rest" || t === "comment") return false;
  if (t === "set") return true;
  return (
    item.reps != null ||
    (typeof item.reps_string === "string" && item.reps_string.trim() !== "") ||
    item.weight != null ||
    item.weight_kg != null ||
    (typeof item.weight_string === "string" && item.weight_string.trim() !== "") ||
    entryHasResolvableWeight(item) ||
    parseSetEffortLevel(item.effort_level) != null ||
    item.set_time != null ||
    item.set_seconds != null
  );
}

export type ExerciseSetProgress = {
  setIndexes: number[];
  /** Подходы, уже записанные в журнал (backend). */
  loggedSetCount: number;
};

/** Считает подходы в логе. «Текущий» в UI — следующий не записанный (placeholder), не «без отдыха». */
export function getExerciseSetProgress(log: LogEntry[]): ExerciseSetProgress {
  const setIndexes: number[] = [];
  for (let i = 0; i < log.length; i += 1) {
    const row = log[i];
    if (!row || typeof row !== "object") continue;
    if (!isSetLikeEntry(row)) continue;
    setIndexes.push(i);
  }
  return { setIndexes, loggedSetCount: setIndexes.length };
}

export function getPlanProgressColor(
  doneCount: number,
  planned: number | null,
  catalogUi: { dark: boolean; text: string },
): string {
  const hasExplicitPlan = planned != null && planned > 0;
  if (!hasExplicitPlan || planned == null) return catalogUi.text;
  if (doneCount < planned) return catalogUi.text;
  if (doneCount === planned) return catalogUi.dark ? "#86EFAC" : "#22C55E";
  return catalogUi.dark ? "#FCA5A5" : "#DC2626";
}
