/**
 * Разрешения приложения (запрос только по действию пользователя):
 *
 * | Разрешение        | iOS | Android | Web              | Когда запрашиваем                          |
 * |-------------------|-----|---------|------------------|--------------------------------------------|
 * | Галерея / фото    | да  | да      | выбор файла      | Загрузка аватара, фото зала                |
 * | Камера            | да  | да      | нет              | Аватар → «Камера»                          |
 * | Уведомления       | да  | да      | Notification API | Вкл. «Уведомления» / «Напоминания», время  |
 *
 * OAuth, интернет, вибрация — без runtime-разрешений.
 */

export { showPermissionDeniedAlert } from "@/permissions/permissionAlert";
export {
  getAppPlatform,
  supportsCamera,
  supportsImageLibrary,
  supportsNativePush,
  supportsNotifications,
  supportsScheduledNotifications,
  supportsWebNotifications,
} from "@/permissions/platform";
export {
  ensureCameraPermission,
  ensureMediaLibraryPermission,
  isCameraGranted,
  isMediaLibraryGranted,
} from "@/permissions/mediaPermissions";
export {
  pickImageFromLibrary,
  takePhotoWithCamera,
  type PickImageOptions,
} from "@/permissions/imagePickerActions";
export {
  beginWebNotificationPermissionFromGesture,
  ensureNotificationPermission,
  hasNotificationPermission,
  isNotificationGranted,
  runAfterNotificationPermissionGranted,
} from "@/permissions/notificationPermissions";
