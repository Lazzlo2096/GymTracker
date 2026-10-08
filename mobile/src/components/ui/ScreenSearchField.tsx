import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  testID?: string;
};

/** Поле поиска в шапке экрана — высота как на «Истории тренировок». */
export default function ScreenSearchField({ value, onChangeText, placeholder, testID }: Props) {
  const theme = useAppTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.box,
        {
          backgroundColor: theme.card,
        },
      ]}
    >
      <Feather name="search" size={18} color={theme.textMuted} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.textPlaceholder}
        style={[styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 50,
    borderRadius: PLAQUE_RADIUS,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    paddingVertical: Platform.OS === "android" ? 0 : 0,
  },
});
