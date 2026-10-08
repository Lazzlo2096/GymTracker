import { getExpoNotifications } from "@/notifications/expoNotificationsNative";
import { supportsScheduledNotifications } from "@/permissions/platform";

/** За сколько часов до запланированной тренировки присылать напоминание (когда появится планирование). */
export const WORKOUT_REMINDER_HOURS_BEFORE = 3;

const REMINDER_PREFIX = "workout-reminder-";

export async function cancelWorkoutReminders(): Promise<void> {
  if (!supportsScheduledNotifications()) {
    return;
  }

  const Notifications = getExpoNotifications();
  if (!Notifications || typeof Notifications.getAllScheduledNotificationsAsync !== "function") {
    return;
  }

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier.startsWith(REMINDER_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    /* Expo Go / web / эмулятор — без красного экрана */
  }
}

/**
 * Локальные напоминания по фиксированному времени отключены.
 * После появления планирования тренировок — за {WORKOUT_REMINDER_HOURS_BEFORE} ч до начала.
 */
export async function syncWorkoutReminders(_options: {
  enabled: boolean;
  time?: string | null;
  weekdays?: string;
}): Promise<void> {
  await cancelWorkoutReminders();
}
