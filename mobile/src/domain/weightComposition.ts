/**
 * weight_composition v1 — состав веса подхода.
 * Эталон: ./weight_composition_v1.example.json
 *
 * Правила разрешения (независимые поля):
 * - weight_kg задан → используем его; иначе weight_composition.cached_effective_kg
 * - weight_string задан → используем его; иначе weight_composition.cached_display
 */

export const BODYWEIGHT_SOURCE_HISTORY = "user_bodyweight_history";
export const BODYWEIGHT_SOURCE_USER_ENTERED = "user_entered_now";

export type BodyweightTerm = {
  kind: "bodyweight";
  /** Снимок из дневника веса; только при source=user_bodyweight_history. */
  cached_bodyweight_kg?: number | null;
  /** Вес, введённый пользователем в конструкторе; только при source=user_entered_now. */
  user_entered_bodyweight_kg?: number | null;
  source?: string | null;
};

export type PlatesTerm = {
  kind: "plates";
  kgs?: number[];
  mirror?: boolean;
  meta?: Record<string, unknown>;
};

export type BarTerm = {
  kind: "bar";
  bar_kg?: number | null;
  meta?: Record<string, unknown>;
};

export type WeightCompositionTerm = BodyweightTerm | PlatesTerm | BarTerm;

export type WeightCompositionV1 = {
  version: 1;
  cached_effective_kg?: number | null;
  cached_display?: string | null;
  terms?: WeightCompositionTerm[];
};

export type SetLogEntry = Record<string, unknown>;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatKgDisplay(kg: number): string {
  const rounded = Math.round(kg * 1000) / 1000;
  if (rounded === Math.trunc(rounded)) return String(Math.trunc(rounded));
  return String(rounded)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

export function platesMetaLabel(meta: Record<string, unknown> | null | undefined): string {
  if (!meta) return "блины";
  for (const key of ["placement", "label"] as const) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  for (const value of Object.values(meta)) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "блины";
}

function platesPlacementFromMeta(meta: Record<string, unknown> | null | undefined): string {
  const value = meta?.placement;
  return typeof value === "string" ? value.trim() : "";
}

export function barMetaLabel(meta: Record<string, unknown> | null | undefined): string {
  if (!meta) return "гриф";
  const label = meta.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  return "гриф";
}

export function sumPlatesTermKg(term: PlatesTerm): number {
  const kgs = Array.isArray(term.kgs) ? term.kgs : [];
  let total = 0;
  for (const item of kgs) {
    if (typeof item === "number" && Number.isFinite(item)) total += item;
  }
  if (term.mirror === true) total *= 2;
  return Math.round(total * 1000) / 1000;
}

function resolveBodyweightKgFromTerm(term: BodyweightTerm): number | null {
  if (term.source === BODYWEIGHT_SOURCE_USER_ENTERED) {
    return finiteNumber(term.user_entered_bodyweight_kg);
  }
  return finiteNumber(term.cached_bodyweight_kg);
}

export function computeWeightCompositionCaches(composition: WeightCompositionV1): {
  cached_effective_kg: number | null;
  cached_display: string | null;
} {
  const effectiveParts: number[] = [];
  const displayParts: string[] = [];

  for (const term of composition.terms ?? []) {
    if (term.kind === "bodyweight") {
      const bw = resolveBodyweightKgFromTerm(term);
      if (bw != null) effectiveParts.push(bw);
      displayParts.push("св. вес");
      continue;
    }
    if (term.kind === "plates") {
      const platesSum = sumPlatesTermKg(term);
      if (platesSum) effectiveParts.push(platesSum);
      const label = platesMetaLabel(term.meta);
      if (platesSum) displayParts.push(`${label} ${formatKgDisplay(platesSum)}кг`);
      else if (label) displayParts.push(label);
      continue;
    }
    if (term.kind === "bar") {
      const barKg = finiteNumber(term.bar_kg);
      if (barKg != null) effectiveParts.push(barKg);
      const label = barMetaLabel(term.meta);
      if (barKg != null) displayParts.push(`${label} ${formatKgDisplay(barKg)}кг`);
      else if (label) displayParts.push(label);
    }
  }

  const cached_effective_kg = effectiveParts.length
    ? Math.round(effectiveParts.reduce((a, b) => a + b, 0) * 1000) / 1000
    : null;
  const cached_display = displayParts.length ? displayParts.join(" + ").slice(0, 128) : null;
  return { cached_effective_kg, cached_display };
}

export function refreshWeightComposition(
  composition: WeightCompositionV1,
  options?: { bodyweightKg?: number | null },
): WeightCompositionV1 {
  const terms = (composition.terms ?? []).map((term) => {
    if (term.kind !== "bodyweight") return term;
    if (options?.bodyweightKg == null) return term;
    if (term.source === BODYWEIGHT_SOURCE_USER_ENTERED) return term;
    return {
      ...term,
      cached_bodyweight_kg: Math.round(options.bodyweightKg * 1000) / 1000,
      source: BODYWEIGHT_SOURCE_HISTORY,
    };
  });
  const next: WeightCompositionV1 = { ...composition, version: 1, terms };
  const caches = computeWeightCompositionCaches(next);
  return { ...next, ...caches };
}

export function parseWeightComposition(raw: unknown): WeightCompositionV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;
  return raw as WeightCompositionV1;
}

