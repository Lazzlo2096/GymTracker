/** @see ../modals/modalDismissContract.ts */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { replaceWorkoutTemplateExercises } from "@/api/workoutTemplates";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import {
  formatTemplatePlannedEntryHeading,
  formatTemplatePlannedSetLabel,
} from "@/components/plans/templatePlanFormat";
import {
  buildPreviewPlannedSetsFromDraft,
  exerciseMockToDraft,
  formatPlannedSetsJsonPreview,
  getDisplayPlannedSetsForDraft,
  suggestTonnageFromDraft,
  type TemplateExerciseDraft,
} from "@/components/plans/templatePlanDraft";
import {
  TEMPLATE_CATALOG_PICK_EVENT,
  type TemplateCatalogPickPayload,
} from "@/components/plans/templateCatalogPick";
import type {
  TemplatePlannedSetMock,
  WorkoutTemplateDetailMock,
  WorkoutTemplateExerciseMock,
} from "@/components/plans/types";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";
import { on } from "@/utils/eventBus";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

type Props = {
  visible: boolean;
  templateId: string;
  template: WorkoutTemplateDetailMock;
  exercise: WorkoutTemplateExerciseMock | null;
  onClose: () => void;
  onDismiss?: () => void;
  onSaved: (detail: WorkoutTemplateDetailMock) => void;
};

function buildExercisesAfterEdit(
  template: WorkoutTemplateDetailMock,
  exerciseId: string,
  updated: TemplateExerciseDraft,
): TemplateExerciseDraft[] {
  return template.exercises.map((row) =>
    row.id === exerciseId ? updated : exerciseMockToDraft(row),
  );
}

function buildExercisesAfterDelete(
  template: WorkoutTemplateDetailMock,
  exerciseId: string,
): TemplateExerciseDraft[] {
  const targetId = exerciseId.trim();
  return template.exercises
    .filter((row) => String(row.id).trim() !== targetId)
    .map(exerciseMockToDraft);
}

