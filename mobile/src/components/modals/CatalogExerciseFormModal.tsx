/** @see ./modalDismissContract.ts */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { emit } from "@/utils/eventBus";
import { catalogUi } from "@/theme/catalogUi";
import { fonts } from "@/theme/typography";
import { ExerciseGlyph } from "@/components/exercise/ExerciseGlyph";
import FilterSelectModal from "@/components/modals/FilterSelectModal";
import {
  EXERCISE_TYPE_OPTIONS,
  exerciseTypeLabel,
  isExerciseTypeId,
  type ExerciseTypeId,
} from "@/constants/exerciseType";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

const ICON_KEYS = [
  "barbell",
  "dumbbell",
  "biceps",
  "pulldown",
  "squat",
  "bench",
  "shoulder",
  "deadlift",
  "kettlebell",
  "cable",
  "cardio",
  "abs",
] as const;

const ICON_LABELS: Record<(typeof ICON_KEYS)[number], string> = {
  barbell: "Штанга",
  dumbbell: "Гантели",
  biceps: "Бицепс",
  pulldown: "Тяга",
  squat: "Присед",
  bench: "Скамья",
  shoulder: "Плечи",
  deadlift: "Становая",
  kettlebell: "Гиря",
  cable: "Трос",
  cardio: "Кардио",
  abs: "Пресс",
};

type Props = {
  visible: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  exercise?: {
    id: number;
    name?: string;
    notes?: string | null;
    muscle_group?: string | null;
    exercise_type?: string | null;
    icon?: string | null;
  } | null;
  muscleSelectOptions: { id: string; label: string }[];
};

/**
 * Создание/редактирование записи в каталоге упражнений (макет «Новое упражнение»).
 */
