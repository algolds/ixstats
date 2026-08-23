// src/hooks/useNavigationScroll.ts
// Tracks scroll position with RAF-smoothed updates, directional hysteresis,
// universal dynamic repulsion progress, and Apple-grade fluid navigation visibility & auto-hide.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface NavigationScrollOptions {
  /** If true, locks the navigation bar in visible state (e.g. while drawer or modal is open) */
  isLocked?: boolean;
  /** Navigation mode: 'default' (standard scroll-hide) or 'hidden' (starts hidden for canvas/immersion) */
  mode?: "default" | "hidden";
  /** @deprecated Use `mode: 'hidden'` instead. */
  autoHideDefault?: boolean;
  /** Delay in milliseconds before auto-hiding navigation when mouse leaves top edge (default: 700ms) */
  autoHideDelay?: number;
}

export interface NavigationScrollState {
  scrollY: number;
  isSticky: boolean;
  isNavVisible: boolean;
  scrollDirection: "up" | "down" | "idle";
  /**
   * Universal Dynamic Repulsion Progress: 0 (at rest/top) to 1 (fully repulsed/tucked).
   * Formula: clamp(scrollY / 56, 0, 1). Used to coordinate sub-headers under the sticky Halo.
   */
  repulsionProgress: number;
  /** Call when mouse enters navigation bar to keep it open */
  onNavMouseEnter: () => void;
  /** Call when mouse leaves navigation bar to begin auto-hide timer */
  onNavMouseLeave: () => void;
}

export function useNavigationScroll(options?: NavigationScrollOptions): NavigationScrollState {
  const isLocked = options?.isLocked ?? false;
  const isHiddenMode = (options?.mode === "hidden") || (options?.autoHideDefault ?? false);
  const autoHideDelay = options?.autoHideDelay ?? 700;

  const [scrollY, setScrollY] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const [scrollNavVisible, setScrollNavVisible] = useState(!isHiddenMode);
  const [isMouseNearTop, setIsMouseNearTop] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | "idle">("idle");

  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const isHiddenModeRef = useRef(isHiddenMode);
  isHiddenModeRef.current = isHiddenMode;
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isNavHoveredRef = useRef(false);

  const clearAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, []);

  const startAutoHideTimer = useCallback((delay = autoHideDelay) => {
    clearAutoHideTimer();
    autoHideTimerRef.current = setTimeout(() => {
      if (!isNavHoveredRef.current && !isLockedRef.current) {
        setIsMouseNearTop(false);
      }
    }, delay);
  }, [autoHideDelay, clearAutoHideTimer]);

  const onNavMouseEnter = useCallback(() => {
    isNavHoveredRef.current = true;
    clearAutoHideTimer();
    setIsMouseNearTop(true);
  }, [clearAutoHideTimer]);

  const onNavMouseLeave = useCallback(() => {
    isNavHoveredRef.current = false;
    startAutoHideTimer(600);
  }, [startAutoHideTimer]);

  useEffect(() => {
    let rafId: number | undefined;
    let isScrolling = false;
    let lastScrollY = Math.max(0, typeof window !== "undefined" ? window.scrollY : 0);
    let lastTimestamp = performance.now();
    let accumulatedDelta = 0;
    let currentDirection: "up" | "down" | "idle" = "idle";

    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        rafId = requestAnimationFrame((timestamp) => {
          const currentScrollY = Math.max(0, window.scrollY);
          const deltaTime = timestamp - lastTimestamp;
          const deltaY = currentScrollY - lastScrollY;

          // Smooth interpolation for scroll position
          const smoothScrollY =
            currentScrollY <= 2
              ? 0
              : lastScrollY + (currentScrollY - lastScrollY) * Math.min(deltaTime / 16, 1);
          setScrollY(smoothScrollY);

          // Absolute Top / Balanced Anchor Reset
          if (currentScrollY <= 2) {
            setIsSticky(false);
            setScrollNavVisible(!isHiddenModeRef.current);
            setScrollDirection("idle");
            accumulatedDelta = 0;
            currentDirection = "idle";
          } else {
            const stickyThreshold = deltaY > 0 ? 56 : 40;
            setIsSticky(currentScrollY > stickyThreshold);

            if (Math.abs(deltaY) > 0.5) {
              const newDirection: "up" | "down" = deltaY > 0 ? "down" : "up";

              if (newDirection !== currentDirection) {
                currentDirection = newDirection;
                accumulatedDelta = 0;
                setScrollDirection(newDirection);
              }

              accumulatedDelta += Math.abs(deltaY);

              if (isLockedRef.current) {
                setScrollNavVisible(true);
              } else if (currentScrollY < 48 && !isHiddenModeRef.current) {
                // Natural top zone visibility for default mode
                setScrollNavVisible(true);
              } else if (newDirection === "down" && accumulatedDelta > 10) {
                // Hide when scrolling down past top zone
                setScrollNavVisible(false);
                setIsMouseNearTop(false);
                clearAutoHideTimer();
              } else if (newDirection === "up" && accumulatedDelta > 10) {
                // Instantly reveal when scrolling up
                setScrollNavVisible(true);
              }
            }
          }

          lastScrollY = currentScrollY;
          lastTimestamp = timestamp;
          isScrolling = false;
        });
      }
    };

    // Wheel and trackpad gesture listener
    const handleWheel = (e: WheelEvent) => {
      if (isLockedRef.current) return;
      if (e.deltaY < -15) {
        setScrollNavVisible(true);
      } else if (e.deltaY > 15 && window.scrollY > 48) {
        setScrollNavVisible(false);
        setIsMouseNearTop(false);
        clearAutoHideTimer();
      }
    };

    // Top screen edge proximity peek & auto-hide
    const handleMouseMove = (e: MouseEvent) => {
      if (isLockedRef.current) return;

      const navZoneHeight = window.innerWidth >= 1024 ? 72 : 60;

      // Mouse reached top activation threshold
      if (e.clientY <= 24) {
        clearAutoHideTimer();
        setIsMouseNearTop(true);
      } else if (e.clientY > navZoneHeight && isMouseNearTop && !isNavHoveredRef.current) {
        // Mouse moved below navbar zone — trigger auto-hide grace period
        startAutoHideTimer();
      }
    };

    const handleMouseLeaveDoc = () => {
      if (!isNavHoveredRef.current) {
        startAutoHideTimer(400);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleMouseLeaveDoc);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousemove", handleMouseMove);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeaveDoc);
      clearAutoHideTimer();
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [clearAutoHideTimer, startAutoHideTimer, isMouseNearTop]);

  // Determine final visibility
  let isNavVisible: boolean;
  if (isLocked) {
    isNavVisible = true;
  } else if (isMouseNearTop) {
    isNavVisible = true;
  } else if (scrollY <= 5 && !isHiddenMode) {
    isNavVisible = true;
  } else {
    isNavVisible = scrollNavVisible;
  }

  // Universal Dynamic Repulsion Progress: 0 at top to 1 when scrolled >= 56px
  const repulsionProgress = Math.min(1, Math.max(0, scrollY / 56));

  return {
    scrollY,
    isSticky,
    isNavVisible,
    scrollDirection,
    repulsionProgress,
    onNavMouseEnter,
    onNavMouseLeave,
  };
}