export default function TemplateExerciseEditModal({
  visible,
  templateId,
  template,
  exercise,
  onClose,
  onDismiss,
  onSaved,
}: Props) {
  const theme = useAppTheme();
  const router = useRouter();
  const plansStyles = useMemo(() => createPlansScreenStyles(theme), [theme]);

  const [draft, setDraft] = useState<TemplateExerciseDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null);
  const [entryReps, setEntryReps] = useState("");
  const [entryWeight, setEntryWeight] = useState("");
  const [entryRest, setEntryRest] = useState("");

  useEffect(() => {
    if (!visible || !exercise) return;
    setError("");
    setEditingEntryIndex(null);
    setDeleteConfirmVisible(false);
    const next = exerciseMockToDraft(exercise);
    setDraft(next);
  }, [visible, exercise]);

  useEffect(() => {
    if (!visible) {
      setDeleteConfirmVisible(false);
    }
  }, [visible]);

  const patchDraft = useCallback((patch: Partial<TemplateExerciseDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const applySimpleChange = useCallback((patch: Partial<TemplateExerciseDraft>) => {
    setDraft((prev) => {
      if (!prev || prev.useCustomPlan) return prev;
      const merged: TemplateExerciseDraft = {
        ...prev,
        ...patch,
        useCustomPlan: false,
        plannedSets: [],
      };
      if (patch.sets !== undefined) {
        merged.plannedSetsCount = patch.sets;
      }
      merged.plannedTonnageKg = suggestTonnageFromDraft(merged);
      return merged;
    });
    setEditingEntryIndex(null);
  }, []);

  const applyAggregateChange = useCallback((patch: Partial<TemplateExerciseDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
  }, []);

  const resetToSimplePlan = useCallback(() => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        useCustomPlan: false,
        plannedSets: [],
        plannedTonnageKg: suggestTonnageFromDraft({ ...prev, useCustomPlan: false, plannedSets: [] }),
      };
    });
    setEditingEntryIndex(null);
  }, []);

  const displayPlannedSets = useMemo(
    () => (draft ? getDisplayPlannedSetsForDraft(draft) : []),
    [draft],
  );

  const addTimelineEntry = useCallback((kind: "set" | "rest") => {
    setDraft((prev) => {
      if (!prev) return prev;
      const entry: TemplatePlannedSetMock =
        kind === "set"
          ? { type: "set", reps: null, weight_kg: null }
          : { type: "rest", rest_seconds: 0 };
      const base = prev.useCustomPlan
        ? prev.plannedSets
        : buildPreviewPlannedSetsFromDraft(prev);
      const plannedSets = [...base, entry];
      const workCount = plannedSets.filter((row) => row.type === "set").length;
      return {
        ...prev,
        useCustomPlan: true,
        plannedSets,
        plannedSetsCount: String(workCount),
      };
    });
    setEditingEntryIndex(null);
  }, []);

  const openEntryEdit = useCallback(
    (index: number) => {
      if (!draft) return;
      const displaySets = getDisplayPlannedSetsForDraft(draft);
      const entry = displaySets[index];
      if (!entry) return;

      if (editingEntryIndex === index) {
        setEditingEntryIndex(null);
        return;
      }

      setEditingEntryIndex(index);
      if (entry.type === "set") {
        setEntryReps(entry.reps != null ? String(entry.reps) : "");
        setEntryWeight(entry.weight_kg != null ? String(entry.weight_kg) : "");
        setEntryRest("");
      } else {
        setEntryRest(String(entry.rest_seconds));
        setEntryReps("");
        setEntryWeight("");
      }
    },
    [draft, editingEntryIndex],
  );

  const commitEntryEdit = useCallback(() => {
    if (editingEntryIndex == null || !draft) return;
    const baseSets = draft.useCustomPlan
      ? [...draft.plannedSets]
      : buildPreviewPlannedSetsFromDraft(draft);
    const current = baseSets[editingEntryIndex];
    if (!current) return;

    let updated: TemplatePlannedSetMock;
    if (current.type === "set") {
      const repsRaw = entryReps.trim();
      const reps = repsRaw ? Number.parseInt(repsRaw, 10) : null;
      const weightRaw = entryWeight.trim().replace(",", ".");
      const weightKg = weightRaw ? Number(weightRaw) : null;
      updated = {
        type: "set",
        reps: reps != null && Number.isFinite(reps) ? reps : null,
        weight_kg: weightKg != null && Number.isFinite(weightKg) ? weightKg : null,
      };
    } else {
      const sec = Number.parseInt(entryRest, 10);
      updated = {
        type: "rest",
        rest_seconds: Number.isFinite(sec) && sec >= 0 ? sec : 0,
      };
    }

    const plannedSets = [...baseSets];
    plannedSets[editingEntryIndex] = updated;

    const unchanged =
      !draft.useCustomPlan &&
      JSON.stringify(baseSets[editingEntryIndex]) === JSON.stringify(updated);
    if (unchanged) {
      setEditingEntryIndex(null);
      return;
    }

    const workCount = plannedSets.filter((row) => row.type === "set").length;
    setDraft({
      ...draft,
      plannedSets,
      useCustomPlan: true,
      plannedSetsCount: String(workCount),
    });
    setEditingEntryIndex(null);
  }, [draft, editingEntryIndex, entryReps, entryRest, entryWeight]);

  const plannedJsonPreview = useMemo(() => {
    if (!draft || !draft.useCustomPlan || draft.plannedSets.length === 0) {
      return "[]";
    }
    return formatPlannedSetsJsonPreview(draft.plannedSets);
  }, [draft]);

  const returnTo = `/plan-template/${templateId}`;

  const openCatalogPicker = useCallback(() => {
    if (!draft) return;
    const qs = new URLSearchParams({
      pickForTemplateSlot: draft.localId,
      returnTo,
    });
    if (draft.catalogId != null && draft.catalogId > 0) {
      qs.set("seedCatalogId", String(draft.catalogId));
    }
    router.push(`/exercise_catalog?${qs.toString()}`);
  }, [draft, returnTo, router]);

  useEffect(() => {
    if (!visible || !draft) return;
    return on(TEMPLATE_CATALOG_PICK_EVENT, (payload) => {
      if (!payload || typeof payload !== "object") return;
      const row = payload as TemplateCatalogPickPayload;
      if (row.slotId !== draft.localId || !Array.isArray(row.exercises)) return;

      if (row.exercises.length === 0) {
        patchDraft({ catalogId: null, name: "", muscle_group: "" });
        return;
      }

      const [first] = row.exercises;
      patchDraft({
        catalogId: first.catalogId,
        name: first.name.trim(),
        muscle_group: first.muscle_group?.trim() ?? "",
      });
    });
  }, [visible, draft, patchDraft]);

  const handleSave = async () => {
    if (!draft || !exercise || loading) return;
    if (draft.catalogId == null) {
      setError("Выберите упражнение из каталога");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const detail = await replaceWorkoutTemplateExercises(
        templateId,
        buildExercisesAfterEdit(template, exercise.id, draft),
      );
      onSaved(detail);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить упражнение");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePress = useCallback(() => {
    if (!exercise || loading) return;
    setDeleteConfirmVisible(true);
  }, [exercise, loading]);

  const confirmDeleteExercise = useCallback(async () => {
    if (!exercise || loading) return;
    setLoading(true);
    setError("");
    try {
      const detail = await replaceWorkoutTemplateExercises(
        templateId,
        buildExercisesAfterDelete(template, exercise.id),
      );
      setDeleteConfirmVisible(false);
      onSaved(detail);
      onClose();
    } catch (e) {
      setDeleteConfirmVisible(false);
      setError(e instanceof Error ? e.message : "Не удалось удалить упражнение");
    } finally {
      setLoading(false);
    }
  }, [exercise, loading, onClose, onSaved, template, templateId]);

  const deleteConfirmMessage = useMemo(() => {
    const name = exercise?.name?.trim() || "Упражнение";
    if (template.exercises.length <= 1) {
      return `«${name}» будет убрано из шаблона. Список упражнений станет пустым — добавьте новые через «+».`;
    }
    return `«${name}» будет убрано из шаблона.`;
  }, [exercise?.name, template.exercises.length]);

  const hasCatalog = draft?.catalogId != null;
  const simpleDisabled = draft?.useCustomPlan === true;

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
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
              {exercise?.name?.trim() || "Упражнение"}
            </Text>
            <View style={styles.headActions}>
              <Pressable
                onPress={handleDeletePress}
                hitSlop={12}
                accessibilityLabel="Удалить упражнение из шаблона"
                disabled={loading}
              >
                <Ionicons name="trash-outline" size={22} color={theme.danger} />
              </Pressable>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Закрыть" disabled={loading}>
                <Ionicons name="close" size={26} color={theme.textMuted} />
              </Pressable>
            </View>
          </View>

          {draft ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                style={pressableStyle([
                  styles.catalogPickBtn,
                  { borderColor: theme.accent, backgroundColor: theme.accentSoft },
                ])}
                onPress={openCatalogPicker}
              >
                <Ionicons name="library-outline" size={16} color={theme.accent} />
                <Text style={[styles.catalogPickText, { color: theme.accent }]}>
                  {hasCatalog ? "Изменить из каталога" : "Выбрать из каталога"}
                </Text>
              </Pressable>

              {hasCatalog ? (
                <View
                  style={[
                    styles.linkedCatalogBox,
                    { borderColor: theme.border, backgroundColor: theme.bg },
                  ]}
                >
                  <Text style={[styles.linkedCatalogName, { color: theme.text }]}>
                    {draft.name}
                  </Text>
                  {draft.muscle_group ? (
                    <Text style={[styles.linkedCatalogMeta, { color: theme.textMuted }]}>
                      {draft.muscle_group}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.catalogHint, { color: theme.textMuted }]}>
                  Упражнение не выбрано — откройте каталог.
                </Text>
              )}

              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Быстрые настройки</Text>
                {simpleDisabled ? (
                  <Pressable onPress={resetToSimplePlan} hitSlop={8}>
                    <Text style={[styles.resetLink, { color: theme.accent }]}>Сбросить</Text>
                  </Pressable>
                ) : null}
              </View>
              {simpleDisabled ? (
                <Text style={[styles.customPlanHint, { color: theme.textMuted }]}>
                  Сводка неактивна — план задан в JSON ниже. Нажмите «Сбросить», чтобы снова редактировать поля сводки.
                </Text>
              ) : (
                <Text style={[styles.customPlanHint, { color: theme.textMuted }]}>
                  Поля сводки не попадают в planned_sets_json. Точный план — только через подходы ниже.
                </Text>
              )}

              <View style={styles.row3}>
                <View style={styles.rowCell}>
                  <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Подходы</Text>
                  <TextInput
                    style={[
                      styles.inputCompact,
                      { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
                      simpleDisabled && styles.inputDisabled,
                    ]}
                    value={draft.sets}
                    onChangeText={(value) => applySimpleChange({ sets: value })}
                    keyboardType="number-pad"
                    maxLength={2}
                    editable={!simpleDisabled}
                  />
                </View>
                <View style={styles.rowCell}>
                  <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Повторы</Text>
                  <TextInput
                    style={[
                      styles.inputCompact,
                      { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
                      simpleDisabled && styles.inputDisabled,
                    ]}
                    value={draft.reps}
                    onChangeText={(value) => applySimpleChange({ reps: value })}
                    keyboardType="number-pad"
                    maxLength={3}
                    editable={!simpleDisabled}
                  />
                </View>
                <View style={styles.rowCell}>
                  <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Вес, кг</Text>
                  <TextInput
                    style={[
                      styles.inputCompact,
                      { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
                      simpleDisabled && styles.inputDisabled,
                    ]}
                    value={draft.weight}
                    onChangeText={(value) => applySimpleChange({ weight: value })}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    editable={!simpleDisabled}
                  />
                </View>
              </View>

              <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Отдых, сек</Text>
              <TextInput
                style={[
                  styles.inputCompact,
                  { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
                  simpleDisabled && styles.inputDisabled,
                ]}
                value={draft.restSeconds}
                onChangeText={(value) => applySimpleChange({ restSeconds: value })}
                keyboardType="number-pad"
                maxLength={4}
                editable={!simpleDisabled}
              />

              <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 4 }]}>
                Сводка
              </Text>
              {simpleDisabled ? (
                <Text style={[styles.customPlanHint, { color: theme.textMuted }]}>
                  Поля «все подходы» не сохраняются при точечном плане — только JSON и сводка ниже.
                </Text>
              ) : null}

              <View style={styles.row3}>
                <View style={styles.rowCell}>
                  <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Подходов</Text>
                  <TextInput
                    style={[
                      styles.inputCompact,
                      { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
                      !simpleDisabled && styles.inputDisabled,
                    ]}
                    value={draft.plannedSetsCount}
                    onChangeText={(value) => applyAggregateChange({ plannedSetsCount: value })}
                    keyboardType="number-pad"
                    maxLength={2}
                    editable={simpleDisabled}
                  />
                </View>
                <View style={[styles.rowCell, { flex: 2 }]}>
                  <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Тоннаж, кг</Text>
                  <TextInput
                    style={[
                      styles.inputCompact,
                      { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
                    ]}
                    value={draft.plannedTonnageKg}
                    onChangeText={(value) => applyAggregateChange({ plannedTonnageKg: value })}
                    keyboardType="decimal-pad"
                    maxLength={8}
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 4 }]}>
                План (как в базе)
              </Text>
              <Text style={[styles.customPlanHint, { color: theme.textMuted }]}>
                {simpleDisabled
                  ? "Нажмите на подход или отдых, чтобы изменить точечно."
                  : "Превью из быстрых настроек. В planned_sets_json попадёт план после точечного редактирования."}
              </Text>

              <View style={styles.timelineAddRow}>
                <Pressable
                  style={pressableStyle([
                    styles.timelineAddBtn,
                    { borderColor: theme.border, backgroundColor: theme.bg },
                  ])}
                  onPress={() => addTimelineEntry("set")}
                >
                  <Ionicons name="add" size={16} color={theme.accent} />
                  <Text style={[styles.timelineAddText, { color: theme.accent }]}>Подход</Text>
                </Pressable>
                <Pressable
                  style={pressableStyle([
                    styles.timelineAddBtn,
                    { borderColor: theme.border, backgroundColor: theme.bg },
                  ])}
                  onPress={() => addTimelineEntry("rest")}
                >
                  <Ionicons name="add" size={16} color={theme.accent} />
                  <Text style={[styles.timelineAddText, { color: theme.accent }]}>Отдых</Text>
                </Pressable>
              </View>

              <View style={[styles.timelineBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
                {displayPlannedSets.length === 0 ? (
                  <Text style={[styles.timelineEmpty, { color: theme.textMuted }]}>[]</Text>
                ) : null}
                {displayPlannedSets.map((entry, index) => {
                  const isActive = editingEntryIndex === index;
                  const isRest = entry.type === "rest";
                  return (
                    <View key={`plan-entry-${index}`}>
                      <Pressable
                        style={pressableStyle([
                          styles.timelineRow,
                          isActive && { backgroundColor: theme.accentSoft },
                          !simpleDisabled && styles.timelineRowPreview,
                        ])}
                        onPress={() => openEntryEdit(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Редактировать ${formatTemplatePlannedEntryHeading(entry, index, displayPlannedSets)}`}
                      >
                        <View
                          style={[
                            styles.timelineBadge,
                            {
                              backgroundColor: isRest ? theme.border : theme.accentSoft,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.timelineBadgeText,
                              { color: isRest ? theme.textMuted : theme.accent },
                            ]}
                          >
                            {isRest ? "R" : displayPlannedSets.slice(0, index + 1).filter((row) => row.type === "set").length}
                          </Text>
                        </View>
                        <View style={styles.timelineTextBlock}>
                          <Text style={[styles.timelineTitle, { color: theme.text }]}>
                            {formatTemplatePlannedEntryHeading(entry, index, displayPlannedSets)}
                          </Text>
                          <Text style={[styles.timelineValue, { color: theme.textMuted }]}>
                            {formatTemplatePlannedSetLabel(entry)}
                          </Text>
                        </View>
                        <Ionicons
                          name={isActive ? "chevron-up" : "chevron-forward"}
                          size={18}
                          color={theme.textMuted}
                        />
                      </Pressable>

                      {isActive ? (
                        <View
                          style={[
                            styles.entryEditor,
                            { borderColor: theme.border, backgroundColor: theme.card },
                          ]}
                        >
                          {entry.type === "set" ? (
                            <View style={styles.row3}>
                              <View style={styles.rowCell}>
                                <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Повторы</Text>
                                <TextInput
                                  style={[
                                    styles.inputCompact,
                                    {
                                      borderColor: theme.border,
                                      color: theme.text,
                                      backgroundColor: theme.bg,
                                    },
                                  ]}
                                  value={entryReps}
                                  onChangeText={setEntryReps}
                                  keyboardType="number-pad"
                                  maxLength={3}
                                />
                              </View>
                              <View style={styles.rowCell}>
                                <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Вес, кг</Text>
                                <TextInput
                                  style={[
                                    styles.inputCompact,
                                    {
                                      borderColor: theme.border,
                                      color: theme.text,
                                      backgroundColor: theme.bg,
                                    },
                                  ]}
                                  value={entryWeight}
                                  onChangeText={setEntryWeight}
                                  keyboardType="decimal-pad"
                                  maxLength={6}
                                />
                              </View>
                            </View>
                          ) : (
                            <>
                              <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Секунды</Text>
                              <TextInput
                                style={[
                                  styles.inputCompact,
                                  {
                                    borderColor: theme.border,
                                    color: theme.text,
                                    backgroundColor: theme.bg,
                                  },
                                ]}
                                value={entryRest}
                                onChangeText={setEntryRest}
                                keyboardType="number-pad"
                                maxLength={4}
                              />
                            </>
                          )}
                          <Pressable
                            style={pressableStyle([
                              plansStyles.actionButton,
                              plansStyles.actionButtonPrimary,
                              styles.entryApplyBtn,
                            ])}
                            onPress={commitEntryEdit}
                          >
                            <Text
                              style={[
                                plansStyles.actionButtonText,
                                plansStyles.actionButtonTextPrimary,
                              ]}
                            >
                              Применить
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <Text style={[styles.miniLabel, { color: theme.textMuted }]}>JSON planned_sets</Text>
              <View
                style={[
                  styles.jsonPreviewBox,
                  { borderColor: theme.border, backgroundColor: theme.bg },
                ]}
              >
                <Text
                  style={[styles.jsonPreviewText, { color: theme.textMuted }]}
                  selectable
                  {...textBreakProps}
                >
                  {plannedJsonPreview}
                </Text>
              </View>

              <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Заметка</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputMulti,
                  { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
                ]}
                value={draft.note}
                onChangeText={(value) => patchDraft({ note: value })}
                placeholder="Комментарий к упражнению в шаблоне"
                placeholderTextColor={theme.textPlaceholder}
                multiline
                maxLength={2000}
                {...textBreakProps}
              />

              {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
            </ScrollView>
          ) : null}

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
              disabled={loading || !draft}
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

    <WorkoutDeleteConfirmModal
      visible={deleteConfirmVisible}
      title="Удалить упражнение?"
      message={deleteConfirmMessage}
      confirmLabel={loading ? "Удаление…" : "Удалить"}
      onCancel={() => {
        if (!loading) setDeleteConfirmVisible(false);
      }}
      onConfirm={() => void confirmDeleteExercise()}
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
    maxHeight: "88%",
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  headActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    lineHeight: 24,
    flex: 1,
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  miniLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginBottom: 4,
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
  inputCompact: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  inputDisabled: {
    opacity: 0.45,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  resetLink: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  customPlanHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  timelineAddRow: {
    flexDirection: "row",
    gap: 8,
  },
  timelineAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timelineAddText: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  timelineEmpty: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timelineBox: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timelineRowPreview: {
    opacity: 0.92,
  },
  timelineBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  timelineTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  timelineTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  timelineValue: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  entryEditor: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  entryApplyBtn: {
    alignSelf: "flex-start",
    minWidth: 120,
    paddingHorizontal: 16,
  },
  jsonPreviewBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  jsonPreviewText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    lineHeight: 16,
  },
  catalogPickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  catalogPickText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  catalogHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  linkedCatalogBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  linkedCatalogName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  linkedCatalogMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  row3: {
    flexDirection: "row",
    gap: 10,
  },
  rowCell: {
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
