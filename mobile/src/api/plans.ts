import { apiFetch, parseErrorDetail } from "@/api/client";
import type {
  CurrentProgram,
  PlannedSession,
  PlannedSessionSource,
  PlannedSessionStatus,
  ProgramCreatePayload,
  ProgramCyclePattern,
  ProgramDay,
  ProgramDayKind,
  ProgramScheduleType,
  ProgramSlotState,
} from "@/components/plans/types";

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizePlannedSessionStatus(raw: unknown): PlannedSessionStatus | null {
  if (raw === "plan_ready" || raw === "draft" || raw === "in_progress") return raw;
  return null;
}

function normalizePlannedSessionSource(raw: unknown): PlannedSessionSource | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (raw === "repeat_previous" || raw === "from_template") return raw;
  return undefined;
}

function normalizeIsoDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  return ISO_DAY_RE.test(day) ? day : null;
}

function normalizePlannedSession(raw: unknown): PlannedSession | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const date = normalizeIsoDay(record.date);
  const title = record.title;
  const status = normalizePlannedSessionStatus(record.status);
  const exercisesCount = record.exercises_count;
  const estimatedMinutes = record.estimated_minutes;

  if (
    !date ||
    typeof title !== "string" ||
    !title.trim() ||
    !status ||
    typeof exercisesCount !== "number" ||
    !Number.isInteger(exercisesCount) ||
    exercisesCount < 0 ||
    typeof estimatedMinutes !== "number" ||
    !Number.isInteger(estimatedMinutes) ||
    estimatedMinutes < 0
  ) {
    return null;
  }

  const gymName = record.gym_name;
  let normalizedGymName: string | null = null;
  if (gymName === null || gymName === undefined) {
    normalizedGymName = null;
  } else if (typeof gymName === "string") {
    normalizedGymName = gymName;
  } else {
    return null;
  }

  const source = normalizePlannedSessionSource(record.source);

  return {
    date,
    title: title.trim(),
    gym_name: normalizedGymName,
    exercises_count: exercisesCount,
    estimated_minutes: estimatedMinutes,
    status,
    ...(source ? { source } : {}),
  };
}

function normalizePlannedSessionList(raw: unknown): PlannedSession[] {
  if (!Array.isArray(raw)) {
    throw new Error("Некорректный ответ сервера");
  }

  return raw
    .map((item) => normalizePlannedSession(item))
    .filter((item): item is PlannedSession => item !== null);
}

/** Запланированные сессии для вкладки «Расписание» на /plans. */
export async function fetchPlannedSessions(): Promise<PlannedSession[]> {
  const response = await apiFetch("/api/v1/plans/scheduled");
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }

  const data: unknown = await response.json();
  return normalizePlannedSessionList(data);
}

function normalizeProgramDayKind(raw: unknown): ProgramDayKind | null {
  return raw === "workout" || raw === "rest" ? raw : null;
}

function normalizeProgramScheduleType(raw: unknown): ProgramScheduleType | null {
  return (
    raw === "week_fixed" ||
    raw === "sequence" ||
    raw === "cycle_pattern" ||
    raw === "weekly_quota"
  )
    ? raw
    : null;
}

function normalizePositiveIntList(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const values = raw.map((item) =>
    typeof item === "number" && Number.isInteger(item) && item >= 1 ? item : null,
  );
  if (values.some((item) => item === null)) return null;
  return values as number[];
}

function normalizeProgramCyclePattern(raw: unknown): ProgramCyclePattern | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const work = record.work;
  const rest = record.rest;
  if (
    typeof work !== "number" ||
    !Number.isInteger(work) ||
    work < 1 ||
    typeof rest !== "number" ||
    !Number.isInteger(rest) ||
    rest < 1
  ) {
    return null;
  }
  return { work, rest };
}

function normalizeOptionalNonNegativeInt(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) return raw;
  return null;
}

function normalizeProgramSlotState(
  raw: unknown,
  legacyDefault?: ProgramSlotState,
): ProgramSlotState | null | undefined {
  if (raw === undefined) return legacyDefault;
  if (raw === null) return null;
  if (raw === "done" || raw === "skip" || raw === "next") return raw;
  return legacyDefault;
}

function normalizeProgramDay(
  raw: unknown,
  scheduleType?: ProgramScheduleType,
): ProgramDay | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  if (typeof record.enabled !== "boolean") return null;

  const slot = record.slot;
  if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 1) {
    return null;
  }

  const kind = normalizeProgramDayKind(record.kind);
  if (!kind) return null;

  const isoWeekday = record.iso_weekday;
  const templateId = record.template_id;

  let normalizedIsoWeekday: number | null = null;
  if (isoWeekday === null || isoWeekday === undefined) {
    normalizedIsoWeekday = null;
  } else if (
    typeof isoWeekday === "number" &&
    Number.isInteger(isoWeekday) &&
    isoWeekday >= 1 &&
    isoWeekday <= 7
  ) {
    normalizedIsoWeekday = isoWeekday;
  } else {
    return null;
  }

  let normalizedTemplateId: number | null = null;
  if (templateId === null || templateId === undefined) {
    normalizedTemplateId = null;
  } else if (
    typeof templateId === "number" &&
    Number.isInteger(templateId) &&
    templateId >= 1
  ) {
    normalizedTemplateId = templateId;
  } else {
    return null;
  }

  const day: ProgramDay = {
    slot,
    kind,
    iso_weekday: normalizedIsoWeekday,
    template_id: normalizedTemplateId,
    enabled: record.enabled,
  };

  if (scheduleType === "sequence") {
    const state = normalizeProgramSlotState(record.state, "next");
    if (state !== undefined) {
      day.state = state;
    }
  }

  return day;
}

