/** @see @/components/modals/modalDismissContract.ts */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import SnapHorizontalScroll from "@/components/ui/SnapHorizontalScroll";
import { profileBottomSheetStyles as s } from "@/components/profile/modals/profileBottomSheetStyles";
import { useAppTheme } from "@/theme/appTheme";
import { fonts } from "@/theme/typography";
import { pressableStyle } from "@/utils/pressableStyles";

const PRESETS = ["Набор массы", "Похудение", "Поддержание формы", "Сила", "Выносливость"];

type Props = {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
};

export default function GoalEditModal({ visible, initial, onClose, onSave }: Props) {
  const theme = useAppTheme();
  const [val, setVal] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } = useBottomSheet(
    visible,
    onClose,
    { dismissEnabled: !loading },
  );

  useEffect(() => {
    if (visible) {
      setVal(initial);
      setErr("");
    }
  }, [visible, initial]);

  const submit = async () => {
    setLoading(true);
    setErr("");
    try {
      await onSave(val.trim());
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
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
      onRequestClose={requestClose}
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
            <Text style={[s.title, { color: theme.text }]}>Цель тренировок</Text>
          </BottomSheetDragHeader>

          <SnapHorizontalScroll gap={8} contentContainerStyle={styles.chips}>
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                style={[
                  styles.chip,
                  { borderColor: theme.border, backgroundColor: theme.bg },
                  val === p && { borderColor: theme.accent, backgroundColor: theme.accentSoft },
                ]}
                onPress={() => setVal(p)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: theme.textMuted },
                    val === p && { color: theme.accent, fontFamily: fonts.semiBold },
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </SnapHorizontalScroll>

          <Text style={[styles.label, { color: theme.textMuted }]}>Свой вариант</Text>
          <TextInput
            style={[
              styles.input,
              { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardSoft },
            ]}
            value={val}
            onChangeText={setVal}
            placeholder="Опишите цель"
            placeholderTextColor={theme.textPlaceholder}
            multiline
          />

          {err ? <Text style={[s.err, styles.err, { color: theme.danger }]}>{err}</Text> : null}

          <View style={s.actionRow}>
            <Pressable
              style={pressableStyle(s.ghostBtn, { pressed: { opacity: 0.7 } })}
              onPress={requestClose}
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
                <Text style={s.primaryBtnText}>Сохранить</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chips: { marginBottom: 14, paddingRight: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontFamily: fonts.regular, fontSize: 14 },
  label: { fontFamily: fonts.semiBold, fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 72,
    textAlignVertical: "top",
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  err: { marginTop: 8 },
});
