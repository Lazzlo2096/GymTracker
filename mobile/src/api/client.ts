import { getApiBaseUrl } from "@/config/env";
import { ensureBackendReachable } from "@/api/health";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/auth/tokenStorage";
import { trace, traceSpanEnd, traceSpanStart } from "@/debug/traceLog";
import { emit } from "@/utils/eventBus";

/** Событие для `AuthProvider`: токены очищены после неудачного refresh — сбросить пользователя в памяти. */
export const AUTH_SESSION_INVALID_EVENT = "auth:session-invalid";

async function clearSessionAfterFailedRefresh(): Promise<void> {
  await clearTokens();
  emit(AUTH_SESSION_INVALID_EVENT);
}

/** Один общий промис refresh, чтобы не дёргать `/auth/refresh` параллельно из нескольких запросов. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const spanId = traceSpanStart("AUTH", "token refresh");
  const refresh = await getRefreshToken();
  if (!refresh) {
    traceSpanEnd(spanId, { reason: "no refresh token" }, "cancel");
    return false;
  }
  try {
    const r = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${refresh}`,
      },
    });
    if (!r.ok) {
      await clearSessionAfterFailedRefresh();
      traceSpanEnd(spanId, { status: r.status }, "error");
      return false;
    }
    const data = (await r.json()) as { access_token?: string; refresh_token?: string };
    if (!data.access_token || !data.refresh_token) {
      await clearSessionAfterFailedRefresh();
      traceSpanEnd(spanId, { reason: "invalid token payload" }, "error");
      return false;
    }
    await setTokens(data.access_token, data.refresh_token);
    traceSpanEnd(spanId, { status: r.status });
    return true;
  } catch (e) {
    await clearSessionAfterFailedRefresh();
    traceSpanEnd(spanId, { error: e instanceof Error ? e.message : String(e) }, "error");
    return false;
  }
}

async function ensureRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshTokens().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * HTTP-клиент к API: подставляет `Authorization: Bearer <access>`.
 * При ответе 401 (кроме самого refresh) пытается обновить токены и повторить запрос один раз.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const spanId = traceSpanStart("API", `${method} ${path}`, {
    hasBody: !!init.body,
  });
  const access = await getAccessToken();
  // После входа достаточно самого запроса с Bearer; health — только до логина (login/register/OAuth).
  if (!access && !path.includes("/api/v1/health")) {
    trace("HEALTH", "ensureBackendReachable before anonymous apiFetch", { path });
    await ensureBackendReachable();
  }
  const url = path.startsWith("http") ? path : `${getApiBaseUrl()}${path}`;
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  if (access) headers.set("Authorization", `Bearer ${access}`);

  let res = await fetch(url, { ...init, headers });
  let retried = false;

  if (res.status === 401 && !path.includes("/auth/refresh")) {
    trace("AUTH", "apiFetch 401 → attempting refresh", { path, method });
    const ok = await ensureRefresh();
    if (ok) {
      retried = true;
      const a2 = await getAccessToken();
      const h2 = new Headers(init.headers);
      if (!h2.has("Accept")) h2.set("Accept", "application/json");
      if (a2) h2.set("Authorization", `Bearer ${a2}`);
      res = await fetch(url, { ...init, headers: h2 });
    }
  }

  traceSpanEnd(spanId, {
    status: res.status,
    ok: res.ok,
    retried,
    url,
  });
  trace("API", `${method} ${path} → ${res.status}`, { retried, ok: res.ok });

  return res;
}

/** Разбор `detail` из тела ошибки FastAPI (строка, массив объектов с `msg`, и т.д.). */
export function parseErrorDetail(data: unknown): string {
  if (!data || typeof data !== "object") return "Ошибка запроса";
  const d = (data as { detail?: unknown }).detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((x) =>
        typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : JSON.stringify(x)
      )
      .join(", ");
  }
  return "Ошибка запроса";
}
