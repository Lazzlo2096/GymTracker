import Constants from "expo-constants";
import { Platform } from "react-native";

export type ExpoNotificationsModule = typeof import("expo-notifications");

/** Expo Go (SDK 53+): при загрузке модуля падает с ошибкой про remote push на Android. */
export function isExpoGoClient(): boolean {
  return (
    Constants.appOwnership === "expo" ||
    Constants.executionEnvironment === "storeClient"
  );
}

/** Можно безопасно вызвать `require("expo-notifications")` (не web, не Expo Go). */
export function canLoadExpoNotificationsModule(): boolean {
  return Platform.OS !== "web" && !isExpoGoClient();
}

let cached: ExpoNotificationsModule | null | undefined;

/**
 * Ленивая загрузка native-модуля. На web / Expo Go — null, без красного экрана.
 */
export function getExpoNotifications(): ExpoNotificationsModule | null {
  if (!canLoadExpoNotificationsModule()) {
    return null;
  }
  if (cached !== undefined) {
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("expo-notifications") as ExpoNotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** iOS AuthorizationStatus без импорта модуля на верхнем уровне. */
export const IOS_NOTIFICATION_AUTHORIZED = 2;
export const IOS_NOTIFICATION_PROVISIONAL = 3;
