import type { GuardedFocusReloadOptions } from "@/hooks/useGuardedFocusLoad";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Reload только когда экран в фокусе; иначе помечает данные устаревшими.
 * На focus парный `useGuardedFocusLoad` уже делает reload (включая route ready).
 */
export function useFocusGatedReload(
  reload: (options?: GuardedFocusReloadOptions) => Promise<void>,
) {
  const focusedRef = useRef(false);
  const staleRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );

  const markStale = useCallback(() => {
    staleRef.current = true;
  }, []);

  const refreshIfFocused = useCallback(
    (reloadOptions?: GuardedFocusReloadOptions) => {
      if (focusedRef.current) {
        staleRef.current = false;
        void reload(reloadOptions);
        return;
      }
      staleRef.current = true;
    },
    [reload],
  );

  return { markStale, refreshIfFocused, isFocused: () => focusedRef.current };
}
