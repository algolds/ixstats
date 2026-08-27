"use client";

import { useState, useEffect } from "react";

/**
 * Responsive navigation state: tracks the mobile breakpoint (<=1023px) and the
 * mobile menu open/close state, closing the menu on navigation or when switching
 * to desktop and locking body scroll while open. Extracted from navigation.tsx (audit C3).
 */
export function useResponsiveNav(normalizedPathname: string) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 1023;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Close the mobile menu on navigation.
  useEffect(() => {
    if (!isMobile) return;
    setMobileMenuOpen(false);
    // oxlint-disable-next-line
  }, [normalizedPathname, isMobile]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  // Close the menu when switching to desktop.
  useEffect(() => {
    if (isMobile) return;
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, mobileMenuOpen]);

  return { isMobile, mobileMenuOpen, setMobileMenuOpen };
}
