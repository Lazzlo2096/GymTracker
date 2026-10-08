import {
  Platform,
  StyleSheet,
  type PressableStateCallbackType,
  type ViewStyle,
} from "react-native";

type WebCursorStyle = ViewStyle & { cursor?: "pointer" | "default" };
type StyleInput = ViewStyle | false | null | undefined;

const WEB_POINTER: WebCursorStyle = Platform.OS === "web" ? { cursor: "pointer" } : {};

function flattenStyle(style?: StyleInput | StyleInput[]): ViewStyle | null {
  if (!style) return null;
  return StyleSheet.flatten(style) ?? null;
}

/**
 * Единый стиль для кликабельных элементов:
 * - web: cursor pointer + hover
 * - android/ios: только pressed (hover на touch не срабатывает)
 */
export function pressableStyle(
  base: StyleInput | StyleInput[],
  opts?: {
    hover?: StyleInput | StyleInput[];
    pressed?: StyleInput | StyleInput[];
    disabled?: boolean;
  },
) {
  const baseArr = Array.isArray(base) ? base : [base];
  return ({ hovered, pressed }: PressableStateCallbackType) => [
    ...baseArr,
    WEB_POINTER,
    opts?.disabled ? { opacity: 0.55 } : null,
    hovered ? flattenStyle(opts?.hover) : null,
    pressed ? flattenStyle(opts?.pressed) : null,
  ];
}

