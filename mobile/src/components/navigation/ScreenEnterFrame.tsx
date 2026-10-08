import { type Href, useFocusEffect, useNavigation, useRootNavigationState, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { trace } from "@/debug/traceLog";
export type ScreenEnterDirection = "left" | "right" | "none";

type NavLike = {
  canGoBack: () => boolean;
  getParent: () => NavLike | undefined;
};

type NavState = {
  type?: string;
  index?: number;
  routes: Array<{ state?: NavState }>;
};

type Props = {
  children: React.ReactNode;
  direction?: ScreenEnterDirection;
};

type BackRouter = {
  back: () => void;
  replace: (href: Href) => void;
};

let nextScreenEnterDirection: ScreenEnterDirection | null = null;

export function setNextScreenEnterDirection(direction: ScreenEnterDirection) {
  nextScreenEnterDirection = direction;
}

/** React Navigation stack (не window.history): есть ли pop в текущем или родительском navigator. */
export function navigationCanPop(navigation: NavLike): boolean {
  let nav: NavLike | undefined = navigation;
  while (nav) {
    if (nav.canGoBack()) return true;
    nav = nav.getParent() as NavLike | undefined;
  }
  return false;
}

export function goBackWithScreenEnter(
  router: BackRouter,
  direction: Exclude<ScreenEnterDirection, "none"> = "left",
  fallbackHref?: Href,
  navigation?: NavLike,
) {
  trace("NAV", "goBackWithScreenEnter", {
    direction,
    fallbackHref: fallbackHref ?? null,
    canPop: navigation ? navigationCanPop(navigation) : null,
  });
  setNextScreenEnterDirection(direction);
  if (navigation && navigationCanPop(navigation)) {
    router.back();
    return;
  }
  if (fallbackHref) {
    router.replace(fallbackHref);
    return;
  }
  router.back();
}

/** Есть ли в дереве навигации stack с более чем одним экраном (как canDismiss в expo-router). */
function navigationStateCanPop(state: NavState | undefined): boolean {
  if (!state) return false;
  if (state.type === "stack" && state.routes.length > 1) return true;
  const index = state.index ?? 0;
  const route = state.routes[index];
  if (route?.state && navigationStateCanPop(route.state)) return true;
  return false;
}

/** Swipe-back на вложенном Stack: только если в корневом дереве есть куда pop. */
export function useStackBackGestureEnabled(): boolean {
  return useRootNavigationState(navigationStateCanPop);
}

/** Назад с анимацией входа; на deep link / прямом URL — `fallbackHref` вместо GO_BACK.
 *  @see ./goBackFallbackContract.ts */
export function useGoBackWithScreenEnter(fallbackHref?: Href) {
  const router = useRouter();
  const navigation = useNavigation();

  return useCallback(
    (direction: Exclude<ScreenEnterDirection, "none"> = "left") => {
      goBackWithScreenEnter(router, direction, fallbackHref, navigation);
    },
    [fallbackHref, navigation, router],
  );
}

function consumeScreenEnterDirection(fallbackDirection: ScreenEnterDirection) {
  const direction = nextScreenEnterDirection ?? fallbackDirection;
  nextScreenEnterDirection = null;
  return direction;
}

/** Web-friendly вход экрана: лёгкий fade + сдвиг со стороны перехода. */
export default function ScreenEnterFrame({
  children,
  direction = "right",
}: Props) {
  const enterProgress = useRef(new Animated.Value(direction === "none" ? 1 : 0)).current;
  const [activeDirection, setActiveDirection] =
    useState<Exclude<ScreenEnterDirection, "none">>(
      direction === "left" ? "left" : "right"
    );
  const enterStyle = {
    opacity: enterProgress,
    transform: [
      {
        translateX: enterProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [activeDirection === "left" ? -36 : 36, 0],
        }),
      },
    ],
  };

  useFocusEffect(
    useCallback(() => {
      const nextDirection = consumeScreenEnterDirection(direction);

      if (nextDirection === "none") {
        enterProgress.stopAnimation();
        enterProgress.setValue(1);
        return undefined;
      }

      setActiveDirection(nextDirection);
      enterProgress.stopAnimation();
      enterProgress.setValue(0);
      Animated.timing(enterProgress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      return undefined;
    }, [direction, enterProgress])
  );

  return (
    <View style={styles.frame}>
      <Animated.View style={[styles.content, enterStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    overflow: "hidden",
  },

  content: {
    flex: 1,
  },
});
