import { apiFetch, parseErrorDetail } from "@/api/client";
import type {
  StatsActivityHeatmap,
  StatsActivityHeatmapDay,
  StatsBucketId,
  StatsChartPoint,
  StatsKpiSnapshot,
  StatsMetricId,
  StatsPeriodId,
  StatsStreak,
  StatsStreaksRhythm,
  StatsTopExercise,
  StatsWorkoutTypeSlice,
} from "@/components/stats/types";
import { STATS_PERIOD_LABELS } from "@/components/stats/statsLabels";
import { getStatsPeriodDateRange } from "@/components/stats/statsUtils";
import { serializeIso8601QueryDateTime } from "@/utils/iso8601";

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Query start/end из чипа периода (для all — без параметров). */
function statsRangeQuery(period: StatsPeriodId): URLSearchParams {
  const qs = new URLSearchParams();
  const { startDate, endDate } = getStatsPeriodDateRange(period);
  const start = serializeIso8601QueryDateTime(startDate);
  const end = serializeIso8601QueryDateTime(endDate);
  if (start) qs.set("start", start);
  if (end) qs.set("end", end);
  return qs;
}

function normalizeHeatmapDays(raw: unknown): Record<string, StatsActivityHeatmapDay> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: Record<string, StatsActivityHeatmapDay> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_DAY_RE.test(key) || !value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    if (record.intensity !== 1 && record.intensity !== 2) continue;
    const note =
      typeof record.note === "string" && record.note.trim()
        ? record.note.trim()
        : null;
    result[key] = {
      intensity: record.intensity,
      note,
    };
  }
  return result;
}

function normalizeActivityHeatmap(raw: unknown): StatsActivityHeatmap {
  if (!raw || typeof raw !== "object") {
    throw new Error("Некорректный ответ сервера");
  }

  const payload = raw as Record<string, unknown>;
  const range = payload.range;
  if (!range || typeof range !== "object") {
    throw new Error("Некорректный диапазон календаря");
  }

  const rangeRecord = range as Record<string, unknown>;
  if (typeof rangeRecord.start !== "string" || typeof rangeRecord.end !== "string") {
    throw new Error("Некорректный диапазон календаря");
  }

  return {
    range: {
      start: rangeRecord.start,
      end: rangeRecord.end,
    },
    days: normalizeHeatmapDays(payload.days),
  };
}

export async function fetchActivityHeatmap(): Promise<StatsActivityHeatmap> {
  const response = await apiFetch("/api/v1/stats/activity-heatmap");
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }

  const data: unknown = await response.json();
  return normalizeActivityHeatmap(data);
}

function normalizeIsoDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  return ISO_DAY_RE.test(day) ? day : null;
}

function normalizeBestStreak(raw: unknown): StatsStreak | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const start = normalizeIsoDay(record.start);
  const end = normalizeIsoDay(record.end);
  if (
    !start ||
    !end ||
    typeof record.days !== "number" ||
    !Number.isFinite(record.days) ||
    record.days < 1
  ) {
    return null;
  }

  return {
    start,
    end,
    days: record.days,
  };
}

function normalizeStreaksRhythm(raw: unknown): StatsStreaksRhythm {
  if (!raw || typeof raw !== "object") {
    throw new Error("Некорректный ответ сервера");
  }

  const payload = raw as Record<string, unknown>;
  if (
    typeof payload.current_streak_days !== "number" ||
    !Number.isFinite(payload.current_streak_days) ||
    payload.current_streak_days < 0
  ) {
    throw new Error("Некорректные данные текущей серии");
  }

  const bestStreaks = Array.isArray(payload.best_streaks)
    ? payload.best_streaks
        .map((item) => normalizeBestStreak(item))
        .filter((item): item is StatsStreak => item !== null)
    : [];

  return {
    current_streak_days: payload.current_streak_days,
    best_streaks: bestStreaks,
  };
}

export async function fetchStreaksRhythm(): Promise<StatsStreaksRhythm> {
  const response = await apiFetch("/api/v1/stats/streaks-rhythm");
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }

  const data: unknown = await response.json();
  return normalizeStreaksRhythm(data);
}

export type StatsOverview = {
  period: StatsPeriodId;
  periodLabel: string;
  bucket: StatsBucketId;
  kpi: StatsKpiSnapshot;
  series: Record<StatsMetricId, StatsChartPoint[]>;
};

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeChartPoint(raw: unknown): StatsChartPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.label !== "string" || !record.label.trim()) return null;
  const value = asFiniteNumber(record.value);
  const sublabel =
    typeof record.sublabel === "string" && record.sublabel.trim()
      ? record.sublabel.trim()
      : undefined;
  return { label: record.label, sublabel, value };
}

