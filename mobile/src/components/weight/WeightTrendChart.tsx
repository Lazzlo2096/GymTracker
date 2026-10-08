import React from "react";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { WeightTrendChartModel } from "@/components/weight/weightDiaryTrendChart";
import { fonts } from "@/theme/typography";

export type WeightTrendChartColors = {
  line: string;
  pointFill: string;
  pointStroke: string;
  label: string;
  goalLine: string;
};

/** Цвета графика на синей карточке /weight-diary. */
export const WEIGHT_TREND_CHART_ON_BLUE: WeightTrendChartColors = {
  line: "#FFFFFF",
  pointFill: "#2D8CFF",
  pointStroke: "#FFFFFF",
  label: "#FFFFFF",
  goalLine: "rgba(255,255,255,0.55)",
};

type WeightTrendChartProps = {
  model: WeightTrendChartModel;
  colors: WeightTrendChartColors;
};

/** Линейный график веса с целевой линией (как на /weight-diary). */
export default function WeightTrendChart({ model, colors }: WeightTrendChartProps) {
  return (
    <Svg
      width="100%"
      height={model.height}
      viewBox={`0 0 ${model.width} ${model.height}`}
    >
      {model.goalLineY !== null ? (
        <Line
          x1={model.goalLineX1}
          y1={model.goalLineY}
          x2={model.goalLineX2}
          y2={model.goalLineY}
          stroke={colors.goalLine}
          strokeWidth="2"
          strokeDasharray="8 6"
        />
      ) : null}

      {model.pathD ? (
        <Path
          d={model.pathD}
          stroke={colors.line}
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {model.points.map((point, index) =>
        point.showLabel ? (
          <React.Fragment key={index}>
            <Circle
              cx={point.x}
              cy={point.y}
              r={7}
              fill={colors.pointFill}
              stroke={colors.pointStroke}
              strokeWidth={3}
            />
            <SvgText
              x={point.x}
              y={point.y - 15}
              fill={colors.label}
              fontSize="15"
              fontFamily={fonts.semiBold}
              textAnchor="middle"
            >
              {point.weightKg.toFixed(1)}
            </SvgText>
          </React.Fragment>
        ) : null,
      )}
    </Svg>
  );
}
