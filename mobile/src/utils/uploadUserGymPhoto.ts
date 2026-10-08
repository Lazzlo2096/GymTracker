import { getApiBaseUrl } from "@/config/env";
import { isNetworkError, networkErrorMessage } from "@/api/errors";
import { parseErrorDetail } from "@/api/client";
import { getAccessToken } from "@/auth/tokenStorage";
import { appendLocalImageToFormData } from "@/utils/multipartFormFile";

/** Загрузка фото в галерею зала: POST multipart, поле `file`. */
export async function uploadUserGymGalleryPhoto(
  gymId: number,
  localUri: string,
  mimeType?: string | null,
): Promise<unknown> {
  const token = await getAccessToken();
  if (!token) throw new Error("Нет авторизации");

  const form = new FormData();
  await appendLocalImageToFormData(form, "file", localUri, "gym", mimeType);

  let r: Response;
  try {
    r = await fetch(`${getApiBaseUrl()}/api/v1/user_gyms/${gymId}/gallery`, {
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

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(parseErrorDetail(data));
  }
  return data;
}
