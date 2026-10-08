import { useMemo } from "react";
import { useAppTheme } from "@/theme/appTheme";

/** Светлая палитра по умолчанию (fallback для мест без hook) — в тон метрикам (violet). */
export const catalogUi = {
  accent: "#752CD2",
  accentSoft: "#EEE9FF",
  accentMuted: "#8B7CAD",
  text: "#11142D",
  textMuted: "#5C5870",
  textPlaceholder: "#A39FB0",
  border: "#E6E3F0",
  pageBg: "#F8F7FC",
  cardBg: "#FFFFFF",
  pillBg: "#EDE9FE",
  iconCircleBg: "#EDE9FE",
} as const;

export function useCatalogUi() {
  const theme = useAppTheme();
  return useMemo(
    () => ({
      dark: theme.dark,
      accent: theme.accent,
      accentSoft: theme.accentSoft,
      accentMuted: theme.accentMuted,
      text: theme.text,
      textMuted: theme.textMuted,
      textPlaceholder: theme.textPlaceholder,
      border: theme.border,
      pageBg: theme.bg,
      cardBg: theme.card,
      cardSoft: theme.cardSoft,
      pillBg: theme.accentSoft,
      iconCircleBg: theme.cardSoft,
      switchOff: theme.switchOff,
      switchThumb: theme.switchThumb,
    }),
    [theme]
  );
}
