/**
 * Цвета интерфейса (логин/регистрация, FAB) — в одной гамме с метриками приложения (violet).
 */
export const colors = {
  primary: "#752CD2",
  text: "#0f172a",
  textSecondary: "#475569",
  muted: "#64748b",
  placeholder: "#94A3B8",
  border: "#e6e3f0",
  surface: "#ffffff",
  pageBg: "#f8f7fc",
  chipBg: "#EEE9FF",
  primarySoft: "#EEE9FF",
  primarySoftBg: "#f3f0fa",
  dangerBg: "#fee2e2",
  /** Текст ошибок и валидации (контрастнее, чем dangerText для кнопок «Выйти»). */
  error: "#dc2626",
  dangerText: "#b91c1c",
  successSoft: "rgba(34,197,94,0.25)",
} as const;
