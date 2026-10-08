import { useFocusEffect, usePathname, useSegments } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { trace, TRACE_ENABLED } from "@/debug/traceLog";

/**
 * Логирует mount/unmount и focus/blur экрана.
 * Вызывать в каждом route-компоненте: `useTraceScreen("workouts")`.
 */
export function useTraceScreen(screenName: string, meta?: Record<string, unknown>): void {
  const pathname = usePathname();
  const segments = useSegments();
  const focusCountRef = useRef(0);

  useEffect(() => {
    if (!TRACE_ENABLED) return;
    trace("SCREEN", `mount ${screenName}`, { pathname, segments, ...meta });
    return () => {
      trace("SCREEN", `unmount ${screenName}`, { pathname, segments, ...meta });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount once per screen identity
  }, [screenName]);

  useFocusEffect(
    useCallback(() => {
      if (!TRACE_ENABLED) return undefined;
      focusCountRef.current += 1;
      const focusN = focusCountRef.current;
      trace("SCREEN", `focus ${screenName} (#${focusN})`, { pathname, segments, ...meta });
      return () => {
        trace("SCREEN", `blur ${screenName} (#${focusN})`, { pathname, segments, ...meta });
      };
    }, [pathname, screenName, segments, meta]),
  );
}
