/** @see @/components/modals/modalDismissContract.ts */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createUserWeight,
  deleteUserWeight,
  updateUserWeight,
} from "@/api/userWeights";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import { profileBottomSheetStyles as s } from "@/components/profile/modals/profileBottomSheetStyles";
import type { WeightMeasurement } from "@/components/weight/types";
import {
  formatWeightFormDate,
  formatWeightFormTime,
  parseWeightFormMeasuredAt,
} from "@/components/weight/weightDiaryUtils";
import { useAppTheme } from "@/theme/appTheme";
import { fonts } from "@/theme/typography";
import { pressableStyle } from "@/utils/pressableStyles";

type Props = {
  visible: boolean;
  measurement: WeightMeasurement | null;
  userId: number;
  onClose: () => void;
  onDismiss: () => void;
  onSaved: () => Promise<void>;
};

function parseWeightKg(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
  return Math.round(n * 100) / 100;
}

function parseBodyFatPercent(raw: string): number | null | undefined {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return undefined;
  return Math.round(n * 10) / 10;
}

export default function WeightMeasurementFormModal({
  visible,
  measurement,
  userId,
  onClose,
  onDismiss,
  onSaved,
}: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const isEdit = measurement != null;

  const [weightKg, setWeightKg] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } = useBottomSheet(
    visible,
    onClose,
    { dismissEnabled: !loading, onDismiss },
  );

  useEffect(() => {
    if (!visible) return;
    const now = new Date();
    setWeightKg(measurement ? String(measurement.weight_kg) : "");
    setBodyFat(
      measurement?.body_fat_percent != null ? String(measurement.body_fat_percent) : "",
    );
    setDateStr(formatWeightFormDate(measurement?.measured_at ?? null, now));
    setTimeStr(formatWeightFormTime(measurement?.measured_at ?? null, now));
    setNote(measurement?.note ?? "");
    setErr("");
  }, [visible, measurement]);

  const submit = async () => {
    const weight = parseWeightKg(weightKg);
    if (weight == null) {
      setErr("Введите вес от 0.1 до 500 кг");
      return;
    }

    const bodyFatParsed = parseBodyFatPercent(bodyFat);
    if (bodyFatParsed === undefined) {
      setErr("Телесный жир — от 0.1 до 100 % или оставьте пустым");
      return;
    }

    const measuredAt = parseWeightFormMeasuredAt(dateStr, timeStr);
    if (!measuredAt) {
      setErr("Дата в формате ДД.ММ.ГГГГ, время — ЧЧ:ММ");
      return;
    }

    setLoading(true);
    setErr("");
    try {
      const noteValue = note.trim() || null;

      if (isEdit && measurement) {
        await updateUserWeight(measurement.id, {
          weight_kg: weight,
          body_fat_percent: bodyFatParsed,
          measured_at: measuredAt,
          note: noteValue,
        });
      } else {
        await createUserWeight({
          user_id: userId,
          weight_kg: weight,
          body_fat_percent: bodyFatParsed,
          measured_at: measuredAt,
          note: noteValue,
        });
      }

      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = () => {
    if (!measurement) return;
    Alert.alert("Удалить измерение?", "Запись будет удалена без возможности восстановления.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setLoading(true);
            setErr("");
            try {
              await deleteUserWeight(measurement.id);
              await onSaved();
              onClose();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Не удалось удалить");
            } finally {
              setLoading(false);
            }
          })();
        },
      },
    ]);
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
            {
              backgroundColor: theme.card,
              paddingBottom: 20 + Math.max(insets.bottom, 12),
            },
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <BottomSheetDragHeader panHandlers={panHandlers}>
            <Text style={[s.title, { color: theme.text }]}>
              {isEdit ? "Редактировать измерение" : "Новое измерение"}
            </Text>
          </BottomSheetDragHeader>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: theme.textMuted }]}>Вес, кг *</Text>
            <TextInput
              style={[
                s.input,
                styles.input,
                { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardSoft },
              ]}
              value={weightKg}
              onChangeText={setWeightKg}
              placeholder="Например: 73.5"
              placeholderTextColor={theme.textPlaceholder}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: theme.textMuted }]}>Телесный жир, %</Text>
            <TextInput
              style={[
                s.input,
                styles.input,
                { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardSoft },
              ]}
              value={bodyFat}
              onChangeText={setBodyFat}
              placeholder="Необязательно"
              placeholderTextColor={theme.textPlaceholder}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: theme.textMuted }]}>Дата</Text>
            <TextInput
              style={[
                s.input,
                styles.input,
                { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardSoft },
              ]}
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="ДД.ММ.ГГГГ"
              placeholderTextColor={theme.textPlaceholder}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={[styles.label, { color: theme.textMuted }]}>Время</Text>
            <TextInput
              style={[
                s.input,
                styles.input,
                { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardSoft },
              ]}
              value={timeStr}
              onChangeText={setTimeStr}
              placeholder="ЧЧ:ММ"
              placeholderTextColor={theme.textPlaceholder}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={[styles.label, { color: theme.textMuted }]}>Заметка</Text>
            <TextInput
              style={[
                s.input,
                styles.input,
                styles.noteInput,
                { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardSoft },
              ]}
              value={note}
              onChangeText={setNote}
              placeholder="Необязательно"
              placeholderTextColor={theme.textPlaceholder}
              multiline
            />

            {err ? <Text style={[s.err, { color: theme.danger }]}>{err}</Text> : null}

            {isEdit ? (
              <Pressable
                style={pressableStyle(styles.deleteBtn, { pressed: { opacity: 0.75 } })}
                onPress={confirmDelete}
                disabled={loading}
              >
                <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Удалить измерение</Text>
              </Pressable>
            ) : null}

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
                  <Text style={s.primaryBtnText}>{isEdit ? "Сохранить" : "Добавить"}</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    marginBottom: 12,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  deleteBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    marginBottom: 4,
  },
  deleteBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
});
