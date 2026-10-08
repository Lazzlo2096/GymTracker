import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import { profileBottomSheetStyles as s } from "@/components/profile/modals/profileBottomSheetStyles";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function ActivatePromoModal({ visible, onClose, onSuccess }: Props) {
  const theme = useAppTheme();
  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } =
    useBottomSheet(visible, onClose);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (visible) {
      setCode("");
      setErr("");
    }
  }, [visible]);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setErr("Введите промокод");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const r = await apiFetch("/api/v1/promo-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await r.json().catch(() => ({}))) as { message?: string };
      if (!r.ok) throw new Error(parseErrorDetail(data));
      const msg = typeof data.message === "string" ? data.message : "Промокод активирован";
      onSuccess?.();
      onClose();
      Alert.alert("Готово", msg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка активации");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: theme.overlay }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>
        <Animated.View
          style={[
            s.sheet,
            { backgroundColor: theme.card },
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <BottomSheetDragHeader panHandlers={panHandlers}>
            <Text style={[s.title, { color: theme.text }]}>Активировать промокод</Text>
          </BottomSheetDragHeader>

          <TextInput
            style={[
              s.input,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardSoft },
            ]}
            placeholder="Промокод"
            placeholderTextColor={theme.textPlaceholder}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          {err ? <Text style={[s.err, { color: theme.danger }]}>{err}</Text> : null}

          <View style={s.actionRow}>
            <Pressable
              style={pressableStyle(s.ghostBtn, { pressed: { opacity: 0.7 } })}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[s.ghostBtnText, { color: theme.textMuted }]}>Отмена</Text>
            </Pressable>
            <Pressable
              style={pressableStyle(
                [s.primaryBtn, { backgroundColor: theme.accent }, loading && { opacity: 0.7 }],
                { pressed: { opacity: 0.9 } },
              )}
              onPress={() => void submit()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Активировать</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
