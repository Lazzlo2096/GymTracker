import { Platform } from "react-native";
import Constants from "expo-constants";

import { apiFetch } from "@/api/client";
import { getExpoNotifications } from "@/notifications/expoNotificationsNative";
import { supportsNativePush } from "@/permissions/platform";

function initNotificationHandler(): void {
  const Notifications = getExpoNotifications();
  if (!Notifications || !supportsNativePush()) {
    return;
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

initNotificationHandler();

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!supportsNativePush()) {
    return null;
  }

  const Notifications = getExpoNotifications();
  if (!Notifications) {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[push] missing EAS projectId in app.json");
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

export async function registerPushTokenOnServer(token: string): Promise<void> {
  const platform =
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS === "web"
        ? "web"
        : "android";

  const r = await apiFetch("/api/v1/push-tokens/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expo_push_token: token, platform }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(
      typeof d.detail === "string" ? d.detail : "Не удалось зарегистрировать push-токен",
    );
  }
}

export async function unregisterPushTokenOnServer(token: string): Promise<void> {
  await apiFetch("/api/v1/push-tokens/", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expo_push_token: token }),
  });
}
