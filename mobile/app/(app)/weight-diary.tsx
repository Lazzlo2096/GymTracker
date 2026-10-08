import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchWeightDiary } from "@/api/weightDiary";
import { useTraceScreen } from "@/debug/useTraceScreen";
import { useFabScrollPadding } from "@/components/navigation/bottomTabBarInset";
import ScreenEnterFrame, { useGoBackWithScreenEnter } from "@/components/navigation/ScreenEnterFrame";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import FloatingAddButton from "@/components/ui/FloatingAddButton";
import InfoNoticeModal from "@/components/profile/modals/InfoNoticeModal";
import type { WeightMeasurement } from "@/components/weight/types";
import WeightMeasurementFormModal from "@/components/weight/WeightMeasurementFormModal";
import WeightTrendChart, {
  WEIGHT_TREND_CHART_ON_BLUE,
} from "@/components/weight/WeightTrendChart";
import {
  formatWeightDiaryDayLabel,
  formatWeightDiaryMeasuredTime,
  getCalendarDayKey,
} from "@/components/weight/weightDiaryUtils";
import { buildWeightTrendChart } from "@/components/weight/weightDiaryTrendChart";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useAuth } from "@/context/AuthContext";
import { metricToken } from "@/components/workouts/metricIcon";
import { plaqueListShadow, PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import { SCREEN_HEADER_BOTTOM_MARGIN, SCREEN_HEADER_TOP_PADDING } from "@/theme/screenChrome";
import { useAppTheme } from "@/theme/appTheme";
import { fonts, type } from "@/theme/typography";
import { pressableStyle } from "@/utils/pressableStyles";

function formatBodyFatPercent(value: number | null): string {
  return value == null ? "—" : value.toFixed(1);
}

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

const BODY_SCORE_HEIGHT_HINT = "Чтобы получить оценку, введите свой рост в профиле!";
const SUMMARY_BLUE = "#137CFF";
const SCREEN_TITLE = "Мой дневник веса";

export default function WeightDiaryScreen() {
  useTraceScreen("weight-diary");
  const theme = useAppTheme();
  const { user } = useAuth();
  const goBack = useGoBackWithScreenEnter("/profile");
  const fabScrollPadding = useFabScrollPadding();
  const styles = useMemo(() => createStyles(), []);
  const [measurements, setMeasurements] = useState<WeightMeasurement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formTarget, setFormTarget] = useState<WeightMeasurement | null>(null);

  const { loading, reload } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const data = await fetchWeightDiary();
        return { kind: "success", data };
      } catch (e) {
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "Не удалось загрузить дневник веса",
        };
      }
    },
    onSuccess: (data) => {
      setMeasurements(data);
      setError(null);
    },
    onError: (message) => {
      setMeasurements([]);
      setError(message);
    },
  });

  const latest = measurements[0] ?? null;

  const refreshDiary = async () => {
    await reload({ force: true });
  };

  const openAddMeasurement = () => {
    if (!user?.id) {
      Alert.alert("Ошибка", "Войдите в аккаунт");
      return;
    }
    setFormTarget(null);
    setFormVisible(true);
  };

  const openEditMeasurement = (item: WeightMeasurement) => {
    if (!user?.id) {
      Alert.alert("Ошибка", "Войдите в аккаунт");
      return;
    }
    setFormTarget(item);
    setFormVisible(true);
  };

  return (
    <ScreenEnterFrame direction="right">
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: fabScrollPadding },
          ]}
        >
          <WeightDiaryHeader onBack={() => goBack()} styles={styles} theme={theme} />

          {loading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator size="small" color={theme.accent} />
              <Text style={[styles.stateText, { color: theme.textMuted }]} {...textBreakProps}>
                Загрузка дневника…
              </Text>
            </View>
          ) : error ? (
            <View style={styles.stateBlock}>
              <Text style={[styles.stateText, { color: theme.textMuted }]} {...textBreakProps}>
                {error}
              </Text>
              <Pressable
                style={pressableStyle(styles.retryButton)}
                onPress={() => void reload({ force: true })}
              >
                <Text style={[styles.retryText, { color: theme.accent }]}>Повторить</Text>
              </Pressable>
            </View>
          ) : latest ? (
            <>
              <WeightSummaryCard
                weightKg={latest.weight_kg}
                bodyFatPercent={latest.body_fat_percent}
                bodyScore={latest.body_score}
                measuredAt={latest.measured_at}
                measurements={measurements}
                targetWeightKg={user?.target_weight_kg}
                styles={styles}
              />

              <Text style={[styles.sectionTitle, { color: theme.text }]} {...textBreakProps}>
                Журнал измерений
              </Text>

              {measurements.map((item, index) => {
                const dayKey = getCalendarDayKey(item.measured_at);
                const prevDayKey =
                  index > 0 ? getCalendarDayKey(measurements[index - 1].measured_at) : null;
                const showDayLabel = dayKey !== prevDayKey;

                return (
                  <View key={item.id} style={styles.measurementBlock}>
                    {showDayLabel ? (
                      <Text
                        style={[styles.dayLabel, { color: theme.textMuted }]}
                        {...textBreakProps}
                      >
                        {formatWeightDiaryDayLabel(item.measured_at)}
                      </Text>
                    ) : null}
                    <MeasurementCard
                      item={item}
                      styles={styles}
                      theme={theme}
                      onPress={() => openEditMeasurement(item)}
                    />
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.stateBlock}>
              <Text style={[styles.stateText, { color: theme.textMuted }]} {...textBreakProps}>
                Пока нет измерений
              </Text>
            </View>
          )}
        </ScrollView>

        <FloatingAddButton
          onPress={openAddMeasurement}
          accessibilityLabel="Добавить измерение"
        />

        {user?.id ? (
          <WeightMeasurementFormModal
            visible={formVisible}
            measurement={formTarget}
            userId={user.id}
            onClose={() => setFormVisible(false)}
            onDismiss={() => setFormTarget(null)}
            onSaved={refreshDiary}
          />
        ) : null}
      </View>
    </ScreenEnterFrame>
  );
}

