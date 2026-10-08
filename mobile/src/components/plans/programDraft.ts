import type {
  CurrentProgram,
  ProgramCreatePayload,
  ProgramCyclePattern,
  ProgramDay,
  ProgramDayKind,
  ProgramScheduleType,
} from "@/components/plans/types";

export type ProgramDraftState = {
  name: string;
  scheduleType: ProgramScheduleType;
  days: ProgramDay[];
  pattern: ProgramCyclePattern;
  cycleTemplates: number[];
  sessionsPerWeek: number;
  rotation: number[];
  minRestHours: string;
  setAsCurrent: boolean;
};

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export const PROGRAM_SCHEDULE_TYPE_OPTIONS: ReadonlyArray<{
  id: ProgramScheduleType;
  label: string;
  hint: string;
}> = [
  {
    id: "week_fixed",
    label: "По дням недели",
    hint: "Слоты привязаны к понедельнику–воскресенью",
  },
  {
    id: "sequence",
    label: "Последовательность",
    hint: "Цикл слотов без привязки к дню недели",
  },
  {
    id: "cycle_pattern",
    label: "Цикл трен./отдых",
    hint: "N тренировок, M дней отдыха, ротация шаблонов",
  },
  {
    id: "weekly_quota",
    label: "Квота в неделю",
    hint: "N тренировок в любые дни недели",
  },
];

export function weekdayLabel(isoWeekday: number): string {
  return WEEKDAY_LABELS[isoWeekday - 1] ?? `День ${isoWeekday}`;
}

export function createDefaultWeekFixedDays(): ProgramDay[] {
  return Array.from({ length: 7 }, (_, index) => ({
    slot: index + 1,
    kind: "rest" as ProgramDayKind,
    iso_weekday: index + 1,
    template_id: null,
    enabled: false,
  }));
}

export function createDefaultSequenceDays(templateId: number | null): ProgramDay[] {
  return [
    {
      slot: 1,
      kind: "workout",
      iso_weekday: null,
      template_id: templateId,
      enabled: templateId != null,
      state: templateId != null ? "next" : null,
    },
  ];
}

/** Расставляет state для sequence при сохранении (ровно один next). */
export function ensureSequenceDayStates(
  days: ProgramDay[],
  preserveExisting = false,
): ProgramDay[] {
  const hasExplicitStates = days.some((day) => day.state != null);
  if (preserveExisting && hasExplicitStates) {
    const nextCount = days.filter((day) => day.state === "next").length;
    if (nextCount === 1) {
      return days.map((day, index) => ({
        ...day,
        slot: index + 1,
        iso_weekday: null,
        state: day.state ?? null,
      }));
    }
  }

  let assignedNext = false;
  return days.map((day, index) => {
    const base: ProgramDay = {
      ...day,
      slot: index + 1,
      iso_weekday: null,
    };
    if (day.kind === "rest" || !day.enabled) {
      return { ...base, state: null };
    }
    if (!assignedNext) {
      assignedNext = true;
      return { ...base, state: "next" };
    }
    return { ...base, state: null };
  });
}

export function createEmptyProgramDraft(
  scheduleType: ProgramScheduleType = "week_fixed",
  defaultTemplateId: number | null = null,
): ProgramDraftState {
  return {
    name: "",
    scheduleType,
    days:
      scheduleType === "week_fixed"
        ? createDefaultWeekFixedDays()
        : scheduleType === "sequence"
          ? createDefaultSequenceDays(defaultTemplateId)
          : [],
    pattern: { work: 2, rest: 1 },
    cycleTemplates: defaultTemplateId != null ? [defaultTemplateId] : [],
    sessionsPerWeek: 3,
    rotation: defaultTemplateId != null ? [defaultTemplateId] : [],
    minRestHours: "",
    setAsCurrent: true,
  };
}

