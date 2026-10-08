import React, { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { StatsOverview } from "@/api/stats";
import { createHomeStatsStyles } from "@/components/home/stats/homeStatsStyles";
import { homeStatsTextProps } from "@/components/home/stats/homeStatsTextProps";
import { metricToken } from "@/components/workouts/metricIcon";
import SegmentedTabs, { type SegmentedTabItem } from "@/components/ui/SegmentedTabs";
import { STATS_METRIC_LABELS, STATS_PERIOD_LABELS } from "@/components/stats/statsLabels";
import { createStatsScreenStyles } from "@/components/stats/statsScreenStyles";
import { formatStatsMetricValue } from "@/components/stats/statsUtils";
import type { StatsMetricId, StatsPeriodId } from "@/components/stats/types";
import { useAppTheme } from "@/theme/appTheme";

const METRIC_TABS: readonly SegmentedTabItem<StatsMetricId>[] = [
  { id: "sessions", label: "Сессии", nativeId: "stats-metric-sessions" },
  { id: "duration", label: "Время", nativeId: "stats-metric-duration" },
  { id: "tonnage", label: "Тоннаж", nativeId: "stats-metric-tonnage" },
  { id: "exercises", label: "Упр.", nativeId: "stats-metric-exercises" },
];

const CHART_HEIGHT = 132;

type Props = {
  period: StatsPeriodId;
  metric: StatsMetricId;
  onMetricChange: (metric: StatsMetricId) => void;
  overview: StatsOverview | null;
  loading: boolean;
};

export default function StatsMetricChart({
  period,
  metric,
  onMetricChange,
  overview,
  loading,
}: Props) {
  const theme = useAppTheme();
  const { styles: chartStyles } = useMemo(() => createHomeStatsStyles(theme), [theme]);
  const screenStyles = useMemo(() => createStatsScreenStyles(theme), [theme]);
  const data = overview?.series[metric] ?? [];
  const maxValue = Math.max(...data.map((p) => p.value), 1);
  const barColor =
    metric === "sessions"
      ? metricToken("green", theme.dark).fg
      : metric === "duration"
        ? metricToken("teal", theme.dark).fg
        : metric === "tonnage"
          ? metricToken("blue", theme.dark).fg
          : metricToken("green", theme.dark).fg;

  return (
    <View style={chartStyles.card}>
      <View style={chartStyles.sectionHeader}>
        <Text style={[chartStyles.sectionTitle, chartStyles.sectionTitleInline]}>
          Динамика
        </Text>
        <Text style={chartStyles.periodText}>
          {overview?.periodLabel ?? STATS_PERIOD_LABELS[period]}
        </Text>
      </View>

      <View style={screenStyles.metricTabsWrap}>
        <SegmentedTabs
          tabs={METRIC_TABS}
          value={metric}
          onChange={onMetricChange}
          trackNativeId="stats-metric-tabs"
          labelSize="sm"
        />
      </View>

      {loading && data.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      ) : (
        <>
          <View style={chartStyles.chartPlot}>
            {[0, 1, 2, 3, 4].map((line) => (
              <View
                key={line}
                style={[
                  chartStyles.gridLine,
                  { bottom: (CHART_HEIGHT / 4) * line },
                ]}
              />
            ))}

            <View style={[chartStyles.chartBarsRow, { height: CHART_HEIGHT }]}>
              {data.map((item, index) => {
                const barHeight = maxValue > 0 ? (item.value / maxValue) * 104 : 0;
                const displayValue =
                  item.value > 0
                    ? formatStatsMetricValue(metric, item.value).replace(" ", "\u00a0")
                    : "";

                return (
                  <View key={`${item.label}-${index}`} style={chartStyles.chartColumn}>
                    <View style={chartStyles.barArea}>
                      {displayValue ? (
                        <Text
                          style={chartStyles.barValue}
                          numberOfLines={1}
                          {...homeStatsTextProps}
                        >
                          {displayValue}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          chartStyles.verticalBar,
                          {
                            height: Math.max(barHeight, item.value > 0 ? 4 : 0),
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={chartStyles.chartLabelsRow}>
            {data.map((item, index) => (
              <View key={`${item.label}-label-${index}`} style={chartStyles.chartColumn}>
                <Text style={chartStyles.axisLabel} numberOfLines={1} {...homeStatsTextProps}>
                  {item.label}
                </Text>
                <Text style={chartStyles.axisYear} numberOfLines={1} {...homeStatsTextProps}>
                  {item.sublabel ?? " "}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={[chartStyles.periodText, { marginTop: 10 }]}>
        Метрика: {STATS_METRIC_LABELS[metric]}
      </Text>
    </View>
  );
}
