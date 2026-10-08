import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";
import { fetchStreaksRhythm } from "@/api/stats";
import {
  createHomeStatsStyles,
  streakBarColors,
} from "@/components/home/stats/homeStatsStyles";
import { homeStatsTextProps } from "@/components/home/stats/homeStatsTextProps";
import { createStatsScreenStyles } from "@/components/stats/statsScreenStyles";
import {
  formatStatsBestStreakHint,
  formatStatsCurrentStreakLabel,
  formatStatsStreakDate,
} from "@/components/stats/statsUtils";
import type { StatsStreaksRhythm } from "@/components/stats/types";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

export default function StatsStreaksBlock() {
  const theme = useAppTheme();
  const { styles, tokens } = useMemo(() => createHomeStatsStyles(theme), [theme]);
  const screenStyles = useMemo(() => createStatsScreenStyles(theme), [theme]);
  const [streaksRhythm, setStreaksRhythm] = useState<StatsStreaksRhythm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { loading, reload } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const data = await fetchStreaksRhythm();
        return { kind: "success", data };
      } catch (e) {
        return {
          kind: "error",
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

  const maxDays = useMemo(() => {
    if (!streaksRhythm?.best_streaks.length) return 1;
    return Math.max(...streaksRhythm.best_streaks.map((item) => item.days));
  }, [streaksRhythm]);

  const currentStreakLabel = useMemo(
    () =>
      streaksRhythm ? formatStatsCurrentStreakLabel(streaksRhythm.current_streak_days) : "",
    [streaksRhythm],
  );

  const bestStreakHint = useMemo(() => {
    if (!streaksRhythm?.best_streaks.length) return "Пока нет завершённых серий";
    return formatStatsBestStreakHint(maxDays);
  }, [streaksRhythm, maxDays]);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Серии и ритм</Text>

      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.periodText}>Загрузка серий…</Text>
        </View>
      ) : error ? (
        <View style={{ alignItems: "center", paddingVertical: 16, gap: 8 }}>
          <Text style={[styles.periodText, { textAlign: "center" }]}>{error}</Text>
          <Pressable
            style={pressableStyle({ paddingVertical: 8, paddingHorizontal: 12 })}
            onPress={() => void reload({ force: true })}
            accessibilityRole="button"
            accessibilityLabel="Повторить загрузку серий"
          >
            <Text style={[styles.periodText, { color: theme.accent }]}>Повторить</Text>
          </Pressable>
        </View>
      ) : streaksRhythm ? (
        <>
          <View style={screenStyles.currentStreakCard}>
            <Text style={screenStyles.currentStreakEmoji}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={screenStyles.currentStreakTitle}>{currentStreakLabel}</Text>
              <Text style={screenStyles.currentStreakHint}>{bestStreakHint}</Text>
            </View>
          </View>

          <Text style={[styles.periodText, { marginBottom: 8 }]}>Лучшие серии</Text>

          <View style={styles.streaksList}>
            {streaksRhythm.best_streaks.map((item) => {
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
                        { width: barWidthPercent, backgroundColor },
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
        </>
      ) : null}
    </View>
  );
}
