"use client";

import React from "react";

/**
 * Mobile Optimization Styles and Enhancements
 *
 * This component provides mobile-specific optimizations including:
 * - Touch-friendly interactions
 * - Performance enhancements
 * - Responsive design utilities
 */

// Mobile-specific CSS injected as a component
export function MobileOptimizationStyles() {
  React.useEffect(() => {
    // Inject mobile-specific styles
    const styleSheet = document.createElement("style");
    // Facet 3: only touch ergonomics live here. Layout, motion (FacetMotionConfig honours Reduce
    // Motion), materials and selection are left to the utilities and primitives — no utility
    // hijacks or !important overrides.
    styleSheet.textContent = `
      .mobile-optimized {
        -webkit-tap-highlight-color: transparent;
      }

      .touch-manipulation {
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0,0,0,0);
      }

      /* Mobile touch targets: 44px minimum height on touch screens. */
      @media (max-width: 768px) and (pointer: coarse) {
        .mobile-optimized button,
        .mobile-optimized [role="button"] {
          min-height: 44px;
        }
      }

      @media (max-width: 768px) {
        .mobile-optimized .overflow-y-auto {
          overscroll-behavior: contain;
        }

        /* Safe area adjustments for notch devices */
        .mobile-optimized {
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
        }

        .mobile-header {
          padding-top: env(safe-area-inset-top);
        }
      }
    `;

    document.head.appendChild(styleSheet);

    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return null; // This component only injects styles
}

// Touch gesture detection hook
export function useTouchGestures() {
  const [touchState, setTouchState] = React.useState({
    isTouch: false,
    swipeDirection: null as "left" | "right" | "up" | "down" | null,
    tapCount: 0,
  });

  React.useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tapTimeout: NodeJS.Timeout;

    const handleTouchStart = (e: TouchEvent) => {
      const firstTouch = e.touches[0];
      if (firstTouch) {
        startX = firstTouch.clientX;
        startY = firstTouch.clientY;
        setTouchState((prev) => ({ ...prev, isTouch: true }));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const lastTouch = e.changedTouches[0];
      if (!lastTouch) return;
      const endX = lastTouch.clientX;
      const endY = lastTouch.clientY;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const minSwipeDistance = 50;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        setTouchState((prev) => ({
          ...prev,
          swipeDirection: deltaX > 0 ? "right" : "left",
        }));
      } else if (Math.abs(deltaY) > minSwipeDistance) {
        setTouchState((prev) => ({
          ...prev,
          swipeDirection: deltaY > 0 ? "down" : "up",
        }));
      } else {
        // Single tap
        setTouchState((prev) => ({ ...prev, tapCount: prev.tapCount + 1 }));
        clearTimeout(tapTimeout);
        tapTimeout = setTimeout(() => {
          setTouchState((prev) => ({ ...prev, tapCount: 0 }));
        }, 300);
      }

      // Reset swipe direction after a delay
      setTimeout(() => {
        setTouchState((prev) => ({ ...prev, swipeDirection: null }));
      }, 100);
    };

    if ("ontouchstart" in window) {
      document.addEventListener("touchstart", handleTouchStart, { passive: true });
      document.addEventListener("touchend", handleTouchEnd, { passive: true });
    }

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
      clearTimeout(tapTimeout);
    };
  }, []);

  return touchState;
}

interface BatteryManagerLike {
  level: number;
  charging: boolean;
}

interface NetworkInformationLike {
  effectiveType?: string;
}

interface NavigatorWithCapabilities {
  getBattery?: () => Promise<BatteryManagerLike>;
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
}

// Performance optimization hook for mobile
export function useMobilePerformance() {
  const [performanceState, setPerformanceState] = React.useState({
    reducedMotion: false,
    lowBattery: false,
    slowConnection: false,
  });

  React.useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nav = navigator as NavigatorWithCapabilities;

    // Check for battery status (if supported)
    const checkBattery = async () => {
      if (typeof nav.getBattery === "function") {
        try {
          const battery = await nav.getBattery();
          const isLowBattery = battery.level < 0.2 && !battery.charging;
          setPerformanceState((prev) => ({ ...prev, lowBattery: isLowBattery }));
        } catch {
          // Battery API not supported or failed
        }
      }
    };

    // Check for slow connection
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    const slowConnection =
      connection && (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g");

    setPerformanceState({
      reducedMotion: prefersReducedMotion,
      lowBattery: false,
      slowConnection: slowConnection || false,
    });

    checkBattery();
  }, []);

  return performanceState;
}

// Mobile-specific component wrapper
interface MobileOptimizedProps {
  children: React.ReactNode;
  enableTouchGestures?: boolean;
  className?: string;
}

export function MobileOptimized({
  children,
  enableTouchGestures = true,
  className = "",
}: MobileOptimizedProps) {
  // All hooks must be called unconditionally (Rules of Hooks)
  const touchState = useTouchGestures();
  const performance = useMobilePerformance();

  // Apply touch state only if enabled
  const effectiveTouchState = enableTouchGestures ? touchState : null;

  return (
    <>
      <MobileOptimizationStyles />
      <div
        className={`mobile-optimized ${className} ${performance.reducedMotion ? "reduce-motion" : ""}`}
        data-touch-enabled={effectiveTouchState?.isTouch}
        data-swipe-direction={effectiveTouchState?.swipeDirection}
      >
        {children}
      </div>
    </>
  );
}
