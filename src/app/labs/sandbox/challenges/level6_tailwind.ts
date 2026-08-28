/**
 * LEVEL 6: TAILWIND CSS & UI COMPONENT CRASH COURSE
 * 
 * Instructions for Kistan:
 * Complete the 4 functions below using semantic Tailwind CSS v4 tokens and the `cn()` utility.
 * The test assertions in the Labs Sandbox will automatically validate your code in real time.
 * 
 * Key Principles to Remember:
 * 1. Zero-Hex Rule: Never hardcode `#hex` colors (e.g. `bg-[#12141c]`). Use semantic tokens like
 *    `bg-card`, `text-foreground`, `border-border/60`, `text-muted-foreground`.
 * 2. Tactile Physics: Interactive triggers must have `duration-150 active:scale-[0.98]` to provide
 *    Apple-style tactile feedback on press.
 * 3. Mobile-First Grids: Default classes style small screens (`grid-cols-1`). Add `sm:` for tablets
 *    and `lg:` for desktop viewports.
 * 4. Specificity Safe Merging: Always pass base classes, dynamic states, and optional prop overrides
 *    through `cn()` so Tailwind classes resolve without collisions.
 */

import { cn } from "~/lib/utils";

export type DirectiveStatus = "ACTIVE" | "PENDING" | "CRITICAL";
export type ButtonVariant = "primary" | "secondary" | "destructive";

/**
 * 6A: Generate Semantic Status Badge Classes
 * 
 * Return Tailwind classes for a pill badge based on directive status:
 * - "ACTIVE": emerald theme ("border-emerald-500/30 bg-emerald-500/10 text-emerald-400")
 * - "PENDING": amber theme ("border-amber-500/30 bg-amber-500/10 text-amber-400")
 * - "CRITICAL": rose theme ("border-rose-500/30 bg-rose-500/10 text-rose-400")
 * 
 * Base classes required on every badge:
 * "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
 */
export function getDirectiveBadgeClasses(status: DirectiveStatus): string {
  const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border";
  
  switch (status) {
    case "ACTIVE":
      return cn(base, "border-emerald-500/30 bg-emerald-500/10 text-emerald-400");
    case "PENDING":
      return cn(base, "border-amber-500/30 bg-amber-500/10 text-amber-400");
    case "CRITICAL":
      return cn(base, "border-rose-500/30 bg-rose-500/10 text-rose-400");
  }
}

/**
 * 6B: Generate Tactile Button Classes
 * 
 * Return classes with Apple-style mechanical compression on pointer-down:
 * Required baseline:
 * - Layout & typography: "inline-flex items-center justify-center font-medium rounded-xl transition-all"
 * - Timing easing: "duration-150"
 * - Mechanical press: "active:scale-[0.98]"
 * 
 * Variant styling:
 * - "primary": "bg-primary text-primary-foreground hover:bg-primary/90"
 * - "secondary": "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60"
 * - "destructive": "bg-destructive text-destructive-foreground hover:bg-destructive/90"
 */
export function getTactileButtonClasses(variant: ButtonVariant): string {
  const base =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 active:scale-[0.98]";

  switch (variant) {
    case "primary":
      return cn(base, "bg-primary text-primary-foreground hover:bg-primary/90");
    case "secondary":
      return cn(
        base,
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60"
      );
    case "destructive":
      return cn(base, "bg-destructive text-destructive-foreground hover:bg-destructive/90");
  }
}

/**
 * 6C: Build Responsive Grid Layout Classes
 * 
 * Mobile-first grid progression:
 * - 2 cols: "grid grid-cols-1 sm:grid-cols-2 gap-4"
 * - 3 cols: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
 * - 4 cols: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
 */
export function buildResponsiveGridClasses(cols: 2 | 3 | 4): string {
  switch (cols) {
    case 2:
      return "grid grid-cols-1 sm:grid-cols-2 gap-4";
    case 3:
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6";
    case 4:
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6";
  }
}

/**
 * 6D: Compose Metric Card Classes with `cn()`
 * 
 * Merge base card styling with dynamic positive/negative indicators and custom class overrides:
 * Base: "p-4 bg-card text-card-foreground border border-border/60 rounded-2xl shadow-sm"
 * If isPositive is true: add "border-emerald-500/40"
 * If isPositive is false: add "border-rose-500/40"
 * Always merge `customClass` cleanly using `cn()`.
 */
export function formatMetricCardClasses(isPositive: boolean, customClass?: string): string {
  const base = "p-4 bg-card text-card-foreground border border-border/60 rounded-2xl shadow-sm";
  const statusBorder = isPositive ? "border-emerald-500/40" : "border-rose-500/40";
  return cn(base, statusBorder, customClass);
}
