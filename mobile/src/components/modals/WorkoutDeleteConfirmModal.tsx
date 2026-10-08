/** @see ./modalDismissContract.ts — title/message у родителя не обнулять синхронно с `visible=false`. */
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MODAL_FADE_MS } from "@/components/modals/modalDismissContract";
import { fonts, type } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Сброс payload у родителя — только после fade-out, не синхронно с `visible=false`. */
  onDismiss?: () => void;
};

type DisplaySnapshot = {
  title: string;
  message: string;
  confirmLabel: string;
};

export default function WorkoutDeleteConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Удалить",
  onCancel,
  onConfirm,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const [display, setDisplay] = React.useState<DisplaySnapshot | null>(null);
  const dismissOnceRef = React.useRef(false);

  React.useEffect(() => {
    if (!visible) return;
    dismissOnceRef.current = false;
    setDisplay({ title, message, confirmLabel });
  }, [visible, title, message, confirmLabel]);

  const fireDismiss = React.useCallback(() => {
    if (!onDismiss || dismissOnceRef.current) return;
    dismissOnceRef.current = true;
    onDismiss();
  }, [onDismiss]);

  React.useEffect(() => {
    if (visible) return;
    if (!display) return;
    const t = setTimeout(() => {
      setDisplay(null);
      fireDismiss();
    }, MODAL_FADE_MS);
    return () => clearTimeout(t);
  }, [visible, display, fireDismiss]);

  const shown: DisplaySnapshot = display ?? { title, message, confirmLabel };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onCancel}
      onDismiss={fireDismiss}
    >
      <View style={styles.root}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onCancel} />
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
            {
              marginBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.text }]}>{shown.title}</Text>
          <Text style={[styles.message, { color: theme.textMuted }]}>{shown.message}</Text>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                { backgroundColor: theme.cardSoft },
                pressed && styles.btnPressed,
              ]}
              onPress={onCancel}
            >
              <Text style={[styles.btnSecondaryText, { color: theme.textMuted }]}>Отмена</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && styles.btnPressed]}
              onPress={onConfirm}
            >
              <Text style={styles.btnDangerText}>{shown.confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24, 20, 40, 0.45)",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 18,
    shadowColor: "#1A1530",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    ...type.modalTitle,
    color: "#11142D",
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: "#6F6B84",
    marginBottom: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnSecondary: {
    backgroundColor: "#F3F1F9",
  },
  btnSecondaryText: {
    ...type.button,
    color: "#5F5A78",
  },
  btnDanger: {
    backgroundColor: "#FEE4E2",
  },
  btnDangerText: {
    ...type.button,
    color: "#D92D20",
  },
});
