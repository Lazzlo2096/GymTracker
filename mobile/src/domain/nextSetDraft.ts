import {
  parseWeightComposition,
  resolveWeightKg,
  resolveWeightString,
  type WeightCompositionV1,
} from "@/domain/weightComposition";

/** Черновик следующего подхода на экране упражнения (только в памяти сессии). */
export type NextSetDraft = {
  type: "set";
  weight_kg?: number | null;
  weight_string?: string | null;
  reps?: number | null;
  reps_string?: string | null;
  weight_composition?: WeightCompositionV1 | null;
};

export function createEmptyNextSetDraft(): NextSetDraft {
  return { type: "set" };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function logEntryToNextSetDraft(entry: Record<string, unknown>): NextSetDraft {
  const draft = createEmptyNextSetDraft();

  const weightKg = finiteNumber(entry.weight_kg) ?? finiteNumber(entry.weight);
  if (weightKg != null) draft.weight_kg = weightKg;

  if (typeof entry.weight_string === "string" && entry.weight_string.trim()) {
    draft.weight_string = entry.weight_string.trim();
  }

  const reps = finiteNumber(entry.reps);
  if (reps != null) draft.reps = Math.trunc(reps);

  if (typeof entry.reps_string === "string" && entry.reps_string.trim()) {
    draft.reps_string = entry.reps_string.trim();
  }

  const composition = parseWeightComposition(entry.weight_composition);
  if (composition?.terms?.length) {
    draft.weight_composition = composition;
  }

  return draft;
}

export function nextSetDraftToSetPayload(
  draft: NextSetDraft,
  setSeconds: number,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: "set",
    set_seconds: setSeconds,
  };

  if (draft.weight_kg != null) body.weight_kg = draft.weight_kg;
  if (draft.weight_string != null && draft.weight_string.trim()) {
    body.weight_string = draft.weight_string.trim();
  }
  if (draft.reps != null) body.reps = draft.reps;
  if (draft.reps_string != null && draft.reps_string.trim()) {
    body.reps_string = draft.reps_string.trim();
  }
  if (draft.weight_composition) {
    body.weight_composition = draft.weight_composition;
  }

  return body;
}

function formatKgShort(kg: number): string {
  if (kg === Math.trunc(kg)) return String(Math.trunc(kg));
  return String(kg).replace(".", ",");
}

/** Подпись веса на плашке «Следующий подход». */
export function formatNextSetDraftWeightLabel(draft: NextSetDraft): string {
  const kg = resolveWeightKg(draft);
  if (kg != null) return `${formatKgShort(kg)} кг`;
  const text = resolveWeightString(draft);
  if (text) return text.length > 16 ? `${text.slice(0, 16)}…` : text;
  return "—";
}

/** Подпись повторений на плашке «Следующий подход». */
export function formatNextSetDraftRepsLabel(draft: NextSetDraft): string {
  if (draft.reps != null) return String(draft.reps);
  if (typeof draft.reps_string === "string" && draft.reps_string.trim()) {
    const text = draft.reps_string.trim();
    return text.length > 16 ? `${text.slice(0, 16)}…` : text;
  }
  return "—";
}

/** Колонка «Вес» в Вид 1 для текущего placeholder. */
export function formatNextSetDraftWeightKg(draft: NextSetDraft): string {
  const kg = resolveWeightKg(draft);
  return kg != null ? `${formatKgShort(kg)} кг` : "—";
}

export function formatNextSetDraftWeightString(draft: NextSetDraft): string {
  const text = resolveWeightString(draft);
  return text || "—";
}

export function formatNextSetDraftReps(draft: NextSetDraft): string {
  return draft.reps != null ? String(draft.reps) : "—";
}

export function formatNextSetDraftRepsString(draft: NextSetDraft): string {
  return typeof draft.reps_string === "string" && draft.reps_string.trim()
    ? draft.reps_string.trim()
    : "—";
}
