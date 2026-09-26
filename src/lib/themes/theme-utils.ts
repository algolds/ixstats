// src/lib/themes/theme-utils.ts
// Theme-aware class helpers that still have callers. Eleven unused helpers were
// removed on 2026-09-25 (plan 342); restore from git history if one is needed again.

import { cn } from "~/lib/utils/cn";
export { cn };

/**
 * Theme-aware card class generator
 */
export function getCardClasses(
  variant: "default" | "elevated" | "bordered" = "default",
  interactive = false
): string {
  const base = "card";
  const variants = { default: "", elevated: "shadow-lg", bordered: "border-2" };
  const interactiveCls = interactive ? "cursor-pointer" : "";
  return cn(base, variants[variant], interactiveCls);
}

/**
 * Dark/Light theme class helper for legacy components
 */
export function themeClass(darkClass: string, lightClass?: string): string {
  const light = lightClass || darkClass;
  return `${darkClass} light:${light}`;
}

export { formatNumber } from "~/lib/utils/format-utils";