function normalizeOverview(raw: unknown): StatsOverview {
  if (!raw || typeof raw !== "object") {
    throw new Error("Некорректный ответ сервера");
  }
  const payload = raw as Record<string, unknown>;
  const period = payload.period;
  if (
    period !== "7d" &&
    period !== "30d" &&
    period !== "3m" &&
    period !== "year" &&
    period !== "all"
  ) {
    throw new Error("Некорректный период статистики");
  }

  const kpiRaw = payload.kpi;
  if (!kpiRaw || typeof kpiRaw !== "object") {
    throw new Error("Некорректные KPI");
  }
  const kpiRecord = kpiRaw as Record<string, unknown>;
  const kpi: StatsKpiSnapshot = {
    workouts: asFiniteNumber(kpiRecord.workouts),
    durationMinutes: asFiniteNumber(kpiRecord.duration_minutes),
    tonnageKg: asFiniteNumber(kpiRecord.tonnage_kg),
    exercises: asFiniteNumber(kpiRecord.exercises),
    deltaWorkouts: String(kpiRecord.delta_workouts ?? ""),
    deltaDuration: String(kpiRecord.delta_duration ?? ""),
    deltaTonnage: String(kpiRecord.delta_tonnage ?? ""),
    deltaExercises: String(kpiRecord.delta_exercises ?? ""),
  };

  const seriesRaw =
    payload.series && typeof payload.series === "object"
      ? (payload.series as Record<string, unknown>)
      : {};
  const metrics: StatsMetricId[] = ["sessions", "duration", "tonnage", "exercises"];
  const series = {} as Record<StatsMetricId, StatsChartPoint[]>;
  for (const metric of metrics) {
    const points = Array.isArray(seriesRaw[metric])
      ? seriesRaw[metric]
          .map((item) => normalizeChartPoint(item))
          .filter((item): item is StatsChartPoint => item !== null)
      : [];
    series[metric] = points;
  }

  const bucketRaw = payload.bucket;
  const bucket: StatsBucketId =
    bucketRaw === "day" ||
    bucketRaw === "week" ||
    bucketRaw === "month" ||
    bucketRaw === "quarter" ||
    bucketRaw === "year"
      ? bucketRaw
      : "month";

  return {
    period,
    periodLabel:
      typeof payload.period_label === "string" && payload.period_label.trim()
        ? payload.period_label
        : STATS_PERIOD_LABELS[period],
    bucket,
    kpi,
    series,
  };
}

export async function fetchStatsOverview(
  period: StatsPeriodId,
  options?: { bucket?: StatsBucketId },
): Promise<StatsOverview> {
  const qs = statsRangeQuery(period);
  if (options?.bucket) {
    qs.set("bucket", options.bucket);
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  const response = await apiFetch(`/api/v1/stats/overview${suffix}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }
  return normalizeOverview(await response.json());
}

export async function fetchStatsTopExercises(period: StatsPeriodId): Promise<StatsTopExercise[]> {
  const qs = statsRangeQuery(period);
  qs.set("limit", "5");
  const response = await apiFetch(`/api/v1/stats/top-exercises?${qs}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object") throw new Error("Некорректный ответ сервера");
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "number" || typeof row.name !== "string") return null;
      return {
        id: row.id,
        name: row.name,
        sets: asFiniteNumber(row.sets),
        tonnageKg: asFiniteNumber(row.tonnage_kg),
        bestWeightKg: asFiniteNumber(row.best_weight_kg),
      } satisfies StatsTopExercise;
    })
    .filter((item): item is StatsTopExercise => item !== null);
}

export async function fetchStatsGymVisits(period: StatsPeriodId): Promise<
  Array<{ id: number; name: string; visitCount: number; lastWorkoutDate: string | null }>
> {
  const qs = statsRangeQuery(period);
  const suffix = qs.toString() ? `?${qs}` : "";
  const response = await apiFetch(`/api/v1/stats/gym-visits${suffix}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object") throw new Error("Некорректный ответ сервера");
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "number" || typeof row.name !== "string") return null;
      const last =
        typeof row.last_workout_date === "string" ? row.last_workout_date.slice(0, 10) : null;
      return {
        id: row.id,
        name: row.name,
        visitCount: asFiniteNumber(row.visit_count),
        lastWorkoutDate: last && ISO_DAY_RE.test(last) ? last : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function fetchStatsWorkoutTypes(
  period: StatsPeriodId,
): Promise<StatsWorkoutTypeSlice[]> {
  const qs = statsRangeQuery(period);
  const suffix = qs.toString() ? `?${qs}` : "";
  const response = await apiFetch(`/api/v1/stats/workout-types${suffix}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object") throw new Error("Некорректный ответ сервера");
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.label !== "string") return null;
      return {
        id: row.id,
        label: row.label,
        count: asFiniteNumber(row.count),
        percent: asFiniteNumber(row.percent),
      } satisfies StatsWorkoutTypeSlice;
    })
    .filter((item): item is StatsWorkoutTypeSlice => item !== null);
}
