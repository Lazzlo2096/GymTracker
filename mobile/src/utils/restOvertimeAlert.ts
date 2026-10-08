import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";

/** Красное кольцо и цифры таймера при превышении заданного времени отдыха. */
export const REST_OVERTIME_RED_TIMER = true;

const REST_OVERTIME_SOURCE = require("../../assets/sounds/rest-overtime.wav");

let player: ReturnType<typeof createAudioPlayer> | null = null;
let audioModeReady = false;

/** Звук + haptic при превышении заданного времени отдыха. */
export async function playRestOvertimeAlert(): Promise<void> {
  try {
    if (!audioModeReady) {
      await setAudioModeAsync({ playsInSilentMode: true });
      audioModeReady = true;
    }
    if (!player) {
      player = createAudioPlayer(REST_OVERTIME_SOURCE);
    } else {
      player.seekTo(0);
    }
    player.play();
  } catch {
    /* fallback ниже */
  }
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    /* ignore */
  }
}
