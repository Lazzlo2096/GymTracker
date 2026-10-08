import { apiFetch, parseErrorDetail } from "@/api/client";
import type { WeightMeasurement } from "@/components/weight/types";
import { serializeIso8601QueryDateTime } from "@/utils/iso8601";

function normalizeWeightMeasurement(raw: unknown): WeightMeasurement | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const measuredAt = record.measured_at;

  const bodyFat = record.body_fat_percent;
  const bodyFatOk =
    bodyFat === null ||
    (typeof bodyFat === "number" && Number.isFinite(bodyFat));

  const bodyScore = record.body_score;
  const bodyScoreOk =
    bodyScore === null ||
    (typeof bodyScore === "number" && Number.isFinite(bodyScore));

  const note = record.note;
  const noteOk = note === null || note === undefined || typeof note === "string";

  if (
    typeof record.id !== "number" ||
    !Number.isInteger(record.id) ||
    typeof measuredAt !== "string" ||
    !measuredAt.trim() ||
    typeof record.weight_kg !== "number" ||
    !Number.isFinite(record.weight_kg) ||
    !bodyFatOk ||
    !bodyScoreOk ||
    !noteOk
  ) {
    return null;
  }

  return {
    id: record.id,
    measured_at: measuredAt,
    weight_kg: record.weight_kg,
    body_fat_percent: bodyFat === null ? null : bodyFat,
    body_score: bodyScore === null ? null : bodyScore,
    note: note == null ? null : note,
  };
}

function normalizeWeightDiary(raw: unknown): WeightMeasurement[] {
  if (!Array.isArray(raw)) {
    throw new Error("Некорректный ответ сервера");
  }

  const items = raw
    .map((item) => normalizeWeightMeasurement(item))
    .filter((item): item is WeightMeasurement => item !== null);

  if (items.length !== raw.length) {
    throw new Error("Некорректные данные дневника веса");
  }

  return items;
}

type WeightDiaryQuery = {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  limit?: number | null;
};

function weightDiaryPath(query?: WeightDiaryQuery): string {
  const qs = new URLSearchParams();
  const startDate = serializeIso8601QueryDateTime(query?.startDate);
  const endDate = serializeIso8601QueryDateTime(query?.endDate);
  if (startDate) qs.set("start_date", startDate);
  if (endDate) qs.set("end_date", endDate);
  if (query?.limit != null && Number.isFinite(query.limit) && query.limit > 0) {
    qs.set("limit", String(Math.trunc(query.limit)));
  }
  const queryString = qs.toString();
  return `/api/v1/user_weights/diary${queryString ? `?${queryString}` : ""}`;
}

export async function fetchWeightDiary(query?: WeightDiaryQuery): Promise<WeightMeasurement[]> {
  const response = await apiFetch(weightDiaryPath(query));
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(body));
  }

  const data: unknown = await response.json();
  return normalizeWeightDiary(data);
}

/** Последнее измерение из дневника веса (для weight_composition). */
export async function fetchLatestBodyweightKg(options?: {
  at?: string | Date | null;
}): Promise<number | null> {
  const diary = await fetchWeightDiary({
    endDate: options?.at ?? null,
    limit: 1,
  });
  const latest = diary[0];
  if (!latest || !Number.isFinite(latest.weight_kg)) return null;
  return latest.weight_kg;
}