export function resolveWeightKg(entry: SetLogEntry): number | null {
  const direct = finiteNumber(entry.weight_kg) ?? finiteNumber(entry.weight);
  if (direct != null) return direct;

  const composition = parseWeightComposition(entry.weight_composition);
  return finiteNumber(composition?.cached_effective_kg);
}

export function resolveWeightString(entry: SetLogEntry): string | null {
  const raw = entry.weight_string;
  if (typeof raw === "string" && raw.trim()) return raw.trim();

  const composition = parseWeightComposition(entry.weight_composition);
  const cached = composition?.cached_display;
  if (typeof cached === "string" && cached.trim()) return cached.trim();
  return null;
}

export function entryHasResolvableWeight(entry: SetLogEntry): boolean {
  return resolveWeightKg(entry) != null || resolveWeightString(entry) != null;
}

export const PLATE_STEP_KGS = [0.25, 1.25, 2.5, 5, 10] as const;

export const PLATE_PLACEMENT_PRESETS = [
  "пояс",
  "жилет",
  "гриф",
] as const;

export const BAR_PRESETS = [
  { standard: "olympic_men", barKg: 20, label: "олимпийский" },
  { standard: "olympic_women", barKg: 15, label: "олимпийский женский" },
  { standard: "ez_curl", barKg: 8, label: "EZ-гриф" },
  { standard: "straight_7", barKg: 7, label: "прямой" },
  { standard: "trap_bar", barKg: 25, label: "трап-гриф" },
  { standard: "safety_squat_bar", barKg: 30, label: "SSB" },
] as const;

export type BarPresetStandard = (typeof BAR_PRESETS)[number]["standard"];

export type WeightInputMode = "simple" | "bodyweight_plus" | "text";

export type BodyweightInputSource = "history" | "user_entered";

export type BodyweightTermDraft = {
  id: string;
  kind: "bodyweight";
  bodyweightKg: number | null;
  bodyweightSource: BodyweightInputSource;
};

export type PlatesTermDraft = {
  id: string;
  kind: "plates";
  plateKgs: number[];
  mirror: boolean;
  placement: string;
};

export type BarTermDraft = {
  id: string;
  kind: "bar";
  barKg: number | null;
  label: string;
  standard: BarPresetStandard | "custom" | null;
};

export type CompositionTermDraft = BodyweightTermDraft | PlatesTermDraft | BarTermDraft;

let compositionTermIdSeq = 0;

export function createCompositionTermId(): string {
  compositionTermIdSeq += 1;
  return `composition-term-${compositionTermIdSeq}`;
}

