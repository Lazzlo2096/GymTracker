import { apiFetch, parseErrorDetail } from "@/api/client";
import type {
  TemplatePlannedSetMock,
  WorkoutTemplateDetailMock,
  WorkoutTemplateExerciseMock,
  WorkoutTemplateMock,
} from "@/components/plans/types";
import {
  buildPlannedSetsForDraft,
  estimateMinutesFromExercises,
  exerciseMockToDraft,
  newExerciseDraft,
  type TemplateExerciseDraft,
} from "@/components/plans/templatePlanDraft";
import { emit } from "@/utils/eventBus";
import {
  emitTemplateDetailUpdated,
  markTemplatesListStale,
} from "@/events/templateDetailEvents";

type WorkoutTemplateListApiResponse = {
  items?: WorkoutTemplateMock[];
};

function coerceId(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return String(Math.trunc(raw));
  }
  return "";
}

function mapPlannedSet(raw: unknown): TemplatePlannedSetMock | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const type = entry.type;
  if (type === "rest") {
    const restSeconds = Number(entry.rest_seconds);
    if (!Number.isFinite(restSeconds) || restSeconds < 0) return null;
    return { type: "rest", rest_seconds: restSeconds };
  }
  if (type === "set") {
    const weightLabel =
      typeof entry.weight_label === "string"
        ? entry.weight_label
        : typeof entry.weight_string === "string"
          ? entry.weight_string
          : null;
    const repsLabel =
      typeof entry.reps_label === "string"
        ? entry.reps_label
        : typeof entry.reps_string === "string"
          ? entry.reps_string
          : null;
    return {
      type: "set",
      weight_kg:
        typeof entry.weight_kg === "number" && Number.isFinite(entry.weight_kg)
          ? entry.weight_kg
          : entry.weight_kg === null
            ? null
            : undefined,
      reps:
        typeof entry.reps === "number" && Number.isFinite(entry.reps)
          ? entry.reps
          : entry.reps === null
            ? null
            : undefined,
      weight_label: weightLabel,
      reps_label: repsLabel,
    };
  }
  return null;
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number.parseInt(trimmed, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseOptionalFloat(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function mapExercise(raw: unknown): WorkoutTemplateExerciseMock | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = coerceId(row.id);
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) return null;

  const plannedRaw = Array.isArray(row.planned_sets) ? row.planned_sets : [];
  const planned_sets = plannedRaw
    .map(mapPlannedSet)
    .filter((item): item is TemplatePlannedSetMock => item != null);

  return {
    id,
    exercise_in_catalog_id:
      typeof row.exercise_in_catalog_id === "number" &&
      Number.isFinite(row.exercise_in_catalog_id) &&
      row.exercise_in_catalog_id > 0
        ? row.exercise_in_catalog_id
        : null,
    name,
    muscle_group: typeof row.muscle_group === "string" ? row.muscle_group : null,
    note: typeof row.note === "string" ? row.note : null,
    planned_sets_count:
      typeof row.planned_sets_count === "number" && Number.isFinite(row.planned_sets_count)
        ? row.planned_sets_count
        : null,
    planned_tonnage_kg:
      typeof row.planned_tonnage_kg === "number" && Number.isFinite(row.planned_tonnage_kg)
        ? row.planned_tonnage_kg
        : null,
    planned_all_reps:
      typeof row.planned_all_reps === "number" && Number.isFinite(row.planned_all_reps)
        ? row.planned_all_reps
        : null,
    planned_all_weight_kg:
      typeof row.planned_all_weight_kg === "number" &&
      Number.isFinite(row.planned_all_weight_kg)
        ? row.planned_all_weight_kg
        : null,
    planned_all_rest_seconds:
      typeof row.planned_all_rest_seconds === "number" &&
      Number.isFinite(row.planned_all_rest_seconds)
        ? row.planned_all_rest_seconds
        : null,
    planned_sets,
  };
}

function mapTemplateSummary(raw: unknown): WorkoutTemplateMock | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = coerceId(row.id);
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!id || !title) return null;

  const exercisesCount = Number(row.exercises_count);
  const estimatedRaw = row.estimated_minutes;
  const estimatedMinutes =
    estimatedRaw === null || estimatedRaw === undefined
      ? 0
      : Number(estimatedRaw);
  if (!Number.isFinite(exercisesCount) || exercisesCount < 0) return null;
  if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0) return null;

  return {
    id,
    title,
    description: typeof row.description === "string" ? row.description : null,
    gym_name: typeof row.gym_name === "string" ? row.gym_name : row.gym_name === null ? null : null,
    exercises_count: exercisesCount,
    estimated_minutes: estimatedMinutes,
    last_used_label:
      typeof row.last_used_label === "string" ? row.last_used_label : undefined,
  };
}