export default function CatalogExerciseFormModal({
  visible,
  onClose,
  mode,
  exercise,
  muscleSelectOptions,
}: Props) {
  const theme = useAppTheme();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [exerciseType, setExerciseType] = useState<ExerciseTypeId | "">("");
  const [icon, setIcon] = useState<string>("barbell");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [muscleOpen, setMuscleOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const muscleOptionsWithEmpty = [{ id: "__none__", label: "Не выбрано" }, ...muscleSelectOptions];

  useEffect(() => {
    if (!visible) return;
    if (mode === "edit" && exercise) {
      setName(exercise.name ?? "");
      setNotes(exercise.notes ?? "");
      setMuscleGroup(exercise.muscle_group ?? "");
      const et = exercise.exercise_type ?? "";
      setExerciseType(et && isExerciseTypeId(et) ? et : "");
      setIcon(exercise.icon ?? "barbell");
    } else {
      setName("");
      setNotes("");
      setMuscleGroup("");
      setExerciseType("");
      setIcon("barbell");
    }
    setError("");
  }, [visible, mode, exercise]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Введите название");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        notes: notes.trim() || null,
        muscle_group: muscleGroup.trim() || null,
        exercise_type: exerciseType || null,
        icon,
      };
      if (mode === "create") {
        const r = await apiFetch("/api/v1/exercises_in_catalog/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(parseErrorDetail(d));
        }
      } else if (exercise?.id) {
        const r = await apiFetch(`/api/v1/exercises_in_catalog/${exercise.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(parseErrorDetail(d));
        }
      }
      emit("catalog:updated");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const muscleDisplay = muscleGroup.trim() ? muscleGroup : "Выберите группу";
  const typeDisplay = exerciseType ? exerciseTypeLabel(exerciseType) : "Выберите тип";
  const typeOptionsWithEmpty = [
    { id: "__none__", label: "Не выбрано" },
    ...EXERCISE_TYPE_OPTIONS,
  ];

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <View style={styles.headRow}>
              <Text style={[styles.title, { color: theme.text }]}>{mode === "create" ? "Новое упражнение" : "Редактировать"}</Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Закрыть">
                <Ionicons name="close" size={26} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: theme.textMuted }]}>Название</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={name}
                onChangeText={setName}
                placeholder="Например: Жим гантелей сидя"
                placeholderTextColor={theme.textPlaceholder}
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>Группа мышц</Text>
              <Pressable
                style={pressableStyle([styles.selectInput, { borderColor: theme.border }], {
                  pressed: { opacity: 0.88 },
                })}
                onPress={() => setMuscleOpen(true)}
              >
                <Text
                  style={[
                    styles.selectInputText,
                    { color: theme.text },
                    !muscleGroup.trim() && styles.placeholder,
                    !muscleGroup.trim() && { color: theme.textMuted },
                  ]}
                  {...textBreakProps}
                >
                  {muscleDisplay}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
              </Pressable>

              <Text style={[styles.label, { color: theme.textMuted }]}>Тип упражнения</Text>
              <Pressable
                style={pressableStyle([styles.selectInput, { borderColor: theme.border }], {
                  pressed: { opacity: 0.88 },
                })}
                onPress={() => setTypeOpen(true)}
              >
                <Text
                  style={[
                    styles.selectInputText,
                    { color: theme.text },
                    !exerciseType && styles.placeholder,
                    !exerciseType && { color: theme.textMuted },
                  ]}
                  {...textBreakProps}
                >
                  {typeDisplay}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
              </Pressable>

              <Text style={[styles.label, { color: theme.textMuted }]}>Заметки</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }, styles.multiline]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Техника, особенности, настройки..."
                placeholderTextColor={theme.textPlaceholder}
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>Иконка</Text>
              <View style={styles.iconGrid}>
                {ICON_KEYS.map((k) => (
                  <Pressable
                    key={k}
                    style={pressableStyle(
                      [
                        styles.iconCell,
                        { borderColor: theme.border, backgroundColor: theme.bg },
                        icon === k && styles.iconCellActive,
                        icon === k && { borderColor: theme.accent, backgroundColor: theme.accentSoft },
                      ],
                      { pressed: { opacity: 0.88 } },
                    )}
                    onPress={() => setIcon(k)}
                  >
                    <ExerciseGlyph name={k} size={26} color={icon === k ? theme.accent : theme.textMuted} />
                    <Text
                      style={[
                        styles.iconCellLabel,
                        { color: theme.textMuted },
                        icon === k && styles.iconCellLabelActive,
                        icon === k && { color: theme.accent },
                      ]}
                      {...textBreakProps}
                    >
                      {ICON_LABELS[k]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.iconHint, { color: theme.textMuted }]}>Выбранная иконка будет использоваться в каталоге</Text>
            </ScrollView>

            {error ? <Text style={styles.err}>{error}</Text> : null}

            <View style={styles.row}>
              <Pressable style={pressableStyle(styles.btnGhost, { pressed: { opacity: 0.88 } })} onPress={onClose}>
                <Text style={[styles.btnGhostText, { color: theme.textMuted }]}>Отмена</Text>
              </Pressable>
              <Pressable
                style={pressableStyle([styles.btn, { backgroundColor: theme.accent }], {
                  pressed: { opacity: 0.88 },
                  disabled: loading,
                })}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={catalogUi.cardBg} />
                ) : (
                  <Text style={styles.btnText}>Сохранить</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <FilterSelectModal
        visible={muscleOpen}
        title="Группа мышц"
        options={muscleOptionsWithEmpty}
        selectedId={muscleGroup.trim() ? muscleGroup : "__none__"}
        onSelect={(id) => {
          setMuscleGroup(id === "__none__" ? "" : id);
        }}
        onClose={() => setMuscleOpen(false)}
      />
      <FilterSelectModal
        visible={typeOpen}
        title="Тип упражнения"
        options={typeOptionsWithEmpty}
        selectedId={exerciseType || "__none__"}
        onSelect={(id) => {
          setExerciseType(id === "__none__" || !isExerciseTypeId(id) ? "" : id);
        }}
        onClose={() => setTypeOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: catalogUi.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: "92%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0DEE9",
    marginBottom: 12,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: catalogUi.text,
    flex: 1,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: catalogUi.textMuted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: catalogUi.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: catalogUi.text,
  },
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: catalogUi.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  selectInputText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: catalogUi.text,
  },
  placeholder: {
    fontFamily: fonts.regular,
    color: catalogUi.textMuted,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 8,
  },
  iconCell: {
    width: "23%",
    aspectRatio: 0.85,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: catalogUi.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: catalogUi.pageBg,
  },
  iconCellActive: {
    borderColor: catalogUi.accent,
    borderWidth: 1,
    backgroundColor: catalogUi.iconCircleBg,
  },
  iconCellLabel: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: catalogUi.textMuted,
    textAlign: "center",
  },
  iconCellLabelActive: {
    fontFamily: fonts.semiBold,
    color: catalogUi.accent,
  },
  iconHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: catalogUi.textMuted,
    marginBottom: 12,
  },
  err: {
    fontFamily: fonts.regular,
    color: "#dc2626",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    gap: 12,
  },
  btn: {
    backgroundColor: catalogUi.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    minWidth: 140,
    alignItems: "center",
  },
  btnText: { fontFamily: fonts.bold, fontSize: 16, color: catalogUi.cardBg },
  btnGhost: { paddingVertical: 14, paddingHorizontal: 8 },
  btnGhostText: { fontFamily: fonts.semiBold, fontSize: 16, color: catalogUi.textMuted },
});
