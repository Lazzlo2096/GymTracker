import { Linking, Platform } from "react-native";

import { resolveMediaUrl } from "@/utils/mediaUrl";

/** Открыть фото/медиа в браузере или системном просмотрщике. */
export async function openMediaUrl(path: string): Promise<void> {
  const url = resolveMediaUrl(path);
  if (!url) throw new Error("Нет URL");

  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const ok = await Linking.canOpenURL(url);
  if (!ok) throw new Error("Не удалось открыть ссылку");
  await Linking.openURL(url);
}

/** Скачать файл (на web — через <a download>, на native — открыть URL). */
export async function downloadMediaUrl(path: string, filename = "gym-photo.jpg"): Promise<void> {
  const url = resolveMediaUrl(path);
  if (!url) throw new Error("Нет URL");

  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  await openMediaUrl(path);
}
