/** @see ./modalDismissContract.ts — options/title не сбрасывать у родителя до конца анимации закрытия. */
import React from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

export type FilterSelectOption = {
  id: string;
  label: string;
};

type BaseProps = {
  visible: boolean;
  title: string;
  options: FilterSelectOption[];
  onClose: () => void;
};

export type FilterSelectModalSingleProps = BaseProps & {
  variant?: "single";
  selectedId: string;
  onSelect: (id: string) => void;
};

export type FilterSelectModalMultiProps = BaseProps & {
  variant: "multi";
  selectedIds: string[];
  onToggle: (id: string) => void;
};

export type FilterSelectModalProps = FilterSelectModalSingleProps | FilterSelectModalMultiProps;

function isMulti(props: FilterSelectModalProps): props is FilterSelectModalMultiProps {
  return props.variant === "multi";
}

export default function FilterSelectModal(props: FilterSelectModalProps) {
  const insets = useSafeAreaInsets();
  const { visible, title, options, onClose } = props;
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
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
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
              {options.map((option) => {
                const selected = isMulti(props)
                  ? props.selectedIds.includes(option.id)
                  : option.id === props.selectedId;

                return (
                  <Pressable
                    key={option.id}
                    style={({ pressed }) => [
                      styles.optionRow,
                      { borderBottomColor: theme.divider },
                      pressed && styles.optionRowPressed,
                      pressed && { backgroundColor: theme.bg },
                    ]}
                    onPress={() => {
                      if (isMulti(props)) {
                        props.onToggle(option.id);
                      } else {
                        props.onSelect(option.id);
                        onClose();
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: theme.textMuted },
                        selected && styles.optionLabelSelected,
                        selected && { color: theme.text },
                      ]}
                      {...textBreakProps}
                    >
                      {option.label}
                    </Text>
                    {isMulti(props) ? (
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: theme.border, backgroundColor: theme.card },
                          selected && styles.checkboxSelected,
                          selected && { borderColor: theme.accent, backgroundColor: theme.accent },
                        ]}
                      >
                        {selected ? (
                          <Ionicons name="checkmark" size={16} color={theme.white} />
                        ) : null}
                      </View>
                    ) : selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                    ) : (
                      <View style={[styles.radioOuter, { borderColor: theme.border }]}>
                        <View style={styles.radioInner} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            {isMulti(props) ? (
              <Pressable style={[styles.doneButton, { backgroundColor: theme.accent }]} onPress={onClose}>
                <Text style={styles.doneButtonText}>Готово</Text>
              </Pressable>
            ) : null}
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
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingHorizontal: 16,
    maxHeight: "72%",
  },
  sheetTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: "#11142D",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  scroll: {
    maxHeight: 420,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECEAF2",
  },
  optionRowPressed: {
    backgroundColor: "#F7F5FB",
  },
  optionLabel: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: "#3A3650",
    marginRight: 12,
  },
  optionLabelSelected: {
    color: "#11142D",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#D4D0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "transparent",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D4D0E0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxSelected: {},
  doneButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  doneButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#FFFFFF",
  },
});
