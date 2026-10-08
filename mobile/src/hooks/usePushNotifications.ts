import { useEffect, useRef } from "react";

import type { UserMe } from "@/context/AuthContext";
import { hasNotificationPermission } from "@/permissions/notificationPermissions";
import {
  getDeviceTimezone,
  getExpoPushToken,
  registerPushTokenOnServer,
  unregisterPushTokenOnServer,
} from "@/notifications/pushNotifications";
import { cancelWorkoutReminders } from "@/notifications/scheduleWorkoutReminders";
import { apiFetch } from "@/api/client";

async function syncTimezoneIfNeeded(user: UserMe): Promise<void> {
  const tz = getDeviceTimezone();
  if (user.workout_reminder_timezone === tz) return;
  await apiFetch("/api/v1/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workout_reminder_timezone: tz }),
  });
}

type Options = {
  user: UserMe | null;
};

/**
 * Синхронизация push-токена и отмена напоминаний по настройкам профиля.
 * Запрос разрешения ОС — только при включении переключателя в профиле (runAfterNotificationPermissionGranted).
 */
export function usePushNotifications({ user }: Options) {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      if (!user.settings_notifications) {
        if (tokenRef.current) {
          try {
            await unregisterPushTokenOnServer(tokenRef.current);
          } catch {
            /* ignore */
          }
          tokenRef.current = null;
        }
        await cancelWorkoutReminders();
        return;
      }

      const granted = await hasNotificationPermission();
      if (!granted || cancelled) {
        await cancelWorkoutReminders();
        return;
      }

      try {
        await syncTimezoneIfNeeded(user);
      } catch {
        /* non-fatal */
      }

      try {
        const token = await getExpoPushToken();
        if (token && !cancelled) {
          await registerPushTokenOnServer(token);
          tokenRef.current = token;
        }
      } catch (e) {
        console.warn("[push] register failed", e);
      }

      await cancelWorkoutReminders();
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.settings_notifications, user?.settings_workout_reminders]);
}
