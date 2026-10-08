/** @see ../modals/modalDismissContract.ts */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchUserGymOptions, updateWorkoutTemplate, type UserGymOption } from "@/api/workoutTemplates";
import FilterSelectModal from "@/components/modals/FilterSelectModal";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import { detailToFormDefaults } from "@/components/plans/templatePlanDraft";
import type { WorkoutTemplateDetailMock } from "@/components/plans/types";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

type Props = {
  visible: boolean;
  templateId: string;
  initialDetail: WorkoutTemplateDetailMock | null;
  onClose: () => void;
  onDismiss?: () => void;
  onSaved: (detail: WorkoutTemplateDetailMock) => void;
};

function parseEstimatedMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

export default function WorkoutTemplateFormModal({
  visible,
  templateId,
  initialDetail,
  onClose,
  onDismiss,
  onSaved,
}: Props) {
  const theme = useAppTheme();
  const plansStyles = useMemo(() => createPlansScreenStyles(theme), [theme]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [selectedGymId, setSelectedGymId] = useState("__none__");
  const [gyms, setGyms] = useState<UserGymOption[]>([]);
  const [gymsLoading, setGymsLoading] = useState(false);
  const [gymOpen, setGymOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setError("");
    if (initialDetail) {
      const defaults = detailToFormDefaults(initialDetail);
      setTitle(defaults.title);
      setDescription(defaults.description);
      setNote(defaults.note);
      setEstimatedMinutes(defaults.estimatedMinutes);
    } else {
      setTitle("");
      setDescription("");
      setNote("");
      setEstimatedMinutes("");
      setSelectedGymId("__none__");
    }

    setGymsLoading(true);
    void fetchUserGymOptions()
      .then((items) => {
        setGyms(items);
        if (initialDetail?.gym_name) {
          const match = items.find((g) => g.name === initialDetail.gym_name);
          setSelectedGymId(match ? String(match.id) : "__none__");
        } else {
          setSelectedGymId("__none__");
        }
      })
      .catch(() => setGyms([]))
      .finally(() => setGymsLoading(false));
  }, [visible, initialDetail]);

  const gymOptions = useMemo(
    () => [{ id: "__none__", label: "Не выбран" }, ...gyms.map((g) => ({ id: String(g.id), label: g.name }))],
    [gyms],
  );
  const gymLabel =
    gymOptions.find((option) => option.id === selectedGymId)?.label ?? "Не выбран";

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Укажите название шаблона");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const detail = await updateWorkoutTemplate(templateId, {
        title: trimmedTitle,
        description: description.trim() || null,
        note: note.trim() || null,
        estimated_minutes: parseEstimatedMinutes(estimatedMinutes),
        user_gym_id: selectedGymId !== "__none__" ? Number(selectedGymId) : null,
      });
      onSaved(detail);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить шаблон");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={onClose}
        onDismiss={onDismiss}
      >
        <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} disabled={loading} />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <View style={styles.headRow}>
              <Text style={[styles.title, { color: theme.text }]}>Редактировать шаблон</Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Закрыть" disabled={loading}>
                <Ionicons name="close" size={26} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.label, { color: theme.textMuted }]}>Название *</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Грудь + трицепс"
                placeholderTextColor={theme.textPlaceholder}
                maxLength={256}
                {...textBreakProps}
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>Описание</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Кратко о фокусе тренировки"
                placeholderTextColor={theme.textPlaceholder}
                maxLength={512}
                {...textBreakProps}
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>Заметка</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputMulti,
                  { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
                ]}
                value={note}
                onChangeText={setNote}
                placeholder="Разминка, советы…"
                placeholderTextColor={theme.textPlaceholder}
                multiline
                maxLength={4000}
                {...textBreakProps}
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>Зал</Text>
              <Pressable
                style={[styles.select, { borderColor: theme.border, backgroundColor: theme.bg }]}
                onPress={() => setGymOpen(true)}
                disabled={gymsLoading}
              >
                {gymsLoading ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <>
                    <Text style={[styles.selectText, { color: theme.text }]} numberOfLines={1}>
                      {gymLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
                  </>
                )}
              </Pressable>

              <Text style={[styles.label, { color: theme.textMuted }]}>Длительность, мин</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }]}
                value={estimatedMinutes}
                onChangeText={setEstimatedMinutes}
                placeholder="Не задано"
                placeholderTextColor={theme.textPlaceholder}
                keyboardType="number-pad"
                maxLength={4}
              />

              {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                style={pressableStyle([plansStyles.actionButton, { flex: 1 }])}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={plansStyles.actionButtonText}>Отмена</Text>
              </Pressable>
              <Pressable
                style={pressableStyle([
                  plansStyles.actionButton,
                  plansStyles.actionButtonPrimary,
                  { flex: 1 },
                ])}
                onPress={() => void handleSave()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <Text style={[plansStyles.actionButtonText, plansStyles.actionButtonTextPrimary]}>
                    Сохранить
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <FilterSelectModal
        visible={gymOpen}
        title="Зал"
        options={gymOptions}
        selectedId={selectedGymId}
        onSelect={(id) => {
          setSelectedGymId(id);
          setGymOpen(false);
        }}
        onClose={() => setGymOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  card: {
    maxHeight: "92%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 8,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    lineHeight: 24,
    flex: 1,
    marginRight: 8,
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  inputMulti: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  select: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    flex: 1,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
