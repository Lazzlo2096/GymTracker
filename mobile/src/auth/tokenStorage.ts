import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * На iOS/Android — SecureStore. На web у модуля нет нативной реализации (пустой stub),
 * поэтому для dev/web — localStorage (менее безопасно при XSS; для prod web лучше cookies).
 */
const ACCESS_KEY = "gymtracker_access_token";
const REFRESH_KEY = "gymtracker_refresh_token";

const isWeb = Platform.OS === "web";

function webGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function webRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (isWeb) return webGet(ACCESS_KEY);
  try {
    return await SecureStore.getItemAsync(ACCESS_KEY);
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (isWeb) return webGet(REFRESH_KEY);
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  if (isWeb) {
    webSet(ACCESS_KEY, access);
    webSet(REFRESH_KEY, refresh);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  if (isWeb) {
    webRemove(ACCESS_KEY);
    webRemove(REFRESH_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
}
