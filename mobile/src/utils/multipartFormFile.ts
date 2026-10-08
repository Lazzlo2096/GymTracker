import { Platform } from "react-native";

function guessImageMime(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/** Добавляет локальное изображение в FormData (native uri + web Blob). */
export async function appendLocalImageToFormData(
  form: FormData,
  fieldName: string,
  localUri: string,
  baseName: string,
  mimeType?: string | null,
): Promise<void> {
  const extMatch = /\.([a-zA-Z0-9]+)(\?|$)/.exec(localUri);
  const ext = (extMatch?.[1] || "jpg").toLowerCase();
  const mime = mimeType?.trim() || guessImageMime(ext);
  const name = `${baseName}.${ext}`;

  if (Platform.OS === "web") {
    const res = await fetch(localUri);
    if (!res.ok) throw new Error("Не удалось прочитать файл");
    const blob = await res.blob();
    form.append(fieldName, blob, name);
    return;
  }

  form.append(fieldName, { uri: localUri, name, type: mime } as unknown as Blob);
}
