import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";
import type { OAuthProviderId } from "@/auth/oauthSignIn";
import { GoogleOAuthIcon, VkOAuthIcon, YandexOAuthIcon } from "@/components/auth/OAuthBrandIcons";

const ICON_SIZE = 24;
/** Квадрат кнопки ~48dp — удобный тап и близко к типовым мобильным макетам auth. */
const BUTTON_SIZE = 48;

type Props = {
  busyProvider: OAuthProviderId | null;
  onPress: (provider: OAuthProviderId) => void;
};

export default function OAuthSocialRow({ busyProvider, onPress }: Props) {
  const anyBusy = busyProvider !== null;

  const cell = (provider: OAuthProviderId, node: React.ReactNode) => (
    <Pressable
      key={provider}
      style={({ pressed }) => [
        styles.socialBtn,
        { borderColor: colors.primary },
        pressed && styles.socialBtnPressed,
        anyBusy && styles.socialBtnDisabled,
      ]}
      disabled={anyBusy}
      onPress={() => onPress(provider)}
      accessibilityLabel={
        provider === "google" ? "Войти через Google" : provider === "vk" ? "Войти через VK" : "Войти через Яндекс"
      }
    >
      {busyProvider === provider ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={styles.iconWrap}>{node}</View>
      )}
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {cell("google", <GoogleOAuthIcon size={ICON_SIZE} />)}
      {cell("yandex", <YandexOAuthIcon size={ICON_SIZE} />)}
      {cell("vk", <VkOAuthIcon size={ICON_SIZE} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 6,
    marginBottom: 6,
  },
  socialBtn: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  socialBtnPressed: {
    opacity: 0.88,
  },
  socialBtnDisabled: {
    opacity: 0.65,
  },
});
