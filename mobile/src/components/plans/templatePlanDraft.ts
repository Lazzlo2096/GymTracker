import type {
  TemplatePlannedSetMock,
  WorkoutTemplateDetailMock,
  WorkoutTemplateExerciseMock,
} from "@/components/plans/types";
import { countTemplateWorkingSets } from "@/components/plans/templatePlanFormat";

export type TemplateExerciseDraft = {
  localId: string;
  catalogId: number | null;
  name: string;
  muscle_group: string;
  note: string;
  sets: string;
  reps: string;
  weight: string;
  restSeconds: string;
  /** planned_sets_count — число рабочих подходов. */
  plannedSetsCount: string;
  /** planned_tonnage_kg — суммарный тоннаж, кг. */
  plannedTonnageKg: string;
  /** Точный план подходов/отдыхов (planned_sets_json); только при useCustomPlan. */
  plannedSets: TemplatePlannedSetMock[];
  /** Пользователь задал planned_sets_json вручную через timeline. */
  useCustomPlan: boolean;
};

export function clonePlannedSets(
  planned: TemplatePlannedSetMock[],
): TemplatePlannedSetMock[] {
  return planned.map((entry) => {
    if (entry.type === "rest") {
      return { type: "rest", rest_seconds: entry.rest_seconds };
    }
    return {
      type: "set",
      weight_kg: entry.weight_kg ?? null,
      reps: entry.reps ?? null,
      weight_label: entry.weight_label ?? null,
      reps_label: entry.reps_label ?? null,
    };
  });
}

/** Можно ли описать план одними полями «N подходов × повторы / вес / отдых». */
export function isUniformSimplePlan(planned_sets: TemplatePlannedSetMock[]): boolean {
  if (planned_sets.length === 0) return true;

  const workSets = planned_sets.filter((entry) => entry.type === "set");
  const rests = planned_sets.filter((entry) => entry.type === "rest");
  if (workSets.length === 0) return false;

  const firstSet = workSets[0];
  const setsUniform = workSets.every(
    (entry) =>
      entry.type === "set" &&
      entry.reps === firstSet.reps &&
      entry.weight_kg === firstSet.weight_kg &&
      (entry.reps_label ?? null) === (firstSet.reps_label ?? null) &&
      (entry.weight_label ?? null) === (firstSet.weight_label ?? null),
  );
  if (!setsUniform) return false;

  if (rests.length === 0) {
    return workSets.length === 1 && planned_sets.length === 1;
  }

  const firstRest = rests[0];
  const restsUniform = rests.every(
    (entry) => entry.type === "rest" && entry.rest_seconds === firstRest.rest_seconds,
  );
  if (!restsUniform) return false;

  const expectedLength = workSets.length * 2 - 1;
  if (planned_sets.length !== expectedLength) return false;

  for (let i = 0; i < planned_sets.length; i += 1) {
    const expectedType = i % 2 === 0 ? "set" : "rest";
    if (planned_sets[i]?.type !== expectedType) return false;
  }

  return true;
}

/** planned_sets_json из API — ручной timeline, а не legacy uniform + planned_all_*. */
export function isTimelinePlannedJsonFromApi(
  exercise: WorkoutTemplateExerciseMock,
  planned_sets: TemplatePlannedSetMock[],
): boolean {
  if (planned_sets.length === 0) return false;

  const hasSummaryAll =
    exercise.planned_all_reps != null ||
    exercise.planned_all_weight_kg != null ||
    exercise.planned_all_rest_seconds != null;

  if (hasSummaryAll && isUniformSimplePlan(planned_sets)) {
    return false;
  }

  return true;
}

export function computeTonnageFromPlannedSets(
  planned_sets: TemplatePlannedSetMock[],
): number | null {
  let total = 0;
  let found = false;
  for (const entry of planned_sets) {
    if (entry.type !== "set") continue;
    if (entry.weight_kg == null || entry.reps == null) continue;
    total += entry.weight_kg * entry.reps;
    found = true;
  }
  return found ? total : null;
}

export function suggestTonnageFromDraft(draft: TemplateExerciseDraft): string {
  const count = Math.max(0, parseInt(draft.plannedSetsCount || draft.sets, 10) || 0);
  const reps = Math.max(0, parseInt(draft.reps, 10) || 0);
  const weightRaw = draft.weight.trim().replace(",", ".");
  const weight = weightRaw ? Number(weightRaw) : NaN;
  if (count > 0 && reps > 0 && Number.isFinite(weight) && weight > 0) {
    return String(count * reps * weight);
  }
  const fromPlan = computeTonnageFromPlannedSets(draft.plannedSets);
  return fromPlan != null ? String(fromPlan) : "";
}

