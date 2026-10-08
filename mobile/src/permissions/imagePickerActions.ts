import * as ImagePicker from "expo-image-picker";

import {
  ensureCameraPermission,
  ensureMediaLibraryPermission,
} from "@/permissions/mediaPermissions";

export type PickImageOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
};

/**
 * Выбор фото из галереи (или файлов на web) с предварительным запросом разрешения.
 */
export async function pickImageFromLibrary(
  options: PickImageOptions = {},
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (!(await ensureMediaLibraryPermission())) {
    return null;
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: options.allowsEditing ?? false,
    aspect: options.aspect,
    quality: options.quality ?? 0.85,
  });

  if (res.canceled || !res.assets?.[0]) {
    return null;
  }
  return res.assets[0];
}

/**
 * Съёмка фото камерой с предварительным запросом разрешения.
 */
export async function takePhotoWithCamera(
  options: PickImageOptions = {},
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (!(await ensureCameraPermission())) {
    return null;
  }

  const res = await ImagePicker.launchCameraAsync({
    allowsEditing: options.allowsEditing ?? true,
    aspect: options.aspect ?? [1, 1],
    quality: options.quality ?? 0.85,
  });

  if (res.canceled || !res.assets?.[0]) {
    return null;
  }
  return res.assets[0];
}
