import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";
import { fetchStreaksRhythm } from "@/api/stats";
import {
  createHomeStatsStyles,
  streakBarColors,
} from "@/components/home/stats/homeStatsStyles";
import { homeStatsTextProps } from "@/components/home/stats/homeStatsTextProps";
import { formatStatsStreakDate } from "@/components/stats/statsUtils";
import type { StatsStreaksRhythm } from "@/components/stats/types";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

/** Лучшие серии на главной — из GET /stats/streaks-rhythm. */
export default function HomeBestStreaks() {
  const theme = useAppTheme();
  const { styles, tokens } = useMemo(() => createHomeStatsStyles(theme), [theme]);
  const [streaksRhythm, setStreaksRhythm] = useState<StatsStreaksRhythm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { loading, reload } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const data = await fetchStreaksRhythm();
        return { kind: "success" as const, data };
      } catch (e) {
        return {
          kind: "error" as const,
          message: e instanceof Error ? e.message : "Не удалось загрузить серии",
        };
      }
    },
    onSuccess: (data) => {
      setStreaksRhythm(data);
      setError(null);
    },
    onError: (message) => {
      setStreaksRhythm(null);
      setError(message);
    },
  });

  const bestStreaks = streaksRhythm?.best_streaks ?? [];
  const maxDays = Math.max(...bestStreaks.map((item) => item.days), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Лучшие серии</Text>

      {loading && bestStreaks.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator size="small" color={theme.accent} />
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
      ) : bestStreaks.length === 0 ? (
        <Text style={[styles.periodText, { paddingVertical: 12 }]}>
          Пока нет завершённых серий
        </Text>
      ) : (
        <View style={styles.streaksList}>
          {bestStreaks.map((item) => {
            const barWidthPercent = `${(item.days / maxDays) * 100}%` as ViewStyle["width"];
            const { backgroundColor, textColor } = streakBarColors(
              item.days,
              maxDays,
              theme,
              tokens,
            );

            return (
              <View key={`${item.start}-${item.end}`} style={styles.streakRow}>
                <Text style={styles.streakDate} numberOfLines={2} {...homeStatsTextProps}>
                  {formatStatsStreakDate(item.start)}
                </Text>

                <View style={styles.streakBarTrack}>
                  <View
                    style={[
                      styles.streakBar,
                      {
                        width: barWidthPercent,
                        backgroundColor,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.streakValue, { color: textColor }]}
                      {...homeStatsTextProps}
                    >
                      {item.days}
                    </Text>
                  </View>
                </View>

                <Text style={styles.streakDate} numberOfLines={2} {...homeStatsTextProps}>
                  {formatStatsStreakDate(item.end)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
