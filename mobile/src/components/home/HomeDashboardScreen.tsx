import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useBottomTabBarScrollPadding } from "@/components/navigation/bottomTabBarInset";
import ScreenEnterFrame from "@/components/navigation/ScreenEnterFrame";
import HomeHistoryStatsSection from "@/components/home/stats/HomeHistoryStatsSection";
import ActiveStatusDot from "@/components/ui/ActiveStatusDot";
import { BarbellOutlineIcon } from "@/components/icons/WorkoutFigmaIcons";
import {
  MetricIconCircle,
  metricToken,
  useMetricChipSize,
} from "@/components/workouts/metricIcon";
import {
  createWorkoutListItemStyles,
  workoutListItemStyles,
} from "@/components/workouts/workoutListItem.styles";
import { useAuth } from "@/context/AuthContext";
import { useTraceScreen } from "@/debug/useTraceScreen";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useAppTheme } from "@/theme/appTheme";
import { PLAQUE_RADIUS, plaqueListShadow } from "@/theme/plaqueStyles";
import {
  SCREEN_HEADER_BOTTOM_MARGIN,
  SCREEN_HEADER_TOP_PADDING,
} from "@/theme/screenChrome";
import { fonts, type } from "@/theme/typography";
import { createQuickWorkout, workoutDateTodayForApi } from "@/utils/createQuickWorkout";
import { on } from "@/utils/eventBus";
import { WORKOUTS_LIST_STALE_EVENT } from "@/events/workoutsListEvents";
import { useFocusGatedReload } from "@/hooks/useFocusGatedReload";
import { pressableStyle } from "@/utils/pressableStyles";
import { runRepeatWorkoutFlow } from "@/utils/repeatWorkout";
import {
  addCalendarDays,
  fetchWorkoutSummaries,
  formatDateForApiQuery,
  formatWorkoutDuration,
  formatWorkoutNumber,
  workoutCountLabel,
  type WorkoutSummary,
} from "@/utils/workoutListApi";

const WEEKDAYS_RU_LONG = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

