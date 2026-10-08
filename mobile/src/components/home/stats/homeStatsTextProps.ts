import { Platform, type TextProps } from "react-native";

/** Мелкий текст в блоках статистики на главной — чётче на Android и без дробного масштаба. */
export const homeStatsTextProps: TextProps =
  Platform.OS === "android"
    ? { includeFontPadding: false, allowFontScaling: false }
    : { allowFontScaling: false };
