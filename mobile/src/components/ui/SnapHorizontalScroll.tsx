import React, {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

const DEFAULT_GAP = 8;
const SNAP_EPSILON = 2;
const IS_WEB = Platform.OS === "web";
/** Доп. inset внутри scrollport под box-shadow карточек (plaqueListShadow ≈ 18px). */
const WEB_SHADOW_SIDE_INSET = 12;
/** RN Web не реализует snapToOffsets — доснап после колеса/тачпада. */
const WEB_SCROLL_SETTLE_MS = 100;

type ScrollViewWithDom = ScrollView & { getScrollableNode?: () => unknown };

function getScrollableHTMLElement(scrollView: ScrollView | null): HTMLElement | null {
  if (!IS_WEB || scrollView == null) return null;
  const dom = (scrollView as ScrollViewWithDom).getScrollableNode?.();
  if (dom && typeof dom === "object" && dom !== null && "style" in dom) {
    return dom as HTMLElement;
  }
  return null;
}

let webScrollbarCssInjected = false;

function ensureWebScrollbarHiddenStyle() {
  if (!IS_WEB || webScrollbarCssInjected || typeof document === "undefined") return;
  webScrollbarCssInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-snap-h-scroll", "");
  style.textContent = "[data-snap-h-scroll]::-webkit-scrollbar{display:none;width:0;height:0}";
  document.head.appendChild(style);
}

function applyWebScrollDomStyles(el: HTMLElement, clipItemOverflow: boolean) {
  ensureWebScrollbarHiddenStyle();
  el.setAttribute("data-snap-h-scroll", "");
  el.style.scrollSnapType = "none";
  el.style.overscrollBehaviorX = "contain";
  /** overflow:visible на ScrollView ломает горизонтальный скролл в RN Web (карусели с тенями). */
  el.style.overflowX = "auto";
  el.style.overflowY = clipItemOverflow ? "hidden" : "visible";
  el.style.scrollbarWidth = "none";
  el.style.msOverflowStyle = "none";
}

function hostOverflowStyle(clipItemOverflow: boolean): ViewStyle | undefined {
  if (!IS_WEB) {
    return { overflow: clipItemOverflow ? "hidden" : "visible" };
  }
  if (!clipItemOverflow) {
    return { overflow: "visible" } as ViewStyle;
  }
  return { overflow: "hidden" } as ViewStyle;
}

function scrollOverflowStyle(clipItemOverflow: boolean): ViewStyle | undefined {
  if (!IS_WEB) {
    return { overflow: clipItemOverflow ? "hidden" : "visible" };
  }
  return {
    overflowX: "auto",
    overflowY: clipItemOverflow ? "hidden" : "visible",
    scrollbarWidth: "none",
    // @ts-expect-error RN Web — IE/legacy Edge
    msOverflowStyle: "none",
  } as ViewStyle;
}

function snapWebToFixedCards(offsetX: number, interval: number, maxScroll: number): number {
  if (interval <= 0) return Math.min(maxScroll, Math.max(0, offsetX));
  const index = Math.round(offsetX / interval);
  const snapped = index * interval;
  return Math.min(maxScroll, Math.max(0, snapped));
}

export type SnapHorizontalScrollProps = Omit<ScrollViewProps, "horizontal" | "children"> & {
  gap?: number;
  itemWidth?: number;
  contentPaddingVertical?: number;
  /** Горизонтальный отступ контента (место под боковое размытие тени). */
  contentPaddingHorizontal?: number;
  /**
   * false — не обрезать тень карточек (overflow: visible на слотах и viewport).
   * По умолчанию true для превью/чипов без тени.
   */
  clipItemOverflow?: boolean;
  /**
   * Web: вылезти в горизонтальные поля родителя (px с каждой стороны).
   * z-index не снимает overflow-clip — расширяем viewport в padding страницы.
   */
  bleedGutter?: number;
  /** Асимметричный bleed; по умолчанию = bleedGutter. */
  bleedGutterLeft?: number;
  bleedGutterRight?: number;
  children: React.ReactNode;
};

/** Скролл до правого края последнего элемента — без пустого хвоста. */
function computeEndScroll(contentExtent: number, viewportWidth: number): number {
  if (viewportWidth <= 0 || contentExtent <= viewportWidth) return 0;
  return Math.round(contentExtent - viewportWidth);
}

function buildSnapOffsets(itemStarts: number[], endScroll: number): number[] {
  if (itemStarts.length === 0) return [0];

  const sorted = [...new Set(itemStarts.map((x) => Math.max(0, Math.round(x))))].sort(
    (a, b) => a - b,
  );

  if (endScroll <= 0) return sorted;

  const reachable = sorted.filter((x) => x <= endScroll + SNAP_EPSILON);
  const offsets = reachable.length > 0 ? reachable : [0];

  const tail = offsets[offsets.length - 1] ?? 0;
  if (tail < endScroll - SNAP_EPSILON) {
    offsets.push(endScroll);
  }

  return offsets;
}

export default function SnapHorizontalScroll({
  gap = DEFAULT_GAP,
  itemWidth,
  contentPaddingVertical = 0,
  contentPaddingHorizontal = 0,
  clipItemOverflow = true,
  bleedGutter = 0,
  bleedGutterLeft,
  bleedGutterRight,
  children,
  contentContainerStyle,
  style,
  onMomentumScrollEnd,
  onScrollEndDrag,
  onScroll: onScrollProp,
  style: scrollStyleProp,
  ...scrollProps
}: SnapHorizontalScrollProps) {
  const scrollRef = useRef<ScrollView>(null);
  const childArray = useMemo(() => Children.toArray(children), [children]);
  const childCount = childArray.length;

  const layoutsRef = useRef<Array<{ x: number; width: number } | undefined>>([]);
  const [itemStartOffsets, setItemStartOffsets] = useState<number[]>([0]);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentExtent, setContentExtent] = useState(0);
  const [lastItemWidth, setLastItemWidth] = useState(0);
  const scrollOffsetRef = useRef(0);
  const webSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webWheelCleanupRef = useRef<(() => void) | null>(null);
  const scheduleWebSnapRef = useRef<(offsetX: number) => void>(() => {});

  const fixedSnapInterval = itemWidth != null ? itemWidth + gap : undefined;

  const syncFixedExtent = useCallback(() => {
    if (itemWidth == null || childCount === 0) return;
    const extent = childCount * itemWidth + Math.max(0, childCount - 1) * gap;
    setContentExtent(Math.round(extent));
    setLastItemWidth(itemWidth);
  }, [childCount, gap, itemWidth]);

  useEffect(() => {
    layoutsRef.current = [];
    setItemStartOffsets([0]);
    setContentExtent(0);
    setLastItemWidth(0);
    syncFixedExtent();
  }, [childCount, itemWidth, gap, syncFixedExtent]);

  useEffect(
    () => () => {
      if (webSettleTimerRef.current) clearTimeout(webSettleTimerRef.current);
      webWheelCleanupRef.current?.();
      webWheelCleanupRef.current = null;
    },
    [],
  );

  const attachWebScrollEnhancements = useCallback(
    (scrollView: ScrollView | null) => {
      if (!IS_WEB) return;
      webWheelCleanupRef.current?.();
      webWheelCleanupRef.current = null;

      const el = getScrollableHTMLElement(scrollView);
      if (!el) return;

      applyWebScrollDomStyles(el, clipItemOverflow);

      const onWheel = (e: WheelEvent) => {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= 1) return;

        const deltaX = e.deltaX;
        const deltaY = e.deltaY;
        if (Math.abs(deltaX) > Math.abs(deltaY)) return;

        const goingRight = deltaY > 0;
        const atStart = el.scrollLeft <= 0;
        const atEnd = el.scrollLeft >= maxScroll - 1;
        if ((goingRight && atEnd) || (!goingRight && atStart)) return;

        e.preventDefault();
        e.stopPropagation();
        el.scrollLeft += deltaY;
        scrollOffsetRef.current = el.scrollLeft;
        scheduleWebSnapRef.current(el.scrollLeft);
      };

      el.addEventListener("wheel", onWheel, { passive: false });
      webWheelCleanupRef.current = () => el.removeEventListener("wheel", onWheel);
    },
    [clipItemOverflow],
  );

  const rebuildItemStartOffsets = useCallback(() => {
    if (fixedSnapInterval != null) {
      setItemStartOffsets(childArray.map((_, i) => Math.round(i * fixedSnapInterval)));
      syncFixedExtent();
      return;
    }

    const layouts = layoutsRef.current;
    if (layouts.length < childCount || layouts.some((l) => !l)) return;

    const starts: number[] = [0];
    for (let i = 1; i < childCount; i++) {
      const layout = layouts[i];
      if (layout) starts.push(Math.max(0, Math.round(layout.x)));
    }
    setItemStartOffsets(starts);

    const last = layouts[childCount - 1];
    if (last) {
      setContentExtent(Math.round(last.x + last.width));
      setLastItemWidth(Math.round(last.width));
    }
  }, [childArray, childCount, fixedSnapInterval, syncFixedExtent]);

  const handleChildLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      layoutsRef.current[index] = { x, width };
      if (index === childCount - 1) {
        setContentExtent(Math.round(x + width));
        setLastItemWidth(Math.round(width));
      }
      rebuildItemStartOffsets();
    },
    [childCount, rebuildItemStartOffsets],
  );

  const handleViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setViewportWidth(Math.round(event.nativeEvent.layout.width));
      attachWebScrollEnhancements(scrollRef.current);
    },
    [attachWebScrollEnhancements],
  );

  const bindScrollRef = useCallback(
    (node: ScrollView | null) => {
      scrollRef.current = node;
      attachWebScrollEnhancements(node);
    },
    [attachWebScrollEnhancements],
  );

  const endScroll = useMemo(
    () => computeEndScroll(contentExtent, viewportWidth),
    [contentExtent, viewportWidth],
  );

  const resolvedSnapOffsets = useMemo(
    () => buildSnapOffsets(itemStartOffsets, endScroll),
    [endScroll, itemStartOffsets],
  );

  const snapToNearest = useCallback(
    (offsetX: number) => {
      if (IS_WEB && fixedSnapInterval != null) {
        const nearest = snapWebToFixedCards(offsetX, fixedSnapInterval, endScroll);
        if (Math.abs(offsetX - nearest) > SNAP_EPSILON) {
          scrollRef.current?.scrollTo({ x: nearest, animated: true });
        }
        return;
      }

      if (IS_WEB) {
        const starts = itemStartOffsets;
        if (starts.length === 0) return;
        let nearest = starts[0] ?? 0;
        let minDist = Math.abs(offsetX - nearest);
        for (let i = 1; i < starts.length; i++) {
          const off = starts[i] ?? 0;
          const d = Math.abs(offsetX - off);
          if (d < minDist) {
            minDist = d;
            nearest = off;
          }
        }
        nearest = Math.min(endScroll, Math.max(0, nearest));
        if (minDist > SNAP_EPSILON) {
          scrollRef.current?.scrollTo({ x: nearest, animated: true });
        }
        return;
      }

      const offsets = resolvedSnapOffsets;
      if (offsets.length === 0) return;

      if (endScroll > 0 && offsetX >= endScroll - SNAP_EPSILON * 4) {
        if (Math.abs(offsetX - endScroll) > SNAP_EPSILON) {
          scrollRef.current?.scrollTo({ x: endScroll, animated: !IS_WEB });
        }
        return;
      }

      let nearest = offsets[0] ?? 0;
      let minDist = Math.abs(offsetX - nearest);
      for (let i = 1; i < offsets.length; i++) {
        const off = offsets[i] ?? 0;
        const d = Math.abs(offsetX - off);
        if (d < minDist) {
          minDist = d;
          nearest = off;
        }
      }

      if (minDist > SNAP_EPSILON) {
        scrollRef.current?.scrollTo({ x: nearest, animated: !IS_WEB });
      }
    },
    [endScroll, fixedSnapInterval, itemStartOffsets, resolvedSnapOffsets],
  );

  const scheduleWebSnap = useCallback(
    (offsetX: number) => {
      if (!IS_WEB) return;
      scrollOffsetRef.current = offsetX;
      if (webSettleTimerRef.current) clearTimeout(webSettleTimerRef.current);
      webSettleTimerRef.current = setTimeout(() => {
        webSettleTimerRef.current = null;
        snapToNearest(scrollOffsetRef.current);
      }, WEB_SCROLL_SETTLE_MS);
    },
    [snapToNearest],
  );

  useEffect(() => {
    scheduleWebSnapRef.current = scheduleWebSnap;
  }, [scheduleWebSnap]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      snapToNearest(e.nativeEvent.contentOffset.x);
      onMomentumScrollEnd?.(e);
    },
    [onMomentumScrollEnd, snapToNearest],
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      if (IS_WEB) {
        scheduleWebSnap(x);
      } else {
        snapToNearest(x);
      }
      onScrollEndDrag?.(e);
    },
    [onScrollEndDrag, scheduleWebSnap, snapToNearest],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = e.nativeEvent.contentOffset.x;
      onScrollProp?.(e);
    },
    [onScrollProp],
  );

  /** scroll-snap и overflow-x на viewport (не на content): иначе в Chrome не срабатывает. */
  const webScrollStyle = useMemo(
    () => (IS_WEB ? scrollOverflowStyle(clipItemOverflow) : undefined),
    [clipItemOverflow],
  );

  const hostOverflow = useMemo(() => hostOverflowStyle(clipItemOverflow), [clipItemOverflow]);

  const leftBleed = bleedGutterLeft ?? bleedGutter ?? 0;
  const rightBleed = bleedGutterRight ?? bleedGutter ?? 0;
  const hasGutterBleed = leftBleed > 0 || rightBleed > 0;

  const webShadowInset = IS_WEB && !clipItemOverflow ? WEB_SHADOW_SIDE_INSET : 0;
  const horizontalContentInset = contentPaddingHorizontal + webShadowInset;
  /**
   * Full-bleed: края viewport = края экрана, контент с отступом как у остальных плашек.
   * Без bleed: карусель уже в колонке контента — только малый inset под тень.
   */
  const contentPadLeft = hasGutterBleed
    ? leftBleed
    : !clipItemOverflow
      ? 0
      : horizontalContentInset;
  const contentPadRight = hasGutterBleed
    ? rightBleed
    : !clipItemOverflow
      ? 0
      : horizontalContentInset;

  /** Расширить viewport в padding страницы; stacking — только поверх соседей, не против clip. */
  const hostGutterBleedStyle = useMemo((): ViewStyle | undefined => {
    if (!IS_WEB || clipItemOverflow) return undefined;
    if (!hasGutterBleed) {
      return { zIndex: 1, position: "relative" } as ViewStyle;
    }
    return {
      marginLeft: -leftBleed,
      marginRight: -rightBleed,
      width: `calc(100% + ${leftBleed + rightBleed}px)`,
      zIndex: 1,
      position: "relative",
      alignSelf: "center",
    } as ViewStyle;
  }, [clipItemOverflow, hasGutterBleed, leftBleed, rightBleed]);

  const webItemStyle = useMemo(
    () =>
      IS_WEB
        ? ({
            flexShrink: 0,
            flexGrow: 0,
          } as ViewStyle)
        : undefined,
    [],
  );

  /** Позволяет доскроллить до полного последнего чипа (переменная ширина). */
  const webEndInset = useMemo(() => {
    if (!IS_WEB || itemWidth != null || viewportWidth <= 0 || lastItemWidth <= 0) return 0;
    return Math.max(0, viewportWidth - lastItemWidth);
  }, [itemWidth, lastItemWidth, viewportWidth]);

  const itemSlotOverflow = clipItemOverflow ? "hidden" : "visible";

  const renderedChildren = useMemo(() => {
    if (itemWidth != null) {
      return childArray.map((child, index) => (
        <View
          key={isValidElement(child) && child.key != null ? String(child.key) : `snap-fixed-${index}`}
          style={[
            {
              width: itemWidth,
              marginRight: index < childCount - 1 ? gap : 0,
              overflow: itemSlotOverflow,
            },
            webItemStyle,
          ]}
        >
          {child}
        </View>
      ));
    }

    return childArray.map((child, index) => (
      <View
        key={isValidElement(child) && child.key != null ? String(child.key) : `snap-${index}`}
        onLayout={(e) => handleChildLayout(index, e)}
        style={[
          { marginRight: index < childCount - 1 ? gap : 0, overflow: itemSlotOverflow },
          webItemStyle,
        ]}
      >
        {child}
      </View>
    ));
  }, [childArray, childCount, gap, handleChildLayout, itemSlotOverflow, itemWidth, webItemStyle]);

  const mergedContentStyle = useMemo(
    () =>
      StyleSheet.flatten([
        styles.contentRow,
        contentPaddingVertical > 0
          ? {
              paddingTop: contentPaddingVertical,
              paddingBottom: contentPaddingVertical,
            }
          : null,
        contentPadLeft > 0 || contentPadRight > 0
          ? {
              paddingLeft: contentPadLeft,
              paddingRight: contentPadRight,
            }
          : null,
        webEndInset > 0 ? { paddingRight: webEndInset } : null,
        contentContainerStyle,
      ]),
    [contentContainerStyle, contentPadLeft, contentPadRight, contentPaddingVertical, webEndInset],
  );

  const nativeSnapProps = useMemo(
    () =>
      IS_WEB
        ? {}
        : {
            snapToOffsets: resolvedSnapOffsets,
            snapToAlignment: "start" as const,
            snapToStart: false,
            snapToEnd: false,
          },
    [resolvedSnapOffsets],
  );

  return (
    <View
      style={[styles.clipHost, hostOverflow, hostGutterBleedStyle, style]}
      onLayout={handleViewportLayout}
    >
      <ScrollView
        ref={bindScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        overScrollMode="never"
        nestedScrollEnabled
        {...scrollProps}
        {...nativeSnapProps}
        scrollEventThrottle={IS_WEB ? 16 : scrollProps.scrollEventThrottle}
        contentContainerStyle={mergedContentStyle}
        style={[webScrollStyle, scrollStyleProp]}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        onScroll={handleScroll}
      >
        {renderedChildren}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  clipHost: {
    width: "100%",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
