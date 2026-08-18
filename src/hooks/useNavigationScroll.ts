"use client";

import { useState, useEffect, useRef } from "react";

export interface NavigationScrollOptions {
  /** If true, locks the navigation bar in visible state (e.g. while drawer or modal is open) */
  isLocked?: boolean;
}

export interface NavigationScrollState {
  scrollY: number;
  isSticky: boolean;
  isNavVisible: boolean;
  scrollDirection: "up" | "down" | "idle";
}

/**
 * Tracks scroll position with RAF-smoothed updates, directional hysteresis,
 * and Apple-grade fluid navigation visibility state (scroll down to hide, scroll up to reveal).
 */
export function useNavigationScroll(options?: NavigationScrollOptions): NavigationScrollState {
  const isLocked = options?.isLocked ?? false;
  const [scrollY, setScrollY] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | "idle">("idle");

  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

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
            lastScrollY + (currentScrollY - lastScrollY) * Math.min(deltaTime / 16, 1);
          setScrollY(smoothScrollY);

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
            } else if (newDirection === "down" && accumulatedDelta > 10 && currentScrollY > 50) {
              // Hide when scrolling down beyond top zone
              setIsNavVisible(false);
            } else if (newDirection === "up" && accumulatedDelta > 15) {
              // Instantly reveal when scrolling up anywhere
              setIsNavVisible(true);
            }
          }

          lastScrollY = currentScrollY;
          lastTimestamp = timestamp;
          isScrolling = false;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Ensure locked state immediately reflects in visibility
  const resolvedNavVisible = isLocked ? true : isNavVisible;

  return { scrollY, isSticky, isNavVisible: resolvedNavVisible, scrollDirection };
}

