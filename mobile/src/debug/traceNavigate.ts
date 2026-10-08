import type { Href } from "expo-router";
import { trace } from "@/debug/traceLog";

/** Логируемый router.push — для критичных переходов в обработчиках. */
export function traceNavigate(href: Href, meta?: Record<string, unknown>): void {
  trace("NAV", `navigate → ${String(href)}`, meta);
}

/** Обёртка push с логом. */
export function traceRouterPush(
  push: (href: Href) => void,
  href: Href,
  label?: string,
  meta?: Record<string, unknown>,
): void {
  trace("NAV", label ?? `router.push → ${String(href)}`, { href, ...meta });
  push(href);
}
