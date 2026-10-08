import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch, parseErrorDetail } from "@/api/client";
import ScreenEnterFrame, { useGoBackWithScreenEnter } from "@/components/navigation/ScreenEnterFrame";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import { metricToken } from "@/components/workouts/metricIcon";
import { MODAL_FADE_MS } from "@/components/modals/modalDismissContract";
import { useGuardedFocusLoad, type GuardedFocusLoadResult } from "@/hooks/useGuardedFocusLoad";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import { fonts, type } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const CHART_HEIGHT = 210;
const CHART_PAD_TOP = 30;
const CHART_PAD_RIGHT = 16;
const CHART_PAD_BOTTOM = 34;
const CHART_PAD_LEFT = 40;

type SetEffortLevel = "легко" | "отлично" | "на грани" | "тяжело";

type ExerciseSetHistoryDay = {
  workout_date: string;
  workout_ids: number[];
  exercise_in_workout_ids: number[];
  sets_count: number;
  reps_total: number;
  tonnage_kg: number;
  max_weight_kg: number | null;
};

type ExerciseSetHistoryPoint = {
  type: "set";
  workout_date: string;
  workout_id: number;
  exercise_in_workout_id: number;
  set_number: number;
  weight_kg: number | null;
  weight_string: string | null;
  weight_composition: Record<string, unknown> | null;
  reps: number | null;
  reps_string: string | null;
  comment: string | null;
  set_seconds: number | null;
  heart_rate_right_after: number | null;
  rating: number | null;
  reached_failure: boolean | null;
  effort_level: SetEffortLevel | string | null;
};

type ExerciseSetHistory = {
  exercise_in_catalog_id: number;
  name: string;
  total_days: number;
  total_sets: number;
  days: ExerciseSetHistoryDay[];
  points: ExerciseSetHistoryPoint[];
};

type ChartPoint = {
  x: number;
  y: number;
  radius: number;
  weightKg: number;
  reps: number | null;
  comment: string | null;
  reachedFailure: boolean;
  effortLevel: SetEffortLevel | null;
  label: string;
  showLabel: boolean;
  source: ExerciseSetHistoryPoint;
};

type SetsOverTimeChartModel = {
  width: number;
  height: number;
  points: ChartPoint[];
  actualWeightGrid: { y: number; label: string }[];
};

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  if (rounded === Math.trunc(rounded)) return `${Math.trunc(rounded)} кг`;
  return `${String(rounded).replace(".", ",")} кг`;
}

function resolvePointWeightKg(point: ExerciseSetHistoryPoint): number | null {
  if (typeof point.weight_kg === "number" && Number.isFinite(point.weight_kg)) {
    return point.weight_kg;
  }
  const cached = point.weight_composition?.cached_effective_kg;
  return typeof cached === "number" && Number.isFinite(cached) ? cached : null;
}

function resolvePointWeightDisplay(point: ExerciseSetHistoryPoint): string | null {
  if (point.weight_string?.trim()) return point.weight_string.trim();
  const cached = point.weight_composition?.cached_display;
  return typeof cached === "string" && cached.trim() ? cached.trim() : null;
}

function normalizeEffortLevel(value: string | null | undefined): SetEffortLevel | null {
  if (value === "легко" || value === "отлично" || value === "на грани" || value === "тяжело") {
    return value;
  }
  return null;
}

function effortPointColor(level: SetEffortLevel | null, dark: boolean): string {
  switch (level) {
    case "легко":
      return dark ? "#86EFAC" : "#22C55E";
    case "отлично":
      return dark ? "#93C5FD" : "#3B82F6";
    case "на грани":
      return dark ? "#FCD34D" : "#D97706";
    case "тяжело":
      return dark ? "#FCA5A5" : "#EF4444";
    default:
      return metricToken("violet", dark).fg;
  }
}

