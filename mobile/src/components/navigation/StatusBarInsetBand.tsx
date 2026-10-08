import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useAppTheme } from "@/theme/appTheme";

type BarStyle = "light" | "dark" | "auto";

type Props = {
  /** Переопределение стиля иконок статус-бара. */
  barStyle?: BarStyle;
  /** Фон полосы под статус-баром (по умолчанию — лёгкая тень на светлой теме). */
  bandBackgroundColor?: string;
};

/** Полоса под системный статус-бар + корректный цвет иконок (время, сеть, батарея). */
export default function StatusBarInsetBand({ barStyle, bandBackgroundColor }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const style: BarStyle = barStyle ?? (theme.dark ? "light" : "dark");
  const bandBg = bandBackgroundColor ?? (theme.dark ? theme.bg : "rgba(0, 0, 0, 0.07)");

  return (
    <>
      {insets.top > 0 ? (
        <View style={[styles.band, { height: insets.top, backgroundColor: bandBg }]} />
      ) : null}
      <StatusBar style={style} />
    </>
  );
}

/** Экраны входа/регистрации (светлый фон, тёмные иконки статус-бара). */
export function AuthStatusBarInsetBand() {
  const insets = useSafeAreaInsets();

  return (
    <>
      {insets.top > 0 ? (
        <View
          style={[styles.band, { height: insets.top, backgroundColor: "rgba(0, 0, 0, 0.07)" }]}
        />
      ) : null}
      <StatusBar style="dark" backgroundColor={colors.pageBg} />
    </>
  );
}

const styles = StyleSheet.create({
  band: {
    width: "100%",
  },
});
