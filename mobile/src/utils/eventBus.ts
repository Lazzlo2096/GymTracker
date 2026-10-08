import { trace } from "@/debug/traceLog";

/**
 * Простая шина событий внутри приложения (аналог `eventBus` на вебе).
 * Нужна, чтобы после мутаций (создание тренировки, подход и т.д.) перезагрузить списки без prop-drilling.
 */
type Handler = (payload?: unknown) => void;

const handlers: Record<string, Set<Handler>> = {};

export function emit(event: string, payload?: unknown): void {
  const count = handlers[event]?.size ?? 0;
  trace("EVENT", `emit ${event}`, {
    subscribers: count,
    payload:
      payload === undefined
        ? undefined
        : typeof payload === "object" && payload !== null
          ? { ...(payload as object) }
          : payload,
  });
  handlers[event]?.forEach((h) => {
    try {
      h(payload);
    } catch (e) {
      trace("EVENT", `handler error on ${event}`, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}

/** Подписка; возвращает функцию отписки (вызывать в cleanup `useEffect`). */
export function on(event: string, handler: Handler): () => void {
  if (!handlers[event]) handlers[event] = new Set();
  handlers[event].add(handler);
  trace("EVENT", `subscribe ${event}`, { subscribers: handlers[event].size });
  return () => {
    handlers[event]?.delete(handler);
    trace("EVENT", `unsubscribe ${event}`, { subscribers: handlers[event]?.size ?? 0 });
  };
}
