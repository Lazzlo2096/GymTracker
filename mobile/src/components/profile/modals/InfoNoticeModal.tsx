/** @see @/components/modals/modalDismissContract.ts */
import React from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fonts } from "@/theme/typography";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import { useAppTheme } from "@/theme/appTheme";

type Props = {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
  /** Очистка данных после анимации закрытия — см. modalDismissContract. */
  onDismiss?: () => void;
};

export default function InfoNoticeModal({ visible, title, body, onClose, onDismiss }: Props) {
  const theme = useAppTheme();
  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } =
    useBottomSheet(visible, onClose, { onDismiss });

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <View style={styles.backdrop}>
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: theme.overlay }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: theme.card },
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <BottomSheetDragHeader panHandlers={panHandlers}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          </BottomSheetDragHeader>
          <ScrollView style={styles.scroll}>
            <Text style={[styles.body, { color: theme.textMuted }]}>{body}</Text>
          </ScrollView>
          <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={requestClose}>
            <Text style={styles.btnText}>Понятно</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "80%",
  },
  title: { fontFamily: fonts.extraBold, fontSize: 18, marginBottom: 12 },
  scroll: { maxHeight: 360 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  btn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnText: { fontFamily: fonts.bold, fontSize: 16, color: "#FFFFFF" },
});
