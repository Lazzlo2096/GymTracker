import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { tracePress } from "@/debug/traceLog";
import { useCatalogUi } from "@/theme/catalogUi";
import { fonts } from "@/theme/typography";
import { pressableStyle } from "@/utils/pressableStyles";

const SEG_PADDING = 4;

export type SegmentedTabItem<T extends string> = {
  id: T;
  label: string;
  nativeId?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

export type SegmentedTabsProps<T extends string> = {
  tabs: readonly SegmentedTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  trackNativeId?: string;
  trackTestId?: string;
  indicatorNativeId?: string;
  indicatorTestId?: string;
  style?: StyleProp<ViewStyle>;
  /** 13 — фильтры залов; 14 — вкладки экрана упражнения. */
  labelSize?: "sm" | "md";
  renderTab?: (item: SegmentedTabItem<T>, active: boolean) => React.ReactNode;
};

export default function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  trackNativeId,
  trackTestId,
  indicatorNativeId,
  indicatorTestId,
  style,
  labelSize = "sm",
  renderTab,
}: SegmentedTabsProps<T>) {
  const catalogUi = useCatalogUi();
  const styles = useMemo(
    () => createStyles(catalogUi, labelSize),
    [catalogUi, labelSize],
  );
  const translateX = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const indicatorReady = useRef(false);
  const innerWidth = Math.max(0, trackWidth - SEG_PADDING * 2);
  const slotWidth = tabs.length > 0 ? innerWidth / tabs.length : 0;
  const activeIndex = tabs.findIndex((t) => t.id === value);

  useEffect(() => {
    if (slotWidth <= 0 || activeIndex < 0) return;
    const toValue = activeIndex * slotWidth;
    if (!indicatorReady.current) {
      translateX.setValue(toValue);
      indicatorReady.current = true;
      return;
    }
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      speed: 26,
      bounciness: 4,
    }).start();
  }, [activeIndex, slotWidth, translateX]);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View
      nativeID={trackNativeId}
      testID={trackTestId ?? trackNativeId}
      style={[styles.track, style]}
      onLayout={onTrackLayout}
    >
      {slotWidth > 0 ? (
        <Animated.View
          nativeID={indicatorNativeId}
          testID={indicatorTestId ?? indicatorNativeId}
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: slotWidth, transform: [{ translateX }] },
          ]}
        />
      ) : null}
      {tabs.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            nativeID={item.nativeId}
            testID={item.nativeId}
            style={pressableStyle([styles.tab, item.icon ? styles.tabWithIcon : null], {
              pressed: { opacity: 0.88 },
            })}
            onPress={tracePress(`tab: ${item.label}`, () => onChange(item.id))}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {renderTab ? (
              renderTab(item, active)
            ) : item.icon ? (
              <>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={18}
                  color={active ? catalogUi.accent : catalogUi.textMuted}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
              </>
            ) : (
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(
  catalogUi: ReturnType<typeof useCatalogUi>,
  labelSize: "sm" | "md",
) {
  return StyleSheet.create({
    track: {
      flexDirection: "row",
      backgroundColor: catalogUi.border,
      borderRadius: 14,
      padding: SEG_PADDING,
      position: "relative",
    },
    indicator: {
      position: "absolute",
      left: SEG_PADDING,
      top: SEG_PADDING,
      bottom: SEG_PADDING,
      borderRadius: 10,
      backgroundColor: catalogUi.cardBg,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      zIndex: 1,
    },
    tabWithIcon: {
      flexDirection: "row",
      gap: 8,
    },
    tabText: {
      fontFamily: fonts.semiBold,
      fontSize: labelSize === "md" ? 14 : 13,
      color: catalogUi.textMuted,
    },
    tabTextActive: {
      color: catalogUi.accent,
    },
  });
}
