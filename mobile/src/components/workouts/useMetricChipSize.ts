import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { metricChipDisplaySize } from "@/theme/metricTokens";
import { workoutScreenHorizontalPadding } from "@/components/workouts/metricSnapLayout";

/** Диаметр чипа метрики под ширину экрана (Figma 46px @ 538px карточки). */
export function useMetricChipSize(extraHorizontalInset = 0): number {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const pad = workoutScreenHorizontalPadding(width) + extraHorizontalInset;
    return metricChipDisplaySize(width - pad * 2);
  }, [width, extraHorizontalInset]);
}
