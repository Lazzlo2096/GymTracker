import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import { addCalendarDays, formatDateForApiQuery } from "@/utils/workoutListApi";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const WEEKDAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

type Props = {
  selectedDate: string;
  datesWithPlans: Set<string>;
  onSelectDate: (iso: string) => void;
};

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function PlansWeekStrip({ selectedDate, datesWithPlans, onSelectDate }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createPlansScreenStyles(theme), [theme]);

  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const date = addCalendarDays(start, index);
      const iso = formatDateForApiQuery(date);
      return {
        iso,
        dayNumber: date.getDate(),
        weekday: WEEKDAY_SHORT[date.getDay()],
        hasPlan: datesWithPlans.has(iso),
      };
    });
  }, [datesWithPlans]);

  return (
    <View style={styles.weekStrip}>
      {weekDays.map((day) => {
        const selected = day.iso === selectedDate;
        return (
          <Pressable
            key={day.iso}
            style={pressableStyle([
              styles.weekDayCell,
              selected && styles.weekDayCellSelected,
            ])}
            onPress={() => onSelectDate(day.iso)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${day.weekday}, ${day.dayNumber}`}
          >
            <Text
              style={[styles.weekDayLabel, selected && styles.weekDayLabelSelected]}
            >
              {day.weekday}
            </Text>
            <Text
              style={[styles.weekDayNumber, selected && styles.weekDayNumberSelected]}
            >
              {day.dayNumber}
            </Text>
            {day.hasPlan ? <View style={styles.weekDayDot} /> : <View style={{ height: 6 }} />}
          </Pressable>
        );
      })}
    </View>
  );
}
