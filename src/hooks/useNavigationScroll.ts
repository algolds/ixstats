"use client";

import { useState, useEffect } from "react";

/**
 * Tracks scroll position with RAF-smoothed updates and a hysteresis-based sticky
 * threshold (60px scrolling down, 40px scrolling up). Extracted from navigation.tsx (audit C3).
 */
export function useNavigationScroll() {
  const [scrollY, setScrollY] = useState(0);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    let rafId: number | undefined;
    let isScrolling = false;
    let lastScrollY = window.scrollY;
    let lastTimestamp = performance.now();

    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        rafId = requestAnimationFrame((timestamp) => {
          const currentScrollY = window.scrollY;
          const deltaTime = timestamp - lastTimestamp;
          const direction = currentScrollY > lastScrollY ? "down" : "up";

          // Smooth interpolation for scroll position updates
          const smoothScrollY =
            lastScrollY + (currentScrollY - lastScrollY) * Math.min(deltaTime / 16, 1);
          setScrollY(smoothScrollY);

          // Sticky state with smooth transition zone and hysteresis
          const stickyThreshold = direction === "down" ? 60 : 40;
          setIsSticky(currentScrollY > stickyThreshold);

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

  return { scrollY, isSticky };
}
