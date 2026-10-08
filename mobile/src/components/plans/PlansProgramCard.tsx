import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { trace, traceSpanEnd, traceSpanStart } from "@/debug/traceLog";
import { createPlansScreenStyles } from "@/components/plans/plansScreenStyles";
import { formatProgramSummary, mapProgramDaysToView } from "@/components/plans/programFormat";
import PlansProgramActionIcons from "@/components/plans/PlansProgramActionIcons";
import type { CurrentProgram, WorkoutTemplateMock } from "@/components/plans/types";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const EXPAND_MS = 300;
const EXPAND_EASING = Easing.bezier(0.22, 0.78, 0.24, 1);
const USE_NATIVE_CHROME = Platform.OS !== "web";

type Props = {
  program: CurrentProgram;
  templates: WorkoutTemplateMock[];
  expanded: boolean;
  isCurrent?: boolean;
  onToggle: () => void;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export default function PlansProgramCard({
  program,
  templates,
  expanded,
  isCurrent = false,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createPlansScreenStyles(theme), [theme]);
  const summary = formatProgramSummary(program);
  const dayRows = useMemo(
    () => mapProgramDaysToView(program, templates),
    [program, templates],
  );

  const chromeAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const bodyHeightAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const bodyHeightRef = useRef(0);
  const [bodyHeight, setBodyHeight] = useState(0);
  const mountedRef = useRef(false);
  const prevExpandedRef = useRef(expanded);
  const pendingExpandRef = useRef(false);
  const activeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const expandSpanRef = useRef<string | null>(null);

  const runExpandAnimation = useCallback(
    (toExpanded: boolean) => {
      activeAnimationRef.current?.stop();
      if (expandSpanRef.current) {
        traceSpanEnd(expandSpanRef.current, { cancelled: true, programId: program.id });
        expandSpanRef.current = null;
      }

      expandSpanRef.current = traceSpanStart("PERF", "programCard.expand", {
        programId: program.id,
        expanded: toExpanded,
        bodyHeight: bodyHeightRef.current,
      });

      const chromeAnimation = Animated.timing(chromeAnim, {
        toValue: toExpanded ? 1 : 0,
        duration: EXPAND_MS,
        easing: EXPAND_EASING,
        useNativeDriver: USE_NATIVE_CHROME,
      });

      const bodyAnimation = Animated.timing(bodyHeightAnim, {
        toValue: toExpanded ? 1 : 0,
        duration: EXPAND_MS,
        easing: EXPAND_EASING,
        useNativeDriver: false,
      });

      const animation = Animated.parallel([chromeAnimation, bodyAnimation]);
      activeAnimationRef.current = animation;
      animation.start(({ finished }) => {
        activeAnimationRef.current = null;
        if (expandSpanRef.current) {
          traceSpanEnd(expandSpanRef.current, { finished, programId: program.id });
          expandSpanRef.current = null;
        }
      });
    },
    [bodyHeightAnim, chromeAnim, program.id],
  );

  const tryRunPendingExpand = useCallback(() => {
    if (!pendingExpandRef.current || !expanded || bodyHeightRef.current <= 0) return;
    pendingExpandRef.current = false;
    runExpandAnimation(true);
  }, [expanded, runExpandAnimation]);

  useLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevExpandedRef.current = expanded;
      chromeAnim.setValue(expanded ? 1 : 0);
      bodyHeightAnim.setValue(expanded ? 1 : 0);
      return;
    }

    if (prevExpandedRef.current === expanded) return;

    prevExpandedRef.current = expanded;

    if (expanded && bodyHeightRef.current <= 0) {
      pendingExpandRef.current = true;
      trace("PERF", "programCard.expand waiting measure", { programId: program.id });
      return;
    }

    pendingExpandRef.current = false;
    runExpandAnimation(expanded);
  }, [bodyHeightAnim, chromeAnim, expanded, program.id, runExpandAnimation]);

  useLayoutEffect(
    () => () => {
      activeAnimationRef.current?.stop();
      if (expandSpanRef.current) {
        traceSpanEnd(expandSpanRef.current, { cancelled: true, programId: program.id });
        expandSpanRef.current = null;
      }
    },
    [program.id],
  );

  const bodyAnimatedHeight = bodyHeightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(bodyHeight, 1)],
  });

  const bodyOpacity = bodyHeightAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.5, 1],
  });

  const summaryOpacity = chromeAnim.interpolate({
    inputRange: [0, 0.2],
    outputRange: [1, 0],
  });

  const chevronRotate = chromeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const bodyContent = (
    <>
      <Text style={styles.programCatalogSummary}>{summary}</Text>
      {dayRows.map((day) => (
        <View key={day.key} style={styles.programRow}>
          <Text style={styles.programWeekday}>{day.weekdayShort}</Text>
          <View style={styles.programBody}>
            <Text
              style={[
                styles.programTitle,
                !day.enabled && styles.programTitleMuted,
              ]}
              numberOfLines={1}
            >
              {day.templateTitle}
            </Text>
          </View>
          {day.enabled ? (
            <MaterialCommunityIcons name="dumbbell" size={18} color={theme.accent} />
          ) : null}
        </View>
      ))}

      {!isCurrent && onSelect ? (
        <Pressable
          style={pressableStyle([
            styles.actionButton,
            styles.actionButtonPrimary,
            { marginTop: 8 },
          ])}
          onPress={onSelect}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
            Выбрать программу
          </Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <View
      style={[
        styles.programCatalogCard,
        isCurrent && styles.programCatalogCardCurrent,
        expanded && styles.programCatalogCardExpanded,
      ]}
    >
      <View style={styles.programCatalogHeader}>
        <View style={styles.programCatalogTitleRow}>
          <Pressable
            style={pressableStyle({ flex: 1, minWidth: 0 })}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`Программа ${program.name}, ${summary}`}
          >
            <View style={styles.programCatalogTitleInner}>
              <Text style={styles.programCatalogTitle} numberOfLines={expanded ? undefined : 2}>
                {program.name}
              </Text>
              {isCurrent ? (
                <View style={styles.programCurrentBadge}>
                  <Text style={styles.programCurrentBadgeText}>Текущая</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
          {expanded ? (
            <PlansProgramActionIcons onEdit={onEdit} onDelete={onDelete} />
          ) : null}
          <Pressable
            onPress={onToggle}
            hitSlop={8}
            style={pressableStyle(styles.programCatalogChevronHit)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Свернуть программу" : "Развернуть программу"}
          >
            <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
              <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
            </Animated.View>
          </Pressable>
        </View>
        <Pressable onPress={onToggle} accessibilityRole="button">
          <Animated.Text
            style={[styles.programCatalogSummary, { opacity: summaryOpacity }]}
            numberOfLines={2}
            pointerEvents="none"
          >
            {summary}
          </Animated.Text>
        </Pressable>
      </View>

      <View
        pointerEvents="none"
        style={{ position: "absolute", opacity: 0, left: 0, right: 0, zIndex: -1 }}
        onLayout={(event) => {
          const nextHeight = event.nativeEvent.layout.height;
          if (nextHeight <= 0 || nextHeight === bodyHeightRef.current) return;

          bodyHeightRef.current = nextHeight;
          setBodyHeight(nextHeight);
          tryRunPendingExpand();
        }}
      >
        <View style={styles.programCatalogBody}>{bodyContent}</View>
      </View>

      <Animated.View
        pointerEvents={expanded ? "auto" : "none"}
        style={{
          height: bodyHeight > 0 ? bodyAnimatedHeight : undefined,
          opacity: bodyHeight > 0 ? bodyOpacity : 0,
          overflow: "hidden",
        }}
      >
        <View style={styles.programCatalogBody}>{bodyContent}</View>
      </Animated.View>
    </View>
  );
}
