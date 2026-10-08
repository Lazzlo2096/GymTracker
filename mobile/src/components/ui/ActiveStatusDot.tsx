import { trace } from "@/debug/traceLog";
import React, { useEffect, useRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "@/theme/appTheme";

type Props = {
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: number;
  accessibilityLabel?: string;
  /** Контекст для [TRACE] STATE — где на экране точка (например «workouts/42»). */
  traceContext?: string;
};

/** Красная точка «идёт сейчас» для is_active тренировки или упражнения. */
export default function ActiveStatusDot({
  visible = true,
  style,
  size = 8,
  accessibilityLabel = "Идёт сейчас",
  traceContext,
}: Props) {
  const theme = useAppTheme();
  const prevVisibleRef = useRef(visible);

  useEffect(() => {
    if (!traceContext || prevVisibleRef.current === visible) return;
    prevVisibleRef.current = visible;
    trace("STATE", `ActiveStatusDot ${traceContext}`, { visible });
  }, [visible, traceContext]);

  if (!visible) return null;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.danger,
        },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    />
  );
}
