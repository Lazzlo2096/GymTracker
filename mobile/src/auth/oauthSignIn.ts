import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { getApiBaseUrl } from "@/config/env";
import { ensureBackendReachable } from "@/api/health";
import {
  authErrorMessage,
  fetchFailureMessage,
  httpErrorMessage,
  isNetworkError,
  missingAuthTokensMessage,
} from "@/api/errors";
import { peekRegisterPromo } from "@/auth/registerPromo";

export type OAuthProviderId = "google" | "vk" | "yandex";

function firstQueryParam(value: string | string[] | undefined | null): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Вход через OAuth: URL от backend → системный браузер → редирект в приложение с `code` → обмен на JWT.
 * В консолях провайдеров нужно зарегистрировать тот же `redirect_uri`, что возвращает `Linking.createURL('oauth')`.
 */
export async function oauthSignIn(provider: OAuthProviderId): Promise<{
  access_token: string;
  refresh_token: string;
}> {
  await ensureBackendReachable(true);
  const redirectUri = Linking.createURL("oauth");
  const startUrl = `${getApiBaseUrl()}/api/v1/auth/oauth/${provider}/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  let r: Response;
  try {
    r = await fetch(startUrl, { headers: { Accept: "application/json" } });
  } catch (e) {
    if (e instanceof Error && !isNetworkError(e)) throw e;
    throw new Error(fetchFailureMessage(e, startUrl));
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(httpErrorMessage(r.status, data));
  const authUrl = typeof (data as { auth_url?: unknown }).auth_url === "string" ? (data as { auth_url: string }).auth_url : "";
  if (!authUrl) throw new Error("Сервер не вернул ссылку для входа через провайдера");

  const browser = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (browser.type !== "success" || !("url" in browser) || !browser.url) {
    throw new Error("Вход отменён");
  }

  const parsed = Linking.parse(browser.url);
  const qp = parsed.queryParams;
  const code = firstQueryParam(qp?.code);
  const err = firstQueryParam(qp?.error);
  if (err) throw new Error(err === "access_denied" ? "Вход отменён" : err);
  if (!code) throw new Error("Провайдер не вернул код авторизации");

  const exchangeUrl = `${getApiBaseUrl()}/api/v1/auth/oauth/${provider}/exchange`;
  let ex: Response;
  try {
    const promo_code = peekRegisterPromo() ?? undefined;
    ex = await fetch(exchangeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        code,
        redirect_uri: redirectUri,
        ...(promo_code ? { promo_code } : {}),
      }),
    });
  } catch (e) {
    if (e instanceof Error && !isNetworkError(e)) throw e;
    throw new Error(fetchFailureMessage(e, exchangeUrl));
  }
  const exData = await ex.json().catch(() => ({}));
  if (!ex.ok) throw new Error(authErrorMessage(ex.status, exData));
  const tokens = exData as { access_token?: string; refresh_token?: string };
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(missingAuthTokensMessage());
  }
  return { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
}