function buildSetsOverTimeChart(
  points: ExerciseSetHistoryPoint[],
  chartWidth: number,
): SetsOverTimeChartModel | null {
  if (chartWidth <= 0 || points.length === 0) return null;

  const weighted = points.filter((point) => resolvePointWeightKg(point) != null);
  if (weighted.length === 0) return null;

  const width = Math.max(chartWidth, 1);
  const plotWidth = Math.max(1, width - CHART_PAD_LEFT - CHART_PAD_RIGHT);
  const plotHeight = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const weights = weighted
    .map(resolvePointWeightKg)
    .filter((value): value is number => value != null);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const span = rawMax - rawMin;
  const pad = span > 0 ? Math.max(1, span * 0.12) : 1;
  const domainMin = Math.max(0, rawMin - pad);
  const domainMax = rawMax + pad;
  const domainSpan = domainMax - domainMin || 1;
  const firstIndexByDate = new Map<string, number>();
  weighted.forEach((point, index) => {
    if (!firstIndexByDate.has(point.workout_date)) {
      firstIndexByDate.set(point.workout_date, index);
    }
  });

  const toX = (index: number) =>
    weighted.length === 1
      ? CHART_PAD_LEFT + plotWidth / 2
      : CHART_PAD_LEFT + (index / (weighted.length - 1)) * plotWidth;

  const toY = (weightKg: number) =>
    CHART_PAD_TOP + ((domainMax - weightKg) / domainSpan) * plotHeight;

  const chartPoints = weighted.map((point, index): ChartPoint => {
    const reps = typeof point.reps === "number" && Number.isFinite(point.reps) ? point.reps : null;
    return {
      x: toX(index),
      y: toY(resolvePointWeightKg(point) as number),
      radius: reps != null ? Math.max(4, Math.min(7, 3.5 + reps / 6)) : 4.5,
      weightKg: resolvePointWeightKg(point) as number,
      reps,
      comment: typeof point.comment === "string" && point.comment.trim() ? point.comment.trim() : null,
      reachedFailure: point.reached_failure === true,
      effortLevel: normalizeEffortLevel(point.effort_level),
      label: formatDateLabel(point.workout_date),
      showLabel: firstIndexByDate.get(point.workout_date) === index,
      source: point,
    };
  });

  const actualWeightGrid = Array.from(new Set(weights.map((value) => Math.round(value * 10) / 10)))
    .sort((a, b) => a - b)
    .map((value) => ({
      y: toY(value),
      label: value === Math.trunc(value) ? String(Math.trunc(value)) : String(value).replace(".", ","),
    }));

  return { width, height: CHART_HEIGHT, points: chartPoints, actualWeightGrid };
}

export default function ExerciseSetsHistoryScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalogId = Number(id);
  const goBack = useGoBackWithScreenEnter(
    Number.isFinite(catalogId) && catalogId > 0
      ? `/exercise-in-catalog/${catalogId}`
      : "/exercise_catalog",
  );
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 400 ? 20 : 16;
  const [history, setHistory] = useState<ExerciseSetHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<ExerciseSetHistoryPoint | null>(null);
  const [pointDetailVisible, setPointDetailVisible] = useState(false);

  const loadHistory = useCallback(async (): Promise<GuardedFocusLoadResult<ExerciseSetHistory>> => {
    const response = await apiFetch(`/api/v1/exercises_in_catalog/${catalogId}/set_history`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(parseErrorDetail(payload));
    }
    return { kind: "success", data: payload as ExerciseSetHistory };
  }, [catalogId]);

  const { loading, reload } = useGuardedFocusLoad({
    enabled: Number.isFinite(catalogId) && catalogId > 0,
    load: loadHistory,
    onSuccess: (data) => {
      setHistory(data);
      setError(null);
    },
    onError: (message) => {
      setHistory(null);
      setError(message);
    },
    onDisabled: () => {
      setHistory(null);
      setError("Некорректный id упражнения");
    },
  });

  const days = history?.days ?? [];
  const newestFirstDays = useMemo(() => [...days].reverse(), [days]);
  const points = history?.points ?? [];
  const chartModel = useMemo(
    () => buildSetsOverTimeChart(points, chartWidth),
    [chartWidth, points],
  );
  const maxWeight = useMemo(() => {
    const weights = days
      .map((day) => day.max_weight_kg)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return weights.length ? Math.max(...weights) : null;
  }, [days]);
  const totalTonnage = useMemo(
    () => days.reduce((sum, day) => sum + (Number.isFinite(day.tonnage_kg) ? day.tonnage_kg : 0), 0),
    [days],
  );
  const openPointDetail = useCallback((point: ExerciseSetHistoryPoint) => {
    setSelectedPoint(point);
    setPointDetailVisible(true);
  }, []);
  const closePointDetail = useCallback(() => {
    setPointDetailVisible(false);
  }, []);

  React.useEffect(() => {
    if (pointDetailVisible || !selectedPoint) return;
    const timer = setTimeout(() => {
      setSelectedPoint(null);
    }, MODAL_FADE_MS);
    return () => clearTimeout(timer);
  }, [pointDetailVisible, selectedPoint]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <ScreenEnterFrame>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: horizontalPadding, paddingBottom: 32 },
          ]}
        >
          <View style={styles.header}>
            <ScreenTitleRowIconButton onPress={() => goBack()} accessibilityLabel="Назад" hitSlop={12}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={metricToken("violet", theme.dark).fg}
              />
            </ScreenTitleRowIconButton>

            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                График подходов
              </Text>
            </View>

            <ScreenTitleRowIconButton
              onPress={() => void reload({ force: true })}
              accessibilityLabel="Обновить"
              hitSlop={12}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={22}
                color={metricToken("violet", theme.dark).fg}
              />
            </ScreenTitleRowIconButton>
          </View>

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={styles.stateText}>Загружаем историю…</Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Не удалось загрузить график</Text>
              <Text style={styles.stateText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={() => void reload({ force: true })}>
                <Text style={styles.retryButtonText}>Повторить</Text>
              </Pressable>
            </View>
          ) : history && points.length > 0 ? (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIcon}>
                    <MaterialCommunityIcons
                      name="chart-bar"
                      size={24}
                      color={metricToken("violet", theme.dark).fg}
                    />
                  </View>
                  <View style={styles.heroTextBlock}>
                    <Text style={styles.exerciseName} numberOfLines={2}>
                      {history.name}
                    </Text>
                    <Text style={styles.heroSubtitle}>
                      {history.total_days} раза · {history.total_sets} подх.
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <MetricCell label="Раз" value={String(history.total_days)} />
                  <MetricCell label="Подх." value={String(history.total_sets)} />
                  <MetricCell label="Макс." value={formatKg(maxWeight)} />
                  <MetricCell label="Тоннаж" value={formatKg(totalTonnage)} />
                </View>
              </View>

              <View style={styles.chartCard}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Вес и повторы во времени</Text>
                  <Text style={styles.cardHint}>точка = подход</Text>
                </View>
                <Text style={styles.chartLegend}>
                  Высота точки — вес, число рядом — повторы.
                </Text>
                <View style={styles.legendWrap}>
                  <LegendItem color={effortPointColor("легко", theme.dark)} label="легко" />
                  <LegendItem color={effortPointColor("отлично", theme.dark)} label="отлично" />
                  <LegendItem color={effortPointColor("на грани", theme.dark)} label="на грани" />
                  <LegendItem color={effortPointColor("тяжело", theme.dark)} label="тяжело" />
                  <LegendItem
                    color={theme.danger}
                    label="отказ"
                    outline
                  />
                </View>
                <View
                  style={styles.chartWrap}
                  onLayout={(event) => {
                    const nextWidth = Math.round(event.nativeEvent.layout.width);
                    if (nextWidth > 0) {
                      setChartWidth((prev) => (prev === nextWidth ? prev : nextWidth));
                    }
                  }}
                >
                  {chartModel ? (
                    <SetsOverTimeChart
                      model={chartModel}
                      theme={theme}
                      onPointPress={openPointDetail}
                    />
                  ) : null}
                </View>
              </View>

              <View style={styles.daysList}>
                <Text style={styles.cardTitle}>Дни</Text>
                {newestFirstDays.map((day) => {
                  const workoutId = day.workout_ids[0];
                  const canOpenWorkout = Number.isFinite(workoutId);
                  return (
                    <Pressable
                      key={day.workout_date}
                      style={pressableStyle(styles.dayCard, {
                        pressed: canOpenWorkout ? { opacity: 0.9 } : undefined,
                      })}
                      disabled={!canOpenWorkout}
                      onPress={() => {
                        if (canOpenWorkout) router.push(`/workout/${workoutId}`);
                      }}
                      accessibilityRole={canOpenWorkout ? "button" : undefined}
                      accessibilityLabel={`Открыть тренировку за ${formatDateLabel(day.workout_date)}`}
                    >
                      <View style={styles.dayMain}>
                        <Text style={styles.dayTitle}>{formatDateLabel(day.workout_date)}</Text>
                        <Text style={styles.daySub}>
                          {day.sets_count} подх. · {day.reps_total} повт.
                        </Text>
                      </View>
                      <View style={styles.dayMeta}>
                        <View style={styles.dayMetaLine}>
                          <Text style={styles.dayMetaLabel}>тоннаж</Text>
                          <Text style={styles.dayMetaValue}>{formatKg(day.tonnage_kg)}</Text>
                        </View>
                        <View style={styles.dayMetaLine}>
                          <Text style={styles.dayMetaLabel}>макс.</Text>
                          <Text style={styles.dayMetaValue}>{formatKg(day.max_weight_kg)}</Text>
                        </View>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={theme.textMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Подходов пока нет</Text>
              <Text style={styles.stateText}>
                Когда это упражнение появится в тренировках, здесь будет график веса и повторов.
              </Text>
            </View>
          )}
        </ScrollView>
        {selectedPoint ? (
          <SetPointDetailModal
            visible={pointDetailVisible}
            point={selectedPoint}
            onClose={closePointDetail}
            onDismiss={() => setSelectedPoint(null)}
          />
        ) : null}
      </ScreenEnterFrame>
    </SafeAreaView>
  );
}

function SetsOverTimeChart({
  model,
  theme,
  onPointPress,
}: {
  model: SetsOverTimeChartModel;
  theme: ReturnType<typeof useAppTheme>;
  onPointPress: (point: ExerciseSetHistoryPoint) => void;
}) {
  const gridColor = theme.dark ? "#3A314B" : "#ECEAF2";
  const pointStroke = theme.dark ? "#F5F3FF" : "#FFFFFF";
  const textColor = theme.textMuted;
  const failureColor = theme.danger;

  return (
    <View style={{ height: model.height }}>
      <Svg width="100%" height={model.height} viewBox={`0 0 ${model.width} ${model.height}`}>
        {model.actualWeightGrid.map((line) => (
          <React.Fragment key={`actual-${line.label}`}>
            <Line
              x1={CHART_PAD_LEFT}
              y1={line.y}
              x2={model.width - CHART_PAD_RIGHT}
              y2={line.y}
              stroke={gridColor}
              strokeWidth="1"
            />
            <SvgText
              x={CHART_PAD_LEFT - 8}
              y={line.y + 4}
              fill={textColor}
              fontSize="10"
              fontFamily={fonts.semiBold}
              textAnchor="end"
            >
              {line.label}кг
            </SvgText>
          </React.Fragment>
        ))}

        {model.points.map((point, index) => {
          const repsLabelY = Math.max(12, point.y - point.radius - 6);
          return (
            <React.Fragment key={`${point.label}-${index}-${point.x}`}>
              <Circle
                cx={point.x}
                cy={point.y}
                r={point.radius}
                fill={effortPointColor(point.effortLevel, theme.dark)}
                stroke={point.reachedFailure ? failureColor : pointStroke}
                strokeWidth={point.reachedFailure ? "3" : "2"}
              />
              <SvgText
                x={point.x}
                y={repsLabelY}
                fill={point.reachedFailure ? failureColor : textColor}
                fontSize="10"
                fontFamily={fonts.semiBold}
                fontWeight="700"
                textAnchor="middle"
              >
                {point.reachedFailure ? `${point.reps ?? "—"}!` : (point.reps ?? "—")}
              </SvgText>
              {point.comment ? (
                <Circle
                  cx={point.x + 9}
                  cy={repsLabelY - 3}
                  r={2.2}
                  fill={theme.accent}
                  stroke={pointStroke}
                  strokeWidth="1"
                />
              ) : null}
              {point.showLabel ? (
                <SvgText
                  x={point.x}
                  y={model.height - 10}
                  fill={textColor}
                  fontSize="10"
                  fontFamily={fonts.semiBold}
                  textAnchor="middle"
                >
                  {point.label}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {model.points.map((point, index) => {
          const hitSize = Math.max(28, point.radius * 3);
          return (
            <Pressable
              key={`hit-${point.label}-${index}-${point.x}`}
              style={{
                position: "absolute",
                left: point.x - hitSize / 2,
                top: point.y - hitSize / 2,
                width: hitSize,
                height: hitSize,
                borderRadius: hitSize / 2,
              }}
              onPress={() => onPointPress(point.source)}
              accessibilityRole="button"
              accessibilityLabel={`Открыть детали подхода ${point.source.set_number}`}
            />
          );
        })}
      </View>
    </View>
  );
}

function formatPointDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs} сек`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatBoolean(value: boolean | null): string {
  if (value == null) return "—";
  return value ? "Да" : "Нет";
}

function formatPointWeight(point: ExerciseSetHistoryPoint): string {
  const resolvedWeight = resolvePointWeightKg(point);
  const resolvedDisplay = resolvePointWeightDisplay(point);
  const parts = [
    resolvedWeight != null ? formatKg(resolvedWeight) : null,
    resolvedDisplay,
  ].filter((item): item is string => Boolean(item));
  return parts.length ? parts.join(" · ") : "—";
}

function formatPointReps(point: ExerciseSetHistoryPoint): string {
  const parts = [
    point.reps != null ? String(point.reps) : null,
    point.reps_string?.trim() || null,
  ].filter((item): item is string => Boolean(item));
  return parts.length ? parts.join(" · ") : "—";
}

function formatPlainKg(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  if (rounded === Math.trunc(rounded)) return String(Math.trunc(rounded));
  return String(rounded).replace(".", ",");
}

function numberFromUnknown(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compositionTerms(composition: Record<string, unknown> | null): Record<string, unknown>[] {
  const terms = composition?.terms;
  return Array.isArray(terms)
    ? terms.filter((term): term is Record<string, unknown> => Boolean(term) && typeof term === "object")
    : [];
}

function plateKgsLabel(kgs: unknown): string {
  if (!Array.isArray(kgs)) return "—";
  const values = kgs.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.map((value) => `${formatPlainKg(value)} кг`).join(" + ") : "—";
}

function compositionTermView(term: Record<string, unknown>, index: number): {
  key: string;
  title: string;
  value: string;
  subtitle: string | null;
} {
  const kind = term.kind;
  if (kind === "bodyweight") {
    const value =
      numberFromUnknown(term.cached_bodyweight_kg) ?? numberFromUnknown(term.user_entered_bodyweight_kg);
    const source = term.source === "user_entered_now" ? "введён вручную" : "из дневника веса";
    return {
      key: `bodyweight-${index}`,
      title: "Собственный вес",
      value: value != null ? `${formatPlainKg(value)} кг` : "—",
      subtitle: source,
    };
  }
  if (kind === "plates") {
    const meta = term.meta && typeof term.meta === "object" ? term.meta as Record<string, unknown> : null;
    const placement = typeof meta?.placement === "string" && meta.placement.trim()
      ? meta.placement.trim()
      : "блины";
    const mirror = term.mirror === true;
    return {
      key: `plates-${index}`,
      title: placement,
      value: plateKgsLabel(term.kgs),
      subtitle: mirror ? "зеркально ×2" : null,
    };
  }
  if (kind === "bar") {
    const meta = term.meta && typeof term.meta === "object" ? term.meta as Record<string, unknown> : null;
    const label = typeof meta?.label === "string" && meta.label.trim() ? meta.label.trim() : "Гриф";
    const barKg = numberFromUnknown(term.bar_kg);
    return {
      key: `bar-${index}`,
      title: label,
      value: barKg != null ? `${formatPlainKg(barKg)} кг` : "—",
      subtitle: null,
    };
  }
  return {
    key: `unknown-${index}`,
    title: typeof kind === "string" && kind.trim() ? kind.trim() : "Компонент",
    value: "—",
    subtitle: null,
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function WeightCompositionDetail({ composition }: { composition: Record<string, unknown> | null }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const terms = compositionTerms(composition);
  const cachedDisplay = typeof composition?.cached_display === "string" ? composition.cached_display.trim() : "";
  const cachedKg = numberFromUnknown(composition?.cached_effective_kg);

  return (
    <View style={styles.compositionBox}>
      <View style={styles.compositionHeader}>
        <View style={styles.compositionIcon}>
          <MaterialCommunityIcons name="scale" size={18} color={theme.accent} />
        </View>
        <View style={styles.compositionHeaderText}>
          <Text style={styles.compositionTitle}>Состав веса</Text>
          <Text style={styles.compositionTotal}>
            {cachedKg != null ? `${formatPlainKg(cachedKg)} кг` : "—"}
          </Text>
        </View>
      </View>
      {cachedDisplay ? <Text style={styles.compositionDisplay}>{cachedDisplay}</Text> : null}
      {terms.length ? (
        <View style={styles.compositionTerms}>
          {terms.map((term, index) => {
            const view = compositionTermView(term, index);
            return (
              <View key={view.key} style={styles.compositionTermRow}>
                <View style={styles.compositionTermText}>
                  <Text style={styles.compositionTermTitle}>{view.title}</Text>
                  {view.subtitle ? (
                    <Text style={styles.compositionTermSubtitle}>{view.subtitle}</Text>
                  ) : null}
                </View>
                <Text style={styles.compositionTermValue}>{view.value}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.compositionEmpty}>Состав веса не задан</Text>
      )}
    </View>
  );
}

function SetPointDetailModal({
  visible,
  point,
  onClose,
  onDismiss,
}: {
  visible: boolean;
  point: ExerciseSetHistoryPoint;
  onClose: () => void;
  onDismiss: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const comment = point.comment?.trim() || "";

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={Platform.OS === "ios" ? onDismiss : undefined}
    >
      <View style={styles.detailModalRoot}>
        <Pressable style={styles.detailBackdrop} onPress={onClose} />
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons
                name="dumbbell"
                size={20}
                color={metricToken("violet", theme.dark).fg}
              />
            </View>
            <View style={styles.detailTitleBlock}>
              <Text style={styles.detailTitle}>Подход {point.set_number}</Text>
              <Text style={styles.detailSubtitle}>{formatPointDate(point.workout_date)}</Text>
            </View>
          </View>

          <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <DetailRow label="Вес" value={formatPointWeight(point)} />
            <DetailRow label="Повторы" value={formatPointReps(point)} />
            <DetailRow label="Нагрузка" value={normalizeEffortLevel(point.effort_level) ?? "—"} />
            <DetailRow label="Был отказ" value={formatBoolean(point.reached_failure)} />
            <DetailRow label="Длительность" value={formatDuration(point.set_seconds)} />
            <DetailRow
              label="Пульс после"
              value={point.heart_rate_right_after != null ? String(point.heart_rate_right_after) : "—"}
            />
            <DetailRow label="Оценка" value={point.rating != null ? String(point.rating) : "—"} />
            <WeightCompositionDetail composition={point.weight_composition} />
            <View style={styles.detailCommentBox}>
              <Text style={styles.detailLabel}>Комментарий</Text>
              <Text style={styles.detailCommentText} selectable>
                {comment || "—"}
              </Text>
            </View>
          </ScrollView>

          <Pressable
            style={pressableStyle(styles.detailCloseButton, { pressed: { opacity: 0.88 } })}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Закрыть детали подхода"
          >
            <Text style={styles.detailCloseText}>Закрыть</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function LegendItem({
  color,
  label,
  outline = false,
}: {
  color: string;
  label: string;
  outline?: boolean;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          outline
            ? { borderColor: color, backgroundColor: "transparent" }
            : { backgroundColor: color, borderColor: color },
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      paddingTop: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 6,
    },
    headerTitleBlock: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 8,
    },
    headerTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontFamily: fonts.extraBold,
      color: theme.text,
      letterSpacing: -0.55,
    },
    stateCard: {
      minHeight: 180,
      borderRadius: PLAQUE_RADIUS,
      backgroundColor: theme.card,
      padding: 18,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    stateTitle: {
      ...type.section,
      color: theme.textMuted,
      textAlign: "center",
    },
    stateText: {
      ...type.body,
      color: theme.textMuted,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.accentSoft,
    },
    retryButtonText: {
      ...type.button,
      color: theme.accent,
    },
    heroCard: {
      borderRadius: PLAQUE_RADIUS,
      backgroundColor: theme.card,
      padding: 16,
      marginBottom: 14,
      shadowColor: "#24213A",
      shadowOpacity: 0.05,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accentSoft,
    },
    heroTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    exerciseName: {
      fontFamily: fonts.extraBold,
      fontSize: 18,
      lineHeight: 24,
      color: theme.text,
      letterSpacing: -0.35,
    },
    heroSubtitle: {
      marginTop: 2,
      ...type.caption,
      color: theme.textMuted,
    },
    statsRow: {
      flexDirection: "row",
      gap: 8,
    },
    metricCell: {
      flex: 1,
      minWidth: 0,
      borderRadius: 14,
      backgroundColor: theme.cardSoft,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    metricValue: {
      ...type.statTileValue,
      color: theme.text,
    },
    metricLabel: {
      marginTop: 2,
      ...type.statTileLabel,
      color: theme.textMuted,
    },
    chartCard: {
      borderRadius: PLAQUE_RADIUS,
      backgroundColor: theme.card,
      padding: 16,
      marginBottom: 14,
      shadowColor: "#24213A",
      shadowOpacity: 0.05,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 8,
    },
    cardTitle: {
      fontFamily: fonts.bold,
      fontSize: 16,
      lineHeight: 22,
      color: theme.text,
    },
    cardHint: {
      ...type.caption,
      color: theme.textMuted,
    },
    chartLegend: {
      marginTop: -2,
      marginBottom: 8,
      ...type.caption,
      color: theme.textMuted,
    },
    legendWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
    },
    legendText: {
      ...type.caption,
      color: theme.textMuted,
    },
    chartWrap: {
      minHeight: CHART_HEIGHT,
    },
    daysList: {
      gap: 8,
    },
    dayCard: {
      minHeight: 68,
      borderRadius: 16,
      backgroundColor: theme.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    dayMain: {
      flex: 1,
      minWidth: 0,
    },
    dayTitle: {
      fontFamily: fonts.bold,
      fontSize: 15,
      lineHeight: 20,
      color: theme.text,
    },
    daySub: {
      marginTop: 2,
      ...type.caption,
      color: theme.textMuted,
    },
    dayMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 12,
      minWidth: 132,
    },
    dayMetaLine: {
      alignItems: "flex-end",
    },
    dayMetaValue: {
      ...type.statTileValue,
      color: theme.text,
    },
    dayMetaLabel: {
      ...type.caption,
      color: theme.textMuted,
    },
    detailModalRoot: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      paddingVertical: 24,
    },
    detailBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.overlay,
    },
    detailCard: {
      width: "100%",
      maxWidth: 440,
      maxHeight: "88%",
      borderRadius: PLAQUE_RADIUS,
      backgroundColor: theme.card,
      padding: 16,
      shadowColor: "#24213A",
      shadowOpacity: 0.16,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    detailHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    detailIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accentSoft,
    },
    detailTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    detailTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 18,
      lineHeight: 24,
      color: theme.text,
    },
    detailSubtitle: {
      marginTop: 2,
      ...type.caption,
      color: theme.textMuted,
    },
    detailScroll: {
      maxHeight: 420,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    detailLabel: {
      ...type.label,
      color: theme.textMuted,
      flexShrink: 0,
    },
    detailValue: {
      ...type.bodyMedium,
      color: theme.text,
      flex: 1,
      minWidth: 0,
      textAlign: "right",
    },
    compositionBox: {
      marginTop: 10,
      borderRadius: 14,
      backgroundColor: theme.bg,
      padding: 12,
      gap: 10,
    },
    compositionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    compositionIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accentSoft,
    },
    compositionHeaderText: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 10,
    },
    compositionTitle: {
      ...type.label,
      color: theme.textMuted,
    },
    compositionTotal: {
      ...type.statTileValue,
      color: theme.text,
    },
    compositionDisplay: {
      ...type.bodyMedium,
      color: theme.text,
    },
    compositionTerms: {
      gap: 6,
    },
    compositionTermRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    compositionTermText: {
      flex: 1,
      minWidth: 0,
    },
    compositionTermTitle: {
      ...type.bodyMedium,
      color: theme.text,
    },
    compositionTermSubtitle: {
      marginTop: 1,
      ...type.caption,
      color: theme.textMuted,
    },
    compositionTermValue: {
      ...type.bodyMedium,
      color: theme.text,
      textAlign: "right",
      flexShrink: 0,
    },
    compositionEmpty: {
      ...type.body,
      color: theme.textMuted,
    },
    detailCommentBox: {
      paddingTop: 10,
      gap: 6,
    },
    detailCommentText: {
      ...type.body,
      color: theme.text,
      backgroundColor: theme.bg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
    },
    detailCloseButton: {
      marginTop: 14,
      minHeight: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accentSoft,
    },
    detailCloseText: {
      ...type.button,
      color: theme.accent,
    },
  });
