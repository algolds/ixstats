"use client";

import { useState, useEffect, useRef } from "react";

export interface NavigationScrollOptions {
  /** If true, locks the navigation bar in visible state (e.g. while drawer or modal is open) */
  isLocked?: boolean;
  /** If true, starts navigation bar in hidden state by default (e.g. on messages / app workspaces) */
  autoHideDefault?: boolean;
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
  const autoHideDefault = options?.autoHideDefault ?? false;

  const [scrollY, setScrollY] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(!autoHideDefault);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | "idle">("idle");

  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const autoHideDefaultRef = useRef(autoHideDefault);
  autoHideDefaultRef.current = autoHideDefault;

  useEffect(() => {
    setIsNavVisible(!autoHideDefault);
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
            } else if (newDirection === "down" && (accumulatedDelta > 10 || autoHideDefaultRef.current)) {
              // Hide when scrolling down
              setIsNavVisible(false);
            } else if (newDirection === "up" && accumulatedDelta > 10) {
              // Instantly reveal when scrolling up anywhere
              setIsNavVisible(true);
            } else if (currentScrollY < 50 && !autoHideDefaultRef.current) {
              // Always visible in top anchor zone on regular pages
              setIsNavVisible(true);
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

  return { scrollY, isSticky, isNavVisible: resolvedNavVisible, scrollDirection };
}

