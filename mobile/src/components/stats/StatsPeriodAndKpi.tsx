import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { STATS_PERIOD_LABELS } from "@/components/stats/statsLabels";
import { createStatsScreenStyles } from "@/components/stats/statsScreenStyles";
import type { StatsKpiSnapshot, StatsPeriodId } from "@/components/stats/types";
import { MetricIconCircle } from "@/components/workouts/metricIcon";
import { formatWorkoutDuration, formatWorkoutNumber } from "@/utils/workoutListApi";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const PERIODS: StatsPeriodId[] = ["7d", "30d", "3m", "year", "all"];

type Props = {
  period: StatsPeriodId;
  onPeriodChange: (period: StatsPeriodId) => void;
};

export default function StatsPeriodPicker({ period, onPeriodChange }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStatsScreenStyles(theme), [theme]);

  return (
    <View style={styles.periodRow}>
      {PERIODS.map((id) => {
        const active = id === period;
        return (
          <Pressable
            key={id}
            style={pressableStyle([styles.periodChip, active && styles.periodChipActive])}
            onPress={() => onPeriodChange(id)}
          >
            <Text
              style={[styles.periodChipText, active && styles.periodChipTextActive]}
            >
              {STATS_PERIOD_LABELS[id]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatsKpiRow({
  kpi,
  loading,
  error,
  onRetry,
}: {
  kpi: StatsKpiSnapshot | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStatsScreenStyles(theme), [theme]);

  if (loading && !kpi) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <ActivityIndicator size="small" color={theme.accent} />
      </View>
    );
  }

  if (error && !kpi) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 12, gap: 8 }}>
        <Text style={{ color: theme.textMuted, textAlign: "center" }}>{error}</Text>
        <Pressable style={pressableStyle({ padding: 8 })} onPress={onRetry}>
          <Text style={{ color: theme.accent }}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  if (!kpi) return null;

  const cards = [
    {
      key: "workouts",
      icon: "volume" as const,
      value: String(kpi.workouts),
      label: "Тренировок",
      delta: kpi.deltaWorkouts,
    },
    {
      key: "duration",
      icon: "duration" as const,
      value: formatWorkoutDuration(kpi.durationMinutes),
      label: "Время в зале",
      delta: kpi.deltaDuration,
    },
    {
      key: "tonnage",
      icon: "tonnage" as const,
      value: `${formatWorkoutNumber(kpi.tonnageKg)} кг`,
      label: "Тоннаж",
      delta: kpi.deltaTonnage,
    },
    {
      key: "exercises",
      icon: "volume" as const,
      value: String(kpi.exercises),
      label: "Упражнений",
      delta: kpi.deltaExercises,
    },
  ];

  return (
    <View style={styles.kpiGrid}>
      {cards.map((card) => (
        <View key={card.key} style={styles.kpiCard}>
          <View style={styles.kpiIconRow}>
            <MetricIconCircle figmaKind={card.icon} size={28} />
            <Text style={styles.kpiValue} numberOfLines={1}>
              {card.value}
            </Text>
          </View>
          <Text style={styles.kpiLabel}>{card.label}</Text>
          <Text style={styles.kpiDelta} numberOfLines={2}>
            {card.delta}
          </Text>
        </View>
      ))}
    </View>
  );
}
