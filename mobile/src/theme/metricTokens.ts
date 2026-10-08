/**
 * Палитра метрик и акцента по Figma (node 59-184).
 */
export type MetricVariant = "green" | "blue" | "amber" | "violet" | "teal";

/** Светлая тема: hex из экспорта Figma. */
export const FIGMA_METRIC_LIGHT = {
  volume: { fg: "#00BA00", circle: "#DFFFD1" },
  tonnage: { fg: "#0078E3", circle: "#DDF2FE" },
  duration: { fg: "#00ADCC", circle: "#D4FCFF" },
} as const;

/** Акцент UI / таб «Тренировки» / локация в карточке (Figma). */
export const FIGMA_ACCENT_LIGHT = {
  fg: "#752CD2",
  circle: "#EEE9FF",
} as const;

const LIGHT: Record<MetricVariant, { fg: string; circle: string }> = {
  green: FIGMA_METRIC_LIGHT.volume,
  blue: FIGMA_METRIC_LIGHT.tonnage,
  amber: { fg: "#B45309", circle: "#FFECD4" },
  violet: FIGMA_ACCENT_LIGHT,
  teal: FIGMA_METRIC_LIGHT.duration,
};

const DARK: Record<MetricVariant, { fg: string; circle: string }> = {
  green: { fg: "#5AE85A", circle: "#1A2E1A" },
  blue: { fg: "#5CB8FF", circle: "#152B40" },
  amber: { fg: "#FBBF24", circle: "#3A3010" },
  violet: { fg: "#B794F6", circle: "#2D2640" },
  teal: { fg: "#3DD4E8", circle: "#0E2A32" },
};

export function metricToken(variant: MetricVariant, dark: boolean): { fg: string; circle: string } {
  return dark ? DARK[variant] : LIGHT[variant];
}

/** Круг + иконка метрики на карточках — всегда палитра Figma 59-184 (не зависит от тёмной темы). */
const CHIP_ON_CARD: Record<MetricVariant, { fg: string; circle: string }> = {
  green: FIGMA_METRIC_LIGHT.volume,
  blue: FIGMA_METRIC_LIGHT.tonnage,
  amber: LIGHT.amber,
  violet: FIGMA_ACCENT_LIGHT,
  teal: FIGMA_METRIC_LIGHT.duration,
};

export function metricChipToken(variant: MetricVariant): { fg: string; circle: string } {
  return CHIP_ON_CARD[variant];
}

export function uiAccentFg(dark: boolean): string {
  return metricToken("violet", dark).fg;
}

export function uiAccentSoft(dark: boolean): string {
  return metricToken("violet", dark).circle;
}

export function uiAccentMuted(dark: boolean): string {
  return dark ? "#A89BC8" : "#5D586C";
}

/** Artboard чипа метрики в Figma (круг + глиф 46×46). */
export const FIGMA_METRIC_ARTBOARD = 46;

/** Ширина белой карточки тренировки в макете 59-184 (px). */
export const FIGMA_WORKOUT_CARD_INNER_WIDTH = 538;

/** Диаметр чипа по умолчанию = Figma 46px (для фикс. слотов без scale). */
export const METRIC_CHIP_DIAMETER = FIGMA_METRIC_ARTBOARD;

/**
 * Диаметр чипа пропорционально ширине карточки (как в макете 46px при 538px).
 */
export function metricChipDisplaySize(contentWidth: number): number {
  if (contentWidth <= 0) return FIGMA_METRIC_ARTBOARD;
  const scaled = Math.round(
    (FIGMA_METRIC_ARTBOARD * contentWidth) / FIGMA_WORKOUT_CARD_INNER_WIDTH,
  );
  return Math.min(FIGMA_METRIC_ARTBOARD, Math.max(28, scaled));
}

/** Базовые диаметры (масштабируй через metricChipDisplaySize на экране). */
export const METRIC_CIRCLE_DIAMETER = {
  workoutList: FIGMA_METRIC_ARTBOARD,
  workoutDetailMetrics: FIGMA_METRIC_ARTBOARD,
  summaryCard: FIGMA_METRIC_ARTBOARD,
  exerciseRow: FIGMA_METRIC_ARTBOARD,
} as const;

/** Размер SVG-глифа Figma-чипа (= диаметр круга). */
export function metricGlyphSize(circleDiameter: number): number {
  return circleDiameter;
}

/**
 * Размер Material-глифа внутри круга (≈18px при чипе 46px — как bbox Figma-метрик).
 * Material-иконки рисуются плотнее 22px и визуально крупнее Figma-SVG в том же круге.
 */
export const METRIC_MATERIAL_GLYPH_ARTBOARD = 18;

export function metricMaterialGlyphSize(circleDiameter: number): number {
  return Math.round((circleDiameter * METRIC_MATERIAL_GLYPH_ARTBOARD) / FIGMA_METRIC_ARTBOARD);
}

/** Размеры глифов по контекстам (синхрон с METRIC_CIRCLE_DIAMETER). */
export const METRIC_ICON_SIZES = {
  workoutList: metricGlyphSize(METRIC_CIRCLE_DIAMETER.workoutList),
  workoutDetailMetrics: metricGlyphSize(METRIC_CIRCLE_DIAMETER.workoutDetailMetrics),
  summaryCard: metricGlyphSize(METRIC_CIRCLE_DIAMETER.summaryCard),
  exerciseRow: metricGlyphSize(METRIC_CIRCLE_DIAMETER.exerciseRow),
  catalogStat: METRIC_MATERIAL_GLYPH_ARTBOARD,
} as const;
