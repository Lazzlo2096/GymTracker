/** @see ./modalDismissContract.ts */
import React from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppSwitch from "@/components/ui/AppSwitch";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

export type DisplaySettingsToggle = {
  id: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
};

type Props = {
  visible: boolean;
  title?: string;
  items: DisplaySettingsToggle[];
  onClose: () => void;
};

export default function DisplaySettingsModal({
  visible,
  title = "Настройки отображения",
  items,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } =
    useBottomSheet(visible, onClose);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFill,
            { opacity: backdropOpacity, backgroundColor: theme.overlay },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Закрыть" />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: theme.card },
            {
              paddingBottom: Math.max(insets.bottom, 14),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <BottomSheetDragHeader panHandlers={panHandlers}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
          </BottomSheetDragHeader>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {items.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.toggleRow,
                  index < items.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.divider,
                  },
                ]}
              >
                <View style={styles.toggleTextBlock}>
                  <Text style={[styles.toggleLabel, { color: theme.text }]} {...textBreakProps}>
                    {item.label}
                  </Text>
                  <Text
                    style={[styles.toggleDescription, { color: theme.textMuted }]}
                    {...textBreakProps}
                  >
                    {item.description}
                  </Text>
                </View>

                <AppSwitch
                  value={item.value}
                  onValueChange={item.onValueChange}
                  trackColor={{
                    false: theme.switchOff,
                    true: theme.accent,
                  }}
                  thumbColor={theme.switchThumb}
                />
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    maxHeight: "72%",
  },
  sheetTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  scroll: {
    maxHeight: 420,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  toggleTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  toggleLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  toggleDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
