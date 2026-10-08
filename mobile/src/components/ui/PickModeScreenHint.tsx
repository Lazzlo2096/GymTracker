import React from "react";
import { Platform, StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useAppTheme } from "@/theme/appTheme";
import { fonts } from "@/theme/typography";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
};

/** Accent-подсказка pick-режима (шапка или нижняя панель). */
export default function PickModeScreenHint({ children, style }: Props) {
  const theme = useAppTheme();
  return (
    <Text style={[styles.text, { color: theme.accent }, style]} {...textBreakProps}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 0,
    paddingTop: 0,
  },
});
