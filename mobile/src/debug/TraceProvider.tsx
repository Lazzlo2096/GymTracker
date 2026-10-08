import { usePathname, useRootNavigationState, useSegments } from "expo-router";
import React, { useEffect, useRef } from "react";
import { trace, TRACE_ENABLED } from "@/debug/traceLog";

/** Глобальный трекер навигации: смена pathname/segments и состояние стека. */
export function TraceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const prevPathRef = useRef<string | null>(null);
  const prevSegmentsRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (!TRACE_ENABLED) return;
    trace("LIFECYCLE", "TraceProvider mounted");
    return () => trace("LIFECYCLE", "TraceProvider unmounted");
  }, []);

  useEffect(() => {
    if (!TRACE_ENABLED) return;
    const prev = prevPathRef.current;
    if (prev !== null && prev !== pathname) {
      trace("NAV", `route ${prev} → ${pathname}`, {
        segments,
        stackDepth: navState?.routes?.length ?? 0,
        navIndex: navState?.index,
      });
    } else if (prev === null) {
      trace("NAV", `initial route ${pathname}`, { segments });
    }
    prevPathRef.current = pathname;
  }, [pathname, segments, navState?.index, navState?.routes?.length]);

  useEffect(() => {
    if (!TRACE_ENABLED) return;
    const prev = prevSegmentsRef.current;
    const next = [...segments];
    if (prev !== null && JSON.stringify(prev) !== JSON.stringify(next)) {
      trace("NAV", "segments changed", { from: prev, to: next, pathname });
    }
    prevSegmentsRef.current = next;
  }, [pathname, segments]);

  return <>{children}</>;
}
