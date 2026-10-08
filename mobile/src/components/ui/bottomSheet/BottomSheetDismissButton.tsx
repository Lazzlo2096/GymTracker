import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

type Props = {
  label?: string;
  onPress: () => void;
};

/** Нижняя кнопка закрытия bottom sheet (эталон — WorkoutActionsSheet «Отмена»). */
export default function BottomSheetDismissButton({ label = "Отмена", onPress }: Props) {
  const theme = useAppTheme();

  return (
    <Pressable
      style={pressableStyle(
        [styles.btn, { backgroundColor: theme.cardSoft }],
        { hover: { opacity: 0.92 }, pressed: { opacity: 0.86 } },
      )}
      onPress={onPress}
    >
      <Text style={[styles.btnText, { color: theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  btnText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
  },
});