export function newExerciseDraft(partial?: Partial<TemplateExerciseDraft>): TemplateExerciseDraft {
  const base = {
    localId: partial?.localId ?? `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    catalogId: partial?.catalogId ?? null,
    name: partial?.name ?? "",
    muscle_group: partial?.muscle_group ?? "",
    note: partial?.note ?? "",
    sets: partial?.sets ?? "",
    reps: partial?.reps ?? "",
    weight: partial?.weight ?? "",
    restSeconds: partial?.restSeconds ?? "",
    plannedSetsCount: partial?.plannedSetsCount ?? partial?.sets ?? "",
    plannedTonnageKg: partial?.plannedTonnageKg ?? "",
    useCustomPlan: partial?.useCustomPlan ?? false,
    plannedSets: partial?.useCustomPlan ? clonePlannedSets(partial?.plannedSets ?? []) : [],
  };
  if (!base.plannedTonnageKg.trim() && !base.useCustomPlan) {
    base.plannedTonnageKg = suggestTonnageFromDraft(base);
  }
  return base;
}

export function deriveSimplePlanFromPlannedSets(
  planned_sets: TemplatePlannedSetMock[],
): Pick<TemplateExerciseDraft, "sets" | "reps" | "weight" | "restSeconds"> {
  const workSets = planned_sets.filter((entry) => entry.type === "set");
  const rests = planned_sets.filter((entry) => entry.type === "rest");
  const firstSet = workSets[0];
  const firstRest = rests[0];

  return {
    sets: String(workSets.length > 0 ? workSets.length : 3),
    reps:
      firstSet?.type === "set" && firstSet.reps != null
        ? String(firstSet.reps)
        : "10",
    weight:
      firstSet?.type === "set" && firstSet.weight_kg != null
        ? String(firstSet.weight_kg)
        : "",
    restSeconds:
      firstRest?.type === "rest" ? String(firstRest.rest_seconds) : "90",
  };
}

export function exerciseMockToDraft(exercise: WorkoutTemplateExerciseMock): TemplateExerciseDraft {
  const plannedSetsRaw = clonePlannedSets(exercise.planned_sets);
  const plan = deriveSimplePlanFromPlannedSets(plannedSetsRaw);
  const catalogId =
    typeof exercise.exercise_in_catalog_id === "number" &&
    Number.isFinite(exercise.exercise_in_catalog_id) &&
    exercise.exercise_in_catalog_id > 0
      ? exercise.exercise_in_catalog_id
      : null;
  const useCustomPlan = isTimelinePlannedJsonFromApi(exercise, plannedSetsRaw);
  const timelineSets = useCustomPlan ? plannedSetsRaw : [];
  const legacyUniformPlan =
    !useCustomPlan && plannedSetsRaw.length > 0 ? plan : null;

  const plannedSetsCount =
    exercise.planned_sets_count != null && Number.isFinite(exercise.planned_sets_count)
      ? String(exercise.planned_sets_count)
      : useCustomPlan
        ? String(plannedSetsRaw.filter((entry) => entry.type === "set").length)
        : legacyUniformPlan?.sets ?? "";

  const reps =
    exercise.planned_all_reps != null && Number.isFinite(exercise.planned_all_reps)
      ? String(exercise.planned_all_reps)
      : useCustomPlan
        ? plan.reps
        : legacyUniformPlan?.reps ?? "";

  const weight =
    exercise.planned_all_weight_kg != null && Number.isFinite(exercise.planned_all_weight_kg)
      ? String(exercise.planned_all_weight_kg)
      : useCustomPlan
        ? plan.weight
        : legacyUniformPlan?.weight ?? "";

  const restSeconds =
    exercise.planned_all_rest_seconds != null &&
    Number.isFinite(exercise.planned_all_rest_seconds)
      ? String(exercise.planned_all_rest_seconds)
      : useCustomPlan
        ? plan.restSeconds
        : legacyUniformPlan?.restSeconds ?? "";

  const plannedTonnageKg =
    exercise.planned_tonnage_kg != null && Number.isFinite(exercise.planned_tonnage_kg)
      ? String(exercise.planned_tonnage_kg)
      : "";

  return newExerciseDraft({
    localId: exercise.id,
    catalogId,
    name: exercise.name,
    muscle_group: exercise.muscle_group ?? "",
    note: exercise.note ?? "",
    plannedSets: timelineSets,
    useCustomPlan,
    sets: plannedSetsCount,
    plannedSetsCount,
    reps,
    weight,
    restSeconds,
    plannedTonnageKg,
  });
}

export function detailToFormDefaults(detail: WorkoutTemplateDetailMock): {
  title: string;
  description: string;
  note: string;
  estimatedMinutes: string;
  exercises: TemplateExerciseDraft[];
} {
  return {
    title: detail.title,
    description: detail.description ?? "",
    note: detail.note ?? "",
    estimatedMinutes:
      detail.estimated_minutes > 0 ? String(detail.estimated_minutes) : "",
    exercises:
      detail.exercises.length > 0
        ? detail.exercises.map(exerciseMockToDraft)
        : [newExerciseDraft()],
  };
}

export function buildPreviewPlannedSetsFromDraft(
  draft: TemplateExerciseDraft,
): TemplatePlannedSetMock[] {
  const setsRaw = (draft.plannedSetsCount || draft.sets).trim();
  if (!setsRaw) return [];
  const sets = Number.parseInt(setsRaw, 10);
  if (!Number.isFinite(sets) || sets <= 0) return [];

  const setsClamped = Math.min(sets, 20);
  const repsRaw = draft.reps.trim();
  const repsParsed = repsRaw ? Number.parseInt(repsRaw, 10) : null;
  const reps =
    repsParsed != null && Number.isFinite(repsParsed) ? repsParsed : null;

  const weightRaw = draft.weight.trim().replace(",", ".");
  const weightParsed = weightRaw ? Number(weightRaw) : null;
  const weightKg =
    weightParsed != null && Number.isFinite(weightParsed) ? weightParsed : null;

  const restRaw = draft.restSeconds.trim();
  const restParsed = restRaw ? Number.parseInt(restRaw, 10) : null;
  const restSeconds =
    restParsed != null && Number.isFinite(restParsed) && restParsed >= 0
      ? restParsed
      : null;

  const out: TemplatePlannedSetMock[] = [];
  for (let i = 0; i < setsClamped; i += 1) {
    out.push({ type: "set", reps, weight_kg: weightKg });
    if (i < setsClamped - 1) {
      out.push({ type: "rest", rest_seconds: restSeconds ?? 0 });
    }
  }
  return out;
}

/** План для отображения в timeline: JSON или превью из быстрых полей. */
export function getDisplayPlannedSetsForDraft(
  draft: TemplateExerciseDraft,
): TemplatePlannedSetMock[] {
  if (draft.useCustomPlan) {
    return clonePlannedSets(draft.plannedSets);
  }
  return buildPreviewPlannedSetsFromDraft(draft);
}

export function buildPlannedSetsForDraft(
  draft: TemplateExerciseDraft,
): TemplatePlannedSetMock[] {
  if (draft.useCustomPlan && draft.plannedSets.length > 0) {
    return clonePlannedSets(draft.plannedSets);
  }
  return [];
}

export function countDraftWorkingSetsFromSimple(draft: TemplateExerciseDraft): number {
  const raw = draft.plannedSetsCount || draft.sets;
  const count = raw.trim() ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function formatPlannedSetsJsonPreview(
  planned: TemplatePlannedSetMock[],
): string {
  const rows = planned.map((entry) => {
    if (entry.type === "rest") {
      return { type: "rest", rest_seconds: entry.rest_seconds };
    }
    const out: Record<string, unknown> = { type: "set" };
    if (entry.reps != null) out.reps = entry.reps;
    if (entry.weight_kg != null) out.weight_kg = entry.weight_kg;
    if (entry.weight_label) out.weight_label = entry.weight_label;
    if (entry.reps_label) out.reps_label = entry.reps_label;
    return out;
  });
  return JSON.stringify(rows, null, 2);
}

export function estimateMinutesFromExercises(drafts: TemplateExerciseDraft[]): number {
  let total = 0;
  for (const draft of drafts) {
    if (draft.useCustomPlan && draft.plannedSets.length > 0) {
      const planned = draft.plannedSets;
      const workSets = planned.filter((entry) => entry.type === "set").length;
      const rests = planned.filter((entry) => entry.type === "rest");
      const restSeconds =
        rests[0]?.type === "rest"
          ? rests[0].rest_seconds
          : parseInt(draft.restSeconds, 10) || 90;
      total += workSets * 45 + Math.max(0, workSets - 1) * restSeconds;
    } else {
      const workSets = countDraftWorkingSetsFromSimple(draft);
      const restSeconds = parseInt(draft.restSeconds, 10) || 90;
      total += workSets * 45 + Math.max(0, workSets - 1) * restSeconds;
    }
  }
  return Math.max(5, Math.round(total / 60));
}

export function countDraftWorkingSets(drafts: TemplateExerciseDraft[]): number {
  return drafts.reduce((sum, draft) => {
    if (draft.useCustomPlan && draft.plannedSets.length > 0) {
      return sum + countTemplateWorkingSets(draft.plannedSets);
    }
    return sum + countDraftWorkingSetsFromSimple(draft);
  }, 0);
}

export function countExerciseWorkingSets(exercise: WorkoutTemplateExerciseMock): number {
  return countTemplateWorkingSets(exercise.planned_sets);
}
