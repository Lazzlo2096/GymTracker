import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deleteWorkoutTemplate, fetchWorkoutTemplateById } from "@/api/workoutTemplates";
import type { GuardedFocusLoadResult } from "@/hooks/useGuardedFocusLoad";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import {
  countTemplateWorkingSets,
  formatTemplatePlannedSetLabel,
} from "@/components/plans/templatePlanFormat";
import TemplateExerciseEditModal from "@/components/plans/TemplateExerciseEditModal";
import WorkoutTemplateFormModal from "@/components/plans/WorkoutTemplateFormModal";
import type { WorkoutTemplateDetailMock, WorkoutTemplateExerciseMock } from "@/components/plans/types";
import ScreenEnterFrame, { useGoBackWithScreenEnter } from "@/components/navigation/ScreenEnterFrame";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import WorkoutActionsSheet, { type ActionRow } from "@/components/modals/WorkoutActionsSheet";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import { MetricIconCircle, metricToken } from "@/components/workouts/metricIcon";
import { useFabScrollPadding } from "@/components/navigation/bottomTabBarInset";
import { useTraceScreen } from "@/debug/useTraceScreen";
import {
  TEMPLATE_DETAIL_UPDATED_EVENT,
  parseTemplateDetailUpdatedPayload,
} from "@/events/templateDetailEvents";
import { on } from "@/utils/eventBus";
import FloatingAddButton from "@/components/ui/FloatingAddButton";
import { SCREEN_HEADER_TOP_PADDING } from "@/theme/screenChrome";
import { fonts } from "@/theme/typography";
import { formatWorkoutDuration } from "@/utils/workoutListApi";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const TEMPLATE_META_GLYPH_SIZE = 18;

const TEMPLATE_ACTIONS: ActionRow[] = [
  { id: "edit", label: "Редактировать", icon: "pencil-outline" },
  { id: "delete", label: "Удалить шаблон", icon: "trash-outline", destructive: true },
];

function mockAction(label: string) {
  Alert.alert("Скоро", `${label} — подключим в следующей итерации.`);
}

