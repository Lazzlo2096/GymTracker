import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { uiAccentFg, uiAccentMuted, uiAccentSoft } from "@/theme/metricTokens";

export function useIsDarkTheme() {
  const { user } = useAuth();
  return Boolean(user?.settings_dark_theme);
}

export function useAppTheme() {
  const dark = useIsDarkTheme();
  return useMemo(
    () => ({
      dark,
      bg: dark ? "#15101F" : "#F8F7FC",
      card: dark ? "#221C2E" : "#FFFFFF",
      cardSoft: uiAccentSoft(dark),
      text: dark ? "#F4F0FB" : "#11142D",
      textMuted: dark ? "#A89BC4" : "#5C5870",
      textPlaceholder: dark ? "#8E839F" : "#A39FB0",
      border: dark ? "#332A44" : "#E6E3F0",
      divider: dark ? "#332A44" : "#ECEAF2",
      overlay: dark ? "rgba(9,7,14,0.62)" : "rgba(24, 20, 40, 0.45)",
      accent: uiAccentFg(dark),
      accentMuted: uiAccentMuted(dark),
      accentSoft: uiAccentSoft(dark),
      white: "#FFFFFF",
      danger: "#dc2626",
      /** Трек Switch в выкл. состоянии: в тёмной теме светлее карточки, чтобы рычаг читался. */
      switchOff: dark ? "#7C7694" : "#DADCE6",
      switchThumb: "#FFFFFF",
    }),
    [dark]
  );
}