function mapTemplateDetail(raw: unknown): WorkoutTemplateDetailMock | null {
  const summary = mapTemplateSummary(raw);
  if (!summary) return null;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const exercisesRaw = Array.isArray(row.exercises) ? row.exercises : [];
  const exercises = exercisesRaw
    .map(mapExercise)
    .filter((item): item is WorkoutTemplateExerciseMock => item != null);

  return {
    ...summary,
    note: typeof row.note === "string" ? row.note : null,
    exercises,
  };
}

/** Список шаблонов для вкладки «Шаблоны» на /plans. */
export async function fetchWorkoutTemplates(): Promise<WorkoutTemplateMock[]> {
  const response = await apiFetch("/api/v1/workout_templates/");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
  const items = (payload as WorkoutTemplateListApiResponse).items;
  if (!Array.isArray(items)) {
    throw new Error("Сервер вернул некорректный список шаблонов");
  }
  return items
    .map(mapTemplateSummary)
    .filter((item): item is WorkoutTemplateMock => item != null);
}

/** Деталь шаблона для /plan-template/[id]. */
export async function fetchWorkoutTemplateById(
  templateId: string,
): Promise<WorkoutTemplateDetailMock | null> {
  const id = templateId.trim();
  if (!id) return null;

  const response = await apiFetch(
    `/api/v1/workout_templates/${encodeURIComponent(id)}`,
  );
  const payload = await response.json().catch(() => ({}));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
  const detail = mapTemplateDetail(payload);
  if (!detail) {
    throw new Error("Сервер вернул некорректный шаблон");
  }
  return detail;
}

export type UserGymOption = {
  id: number;
  name: string;
};

export type WorkoutTemplateWriteInput = {
  title: string;
  description?: string | null;
  note?: string | null;
  user_gym_id?: number | null;
  estimated_minutes?: number | null;
  /** Не передавать при PATCH метаданных — упражнения не затрагиваются. */
  exercises?: TemplateExerciseDraft[];
};

function mapPlannedSetToApi(entry: TemplatePlannedSetMock): Record<string, unknown> {
  if (entry.type === "rest") {
    return { type: "rest", rest_seconds: entry.rest_seconds };
  }
  const out: Record<string, unknown> = { type: "set" };
  if (entry.weight_kg != null) out.weight_kg = entry.weight_kg;
  if (entry.reps != null) out.reps = entry.reps;
  if (entry.weight_label) out.weight_label = entry.weight_label;
  if (entry.reps_label) out.reps_label = entry.reps_label;
  return out;
}

function buildExercisesApiPayload(drafts: TemplateExerciseDraft[]): Record<string, unknown>[] {
  return drafts
    .map((draft) => {
      if (draft.catalogId == null) return null;
      const planned_sets = buildPlannedSetsForDraft(draft).map(mapPlannedSetToApi);
      const custom = draft.useCustomPlan;
      const planned_sets_count =
        parseOptionalInt(draft.plannedSetsCount) ??
        (planned_sets.length > 0
          ? planned_sets.filter((row) => row.type === "set").length
          : null);

      const payload: Record<string, unknown> = {
        exercise_in_catalog_id: draft.catalogId,
        note: draft.note.trim() || null,
        planned_sets,
        planned_sets_count,
        planned_tonnage_kg: parseOptionalFloat(draft.plannedTonnageKg),
        planned_all_reps: custom ? null : parseOptionalInt(draft.reps),
        planned_all_weight_kg: custom ? null : parseOptionalFloat(draft.weight),
        planned_all_rest_seconds: custom ? null : parseOptionalInt(draft.restSeconds),
      };
      return payload;
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

function buildWritePayload(input: WorkoutTemplateWriteInput): Record<string, unknown> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Укажите название шаблона");
  }

  const payload: Record<string, unknown> = {
    title,
    description: input.description?.trim() || null,
    note: input.note?.trim() || null,
    user_gym_id: input.user_gym_id ?? null,
  };

  if (input.exercises !== undefined) {
    const exercises = buildExercisesApiPayload(input.exercises);
    const estimated =
      input.estimated_minutes != null && input.estimated_minutes > 0
        ? input.estimated_minutes
        : exercises.length > 0
          ? estimateMinutesFromExercises(input.exercises)
          : null;
    payload.exercises = exercises;
    payload.estimated_minutes = estimated;
  } else {
    payload.estimated_minutes =
      input.estimated_minutes != null && input.estimated_minutes > 0
        ? input.estimated_minutes
        : null;
  }

  return payload;
}

/** Список залов для выбора в форме шаблона. */
export async function fetchUserGymOptions(): Promise<UserGymOption[]> {
  const response = await apiFetch("/api/v1/user_gyms/");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
  if (!Array.isArray(payload)) {
    throw new Error("Сервер вернул некорректный список залов");
  }
  return payload
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const id = Number(item.id);
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!Number.isFinite(id) || id < 1 || !name) return null;
      return { id, name };
    })
    .filter((item): item is UserGymOption => item != null);
}

