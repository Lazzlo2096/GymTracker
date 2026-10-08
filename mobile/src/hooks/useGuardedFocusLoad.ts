import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { trace, traceSpanEnd, traceSpanStart } from "@/debug/traceLog";

/**
 * Результат загрузки для `useGuardedFocusLoad`.
 * Единый контракт: экран сам решает, как отобразить not_found / error.
 */
export type GuardedFocusLoadResult<T> =
  | { kind: "success"; data: T }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

export type GuardedFocusReloadOptions = {
  /** Без полноэкранного спиннера, если данные уже были загружены. */
  silent?: boolean;
  /** Принудительно показать загрузку (кнопка «Повторить»). */
  force?: boolean;
};

export type GuardedFocusLoadErrorContext = {
  silent: boolean;
};

export type UseGuardedFocusLoadOptions<T> = {
  /** false — загрузка не стартует (невалидный id и т.п.). */
  enabled: boolean;
  /**
   * Tab-экран в стеке может получить focus до смены pathname (например /workout/12 → /workouts).
   * Верните false, чтобы не стартовать лишний GET до «домашнего» маршрута.
   */
  shouldReloadOnFocus?: () => boolean;
  /** Pathname стал домашним — догрузить после focus reload skipped (route). */
  routeReady?: boolean;
  load: () => Promise<GuardedFocusLoadResult<T>>;
  onSuccess: (data: T) => void;
  onNotFound?: () => void;
  onError?: (message: string, context: GuardedFocusLoadErrorContext) => void;
  onDisabled?: () => void;
};

export type UseGuardedFocusLoadReturn = {
  loading: boolean;
  reload: (options?: GuardedFocusReloadOptions) => Promise<void>;
  /** Отменить in-flight запросы (уход на pick-экран, локальное сохранение). */
  invalidateInFlightLoads: () => void;
  /**
   * Применить свежие данные без focus-GET (модалка сохранила, PATCH вернул деталь).
   * Отменяет устаревшие GET и пропускает следующий focus reload.
   */
  applyLocalData: (data: T) => void;
};

/**
 * Загрузка детали экрана на focus с защитой от гонки GET.
 *
 * Паттерн для stack-экранов (`/workout/[id]`, `/plan-template/[id]`):
 * 1. `useFocusEffect` → reload
 * 2. cleanup при blur → invalidateInFlightLoads
 * 3. перед push в каталог / pick → invalidateInFlightLoads
 * 4. после локального save → applyLocalData
 *
 * Без invalidate поздний пустой GET может перезаписать state после мутации.
 */
export function useGuardedFocusLoad<T>({
  enabled,
  shouldReloadOnFocus,
  routeReady = true,
  load,
  onSuccess,
  onNotFound,
  onError,
  onDisabled,
}: UseGuardedFocusLoadOptions<T>): UseGuardedFocusLoadReturn {
  const [loading, setLoading] = useState(true);
  const loadGenerationRef = useRef(0);
  const hasDataRef = useRef(false);
  const skipNextFocusLoadRef = useRef(false);
  const focusedRef = useRef(false);
  const skippedRouteReloadRef = useRef(false);

  const loadRef = useRef(load);
  const onSuccessRef = useRef(onSuccess);
  const onNotFoundRef = useRef(onNotFound);
  const onErrorRef = useRef(onError);
  const onDisabledRef = useRef(onDisabled);
  const shouldReloadOnFocusRef = useRef(shouldReloadOnFocus);

  loadRef.current = load;
  onSuccessRef.current = onSuccess;
  onNotFoundRef.current = onNotFound;
  onErrorRef.current = onError;
  onDisabledRef.current = onDisabled;
  shouldReloadOnFocusRef.current = shouldReloadOnFocus;

  const invalidateInFlightLoads = useCallback(() => {
    const prev = loadGenerationRef.current;
    loadGenerationRef.current += 1;
    trace("FOCUS", "invalidateInFlightLoads", {
      generation: loadGenerationRef.current,
      prevGeneration: prev,
    });
  }, []);

  const reload = useCallback(async (options?: GuardedFocusReloadOptions) => {
    if (!enabled) {
      trace("FOCUS", "reload skipped (disabled)");
      hasDataRef.current = false;
      onDisabledRef.current?.();
      setLoading(false);
      return;
    }

    const generation = ++loadGenerationRef.current;
    const silent =
      options?.force === true
        ? false
        : (options?.silent ?? hasDataRef.current);
    const spanId = traceSpanStart("FOCUS", `reload gen=${generation}`, {
      silent,
      force: options?.force ?? false,
      hadData: hasDataRef.current,
    });

    if (!silent) {
      setLoading(true);
    }

    try {
      const result = await loadRef.current();
      if (generation !== loadGenerationRef.current) {
        traceSpanEnd(spanId, { stale: true, currentGen: loadGenerationRef.current }, "cancel");
        return;
      }

      if (result.kind === "success") {
        hasDataRef.current = true;
        onSuccessRef.current(result.data);
        traceSpanEnd(spanId, { kind: "success" });
        return;
      }

      hasDataRef.current = false;
      if (result.kind === "not_found") {
        onNotFoundRef.current?.();
        traceSpanEnd(spanId, { kind: "not_found" });
        return;
      }

      onErrorRef.current?.(result.message, { silent });
      traceSpanEnd(spanId, { kind: "error", message: result.message }, "error");
    } catch (e) {
      if (generation !== loadGenerationRef.current) {
        traceSpanEnd(spanId, { stale: true }, "cancel");
        return;
      }
      hasDataRef.current = false;
      const message = e instanceof Error ? e.message : "Не удалось загрузить";
      onErrorRef.current?.(message, { silent });
      traceSpanEnd(spanId, { kind: "throw", message }, "error");
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  const applyLocalData = useCallback((data: T) => {
    trace("FOCUS", "applyLocalData", { generation: loadGenerationRef.current + 1 });
    skipNextFocusLoadRef.current = true;
    loadGenerationRef.current += 1;
    hasDataRef.current = true;
    onSuccessRef.current(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;

      const onBlur = () => {
        focusedRef.current = false;
        const prev = loadGenerationRef.current;
        loadGenerationRef.current += 1;
        trace("FOCUS", "blur → invalidate", {
          prevGeneration: prev,
          nextGeneration: loadGenerationRef.current,
        });
      };

      if (skipNextFocusLoadRef.current) {
        trace("FOCUS", "focus reload skipped (applyLocalData)");
        skipNextFocusLoadRef.current = false;
        return onBlur;
      }
      if (shouldReloadOnFocusRef.current && !shouldReloadOnFocusRef.current()) {
        trace("FOCUS", "focus reload skipped (route)");
        skippedRouteReloadRef.current = true;
        return onBlur;
      }
      skippedRouteReloadRef.current = false;
      trace("FOCUS", "focus → reload");
      void reload();
      return onBlur;
    }, [reload]),
  );

  useEffect(() => {
    if (!focusedRef.current || !skippedRouteReloadRef.current || !routeReady) return;
    if (shouldReloadOnFocusRef.current && !shouldReloadOnFocusRef.current()) return;
    skippedRouteReloadRef.current = false;
    trace("FOCUS", "focus → reload (route ready)");
    void reload({ silent: true });
  }, [routeReady, reload]);

  return {
    loading,
    reload,
    invalidateInFlightLoads,
    applyLocalData,
  };
}
