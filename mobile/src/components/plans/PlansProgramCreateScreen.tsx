import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createProgram, fetchCurrentProgramOptional, fetchProgram, updateProgram } from "@/api/plans";
import { fetchWorkoutTemplates } from "@/api/workoutTemplates";
import { useFabScrollPadding } from "@/components/navigation/bottomTabBarInset";
import ScreenEnterFrame, { useGoBackWithScreenEnter } from "@/components/navigation/ScreenEnterFrame";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import {
  createEmptyProgramDraft,
  PROGRAM_SCHEDULE_TYPE_OPTIONS,
  programDraftToCreatePayload,
  programToDraft,
  switchDraftScheduleType,
  validateProgramDraft,
  weekdayLabel,
  type ProgramDraftState,
} from "@/components/plans/programDraft";
import type { ProgramDay, ProgramDayKind, ProgramScheduleType, WorkoutTemplateMock } from "@/components/plans/types";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import { metricToken } from "@/theme/metricTokens";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import { SCREEN_HEADER_TOP_PADDING } from "@/theme/screenChrome";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

type TemplatePickerTarget =
  | { scope: "day"; index: number }
  | { scope: "cycle"; index: number }
  | { scope: "rotation"; index: number }
  | { scope: "cycle-add" }
  | { scope: "rotation-add" };

function templateTitle(templates: WorkoutTemplateMock[], templateId: number | null): string {
  if (templateId == null) return "Не выбран";
  const found = templates.find((item) => Number(item.id) === templateId);
  return found?.title ?? `Шаблон #${templateId}`;
}

