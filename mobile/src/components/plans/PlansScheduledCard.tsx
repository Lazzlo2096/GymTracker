import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import {
  formatPlannedSessionSource,
  formatPlannedSessionStatus,
  isPlannedSessionReady,
} from "@/components/plans/plannedSessionFormat";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import type { PlannedSession } from "@/components/plans/types";
import ActiveStatusDot from "@/components/ui/ActiveStatusDot";
import { formatWorkoutDuration } from "@/utils/workoutListApi";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

type Props = {
  session: PlannedSession;
};

function mockAction(label: string) {
  Alert.alert("Тестовые данные", `${label} — подключим к API в следующей итерации.`);
}

export default function PlansScheduledCard({ session }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createPlansScreenStyles(theme), [theme]);
  const isReady = isPlannedSessionReady(session.status);
  const inProgress = session.status === "in_progress";

  return (
    <View style={styles.card}>
      <View style={styles.sessionCardTop}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          {inProgress ? <ActiveStatusDot visible /> : null}
          <Text style={styles.sessionTitle} numberOfLines={2}>
            {session.title}
          </Text>
        </View>
      </View>

      {session.gym_name ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <Ionicons name="location-outline" size={14} color={theme.accent} />
          <Text style={styles.sessionMeta} numberOfLines={1}>
            {session.gym_name}
          </Text>
        </View>
      ) : null}

      <Text style={styles.sessionMeta}>
        {session.exercises_count} упр. · ~{formatWorkoutDuration(session.estimated_minutes)}
      </Text>

      {session.source ? (
        <Text style={styles.sessionSource} numberOfLines={1}>
          {formatPlannedSessionSource(session.source)}
        </Text>
      ) : null}

      <View style={[styles.statusPill, isReady && styles.statusPillReady]}>
        <Text style={[styles.statusPillText, isReady && styles.statusPillTextReady]}>
          {formatPlannedSessionStatus(session.status)}
        </Text>
      </View>

      <View style={styles.sessionActions}>
        <Pressable
          style={pressableStyle(styles.actionButton)}
          onPress={() => mockAction(`Открыть «${session.title}»`)}
        >
          <Text style={styles.actionButtonText}>Открыть</Text>
        </Pressable>
        <Pressable
          style={pressableStyle([styles.actionButton, styles.actionButtonPrimary])}
          onPress={() => mockAction(`Начать «${session.title}»`)}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
            Начать
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type QuickProps = {
  onTomorrow: () => void;
  onFromTemplate: () => void;
  onNewPlan: () => void;
};

export function PlansQuickActionsRow({ onTomorrow, onFromTemplate, onNewPlan }: QuickProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createPlansScreenStyles(theme), [theme]);

  return (
    <View style={styles.quickActionsRow}>
      <Pressable style={pressableStyle(styles.quickAction)} onPress={onTomorrow}>
        <MaterialCommunityIcons name="calendar-plus" size={22} color={theme.accent} />
        <Text style={styles.quickActionLabel}>Завтра</Text>
        <Text style={styles.quickActionSub}>быстрый план</Text>
      </Pressable>
      <Pressable style={pressableStyle(styles.quickAction)} onPress={onFromTemplate}>
        <MaterialCommunityIcons name="file-document-outline" size={22} color={theme.accent} />
        <Text style={styles.quickActionLabel}>Шаблон</Text>
        <Text style={styles.quickActionSub}>на дату</Text>
      </Pressable>
      <Pressable style={pressableStyle(styles.quickAction)} onPress={onNewPlan}>
        <Ionicons name="add-circle-outline" size={22} color={theme.accent} />
        <Text style={styles.quickActionLabel}>Новый</Text>
        <Text style={styles.quickActionSub}>план</Text>
      </Pressable>
    </View>
  );
}
