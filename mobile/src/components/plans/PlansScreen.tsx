import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useBottomTabBarScrollPadding } from "@/components/navigation/bottomTabBarInset";
import ScreenEnterFrame from "@/components/navigation/ScreenEnterFrame";
import { fetchPlannedSessions } from "@/api/plans";
import { fetchWorkoutTemplates } from "@/api/workoutTemplates";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import PlansProgramTab from "@/components/plans/PlansProgramTab";
import PlansScheduledCard, {
  PlansQuickActionsRow,
} from "@/components/plans/PlansScheduledCard";
import PlansTemplateCard from "@/components/plans/PlansTemplateCard";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import PlansWeekStrip from "@/components/plans/PlansWeekStrip";
import type { PlansTabId, PlannedSession, WorkoutTemplateMock } from "@/components/plans/types";
import FloatingAddButton, { FAB_LIST_PADDING_BOTTOM } from "@/components/ui/FloatingAddButton";
import SegmentedTabs, { type SegmentedTabItem } from "@/components/ui/SegmentedTabs";
import { SCREEN_HEADER_TOP_PADDING } from "@/theme/screenChrome";
import { fonts } from "@/theme/typography";
import { createQuickWorkoutTemplate } from "@/utils/createQuickWorkoutTemplate";
import { formatDateForApiQuery } from "@/utils/workoutListApi";
import { on } from "@/utils/eventBus";
import {
  TEMPLATES_LIST_STALE_EVENT,
} from "@/events/templateDetailEvents";
import { useFocusGatedReload } from "@/hooks/useFocusGatedReload";
import { useAppTheme } from "@/theme/appTheme";
import { useTraceScreen } from "@/debug/useTraceScreen";
import { pressableStyle } from "@/utils/pressableStyles";

const PLANS_TABS: readonly SegmentedTabItem<PlansTabId>[] = [
  { id: "schedule", label: "Расписание", icon: "calendar-month-outline" },
  { id: "templates", label: "Шаблоны", icon: "file-document-outline" },
  { id: "program", label: "Программа", icon: "calendar-week" },
];

const MONTHS_RU_LONG = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const WEEKDAYS_RU = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

function formatPlanDateHeading(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = WEEKDAYS_RU[date.getDay()];
  const month = MONTHS_RU_LONG[date.getMonth()];
  return `${weekday}, ${d} ${month}`;
}

