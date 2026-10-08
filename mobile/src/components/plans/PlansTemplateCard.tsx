import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import type { WorkoutTemplateMock } from "@/components/plans/types";
import { MetricIconCircle } from "@/components/workouts/metricIcon";
import { formatWorkoutDuration } from "@/utils/workoutListApi";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

/** Компактный чип метрики в `plans-template-meta-row` (текст 12px). */
const TEMPLATE_META_GLYPH_SIZE = 18;

type Props = {
  template: WorkoutTemplateMock;
  onOpen?: () => void;
};

function mockAction(label: string) {
  Alert.alert("Тестовые данные", `${label} — подключим к API в следующей итерации.`);
}

export default function PlansTemplateCard({ template, onOpen }: Props) {
  const theme = useAppTheme();
  const router = useRouter();
  const styles = useMemo(() => createPlansScreenStyles(theme), [theme]);

  const openTemplate = onOpen ?? (() => router.push(`/plan-template/${template.id}`));

  return (
    <Pressable
      style={pressableStyle(styles.card)}
      onPress={openTemplate}
      accessibilityRole="button"
      accessibilityLabel={`Открыть шаблон ${template.title}`}
    >
      <Text style={styles.sessionTitle} numberOfLines={2}>
        {template.title}
      </Text>

      {template.description ? (
        <Text style={styles.templateDescription} numberOfLines={2}>
          {template.description}
        </Text>
      ) : null}

      {template.gym_name ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
          <Ionicons name="location-outline" size={14} color={theme.accent} />
          <Text style={styles.sessionMeta} numberOfLines={1}>
            {template.gym_name}
          </Text>
        </View>
      ) : null}

      <View nativeID="plans-template-meta-row" style={styles.templateMetaRow}>
        <View style={styles.templateMetaItem}>
          <MetricIconCircle figmaKind="volume" size={TEMPLATE_META_GLYPH_SIZE} />
          <Text style={styles.templateMetaChip}>{template.exercises_count} упр.</Text>
        </View>
        <Text style={styles.templateMetaDot}>·</Text>
        <View style={styles.templateMetaItem}>
          <MetricIconCircle figmaKind="duration" size={TEMPLATE_META_GLYPH_SIZE} />
          <Text style={styles.templateMetaChip}>
            ~{formatWorkoutDuration(template.estimated_minutes)}
          </Text>
        </View>
        {template.last_used_label ? (
          <>
            <Text style={styles.templateMetaDot}>·</Text>
            <View style={styles.templateMetaItem}>
              <MetricIconCircle
                materialIcon="history"
                variant="violet"
                size={TEMPLATE_META_GLYPH_SIZE}
              />
              <Text style={styles.templateMetaChip}>{template.last_used_label}</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.templateActions}>
        <Pressable
          style={pressableStyle(styles.templateActionBtn)}
          onPress={() => mockAction(`Запланировать «${template.title}»`)}
        >
          <Text style={styles.templateActionText}>Запланировать</Text>
        </Pressable>
        <Pressable
          style={pressableStyle(styles.templateActionBtn)}
          onPress={() => mockAction(`Начать «${template.title}» сегодня`)}
        >
          <Text style={styles.templateActionText}>Начать</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