export function createBodyweightTermDraft(
  defaultKg: number | null = null,
): BodyweightTermDraft {
  return {
    id: createCompositionTermId(),
    kind: "bodyweight",
    bodyweightKg: defaultKg,
    bodyweightSource: "history",
  };
}

export function createPlatesTermDraft(): PlatesTermDraft {
  return {
    id: createCompositionTermId(),
    kind: "plates",
    plateKgs: [],
    mirror: false,
    placement: "",
  };
}

export function createBarTermDraft(): BarTermDraft {
  const preset = BAR_PRESETS[0];
  return {
    id: createCompositionTermId(),
    kind: "bar",
    barKg: preset.barKg,
    label: preset.label,
    standard: preset.standard,
  };
}

export function extractCompositionDraft(
  composition: WeightCompositionV1 | null,
): CompositionTermDraft[] | null {
  if (!composition?.terms?.length) return null;

  const drafts: CompositionTermDraft[] = [];
  for (const term of composition.terms) {
    if (term.kind === "bodyweight") {
      const fromDiary = term.source !== BODYWEIGHT_SOURCE_USER_ENTERED;
      drafts.push({
        id: createCompositionTermId(),
        kind: "bodyweight",
        bodyweightKg: fromDiary
          ? finiteNumber(term.cached_bodyweight_kg)
          : finiteNumber(term.user_entered_bodyweight_kg),
        bodyweightSource: fromDiary ? "history" : "user_entered",
      });
      continue;
    }
    if (term.kind === "plates") {
      drafts.push({
        id: createCompositionTermId(),
        kind: "plates",
        plateKgs: Array.isArray(term.kgs)
          ? term.kgs.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
          : [],
        mirror: term.mirror === true,
        placement: platesPlacementFromMeta(term.meta),
      });
      continue;
    }
    if (term.kind === "bar") {
      const meta = term.meta;
      const standard =
        meta && typeof meta.standard === "string"
          ? (meta.standard as BarPresetStandard | "custom")
          : null;
      drafts.push({
        id: createCompositionTermId(),
        kind: "bar",
        barKg: finiteNumber(term.bar_kg),
        label: barMetaLabel(meta),
        standard:
          standard && (BAR_PRESETS.some((p) => p.standard === standard) || standard === "custom")
            ? standard
            : null,
      });
    }
  }

  return drafts.length > 0 ? drafts : null;
}

export function buildCompositionFromDraft(
  terms: CompositionTermDraft[],
): WeightCompositionV1 {
  const compositionTerms: WeightCompositionTerm[] = [];

  for (const draft of terms) {
    if (draft.kind === "bodyweight") {
      if (draft.bodyweightSource === "user_entered") {
        compositionTerms.push({
          kind: "bodyweight",
          source: BODYWEIGHT_SOURCE_USER_ENTERED,
          user_entered_bodyweight_kg: draft.bodyweightKg,
        });
      } else {
        compositionTerms.push({
          kind: "bodyweight",
          source: BODYWEIGHT_SOURCE_HISTORY,
          cached_bodyweight_kg: draft.bodyweightKg,
        });
      }
      continue;
    }
    if (draft.kind === "bar") {
      const meta: Record<string, unknown> = {};
      const trimmedLabel = draft.label.trim();
      if (trimmedLabel) meta.label = trimmedLabel;
      if (draft.standard && draft.standard !== "custom") meta.standard = draft.standard;
      compositionTerms.push({
        kind: "bar",
        bar_kg: draft.barKg,
        meta,
      });
      continue;
    }
    const placement = draft.placement.trim();
    compositionTerms.push({
      kind: "plates",
      kgs: [...draft.plateKgs],
      mirror: draft.mirror,
      meta: placement ? { placement } : {},
    });
  }

  const next: WeightCompositionV1 = { version: 1, terms: compositionTerms };
  const caches = computeWeightCompositionCaches(next);
  return { ...next, ...caches };
}
