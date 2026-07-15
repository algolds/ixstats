"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook to manage scroll-up and scroll-down navigation visibility (headless mode).
 * - Wheel up at the top reveals the nav.
 * - Wheel down hides it.
 * - Touch drag-up at the top reveals the nav, drag-down hides it.
 */
export function useHeadlessNav(active = true) {
  const [showNav, setShowNav] = useState(false);
  const touchStartY = useRef(0);

  useEffect(() => {
    if (!active) return;
    const isAtTop = () => window.scrollY <= 0;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && isAtTop()) {
        setShowNav(true);
      } else if (e.deltaY > 0) {
        setShowNav(false);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) {
        touchStartY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTop()) return;
      if (!e.touches[0]) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 20) {
        setShowNav(true);
      } else if (dy < -20) {
        setShowNav(false);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return { showNav, setShowNav };
}
