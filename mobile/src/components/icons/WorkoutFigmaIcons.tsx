import React from "react";
import Svg, { Path, SvgXml } from "react-native-svg";
import { metricChipSvgXml, type WorkoutMetricIconKind } from "@/components/icons/metricChipSvg";
import {
  FIGMA_BARBELL_OUTLINE_35,
  FIGMA_BARBELL_OUTLINE_46,
  FIGMA_CHART_BARS_46,
  FIGMA_CLOCK_46,
  FIGMA_KETTLEBELL_46,
  FIGMA_LIST_BULLETS_46,
  FIGMA_STAR_46,
} from "@/components/icons/figmaPaths";
import { metricChipToken, type MetricVariant } from "@/theme/metricTokens";

type IconProps = {
  size: number;
  color: string;
};

/** Горизонтальная штанга (Figma io:barbell-outline) — таб-бар, пустые состояния. */
export function BarbellOutlineIcon({ size, color }: IconProps) {
  const height = (size * 22) / 35;
  return (
    <Svg width={size} height={height} viewBox="0 0 35 22" fill="none">
      <Path d={FIGMA_BARBELL_OUTLINE_35} fill={color} />
    </Svg>
  );
}

/** Как в Figma raw SVG: artboard 46×46, круг r=23 + глиф. */
const FIGMA_METRIC_VIEWBOX = "0 0 46 46";
const FIGMA_METRIC_CENTER = 23;
const FIGMA_METRIC_RADIUS = 23;

export type { WorkoutMetricIconKind } from "@/components/icons/metricChipSvg";

function MetricSvgIcon({
  size,
  color,
  path,
}: IconProps & { path: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={FIGMA_METRIC_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      fill="none"
    >
      <Path d={path} fill={color} />
    </Svg>
  );
}

const METRIC_KIND_VARIANT: Record<WorkoutMetricIconKind, MetricVariant> = {
  volume: "green",
  tonnage: "blue",
  duration: "teal",
  maxWeight: "blue",
  sets: "violet",
  best: "teal",
};

/**
 * Чип метрики целиком (фон + глиф), как в Figma — без отдельного View-круга.
 */
export function MetricChipIcon({
  kind,
  size,
}: {
  kind: WorkoutMetricIconKind;
  size: number;
}) {
  const variant = METRIC_KIND_VARIANT[kind];
  const { fg, circle } = metricChipToken(variant);
  const px = Math.round(size);
  return (
    <SvgXml
      xml={metricChipSvgXml(kind, circle, fg)}
      width={px}
      height={px}
    />
  );
}

/** Метрика «Объём» (упражнения). */
export function MetricVolumeIcon(props: IconProps) {
  return <MetricSvgIcon {...props} path={FIGMA_BARBELL_OUTLINE_46} />;
}

/** Метрика «Тоннаж». */
export function MetricTonnageIcon(props: IconProps) {
  return <MetricSvgIcon {...props} path={FIGMA_KETTLEBELL_46} />;
}

/** Метрика «Длительность». */
export function MetricDurationIcon(props: IconProps) {
  return <MetricSvgIcon {...props} path={FIGMA_CLOCK_46} />;
}

export function WorkoutMetricIcon({
  kind,
  size,
  color,
}: IconProps & { kind: WorkoutMetricIconKind }) {
  switch (kind) {
    case "volume":
      return <MetricVolumeIcon size={size} color={color} />;
    case "tonnage":
      return <MetricTonnageIcon size={size} color={color} />;
    case "duration":
      return <MetricDurationIcon size={size} color={color} />;
    case "maxWeight":
      return <MetricSvgIcon size={size} color={color} path={FIGMA_CHART_BARS_46} />;
    case "sets":
      return <MetricSvgIcon size={size} color={color} path={FIGMA_LIST_BULLETS_46} />;
    case "best":
      return <MetricSvgIcon size={size} color={color} path={FIGMA_STAR_46} />;
  }
}
