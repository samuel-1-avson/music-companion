import React, { Suspense, lazy, ComponentType } from 'react';

/**
 * Loading skeleton component for lazy-loaded content
 */
export const LoadingSkeleton: React.FC<{ height?: string; className?: string }> = ({ 
  height = '200px', 
  className = '' 
}) => (
  <div 
    className={`animate-pulse bg-[var(--bg-hover)] ${className}`} 
    style={{ height, minHeight: height }}
  >
    <div className="h-full flex items-center justify-center">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

/**
 * Card skeleton for lists and grids
 */
export const CardSkeleton: React.FC = () => (
  <div className="border border-theme p-4 animate-pulse">
    <div className="flex gap-4">
      <div className="w-16 h-16 bg-[var(--bg-hover)]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-[var(--bg-hover)] rounded w-3/4" />
        <div className="h-3 bg-[var(--bg-hover)] rounded w-1/2" />
      </div>
    </div>
  </div>
);

/**
 * Player skeleton
 */
export const PlayerSkeleton: React.FC = () => (
  <div className="fixed bottom-0 left-0 right-0 h-20 bg-[var(--bg-card)] border-t border-theme p-4 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-[var(--bg-hover)]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[var(--bg-hover)] rounded w-48" />
        <div className="h-2 bg-[var(--bg-hover)] rounded w-32" />
      </div>
      <div className="flex gap-2">
        <div className="w-10 h-10 bg-[var(--bg-hover)] rounded-full" />
        <div className="w-10 h-10 bg-[var(--bg-hover)] rounded-full" />
        <div className="w-10 h-10 bg-[var(--bg-hover)] rounded-full" />
      </div>
    </div>
  </div>
);

/**
 * Higher-order component for lazy loading with fallback
 */
export function withLazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);

  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || <LoadingSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Lazy load components with retry logic
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  interval = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await importFn();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    throw new Error('Failed to load component');
  });
}

/**
 * Preload a lazy component
 */
export function preloadComponent(importFn: () => Promise<any>): void {
  importFn().catch(() => {
    // Silently fail preload
  });
}

export default LoadingSkeleton;
