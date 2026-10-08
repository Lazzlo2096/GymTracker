import {
  getExpoPushToken,
  registerPushTokenOnServer,
} from "@/notifications/pushNotifications";

/** Зарегистрировать push-токен на сервере после выдачи разрешения пользователем. */
export async function registerPushAfterPermission(): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (token) {
      await registerPushTokenOnServer(token);
    }
  } catch (e) {
    console.warn("[push] register after permission failed", e);
  }
}
