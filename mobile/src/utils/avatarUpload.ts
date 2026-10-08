import { getApiBaseUrl } from "@/config/env";
import { isNetworkError, networkErrorMessage } from "@/api/errors";
import { getAccessToken } from "@/auth/tokenStorage";
import type { UserMe } from "@/context/AuthContext";
import { appendLocalImageToFormData } from "@/utils/multipartFormFile";
import { parseErrorDetail } from "@/api/client";

/**
 * Загрузка аватара: POST multipart, поле `file` → `POST /api/v1/auth/me/avatar`.
 */
export async function uploadProfileAvatar(
  localUri: string,
  mimeType?: string | null,
): Promise<UserMe> {
  const token = await getAccessToken();
  if (!token) throw new Error("Нет авторизации");

  const form = new FormData();
  await appendLocalImageToFormData(form, "file", localUri, "avatar", mimeType);

  let r: Response;
  try {
    r = await fetch(`${getApiBaseUrl()}/api/v1/auth/me/avatar`, {
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

  return data as UserMe;
}
