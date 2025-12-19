import { memo, useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Debounce function - delays execution until after wait milliseconds of silence
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - lastTime);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastTime = now;
      func(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastTime = Date.now();
        timeoutId = null;
        func(...args);
      }, remaining);
    }
  };
}

/**
 * Hook for debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

import { useState } from 'react';

/**
 * Hook for debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useMemo(
    () => debounce((...args: Parameters<T>) => callbackRef.current(...args), delay) as T,
    [delay]
  );
}

/**
 * Hook for throttled callback
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useMemo(
    () => throttle((...args: Parameters<T>) => callbackRef.current(...args), delay) as T,
    [delay]
  );
}

/**
 * Memoize expensive computations with custom equality
 */
export function memoizeOne<T extends (...args: any[]) => any>(
  func: T,
  isEqual: (prev: Parameters<T>, next: Parameters<T>) => boolean = (a, b) => 
    JSON.stringify(a) === JSON.stringify(b)
): T {
  let lastArgs: Parameters<T> | null = null;
  let lastResult: ReturnType<T>;

  return function memoized(...args: Parameters<T>): ReturnType<T> {
    if (lastArgs && isEqual(lastArgs, args)) {
      return lastResult;
    }

    lastResult = func(...args);
    lastArgs = args;
    return lastResult;
  } as T;
}

/**
 * Request idle callback polyfill
 */
export const requestIdleCallback = 
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (cb: IdleRequestCallback) => setTimeout(() => cb({ 
        didTimeout: false, 
        timeRemaining: () => 50 
      } as IdleDeadline), 1);

/**
 * Cancel idle callback polyfill
 */
export const cancelIdleCallback = 
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? window.cancelIdleCallback
    : clearTimeout;

/**
 * Run task when browser is idle
 */
export function runWhenIdle(task: () => void): number {
  return requestIdleCallback(() => task()) as number;
}

/**
 * Batch DOM updates
 */
export function batchUpdates(updates: (() => void)[]): void {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
}

export default { debounce, throttle, memoizeOne, runWhenIdle, batchUpdates };
