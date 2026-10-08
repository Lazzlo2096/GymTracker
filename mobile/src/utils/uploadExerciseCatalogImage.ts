import { getApiBaseUrl } from "@/config/env";
import { isNetworkError, networkErrorMessage } from "@/api/errors";
import { parseErrorDetail } from "@/api/client";
import { getAccessToken } from "@/auth/tokenStorage";
import { appendLocalImageToFormData } from "@/utils/multipartFormFile";

/** Загрузка фото упражнения в каталоге: POST multipart, поле `file`. */
export async function uploadExerciseCatalogImage(
  catalogId: number,
  localUri: string,
  mimeType?: string | null,
): Promise<{ image: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error("Нет авторизации");

  const form = new FormData();
  await appendLocalImageToFormData(form, "file", localUri, "exercise", mimeType);

  let r: Response;
  try {
    r = await fetch(`${getApiBaseUrl()}/api/v1/exercises_in_catalog/${catalogId}/image`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
  } catch (e) {
    if (isNetworkError(e)) throw new Error(networkErrorMessage(e));
    throw e;
  }

  const data = (await r.json().catch(() => ({}))) as { image?: string };
  if (!r.ok) {
    throw new Error(parseErrorDetail(data));
  }
  if (typeof data.image !== "string" || !data.image.trim()) {
    throw new Error("Сервер не вернул URL изображения");
  }
  return { image: data.image };
}
