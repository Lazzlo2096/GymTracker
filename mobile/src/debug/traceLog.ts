/**
 * Подробная трассировка действий в mobile для отладки последовательностей и таймингов.
 * В production (`__DEV__ === false`) все вызовы — no-op; Metro/console в dev: фильтр `[TRACE]`.
 *
 * Принудительно в dev-сборке: `EXPO_PUBLIC_TRACE=1` (если когда-нибудь понадобится вне __DEV__).
 */
export const TRACE_ENABLED =
  typeof __DEV__ !== "undefined"
    ? __DEV__ || process.env.EXPO_PUBLIC_TRACE === "1"
    : process.env.EXPO_PUBLIC_TRACE === "1";

const APP_START_MS = TRACE_ENABLED ? Date.now() : 0;

let seq = 0;
const openSpans = new Map<string, { label: string; category: TraceCategory; startedAt: number }>();

export type TraceCategory =
  | "NAV"
  | "API"
  | "FOCUS"
  | "PRESS"
  | "MODAL"
  | "AUTH"
  | "EVENT"
  | "STATE"
  | "PERF"
  | "SCREEN"
  | "HEALTH"
  | "LIFECYCLE";

export type TraceMeta = Record<string, unknown>;

function relMs(): number {
  return Date.now() - APP_START_MS;
}

function formatMeta(meta?: TraceMeta): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [meta unserializable]";
  }
}

/** Одно событие в логе. */
export function trace(category: TraceCategory, message: string, meta?: TraceMeta): void {
  if (!TRACE_ENABLED) return;
  seq += 1;
  const line = `[TRACE] [+${relMs()}ms #${String(seq).padStart(4, "0")}] [${category}] ${message}${formatMeta(meta)}`;
  console.log(line);
}

/** Начать измерение длительности; вернуть id для endSpan. */
export function traceSpanStart(
  category: TraceCategory,
  label: string,
  meta?: TraceMeta,
): string {
  if (!TRACE_ENABLED) return "";
  const id = `${category}:${label}:${++seq}`;
  openSpans.set(id, { label, category, startedAt: Date.now() });
  trace(category, `▶ START ${label}`, meta);
  return id;
}

/** Завершить span и залогировать длительность. */
export function traceSpanEnd(
  spanId: string,
  meta?: TraceMeta,
  level: "ok" | "error" | "cancel" = "ok",
): void {
  if (!TRACE_ENABLED || !spanId) return;
  const span = openSpans.get(spanId);
  if (!span) {
    trace("PERF", `⚠ span not found: ${spanId}`, meta);
    return;
  }
  openSpans.delete(spanId);
  const durationMs = Date.now() - span.startedAt;
  const suffix = level === "error" ? " ERROR" : level === "cancel" ? " CANCEL" : "";
  trace(span.category, `◀ END ${span.label} (${durationMs}ms)${suffix}`, {
    durationMs,
    ...meta,
  });
}

/** Обёртка async-функции с автоматическим span. */
export async function traceAsync<T>(
  category: TraceCategory,
  label: string,
  fn: () => Promise<T>,
  meta?: TraceMeta,
): Promise<T> {
  if (!TRACE_ENABLED) return fn();
  const spanId = traceSpanStart(category, label, meta);
  try {
    const result = await fn();
    traceSpanEnd(spanId, { ok: true });
    return result;
  } catch (e) {
    traceSpanEnd(spanId, { error: e instanceof Error ? e.message : String(e) }, "error");
    throw e;
  }
}

/** Обёртка onPress / обработчика нажатия. */
export function tracePress<T extends (...args: never[]) => void>(
  label: string,
  handler: T,
  meta?: TraceMeta,
): T {
  if (!TRACE_ENABLED) return handler;
  const wrapped = ((...args: Parameters<T>) => {
    trace("PRESS", label, meta);
    return handler(...args);
  }) as T;
  return wrapped;
}

/** Синхронное действие с логом. */
export function traceAction(category: TraceCategory, label: string, fn: () => void, meta?: TraceMeta): void {
  if (TRACE_ENABLED) trace(category, label, meta);
  fn();
}

/** Лог смены boolean-state (модалки, флаги). */
export function traceBoolState(
  category: TraceCategory,
  name: string,
  prev: boolean,
  next: boolean,
  meta?: TraceMeta,
): void {
  if (!TRACE_ENABLED || prev === next) return;
  trace(category, `${name}: ${prev} → ${next}`, meta);
}
