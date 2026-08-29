/**
 * Utility functions for debouncing and throttling to prevent excessive function calls.
 * Helps reduce battery consumption and improve performance.
 */

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCallTime >= delayMs) {
      fn(...args);
      lastCallTime = now;
    }
  };
}

/**
 * Creates a debounced version that can be manually flushed immediately.
 * Useful when you need to ensure a call happens before unmount.
 */
export function createDebouncedWithFlush<T extends (...args: any[]) => Promise<void>>(
  fn: T,
  delayMs: number
): { debounced: (...args: Parameters<T>) => void; flush: () => Promise<void> } {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;

  return {
    debounced: (...args: Parameters<T>) => {
      lastArgs = args;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (lastArgs) fn(...lastArgs);
        timeoutId = null;
        lastArgs = null;
      }, delayMs);
    },
    flush: async () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (lastArgs) {
        await fn(...lastArgs);
        timeoutId = null;
        lastArgs = null;
      }
    },
  };
}
