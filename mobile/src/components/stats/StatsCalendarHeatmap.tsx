import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { fetchActivityHeatmap } from "@/api/stats";
import {
  calendarCellColors,
  createHomeStatsStyles,
} from "@/components/home/stats/homeStatsStyles";
import { homeStatsTextProps } from "@/components/home/stats/homeStatsTextProps";
import InfoNoticeModal from "@/components/profile/modals/InfoNoticeModal";
import {
  formatStatsHeatmapDayTitle,
  formatStatsHeatmapPeriod,
  getStatsCalendarWeeks,
  getStatsHeatmapDayNote,
  getStatsHeatmapIntensity,
  getStatsMonthLabel,
  getStatsWeekAnchorDate,
  toStatsDateKey,
} from "@/components/stats/statsUtils";
import type { StatsActivityHeatmap } from "@/components/stats/types";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const DAY_LABELS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

type DayNoteModal = {
  dateKey: string;
  note: string | null;
};

export default function StatsCalendarHeatmap() {
  const theme = useAppTheme();
  const { styles, tokens } = useMemo(() => createHomeStatsStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const [heatmap, setHeatmap] = useState<StatsActivityHeatmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [dayModal, setDayModal] = useState<DayNoteModal | null>(null);

  const { loading, reload } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const data = await fetchActivityHeatmap();
        return { kind: "success", data };
      } catch (e) {
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "Не удалось загрузить календарь",
        };
      }
    },
    onSuccess: (data) => {
      setHeatmap(data);
      setError(null);
    },
    onError: (message) => {
      setHeatmap(null);
      setError(message);
    },
  });

  const weeks = useMemo(
    () => (heatmap ? getStatsCalendarWeeks(heatmap.range) : []),
    [heatmap],
  );

  const rangeKey = heatmap ? `${heatmap.range.start}:${heatmap.range.end}` : "";

  const scrollToLatestWeek = () => {
    scrollRef.current?.scrollToEnd({ animated: false });
  };

  const openDayNote = (dateKey: string, intensity: number) => {
    const note = heatmap ? getStatsHeatmapDayNote(dateKey, heatmap.days) : null;
    const hasWorkout = intensity > 0 || Boolean(note);
    if (!hasWorkout && !note) return;

    setDayModal({ dateKey, note });
    setDayModalVisible(true);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Календарь активности</Text>

      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.periodText}>Загрузка календаря…</Text>
        </View>
      ) : error ? (
        <View style={{ alignItems: "center", paddingVertical: 16, gap: 8 }}>
          <Text style={[styles.periodText, { textAlign: "center" }]}>{error}</Text>
          <Pressable
            style={pressableStyle({ paddingVertical: 8, paddingHorizontal: 12 })}
            onPress={() => void reload({ force: true })}
            accessibilityRole="button"
            accessibilityLabel="Повторить загрузку календаря"
          >
            <Text style={[styles.periodText, { color: theme.accent }]}>Повторить</Text>
          </Pressable>
        </View>
      ) : heatmap ? (
        <>
          <Text style={[styles.periodText, { marginBottom: 8 }]}>
            {formatStatsHeatmapPeriod(heatmap.range)}
          </Text>
          <Text style={[styles.periodText, { marginBottom: 8 }]}>
            По вашим тренировкам · нажмите на день, чтобы увидеть комментарий
          </Text>

          <View style={styles.calendarHeatmapLayout}>
            <ScrollView
              key={rangeKey}
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.calendarScrollContent}
              onContentSizeChange={scrollToLatestWeek}
            >
              <View>
                <View style={styles.monthsRow}>
                  {weeks.map((week, index) => {
                    const anchorDate = getStatsWeekAnchorDate(week);
                    const previousAnchorDate =
                      index > 0 ? getStatsWeekAnchorDate(weeks[index - 1]) : null;
                    const shouldShowLabel =
                      anchorDate !== null &&
                      (index === 0 ||
                        anchorDate.getMonth() !== previousAnchorDate?.getMonth() ||
                        anchorDate.getFullYear() !== previousAnchorDate?.getFullYear());

                    return (
                      <View key={`month-${index}`} style={styles.weekHeaderCell}>
                        {shouldShowLabel && anchorDate ? (
                          <Text style={styles.monthLabel} {...homeStatsTextProps}>
                            {getStatsMonthLabel(anchorDate)}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {DAY_LABELS.map((dayLabel, rowIndex) => (
                  <View key={dayLabel} style={styles.calendarRow}>
                    {weeks.map((week, weekIndex) => {
                      const date = week[rowIndex];

                      if (!date) {
                        return (
                          <View
                            key={`empty-${weekIndex}-${rowIndex}`}
                            style={styles.dayCellEmpty}
                          />
                        );
                      }

                      const dateKey = toStatsDateKey(date);
                      const intensity = getStatsHeatmapIntensity(date, heatmap.days);
                      const { backgroundColor, textColor } = calendarCellColors(
                        intensity,
                        theme,
                        tokens,
                      );
                      const hasNote = Boolean(getStatsHeatmapDayNote(dateKey, heatmap.days));
                      const hasWorkout = intensity > 0;
                      const pressable = hasWorkout || hasNote;

                      const cell = (
                        <>
                          <Text
                            style={[styles.dayNumber, { color: textColor }]}
                            {...homeStatsTextProps}
                          >
                            {date.getDate()}
                          </Text>

                          {hasNote ? <View style={styles.dayDot} /> : null}
                        </>
                      );

                      if (!pressable) {
                        return (
                          <View
                            key={`${dateKey}-${weekIndex}`}
                            style={[styles.dayCell, { backgroundColor }]}
                          >
                            {cell}
                          </View>
                        );
                      }

                      return (
                        <Pressable
                          key={`${dateKey}-${weekIndex}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Комментарий за ${formatStatsHeatmapDayTitle(dateKey)}`}
                          style={pressableStyle([styles.dayCell, { backgroundColor }], {
                            pressed: { opacity: 0.82 },
                          })}
                          onPress={() => openDayNote(dateKey, intensity)}
                        >
                          {cell}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.calendarDayLabelsColumn}>
              <View style={styles.calendarDayLabelsMonthSpacer} />
              {DAY_LABELS.map((dayLabel) => (
                <View key={dayLabel} style={styles.calendarDayLabelRow}>
                  <Text style={styles.dayLabel} {...homeStatsTextProps}>
                    {dayLabel}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}

      <InfoNoticeModal
        visible={dayModalVisible}
        title={
          dayModal ? `Комментарий · ${formatStatsHeatmapDayTitle(dayModal.dateKey)}` : "Комментарий"
        }
        body={dayModal?.note?.trim() || "К этой тренировке нет комментария"}
        onClose={() => setDayModalVisible(false)}
        onDismiss={() => setDayModal(null)}
      />
    </View>
  );
}
