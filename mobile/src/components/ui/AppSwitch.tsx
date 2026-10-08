import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
  type SwitchProps,
  type ViewStyle,
} from "react-native";
import { trace } from "@/debug/traceLog";
import { useAppTheme } from "@/theme/appTheme";

type TrackColors = { false: string; true: string };

type Props = Omit<SwitchProps, "trackColor" | "thumbColor" | "ios_backgroundColor"> & {
  value: boolean;
  trackColor?: TrackColors;
  thumbColor?: string;
};

const WEB_TRACK_W = 51;
const WEB_TRACK_H = 31;
const WEB_THUMB = 27;
const WEB_PAD = 2;
const WEB_TRAVEL = WEB_TRACK_W - WEB_THUMB - WEB_PAD * 2;

/**
 * На web RN `Switch` — нативный checkbox (квадратный трек). Рисуем pill вручную.
 */
function WebToggle({
  value,
  onValueChange,
  disabled,
  track,
  thumb,
  style,
}: {
  value: boolean;
  onValueChange: SwitchProps["onValueChange"];
  disabled?: boolean | null;
  track: TrackColors;
  thumb: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled ?? false}
      onPress={() => {
        if (!disabled) {
          trace("PRESS", `switch → ${!value}`, { prev: value });
          onValueChange?.(!value);
        }
      }}
      style={[
        styles.webTrack,
        {
          backgroundColor: value ? track.true : track.false,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.webThumb,
          { backgroundColor: thumb, transform: [{ translateX: value ? WEB_TRAVEL : 0 }] },
        ]}
      />
    </Pressable>
  );
}

/** Switch: нативный на iOS/Android, pill-toggle на web (Chrome / Expo Web). */
export default function AppSwitch({
  value,
  trackColor,
  thumbColor,
  onValueChange,
  disabled,
  style,
  ...rest
}: Props) {
  const theme = useAppTheme();
  const track: TrackColors = trackColor ?? {
    false: theme.switchOff,
    true: theme.accentMuted,
  };
  const thumb = thumbColor ?? theme.switchThumb;

  if (Platform.OS === "web") {
    return (
      <WebToggle
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        track={track}
        thumb={thumb}
        style={StyleSheet.flatten(style) as ViewStyle | undefined}
      />
    );
  }

  return (
    <Switch
      {...rest}
      value={value}
      onValueChange={(next) => {
        trace("PRESS", `switch → ${next}`, { prev: value });
        onValueChange?.(next);
      }}
      disabled={disabled}
      style={style}
      trackColor={track}
      thumbColor={thumb}
      ios_backgroundColor={track.false}
    />
  );
}

const styles = StyleSheet.create({
  webTrack: {
    width: WEB_TRACK_W,
    height: WEB_TRACK_H,
    borderRadius: WEB_TRACK_H / 2,
    padding: WEB_PAD,
    flexShrink: 0,
    justifyContent: "center",
    cursor: "pointer",
  } as ViewStyle,
  webThumb: {
    width: WEB_THUMB,
    height: WEB_THUMB,
    borderRadius: WEB_THUMB / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
