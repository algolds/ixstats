"use client";

import { useState, useEffect, useRef } from "react";

export interface NavigationScrollOptions {
  /** If true, locks the navigation bar in visible state (e.g. while drawer or modal is open) */
  isLocked?: boolean;
  /** Navigation mode: 'default' (standard scroll-hide) or 'hidden' (starts hidden for canvas/immersion) */
  mode?: "default" | "hidden";
  /** @deprecated Use `mode: 'hidden'` instead. Starts navigation bar in hidden state by default */
  autoHideDefault?: boolean;
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
}

/**
 * Tracks scroll position with RAF-smoothed updates, directional hysteresis,
 * universal dynamic repulsion progress, and Apple-grade fluid navigation visibility state.
 */
export function useNavigationScroll(options?: NavigationScrollOptions): NavigationScrollState {
  const isLocked = options?.isLocked ?? false;
  const autoHideDefault = (options?.mode === "hidden") || (options?.autoHideDefault ?? false);

  const [scrollY, setScrollY] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(!autoHideDefault);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | "idle">("idle");

  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const autoHideDefaultRef = useRef(autoHideDefault);
  autoHideDefaultRef.current = autoHideDefault;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (autoHideDefault) {
      const navHeight = window.innerWidth >= 1024 ? 64 : 56;
      if (window.scrollY <= 10) {
        window.scrollTo({ top: navHeight, behavior: "instant" });
        setScrollY(navHeight);
        setIsSticky(true);
        setIsNavVisible(false);
      }
    }
  }, [autoHideDefault]);

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
          // Clamp negative scroll to 0 (protects against iOS/Safari elastic rubber-band overscroll)
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
            setIsNavVisible(true);
            setScrollDirection("idle");
            accumulatedDelta = 0;
            currentDirection = "idle";
          } else {
            // Sticky threshold with hysteresis
            const stickyThreshold = deltaY > 0 ? 60 : 40;
            setIsSticky(currentScrollY > stickyThreshold);

            // Directional detection & accumulated delta hysteresis
            if (Math.abs(deltaY) > 0.5) {
              const newDirection: "up" | "down" = deltaY > 0 ? "down" : "up";

              if (newDirection !== currentDirection) {
                currentDirection = newDirection;
                accumulatedDelta = 0;
                setScrollDirection(newDirection);
              }

              accumulatedDelta += Math.abs(deltaY);

              if (isLockedRef.current) {
                setIsNavVisible(true);
              } else if (currentScrollY < 50) {
                // Always visible in top anchor zone
                setIsNavVisible(true);
              } else if (newDirection === "down" && accumulatedDelta > 10) {
                // Hide when scrolling down past top zone
                setIsNavVisible(false);
              } else if (newDirection === "up" && accumulatedDelta > 10) {
                // Instantly reveal when scrolling up anywhere
                setIsNavVisible(true);
              }
            }
          }

          lastScrollY = currentScrollY;
          lastTimestamp = timestamp;
          isScrolling = false;
        });
      }
    };

    // Wheel and trackpad gesture listener for inner-container and global scroll
    const handleWheel = (e: WheelEvent) => {
      if (isLockedRef.current) return;
      if (e.deltaY < -15) {
        setIsNavVisible(true);
      } else if (e.deltaY > 15) {
        setIsNavVisible(false);
      }
    };

    // Top screen edge proximity peek
    const handleMouseMove = (e: MouseEvent) => {
      if (isLockedRef.current) return;
      if (e.clientY <= 16) {
        setIsNavVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Ensure locked state immediately reflects in visibility
  const resolvedNavVisible = isLocked ? true : isNavVisible;

  // Universal Dynamic Repulsion Progress: 0 at top to 1 when scrolled >= 56px
  const repulsionProgress = Math.min(1, Math.max(0, scrollY / 56));

  return {
    scrollY,
    isSticky,
    isNavVisible: resolvedNavVisible,
    scrollDirection,
    repulsionProgress,
  };
}

