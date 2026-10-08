import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Базовый URL backend API (без `/` в конце).
 *
 * `EXPO_PUBLIC_API_URL` / `extra.apiUrl` с `127.0.0.1` на телефоне (Expo Go) не работают —
 * подставляем IP dev-сервера Metro (`hostUri`), если он в LAN.
 */
function stripSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

/** IP компа из Expo (Metro), не loopback — для Expo Go / эмулятора. */
function getExpoDevLanHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    ((Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
      null);
  if (!hostUri) return null;
  const host = String(hostUri).split(":")[0]?.trim();
  if (!host || isLoopback(host)) return null;
  return host;
}

function portOf(url: string): string {
  try {
    const p = new URL(url).port;
    return p || "8000";
  } catch {
    return "8000";
  }
}

function resolveConfiguredUrl(configured: string): string {
  const base = stripSlash(configured);
  if (Platform.OS === "web") return base;
  const h = hostOf(base);
  if (h && isLoopback(h)) {
    const port = portOf(base);
    // Android-эмулятор: 127.0.0.1 — это сам эмулятор, не хост с Docker.
    if (Platform.OS === "android") return `http://10.0.2.2:${port}`;
    const lan = getExpoDevLanHost();
    if (lan) return `http://${lan}:${port}`;
  }
  return base;
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return resolveConfiguredUrl(fromEnv);

  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  if (extra?.apiUrl?.trim()) return resolveConfiguredUrl(String(extra.apiUrl).trim());

  const lan = getExpoDevLanHost();
  if (lan) return `http://${lan}:8000`;

  return "http://127.0.0.1:8000";
}

/** @deprecated Prefer `getApiBaseUrl()` — на native URL может зависеть от Expo hostUri. */
export const API_BASE_URL = getApiBaseUrl();
