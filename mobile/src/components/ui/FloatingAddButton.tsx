import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef } from "react";
import {
  Animated,
  GestureResponderEvent,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import {
  FAB_BOTTOM_OFFSET,
  FAB_LIST_PADDING_BOTTOM,
  FAB_SIZE,
} from "@/components/navigation/bottomTabBarInset";
import { tracePress } from "@/debug/traceLog";
import { useAppTheme } from "@/theme/appTheme";

export { FAB_BOTTOM_OFFSET, FAB_LIST_PADDING_BOTTOM, FAB_SIZE };
export const FAB_RIGHT_OFFSET = 14;
/** Правый отступ панели pick-действий, чтобы кнопки не заходили под FAB (тот же right, что у одиночного FAB). */
export const FAB_PICK_ACTIONS_PADDING_RIGHT = FAB_RIGHT_OFFSET + FAB_SIZE + 10;

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
  pressOpacity?: number;
};

function AnimatedPressable({
  style,
  children,
  onPressIn,
  onPressOut,
  pressScale = 0.93,
  pressOpacity = 0.8,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function animateIn() {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: pressScale,
        speed: 35,
        bounciness: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: pressOpacity,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function animateOut() {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        speed: 35,
        bounciness: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handlePressIn(event: GestureResponderEvent) {
    animateIn();
    onPressIn?.(event);
  }

  function handlePressOut(event: GestureResponderEvent) {
    animateOut();
    onPressOut?.(event);
  }

  return (
    <AnimatedPressableBase
      {...props}
      // web: cursor pointer для FAB
      style={[
        style,
        (Platform.OS === "web" ? ({ cursor: "pointer" } as unknown as ViewStyle) : null),
        { transform: [{ scale }], opacity },
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {children}
    </AnimatedPressableBase>
  );
}

export type FloatingAddButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Отступ снизу (как на экране истории тренировок — по умолчанию 14). */
  bottomOffset?: number;
  /** Отступ справа (по умолчанию 14). */
  rightOffset?: number;
  /** Встроить в строку (без absolute) — для нижней панели режима выбора. */
  inline?: boolean;
};

/**
 * Плавающая кнопка «+» с градиентом — тот же вид, что на экране «История тренировок».
 */
export default function FloatingAddButton({
  onPress,
  disabled = false,
  accessibilityLabel = "Добавить",
  bottomOffset = FAB_BOTTOM_OFFSET,
  rightOffset = FAB_RIGHT_OFFSET,
  inline = false,
}: FloatingAddButtonProps) {
  const theme = useAppTheme();
  const styles = React.useMemo(
    () => createStyles(bottomOffset, rightOffset, inline),
    [bottomOffset, inline, rightOffset],
  );

  return (
    <AnimatedPressable
      style={[styles.fabWrapper, disabled && styles.fabDisabled]}
      pressScale={0.93}
      pressOpacity={0.8}
      onPress={disabled ? undefined : tracePress(`FAB: ${accessibilityLabel}`, onPress)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <LinearGradient
        colors={theme.dark ? ["#A78BFA", "#6D28D9"] : ["#8B5CF6", "#6D28D9"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fab}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </LinearGradient>
    </AnimatedPressable>
  );
}

function createStyles(bottomOffset: number, rightOffset: number, inline: boolean) {
  return StyleSheet.create({
    fabWrapper: {
      position: inline ? "relative" : "absolute",
      ...(inline ? null : { right: rightOffset, bottom: bottomOffset }),
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      shadowColor: "#4C1D95",
      shadowOpacity: 0.32,
      shadowRadius: 12,
      shadowOffset: {
        width: 0,
        height: 6,
      },
      elevation: 6,
    },
    fab: {
      flex: 1,
      borderRadius: FAB_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
    },
    fabDisabled: {
      opacity: 0.55,
    },
  });
}
