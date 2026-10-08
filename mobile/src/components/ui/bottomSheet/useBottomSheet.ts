import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, PanResponder, type GestureResponderHandlers } from "react-native";
import { trace, traceBoolState } from "@/debug/traceLog";

export type BottomSheetPanHandlers = GestureResponderHandlers;

const WINDOW_HEIGHT = Dimensions.get("window").height;

/** Свайп вниз закрывает шторку, если сместили достаточно далеко или быстро. */
export const BOTTOM_SHEET_DISMISS_DRAG_Y = 110;
export const BOTTOM_SHEET_DISMISS_VELOCITY_Y = 1.05;

export type UseBottomSheetOptions = {
  /** Если false — жест и backdrop не закрывают (например, идёт сохранение). */
  dismissEnabled?: boolean;
  /**
   * После завершения анимации закрытия (`visible → false`). Родитель сбрасывает данные
   * шторки здесь, а не синхронно с `onClose` — см. `modalDismissContract.ts`.
   */
  onDismiss?: () => void;
};

/** Длительность анимации закрытия (ms); совпадает с `BOTTOM_SHEET_CLOSE_MS` в modalDismissContract. */
export const BOTTOM_SHEET_CLOSE_MS = 280;

export function useBottomSheet(
  visible: boolean,
  onClose: () => void,
  options?: UseBottomSheetOptions,
) {
  const dismissEnabled = options?.dismissEnabled ?? true;
  const onDismiss = options?.onDismiss;
  const [mounted, setMounted] = useState(visible);
  const sheetTranslateY = useRef(new Animated.Value(WINDOW_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetOpenAnimationDoneRef = useRef(false);
  const prevVisibleRef = useRef(visible);
  const prevMountedRef = useRef(mounted);

  useEffect(() => {
    traceBoolState("MODAL", "bottomSheet.visible", prevVisibleRef.current, visible, {
      dismissEnabled,
    });
    prevVisibleRef.current = visible;
  }, [dismissEnabled, visible]);

  useEffect(() => {
    traceBoolState("MODAL", "bottomSheet.mounted", prevMountedRef.current, mounted);
    prevMountedRef.current = mounted;
  }, [mounted]);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => {
          if (!sheetOpenAnimationDoneRef.current || !dismissEnabled) return false;
          return g.dy > 8 && g.dy > Math.abs(g.dx);
        },
        onPanResponderGrant: () => {
          if (!sheetOpenAnimationDoneRef.current) return;
          sheetTranslateY.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          if (!sheetOpenAnimationDoneRef.current) return;
          const y = Math.max(0, g.dy);
          sheetTranslateY.setValue(Math.min(y, WINDOW_HEIGHT));
        },
        onPanResponderRelease: (_, g) => {
          if (!sheetOpenAnimationDoneRef.current || !dismissEnabled) {
            Animated.spring(sheetTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
              tension: 80,
            }).start();
            return;
          }
          const vy = typeof g.vy === "number" ? g.vy : 0;
          const shouldDismiss =
            g.dy > BOTTOM_SHEET_DISMISS_DRAG_Y || vy > BOTTOM_SHEET_DISMISS_VELOCITY_Y;
          if (shouldDismiss) {
            trace("MODAL", "bottomSheet swipe dismiss");
            onClose();
            return;
          }
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 80,
          }).start();
        },
      }),
    [dismissEnabled, onClose, sheetTranslateY],
  );

  useEffect(() => {
    if (!mounted) return;

    if (visible) {
      trace("MODAL", "bottomSheet open animation start");
      sheetOpenAnimationDoneRef.current = false;
      sheetTranslateY.setValue(WINDOW_HEIGHT);
      backdropOpacity.setValue(0);
      const open = Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      open.start(({ finished }) => {
        if (finished) {
          sheetOpenAnimationDoneRef.current = true;
          trace("MODAL", "bottomSheet open animation done");
        }
      });
      return () => open.stop();
    }

    sheetOpenAnimationDoneRef.current = false;
    trace("MODAL", "bottomSheet close animation start");
    const close = Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: WINDOW_HEIGHT,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]);
    close.start(({ finished }) => {
      if (finished) {
        trace("MODAL", "bottomSheet close animation done → onDismiss");
        setMounted(false);
        onDismiss?.();
      }
    });
    return () => close.stop();
  }, [visible, mounted, sheetTranslateY, backdropOpacity, onDismiss]);

  const requestClose = () => {
    if (dismissEnabled) {
      trace("MODAL", "bottomSheet requestClose");
      onClose();
    }
  };

  return {
    mounted,
    sheetTranslateY,
    backdropOpacity,
    panHandlers: sheetPanResponder.panHandlers,
    requestClose,
    windowHeight: WINDOW_HEIGHT,
  };
}
