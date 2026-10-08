import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import PlansProgramCard from "@/components/plans/PlansProgramCard";
import type { CurrentProgram, WorkoutTemplateMock } from "@/components/plans/types";

const ENTER_MS = 320;
const EXIT_MS = 260;
const ENTER_EASING = Easing.out(Easing.cubic);
const EXIT_EASING = Easing.inOut(Easing.cubic);
const ENTER_OFFSET_Y = 12;
const EXIT_OFFSET_Y = 8;

type Props = {
  program: CurrentProgram;
  templates: WorkoutTemplateMock[];
  expanded: boolean;
  isCurrent?: boolean;
  onToggle: () => void;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  animateEntrance?: boolean;
  entranceDelay?: number;
  animateExit?: boolean;
  exitDelay?: number;
  onExitComplete?: () => void;
};

export default function PlansProgramCatalogItem({
  animateEntrance = false,
  entranceDelay = 0,
  animateExit = false,
  exitDelay = 0,
  onExitComplete,
  ...cardProps
}: Props) {
  const visibilityAnim = useRef(new Animated.Value(animateEntrance ? 0 : 1)).current;
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const isExitingRef = useRef(false);
  const exitCompletedRef = useRef(false);
  const onExitCompleteRef = useRef(onExitComplete);
  const isListAnimating = animateEntrance || animateExit;

  onExitCompleteRef.current = onExitComplete;

  useLayoutEffect(() => {
    if (!animateExit) {
      isExitingRef.current = false;
      exitCompletedRef.current = false;
      if (!animateEntrance) {
        setLockedHeight(null);
      }
      return;
    }

    if (lockedHeight != null) return;

    const nextHeight = measuredHeight > 0 ? measuredHeight : null;
    if (nextHeight != null) {
      isExitingRef.current = true;
      setLockedHeight(nextHeight);
    }
  }, [animateEntrance, animateExit, lockedHeight, measuredHeight]);

  useEffect(() => {
    if (!animateExit || lockedHeight != null) return;

    const fallback = setTimeout(() => {
      if (exitCompletedRef.current) return;
      exitCompletedRef.current = true;
      onExitCompleteRef.current?.();
    }, EXIT_MS + exitDelay + 48);

    return () => clearTimeout(fallback);
  }, [animateExit, exitDelay, lockedHeight]);

  useEffect(() => {
    if (animateExit) {
      if (lockedHeight == null || exitCompletedRef.current) return;

      const animation = Animated.timing(visibilityAnim, {
        toValue: 0,
        duration: EXIT_MS,
        delay: exitDelay,
        easing: EXIT_EASING,
        useNativeDriver: false,
      });

      animation.start(({ finished }) => {
        if (!finished || exitCompletedRef.current) return;
        exitCompletedRef.current = true;
        onExitCompleteRef.current?.();
      });

      return () => animation.stop();
    }

    if (animateEntrance) {
      visibilityAnim.setValue(0);
      const animation = Animated.timing(visibilityAnim, {
        toValue: 1,
        duration: ENTER_MS,
        delay: entranceDelay,
        easing: ENTER_EASING,
        useNativeDriver: false,
      });
      animation.start();
      return () => animation.stop();
    }

    visibilityAnim.setValue(1);
  }, [animateEntrance, animateExit, entranceDelay, exitDelay, lockedHeight, visibilityAnim]);

  const layoutHeight = lockedHeight ?? measuredHeight;
  const useHeightAnimation = isListAnimating && layoutHeight > 0;

  const animatedHeight = visibilityAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(layoutHeight, 1)],
  });

  const opacity = visibilityAnim.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.85, 1],
  });

  const translateY = visibilityAnim.interpolate({
    inputRange: [0, 1],
    outputRange: animateExit ? [-EXIT_OFFSET_Y, 0] : [ENTER_OFFSET_Y, 0],
  });

  return (
    <Animated.View
      style={
        isListAnimating
          ? {
              height: useHeightAnimation ? animatedHeight : undefined,
              opacity: useHeightAnimation ? opacity : visibilityAnim,
              overflow: "hidden",
            }
          : undefined
      }
    >
      <Animated.View
        style={isListAnimating ? { transform: [{ translateY }] } : undefined}
        onLayout={(event) => {
          if (isExitingRef.current) return;
          const nextHeight = event.nativeEvent.layout.height;
          if (nextHeight > 0 && nextHeight !== measuredHeight) {
            setMeasuredHeight(nextHeight);
          }
        }}
      >
        <PlansProgramCard {...cardProps} />
      </Animated.View>
    </Animated.View>
  );
}

export const PROGRAM_CATALOG_EXIT_MS = EXIT_MS;
