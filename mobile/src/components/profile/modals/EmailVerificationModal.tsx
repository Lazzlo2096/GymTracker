/** @see @/components/modals/modalDismissContract.ts */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import { useAppTheme } from "@/theme/appTheme";
import { fonts } from "@/theme/typography";

type Props = {
  visible: boolean;
  email: string;
  onClose: () => void;
  onDismiss?: () => void;
  /** Кнопка «Отправить снова» — только при открытии из профиля. */
  showResend?: boolean;
};

export default function EmailVerificationModal({
  visible,
  email,
  onClose,
  onDismiss,
  showResend = false,
}: Props) {
  const theme = useAppTheme();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetLocalState = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setResendBusy(false);
    setResendSent(false);
    setResendError(null);
  }, []);

  const handleDismiss = useCallback(() => {
    resetLocalState();
    onDismiss?.();
  }, [onDismiss, resetLocalState]);

  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } =
    useBottomSheet(visible, onClose, { onDismiss: handleDismiss });

  const [resendBusy, setResendBusy] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleResend = async () => {
    setResendError(null);
    setResendBusy(true);
    try {
      const r = await apiFetch("/api/v1/auth/email/resend", { method: "POST" });
      if (!r.ok) {
        const detail = await parseErrorDetail(r);
        throw new Error(detail || "Не удалось отправить письмо");
      }
      setResendSent(true);
      closeTimerRef.current = setTimeout(() => {
        requestClose();
      }, 2000);
    } catch (e) {
      setResendError(e instanceof Error ? e.message : "Не удалось отправить письмо");
    } finally {
      setResendBusy(false);
    }
  };

  if (!mounted) return null;

  const body = `Мы отправили письмо на ${email}. Откройте его и нажмите кнопку подтверждения. Без этого аккаунт останется неверифицированным.`;

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
            <Text style={[styles.title, { color: theme.text }]}>Подтвердите почту</Text>
          </BottomSheetDragHeader>
          <ScrollView style={styles.scroll}>
            <Text style={[styles.body, { color: theme.textMuted }]}>{body}</Text>
            {resendError ? (
              <Text style={[styles.hintErr, { color: theme.danger }]}>{resendError}</Text>
            ) : null}
          </ScrollView>
          {showResend ? (
            <Pressable
              style={[styles.btnSecondary, { backgroundColor: theme.accent }]}
              onPress={handleResend}
              disabled={resendBusy || resendSent}
            >
              {resendBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnText}>{resendSent ? "Отправлено" : "Отправить письмо снова"}</Text>
              )}
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.btnGhost, { borderColor: theme.border, marginTop: showResend ? 10 : 16 }]}
            onPress={requestClose}
          >
            <Text style={[styles.btnGhostText, { color: theme.textMuted }]}>Понятно</Text>
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
  hintErr: { fontFamily: fonts.regular, fontSize: 13, marginTop: 12 },
  btnSecondary: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnText: { fontFamily: fonts.bold, fontSize: 16, color: "#FFFFFF" },
  btnGhost: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  btnGhostText: { fontFamily: fonts.semiBold, fontSize: 15 },
});