export function programToDraft(program: CurrentProgram, isCurrent: boolean): ProgramDraftState {
  const base = createEmptyProgramDraft(program.schedule_type);

  if (program.schedule_type === "week_fixed" || program.schedule_type === "sequence") {
    return {
      ...base,
      name: program.name,
      scheduleType: program.schedule_type,
      days: program.days.map((day) => ({ ...day })),
      setAsCurrent: isCurrent,
    };
  }

  if (program.schedule_type === "cycle_pattern") {
    return {
      ...base,
      name: program.name,
      scheduleType: "cycle_pattern",
      pattern: { ...program.pattern },
      cycleTemplates: [...program.templates],
      setAsCurrent: isCurrent,
    };
  }

  return {
    ...base,
    name: program.name,
    scheduleType: "weekly_quota",
    sessionsPerWeek: program.sessions_per_week,
    rotation: [...program.rotation],
    minRestHours:
      program.min_rest_between_sessions_hours != null
        ? String(program.min_rest_between_sessions_hours)
        : "",
    setAsCurrent: isCurrent,
  };
}

export function switchDraftScheduleType(
  draft: ProgramDraftState,
  nextType: ProgramScheduleType,
  defaultTemplateId: number | null,
): ProgramDraftState {
  if (draft.scheduleType === nextType) return draft;

  const base = createEmptyProgramDraft(nextType, defaultTemplateId);
  return {
    ...base,
    name: draft.name,
    setAsCurrent: draft.setAsCurrent,
  };
}

function parseOptionalNonNegativeInt(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

export function validateProgramDraft(draft: ProgramDraftState): string | null {
  if (!draft.name.trim()) {
    return "Введите название программы";
  }

  if (draft.scheduleType === "week_fixed" || draft.scheduleType === "sequence") {
    if (draft.days.length === 0) {
      return "Добавьте хотя бы один слот";
    }

    const hasWorkout = draft.days.some(
      (day) => day.enabled && day.kind === "workout" && day.template_id != null,
    );
    if (!hasWorkout) {
      return "Включите хотя бы одну тренировку с шаблоном";
    }

    for (const day of draft.days) {
      if (day.enabled && day.kind === "workout" && day.template_id == null) {
        return `Слот ${day.slot}: выберите шаблон для тренировки`;
      }
    }

    if (draft.scheduleType === "sequence") {
      const withStates = ensureSequenceDayStates(draft.days, true);
      const nextCount = withStates.filter((day) => day.state === "next").length;
      if (nextCount !== 1) {
        return "В последовательности должен быть ровно один слот со state=next";
      }
    }
    return null;
  }

  if (draft.scheduleType === "cycle_pattern") {
    if (draft.pattern.work < 1 || draft.pattern.rest < 1) {
      return "Укажите число тренировочных и отдыхательных дней (минимум 1)";
    }
    if (draft.cycleTemplates.length === 0) {
      return "Добавьте хотя бы один шаблон в ротацию";
    }
    return null;
  }

  if (draft.sessionsPerWeek < 1 || draft.sessionsPerWeek > 7) {
    return "Количество тренировок в неделю — от 1 до 7";
  }
  if (draft.rotation.length === 0) {
    return "Добавьте хотя бы один шаблон в ротацию";
  }
  const minRest = parseOptionalNonNegativeInt(draft.minRestHours);
  if (minRest === null) {
    return "Минимальный отдых между тренировками — целое число часов ≥ 0";
  }
  return null;
}

export function programDraftToCreatePayload(draft: ProgramDraftState): ProgramCreatePayload {
  const name = draft.name.trim();

  if (draft.scheduleType === "week_fixed") {
    return {
      name,
      schedule_type: "week_fixed",
      days: draft.days.map((day, index) => {
        const { state: _state, ...rest } = day;
        return {
          ...rest,
          slot: index + 1,
        };
      }),
    };
  }

  if (draft.scheduleType === "sequence") {
    return {
      name,
      schedule_type: "sequence",
      days: ensureSequenceDayStates(draft.days, true).map((day) => ({
        slot: day.slot,
        kind: day.kind,
        iso_weekday: null,
        template_id: day.template_id,
        enabled: day.enabled,
        state: day.state ?? null,
      })),
    };
  }

  if (draft.scheduleType === "cycle_pattern") {
    return {
      name,
      schedule_type: "cycle_pattern",
      pattern: draft.pattern,
      templates: draft.cycleTemplates,
    };
  }

  const minRest = parseOptionalNonNegativeInt(draft.minRestHours);
  return {
    name,
    schedule_type: "weekly_quota",
    sessions_per_week: draft.sessionsPerWeek,
    rotation: draft.rotation,
    ...(minRest != null ? { min_rest_between_sessions_hours: minRest } : {}),
  };
}
