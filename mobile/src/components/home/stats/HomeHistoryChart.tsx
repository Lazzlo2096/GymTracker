import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";
import { fetchStatsOverview } from "@/api/stats";
import { createHomeStatsStyles } from "@/components/home/stats/homeStatsStyles";
import { homeStatsTextProps } from "@/components/home/stats/homeStatsTextProps";
import {
  STATS_BUCKET_LABELS,
  STATS_BUCKET_OPTIONS,
} from "@/components/stats/statsLabels";
import type { StatsBucketId, StatsChartPoint } from "@/components/stats/types";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const CHART_HEIGHT = 132;

/** Минимальная ширина столбца — чтобы day/week не сжимались и не наезжали. */
const MIN_COLUMN_WIDTH: Record<StatsBucketId, number> = {
  day: 24,
  week: 29,
  month: 35,
  quarter: 45,
  year: 37,
};

const BAR_WIDTH: Record<StatsBucketId, number> = {
  day: 8,
  week: 10,
  month: 12,
  quarter: 14,
  year: 14,
};

const DROPDOWN_MIN_WIDTH = 168;

/** История тренировок за всё время — бакет серии выбирается комбобоксом. */
export default function HomeHistoryChart() {
  const theme = useAppTheme();
  const { styles } = useMemo(() => createHomeStatsStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const triggerRef = useRef<View>(null);
  const skipBucketReloadRef = useRef(true);
  const [bucket, setBucket] = useState<StatsBucketId>("month");
  const [bucketOpen, setBucketOpen] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<LayoutRectangle | null>(null);
  const [points, setPoints] = useState<StatsChartPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);

  const { loading, reload } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      try {
        const overview = await fetchStatsOverview("all", { bucket });
        return { kind: "success" as const, data: overview.series.sessions };
      } catch (e) {
        return {
          kind: "error" as const,
          message: e instanceof Error ? e.message : "Не удалось загрузить историю",
        };
      }
    },
    onSuccess: (data) => {
      setPoints(data);
      setError(null);
    },
    onError: (message) => {
      setPoints([]);
      setError(message);
    },
  });

  useEffect(() => {
    if (skipBucketReloadRef.current) {
      skipBucketReloadRef.current = false;
      return;
    }
    void reload({ silent: true });
  }, [bucket, reload]);

  const maxValue = Math.max(...points.map((item) => item.value), 1);
  const minCol = MIN_COLUMN_WIDTH[bucket];
  // Контент не уже вьюпорта: мало столбцов растягиваются на всю ширину.
  // Много столбцов — фиксированный minCol и горизонтальный скролл.
  const contentWidth = Math.max(plotWidth, points.length * minCol);
  const columnWidth =
    points.length > 0 ? contentWidth / points.length : minCol;
  const chartKey =
    points.length > 0
      ? `${bucket}:${points[0]?.label}:${points[points.length - 1]?.label}:${points.length}`
      : `${bucket}:empty`;

  const scrollToLatest = () => {
    scrollRef.current?.scrollToEnd({ animated: false });
  };

  const openBucketSelect = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setTriggerLayout({ x, y, width, height });
      setBucketOpen(true);
    });
  };

  const closeBucketSelect = () => {
    setBucketOpen(false);
  };

  const chooseBucket = (next: StatsBucketId) => {
    setBucket(next);
    setBucketOpen(false);
  };

  const dropdownLeft = triggerLayout
    ? Math.max(8, triggerLayout.x + triggerLayout.width - DROPDOWN_MIN_WIDTH)
    : 0;
  const dropdownTop = triggerLayout ? triggerLayout.y + triggerLayout.height + 4 : 0;

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>История</Text>
        <View style={styles.periodSelect}>
          <Text style={styles.periodText}>За всё время</Text>
          <Text style={styles.periodDot}>·</Text>
          <View ref={triggerRef} collapsable={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Бакет графика: ${STATS_BUCKET_LABELS[bucket]}`}
              style={pressableStyle(styles.bucketSelectTrigger, {
                pressed: { opacity: 0.72 },
              })}
              onPress={() => {
                if (bucketOpen) closeBucketSelect();
                else openBucketSelect();
              }}
            >
              <Text style={styles.bucketSelectLabel}>{STATS_BUCKET_LABELS[bucket]}</Text>
              <Ionicons
                name={bucketOpen ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={bucketOpen}
        transparent
        animationType="none"
        onRequestClose={closeBucketSelect}
      >
        <View style={styles.bucketModalBackdrop}>
          <Pressable style={styles.bucketModalDismiss} onPress={closeBucketSelect} />
          <View
            style={[
              styles.bucketDropdown,
              {
                position: "absolute",
                top: dropdownTop,
                left: dropdownLeft,
                width: DROPDOWN_MIN_WIDTH,
              },
            ]}
          >
            {STATS_BUCKET_OPTIONS.map((id, index) => {
              const active = id === bucket;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={pressableStyle(
                    [
                      styles.bucketDropdownItem,
                      index === 0 && styles.bucketDropdownItemFirst,
                    ],
                    { pressed: { opacity: 0.75 } },
                  )}
                  onPress={() => chooseBucket(id)}
                >
                  <Text
                    style={[
                      styles.bucketDropdownText,
                      active && styles.bucketDropdownTextActive,
                    ]}
                  >
                    {STATS_BUCKET_LABELS[id]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {loading && points.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      ) : error ? (
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
          <Text style={[styles.periodText, { textAlign: "center" }]}>{error}</Text>
          <Pressable
            style={pressableStyle({ paddingVertical: 8, paddingHorizontal: 12 })}
            onPress={() => void reload({ force: true })}
          >
            <Text style={[styles.periodText, { color: theme.accent }]}>Повторить</Text>
          </Pressable>
        </View>
      ) : points.length === 0 ? (
        <Text style={[styles.periodText, { paddingVertical: 24, textAlign: "center" }]}>
          Пока нет тренировок
        </Text>
      ) : (
        <View
          onLayout={(e) => {
            const next = Math.round(e.nativeEvent.layout.width);
            if (next > 0 && next !== plotWidth) setPlotWidth(next);
          }}
        >
          <ScrollView
            key={chartKey}
            ref={scrollRef}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.chartScrollContent,
              { flexGrow: 1, justifyContent: "flex-end" },
            ]}
            onContentSizeChange={scrollToLatest}
            onScrollBeginDrag={closeBucketSelect}
          >
            <View style={{ width: contentWidth }}>
              <View style={styles.chartPlot}>
                {[0, 1, 2, 3, 4].map((line) => (
                  <View
                    key={line}
                    style={[
                      styles.gridLine,
                      { bottom: (CHART_HEIGHT / 4) * line },
                    ]}
                  />
                ))}

                <View style={[styles.chartBarsRow, { height: CHART_HEIGHT }]}>
                  {points.map((item, index) => {
                    const barHeight = maxValue > 0 ? (item.value / maxValue) * 104 : 0;
                    return (
                      <View
                        key={`${item.label}-${index}`}
                        style={[styles.chartColumnFixed, { width: columnWidth }]}
                      >
                        <View style={styles.barArea}>
                          {item.value > 0 ? (
                            <Text
                              style={styles.barValue}
                              numberOfLines={1}
                              {...homeStatsTextProps}
                            >
                              {Math.round(item.value)}
                            </Text>
                          ) : null}
                          <View
                            style={[
                              styles.verticalBar,
                              {
                                width: BAR_WIDTH[bucket],
                                height: Math.max(barHeight, item.value > 0 ? 4 : 0),
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.chartLabelsRow}>
                {points.map((item, index) => (
                  <View
                    key={`${item.label}-label-${index}`}
                    style={[styles.chartColumnFixed, { width: columnWidth }]}
                  >
                    <Text style={styles.axisLabel} numberOfLines={1} {...homeStatsTextProps}>
                      {item.label}
                    </Text>
                    <Text style={styles.axisYear} numberOfLines={1} {...homeStatsTextProps}>
                      {item.sublabel ?? " "}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}
