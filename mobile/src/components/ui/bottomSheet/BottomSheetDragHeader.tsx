import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { BottomSheetPanHandlers } from "@/components/ui/bottomSheet/useBottomSheet";
import { useAppTheme } from "@/theme/appTheme";

type Props = {
  panHandlers: BottomSheetPanHandlers;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Ручка шторки + зона свайпа вниз для закрытия.
 * Свайп только на ручке — children (кнопки заголовка) не внутри role=button, иначе на web вложенные <button>.
 */
export default function BottomSheetDragHeader({ panHandlers, children, style }: Props) {
  const theme = useAppTheme();

  return (
    <View style={[styles.dragHeader, style]}>
      <View
        {...panHandlers}
        style={styles.panZone}
        accessibilityRole="button"
        accessibilityLabel="Потяните вниз, чтобы закрыть"
      >
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  dragHeader: {
    alignItems: "stretch",
  },
  panZone: {
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
