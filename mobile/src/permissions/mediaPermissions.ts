import * as ImagePicker from "expo-image-picker";

import { showPermissionDeniedAlert } from "@/permissions/permissionAlert";
import {
  getAppPlatform,
  supportsCamera,
  supportsImageLibrary,
} from "@/permissions/platform";

type PermissionLike = {
  status?: string;
  granted?: boolean;
  accessPrivileges?: "all" | "limited" | "none";
};

export function isMediaLibraryGranted(response: PermissionLike): boolean {
  if (response.granted === true) return true;
  if (response.status === "granted") return true;
  if (
    response.accessPrivileges === "all" ||
    response.accessPrivileges === "limited"
  ) {
    return true;
  }
  return false;
}

export function isCameraGranted(response: PermissionLike): boolean {
  if (response.granted === true) return true;
  return response.status === "granted";
}

/**
 * Запрос доступа к галерее перед выбором фото (профиль, залы и т.д.).
 * На web системный диалог не нужен — открывается выбор файла.
 */
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  if (!supportsImageLibrary()) {
    return false;
  }

  // Web: системный диалог не нужен — браузер покажет выбор файла.
  if (getAppPlatform() === "web") {
    return true;
  }

  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (isMediaLibraryGranted(current)) {
    return true;
  }

  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (isMediaLibraryGranted(requested)) {
    return true;
  }

  showPermissionDeniedAlert({
    title: "Доступ к фото",
    message:
      "Разрешите доступ к галерее, чтобы выбирать и загружать изображения. Это можно сделать в настройках приложения.",
  });
  return false;
}

/** Запрос доступа к камере перед съёмкой. */
export async function ensureCameraPermission(): Promise<boolean> {
  if (!supportsCamera()) {
    showPermissionDeniedAlert({
      title: "Камера",
      message:
        getAppPlatform() === "web"
          ? "Съёмка с камеры в браузере недоступна. Выберите фото из галереи."
          : "Камера недоступна на этом устройстве.",
    });
    return false;
  }

  const current = await ImagePicker.getCameraPermissionsAsync();
  if (isCameraGranted(current)) {
    return true;
  }

  const requested = await ImagePicker.requestCameraPermissionsAsync();
  if (isCameraGranted(requested)) {
    return true;
  }

  showPermissionDeniedAlert({
    title: "Доступ к камере",
    message:
      "Разрешите доступ к камере, чтобы сделать фото. Это можно сделать в настройках приложения.",
  });
  return false;
}