export default function PlansTemplateDetailScreen() {
  useTraceScreen("PlansTemplateDetailScreen");
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = typeof id === "string" ? id : "";

  const [template, setTemplate] = useState<WorkoutTemplateDetailMock | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [editFormVisible, setEditFormVisible] = useState(false);
  const [exerciseEditVisible, setExerciseEditVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<WorkoutTemplateExerciseMock | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteTargetRef = useRef<WorkoutTemplateDetailMock | null>(null);

  const loadTemplate = useCallback(async (): Promise<
    GuardedFocusLoadResult<WorkoutTemplateDetailMock>
  > => {
    const detail = await fetchWorkoutTemplateById(templateId);
    if (!detail) return { kind: "not_found" };
    return { kind: "success", data: detail };
  }, [templateId]);

  const handleTemplateLoaded = useCallback((detail: WorkoutTemplateDetailMock) => {
    setTemplate(detail);
    setNotFound(false);
    setError(null);
  }, []);

  const {
    loading,
    reload,
    invalidateInFlightLoads,
    applyLocalData,
  } = useGuardedFocusLoad({
    enabled: Boolean(templateId),
    load: loadTemplate,
    onSuccess: handleTemplateLoaded,
    onNotFound: () => {
      setTemplate(null);
      setNotFound(true);
      setError(null);
    },
    onError: (message) => {
      setTemplate(null);
      setNotFound(false);
      setError(message);
    },
    onDisabled: () => {
      setTemplate(null);
      setNotFound(true);
      setError(null);
    },
  });

  useEffect(() => {
    return on(TEMPLATE_DETAIL_UPDATED_EVENT, (payload) => {
      const parsed = parseTemplateDetailUpdatedPayload(payload);
      if (!parsed || parsed.templateId !== templateId) return;
      applyLocalData(parsed.detail);
    });
  }, [applyLocalData, templateId]);

  const theme = useAppTheme();
  const router = useRouter();
  const goBack = useGoBackWithScreenEnter("/plans");
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 400 ? 20 : 16;
  const bottomPad = useFabScrollPadding(24);
  const styles = useMemo(() => createPlansScreenStyles(theme), [theme]);

  const closeActions = useCallback(() => setActionsVisible(false), []);

  const openExerciseEdit = useCallback((exercise: WorkoutTemplateExerciseMock) => {
    setEditingExercise(exercise);
    setExerciseEditVisible(true);
  }, []);

  const closeExerciseEdit = useCallback(() => setExerciseEditVisible(false), []);

  const dismissExerciseEdit = useCallback(() => {
    setEditingExercise(null);
  }, []);

  const handleMenuAction = useCallback(
    (action: string) => {
      closeActions();
      if (action === "edit") {
        setEditFormVisible(true);
        return;
      }
      if (action === "delete" && template) {
        deleteTargetRef.current = template;
        setDeleteConfirmVisible(true);
      }
    },
    [closeActions, template],
  );

  const confirmDelete = useCallback(async () => {
    const target = deleteTargetRef.current ?? template;
    if (!target || deleting) return;
    setDeleting(true);
    try {
      await deleteWorkoutTemplate(target.id);
      setDeleteConfirmVisible(false);
      router.replace("/plans");
    } catch (e) {
      Alert.alert(
        "Не удалось удалить",
        e instanceof Error ? e.message : "Попробуйте ещё раз.",
      );
    } finally {
      setDeleting(false);
    }
  }, [deleting, router, template]);

  if (loading) {
    return (
      <ScreenEnterFrame direction="slide_from_right">
        <View
          style={{
            flex: 1,
            backgroundColor: theme.bg,
            paddingTop: insets.top + SCREEN_HEADER_TOP_PADDING,
            paddingHorizontal: horizontalPadding,
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
          }}
        >
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.emptyDaySub}>Загрузка шаблона…</Text>
        </View>
      </ScreenEnterFrame>
    );
  }

  if (error) {
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
            <Text style={styles.emptyDayTitle}>Не удалось загрузить шаблон</Text>
            <Text style={styles.emptyDaySub}>{error}</Text>
            <Pressable
              style={pressableStyle([styles.actionButton, styles.actionButtonPrimary, { marginTop: 8 }])}
              onPress={() => void reload({ force: true })}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                Повторить
              </Text>
            </Pressable>
          </View>
        </View>
      </ScreenEnterFrame>
    );
  }

  if (!template || notFound) {
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
            <Ionicons name="document-outline" size={32} color={theme.textMuted} />
            <Text style={styles.emptyDayTitle}>Шаблон не найден</Text>
            <Text style={styles.emptyDaySub}>
              Вернитесь к списку шаблонов и выберите другой.
            </Text>
            <Pressable
              style={pressableStyle([styles.actionButton, styles.actionButtonPrimary, { marginTop: 8 }])}
              onPress={() => router.replace("/plans")}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                К планам
              </Text>
            </Pressable>
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
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
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
              {template.title}
            </Text>
          </View>
          <ScreenTitleRowIconButton
            onPress={() => setActionsVisible(true)}
            accessibilityLabel="Действия с шаблоном"
            hitSlop={12}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={theme.textMuted} />
          </ScreenTitleRowIconButton>
        </View>

        {template.description ? (
          <Text style={[styles.templateDescription, { marginBottom: 8, fontSize: 14 }]}>
            {template.description}
          </Text>
        ) : null}

        {template.gym_name ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <Ionicons name="location-outline" size={14} color={theme.accent} />
            <Text style={styles.sessionMeta} numberOfLines={1}>
              {template.gym_name}
            </Text>
          </View>
        ) : null}

        <View nativeID="plans-template-detail-meta-row" style={[styles.templateMetaRow, { marginBottom: 16 }]}>
          <View style={styles.templateMetaItem}>
            <MetricIconCircle figmaKind="volume" size={TEMPLATE_META_GLYPH_SIZE} />
            <Text style={styles.templateMetaChip}>{template.exercises_count} упр.</Text>
          </View>
          <Text style={styles.templateMetaDot}>·</Text>
          <View style={styles.templateMetaItem}>
            <MetricIconCircle figmaKind="duration" size={TEMPLATE_META_GLYPH_SIZE} />
            <Text style={styles.templateMetaChip}>
              ~{formatWorkoutDuration(template.estimated_minutes)}
            </Text>
          </View>
          {template.last_used_label ? (
            <>
              <Text style={styles.templateMetaDot}>·</Text>
              <View style={styles.templateMetaItem}>
                <MetricIconCircle
                  materialIcon="history"
                  variant="violet"
                  size={TEMPLATE_META_GLYPH_SIZE}
                />
                <Text style={styles.templateMetaChip}>{template.last_used_label}</Text>
              </View>
            </>
          ) : null}
        </View>

        {template.note ? (
          <View style={[styles.card, { marginBottom: 16 }]}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline, { marginBottom: 6 }]}>
              Заметка
            </Text>
            <Text style={styles.programHint}>{template.note}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>План упражнений</Text>
        <Text style={[styles.programHint, { marginBottom: 12, marginTop: -4 }]}>
          Нажмите на упражнение, чтобы изменить план подходов и отдыхов.
        </Text>

        {template.exercises.map((exercise, index) => {
          const workingSets = countTemplateWorkingSets(exercise.planned_sets);
          return (
            <Pressable
              key={exercise.id}
              style={pressableStyle(styles.card)}
              onPress={() => openExerciseEdit(exercise)}
              accessibilityRole="button"
              accessibilityLabel={`Редактировать ${exercise.name}`}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: theme.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.semiBold,
                      fontSize: 13,
                      color: theme.accent,
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sessionTitle} numberOfLines={2}>
                    {exercise.name}
                  </Text>
                  {exercise.muscle_group ? (
                    <Text style={styles.sessionMeta}>{exercise.muscle_group}</Text>
                  ) : null}
                  <Text style={[styles.sessionMeta, { marginTop: 2 }]}>
                    {workingSets} подх. в плане
                  </Text>
                  {exercise.note ? (
                    <Text style={[styles.programHint, { marginTop: 6 }]}>{exercise.note}</Text>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {exercise.planned_sets.map((entry, setIndex) => {
                  const isRest = entry.type === "rest";
                  return (
                    <View
                      key={`${exercise.id}-set-${setIndex}`}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: isRest ? theme.border : theme.accentSoft,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.medium,
                          fontSize: 12,
                          lineHeight: 16,
                          color: isRest ? theme.textMuted : theme.accent,
                        }}
                      >
                        {formatTemplatePlannedSetLabel(entry)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Pressable>
          );
        })}

        <View style={[styles.sessionActions, { marginTop: 4 }]}>
          <Pressable
            style={pressableStyle(styles.actionButton)}
            onPress={() => mockAction(`Запланировать «${template.title}»`)}
          >
            <Text style={styles.actionButtonText}>Запланировать</Text>
          </Pressable>
          <Pressable
            style={pressableStyle([styles.actionButton, styles.actionButtonPrimary])}
            onPress={() => mockAction(`Начать «${template.title}» сегодня`)}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Начать</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FloatingAddButton
        onPress={() => {
          invalidateInFlightLoads();
          router.push(
            `/exercise_catalog?pickForTemplate=${encodeURIComponent(templateId)}&templateExercisesCount=${template.exercises.length}`,
          );
        }}
        accessibilityLabel="Добавить упражнение"
      />

      <WorkoutActionsSheet
        visible={actionsVisible}
        title="Шаблон"
        subtitle={template.title}
        actions={TEMPLATE_ACTIONS}
        onClose={closeActions}
        onSelect={handleMenuAction}
      />

      <TemplateExerciseEditModal
        visible={exerciseEditVisible}
        templateId={templateId}
        template={template}
        exercise={editingExercise}
        onClose={closeExerciseEdit}
        onDismiss={dismissExerciseEdit}
        onSaved={(detail) => applyLocalData(detail)}
      />

      <WorkoutTemplateFormModal
        visible={editFormVisible}
        templateId={templateId}
        initialDetail={template}
        onClose={() => setEditFormVisible(false)}
        onSaved={(detail) => applyLocalData(detail)}
      />

      <WorkoutDeleteConfirmModal
        visible={deleteConfirmVisible}
        title="Удалить шаблон?"
        message={`«${(deleteTargetRef.current ?? template).title}» будет удалён без возможности восстановления.`}
        confirmLabel={deleting ? "Удаление…" : "Удалить"}
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => void confirmDelete()}
        onDismiss={() => {
          deleteTargetRef.current = null;
        }}
      />
    </ScreenEnterFrame>
  );
}