function WeightDiaryHeader({
  onBack,
  styles,
  theme,
}: {
  onBack: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={styles.header}>
      <ScreenTitleRowIconButton onPress={onBack} accessibilityLabel="Назад" hitSlop={12}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={metricToken("violet", theme.dark).fg}
        />
      </ScreenTitleRowIconButton>

      <View style={styles.headerTitleBlock}>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} {...textBreakProps}>
          {SCREEN_TITLE}
        </Text>
      </View>

      <View style={styles.headerSpacer} />
    </View>
  );
}

type WeightSummaryCardProps = {
  weightKg: number;
  bodyFatPercent: number | null;
  bodyScore: number | null;
  measuredAt: string;
  measurements: WeightMeasurement[];
  targetWeightKg?: number | null;
  styles: ReturnType<typeof createStyles>;
};

function WeightSummaryCard({
  weightKg,
  bodyFatPercent,
  bodyScore,
  measuredAt,
  measurements,
  targetWeightKg,
  styles,
}: WeightSummaryCardProps) {
  const dayLabel = formatWeightDiaryDayLabel(measuredAt);
  const [chartWidth, setChartWidth] = useState(0);
  const [bodyScoreHintOpen, setBodyScoreHintOpen] = useState(false);
  const trendChart = useMemo(
    () =>
      chartWidth > 0 ? buildWeightTrendChart(measurements, chartWidth, targetWeightKg) : null,
    [measurements, chartWidth, targetWeightKg],
  );

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryTitleRow}>
          <MaterialCommunityIcons name="scale-bathroom" size={22} color="#EAF3FF" />
          <Text style={styles.summaryTitle}>Вес</Text>
        </View>

        <View style={styles.todayRow}>
          <Feather name="clock" size={16} color="rgba(255,255,255,0.7)" />
          <Text style={styles.todayText}>{dayLabel}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.mainStat}>
          <Text style={styles.weightText}>{weightKg.toFixed(1)}</Text>
          <Text style={styles.kgText}>кг</Text>
        </View>

        <View style={styles.smallStat}>
          <Text style={styles.smallStatLabel}>Телесный жир</Text>
          <Text style={styles.smallStatValue}>
            {bodyFatPercent == null ? "—" : `${bodyFatPercent.toFixed(1)}%`}
          </Text>
        </View>

        <View style={styles.smallStat}>
          <Text style={styles.smallStatLabel}>Оценка тела</Text>
          {bodyScore == null ? (
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Почему нет оценки тела"
              style={pressableStyle(styles.bodyScoreMissingBtn, {
                pressed: { opacity: 0.75 },
              })}
              onPress={() => setBodyScoreHintOpen(true)}
            >
              <Text style={styles.smallStatValue}>—</Text>
              <Feather name="help-circle" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
          ) : (
            <Text style={styles.smallStatValue}>{bodyScore.toFixed(1)}</Text>
          )}
        </View>
      </View>

      <InfoNoticeModal
        visible={bodyScoreHintOpen}
        title="Оценка тела"
        body={BODY_SCORE_HEIGHT_HINT}
        onClose={() => setBodyScoreHintOpen(false)}
      />

      <View style={styles.trendBox}>
        <Text style={styles.trendTitle}>Тенденция ›</Text>
        <View
          style={styles.trendChartWrap}
          onLayout={(event) => {
            const nextWidth = Math.round(event.nativeEvent.layout.width);
            if (nextWidth > 0) {
              setChartWidth((prev) => (prev === nextWidth ? prev : nextWidth));
            }
          }}
        >
          {trendChart ? (
            <WeightTrendChart model={trendChart} colors={WEIGHT_TREND_CHART_ON_BLUE} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function MeasurementCard({
  item,
  styles,
  theme,
  onPress,
}: {
  item: WeightMeasurement;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useAppTheme>;
  onPress: () => void;
}) {
  const noteText = item.note?.trim() || null;

  return (
    <Pressable
      accessibilityRole="button"
      style={pressableStyle(
        [
          styles.measurementCard,
          {
            backgroundColor: theme.card,
          },
          plaqueListShadow(),
        ],
        {
          hover: { opacity: 0.96 },
          pressed: { opacity: 0.9 },
        },
      )}
      onPress={onPress}
    >
      <View
        style={[
          styles.measureMainRow,
          noteText ? styles.measureMainRowWithNote : null,
        ]}
      >
        <View style={styles.measureLeft}>
          <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
            <MaterialCommunityIcons name="scale-bathroom" size={30} color={theme.accent} />
          </View>

          <Text style={[styles.measureTime, { color: theme.textMuted }]}>
            {formatWeightDiaryMeasuredTime(item.measured_at)}
          </Text>
        </View>

        <View style={styles.measureBody}>
          <View style={styles.measureStatsRow}>
            <View style={styles.measureColumn}>
              <Text style={[styles.measureLabel, { color: theme.textMuted }]}>Вес</Text>

              <View style={styles.measureValueRow}>
                <Text style={[styles.measureValue, { color: theme.text }]}>
                  {item.weight_kg.toFixed(1)}
                </Text>
                <Text style={[styles.measureUnit, { color: theme.text }]}> кг</Text>
              </View>
            </View>

            <View style={styles.measureColumn}>
              <Text style={[styles.measureLabel, { color: theme.textMuted }]}>Телесный жир</Text>

              <View style={styles.measureValueRow}>
                <Text style={[styles.measureValue, { color: theme.text }]}>
                  {formatBodyFatPercent(item.body_fat_percent)}
                </Text>
                <Text style={[styles.measureUnit, { color: theme.text }]}>
                  {item.body_fat_percent == null ? "" : "%"}
                </Text>
              </View>
            </View>

            <Feather name="chevron-right" size={28} color={theme.textMuted} />
          </View>

          {noteText ? (
            <View style={styles.measureNoteRow}>
              <Ionicons name="document-text-outline" size={14} color={theme.textMuted} />
              <Text style={[styles.measureNote, { color: theme.textMuted }]} {...textBreakProps}>
                {noteText}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },

    content: {
      paddingHorizontal: 22,
      paddingTop: SCREEN_HEADER_TOP_PADDING,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: SCREEN_HEADER_BOTTOM_MARGIN,
      gap: 6,
    },

    headerTitleBlock: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 8,
    },

    headerTitle: {
      ...type.screenTitle,
      letterSpacing: -0.55,
    },

    headerSpacer: {
      width: 42,
      height: 42,
    },

    summaryCard: {
      width: "100%",
      minHeight: 276,
      borderRadius: PLAQUE_RADIUS + 8,
      padding: 24,
      backgroundColor: SUMMARY_BLUE,
      overflow: "visible",
      shadowColor: "#1387FF",
      shadowOpacity: 0.32,
      shadowRadius: 22,
      shadowOffset: {
        width: 0,
        height: 12,
      },
      elevation: 10,
    },

    summaryTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    summaryTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    summaryTitle: {
      ...type.sectionAccent,
      fontStyle: "italic",
      color: "#FFFFFF",
    },

    todayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    todayText: {
      ...type.bodyMedium,
      color: "rgba(255,255,255,0.72)",
    },

    statsRow: {
      marginTop: 24,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },

    mainStat: {
      flexDirection: "row",
      alignItems: "flex-end",
    },

    weightText: {
      ...type.display,
      color: "#FFFFFF",
      letterSpacing: -1.5,
    },

    kgText: {
      marginLeft: 6,
      marginBottom: 8,
      ...type.bodyMedium,
      color: "#FFFFFF",
    },

    smallStat: {
      alignItems: "flex-start",
      flexShrink: 0,
    },

    smallStatLabel: {
      marginBottom: 6,
      ...type.statTileLabel,
      color: "rgba(255,255,255,0.64)",
    },

    smallStatValue: {
      ...type.sectionAccent,
      color: "#FFFFFF",
    },

    bodyScoreMissingBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: -4,
      marginLeft: -8,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
    },

    trendBox: {
      marginTop: 22,
      minHeight: 150,
      borderRadius: PLAQUE_RADIUS,
      paddingTop: 14,
      paddingBottom: 4,
      backgroundColor: "rgba(255,255,255,0.15)",
      overflow: "hidden",
    },

    trendTitle: {
      paddingHorizontal: 14,
      ...type.bodyMedium,
      color: "rgba(255,255,255,0.73)",
    },

    trendChartWrap: {
      width: "100%",
    },

    sectionTitle: {
      marginTop: 32,
      marginBottom: 20,
      ...type.sectionAccent,
      letterSpacing: -0.3,
    },

    measurementBlock: {
      marginBottom: 22,
    },

    dayLabel: {
      marginBottom: 12,
      ...type.muted,
    },

    measurementCard: {
      minHeight: 108,
      borderRadius: PLAQUE_RADIUS + 8,
      paddingHorizontal: 18,
      paddingVertical: 16,
    },

    measureMainRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    measureMainRowWithNote: {
      alignItems: "flex-start",
    },

    measureBody: {
      flex: 1,
      minWidth: 0,
      marginLeft: 14,
    },

    measureStatsRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    measureLeft: {
      width: 72,
      alignItems: "center",
    },

    iconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },

    measureTime: {
      marginTop: 8,
      ...type.muted,
    },

    measureColumn: {
      flex: 1,
    },

    measureLabel: {
      marginBottom: 4,
      fontSize: 14,
    },

    measureValueRow: {
      flexDirection: "row",
      alignItems: "flex-end",
    },

    measureValue: {
      fontFamily: fonts.extraBold,
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.6,
    },

    measureUnit: {
      marginBottom: 4,
      fontFamily: fonts.bold,
      fontSize: 16,
    },

    measureNoteRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 10,
      minHeight: 20,
    },

    measureNote: {
      flex: 1,
      minWidth: 0,
      marginLeft: 7,
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
    },

    stateBlock: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
      gap: 12,
    },

    stateText: {
      ...type.bodyMedium,
      textAlign: "center",
    },

    retryButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },

    retryText: {
      ...type.bodyMedium,
      fontFamily: fonts.semiBold,
    },
  });
}
