import type { WeightMeasurement } from "@/components/weight/types";

const CHART_HEIGHT = 115;
const HORIZONTAL_INSET_RATIO = 0.05;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 24;

export type WeightTrendChartPoint = {
  x: number;
  y: number;
  weightKg: number;
  showLabel: boolean;
};

export type WeightTrendChartModel = {
  width: number;
  height: number;
  goalLineX1: number;
  goalLineX2: number;
  goalLineY: number | null;
  pathD: string;
  points: WeightTrendChartPoint[];
};

function buildLinePath(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  }

  return points
    .map((point, index) => {
      const cmd = index === 0 ? "M" : "L";
      return `${cmd} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ");
}

export function buildWeightTrendChart(
  measurements: WeightMeasurement[],
  chartWidth: number,
  targetWeightKg: number | null | undefined,
): WeightTrendChartModel | null {
  if (measurements.length === 0 || chartWidth <= 0) return null;

  const chronological = [...measurements].sort(
    (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
  );

  const weights = chronological.map((item) => item.weight_kg);
  const goalKg =
    typeof targetWeightKg === "number" && Number.isFinite(targetWeightKg) && targetWeightKg > 0
      ? targetWeightKg
      : null;

  const rawMin = goalKg !== null ? Math.min(...weights, goalKg) : Math.min(...weights);
  const rawMax = goalKg !== null ? Math.max(...weights, goalKg) : Math.max(...weights);
  const span = rawMax - rawMin;
  const pad = span > 0 ? span * 0.12 : 0.5;
  const domainMin = rawMin - pad;
  const domainMax = rawMax + pad;
  const domainSpan = domainMax - domainMin;

  const paddingLeft = chartWidth * HORIZONTAL_INSET_RATIO;
  const paddingRight = chartWidth * HORIZONTAL_INSET_RATIO;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const toX = (index: number) => {
    if (chronological.length === 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index / (chronological.length - 1)) * plotWidth;
  };

  const toY = (weightKg: number) =>
    PADDING_TOP + ((domainMax - weightKg) / domainSpan) * plotHeight;

  const lastIndex = chronological.length - 1;
  const points: WeightTrendChartPoint[] = chronological.map((item, index) => ({
    x: toX(index),
    y: toY(item.weight_kg),
    weightKg: item.weight_kg,
    showLabel: index === 0 || index === lastIndex,
  }));

  return {
    width: chartWidth,
    height: CHART_HEIGHT,
    goalLineX1: paddingLeft,
    goalLineX2: chartWidth - paddingRight,
    goalLineY: goalKg !== null ? toY(goalKg) : null,
    pathD: buildLinePath(points),
    points,
  };
}
