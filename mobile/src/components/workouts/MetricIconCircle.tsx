import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  MetricChipIcon,
  type WorkoutMetricIconKind,
} from "@/components/icons/WorkoutFigmaIcons";
import {
  METRIC_CHIP_DIAMETER,
  metricChipToken,
  metricMaterialGlyphSize,
  type MetricVariant,
} from "@/theme/metricTokens";

type MaterialIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Подгонка optical size Material (fallback, когда нет figmaKind). */
const MATERIAL_ICON_OPTICAL_SCALE: Partial<Record<MaterialIconName, number>> = {
  "chart-bar": 0.92,
  star: 1.02,
  "format-list-bulleted": 0.94,
  "human-male-height-variant": 0.96,
  "weight-kilogram": 0.96,
  target: 0.94,
  history: 1.72,
};

type MetricIconCircleProps = {
  size?: number;
  variant?: MetricVariant;
  figmaKind?: WorkoutMetricIconKind;
  materialIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  children?: React.ReactNode;
  marginRight?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Цветной круг метрики с иконкой по центру.
 * Figma-метрики — единый SVG (фон + глиф); прочие — круг + центрированный глиф 22px в чипе 30px.
 */
export default function MetricIconCircle({
  size = METRIC_CHIP_DIAMETER,
  variant,
  figmaKind,
  materialIcon,
  children,
  marginRight = 0,
  style,
}: MetricIconCircleProps) {
  const slotStyle: ViewStyle[] = [
    styles.slot,
    { width: size, height: size, borderRadius: size / 2, marginRight },
  ];

  if (figmaKind) {
    const px = Math.round(size);
    return (
      <View
        style={[
          styles.figmaSlot,
          { width: px, height: px, marginRight },
          style,
        ]}
      >
        <MetricChipIcon kind={figmaKind} size={px} />
      </View>
    );
  }

  if (!variant) {
    return <View style={[...slotStyle, style]}>{children}</View>;
  }

  const { fg, circle } = metricChipToken(variant);
  const glyphBase = metricMaterialGlyphSize(size);
  const glyphScale = materialIcon ? (MATERIAL_ICON_OPTICAL_SCALE[materialIcon] ?? 1) : 1;
  const glyphSize = Math.round(glyphBase * glyphScale);

  return (
    <View style={[...slotStyle, { backgroundColor: circle }, style]}>
      {materialIcon ? (
        <View style={[styles.glyphBox, { width: glyphBase, height: glyphBase }]}>
          <MaterialCommunityIcons name={materialIcon} size={glyphSize} color={fg} />
        </View>
      ) : (
        <View style={[styles.glyphBox, { width: glyphSize, height: glyphSize }]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  figmaSlot: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    flexShrink: 0,
  },
  slot: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  glyphBox: {
    alignItems: "center",
    justifyContent: "center",
  },
});
