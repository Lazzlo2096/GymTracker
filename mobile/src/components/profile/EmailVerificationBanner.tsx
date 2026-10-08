import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, type } from "@/theme/typography";
import { pressableStyle } from "@/utils/pressableStyles";

type Colors = {
  card: string;
  accent: string;
  softPurple: string;
  text: string;
  muted: string;
};

type Props = {
  onPress: () => void;
  colors: Colors;
};

export default function EmailVerificationBanner({ onPress, colors }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card },
        pressableStyle(pressed, 0.98),
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Аккаунт не верифицирован. Нажмите для подтверждения почты"
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.softPurple }]}>
        <Ionicons name="mail-unread-outline" size={22} color={colors.accent} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Аккаунт не верифицирован</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Подтвердите email</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#190A3D",
    shadowOpacity: 0.055,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, minWidth: 0 },
  title: {
    ...type.body,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
});
