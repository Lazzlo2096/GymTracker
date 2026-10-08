import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { fetchCurrentProgramOptional, fetchPrograms, deleteProgram } from "@/api/plans";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import PlansProgramCatalogItem from "@/components/plans/PlansProgramCatalogItem";
import PlansProgramActionIcons from "@/components/plans/PlansProgramActionIcons";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import { mapProgramDaysToView } from "@/components/plans/programFormat";
import type { CurrentProgram, WorkoutTemplateMock } from "@/components/plans/types";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const OTHER_PROGRAMS_PREVIEW_COUNT = 3;
const LIST_ENTER_STAGGER_MS = 70;
const LIST_EXIT_STAGGER_MS = 35;

type PlansProgramData = {
  current: CurrentProgram | null;
  catalog: CurrentProgram[];
};

type PlansProgramTabProps = {
  templates: WorkoutTemplateMock[];
  routeReady: boolean;
};

export default function PlansProgramTab({ templates, routeReady }: PlansProgramTabProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const styles = useMemo(() => createPlansScreenStyles(theme), [theme]);
  const [program, setProgram] = useState<CurrentProgram | null>(null);
  const [catalog, setCatalog] = useState<CurrentProgram[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [isCatalogExiting, setIsCatalogExiting] = useState(false);
  const [expandedProgramId, setExpandedProgramId] = useState<number | null>(null);
  const [exitExpandedProgramId, setExitExpandedProgramId] = useState<number | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteTargetRef = useRef<CurrentProgram | null>(null);
  const exitsRemainingRef = useRef(0);

  const { loading, reload } = useGuardedFocusLoad({
    enabled: true,
    shouldReloadOnFocus: () => routeReady,
    routeReady,
    load: async () => {
      try {
        const [current, programs] = await Promise.all([
          fetchCurrentProgramOptional(),
          fetchPrograms(),
        ]);
        return { kind: "success", data: { current, catalog: programs } satisfies PlansProgramData };
      } catch (e) {
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "Не удалось загрузить программу",
        };
      }
    },
    onSuccess: (data) => {
      setProgram(data.current);
      setCatalog(data.catalog);
      setError(null);
    },
    onError: (message) => {
      setProgram(null);
      setCatalog([]);
      setError(message);
    },
  });

  const dayRows = useMemo(
    () => (program ? mapProgramDaysToView(program, templates) : []),
    [program, templates],
  );

  const otherPrograms = useMemo(() => {
    if (!program) return catalog.slice(0, OTHER_PROGRAMS_PREVIEW_COUNT);
    return catalog.filter((item) => item.id !== program.id);
  }, [catalog, program]);

  const collapsedPreviewIds = useMemo(
    () => new Set(otherPrograms.slice(0, OTHER_PROGRAMS_PREVIEW_COUNT).map((item) => item.id)),
    [otherPrograms],
  );

  const programsToHide = useMemo(
    () => catalog.filter((item) => !collapsedPreviewIds.has(item.id)),
    [catalog, collapsedPreviewIds],
  );

  const visiblePrograms = useMemo(() => {
    if (showAllPrograms || isCatalogExiting) return catalog;
    return otherPrograms.slice(0, OTHER_PROGRAMS_PREVIEW_COUNT);
  }, [catalog, isCatalogExiting, otherPrograms, showAllPrograms]);

  const newlyRevealedPrograms = useMemo(() => {
    if (!showAllPrograms || isCatalogExiting) return [];
    return programsToHide;
  }, [isCatalogExiting, programsToHide, showAllPrograms]);

  const canExpandCatalog = catalog.length > OTHER_PROGRAMS_PREVIEW_COUNT;

  const finishCatalogExit = useCallback(() => {
    exitsRemainingRef.current -= 1;
    if (exitsRemainingRef.current > 0) return;

    setShowAllPrograms(false);
    setIsCatalogExiting(false);
    setExpandedProgramId(null);
    setExitExpandedProgramId(null);
  }, []);

  const toggleShowAllPrograms = () => {
    if (isCatalogExiting) return;

    if (showAllPrograms) {
      if (programsToHide.length === 0) {
        setExpandedProgramId(null);
        setShowAllPrograms(false);
        return;
      }

      setExitExpandedProgramId(expandedProgramId);
      exitsRemainingRef.current = programsToHide.length;
      setIsCatalogExiting(true);
      return;
    }

    setShowAllPrograms(true);
  };

  const toggleProgramExpanded = (programId: number) => {
    if (isCatalogExiting) return;
    setExpandedProgramId((prev) => (prev === programId ? null : programId));
  };

  const handleSelectProgram = (next: CurrentProgram) => {
    Alert.alert(
      "Скоро",
      `Смена программы на «${next.name}» и автозаполнение расписания — в следующих версиях.`,
    );
  };

  const handleEditProgram = useCallback(
    (target: CurrentProgram) => {
      router.push(`/program/${target.id}/edit`);
    },
    [router],
  );

  const handleDeleteProgram = useCallback((target: CurrentProgram) => {
    deleteTargetRef.current = target;
    setDeleteError(null);
    setDeleteConfirmVisible(true);
  }, []);

  const confirmDeleteProgram = useCallback(async () => {
    const target = deleteTargetRef.current;
    if (!target || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProgram(target.id);
      setDeleteConfirmVisible(false);
      setExpandedProgramId((prev) => (prev === target.id ? null : prev));
      setExitExpandedProgramId((prev) => (prev === target.id ? null : prev));
      await reload({ force: true });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Попробуйте ещё раз.");
    } finally {
      setDeleting(false);
    }
  }, [deleting, reload]);

  const openCatalogSection = () => {
    if (!showAllPrograms && !isCatalogExiting && canExpandCatalog) {
      setShowAllPrograms(true);
    }
  };

  const catalogListExpanded = showAllPrograms || isCatalogExiting;

  const deleteTarget = deleteTargetRef.current;

  return (
    <>
    <View style={styles.sectionBlock}>
      <View style={styles.card}>
        <View style={styles.programCurrentCardHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
              {program?.name ?? "Текущая программа"}
            </Text>
            <Text style={styles.programHint}>
              Автогенерация расписания на несколько недель — в следующих версиях.
            </Text>
          </View>
          {!loading && !error && program ? (
            <PlansProgramActionIcons
              onEdit={() => handleEditProgram(program)}
              onDelete={() => handleDeleteProgram(program)}
            />
          ) : null}
        </View>

        {loading ? (
          <View style={[styles.emptyDay, { paddingVertical: 24 }]}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={styles.emptyDaySub}>Загрузка программы…</Text>
          </View>
        ) : error ? (
          <View style={[styles.emptyDay, { paddingVertical: 16 }]}>
            <Ionicons name="alert-circle-outline" size={24} color={theme.danger} />
            <Text style={styles.emptyDayTitle}>Не удалось загрузить программу</Text>
            <Text style={styles.emptyDaySub}>{error}</Text>
            <Pressable
              style={pressableStyle([
                styles.actionButton,
                styles.actionButtonPrimary,
                { marginTop: 8 },
              ])}
              onPress={() => void reload({ force: true })}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                Повторить
              </Text>
            </Pressable>
          </View>
        ) : !program ? (
          <View style={[styles.emptyDay, { paddingVertical: 16 }]}>
            <Ionicons name="calendar-week-outline" size={28} color={theme.textMuted} />
            <Text style={styles.emptyDayTitle}>Текущая программа не выбрана</Text>
            <Text style={styles.emptyDaySub}>
              Создайте свою программу или выберите из каталога ниже.
            </Text>
          </View>
        ) : (
          <>
            {dayRows.map((day) => (
              <View key={day.key} style={styles.programRow}>
                <Text style={styles.programWeekday}>{day.weekdayShort}</Text>
                <View style={styles.programBody}>
                  <Text
                    style={[
                      styles.programTitle,
                      !day.enabled && styles.programTitleMuted,
                    ]}
                    numberOfLines={1}
                  >
                    {day.templateTitle}
                  </Text>
                </View>
                {day.enabled ? (
                  <MaterialCommunityIcons name="dumbbell" size={18} color={theme.accent} />
                ) : null}
              </View>
            ))}
          </>
        )}

        {!loading && !error && catalog.length > 0 ? (
          <Pressable
            style={pressableStyle([
              styles.actionButton,
              styles.actionButtonPrimary,
              { marginTop: 16 },
            ])}
            onPress={openCatalogSection}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
              {program ? "Сменить программу" : "Настроить программу"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {!loading && !error && otherPrograms.length > 0 ? (
        <View>
          <View style={styles.programSectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
              {catalogListExpanded ? "Все программы" : "Другие программы"}
            </Text>
            {canExpandCatalog ? (
              <Pressable
                onPress={toggleShowAllPrograms}
                disabled={isCatalogExiting}
                style={pressableStyle({ paddingVertical: 4, paddingHorizontal: 2 })}
                accessibilityRole="button"
                accessibilityState={{ disabled: isCatalogExiting }}
                accessibilityLabel={
                  catalogListExpanded ? "Скрыть программы" : "Показать все программы"
                }
              >
                <Text
                  style={[
                    styles.programSectionLink,
                    isCatalogExiting && { opacity: 0.5 },
                  ]}
                >
                  {catalogListExpanded ? "Скрыть" : `Все (${catalog.length})`}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {visiblePrograms.map((item) => {
            const shouldExit = isCatalogExiting && !collapsedPreviewIds.has(item.id);
            const animateEntrance =
              showAllPrograms && !isCatalogExiting && !collapsedPreviewIds.has(item.id);
            const entranceOrder = animateEntrance
              ? newlyRevealedPrograms.findIndex((entry) => entry.id === item.id)
              : 0;
            const hideOrder = shouldExit
              ? programsToHide.findIndex((entry) => entry.id === item.id)
              : 0;
            const exitOrder = shouldExit
              ? Math.max(0, programsToHide.length - 1 - hideOrder)
              : 0;

            return (
              <PlansProgramCatalogItem
                key={item.id}
                program={item}
                templates={templates}
                expanded={
                  isCatalogExiting
                    ? exitExpandedProgramId === item.id
                    : expandedProgramId === item.id
                }
                isCurrent={program?.id === item.id}
                onToggle={() => toggleProgramExpanded(item.id)}
                onSelect={
                  program?.id === item.id
                    ? undefined
                    : () => handleSelectProgram(item)
                }
                onEdit={() => handleEditProgram(item)}
                onDelete={() => handleDeleteProgram(item)}
                animateEntrance={animateEntrance}
                entranceDelay={entranceOrder * LIST_ENTER_STAGGER_MS}
                animateExit={shouldExit}
                exitDelay={exitOrder * LIST_EXIT_STAGGER_MS}
                onExitComplete={shouldExit ? finishCatalogExit : undefined}
              />
            );
          })}
        </View>
      ) : null}

      <Pressable
        style={pressableStyle([
          styles.actionButton,
          styles.actionButtonPrimary,
          { marginBottom: 12 },
        ])}
        onPress={() => router.push("/program/create")}
      >
        <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
          Создать программу
        </Text>
      </Pressable>

      <View style={[styles.card, styles.comingSoonCard]}>
        <MaterialCommunityIcons name="calendar-sync" size={32} color={theme.textMuted} />
        <Text style={styles.comingSoonTitle}>Авторасписание</Text>
        <Text style={styles.comingSoonSub}>
          Выберите сплит — приложение само создаст тренировки на ближайшие недели с
          планом подходов из шаблонов.
        </Text>
      </View>
    </View>

    <WorkoutDeleteConfirmModal
      visible={deleteConfirmVisible}
      title="Удалить программу?"
      message={
        deleteError
          ? deleteError
          : `Программа «${deleteTarget?.name ?? "программа"}» будет удалена. Восстановить её будет нельзя.`
      }
      confirmLabel={deleting ? "Удаление…" : "Удалить"}
      onCancel={() => {
        if (deleting) return;
        setDeleteConfirmVisible(false);
        setDeleteError(null);
      }}
      onConfirm={() => void confirmDeleteProgram()}
      onDismiss={() => {
        deleteTargetRef.current = null;
        setDeleteError(null);
      }}
    />
    </>
  );
}
