import { API_BASE_URL } from "@/config/env";

/** Полный URL для относительных путей медиа (`/media/...`). */
export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}
