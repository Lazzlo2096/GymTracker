import { useEffect, useRef } from "react";
import { trace, traceBoolState } from "@/debug/traceLog";

/** Логирует visible/mounted жизненный цикл модалки или sheet. */
export function useTraceModal(name: string, visible: boolean, mounted?: boolean): void {
  const prevVisibleRef = useRef(visible);
  const prevMountedRef = useRef(mounted);

  useEffect(() => {
    traceBoolState("MODAL", `${name}.visible`, prevVisibleRef.current, visible);
    prevVisibleRef.current = visible;
  }, [name, visible]);

  useEffect(() => {
    if (mounted === undefined) return;
    traceBoolState("MODAL", `${name}.mounted`, prevMountedRef.current ?? false, mounted);
    prevMountedRef.current = mounted;
  }, [name, mounted]);
}