/** Stack-экран создания или редактирования программы тренировок. */
export default function PlansProgramCreateScreen({ programId }: { programId?: number }) {
  const isEditMode = programId != null && programId >= 1;
  const theme = useAppTheme();
  const router = useRouter();
  const goBack = useGoBackWithScreenEnter("/plans");
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 400 ? 20 : 16;
  const bottomPad = useFabScrollPadding(24);
  const styles = useMemo(() => createPlansScreenStyles(theme), [theme]);
  const fieldStyles = useMemo(() => createFieldStyles(theme), [theme]);

  const [templates, setTemplates] = useState<WorkoutTemplateMock[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [programLoading, setProgramLoading] = useState(isEditMode);
  const [programError, setProgramError] = useState<string | null>(null);
  const [initialIsCurrent, setInitialIsCurrent] = useState(false);
  const [draft, setDraft] = useState<ProgramDraftState>(() => createEmptyProgramDraft());
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<TemplatePickerTarget | null>(null);

  const screenLoading = templatesLoading || programLoading;

  const defaultTemplateId = useMemo(() => {
    const first = templates[0];
    if (!first) return null;
    const id = Number(first.id);
    return Number.isInteger(id) && id >= 1 ? id : null;
  }, [templates]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setTemplatesLoading(true);
      if (isEditMode) {
        setProgramLoading(true);
        setProgramError(null);
      }
      try {
        const [items, loadedProgram, currentProgram] = await Promise.all([
          fetchWorkoutTemplates(),
          isEditMode && programId ? fetchProgram(programId) : Promise.resolve(null),
          isEditMode ? fetchCurrentProgramOptional() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setTemplates(items);
        setTemplatesError(null);

        if (loadedProgram) {
          const isCurrent = currentProgram?.id === loadedProgram.id;
          setInitialIsCurrent(isCurrent);
          setDraft(programToDraft(loadedProgram, isCurrent));
        } else if (items.length > 0 && !isEditMode) {
          const id = Number(items[0].id);
          const templateId = Number.isInteger(id) && id >= 1 ? id : null;
          setDraft((prev) => {
            if (prev.days.some((day) => day.template_id != null)) return prev;
            if (prev.scheduleType !== "sequence") return prev;
            return {
              ...prev,
              days: prev.days.map((day, index) =>
                index === 0 && day.kind === "workout"
                  ? { ...day, template_id: templateId, enabled: templateId != null }
                  : day,
              ),
            };
          });
        }
      } catch (e) {
        if (cancelled) return;
        if (isEditMode) {
          setProgramError(e instanceof Error ? e.message : "Не удалось загрузить программу");
        } else {
          setTemplates([]);
          setTemplatesError(e instanceof Error ? e.message : "Не удалось загрузить шаблоны");
        }
      } finally {
        if (!cancelled) {
          setTemplatesLoading(false);
          setProgramLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, programId]);

  const updateDay = useCallback((index: number, patch: Partial<ProgramDay>) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)),
    }));
  }, []);

  const setDayKind = useCallback((index: number, kind: ProgramDayKind) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((day, dayIndex) => {
        if (dayIndex !== index) return day;
        if (kind === "rest") {
          return { ...day, kind, template_id: null, enabled: false };
        }
        return {
          ...day,
          kind,
          enabled: true,
          template_id: day.template_id ?? defaultTemplateId,
        };
      }),
    }));
  }, [defaultTemplateId]);

  const addSequenceSlot = useCallback(() => {
    setDraft((prev) => {
      const nextSlot = prev.days.length + 1;
      return {
        ...prev,
        days: [
          ...prev.days,
          {
            slot: nextSlot,
            kind: "workout" as ProgramDayKind,
            iso_weekday: null,
            template_id: defaultTemplateId,
            enabled: defaultTemplateId != null,
          },
        ],
      };
    });
  }, [defaultTemplateId]);

  const removeSequenceSlot = useCallback((index: number) => {
    setDraft((prev) => {
      if (prev.days.length <= 1) return prev;
      const nextDays = prev.days
        .filter((_, dayIndex) => dayIndex !== index)
        .map((day, dayIndex) => ({ ...day, slot: dayIndex + 1 }));
      return { ...prev, days: nextDays };
    });
  }, []);

  const changeScheduleType = useCallback(
    (nextType: ProgramScheduleType) => {
      setDraft((prev) => switchDraftScheduleType(prev, nextType, defaultTemplateId));
    },
    [defaultTemplateId],
  );

  const applyTemplatePick = useCallback(
    (templateId: number) => {
      if (!pickerTarget) return;

      setDraft((prev) => {
        if (pickerTarget.scope === "day") {
          return {
            ...prev,
            days: prev.days.map((day, index) =>
              index === pickerTarget.index ? { ...day, template_id: templateId } : day,
            ),
          };
        }
        if (pickerTarget.scope === "cycle") {
          return {
            ...prev,
            cycleTemplates: prev.cycleTemplates.map((id, index) =>
              index === pickerTarget.index ? templateId : id,
            ),
          };
        }
        if (pickerTarget.scope === "rotation") {
          return {
            ...prev,
            rotation: prev.rotation.map((id, index) =>
              index === pickerTarget.index ? templateId : id,
            ),
          };
        }
        if (pickerTarget.scope === "cycle-add") {
          return { ...prev, cycleTemplates: [...prev.cycleTemplates, templateId] };
        }
        return { ...prev, rotation: [...prev.rotation, templateId] };
      });
      setPickerTarget(null);
    },
    [pickerTarget],
  );

  const handleSave = useCallback(async () => {
    const validationError = validateProgramDraft(draft);
    if (validationError) {
      Alert.alert("Проверьте данные", validationError);
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      const payload = programDraftToCreatePayload(draft);
      if (isEditMode && programId) {
        const isCurrentChanged = draft.setAsCurrent !== initialIsCurrent;
        await updateProgram(
          programId,
          payload,
          isCurrentChanged ? { isCurrent: draft.setAsCurrent } : undefined,
        );
      } else {
        await createProgram(payload, { isCurrent: draft.setAsCurrent });
      }
      router.replace("/plans");
    } catch (e) {
      Alert.alert(
        "Не удалось сохранить",
        e instanceof Error ? e.message : "Попробуйте ещё раз.",
      );
    } finally {
      setSaving(false);
    }
  }, [draft, initialIsCurrent, isEditMode, programId, router, saving]);

  const renderDayEditors = () => {
    if (draft.scheduleType !== "week_fixed" && draft.scheduleType !== "sequence") {
      return null;
    }

    return (
      <View style={styles.card}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
          {draft.scheduleType === "week_fixed" ? "Дни недели" : "Слоты цикла"}
        </Text>
        {draft.days.map((day, index) => (
          <View key={`${day.slot}-${index}`} style={fieldStyles.dayRow}>
            <View style={fieldStyles.dayHead}>
              <Text style={fieldStyles.dayLabel}>
                {draft.scheduleType === "week_fixed" && day.iso_weekday != null
                  ? weekdayLabel(day.iso_weekday)
                  : `Слот ${day.slot}`}
              </Text>
              {draft.scheduleType === "sequence" && draft.days.length > 1 ? (
                <Pressable
                  onPress={() => removeSequenceSlot(index)}
                  hitSlop={8}
                  accessibilityLabel={`Удалить слот ${day.slot}`}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                </Pressable>
              ) : null}
            </View>

            <View style={fieldStyles.kindRow}>
              {(["workout", "rest"] as const).map((kind) => {
                const active = day.kind === kind;
                return (
                  <Pressable
                    key={kind}
                    onPress={() => setDayKind(index, kind)}
                    style={pressableStyle([
                      fieldStyles.kindChip,
                      {
                        borderColor: active ? theme.accent : theme.border,
                        backgroundColor: active ? theme.accentSoft : theme.card,
                      },
                    ])}
                  >
                    <Text
                      style={[
                        fieldStyles.kindChipText,
                        { color: active ? theme.accent : theme.textMuted },
                      ]}
                    >
                      {kind === "workout" ? "Тренировка" : "Отдых"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {day.kind === "workout" ? (
              <>
                <View style={fieldStyles.switchRow}>
                  <Text style={fieldStyles.switchLabel}>Включён</Text>
                  <Switch
                    value={day.enabled}
                    onValueChange={(enabled) => updateDay(index, { enabled })}
                    trackColor={{ false: theme.border, true: theme.accent }}
                  />
                </View>
                <Pressable
                  style={pressableStyle([fieldStyles.selectInput, { borderColor: theme.border }])}
                  onPress={() => setPickerTarget({ scope: "day", index })}
                  disabled={templates.length === 0}
                >
                  <Text style={[fieldStyles.selectText, { color: theme.text }]} numberOfLines={1}>
                    {templateTitle(templates, day.template_id)}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
                </Pressable>
              </>
            ) : null}
          </View>
        ))}

        {draft.scheduleType === "sequence" ? (
          <Pressable
            style={pressableStyle([styles.actionButton, { marginTop: 8 }])}
            onPress={addSequenceSlot}
          >
            <Text style={styles.actionButtonText}>Добавить слот</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderCyclePatternEditor = () => {
    if (draft.scheduleType !== "cycle_pattern") return null;

    return (
      <View style={styles.card}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Ритм цикла</Text>
        <View style={fieldStyles.counterRow}>
          <Text style={fieldStyles.fieldLabel}>Тренировок подряд</Text>
          <View style={fieldStyles.counterControls}>
            <Pressable
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  pattern: { ...prev.pattern, work: Math.max(1, prev.pattern.work - 1) },
                }))
              }
              hitSlop={8}
            >
              <Ionicons name="remove-circle-outline" size={28} color={theme.accent} />
            </Pressable>
            <Text style={fieldStyles.counterValue}>{draft.pattern.work}</Text>
            <Pressable
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  pattern: { ...prev.pattern, work: prev.pattern.work + 1 },
                }))
              }
              hitSlop={8}
            >
              <Ionicons name="add-circle-outline" size={28} color={theme.accent} />
            </Pressable>
          </View>
        </View>
        <View style={fieldStyles.counterRow}>
          <Text style={fieldStyles.fieldLabel}>Дней отдыха</Text>
          <View style={fieldStyles.counterControls}>
            <Pressable
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  pattern: { ...prev.pattern, rest: Math.max(1, prev.pattern.rest - 1) },
                }))
              }
              hitSlop={8}
            >
              <Ionicons name="remove-circle-outline" size={28} color={theme.accent} />
            </Pressable>
            <Text style={fieldStyles.counterValue}>{draft.pattern.rest}</Text>
            <Pressable
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  pattern: { ...prev.pattern, rest: prev.pattern.rest + 1 },
                }))
              }
              hitSlop={8}
            >
              <Ionicons name="add-circle-outline" size={28} color={theme.accent} />
            </Pressable>
          </View>
        </View>

        <Text style={[fieldStyles.fieldLabel, { marginTop: 12 }]}>Ротация шаблонов</Text>
        {draft.cycleTemplates.map((templateId, index) => (
          <View key={`cycle-${index}`} style={fieldStyles.templateListRow}>
            <Pressable
              style={pressableStyle([
                fieldStyles.selectInput,
                fieldStyles.templateListPicker,
                { borderColor: theme.border },
              ])}
              onPress={() => setPickerTarget({ scope: "cycle", index })}
            >
              <Text style={[fieldStyles.selectText, { color: theme.text }]} numberOfLines={1}>
                {templateTitle(templates, templateId)}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
            </Pressable>
            <Pressable
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  cycleTemplates: prev.cycleTemplates.filter((_, i) => i !== index),
                }))
              }
              hitSlop={8}
              disabled={draft.cycleTemplates.length <= 1}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={draft.cycleTemplates.length <= 1 ? theme.textMuted : theme.danger}
              />
            </Pressable>
          </View>
        ))}
        <Pressable
          style={pressableStyle([styles.actionButton, { marginTop: 8 }])}
          onPress={() => setPickerTarget({ scope: "cycle-add" })}
          disabled={templates.length === 0}
        >
          <Text style={styles.actionButtonText}>Добавить шаблон</Text>
        </Pressable>
      </View>
    );
  };

  const renderWeeklyQuotaEditor = () => {
    if (draft.scheduleType !== "weekly_quota") return null;

    return (
      <View style={styles.card}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Квота</Text>
        <View style={fieldStyles.counterRow}>
          <Text style={fieldStyles.fieldLabel}>Тренировок в неделю</Text>
          <View style={fieldStyles.counterControls}>
            <Pressable
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  sessionsPerWeek: Math.max(1, prev.sessionsPerWeek - 1),
                }))
              }
              hitSlop={8}
            >
              <Ionicons name="remove-circle-outline" size={28} color={theme.accent} />
            </Pressable>
            <Text style={fieldStyles.counterValue}>{draft.sessionsPerWeek}</Text>
            <Pressable
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  sessionsPerWeek: Math.min(7, prev.sessionsPerWeek + 1),
                }))
              }
              hitSlop={8}
            >
              <Ionicons name="add-circle-outline" size={28} color={theme.accent} />
            </Pressable>
          </View>
        </View>

        <Text style={fieldStyles.fieldLabel}>Мин. отдых между тренировками (ч)</Text>
        <TextInput
          style={[fieldStyles.textInput, { borderColor: theme.border, color: theme.text }]}
          value={draft.minRestHours}
          onChangeText={(value) => setDraft((prev) => ({ ...prev, minRestHours: value }))}
          placeholder="Не задан"
          placeholderTextColor={theme.textPlaceholder}
          keyboardType="number-pad"
        />

        <Text style={[fieldStyles.fieldLabel, { marginTop: 12 }]}>Ротация шаблонов</Text>
        {draft.rotation.map((templateId, index) => (
          <View key={`rotation-${index}`} style={fieldStyles.templateListRow}>
            <Pressable
              style={pressableStyle([
                fieldStyles.selectInput,
                fieldStyles.templateListPicker,
                { borderColor: theme.border },
              ])}
              onPress={() => setPickerTarget({ scope: "rotation", index })}
            >
              <Text style={[fieldStyles.selectText, { color: theme.text }]} numberOfLines={1}>
                {templateTitle(templates, templateId)}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
            </Pressable>
            <Pressable
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  rotation: prev.rotation.filter((_, i) => i !== index),
                }))
              }
              hitSlop={8}
              disabled={draft.rotation.length <= 1}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={draft.rotation.length <= 1 ? theme.textMuted : theme.danger}
              />
            </Pressable>
          </View>
        ))}
        <Pressable
          style={pressableStyle([styles.actionButton, { marginTop: 8 }])}
          onPress={() => setPickerTarget({ scope: "rotation-add" })}
          disabled={templates.length === 0}
        >
          <Text style={styles.actionButtonText}>Добавить шаблон</Text>
        </Pressable>
      </View>
    );
  };

  if (screenLoading) {
    return (
      <ScreenEnterFrame direction="slide_from_right">
        <View
          style={{
            flex: 1,
            backgroundColor: theme.bg,
            paddingTop: insets.top + SCREEN_HEADER_TOP_PADDING,
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
          }}
        >
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.emptyDaySub}>
            {isEditMode ? "Загрузка программы…" : "Загрузка…"}
          </Text>
        </View>
      </ScreenEnterFrame>
    );
  }

  if (programError) {
    return (
      <ScreenEnterFrame direction="slide_from_right">
        <View
          style={{
            flex: 1,
            backgroundColor: theme.bg,
            paddingTop: insets.top + SCREEN_HEADER_TOP_PADDING,
            paddingHorizontal: horizontalPadding,
          }}
        >
          <ScreenTitleRowIconButton onPress={goBack} accessibilityLabel="Назад" hitSlop={12}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={metricToken("violet", theme.dark).fg}
            />
          </ScreenTitleRowIconButton>
          <View style={styles.emptyDay}>
            <Ionicons name="alert-circle-outline" size={32} color={theme.danger} />
            <Text style={styles.emptyDayTitle}>Не удалось загрузить программу</Text>
            <Text style={styles.emptyDaySub}>{programError}</Text>
          </View>
        </View>
      </ScreenEnterFrame>
    );
  }

  return (
    <ScreenEnterFrame direction="slide_from_right">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + SCREEN_HEADER_TOP_PADDING,
          paddingHorizontal: horizontalPadding,
          paddingBottom: bottomPad,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <ScreenTitleRowIconButton onPress={goBack} accessibilityLabel="Назад" hitSlop={12}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={metricToken("violet", theme.dark).fg}
            />
          </ScreenTitleRowIconButton>
          <View style={{ flex: 1, minWidth: 0, marginLeft: 4 }}>
            <Text
              style={{
                fontFamily: fonts.semiBold,
                fontSize: 22,
                lineHeight: 28,
                color: theme.text,
                letterSpacing: -0.3,
              }}
              numberOfLines={2}
              accessibilityRole="header"
            >
              {isEditMode ? "Редактирование программы" : "Новая программа"}
            </Text>
          </View>
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving}
            style={pressableStyle({ paddingVertical: 8, paddingHorizontal: 4, opacity: saving ? 0.5 : 1 })}
            accessibilityLabel="Сохранить программу"
          >
            <Text style={{ fontFamily: fonts.semiBold, fontSize: 16, color: theme.accent }}>
              {saving ? "…" : "Сохранить"}
            </Text>
          </Pressable>
        </View>

        {templatesError ? (
          <View style={[styles.card, styles.emptyDay, { marginBottom: 12 }]}>
            <Ionicons name="alert-circle-outline" size={22} color={theme.danger} />
            <Text style={styles.emptyDaySub}>{templatesError}</Text>
          </View>
        ) : templates.length === 0 ? (
          <View style={[styles.card, styles.emptyDay, { marginBottom: 12 }]}>
            <Ionicons name="document-outline" size={24} color={theme.textMuted} />
            <Text style={styles.emptyDayTitle}>Нужен хотя бы один шаблон</Text>
            <Text style={styles.emptyDaySub}>
              Создайте шаблон на вкладке «Шаблоны», затем вернитесь сюда.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={fieldStyles.fieldLabel}>Название</Text>
          <TextInput
            style={[fieldStyles.textInput, { borderColor: theme.border, color: theme.text }]}
            value={draft.name}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, name: value }))}
            placeholder="Например: PPL — 3 тренировки"
            placeholderTextColor={theme.textPlaceholder}
          />

          <View style={fieldStyles.switchRow}>
            <Text style={fieldStyles.switchLabel}>Сделать текущей программой</Text>
            <Switch
              value={draft.setAsCurrent}
              onValueChange={(setAsCurrent) => setDraft((prev) => ({ ...prev, setAsCurrent }))}
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Тип расписания</Text>
          {PROGRAM_SCHEDULE_TYPE_OPTIONS.map((option) => {
            const active = draft.scheduleType === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => changeScheduleType(option.id)}
                style={pressableStyle([
                  fieldStyles.scheduleOption,
                  {
                    borderColor: active ? theme.accent : theme.border,
                    backgroundColor: active ? theme.accentSoft : theme.card,
                  },
                ])}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      fieldStyles.scheduleOptionTitle,
                      { color: active ? theme.accent : theme.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={[fieldStyles.scheduleOptionHint, { color: theme.textMuted }]}>
                    {option.hint}
                  </Text>
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {renderDayEditors()}
        {renderCyclePatternEditor()}
        {renderWeeklyQuotaEditor()}

        <Pressable
          style={pressableStyle([
            styles.actionButton,
            styles.actionButtonPrimary,
            { marginTop: 4 },
            (saving || templates.length === 0) && { opacity: 0.5 },
          ])}
          onPress={() => void handleSave()}
          disabled={saving || templates.length === 0}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
            {saving ? "Сохранение…" : isEditMode ? "Сохранить изменения" : "Сохранить программу"}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={pickerTarget != null}
        animationType="fade"
        transparent
        onRequestClose={() => setPickerTarget(null)}
      >
        <View style={[fieldStyles.modalBackdrop, { backgroundColor: theme.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerTarget(null)} />
          <View style={[fieldStyles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[fieldStyles.modalTitle, { color: theme.text }]}>Выберите шаблон</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {templates.map((template) => {
                const templateId = Number(template.id);
                return (
                  <Pressable
                    key={template.id}
                    style={pressableStyle(fieldStyles.modalItem)}
                    onPress={() => applyTemplatePick(templateId)}
                  >
                    <Text style={[fieldStyles.modalItemText, { color: theme.text }]} numberOfLines={2}>
                      {template.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenEnterFrame>
  );
}

function createFieldStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    fieldLabel: {
      fontFamily: fonts.medium,
      fontSize: 13,
      color: theme.textMuted,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: PLAQUE_RADIUS,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "android" ? 10 : 12,
      fontFamily: fonts.regular,
      fontSize: 15,
      marginBottom: 12,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    switchLabel: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 15,
      color: theme.text,
    },
    scheduleOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderRadius: PLAQUE_RADIUS,
      padding: 14,
      marginBottom: 10,
    },
    scheduleOptionTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 15,
      marginBottom: 4,
    },
    scheduleOptionHint: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
    },
    dayRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      paddingTop: 14,
      marginTop: 14,
    },
    dayHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    dayLabel: {
      fontFamily: fonts.semiBold,
      fontSize: 15,
      color: theme.text,
    },
    kindRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 10,
    },
    kindChip: {
      flex: 1,
      borderWidth: 1,
      borderRadius: PLAQUE_RADIUS,
      paddingVertical: 10,
      alignItems: "center",
    },
    kindChipText: {
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    selectInput: {
      borderWidth: 1,
      borderRadius: PLAQUE_RADIUS,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    selectText: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.regular,
      fontSize: 15,
    },
    counterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    counterControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    counterValue: {
      minWidth: 28,
      textAlign: "center",
      fontFamily: fonts.semiBold,
      fontSize: 18,
      color: theme.text,
    },
    templateListRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    templateListPicker: {
      flex: 1,
      minWidth: 0,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      borderRadius: PLAQUE_RADIUS,
      padding: 16,
      maxHeight: "80%",
    },
    modalTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 17,
      marginBottom: 12,
    },
    modalItem: {
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    modalItemText: {
      fontFamily: fonts.regular,
      fontSize: 15,
    },
  });
}