const MONTHS_RU_GENITIVE = [
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

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type DashboardData = {
  todayWorkouts: WorkoutSummary[];
  weekCount: number;
  lastWorkout: WorkoutSummary | null;
  nextWorkout: WorkoutSummary | null;
  activeWorkout: WorkoutSummary | null;
};

function greetingForHour(hour: number): string {
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

function formatTodayHeading(date: Date): string {
  const weekday = WEEKDAYS_RU_LONG[date.getDay()];
  const day = date.getDate();
  const month = MONTHS_RU_GENITIVE[date.getMonth()];
  return `${weekday}, ${day} ${month}`;
}

function pickActiveWorkout(
  todayWorkouts: WorkoutSummary[],
  weekWorkouts: WorkoutSummary[],
): WorkoutSummary | null {
  const fromToday = todayWorkouts.find((w) => w.is_active);
  if (fromToday) return fromToday;
  return weekWorkouts.find((w) => w.is_active) ?? null;
}

function pickLastRepeatable(workouts: WorkoutSummary[]): WorkoutSummary | null {
  for (const workout of workouts) {
    if (!workout.is_active) return workout;
  }
  return null;
}

function pickNextWorkout(upcoming: WorkoutSummary[], todayIso: string): WorkoutSummary | null {
  for (const workout of upcoming) {
    if (workout.workout_date > todayIso) return workout;
  }
  return null;
}

async function loadDashboardData(): Promise<DashboardData> {
  const todayIso = workoutDateTodayForApi();
  const today = new Date();
  const weekStart = addCalendarDays(today, -6);
  const tomorrow = addCalendarDays(today, 1);

  const todayParams = new URLSearchParams({
    limit: "20",
    offset: "0",
    sort: "workout_date",
    order: "desc",
    date_from: todayIso,
    date_to: todayIso,
  });

  const weekParams = new URLSearchParams({
    limit: "100",
    offset: "0",
    sort: "workout_date",
    order: "desc",
    date_from: formatDateForApiQuery(weekStart),
    date_to: todayIso,
  });

  const upcomingParams = new URLSearchParams({
    limit: "10",
    offset: "0",
    sort: "workout_date",
    order: "asc",
    date_from: formatDateForApiQuery(tomorrow),
  });

  const [todayWorkouts, weekWorkouts, upcomingWorkouts] = await Promise.all([
    fetchWorkoutSummaries(todayParams),
    fetchWorkoutSummaries(weekParams),
    fetchWorkoutSummaries(upcomingParams),
  ]);

  return {
    todayWorkouts,
    weekCount: weekWorkouts.length,
    lastWorkout: pickLastRepeatable(weekWorkouts),
    nextWorkout: pickNextWorkout(upcomingWorkouts, todayIso),
    activeWorkout: pickActiveWorkout(todayWorkouts, weekWorkouts),
  };
}

export default function HomeDashboardScreen() {
  useTraceScreen("HomeDashboardScreen");
  const theme = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isHomeRoute = pathname === "/home";
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 400 ? 20 : 16;
  const bottomPad = useBottomTabBarScrollPadding(32);
  const listItemStyles = useMemo(() => createWorkoutListItemStyles(theme), [theme]);

  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [creatingWorkout, setCreatingWorkout] = useState(false);
  const [repeatingWorkout, setRepeatingWorkout] = useState(false);

  const shimmerProgress = useRef(new Animated.Value(0)).current;
  const now = useMemo(() => new Date(), []);
  const styles = useMemo(
    () => createStyles(theme, horizontalPadding, bottomPad),
    [theme, horizontalPadding, bottomPad],
  );

  const {
    loading,
    reload,
    invalidateInFlightLoads,
  } = useGuardedFocusLoad({
    enabled: true,
    shouldReloadOnFocus: () => isHomeRoute,
    routeReady: isHomeRoute,
    load: async () => {
      try {
        const next = await loadDashboardData();
        return { kind: "success", data: next };
      } catch (e) {
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "Не удалось загрузить данные",
        };
      }
    },
    onSuccess: (next) => {
      setData(next);
      setError(null);
    },
    onError: (message) => {
      setError(message);
    },
  });

  const { markStale: markWorkoutsListStaleLocal, refreshIfFocused: refreshDashboardIfFocused } =
    useFocusGatedReload(reload);

  useEffect(() => {
    return on(WORKOUTS_LIST_STALE_EVENT, () => {
      refreshDashboardIfFocused({ silent: true });
    });
  }, [refreshDashboardIfFocused]);

  useEffect(() => {
    if (!loading) return undefined;

    let isActive = true;
    const startShimmer = () => {
      shimmerProgress.setValue(0);
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && isActive) startShimmer();
      });
    };
    startShimmer();
    return () => {
      isActive = false;
      shimmerProgress.stopAnimation();
      shimmerProgress.setValue(0);
    };
  }, [loading, shimmerProgress]);

  const shimmerTranslate = useMemo(
    () =>
      shimmerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-140, 280],
      }),
    [shimmerProgress],
  );

  const displayName = user?.display_name?.trim() || "атлет";
  const goal = user?.training_goal?.trim();
  const preferredGym = user?.preferred_gym?.name?.trim();

  const openWorkout = useCallback(
    (workoutId: string) => {
      router.push(`/workout/${workoutId}`);
    },
    [router],
  );

  const handleStartWorkout = useCallback(() => {
    if (creatingWorkout || repeatingWorkout) return;
    setCreatingWorkout(true);
    void (async () => {
      try {
        const id = await createQuickWorkout({
          userGymId: user?.preferred_user_gym_id ?? null,
          markListStale: false,
        });
        markWorkoutsListStaleLocal();
        invalidateInFlightLoads();
        router.push(`/workout/${id}`);
      } catch (e) {
        Alert.alert(
          "Ошибка",
          e instanceof Error ? e.message : "Не удалось создать тренировку",
        );
      } finally {
        setCreatingWorkout(false);
      }
    })();
  }, [creatingWorkout, invalidateInFlightLoads, repeatingWorkout, router, user?.preferred_user_gym_id]);

  const handleRepeatLast = useCallback(() => {
    const sourceId = Number(data?.lastWorkout?.id);
    runRepeatWorkoutFlow({
      sourceWorkoutId: sourceId,
      router,
      isBusy: () => creatingWorkout || repeatingWorkout,
      setBusy: setRepeatingWorkout,
      markListStaleLocally: () => {
        markWorkoutsListStaleLocal();
        invalidateInFlightLoads();
      },
      onInvalidId: () => {
        Alert.alert("Нет тренировок", "Сначала завершите хотя бы одну тренировку.");
      },
      onError: (message) => Alert.alert("Ошибка", message),
    });
  }, [creatingWorkout, data?.lastWorkout?.id, invalidateInFlightLoads, markWorkoutsListStaleLocal, repeatingWorkout, router]);

  const busy = creatingWorkout || repeatingWorkout;

  return (
    <ScreenEnterFrame direction="none">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle} accessibilityRole="header">
          Главная
        </Text>

        <View style={styles.greetingBlock}>
          {loading ? (
            <>
              <ShimmerLine style={styles.skeletonGreeting} translateX={shimmerTranslate} theme={theme} />
              <ShimmerLine style={styles.skeletonSubline} translateX={shimmerTranslate} theme={theme} />
            </>
          ) : (
            <>
              <Text style={styles.greeting}>
                {greetingForHour(now.getHours())}, {displayName}
              </Text>
              <Text style={styles.dateLine}>{formatTodayHeading(now)}</Text>
              {goal ? (
                <Text style={styles.goalLine} numberOfLines={2}>
                  Цель: {goal}
                </Text>
              ) : null}
              {preferredGym ? (
                <View style={styles.preferredGymRow}>
                  <Ionicons name="location-outline" size={14} color={theme.accent} />
                  <Text style={styles.preferredGymText} numberOfLines={1}>
                    Обычно: {preferredGym}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {loading ? (
          <View style={styles.section}>
            <ShimmerLine style={styles.skeletonSectionTitle} translateX={shimmerTranslate} theme={theme} />
            <ShimmerCard translateX={shimmerTranslate} theme={theme} tall />
            <View style={styles.quickActionsRow}>
              <ShimmerCard translateX={shimmerTranslate} theme={theme} flex />
              <ShimmerCard translateX={shimmerTranslate} theme={theme} flex />
            </View>
          </View>
        ) : error ? (
          <View style={styles.errorBlock}>
            <Ionicons name="alert-circle-outline" size={22} color={theme.danger} />
            <Text style={styles.errorTitle}>Не удалось загрузить дашборд</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={pressableStyle([styles.retryButton, { backgroundColor: theme.accent }])}
              onPress={() => {
                void reload({ force: true });
              }}
            >
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        ) : data ? (
          <>
            {data.activeWorkout ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Сейчас идёт</Text>
                <Pressable
                  style={pressableStyle([
                    styles.activeCard,
                    { backgroundColor: theme.card, borderColor: theme.accent },
                  ])}
                  onPress={() => openWorkout(data.activeWorkout!.id)}
                >
                  <View style={styles.activeCardTop}>
                    <ActiveStatusDot visible />
                    <Text style={styles.activeCardTitle} numberOfLines={2}>
                      {data.activeWorkout.day_title?.trim() || "Тренировка"}
                    </Text>
                  </View>
                  {data.activeWorkout.gym_name ? (
                    <Text style={styles.activeCardMeta} numberOfLines={1}>
                      {data.activeWorkout.gym_name}
                    </Text>
                  ) : null}
                  <Text style={styles.activeCardMeta}>
                    {formatWorkoutDuration(data.activeWorkout.duration_minutes)} ·{" "}
                    {data.activeWorkout.exercises_count} упр.
                  </Text>
                  <View style={[styles.continuePill, { backgroundColor: theme.accent }]}>
                    <Text style={styles.continuePillText}>Продолжить</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </View>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Быстрые действия</Text>
              <View style={styles.quickActionsRow}>
                <QuickActionButton
                  label="Начать"
                  sublabel="тренировку"
                  icon={<BarbellOutlineIcon size={22} color={theme.accent} />}
                  onPress={handleStartWorkout}
                  disabled={busy}
                  busy={creatingWorkout}
                  theme={theme}
                />
                <QuickActionButton
                  label="Повторить"
                  sublabel="последнюю"
                  icon={
                    <MaterialCommunityIcons
                      name="history"
                      size={22}
                      color={data.lastWorkout ? theme.accent : theme.textMuted}
                    />
                  }
                  onPress={handleRepeatLast}
                  disabled={busy || !data.lastWorkout}
                  busy={repeatingWorkout}
                  theme={theme}
                />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Сегодня</Text>
                {data.weekCount > 0 ? (
                  <Text style={styles.sectionHintInline}>
                    {data.weekCount} {workoutCountLabel(data.weekCount)} за 7 дней
                  </Text>
                ) : null}
              </View>

              {data.todayWorkouts.length === 0 ? (
                <View style={[styles.emptyTodayCard, { backgroundColor: theme.card }]}>
                  <BarbellOutlineIcon size={24} color={metricToken("green", theme.dark).fg} />
                  <Text style={styles.emptyTodayTitle}>Сегодня ещё не тренировались</Text>
                  <Text style={styles.emptyTodaySub}>
                    Нажмите «Начать», чтобы открыть новую тренировку на сегодня.
                  </Text>
                </View>
              ) : (
                data.todayWorkouts.map((workout) => (
                  <HomeWorkoutCard
                    key={workout.id}
                    workout={workout}
                    listItemStyles={listItemStyles}
                    theme={theme}
                    onPress={() => openWorkout(workout.id)}
                  />
                ))
              )}
            </View>

            {data.nextWorkout ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Следующая</Text>
                <Pressable
                  style={pressableStyle([styles.nextCard, { backgroundColor: theme.card }])}
                  onPress={() => openWorkout(data.nextWorkout!.id)}
                >
                  <View style={styles.nextCardDate}>
                    <Text style={styles.nextCardDay}>
                      {new Date(data.nextWorkout.workout_date).getDate()}
                    </Text>
                    <Text style={styles.nextCardMonth}>
                      {new Date(data.nextWorkout.workout_date)
                        .toLocaleString("ru-RU", { month: "short" })
                        .replace(".", "")}
                    </Text>
                  </View>
                  <View style={styles.nextCardBody}>
                    <Text style={styles.nextCardTitle} numberOfLines={2}>
                      {data.nextWorkout.day_title?.trim() || "Тренировка"}
                    </Text>
                    {data.nextWorkout.gym_name ? (
                      <Text style={styles.nextCardMeta} numberOfLines={1}>
                        {data.nextWorkout.gym_name}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </Pressable>
                <Pressable
                  style={pressableStyle(styles.linkRow)}
                  onPress={() => router.push("/schedule-workouts")}
                >
                  <Text style={[styles.linkText, { color: theme.accent }]}>
                    Все запланированные
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.section}>
          <View style={[styles.sectionTitleRow, styles.sectionTitleRowCenter]}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Статистика</Text>
            <Pressable
              style={pressableStyle(styles.sectionTitleLink)}
              onPress={() => router.push("/stats")}
              accessibilityRole="button"
              accessibilityLabel="Открыть статистику"
            >
              <Text style={[styles.linkText, { color: theme.accent }]}>Вся статистика</Text>
            </Pressable>
          </View>
          <HomeHistoryStatsSection />
        </View>
      </ScrollView>
    </ScreenEnterFrame>
  );
}

function QuickActionButton({
  label,
  sublabel,
  icon,
  onPress,
  disabled,
  busy,
  theme,
}: {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <Pressable
      style={pressableStyle([
        {
          flex: 1,
          borderRadius: PLAQUE_RADIUS,
          backgroundColor: theme.card,
          paddingVertical: 16,
          paddingHorizontal: 14,
          alignItems: "flex-start",
          gap: 8,
          ...plaqueListShadow(),
        },
      ])}
      disabled={disabled}
      onPress={onPress}
    >
      {busy ? <ActivityIndicator size="small" color={theme.accent} /> : icon}
      <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: theme.text }}>{label}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: theme.textMuted }}>
        {sublabel}
      </Text>
    </Pressable>
  );
}

function HomeWorkoutCard({
  workout,
  listItemStyles: itemStyles,
  theme,
  onPress,
}: {
  workout: WorkoutSummary;
  listItemStyles: typeof workoutListItemStyles;
  theme: ReturnType<typeof useAppTheme>;
  onPress: () => void;
}) {
  const chipSize = useMetricChipSize();
  const date = new Date(workout.workout_date);

  return (
    <Pressable
      style={pressableStyle([itemStyles.card, itemStyles.cardWithMetrics])}
      onPress={onPress}
    >
      <View style={itemStyles.cardTopRow}>
        <View style={itemStyles.titleWithActiveDot}>
          <ActiveStatusDot
            visible={workout.is_active === true}
            traceContext={`home/workout/${workout.id}`}
          />
          <Text style={itemStyles.workoutTitle} numberOfLines={2}>
            {workout.day_title?.trim() || "Тренировка"}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: theme.textMuted }}>
          {String(date.getDate()).padStart(2, "0")}.
          {String(date.getMonth() + 1).padStart(2, "0")}
        </Text>
      </View>

      {workout.gym_name ? (
        <View style={itemStyles.metaRow}>
          <Ionicons name="location-outline" size={14} color={theme.accent} />
          <Text style={itemStyles.locationText} numberOfLines={1}>
            {workout.gym_name}
          </Text>
        </View>
      ) : null}

      <View style={itemStyles.metricsRow}>
        <View style={itemStyles.metricItem}>
          <MetricIconCircle figmaKind="volume" size={chipSize} />
          <View style={itemStyles.metricTextBlock}>
            <Text style={itemStyles.metricValue}>{workout.exercises_count} упр.</Text>
            <Text style={itemStyles.metricLabel}>Объём</Text>
          </View>
        </View>
        <View style={itemStyles.metricItem}>
          <MetricIconCircle figmaKind="tonnage" size={chipSize} />
          <View style={itemStyles.metricTextBlock}>
            <Text style={itemStyles.metricValue}>
              {formatWorkoutNumber(workout.tonnage_kg)} кг
            </Text>
            <Text style={itemStyles.metricLabel}>Тоннаж</Text>
          </View>
        </View>
        <View style={itemStyles.metricItem}>
          <MetricIconCircle figmaKind="duration" size={chipSize} />
          <View style={itemStyles.metricTextBlock}>
            <Text style={itemStyles.metricValue}>
              {formatWorkoutDuration(workout.duration_minutes)}
            </Text>
            <Text style={itemStyles.metricLabel}>Длит.</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function ShimmerLine({
  style,
  translateX,
  theme,
}: {
  style: object;
  translateX: Animated.AnimatedInterpolation<number>;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={[style, { backgroundColor: theme.border, overflow: "hidden" }]}>
      <AnimatedLinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          ...StyleSheet.absoluteFillObject,
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}

function ShimmerCard({
  translateX,
  theme,
  tall,
  flex,
}: {
  translateX: Animated.AnimatedInterpolation<number>;
  theme: ReturnType<typeof useAppTheme>;
  tall?: boolean;
  flex?: boolean;
}) {
  return (
    <View
      style={[
        {
          borderRadius: PLAQUE_RADIUS,
          backgroundColor: theme.border,
          overflow: "hidden",
          marginBottom: 12,
          height: tall ? 132 : 88,
          flex: flex ? 1 : undefined,
        },
      ]}
    >
      <AnimatedLinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          ...StyleSheet.absoluteFillObject,
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useAppTheme>,
  horizontalPadding: number,
  bottomPad: number,
) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scrollContent: {
      paddingTop: SCREEN_HEADER_TOP_PADDING,
      paddingHorizontal: horizontalPadding,
      paddingBottom: bottomPad,
    },
    screenTitle: {
      ...type.screenTitle,
      color: theme.text,
      marginBottom: SCREEN_HEADER_BOTTOM_MARGIN,
    },
    greetingBlock: {
      marginBottom: 24,
      gap: 6,
    },
    greeting: {
      fontFamily: fonts.semiBold,
      fontSize: 22,
      lineHeight: 28,
      color: theme.text,
      letterSpacing: -0.4,
    },
    dateLine: {
      fontFamily: fonts.regular,
      fontSize: 15,
      lineHeight: 21,
      color: theme.textMuted,
    },
    goalLine: {
      marginTop: 4,
      fontFamily: fonts.semiBold,
      fontSize: 14,
      lineHeight: 20,
      color: theme.text,
    },
    preferredGymRow: {
      marginTop: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    preferredGymText: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.textMuted,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12,
    },
    sectionTitleRowCenter: {
      alignItems: "center",
    },
    sectionTitleLink: {
      paddingVertical: 0,
      alignSelf: "center",
    },
    sectionTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 17,
      lineHeight: 22,
      color: theme.text,
      marginBottom: 12,
    },
    sectionTitleInline: {
      marginBottom: 0,
    },
    sectionHint: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.textMuted,
      marginBottom: 12,
    },
    sectionHintInline: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.textMuted,
    },
    quickActionsRow: {
      flexDirection: "row",
      gap: 12,
    },
    activeCard: {
      borderRadius: PLAQUE_RADIUS,
      borderWidth: 1.5,
      padding: 16,
      ...plaqueListShadow(),
    },
    activeCardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    activeCardTitle: {
      flex: 1,
      fontFamily: fonts.semiBold,
      fontSize: 18,
      lineHeight: 24,
      color: theme.text,
    },
    activeCardMeta: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: theme.textMuted,
      marginBottom: 2,
    },
    continuePill: {
      marginTop: 12,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
    },
    continuePillText: {
      fontFamily: fonts.semiBold,
      fontSize: 14,
      color: "#fff",
    },
    emptyTodayCard: {
      borderRadius: PLAQUE_RADIUS,
      padding: 20,
      alignItems: "center",
      gap: 8,
      ...plaqueListShadow(),
    },
    emptyTodayTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 16,
      lineHeight: 22,
      color: theme.text,
      textAlign: "center",
    },
    emptyTodaySub: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: theme.textMuted,
      textAlign: "center",
    },
    nextCard: {
      borderRadius: PLAQUE_RADIUS,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      ...plaqueListShadow(),
    },
    nextCardDate: {
      width: 44,
      alignItems: "center",
    },
    nextCardDay: {
      fontFamily: fonts.extraBold,
      fontSize: 22,
      lineHeight: 26,
      color: theme.text,
    },
    nextCardMonth: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      lineHeight: 16,
      color: theme.textMuted,
      textTransform: "capitalize",
    },
    nextCardBody: {
      flex: 1,
      minWidth: 0,
    },
    nextCardTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 16,
      lineHeight: 22,
      color: theme.text,
    },
    nextCardMeta: {
      marginTop: 2,
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.textMuted,
    },
    linkRow: {
      marginTop: 10,
      alignSelf: "flex-start",
      paddingVertical: 4,
    },
    linkText: {
      fontFamily: fonts.semiBold,
      fontSize: 14,
      lineHeight: 20,
    },
    errorBlock: {
      alignItems: "center",
      paddingVertical: 32,
      gap: 8,
    },
    errorTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 16,
      color: theme.text,
    },
    errorText: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: theme.textMuted,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
    },
    retryButtonText: {
      fontFamily: fonts.semiBold,
      fontSize: 14,
      color: "#fff",
    },
    skeletonGreeting: {
      height: 28,
      width: "72%",
      borderRadius: 8,
    },
    skeletonSubline: {
      height: 18,
      width: "48%",
      borderRadius: 6,
    },
    skeletonSectionTitle: {
      height: 20,
      width: "40%",
      borderRadius: 6,
      marginBottom: 12,
    },
  });
}
