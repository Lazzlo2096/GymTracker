import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import PickModeScreenHint from "@/components/ui/PickModeScreenHint";

type Props = {
  hint: string;
  bottom: number;
  paddingLeft: number;
  paddingRight: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/** Нижняя панель pick-режима: подсказка + кнопки действий (слева от FAB). */
export default function PickModeBottomPanel({
  hint,
  bottom,
  paddingLeft,
  paddingRight,
  style,
  children,
}: Props) {
  return (
    <View
      style={[
        styles.panel,
        { bottom, paddingLeft, paddingRight },
        style,
      ]}
    >
      <PickModeScreenHint style={styles.hint}>{hint}</PickModeScreenHint>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    gap: 8,
  },
  hint: {
    marginTop: 0,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
