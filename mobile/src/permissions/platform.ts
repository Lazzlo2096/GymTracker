import * as Device from "expo-device";
import { Platform } from "react-native";

import { canLoadExpoNotificationsModule } from "@/notifications/expoNotificationsNative";

/** Текущая ОС приложения. */
export type AppPlatform = "ios" | "android" | "web";

export function getAppPlatform(): AppPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

/** Push на этом устройстве (не web, не Expo Go, физическое устройство). */
export function supportsNativePush(): boolean {
  return canLoadExpoNotificationsModule() && Device.isDevice;
}

/** Web Push / Notification API. */
export function supportsWebNotifications(): boolean {
  return Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window;
}

export function supportsNotifications(): boolean {
  return supportsNativePush() || supportsWebNotifications();
}

/** Локальные scheduled-уведомления — dev build / APK, не Expo Go. */
export function supportsScheduledNotifications(): boolean {
  return canLoadExpoNotificationsModule();
}

/** Камера (нативная съёмка). */
export function supportsCamera(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/** Выбор изображения из галереи / файлов. */
export function supportsImageLibrary(): boolean {
  return true;
}
