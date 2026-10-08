import { getApiBaseUrl } from "@/config/env";
import {
  backendHealthErrorMessage,
  backendUnavailableMessage,
  fetchFailureMessage,
} from "@/api/errors";

import { trace, traceSpanEnd, traceSpanStart } from "@/debug/traceLog";

export type HealthStatus = "ok" | "degraded" | "unhealthy";

export type HealthPayload = {
  status: HealthStatus;
  service: string;
  checks: { postgres: string; redis: string };
  resources: {
    cpu_percent: number;
    memory_percent: number;
    disk_used_percent: number;
    disk_free_percent: number;
  };
  warnings: string[];
};

const HEALTH_PATH = "/api/v1/health";
const CACHE_MS = 20_000;

let lastOkAt = 0;

function healthUrl(): string {
  return `${getApiBaseUrl()}${HEALTH_PATH}`;
}

/**
 * Проверка, что API отвечает до входа (login / register / OAuth).
 * С авторизованным access token `apiFetch` health не вызывает.
 * Кэш ~20 с на случай нескольких анонимных запросов подряд.
 */
export async function ensureBackendReachable(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastOkAt < CACHE_MS) {
    trace("HEALTH", "ensureBackendReachable cache hit", { ageMs: now - lastOkAt });
    return;
  }

  const spanId = traceSpanStart("HEALTH", "ensureBackendReachable", { force });
  let res: Response;
  try {
    res = await fetch(healthUrl(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    traceSpanEnd(spanId, { error: e instanceof Error ? e.message : String(e) }, "error");
    throw new Error(fetchFailureMessage(e, healthUrl()));
  }

  if (res.status === 503) {
    traceSpanEnd(spanId, { status: 503 }, "error");
    throw new Error(backendUnavailableMessage());
  }
  if (!res.ok) {
    traceSpanEnd(spanId, { status: res.status }, "error");
    throw new Error(backendHealthErrorMessage(res.status));
  }

  lastOkAt = now;
  traceSpanEnd(spanId, { status: res.status });
}

export async function fetchHealth(): Promise<HealthPayload> {
  const res = await fetch(healthUrl(), { headers: { Accept: "application/json" } });
  if (res.status === 503) {
    throw new Error(backendUnavailableMessage());
  }
  if (!res.ok) {
    throw new Error(backendHealthErrorMessage(res.status));
  }
  return (await res.json()) as HealthPayload;
}
