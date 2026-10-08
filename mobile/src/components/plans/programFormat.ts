import type { CurrentProgram, ProgramDay, ProgramScheduleType, WorkoutTemplateMock } from "@/components/plans/types";

const ISO_WEEKDAY_RU: { weekday: string; weekdayShort: string }[] = [
  { weekday: "Понедельник", weekdayShort: "пн" },
  { weekday: "Вторник", weekdayShort: "вт" },
  { weekday: "Среда", weekdayShort: "ср" },
  { weekday: "Четверг", weekdayShort: "чт" },
  { weekday: "Пятница", weekdayShort: "пт" },
  { weekday: "Суббота", weekdayShort: "сб" },
  { weekday: "Воскресенье", weekdayShort: "вс" },
];

export type ProgramDayView = {
  key: string;
  weekdayShort: string;
  templateTitle: string;
  enabled: boolean;
};

function pluralWorkDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${count} трени`;
  if (mod10 === 1) return `${count} треня`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} трени`;
  return `${count} трени`;
}

function pluralRestDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${count} отдыха`;
  if (mod10 === 1) return `${count} отдых`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} отдыха`;
  return `${count} отдыха`;
}

export function materializeProgramDays(program: CurrentProgram): ProgramDay[] {
  if (program.schedule_type === "cycle_pattern") {
    const days: ProgramDay[] = [];
    let templateIndex = 0;
    let slot = 1;
    const { work, rest } = program.pattern;

    for (let index = 0; index < work; index += 1) {
      days.push({
        slot: slot++,
        kind: "workout",
        iso_weekday: null,
        template_id: program.templates[templateIndex % program.templates.length] ?? null,
        enabled: true,
      });
      templateIndex += 1;
    }

    for (let index = 0; index < rest; index += 1) {
      days.push({
        slot: slot++,
        kind: "rest",
        iso_weekday: null,
        template_id: null,
        enabled: false,
      });
    }

    return days;
  }

  if (program.schedule_type === "weekly_quota") {
    return Array.from({ length: program.sessions_per_week }, (_, index) => ({
      slot: index + 1,
      kind: "workout" as const,
      iso_weekday: null,
      template_id: program.rotation[index % program.rotation.length] ?? null,
      enabled: true,
    }));
  }

  return program.days;
}

export function formatProgramDayLabel(
  day: ProgramDay,
  index: number,
  scheduleType?: ProgramScheduleType,
): Pick<ProgramDayView, "weekdayShort"> {
  if (scheduleType === "weekly_quota") {
    return { weekdayShort: "любой" };
  }
  if (day.iso_weekday != null) {
    return ISO_WEEKDAY_RU[day.iso_weekday - 1];
  }
  return { weekdayShort: `${index + 1}` };
}

export function resolveProgramTemplateTitle(
  templates: WorkoutTemplateMock[],
  day: ProgramDay,
): string {
  if (day.kind === "rest") return "Отдых";
  if (!day.template_id) return "Отдых";
  const match = templates.find((item) => item.id === String(day.template_id));
  return match?.title ?? `Шаблон #${day.template_id}`;
}

export function countProgramTrainingDays(days: ProgramDay[]): number {
  return days.filter((day) => day.enabled).length;
}

function pluralTrainingDaysPerWeek(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${count} тренировок в неделю`;
  if (mod10 === 1) return `${count} тренировка в неделю`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} тренировки в неделю`;
  return `${count} тренировок в неделю`;
}

function pluralTrainingSlots(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${count} тренировочных слотов`;
  if (mod10 === 1) return `${count} тренировочный слот`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} тренировочных слота`;
  return `${count} тренировочных слотов`;
}

export function formatProgramSummary(program: CurrentProgram): string {
  if (program.schedule_type === "cycle_pattern") {
    const { work, rest } = program.pattern;
    return `${pluralWorkDays(work)} → ${pluralRestDays(rest)}, цикл`;
  }

  if (program.schedule_type === "weekly_quota") {
    return `${pluralTrainingDaysPerWeek(program.sessions_per_week)}, любые дни`;
  }

  const days = materializeProgramDays(program);
  const count = countProgramTrainingDays(days);
  if (count === 0) return "Без тренировочных дней";
  if (program.schedule_type === "week_fixed") return pluralTrainingDaysPerWeek(count);
  const hasWeekdays = days.some((day) => day.iso_weekday != null);
  return hasWeekdays ? pluralTrainingDaysPerWeek(count) : pluralTrainingSlots(count);
}

export function mapProgramDaysToView(
  program: CurrentProgram,
  templates: WorkoutTemplateMock[],
): ProgramDayView[] {
  const days = materializeProgramDays(program);
  return days.map((day, index) => {
    const { weekdayShort } = formatProgramDayLabel(day, index, program.schedule_type);
    return {
      key:
        program.schedule_type === "weekly_quota"
          ? `quota-${day.slot}`
          : day.iso_weekday != null
            ? `iso-${day.iso_weekday}`
            : `slot-${day.slot}`,
      weekdayShort,
      templateTitle: resolveProgramTemplateTitle(templates, day),
      enabled: day.enabled,
    };
  });
}
