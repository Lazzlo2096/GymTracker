import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

async function saveJsonOnWeb(json: string, filename: string): Promise<void> {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function saveJsonOnNative(
  json: string,
  filename: string,
  shareDialogTitle: string,
): Promise<void> {
  const baseDir = FileSystem.cacheDirectory;
  if (!baseDir) {
    throw new Error("Файловая система недоступна на этом устройстве.");
  }

  const fileUri = `${baseDir}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("На устройстве недоступен диалог сохранения файла.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/json",
    dialogTitle: shareDialogTitle,
    UTI: "public.json",
  });
}

/** Сохраняет JSON как файл: в браузере — скачивание, на устройстве — системный share. */
export async function saveJsonFile(
  json: string,
  filename: string,
  shareDialogTitle: string,
): Promise<void> {
  if (Platform.OS === "web") {
    await saveJsonOnWeb(json, filename);
    return;
  }

  await saveJsonOnNative(json, filename, shareDialogTitle);
}
