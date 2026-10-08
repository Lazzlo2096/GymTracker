import { parseErrorDetail } from "@/api/client";
import { getApiBaseUrl } from "@/config/env";
import { Platform } from "react-native";

export type FetchFailureKind = "wrong_url" | "cors" | "network";

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

export function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /network request failed|failed to fetch|network error|timeout|econnrefused|abort/i.test(
    msg,
  );
}

/**
 * Классификация падения fetch без ответа HTTP.
 * wrong_url — заведомо неверный EXPO_PUBLIC_API_URL;
 * cors — web, cross-origin, запрос не дошёл;
 * network — офлайн, backend выключен, таймаут и т.п.
 */
export function classifyFetchFailure(
  error: unknown,
  requestUrl: string = getApiBaseUrl(),
): FetchFailureKind {
  const parsed = parseUrl(requestUrl);
  if (!parsed) return "wrong_url";

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const pageHost = window.location.hostname;
    const apiHost = parsed.hostname;

    if (isLoopbackHost(apiHost) && !isLoopbackHost(pageHost)) {
      return "wrong_url";
    }

    if (isNetworkError(error) && parsed.origin !== window.location.origin) {
      return "cors";
    }
  }

  return "network";
}

export function wrongApiUrlMessage(requestUrl: string = getApiBaseUrl()): string {
  return (
    `Неверный адрес API (${requestUrl}). ` +
    "В браузере на телефоне укажите IP компьютера в Wi‑Fi в EXPO_PUBLIC_API_URL, не 127.0.0.1."
  );
}

export function corsErrorMessage(): string {
  return (
    "Браузер заблокировал запрос к API (CORS). " +
    "Добавьте origin этого приложения в CORS на backend " +
    "(CORS_ALLOWED_ORIGINS или CORS_ALLOW_ORIGIN_REGEX)."
  );
}

export function networkFailureMessage(): string {
  return "Не удалось связаться с сервером. Проверьте интернет и что backend запущен.";
}

export function fetchFailureMessage(error: unknown, requestUrl?: string): string {
  const url = requestUrl ?? getApiBaseUrl();
  const kind = classifyFetchFailure(error, url);
  if (kind === "wrong_url") return wrongApiUrlMessage(url);
  if (kind === "cors") return corsErrorMessage();
  return networkFailureMessage();
}

/** @deprecated Используйте fetchFailureMessage(error). */
export function connectionErrorMessage(error?: unknown, requestUrl?: string): string {
  if (error !== undefined) return fetchFailureMessage(error, requestUrl);
  return networkFailureMessage();
}

/** @deprecated Используйте fetchFailureMessage(error). */
export function networkErrorMessage(error?: unknown, requestUrl?: string): string {
  return connectionErrorMessage(error, requestUrl);
}

/** GET /health вернул 503 — backend жив, но зависимости недоступны. */
export function backendUnavailableMessage(): string {
  return "Сервер временно недоступен (проверка health: 503). Попробуйте позже.";
}

/** GET /health вернул неуспешный статус (не 503). */
export function backendHealthErrorMessage(status: number): string {
  if (status === 404) {
    return wrongApiUrlMessage();
  }
  return `Сервер ответил на проверку связи кодом ${status}. Убедитесь, что backend запущен.`;
}

/** HTTP 5xx на login, register и других запросах. */
export function serverErrorMessage(status?: number): string {
  const suffix = status ? ` (код ${status})` : "";
  return `Ошибка на сервере${suffix}. Попробуйте позже.`;
}

/** Успешный ответ login/OAuth без JWT в теле. */
export function missingAuthTokensMessage(): string {
  return "Сервер не вернул токены авторизации. Попробуйте снова.";
}

/** Вход: по HTTP-статусу и телу ответа. */
export function authErrorMessage(status: number, data: unknown): string {
  if (status === 401) return "Неверный email или пароль";
  if (status === 404) return wrongApiUrlMessage();
  if (status === 503) return backendUnavailableMessage();
  if (status >= 500) return serverErrorMessage(status);
  const detail = parseErrorDetail(data);
  if (detail !== "Ошибка запроса") return detail;
  if (status === 400 || status === 422) return "Проверьте введённые данные";
  return "Не удалось войти";
}

/** Регистрация. */
export function registerErrorMessage(status: number, data: unknown): string {
  if (status === 409) return "Такой email или логин уже занят";
  if (status === 503) return backendUnavailableMessage();
  if (status >= 500) return serverErrorMessage(status);
  const detail = parseErrorDetail(data);
  if (detail !== "Ошибка запроса") return detail;
  if (status === 400 || status === 422) return "Проверьте введённые данные";
  return "Не удалось зарегистрироваться";
}

/** Прочие API-запросы. */
export function httpErrorMessage(status: number, data: unknown): string {
  if (status === 503) return backendUnavailableMessage();
  if (status >= 500) return serverErrorMessage(status);
  if (status === 401) return "Требуется вход";
  if (status === 403) return "Доступ запрещён";
  if (status === 404) return "Не найдено";
  const detail = parseErrorDetail(data);
  if (detail !== "Ошибка запроса") return detail;
  if (status >= 400) return "Не удалось выполнить запрос";
  return "Ошибка запроса";
}

export function toUserFacingError(error: unknown, fallback = "Ошибка"): string {
  if (error instanceof Error && error.message && !isNetworkError(error)) {
    return error.message;
  }
  if (isNetworkError(error)) return fetchFailureMessage(error);
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
