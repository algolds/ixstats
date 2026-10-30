"use client";

import { useState } from "react";
import { useMediaQuery } from "~/hooks/useMediaQuery";

/**
 * Whether a picker's filters and category browser are open: open on desktop widths, closed on narrow
 * screens, and the Filters button overrides either.
 */
export function useFiltersOpen() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [override, setOverride] = useState<boolean | null>(null);
  const isCategoryExpanded = override ?? isDesktop;
  return { isCategoryExpanded, onToggleFilters: () => setOverride(!isCategoryExpanded) };
}
