import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { fetchStatsTopExercises } from "@/api/stats";
import { createHomeStatsStyles } from "@/components/home/stats/homeStatsStyles";
import { STATS_PERIOD_LABELS } from "@/components/stats/statsLabels";
import { createStatsScreenStyles } from "@/components/stats/statsScreenStyles";
import type { StatsPeriodId, StatsTopExercise } from "@/components/stats/types";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { formatWorkoutNumber } from "@/utils/workoutListApi";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

export default function StatsTopExercisesBlock({ period }: { period: StatsPeriodId }) {
  const theme = useAppTheme();
  const { styles } = useMemo(() => createHomeStatsStyles(theme), [theme]);
  const screenStyles = useMemo(() => createStatsScreenStyles(theme), [theme]);
  const [items, setItems] = useState<StatsTopExercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { loading, reload } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const data = await fetchStatsTopExercises(period);
        return { kind: "success" as const, data };
      } catch (e) {
        return {
          kind: "error" as const,
          message: e instanceof Error ? e.message : "Не удалось загрузить топ",
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
      <Text style={styles.sectionTitle}>Топ упражнений</Text>
      <Text style={[styles.periodText, { marginBottom: 4 }]}>
        По подходам и тоннажу · {STATS_PERIOD_LABELS[period].toLowerCase()}
      </Text>

      {loading && items.length === 0 ? (
        <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 16 }} />
      ) : error ? (
        <View style={{ gap: 8, paddingVertical: 8 }}>
          <Text style={styles.periodText}>{error}</Text>
          <Pressable style={pressableStyle({ padding: 8 })} onPress={() => void reload({ force: true })}>
            <Text style={{ color: theme.accent }}>Повторить</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <Text style={[styles.periodText, { marginTop: 8 }]}>Пока нет упражнений за период</Text>
      ) : (
        items.map((item, index) => (
          <View
            key={item.id}
            style={[
              screenStyles.exerciseRow,
              index === items.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <Text style={screenStyles.exerciseRank}>{index + 1}</Text>
            <View style={screenStyles.exerciseBody}>
              <Text style={screenStyles.exerciseName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={screenStyles.exerciseMeta}>
                {item.sets} подх.
                {item.tonnageKg > 0
                  ? ` · ${formatWorkoutNumber(item.tonnageKg)} кг`
                  : ""}
                {item.bestWeightKg > 0 ? ` · PR ${item.bestWeightKg} кг` : ""}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}
