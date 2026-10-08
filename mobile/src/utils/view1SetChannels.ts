import {
  computeWeightCompositionCaches,
  parseWeightComposition,
} from "@/domain/weightComposition";
import type { NextSetDraft } from "@/domain/nextSetDraft";
import type { ExerciseTimelineEvent } from "@/utils/exerciseTimeline";

export const VIEW1_CHANNEL_EMPTY = "—";

export function view1SetChannelsNativeId(setNumber: number): string {
  return `view1-set-${setNumber}-channels`;
}

export type View1SetChannels = {
  weightKg: string;
  reps: string;
  weightString: string;
  repsString: string;
  compositionDisplay: string;
  compositionTotalKg: string;
  metaLine: string;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatKgShort(kg: number): string {
  const rounded = Math.round(kg * 1000) / 1000;
  if (rounded === Math.trunc(rounded)) return String(Math.trunc(rounded));
  return String(rounded).replace(".", ",");
}

function formatNumericWeight(entry: Record<string, unknown>): string {
  const w = finiteNumber(entry.weight_kg) ?? finiteNumber(entry.weight);
  return w != null ? `${formatKgShort(w)} кг` : VIEW1_CHANNEL_EMPTY;
}

function formatNumericReps(entry: Record<string, unknown>): string {
  const r = finiteNumber(entry.reps);
  return r != null ? String(Math.trunc(r)) : VIEW1_CHANNEL_EMPTY;
}

function formatTextWeight(entry: Record<string, unknown>): string {
  const raw = entry.weight_string;
  return typeof raw === "string" && raw.trim() ? raw.trim() : VIEW1_CHANNEL_EMPTY;
}

function formatTextReps(entry: Record<string, unknown>): string {
  const raw = entry.reps_string;
  return typeof raw === "string" && raw.trim() ? raw.trim() : VIEW1_CHANNEL_EMPTY;
}

function compositionChannelsFromRaw(raw: unknown): Pick<
  View1SetChannels,
  "compositionDisplay" | "compositionTotalKg"
> {
  const composition = parseWeightComposition(raw);
  if (!composition?.terms?.length) {
    return {
      compositionDisplay: VIEW1_CHANNEL_EMPTY,
      compositionTotalKg: VIEW1_CHANNEL_EMPTY,
    };
  }

  const caches =
    composition.cached_display != null || composition.cached_effective_kg != null
      ? {
          cached_display: composition.cached_display ?? null,
          cached_effective_kg: composition.cached_effective_kg ?? null,
        }
      : computeWeightCompositionCaches(composition);

  const display =
    typeof caches.cached_display === "string" && caches.cached_display.trim()
      ? caches.cached_display.trim()
      : VIEW1_CHANNEL_EMPTY;
  const totalKg =
    caches.cached_effective_kg != null
      ? `итого ${formatKgShort(caches.cached_effective_kg)} кг.`
      : VIEW1_CHANNEL_EMPTY;

  return { compositionDisplay: display, compositionTotalKg: totalKg };
}

function hasNonZeroNumber(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value !== 0;
}

function formatTimelineNumber(value: number): string {
  if (value === Math.trunc(value)) return String(Math.trunc(value));
  return String(value).replace(".", ",");
}

function formatSetSecondsLabel(sec: number): string {
  const rounded = Math.max(0, Math.round(sec));
  if (rounded >= 60) {
    const m = Math.floor(rounded / 60);
    const s = rounded % 60;
    return s > 0 ? `${m} мин ${s} с` : `${m} мин`;
  }
  return `${rounded} с`;
}

function parseClockLikeToSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== "string" || !value.trim()) return null;
  const parts = value.trim().split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 1) return Math.max(0, parts[0]);
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return null;
}

export function view1SetMetaLineFromEvent(event: ExerciseTimelineEvent): string {
  if (event.type !== "set") return "";

  const parts: string[] = [];
  const setSec =
    finiteNumber(event.set_seconds) ??
    parseClockLikeToSeconds((event as Record<string, unknown>).set_time);
  if (hasNonZeroNumber(setSec)) {
    parts.push(formatSetSecondsLabel(setSec!));
  }
  const hr = finiteNumber(event.heart_rate_right_after);
  if (hasNonZeroNumber(hr)) {
    parts.push(`❤️ ${formatTimelineNumber(hr!)} уд/мин`);
  }
  const rating = finiteNumber(event.rating);
  if (hasNonZeroNumber(rating)) {
    parts.push(`⭐ ${rating}/10`);
  }
  if (event.reached_failure === true) {
    parts.push("до отказа");
  }
  if (event.effort_level) {
    parts.push(event.effort_level);
  }

  return parts.join(" · ");
}

export function view1SetChannelsFromLogEntry(
  entry: Record<string, unknown>,
  metaLine = "",
): View1SetChannels {
  const composition = compositionChannelsFromRaw(entry.weight_composition);
  return {
    weightKg: formatNumericWeight(entry),
    reps: formatNumericReps(entry),
    weightString: formatTextWeight(entry),
    repsString: formatTextReps(entry),
    ...composition,
    metaLine,
  };
}

export function view1SetChannelsFromNextSetDraft(draft: NextSetDraft): View1SetChannels {
  const composition = compositionChannelsFromRaw(draft.weight_composition);
  return {
    weightKg:
      draft.weight_kg != null ? `${formatKgShort(draft.weight_kg)} кг` : VIEW1_CHANNEL_EMPTY,
    reps: draft.reps != null ? String(draft.reps) : VIEW1_CHANNEL_EMPTY,
    weightString:
      typeof draft.weight_string === "string" && draft.weight_string.trim()
        ? draft.weight_string.trim()
        : VIEW1_CHANNEL_EMPTY,
    repsString:
      typeof draft.reps_string === "string" && draft.reps_string.trim()
        ? draft.reps_string.trim()
        : VIEW1_CHANNEL_EMPTY,
    ...composition,
    metaLine: "",
  };
}