function groupSessionsByDate(sessions: PlannedSession[]): { date: string; items: PlannedSession[] }[] {
  const map = new Map<string, PlannedSession[]>();
  for (const session of sessions) {
    const list = map.get(session.date) ?? [];
    list.push(session);
    map.set(session.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

function mockAlert(message: string) {
  Alert.alert("Тестовые данные", message);
}

/** Экран «Планы»: расписание, шаблоны и программа — с API. */
export default function PlansScreen() {
  useTraceScreen("PlansScreen");
  const theme = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isPlansTabRoute = pathname === "/plans";
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 400 ? 20 : 16;
  const styles = useMemo(() => createPlansScreenStyles(theme), [theme]);

  const [tab, setTab] = useState<PlansTabId>("schedule");
  const [selectedDate, setSelectedDate] = useState(() => formatDateForApiQuery(new Date()));
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplateMock[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const bottomPad = useBottomTabBarScrollPadding(
    tab === "templates" ? FAB_LIST_PADDING_BOTTOM : 32,
  );

  const {
    loading: scheduleLoading,
    reload: reloadSchedule,
  } = useGuardedFocusLoad({
    enabled: true,
    shouldReloadOnFocus: () => isPlansTabRoute,
    routeReady: isPlansTabRoute,
    load: async () => {
      try {
        const items = await fetchPlannedSessions();
        return { kind: "success", data: items };
      } catch (e) {
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "Не удалось загрузить расписание",
        };
      }
    },
    onSuccess: (items) => {
      setPlannedSessions(items);
      setScheduleError(null);
    },
    onError: (message) => {
      setPlannedSessions([]);
      setScheduleError(message);
    },
  });

  const {
    loading: templatesLoading,
    reload: reloadTemplates,
    invalidateInFlightLoads,
  } = useGuardedFocusLoad({
    enabled: true,
    shouldReloadOnFocus: () => isPlansTabRoute,
    routeReady: isPlansTabRoute,
    load: async () => {
      try {
        const items = await fetchWorkoutTemplates();
        return { kind: "success", data: items };
      } catch (e) {
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "Не удалось загрузить шаблоны",
        };
      }
    },
    onSuccess: (items) => {
      setTemplates(items);
      setTemplatesError(null);
    },
    onError: (message) => {
      setTemplates([]);
      setTemplatesError(message);
    },
  });

  const { markStale: markTemplatesListStaleLocal, refreshIfFocused: refreshTemplatesIfFocused } =
    useFocusGatedReload(reloadTemplates);

  useEffect(() => {
    return on(TEMPLATES_LIST_STALE_EVENT, () => {
      refreshTemplatesIfFocused({ silent: true });
    });
  }, [refreshTemplatesIfFocused]);

  const createAndOpenTemplate = useCallback(() => {
    if (creatingTemplate) return;
    setCreatingTemplate(true);
    void (async () => {
      try {
        const id = await createQuickWorkoutTemplate({ markListStale: false });
        markTemplatesListStaleLocal();
        invalidateInFlightLoads();
        router.push(`/plan-template/${id}`);
      } catch (e) {
        Alert.alert(
          "Не удалось создать шаблон",
          e instanceof Error ? e.message : "Попробуйте ещё раз.",
        );
      } finally {
        setCreatingTemplate(false);
      }
    })();
  }, [creatingTemplate, invalidateInFlightLoads, router]);

  const datesWithPlans = useMemo(
    () => new Set(plannedSessions.map((s) => s.date)),
    [plannedSessions],
  );

  const sessionsForSelectedDay = useMemo(
    () => plannedSessions.filter((s) => s.date === selectedDate),
    [plannedSessions, selectedDate],
  );

  const upcomingGroups = useMemo(
    () => groupSessionsByDate(plannedSessions),
    [plannedSessions],
  );

  const listGroups = showAllUpcoming
    ? upcomingGroups
    : sessionsForSelectedDay.length > 0
      ? [{ date: selectedDate, items: sessionsForSelectedDay }]
      : [];

  return (
    <ScreenEnterFrame direction="none">
      <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: SCREEN_HEADER_TOP_PADDING,
            paddingHorizontal: horizontalPadding,
            paddingBottom: bottomPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle} accessibilityRole="header">
          Планы
        </Text>

        <View style={styles.tabsWrap}>
          <SegmentedTabs tabs={PLANS_TABS} value={tab} onChange={setTab} labelSize="md" />
        </View>

        {tab === "schedule" ? (
          <View style={styles.sectionBlock}>
            <PlansWeekStrip
              selectedDate={selectedDate}
              datesWithPlans={datesWithPlans}
              onSelectDate={(iso) => {
                setSelectedDate(iso);
                setShowAllUpcoming(false);
              }}
            />

            <PlansQuickActionsRow
              onTomorrow={() => mockAlert("Быстрый план на завтра из последней тренировки.")}
              onFromTemplate={() => {
                setTab("templates");
                mockAlert("Выберите шаблон и дату — пока только превью.");
              }}
              onNewPlan={() => mockAlert("Создание пустого плана на выбранную дату.")}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
                {showAllUpcoming ? "Все предстоящие" : formatPlanDateHeading(selectedDate)}
              </Text>
              {!showAllUpcoming ? (
                <Pressable
                  onPress={() => setShowAllUpcoming(true)}
                  style={pressableStyle({ paddingVertical: 4, paddingHorizontal: 2 })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.accent,
                      fontFamily: fonts.semiBold,
                    }}
                  >
                    Все ({plannedSessions.length})
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setShowAllUpcoming(false)}
                  style={pressableStyle({ paddingVertical: 4, paddingHorizontal: 2 })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.accent,
                      fontFamily: fonts.semiBold,
                    }}
                  >
                    По дню
                  </Text>
                </Pressable>
              )}
            </View>

            {scheduleLoading && plannedSessions.length === 0 ? (
              <View style={[styles.card, styles.emptyDay]}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={styles.emptyDaySub}>Загрузка расписания…</Text>
              </View>
            ) : scheduleError ? (
              <View style={[styles.card, styles.emptyDay]}>
                <Ionicons name="alert-circle-outline" size={24} color={theme.danger} />
                <Text style={styles.emptyDayTitle}>Не удалось загрузить расписание</Text>
                <Text style={styles.emptyDaySub}>{scheduleError}</Text>
                <Pressable
                  style={pressableStyle([styles.actionButton, styles.actionButtonPrimary, { marginTop: 8 }])}
                  onPress={() => void reloadSchedule({ force: true })}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                    Повторить
                  </Text>
                </Pressable>
              </View>
            ) : listGroups.length === 0 ? (
              <View style={styles.card}>
                <View style={styles.emptyDay}>
                  <Ionicons name="calendar-outline" size={28} color={theme.textMuted} />
                  <Text style={styles.emptyDayTitle}>На этот день планов нет</Text>
                  <Text style={styles.emptyDaySub}>
                    Выберите день с точкой в полосе недели или нажмите «Все».
                  </Text>
                </View>
              </View>
            ) : (
              listGroups.map((group) => (
                <View key={group.date}>
                  {showAllUpcoming ? (
                    <Text style={styles.dateGroupTitle}>
                      {formatPlanDateHeading(group.date)}
                    </Text>
                  ) : null}
                  {group.items.map((session) => (
                    <PlansScheduledCard key={`${session.date}-${session.title}`} session={session} />
                  ))}
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === "templates" ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Мои шаблоны</Text>
            <Text style={[styles.programHint, { marginBottom: 12, marginTop: -4 }]}>
              Переиспользуемые заготовки без привязки к дате. «Запланировать» создаст
              тренировку в расписании.
            </Text>
            {templatesLoading ? (
              <View style={[styles.card, styles.emptyDay]}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={styles.emptyDaySub}>Загрузка шаблонов…</Text>
              </View>
            ) : templatesError ? (
              <View style={[styles.card, styles.emptyDay]}>
                <Ionicons name="alert-circle-outline" size={24} color={theme.danger} />
                <Text style={styles.emptyDayTitle}>Не удалось загрузить шаблоны</Text>
                <Text style={styles.emptyDaySub}>{templatesError}</Text>
                <Pressable
                  style={pressableStyle([styles.actionButton, styles.actionButtonPrimary, { marginTop: 8 }])}
                  onPress={() => void reloadTemplates({ force: true })}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                    Повторить
                  </Text>
                </Pressable>
              </View>
            ) : templates.length === 0 ? (
              <View style={[styles.card, styles.emptyDay]}>
                <Ionicons name="document-outline" size={28} color={theme.textMuted} />
                <Text style={styles.emptyDayTitle}>Шаблонов пока нет</Text>
                <Text style={styles.emptyDaySub}>
                  Нажмите «+», чтобы создать заготовку с планом упражнений.
                </Text>
                <Pressable
                  style={pressableStyle([styles.actionButton, styles.actionButtonPrimary, { marginTop: 8 }])}
                  onPress={createAndOpenTemplate}
                  disabled={creatingTemplate}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                    {creatingTemplate ? "Создание…" : "Создать шаблон"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              templates.map((template) => (
                <PlansTemplateCard key={template.id} template={template} />
              ))
            )}
          </View>
        ) : null}

        {tab === "program" ? (
          <PlansProgramTab templates={templates} routeReady={isPlansTabRoute} />
        ) : null}
      </ScrollView>

      {tab === "templates" ? (
        <FloatingAddButton
          onPress={createAndOpenTemplate}
          disabled={creatingTemplate}
          accessibilityLabel="Добавить шаблон"
        />
      ) : null}
      </View>
    </ScreenEnterFrame>
  );
}
