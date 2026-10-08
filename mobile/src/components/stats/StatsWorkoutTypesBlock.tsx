import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { fetchStatsWorkoutTypes } from "@/api/stats";
import { createHomeStatsStyles } from "@/components/home/stats/homeStatsStyles";
import { STATS_PERIOD_LABELS } from "@/components/stats/statsLabels";
import { createStatsScreenStyles } from "@/components/stats/statsScreenStyles";
import type { StatsPeriodId, StatsWorkoutTypeSlice } from "@/components/stats/types";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

export default function StatsWorkoutTypesBlock({ period }: { period: StatsPeriodId }) {
  const theme = useAppTheme();
  const { styles } = useMemo(() => createHomeStatsStyles(theme), [theme]);
  const screenStyles = useMemo(() => createStatsScreenStyles(theme), [theme]);
  const [items, setItems] = useState<StatsWorkoutTypeSlice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { loading, reload } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const data = await fetchStatsWorkoutTypes(period);
        return { kind: "success" as const, data };
      } catch (e) {
        return {
          kind: "error" as const,
          message: e instanceof Error ? e.message : "Не удалось загрузить типы",
        };
      }
    },
    onSuccess: (data) => {
      setItems(data);
      setError(null);
    },
    onError: (message) => {
      setItems([]);
      setError(message);
    },
  });

  useEffect(() => {
    void reload({ silent: true });
  }, [period, reload]);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Типы тренировок</Text>
      <Text style={[styles.periodText, { marginBottom: 12 }]}>
        За {STATS_PERIOD_LABELS[period].toLowerCase()}
      </Text>

      {loading && items.length === 0 ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : error ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.periodText}>{error}</Text>
          <Pressable style={pressableStyle({ padding: 8 })} onPress={() => void reload({ force: true })}>
            <Text style={{ color: theme.accent }}>Повторить</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.periodText}>Пока нет тренировок за период</Text>
      ) : (
        items.map((slice) => (
          <View key={slice.id} style={screenStyles.typeRow}>
            <Text style={screenStyles.typeLabel} numberOfLines={1}>
              {slice.label}
            </Text>
            <View style={screenStyles.typeBarTrack}>
              <View
                style={[
                  screenStyles.typeBarFill,
                  { width: `${slice.percent}%` },
                ]}
              />
            </View>
            <Text style={screenStyles.typePercent}>{slice.percent}%</Text>
          </View>
        ))
      )}
    </View>
  );
}
