import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { fetchStatsGymVisits } from "@/api/stats";
import { fetchWeightDiary } from "@/api/weightDiary";
import { createHomeStatsStyles } from "@/components/home/stats/homeStatsStyles";
import { STATS_PERIOD_LABELS } from "@/components/stats/statsLabels";
import { createStatsScreenStyles } from "@/components/stats/statsScreenStyles";
import {
  formatStatsRelativeDay,
  getStatsPeriodDateRange,
} from "@/components/stats/statsUtils";
import type { StatsGymVisit, StatsPeriodId } from "@/components/stats/types";
import type { WeightMeasurement } from "@/components/weight/types";
import WeightTrendChart, {
  type WeightTrendChartColors,
} from "@/components/weight/WeightTrendChart";
import { buildWeightTrendChart } from "@/components/weight/weightDiaryTrendChart";
import { useAuth } from "@/context/AuthContext";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

function formatDeltaKg(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1).replace(".", ",")} кг`;
}

type Props = {
  period: StatsPeriodId;
};

export default function StatsWeightAndGymsBlock({ period }: Props) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const { styles } = useMemo(() => createHomeStatsStyles(theme), [theme]);
  const screenStyles = useMemo(() => createStatsScreenStyles(theme), [theme]);
  const [measurements, setMeasurements] = useState<WeightMeasurement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [gyms, setGyms] = useState<StatsGymVisit[]>([]);
  const [gymsError, setGymsError] = useState<string | null>(null);
  const periodLabel = STATS_PERIOD_LABELS[period];

  const { loading, reload } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const { startDate, endDate } = getStatsPeriodDateRange(period);
        const data = await fetchWeightDiary({
          startDate,
          endDate,
        });
        return { kind: "success", data };
      } catch (e) {
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "Не удалось загрузить вес",
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

  const gymsLoad = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const rows = await fetchStatsGymVisits(period);
        const mapped: StatsGymVisit[] = rows.map((row) => ({
          id: row.id,
          name: row.name,
          visitCount: row.visitCount,
          lastVisitedLabel: formatStatsRelativeDay(row.lastWorkoutDate),
        }));
        return { kind: "success" as const, data: mapped };
      } catch (e) {
        return {
          kind: "error" as const,
          message: e instanceof Error ? e.message : "Не удалось загрузить залы",
        };
      }
    },
    onSuccess: (data) => {
      setGyms(data);
      setGymsError(null);
    },
    onError: (message) => {
      setGyms([]);
      setGymsError(message);
    },
  });

  useEffect(() => {
    void reload({ silent: true });
    void gymsLoad.reload({ silent: true });
  }, [period, reload, gymsLoad.reload]);

  const chartColors = useMemo<WeightTrendChartColors>(
    () => ({
      line: theme.accent,
      pointFill: theme.accent,
      pointStroke: theme.card,
      label: theme.text,
      goalLine: theme.textMuted,
    }),
    [theme],
  );

  const trendChart = useMemo(
    () =>
      chartWidth > 0
        ? buildWeightTrendChart(measurements, chartWidth, user?.target_weight_kg)
        : null,
    [measurements, chartWidth, user?.target_weight_kg],
  );

  const summaryText = useMemo(() => {
    if (measurements.length === 0) return null;

    const chronological = [...measurements].sort(
      (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
    );
    const first = chronological[0];
    const latest = chronological[chronological.length - 1];
    const delta = latest.weight_kg - first.weight_kg;
    const target = user?.target_weight_kg;
    const targetPart =
      typeof target === "number" && Number.isFinite(target) && target > 0
        ? ` · цель ${target.toFixed(1).replace(".", ",")} кг`
        : "";

    return `${latest.weight_kg.toFixed(1).replace(".", ",")} кг сейчас · ${formatDeltaKg(delta)} за ${periodLabel.toLowerCase()}${targetPart}`;
  }, [measurements, periodLabel, user?.target_weight_kg]);

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Вес тела</Text>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={styles.periodText}>Загрузка веса…</Text>
          </View>
        ) : error ? (
          <View style={{ alignItems: "center", paddingVertical: 16, gap: 8 }}>
            <Text style={[styles.periodText, { textAlign: "center" }]}>{error}</Text>
            <Pressable
              style={pressableStyle({ paddingVertical: 8, paddingHorizontal: 12 })}
              onPress={() => void reload({ force: true })}
            >
              <Text style={[styles.periodText, { color: theme.accent }]}>Повторить</Text>
            </Pressable>
          </View>
        ) : measurements.length === 0 ? (
          <Text style={[styles.periodText, { marginBottom: 4 }]}>
            Нет измерений за {periodLabel.toLowerCase()}
          </Text>
        ) : (
          <>
            {summaryText ? (
              <Text style={[styles.periodText, { marginBottom: 4 }]}>{summaryText}</Text>
            ) : null}
            <View
              style={screenStyles.weightTrendChartWrap}
              onLayout={(event) => {
                const nextWidth = Math.round(event.nativeEvent.layout.width);
                if (nextWidth > 0) {
                  setChartWidth((prev) => (prev === nextWidth ? prev : nextWidth));
                }
              }}
            >
              {trendChart ? (
                <WeightTrendChart model={trendChart} colors={chartColors} />
              ) : null}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Залы</Text>
        <Text style={[styles.periodText, { marginBottom: 4 }]}>
          По числу тренировок · {periodLabel.toLowerCase()}
        </Text>

        {gymsLoad.loading && gyms.length === 0 ? (
          <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 12 }} />
        ) : gymsError ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.periodText}>{gymsError}</Text>
            <Pressable
              style={pressableStyle({ padding: 8 })}
              onPress={() => void gymsLoad.reload({ force: true })}
            >
              <Text style={{ color: theme.accent }}>Повторить</Text>
            </Pressable>
          </View>
        ) : gyms.length === 0 ? (
          <Text style={styles.periodText}>Нет тренировок с залом за период</Text>
        ) : (
          gyms.map((gym) => (
            <View key={gym.id} style={screenStyles.gymRow}>
              <Text style={screenStyles.gymName} numberOfLines={1}>
                {gym.name}
              </Text>
              <Text style={screenStyles.gymMeta}>
                {gym.visitCount} виз.
                {"\n"}
                {gym.lastVisitedLabel}
              </Text>
            </View>
          ))
        )}
      </View>
    </>
  );
}
