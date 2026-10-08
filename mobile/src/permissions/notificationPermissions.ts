import { Platform } from "react-native";

import {
  getExpoNotifications,
  IOS_NOTIFICATION_AUTHORIZED,
  IOS_NOTIFICATION_PROVISIONAL,
  isExpoGoClient,
} from "@/notifications/expoNotificationsNative";
import { showPermissionDeniedAlert } from "@/permissions/permissionAlert";
import {
  getAppPlatform,
  supportsNotifications,
  supportsWebNotifications,
} from "@/permissions/platform";

type NotificationPermissionStatus = {
  granted?: boolean;
  status?: string;
  ios?: { status?: number };
};

export function isNotificationGranted(status: NotificationPermissionStatus): boolean {
  if (status.granted) return true;
  if (status.status === "granted") return true;
  const ios = status.ios?.status;
  return (
    ios === IOS_NOTIFICATION_AUTHORIZED || ios === IOS_NOTIFICATION_PROVISIONAL
  );
}

function webPermissionDeniedAlert(): void {
  showPermissionDeniedAlert({
    title: "Уведомления",
    message:
      "Разрешите уведомления в настройках браузера (иконка замка в адресной строке).",
  });
}

/**
 * Web: вызвать из onPress/onValueChange **до любого await**, иначе браузер не покажет диалог.
 * Возвращает Promise, который резолвится после ответа пользователя.
 */
export function beginWebNotificationPermissionFromGesture(): Promise<boolean> | null {
  if (!supportsWebNotifications()) {
    return null;
  }

  const perm = window.Notification.permission;
  if (perm === "granted") {
    return Promise.resolve(true);
  }
  if (perm === "denied") {
    webPermissionDeniedAlert();
    return Promise.resolve(false);
  }

  return window.Notification.requestPermission().then((result) => {
    if (result === "granted") {
      return true;
    }
    webPermissionDeniedAlert();
    return false;
  });
}

async function ensureNativeNotificationPermission(): Promise<boolean> {
  const Notifications = getExpoNotifications();
  if (!Notifications) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (isNotificationGranted(current)) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  if (isNotificationGranted(requested)) {
    return true;
  }

  showPermissionDeniedAlert({
    title: "Уведомления",
    message:
      "Разрешите уведомления, чтобы получать напоминания о тренировках и новости реферальной программы.",
  });
  return false;
}

/** Текущий статус разрешения без throw на web / Expo Go. */
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") {
    if (!supportsWebNotifications()) {
      return false;
    }
    return window.Notification.permission === "granted";
  }

  const Notifications = getExpoNotifications();
  if (!Notifications) {
    return false;
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    return isNotificationGranted(current);
  } catch {
    return false;
  }
}

function unsupportedNotificationsMessage(): string {
  if (getAppPlatform() === "web") {
    return "Ваш браузер не поддерживает уведомления на этой странице.";
  }
  if (isExpoGoClient()) {
    return "Push-уведомления недоступны в Expo Go. Соберите development build (expo run:android / EAS Build) или установите APK.";
  }
  return "Уведомления доступны на физическом телефоне или планшете, не в эмуляторе без Google Play.";
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!supportsNotifications()) {
    showPermissionDeniedAlert({
      title: "Уведомления",
      message: unsupportedNotificationsMessage(),
    });
    return false;
  }

  if (Platform.OS === "web") {
    const started = beginWebNotificationPermissionFromGesture();
    if (!started) {
      return false;
    }
    return started;
  }

  return ensureNativeNotificationPermission();
}

/**
 * Включение уведомлений из UI: на web запрос разрешения стартует в том же тике, что и клик.
 */
export function runAfterNotificationPermissionGranted(
  action: () => void | Promise<void>,
): void {
  if (Platform.OS === "web") {
    const flow = beginWebNotificationPermissionFromGesture();
    if (!flow) {
      return;
    }
    void flow.then(async (ok) => {
      if (!ok) return;
      await action();
    });
    return;
  }

  void (async () => {
    const ok = await ensureNativeNotificationPermission();
    if (!ok) return;
    await action();
  })();
}
