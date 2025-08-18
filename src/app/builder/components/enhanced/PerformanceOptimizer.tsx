"use client";

import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import debounce from 'lodash/debounce';

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const startTimeRef = useRef(performance.now());

  useEffect(() => {
    renderCountRef.current += 1;
    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${componentName}] Render #${renderCountRef.current} took ${renderTime.toFixed(2)}ms`);
    }
    
    startTimeRef.current = performance.now();
  });

  return {
    renderCount: renderCountRef.current,
    logPerformance: useCallback((label: string, fn: () => void) => {
      const start = performance.now();
      fn();
      const end = performance.now();
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[${componentName}] ${label} took ${(end - start).toFixed(2)}ms`);
      }
    }, [componentName])
  };
}

// Optimized input component with debouncing
interface OptimizedInputProps {
  value: number;
  onChange: (value: number) => void;
  debounceMs?: number;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  type?: 'number' | 'range';
}

export const OptimizedInput = memo(function OptimizedInput({
  value,
  onChange,
  debounceMs = 300,
  className,
  min,
  max,
  step,
  type = 'number'
}: OptimizedInputProps) {
  const debouncedOnChange = useMemo(
    () => debounce(onChange, debounceMs),
    [onChange, debounceMs]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    debouncedOnChange(newValue);
  }, [debouncedOnChange]);

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  return (
    <input
      type={type}
      defaultValue={value}
      onChange={handleChange}
      className={className}
      min={min}
      max={max}
      step={step}
    />
  );
});

// Virtualized list component for large datasets
interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index
    }));
  }, [items, itemHeight, containerHeight, scrollTop]);

  const totalHeight = items.length * itemHeight;
  const offsetY = Math.floor(scrollTop / itemHeight) * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      className={className}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index }) => (
            <div key={index} style={{ height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Intersection observer hook for lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries && entries.length > 0 ? entries[0] : undefined;
      if (entry) {
        setIsIntersecting(entry.isIntersecting);
      }
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [ref, options]);

  return isIntersecting;
}

// Lazy loading component
interface LazyComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
}

export function LazyComponent({ 
  children, 
  fallback = null, 
  rootMargin = '50px' 
}: LazyComponentProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref as React.RefObject<Element>, { rootMargin });
  const hasBeenVisible = React.useRef(false);

  if (isVisible) {
    hasBeenVisible.current = true;
  }

  return (
    <div ref={ref}>
      {hasBeenVisible.current ? children : fallback}
    </div>
  );
}

// Memory usage monitor (development only)
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = React.useState<any>(null);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        setMemoryInfo((performance as any).memory);
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000);

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

// Batch updates for better performance
export function useBatchedUpdates<T>(
  initialValue: T,
  batchDelay: number = 100
): [T, (value: T) => void, () => void] {
  const [value, setValue] = React.useState<T>(() => initialValue);
  const pendingValueRef = React.useRef<T>(initialValue);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const batchedSetValue = React.useCallback((newValue: T) => {
    pendingValueRef.current = newValue;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setValue(pendingValueRef.current);
    }, batchDelay);
  }, [batchDelay]);

  const flushUpdates = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      setValue(pendingValueRef.current);
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, batchedSetValue, flushUpdates];
}

// GPU acceleration utility
export function withGPUAcceleration<P extends object>(
  Component: React.ComponentType<P>
) {
  return memo(function GPUAcceleratedComponent(props: P) {
    return (
      <div className="gpu-accelerated hardware-acceleration">
        <Component {...props} />
      </div>
    );
  });
}