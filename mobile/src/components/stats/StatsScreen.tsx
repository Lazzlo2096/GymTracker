import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { fetchStatsOverview, type StatsOverview } from "@/api/stats";
import { useBottomTabBarScrollPadding } from "@/components/navigation/bottomTabBarInset";
import ScreenEnterFrame from "@/components/navigation/ScreenEnterFrame";
import StatsCalendarHeatmap from "@/components/stats/StatsCalendarHeatmap";
import StatsMetricChart from "@/components/stats/StatsMetricChart";
import StatsPeriodPicker, { StatsKpiRow } from "@/components/stats/StatsPeriodAndKpi";
import StatsStreaksBlock from "@/components/stats/StatsStreaksBlock";
import StatsTopExercisesBlock from "@/components/stats/StatsTopExercisesBlock";
import StatsWeightAndGymsBlock from "@/components/stats/StatsWeightAndGymsBlock";
import StatsWorkoutTypesBlock from "@/components/stats/StatsWorkoutTypesBlock";
import { createStatsScreenStyles } from "@/components/stats/statsScreenStyles";
import type { StatsMetricId, StatsPeriodId } from "@/components/stats/types";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import {
  SCREEN_HEADER_BOTTOM_MARGIN,
  SCREEN_HEADER_TOP_PADDING,
} from "@/theme/screenChrome";
import { useAppTheme } from "@/theme/appTheme";
import { useTraceScreen } from "@/debug/useTraceScreen";

/** Экран «Статистика» — аналитика по реальным тренировкам и дневнику веса. */
export default function StatsScreen() {
  useTraceScreen("StatsScreen");
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 400 ? 20 : 16;
  const bottomPad = useBottomTabBarScrollPadding(32);
  const styles = useMemo(() => createStatsScreenStyles(theme), [theme]);

  const [period, setPeriod] = useState<StatsPeriodId>("30d");
  const [metric, setMetric] = useState<StatsMetricId>("sessions");
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const { loading: overviewLoading, reload: reloadOverview } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const data = await fetchStatsOverview(period);
        return { kind: "success" as const, data };
      } catch (e) {
        return {
          kind: "error" as const,
          message: e instanceof Error ? e.message : "Не удалось загрузить статистику",
        };
      }
    },
    onSuccess: (data) => {
      setOverview(data);
      setOverviewError(null);
    },
    onError: (message) => {
      setOverview(null);
      setOverviewError(message);
    },
  });

  useEffect(() => {
    void reloadOverview({ silent: true });
  }, [period, reloadOverview]);

  return (
    <ScreenEnterFrame direction="none">
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
          Статистика
        </Text>

        <StatsPeriodPicker period={period} onPeriodChange={setPeriod} />
        <StatsKpiRow
          kpi={overview?.kpi ?? null}
          loading={overviewLoading}
          error={overviewError}
          onRetry={() => void reloadOverview({ force: true })}
        />

        <View style={styles.sectionBlock}>
          <StatsMetricChart
            period={period}
            metric={metric}
            onMetricChange={setMetric}
            overview={overview}
            loading={overviewLoading}
          />
        </View>

        <View style={styles.sectionBlock}>
          <StatsCalendarHeatmap />
        </View>

        <View style={styles.sectionBlock}>
          <StatsStreaksBlock />
        </View>

        <View style={styles.sectionBlock}>
          <StatsWorkoutTypesBlock period={period} />
        </View>

        <View style={styles.sectionBlock}>
          <StatsTopExercisesBlock period={period} />
        </View>

        <View style={styles.sectionBlock}>
          <StatsWeightAndGymsBlock period={period} />
        </View>

        <View style={{ height: SCREEN_HEADER_BOTTOM_MARGIN }} />
      </ScrollView>
    </ScreenEnterFrame>
  );
}
