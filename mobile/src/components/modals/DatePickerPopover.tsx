/** @see ./modalDismissContract.ts */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const MONTHS_SHORT_RU = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

const WEEKDAYS_RU = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

type PickerMode = "days" | "months" | "years";

const YEAR_ROW_HEIGHT = 40;

export type DatePickerPopoverProps = {
  visible: boolean;
  selectedDate: Date | null;
  screenWidth: number;
  screenHeight: number;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
  onSelectDate: (date: Date | null) => void;
  /** Раньше этой даты выбрать нельзя (для даты рождения — ~120 лет назад). */
  minDate?: Date | null;
  /** Позже этой даты выбрать нельзя (для даты рождения — сегодня). */
  maxDate?: Date | null;
  /** «Сбросить» в режиме дней очищает выбор (null). Иначе — откат к дате при открытии. */
  allowClear?: boolean;
};

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

function AnimatedPressable({
  children,
  onPress,
  style,
  pressScale = 0.94,
}: {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: object | object[];
  pressScale?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function animateTo(value: number) {
    Animated.spring(scale, {
      toValue: value,
      speed: 35,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }

  return (
    <AnimatedPressableBase
      onPress={onPress}
      onPressIn={() => animateTo(pressScale)}
      onPressOut={() => animateTo(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressableBase>
  );
}

export default function DatePickerPopover({
  visible,
  selectedDate,
  screenWidth,
  screenHeight,
  topInset,
  bottomInset,
  onClose,
  onSelectDate,
  minDate = null,
  maxDate = null,
  allowClear = false,
}: DatePickerPopoverProps) {
  const theme = useAppTheme();
  const [viewDate, setViewDate] = useState(() => startOfMonth(selectedDate ?? new Date()));
  const [pendingDate, setPendingDate] = useState<Date | null>(selectedDate);
  const [pendingMonthIndex, setPendingMonthIndex] = useState(() => (selectedDate ?? new Date()).getMonth());
  const [pendingYear, setPendingYear] = useState(() => (selectedDate ?? new Date()).getFullYear());
  const [pickerMode, setPickerMode] = useState<PickerMode>("days");
  const yearScrollRef = useRef<ScrollView>(null);
  const daysSnapshotRef = useRef<Date | null>(null);
  const monthsSnapshotRef = useRef<{ year: number; month: number } | null>(null);
  const yearsSnapshotRef = useRef<{
    year: number;
    month: number;
    returnMode: "days" | "months";
  } | null>(null);

  const years = useMemo(() => buildYearRange(minDate, maxDate), [minDate, maxDate]);
  const calendarCells = useMemo(() => buildCalendarCells(viewDate), [viewDate]);

  useEffect(() => {
    if (!visible) return;
    const base = selectedDate ?? new Date();
    daysSnapshotRef.current = selectedDate;
    setViewDate(startOfMonth(base));
    setPendingDate(selectedDate);
    setPendingMonthIndex(base.getMonth());
    setPendingYear(base.getFullYear());
    setPickerMode("days");
    monthsSnapshotRef.current = null;
    yearsSnapshotRef.current = null;
  }, [visible, selectedDate]);

  useEffect(() => {
    if (!visible || pickerMode !== "years") return;
    const y = viewDate.getFullYear();
    const idx = years.indexOf(y);
    if (idx < 0) return;
    const t = setTimeout(() => {
      yearScrollRef.current?.scrollTo({ y: idx * YEAR_ROW_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [visible, pickerMode, viewDate, years]);

  /** Всегда по центру экрана — якорь у точки нажатия давал скачок при закрытии (anchor сбрасывался раньше visible). */
  const popoverLayout = useMemo(() => {
    const popoverWidth = 318;
    const popoverHeight = pickerMode === "days" ? 372 : 340;
    const edgePadding = 12;
    const left = Math.max(edgePadding, (screenWidth - popoverWidth) / 2);
    const maxBottom = screenHeight - bottomInset - edgePadding;
    const verticalCenter = (screenHeight - popoverHeight) / 2;
    const top = Math.min(
      Math.max(topInset + edgePadding, verticalCenter),
      maxBottom - popoverHeight,
    );
    return { left, top, width: popoverWidth };
  }, [bottomInset, pickerMode, screenHeight, screenWidth, topInset]);

  function setViewYearMonth(year: number, month: number) {
    setViewDate(new Date(year, month, 1));
    if (pendingDate) {
      setPendingDate(clampDayInMonth(year, month, pendingDate.getDate()));
    }
  }

  function openMonthsMode() {
    monthsSnapshotRef.current = {
      year: viewDate.getFullYear(),
      month: viewDate.getMonth(),
    };
    setPendingMonthIndex(viewDate.getMonth());
    setPickerMode("months");
  }

  function cancelMonthsMode() {
    const snap = monthsSnapshotRef.current;
    if (snap) {
      setViewDate(new Date(snap.year, snap.month, 1));
      setPendingMonthIndex(snap.month);
    }
    setPickerMode("days");
  }

  function applyPendingMonth() {
    const monthIndex = pendingMonthIndex;
    setViewYearMonth(viewDate.getFullYear(), monthIndex);
    setPickerMode("days");
  }

  function openYearsMode(returnMode: "days" | "months") {
    yearsSnapshotRef.current = {
      year: viewDate.getFullYear(),
      month: viewDate.getMonth(),
      returnMode,
    };
    setPendingYear(viewDate.getFullYear());
    setPickerMode("years");
  }

  function cancelYearsMode() {
    const snap = yearsSnapshotRef.current;
    if (snap) {
      setViewDate(new Date(snap.year, snap.month, 1));
      setPendingYear(snap.year);
      setPickerMode(snap.returnMode);
      return;
    }
    setPickerMode("days");
  }

  function applyPendingYear() {
    setViewYearMonth(pendingYear, viewDate.getMonth());
    const returnMode = yearsSnapshotRef.current?.returnMode ?? "days";
    setPickerMode(returnMode);
  }

  function handleApply() {
    if (pickerMode === "months") {
      applyPendingMonth();
      return;
    }
    if (pickerMode === "years") {
      applyPendingYear();
      return;
    }
    onSelectDate(pendingDate);
  }

  function handleQuickAction() {
    if (pickerMode === "months") {
      setPendingMonthIndex(new Date().getMonth());
      return;
    }
    if (pickerMode === "years") {
      setPendingYear(new Date().getFullYear());
      return;
    }
    const today = startOfDay(new Date());
    const clamped = clampDateToRange(today, minDate, maxDate) ?? today;
    setViewDate(startOfMonth(clamped));
    setPendingDate(clamped);
    setPickerMode("days");
  }

  function handleReset() {
    if (pickerMode === "months") {
      const snap = monthsSnapshotRef.current;
      if (snap) {
        setPendingMonthIndex(snap.month);
      }
      return;
    }
    if (pickerMode === "years") {
      const snap = yearsSnapshotRef.current;
      if (snap) {
        setPendingYear(snap.year);
      }
      return;
    }
    setPendingDate(allowClear ? null : daysSnapshotRef.current);
  }

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.overlay, { backgroundColor: theme.overlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { borderColor: theme.border, backgroundColor: theme.card },
            { left: popoverLayout.left, top: popoverLayout.top, width: popoverLayout.width },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.header}>
            {pickerMode === "days" ? (
              <AnimatedPressable
                style={[styles.monthNavButton, { backgroundColor: theme.cardSoft }]}
                pressScale={0.9}
                onPress={() => setViewDate((prev) => addMonths(prev, -1))}
              >
                <Ionicons name="chevron-back" size={20} color={theme.text} />
              </AnimatedPressable>
            ) : (
              <View style={styles.headerSideSpacer} />
            )}

            <View style={styles.monthYearRow}>
              {pickerMode === "years" ? (
                <Text style={[styles.headerTitle, { color: theme.text }]}>Выберите год</Text>
              ) : pickerMode === "months" ? (
                <Pressable
                  style={pressableStyle(styles.monthYearChip, {
                    pressed: { opacity: 0.75 },
                    hover: { opacity: 0.9 },
                  })}
                  onPress={() => openYearsMode("months")}
                  accessibilityRole="button"
                  accessibilityLabel="Выбрать год"
                >
                  <Text style={[styles.monthYearText, { color: theme.text }]}>{viewDate.getFullYear()}</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={pressableStyle(styles.monthYearChip, {
                      pressed: { opacity: 0.75 },
                      hover: { opacity: 0.9 },
                    })}
                    onPress={openMonthsMode}
                    accessibilityRole="button"
                    accessibilityLabel="Выбрать месяц"
                  >
                    <Text style={[styles.monthYearText, { color: theme.text }]}>
                      {MONTHS_RU[viewDate.getMonth()]}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={pressableStyle(styles.monthYearChip, {
                      pressed: { opacity: 0.75 },
                      hover: { opacity: 0.9 },
                    })}
                    onPress={() => openYearsMode("days")}
                    accessibilityRole="button"
                    accessibilityLabel="Выбрать год"
                  >
                    <Text style={[styles.monthYearText, { color: theme.text }]}>
                      {viewDate.getFullYear()}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>

            {pickerMode === "days" ? (
              <AnimatedPressable
                style={[styles.monthNavButton, { backgroundColor: theme.cardSoft }]}
                pressScale={0.9}
                onPress={() => setViewDate((prev) => addMonths(prev, 1))}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.text} />
              </AnimatedPressable>
            ) : (
              <Pressable
                style={pressableStyle([styles.monthNavButton, { backgroundColor: theme.cardSoft }], {
                  pressed: { opacity: 0.75 },
                })}
                onPress={() =>
                  pickerMode === "months" ? cancelMonthsMode() : cancelYearsMode()
                }
                accessibilityRole="button"
                accessibilityLabel="Назад к календарю"
              >
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          {pickerMode === "days" ? (
            <>
              <View style={styles.weekdaysRow}>
                {WEEKDAYS_RU.map((weekday) => (
                  <Text key={weekday} style={[styles.weekdayText, { color: theme.textMuted }]}>
                    {weekday}
                  </Text>
                ))}
              </View>

              <View style={styles.grid}>
                {calendarCells.map((cellDate, index) => {
                  if (!cellDate) {
                    return <View key={`empty-${index}`} style={styles.dayCell} />;
                  }

                  const isSelected = pendingDate ? isSameDate(cellDate, pendingDate) : false;
                  const isToday = isSameDate(cellDate, new Date());
                  const disabled = isDateOutOfRange(cellDate, minDate, maxDate);

                  return (
                    <AnimatedPressable
                      key={cellDate.toISOString()}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        isSelected && { backgroundColor: theme.accent },
                        disabled && styles.dayCellDisabled,
                      ]}
                      pressScale={0.9}
                      onPress={() => !disabled && setPendingDate(cellDate)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: theme.text },
                          isSelected && styles.dayTextSelected,
                          isSelected && { color: theme.white },
                          isToday && !isSelected && styles.dayTextToday,
                          isToday && !isSelected && { color: theme.accent },
                          disabled && { color: theme.textMuted, opacity: 0.45 },
                        ]}
                      >
                        {cellDate.getDate()}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </>
          ) : pickerMode === "months" ? (
            <View style={styles.monthGrid}>
              {MONTHS_SHORT_RU.map((label, monthIndex) => {
                const selected = monthIndex === pendingMonthIndex;
                return (
                  <Pressable
                    key={label}
                    style={pressableStyle(
                      [
                        styles.monthCell,
                        { backgroundColor: theme.cardSoft },
                        selected && { backgroundColor: theme.accent },
                      ],
                      { pressed: { opacity: 0.88 } },
                    )}
                    onPress={() => setPendingMonthIndex(monthIndex)}
                    accessibilityRole="button"
                    accessibilityLabel={MONTHS_RU[monthIndex]}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        { color: theme.text },
                        selected && { color: theme.white },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <ScrollView
              ref={yearScrollRef}
              style={styles.yearScroll}
              contentContainerStyle={styles.yearScrollContent}
              showsVerticalScrollIndicator
            >
              {years.map((year) => {
                const selected = year === pendingYear;
                return (
                  <Pressable
                    key={year}
                    style={pressableStyle(
                      [
                        styles.yearRow,
                        selected && { backgroundColor: theme.accentSoft },
                      ],
                      { pressed: { opacity: 0.88 } },
                    )}
                    onPress={() => setPendingYear(year)}
                    accessibilityRole="button"
                    accessibilityLabel={String(year)}
                  >
                    <Text
                      style={[
                        styles.yearRowText,
                        { color: theme.text },
                        selected && { color: theme.accent, fontFamily: fonts.extraBold },
                      ]}
                    >
                      {year}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <AnimatedPressable
              style={[styles.actionButton, { backgroundColor: theme.cardSoft }]}
              onPress={handleQuickAction}
              pressScale={0.95}
            >
              <Text style={[styles.actionText, { color: theme.textMuted }]}>
                {pickerMode === "months" || pickerMode === "years" ? "Текущий" : "Сегодня"}
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.actionButton, { backgroundColor: theme.cardSoft }]}
              onPress={handleReset}
              pressScale={0.95}
            >
              <Text style={[styles.actionText, { color: theme.textMuted }]}>Сбросить</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.actionButton, styles.actionPrimary, { backgroundColor: theme.accent }]}
              onPress={handleApply}
              pressScale={0.95}
            >
              <Text style={[styles.actionText, styles.actionPrimaryText, { color: theme.white }]}>
                Применить
              </Text>
            </AnimatedPressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function buildYearRange(minDate: Date | null, maxDate: Date | null): number[] {
  const now = new Date();
  const minY = minDate?.getFullYear() ?? now.getFullYear() - 100;
  const maxY = maxDate?.getFullYear() ?? now.getFullYear() + 1;
  const years: number[] = [];
  for (let y = maxY; y >= minY; y -= 1) {
    years.push(y);
  }
  return years;
}

function buildCalendarCells(monthDate: Date): (Date | null)[] {
  const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const leadingEmptyCells = (firstDayOfMonth.getDay() + 6) % 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingEmptyCells; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clampDayInMonth(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

function isDateOutOfRange(date: Date, minDate: Date | null, maxDate: Date | null): boolean {
  const t = startOfDay(date).getTime();
  if (minDate && t < startOfDay(minDate).getTime()) return true;
  if (maxDate && t > startOfDay(maxDate).getTime()) return true;
  return false;
}

function clampDateToRange(date: Date, minDate: Date | null, maxDate: Date | null): Date | null {
  const t = startOfDay(date).getTime();
  if (minDate && t < startOfDay(minDate).getTime()) return startOfDay(minDate);
  if (maxDate && t > startOfDay(maxDate).getTime()) return startOfDay(maxDate);
  return date;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(17,20,45,0.22)",
  },

  card: {
    position: "absolute",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E5EF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: "#24213A",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 10,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  monthNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F2FA",
  },

  headerSideSpacer: {
    width: 34,
    height: 34,
  },

  monthYearRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 4,
  },

  monthYearChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  monthYearText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.extraBold,
    color: "#11142D",
    letterSpacing: -0.2,
  },

  headerTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.extraBold,
    letterSpacing: -0.2,
    textAlign: "center",
  },

  weekdaysRow: {
    flexDirection: "row",
    marginBottom: 6,
  },

  weekdayText: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.bold,
    color: "#8A86A0",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },

  dayCell: {
    width: "14.2857%",
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  dayCellSelected: {},

  dayCellDisabled: {
    opacity: 0.5,
  },

  dayText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.bold,
    color: "#22233F",
  },

  dayTextSelected: {
    color: "#FFFFFF",
  },

  dayTextToday: {},

  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
    gap: 8,
    justifyContent: "space-between",
  },

  monthCell: {
    width: "31%",
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  monthCellText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.bold,
  },

  yearScroll: {
    maxHeight: 240,
    marginBottom: 10,
  },

  yearScrollContent: {
    paddingVertical: 4,
  },

  yearRow: {
    height: YEAR_ROW_HEIGHT,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  yearRowText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  actionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F1F9",
    paddingHorizontal: 10,
  },

  actionPrimary: {},

  actionText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.bold,
    color: "#5F5A78",
  },

  actionPrimaryText: {
    color: "#FFFFFF",
  },
});
