export type PlansTabId = "schedule" | "templates" | "program";

export type PlannedSessionStatus = "plan_ready" | "draft" | "in_progress";

export type PlannedSessionSource = "repeat_previous" | "from_template";

export type PlannedSession = {
  /** ISO `YYYY-MM-DD` */
  date: string;
  title: string;
  gym_name: string | null;
  exercises_count: number;
  estimated_minutes: number;
  status: PlannedSessionStatus;
  source?: PlannedSessionSource;
};

export type WorkoutTemplateMock = {
  id: string;
  title: string;
  /** Краткое описание шаблона, напр. «Фокус на жимах, объём 20 подходов». */
  description?: string | null;
  gym_name: string | null;
  exercises_count: number;
  estimated_minutes: number;
  last_used_label?: string;
};

export type TemplatePlannedSetMock =
  | {
      type: "set";
      weight_kg?: number | null;
      reps?: number | null;
      weight_label?: string | null;
      reps_label?: string | null;
    }
  | {
      type: "rest";
      rest_seconds: number;
    };

export type WorkoutTemplateExerciseMock = {
  id: string;
  exercise_in_catalog_id?: number | null;
  name: string;
  muscle_group?: string | null;
  note?: string | null;
  planned_sets_count?: number | null;
  planned_tonnage_kg?: number | null;
  planned_all_reps?: number | null;
  planned_all_weight_kg?: number | null;
  planned_all_rest_seconds?: number | null;
  planned_sets: TemplatePlannedSetMock[];
};

export type WorkoutTemplateDetailMock = WorkoutTemplateMock & {
  note?: string | null;
  exercises: WorkoutTemplateExerciseMock[];
};

export type ProgramScheduleType =
  | "week_fixed"
  | "sequence"
  | "cycle_pattern"
  | "weekly_quota";
export type ProgramDayKind = "workout" | "rest";
export type ProgramSlotState = "done" | "skip" | "next";

export type ProgramCyclePattern = {
  work: number;
  rest: number;
};

export type ProgramDay = {
  slot: number;
  kind: ProgramDayKind;
  iso_weekday: number | null;
  template_id: number | null;
  enabled: boolean;
  /** Только sequence: done | skip | next. При чтении legacy без поля — next. */
  state?: ProgramSlotState | null;
};

type ProgramBase = {
  id: number;
  name: string;
};

export type WeekFixedProgram = ProgramBase & {
  schedule_type: "week_fixed";
  days: ProgramDay[];
};

export type SequenceProgram = ProgramBase & {
  schedule_type: "sequence";
  days: ProgramDay[];
};

export type CyclePatternProgram = ProgramBase & {
  schedule_type: "cycle_pattern";
  pattern: ProgramCyclePattern;
  templates: number[];
};

export type WeeklyQuotaProgram = ProgramBase & {
  schedule_type: "weekly_quota";
  sessions_per_week: number;
  rotation: number[];
  min_rest_between_sessions_hours?: number | null;
};

export type CurrentProgram =
  | WeekFixedProgram
  | SequenceProgram
  | CyclePatternProgram
  | WeeklyQuotaProgram;

export type ProgramCreatePayload =
  | Omit<WeekFixedProgram, "id">
  | Omit<SequenceProgram, "id">
  | Omit<CyclePatternProgram, "id">
  | Omit<WeeklyQuotaProgram, "id">;
