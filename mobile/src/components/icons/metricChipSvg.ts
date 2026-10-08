import {
  FIGMA_BARBELL_OUTLINE_46,
  FIGMA_CHART_BARS_46,
  FIGMA_CLOCK_46,
  FIGMA_KETTLEBELL_46,
  FIGMA_LIST_BULLETS_46,
  FIGMA_STAR_46,
} from "@/components/icons/figmaPaths";

/** Все метрики-чипы: единый SVG 46×46 (круг + глиф), как в Figma 59-184. */
export type WorkoutMetricIconKind =
  | "volume"
  | "tonnage"
  | "duration"
  | "maxWeight"
  | "sets"
  | "best";

const PATH_BY_KIND: Record<WorkoutMetricIconKind, string> = {
  volume: FIGMA_BARBELL_OUTLINE_46,
  tonnage: FIGMA_KETTLEBELL_46,
  duration: FIGMA_CLOCK_46,
  maxWeight: FIGMA_CHART_BARS_46,
  sets: FIGMA_LIST_BULLETS_46,
  best: FIGMA_STAR_46,
};

/** XML как в Figma export (Group 11/12/13), цвета подставляются из metricChipToken. */
export function metricChipSvgXml(
  kind: WorkoutMetricIconKind,
  circle: string,
  fg: string,
): string {
  const path = PATH_BY_KIND[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 46" fill="none" preserveAspectRatio="xMidYMid meet"><circle cx="23" cy="23" r="23" fill="${circle}"/><path d="${path}" fill="${fg}"/></svg>`;
}
