import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  avgRenderTime: number;
  totalRenderTime: number;
  componentName: string;
}

interface UsePerformanceMonitorOptions {
  logThreshold?: number; // Log if render takes longer than this (ms)
  componentName?: string;
  enabled?: boolean;
}

/**
 * Hook to monitor component performance
 * Tracks render count, render times, and logs slow renders
 */
export const usePerformanceMonitor = (options: UsePerformanceMonitorOptions = {}) => {
  const {
    logThreshold = 16, // 60fps = 16ms max
    componentName = 'Unknown',
    enabled = process.env.NODE_ENV === 'development'
  } = options;

  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    avgRenderTime: 0,
    totalRenderTime: 0,
    componentName,
  });

  const startTimeRef = useRef<number>(0);

  // Called at start of render
  const startMeasure = useCallback(() => {
    if (!enabled) return;
    startTimeRef.current = performance.now();
  }, [enabled]);

  // Called at end of render (in useEffect)
  useEffect(() => {
    if (!enabled || startTimeRef.current === 0) return;

    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;

    const metrics = metricsRef.current;
    metrics.renderCount++;
    metrics.lastRenderTime = renderTime;
    metrics.totalRenderTime += renderTime;
    metrics.avgRenderTime = metrics.totalRenderTime / metrics.renderCount;

    // Log slow renders
    if (renderTime > logThreshold) {
      console.warn(
        `[Performance] ${componentName} slow render: ${renderTime.toFixed(2)}ms (avg: ${metrics.avgRenderTime.toFixed(2)}ms, count: ${metrics.renderCount})`
      );
    }

    startTimeRef.current = 0;
  });

  const getMetrics = useCallback(() => metricsRef.current, []);

  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      renderCount: 0,
      lastRenderTime: 0,
      avgRenderTime: 0,
      totalRenderTime: 0,
      componentName,
    };
  }, [componentName]);

  return {
    startMeasure,
    getMetrics,
    resetMetrics,
  };
};

/**
 * Hook to detect memory leaks
 * Monitors component mount/unmount and warns about missing cleanups
 */
export const useMemoryLeakDetector = (componentName: string) => {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isMounted = useCallback(() => mountedRef.current, []);

  // Safe setState wrapper
  const safeSetState = useCallback(<T,>(setter: (value: T) => void) => {
    return (value: T) => {
      if (mountedRef.current) {
        setter(value);
      } else {
        console.warn(`[Memory Leak] Attempted setState on unmounted ${componentName}`);
      }
    };
  }, [componentName]);

  return { isMounted, safeSetState };
};

/**
 * Hook to measure FPS
 */
export const useFPSMonitor = (enabled: boolean = false) => {
  const fpsRef = useRef(0);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!enabled) return;

    let animationId: number;

    const measureFPS = () => {
      framesRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        fpsRef.current = Math.round((framesRef.current * 1000) / elapsed);
        framesRef.current = 0;
        lastTimeRef.current = now;
      }

      animationId = requestAnimationFrame(measureFPS);
    };

    animationId = requestAnimationFrame(measureFPS);

    return () => cancelAnimationFrame(animationId);
  }, [enabled]);

  return fpsRef;
};

export default usePerformanceMonitor;