function normalizeProgram(raw: unknown): CurrentProgram | null {
  if (!raw || typeof raw !== "object") return null;

  const payload = raw as Record<string, unknown>;
  if (
    typeof payload.id !== "number" ||
    !Number.isInteger(payload.id) ||
    payload.id < 1 ||
    typeof payload.name !== "string" ||
    !payload.name.trim()
  ) {
    return null;
  }

  const scheduleType = normalizeProgramScheduleType(payload.schedule_type);
  if (!scheduleType) return null;

  if (scheduleType === "cycle_pattern") {
    const pattern = normalizeProgramCyclePattern(payload.pattern);
    const templates = normalizePositiveIntList(payload.templates);
    if (!pattern || !templates) return null;
    return {
      id: payload.id,
      name: payload.name.trim(),
      schedule_type: "cycle_pattern",
      pattern,
      templates,
    };
  }

  if (scheduleType === "weekly_quota") {
    const sessions = payload.sessions_per_week;
    if (
      typeof sessions !== "number" ||
      !Number.isInteger(sessions) ||
      sessions < 1 ||
      sessions > 7
    ) {
      return null;
    }
    const rotation = normalizePositiveIntList(payload.rotation);
    if (!rotation) return null;
    const minRest = normalizeOptionalNonNegativeInt(payload.min_rest_between_sessions_hours);
    if (minRest === null) return null;
    return {
      id: payload.id,
      name: payload.name.trim(),
      schedule_type: "weekly_quota",
      sessions_per_week: sessions,
      rotation,
      ...(minRest != null ? { min_rest_between_sessions_hours: minRest } : {}),
    };
  }

  const days = Array.isArray(payload.days)
    ? payload.days
        .map((item) => normalizeProgramDay(item, scheduleType))
        .filter((item): item is ProgramDay => item !== null)
    : [];

  if (days.length === 0) return null;

  return {
    id: payload.id,
    name: payload.name.trim(),
    schedule_type: scheduleType,
    days,
  };
}

function normalizeProgramList(raw: unknown): CurrentProgram[] {
  if (!Array.isArray(raw)) {
    throw new Error("Некорректный ответ сервера");
  }

  return raw
    .map((item) => normalizeProgram(item))
    .filter((item): item is CurrentProgram => item !== null);
}

/** Текущая программа для вкладки «Программа» на /plans. */
export async function fetchCurrentProgram(): Promise<CurrentProgram> {
  const program = await fetchCurrentProgramOptional();
  if (!program) {
    throw new Error("Текущая программа не задана");
  }
  return program;
}

/** Текущая программа; 404 → null (у пользователя ещё нет текущей). */
export async function fetchCurrentProgramOptional(): Promise<CurrentProgram | null> {
  const response = await apiFetch("/api/v1/plans/program/current");
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }

  const data: unknown = await response.json();
  const program = normalizeProgram(data);
  if (!program) {
    throw new Error("Некорректные данные программы");
  }
  return program;
}

/** Каталог программ для выбора на /plans. */
export async function fetchPrograms(): Promise<CurrentProgram[]> {
  const response = await apiFetch("/api/v1/plans/program");
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }

  const data: unknown = await response.json();
  return normalizeProgramList(data);
}

/** Создание программы тренировок (POST /plans/program). */
export async function createProgram(
  body: ProgramCreatePayload,
  options?: { isCurrent?: boolean },
): Promise<CurrentProgram> {
  const query = options?.isCurrent ? "?is_current=true" : "";
  const response = await apiFetch(`/api/v1/plans/program${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(payload));
  }

  const data: unknown = await response.json();
  const program = normalizeProgram(data);
  if (!program) {
    throw new Error("Некорректный ответ после создания программы");
  }
  return program;
}

/** Одна программа по id. */
export async function fetchProgram(programId: number): Promise<CurrentProgram> {
  const response = await apiFetch(`/api/v1/plans/program/${programId}`);
  if (response.status === 404) {
    throw new Error("Программа не найдена");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }

  const data: unknown = await response.json();
  const program = normalizeProgram(data);
  if (!program) {
    throw new Error("Некорректные данные программы");
  }
  return program;
}

/** Обновление программы (PATCH /plans/program/{id}). */
export async function updateProgram(
  programId: number,
  body: ProgramCreatePayload,
  options?: { isCurrent?: boolean },
): Promise<CurrentProgram> {
  let query = "";
  if (options?.isCurrent === true) query = "?is_current=true";
  else if (options?.isCurrent === false) query = "?is_current=false";

  const response = await apiFetch(`/api/v1/plans/program/${programId}${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(payload));
  }

  const data: unknown = await response.json();
  const program = normalizeProgram(data);
  if (!program) {
    throw new Error("Некорректный ответ после обновления программы");
  }
  return program;
}

/** Удаление программы (DELETE /plans/program/{id}). */
export async function deleteProgram(programId: number): Promise<void> {
  const response = await apiFetch(`/api/v1/plans/program/${programId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(payload));
  }
}
