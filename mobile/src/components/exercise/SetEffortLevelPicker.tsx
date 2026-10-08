import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SET_EFFORT_LEVELS, type SetEffortLevel } from "@/utils/workoutSetEffort";
import { useCatalogUi } from "@/theme/catalogUi";
import { fonts } from "@/theme/typography";

type Props = {
  value: SetEffortLevel | null;
  onChange: (value: SetEffortLevel | null) => void;
  label?: string;
};

export default function SetEffortLevelPicker({ value, onChange, label = "Нагрузка" }: Props) {
  const catalogUi = useCatalogUi();
  const styles = useMemo(() => createStyles(catalogUi), [catalogUi]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {SET_EFFORT_LEVELS.map((level) => {
          const selected = value === level;
          return (
            <Pressable
              key={level}
              style={[styles.chip, selected && styles.chipOn]}
              onPress={() => onChange(selected ? null : level)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={level}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{level}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (catalogUi: ReturnType<typeof useCatalogUi>) =>
  StyleSheet.create({
    wrap: {
      marginTop: 8,
      marginBottom: 4,
    },
    label: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: catalogUi.textMuted,
      marginBottom: 6,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: catalogUi.border,
      backgroundColor: catalogUi.cardBg,
    },
    chipOn: {
      borderColor: catalogUi.accent,
      backgroundColor: catalogUi.iconCircleBg,
    },
    chipText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: catalogUi.text,
    },
    chipTextOn: {
      color: catalogUi.accent,
    },
  });
