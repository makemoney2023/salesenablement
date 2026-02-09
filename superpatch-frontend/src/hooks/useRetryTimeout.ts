"use client";

import { useRef, useCallback, useEffect } from "react";

/**
 * Hook that provides a safe retry scheduling mechanism.
 * All scheduled timeouts are automatically cleaned up on unmount,
 * preventing state updates on unmounted components.
 *
 * Usage:
 *   const scheduleRetry = useRetryTimeouts();
 *   scheduleRetry(() => fetchData(), 1000);
 */
export function useRetryTimeouts() {
  const timeoutIds = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const scheduleRetry = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timeoutIds.current.delete(id);
      fn();
    }, delay);
    timeoutIds.current.add(id);
    return id;
  }, []);

  // Clear all pending timeouts on unmount
  useEffect(() => {
    const ids = timeoutIds.current;
    return () => {
      ids.forEach(clearTimeout);
      ids.clear();
    };
  }, []);

  return scheduleRetry;
}
