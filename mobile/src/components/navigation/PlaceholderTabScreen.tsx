import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useBottomTabBarScrollPadding } from "@/components/navigation/bottomTabBarInset";
import ScreenEnterFrame from "@/components/navigation/ScreenEnterFrame";
import { fonts, type } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";

type Props = {
  title: string;
  description: string;
};

/** Заглушка вкладки нижней навигации до появления полноценного экрана. */
export default function PlaceholderTabScreen({ title, description }: Props) {
  const theme = useAppTheme();
  const bottomPad = useBottomTabBarScrollPadding(32);
  const styles = useMemo(() => createStyles(theme, bottomPad), [theme, bottomPad]);

  return (
    <ScreenEnterFrame direction="none">
      <View style={styles.root}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.sub}>{description}</Text>
      </View>
    </ScreenEnterFrame>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>, bottomPad: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
      paddingHorizontal: 28,
      paddingTop: 32,
      paddingBottom: bottomPad,
      justifyContent: "center",
    },
    title: {
      ...type.screenTitle,
      fontSize: 22,
      lineHeight: 28,
      color: theme.text,
      letterSpacing: -0.5,
    },
    sub: {
      marginTop: 12,
      fontFamily: fonts.regular,
      fontSize: 15,
      lineHeight: 22,
      color: theme.textMuted,
    },
  });
}
