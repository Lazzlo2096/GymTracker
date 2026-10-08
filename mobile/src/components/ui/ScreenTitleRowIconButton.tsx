import React from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { tracePress } from "@/debug/traceLog";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const SIZE = 42;
const RADIUS = 21;

/** Круглая кнопка в ряду с заголовком экрана (как «Аналитика» в истории тренировок): без обводки, фон `cardSoft`. */
export function screenTitleRowIconCircleStyle(backgroundColor: string): ViewStyle {
  return {
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor,
  };
}

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** По умолчанию `theme.cardSoft` из палитры приложения. */
  backgroundColor?: string;
  children: React.ReactNode;
};

export default function ScreenTitleRowIconButton({
  style,
  backgroundColor,
  children,
  hitSlop = 8,
  accessibilityRole = "button",
  onPress,
  accessibilityLabel,
  ...rest
}: Props) {
  const theme = useAppTheme();
  const bg = backgroundColor ?? theme.cardSoft;
  const tracedOnPress =
    onPress && typeof onPress === "function"
      ? tracePress(`titleBtn: ${accessibilityLabel ?? "icon"}`, onPress as () => void)
      : onPress;
  return (
    <Pressable
      {...rest}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      onPress={tracedOnPress}
      style={pressableStyle(
        [screenTitleRowIconCircleStyle(bg), (style as ViewStyle) ?? {}],
        {
          hover: { opacity: 0.9 },
          pressed: { opacity: 0.85 },
          disabled: Boolean((rest as { disabled?: boolean }).disabled),
        },
      )}
    >
      {children}
    </Pressable>
  );
}
