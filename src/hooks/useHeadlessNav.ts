"use client";

import { useNavigationScroll } from "./useNavigationScroll";

/**
 * Hook to manage fluid navigation visibility.
 * Delegates to useNavigationScroll for unified directional hysteresis and spring physics.
 */
export function useHeadlessNav(active = true) {
  const { isNavVisible } = useNavigationScroll();
  return { showNav: active ? isNavVisible : true, setShowNav: () => {} };
}

