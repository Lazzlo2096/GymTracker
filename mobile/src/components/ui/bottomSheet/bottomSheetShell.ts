import { StyleSheet } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

/** Оболочка bottom sheet (эталон — WorkoutActionsSheet). */
export const bottomSheetFrameStyle = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingHorizontal: 16,
    width: "100%",
  },
  dragHeader: {
    paddingBottom: 4,
  },
});

export function bottomSheetPadding(insets: Pick<EdgeInsets, "bottom">) {
  return {
    paddingBottom: Math.max(insets.bottom, 14),
  };
}

export function bottomSheetMaxHeight(windowHeight: number, insets: Pick<EdgeInsets, "top">) {
  return {
    maxHeight: windowHeight - Math.max(insets.top, 12),
  };
}
