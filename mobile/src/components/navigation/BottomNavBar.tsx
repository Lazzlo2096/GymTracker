import { MaterialCommunityIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BarbellOutlineIcon } from "@/components/icons/WorkoutFigmaIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tracePress } from "@/debug/traceLog";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";

type AppTabId = "home" | "workouts" | "stats" | "plans" | "profile";

/** Единая сетка: MCI и кастомная штанга в одном квадрате, подпись — одна строка. */
const BOTTOM_NAV_ICON_SLOT = 24;
const BOTTOM_NAV_LABEL_LINE_HEIGHT = 14;

/**
 * Определяет активную вкладку по пути Expo Router.
 */
function detectActive(pathname: string): AppTabId {
  if (pathname.includes("/profile")) return "profile";
  if (pathname.includes("/plans") || pathname.includes("/plan-template")) return "plans";
  if (pathname.includes("/home")) return "home";

  if (
    pathname.includes("/workouts") ||
    pathname.includes("/schedule-workouts") ||
    pathname.includes("/workout/") ||
    pathname.includes("/exercise/") ||
    pathname.includes("/exercise-in-catalog") ||
    pathname.includes("/exercise_catalog") ||
    pathname.includes("/gyms")
  ) {
    return "workouts";
  }

  if (pathname.includes("/stats")) {
    return "stats";
  }

  return "home";
}

export default function BottomNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const active = detectActive(pathname);
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.bottomNav,
        {
          backgroundColor: theme.card,
        },
      ]}
    >
      <View style={styles.bottomNavRow}>
        <BottomNavItem
          icon="home"
          label="Главная"
          active={active === "home"}
          onPress={tracePress("tab: Главная → /home", () => router.push("/home"))}
          theme={theme}
        />
        <BottomNavItem
          customIcon={
            <BarbellOutlineIcon
              size={24}
              color={active === "workouts" ? theme.accent : theme.textMuted}
            />
          }
          label="Тренировки"
          active={active === "workouts"}
          onPress={tracePress("tab: Тренировки → /workouts", () => router.push("/workouts"))}
          theme={theme}
        />
        <BottomNavItem
          icon="chart-donut"
          label="Статистика"
          active={active === "stats"}
          onPress={tracePress("tab: Статистика → /stats", () => router.push("/stats"))}
          theme={theme}
        />
        <BottomNavItem
          icon="clipboard-text"
          label="Планы"
          active={active === "plans"}
          onPress={tracePress("tab: Планы → /plans", () => router.push("/plans"))}
          theme={theme}
        />
        <BottomNavItem
          icon="account"
          label="Профиль"
          active={active === "profile"}
          onPress={tracePress("tab: Профиль → /profile", () => router.push("/profile"))}
          theme={theme}
        />
      </View>
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

function BottomNavItem({
  icon,
  customIcon,
  label,
  active,
  onPress,
  theme,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  customIcon?: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const tint = active ? theme.accent : theme.textMuted;
  return (
    <Pressable style={styles.bottomNavItem} onPress={onPress}>
      <View style={styles.bottomNavIconSlot}>
        {customIcon ?? (
          <MaterialCommunityIcons name={icon!} size={BOTTOM_NAV_ICON_SLOT} color={tint} />
        )}
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          styles.bottomNavText,
          { color: active ? theme.accent : theme.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    borderTopWidth: 0,
  },
  /** Равные отступы сверху и снизу от иконок/подписей; зона safe area — отдельно снизу. */
  bottomNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  bottomNavItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bottomNavIconSlot: {
    width: BOTTOM_NAV_ICON_SLOT,
    height: BOTTOM_NAV_ICON_SLOT,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomNavText: {
    width: "100%",
    fontSize: 11,
    lineHeight: BOTTOM_NAV_LABEL_LINE_HEIGHT,
    minHeight: BOTTOM_NAV_LABEL_LINE_HEIGHT,
    textAlign: "center",
    fontFamily: fonts.semiBold,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
});