/** Создать шаблон тренировки. */
export async function createWorkoutTemplate(
  input: WorkoutTemplateWriteInput,
): Promise<WorkoutTemplateDetailMock> {
  const response = await apiFetch("/api/v1/workout_templates/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildWritePayload(input)),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
  const detail = mapTemplateDetail(payload);
  if (!detail) {
    throw new Error("Сервер вернул некорректный шаблон");
  }
  return detail;
}

/** Обновить шаблон тренировки. */
export async function updateWorkoutTemplate(
  templateId: string,
  input: WorkoutTemplateWriteInput,
): Promise<WorkoutTemplateDetailMock> {
  const id = templateId.trim();
  if (!id) {
    throw new Error("Некорректный идентификатор шаблона");
  }
  const response = await apiFetch(`/api/v1/workout_templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildWritePayload(input)),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
  const detail = mapTemplateDetail(payload);
  if (!detail) {
    throw new Error("Сервер вернул некорректный шаблон");
  }
  markTemplatesListStale();
  emitTemplateDetailUpdated(id, detail);
  return detail;
}

export type AppendCatalogExercisesOptions = {
  /** Если известно с экрана шаблона — не делаем GET до PATCH (важно для пустого шаблона). */
  existingExercisesCount?: number;
};

/** Добавить упражнения из каталога в существующий шаблон (как add_exercise у тренировки). */
export async function appendCatalogExercisesToWorkoutTemplate(
  templateId: string,
  catalogIds: number[],
  options: AppendCatalogExercisesOptions = {},
): Promise<WorkoutTemplateDetailMock> {
  const id = templateId.trim();
  if (!id) {
    throw new Error("Некорректный идентификатор шаблона");
  }
  if (catalogIds.length === 0) {
    const current = await fetchWorkoutTemplateById(id);
    if (!current) throw new Error("Шаблон не найден");
    return current;
  }

  const newDrafts = catalogIds.map((catalogId) => newExerciseDraft({ catalogId }));
  const knownCount = options.existingExercisesCount;

  let exercises: TemplateExerciseDraft[];
  if (knownCount === 0) {
    exercises = newDrafts;
  } else {
    const current = await fetchWorkoutTemplateById(id);
    if (!current) {
      throw new Error("Шаблон не найден");
    }
    exercises = [...current.exercises.map(exerciseMockToDraft), ...newDrafts];
  }

  return replaceWorkoutTemplateExercises(id, exercises);
}

/** Обновить список упражнений шаблона (PATCH только exercises). */
export async function replaceWorkoutTemplateExercises(
  templateId: string,
  exercises: TemplateExerciseDraft[],
): Promise<WorkoutTemplateDetailMock> {
  const id = templateId.trim();
  if (!id) {
    throw new Error("Некорректный идентификатор шаблона");
  }

  const response = await apiFetch(`/api/v1/workout_templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exercises: buildExercisesApiPayload(exercises) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }

  const detail = mapTemplateDetail(payload);
  if (!detail) {
    throw new Error("Сервер вернул некорректный шаблон");
  }
  markTemplatesListStale();
  emitTemplateDetailUpdated(id, detail);
  return detail;
}

/** Удалить шаблон тренировки. */
export async function deleteWorkoutTemplate(templateId: string): Promise<void> {
  const id = templateId.trim();
  if (!id) return;
  const response = await apiFetch(`/api/v1/workout_templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (response.status === 404) return;
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(parseErrorDetail(payload));
  }
}
