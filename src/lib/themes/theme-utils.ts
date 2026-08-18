// src/lib/theme-utils.ts
// Utility functions for theme-aware styling

/**
 * Get CSS custom property value
 */
export function getCSSVar(property: string): string {
  if (typeof window !== "undefined") {
    return getComputedStyle(document.documentElement).getPropertyValue(property);
  }
  return "";
}

/**
 * Economic tier styling helper
 */
export function getTierStyle(tier: string): { className: string; color: string } {
  const tierMap: Record<string, { className: string; color: string }> = {
    Advanced: {
      className: "tier-badge tier-advanced",
      color: "var(--color-tier-advanced)",
    },
    Developed: {
      className: "tier-badge tier-developed",
      color: "var(--color-tier-developed)",
    },
    Emerging: {
      className: "tier-badge tier-emerging",
      color: "var(--color-tier-emerging)",
    },
    Developing: {
      className: "tier-badge tier-developing",
      color: "var(--color-tier-developing)",
    },
  };
  return tierMap[tier] || tierMap.Developing!;
}

/**
 * Status indicator helper
 */
export function getStatusStyle(
  status: "online" | "offline" | "warning" | "info" | "active" | "inactive"
): { className: string; color: string } {
  const statusMap = {
    online: { className: "status-online", color: "var(--color-success)" },
    offline: { className: "status-offline", color: "var(--color-error)" },
    warning: { className: "status-warning", color: "var(--color-warning)" },
    info: { className: "status-info", color: "var(--color-info)" },
    active: { className: "status-online", color: "var(--color-success)" },
    inactive: {
      className: "text-[var(--color-text-muted)]",
      color: "var(--color-text-muted)",
    },
  };
  return statusMap[status];
}

/**
 * Chart color helper - gets appropriate colors for chart libraries
 */
export function getChartColors(): {
  background: string;
  grid: string;
  text: string;
  axis: string;
  tooltip: string;
  colors: string[];
} {
  return {
    background: getCSSVar("--color-bg-secondary") || "#1f2937",
    grid: getCSSVar("--color-border-primary") || "#374151",
    text: getCSSVar("--color-text-muted") || "#9ca3af",
    axis: getCSSVar("--color-border-secondary") || "#4b5563",
    tooltip: getCSSVar("--color-surface-blur") || "rgba(31, 41, 55, 0.95)",
    colors: [
      getCSSVar("--color-chart-1") || "#8b5cf6",
      getCSSVar("--color-chart-2") || "#06b6d4",
      getCSSVar("--color-chart-3") || "#84cc16",
      getCSSVar("--color-chart-4") || "#f97316",
      getCSSVar("--color-chart-5") || "#ec4899",
      getCSSVar("--color-chart-6") || "#14b8a6",
    ],
  };
}

/**
 * Get responsive class names based on screen size
 */
export function getResponsiveClasses(mobile: string, tablet?: string, desktop?: string): string {
  const classes = [mobile];
  if (tablet) classes.push(`md:${tablet}`);
  if (desktop) classes.push(`lg:${desktop}`);
  return classes.join(" ");
}

/**
 * Conditional class helper
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Theme-aware button class generator
 */
export function getButtonClasses(
  variant: "primary" | "secondary" | "danger" | "success" = "primary",
  size: "sm" | "md" | "lg" = "md",
  disabled = false
): string {
  const base =
    "inline-flex items-center justify-center font-medium rounded-md " +
    "transition-all focus:outline-none focus-ring";
  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger:
      "bg-[var(--color-error)] hover:bg-[var(--color-error-dark)] " +
      "text-white border-[var(--color-error)]",
    success:
      "bg-[var(--color-success)] hover:bg-[var(--color-success-dark)] " +
      "text-white border-[var(--color-success)]",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  const disabledCls = disabled ? "opacity-50 cursor-not-allowed" : "";
  return cn(base, variants[variant], sizes[size], disabledCls);
}

/**
 * Theme-aware input class generator
 */
export function getInputClasses(hasError = false, size: "sm" | "md" | "lg" = "md"): string {
  const base = "form-input";
  const sizes = {
    sm: "px-2.5 py-1.5 text-sm",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-3 text-base",
  };
  const errorCls = hasError
    ? "border-[var(--color-error)] focus:border-[var(--color-error)] " +
      "focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]"
    : "";
  return cn(base, sizes[size], errorCls);
}

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
 * Loading state class generator
 */
export function getLoadingClasses(type: "spinner" | "skeleton" | "pulse" = "spinner"): string {
  const map = {
    spinner: "loading-spinner",
    skeleton: "loading-skeleton rounded",
    pulse: "animate-pulse-slow",
  };
  return map[type];
}

/**
 * Chart tooltip style generator for Recharts
 */
export function getChartTooltipStyle(): React.CSSProperties {
  return {
    backgroundColor: getCSSVar("--color-surface-blur"),
    border: `1px solid ${getCSSVar("--color-border-primary")}`,
    borderRadius: "0.375rem",
    color: getCSSVar("--color-text-primary"),
    fontSize: "0.875rem",
    boxShadow: getCSSVar("--shadow-lg"),
    backdropFilter: "blur(8px)",
  };
}

/**
 * Migration helper - converts old Tailwind classes to new system
 */
export function migrateClasses(oldClasses: string): string {
  const map: Record<string, string> = {
    // Backgrounds
    "bg-gray-50": "bg-[var(--color-bg-primary)]",
    "bg-gray-100": "bg-[var(--color-bg-tertiary)]",
    "bg-gray-800": "bg-[var(--color-bg-secondary)]",
    "bg-gray-900": "bg-[var(--color-bg-primary)]",
    "bg-white": "bg-[var(--color-bg-surface)]",
    // Text colors
    "text-gray-50": "text-[var(--color-text-primary)]",
    "text-gray-200": "text-[var(--color-text-secondary)]",
    "text-gray-300": "text-[var(--color-text-tertiary)]",
    "text-gray-400": "text-[var(--color-text-muted)]",
    "text-gray-500": "text-[var(--color-text-muted)]",
    "text-gray-600": "text-[var(--color-text-tertiary)]",
    "text-gray-700": "text-[var(--color-text-secondary)]",
    "text-gray-800": "text-[var(--color-text-primary)]",
    "text-gray-900": "text-[var(--color-text-primary)]",
    "text-white": "text-[var(--color-text-primary)]",
    // Borders
    "border-gray-200": "border-[var(--color-border-primary)]",
    "border-gray-300": "border-[var(--color-border-secondary)]",
    "border-gray-600": "border-[var(--color-border-secondary)]",
    "border-gray-700": "border-[var(--color-border-primary)]",
    // Brand colors
    "text-indigo-600": "text-[var(--color-brand-primary)]",
    "text-indigo-400": "text-[var(--color-brand-secondary)]",
    "bg-indigo-600": "bg-[var(--color-brand-primary)]",
    "bg-indigo-500": "bg-[var(--color-brand-primary)]",
    // Status colors
    "text-green-600": "status-online",
    "text-red-600": "status-offline",
    "text-yellow-600": "status-warning",
    "text-blue-600": "status-info",
  };
  let result = oldClasses;
  Object.entries(map).forEach(([oldCls, newCls]) => {
    result = result.replace(new RegExp(`\\b${oldCls}\\b`, "g"), newCls);
  });
  return result;
}

/**
 * Dark/Light theme class helper for legacy components
 */
export function themeClass(darkClass: string, lightClass?: string): string {
  const light = lightClass || darkClass;
  return `${darkClass} light:${light}`;
}

/**
 * Generate animation classes
 */
export function getAnimationClasses(
  animation: "fade-in" | "slide-up" | "pulse-slow" = "fade-in"
): string {
  const map = {
    "fade-in": "animate-fade-in",
    "slide-up": "animate-slide-up",
    "pulse-slow": "animate-pulse-slow",
  };
  return map[animation];
}

/**
 * Format a number, optionally as USD currency, with precision and
 * compact notation support.
 */
export function formatNumber(
  num: number | null | undefined,
  options: {
    isCurrency?: boolean;
    precision?: number;
    compact?: boolean;
  } = {}
): string {
  if (num == null || !isFinite(num)) {
    return "N/A";
  }
  const { isCurrency = false, precision = 0, compact = false } = options;
  const nfOpts: Intl.NumberFormatOptions = {
    style: isCurrency ? "currency" : "decimal",
    currency: isCurrency ? "USD" : undefined,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    notation: compact ? "compact" : "standard",
  };
  return new Intl.NumberFormat("en-US", nfOpts).format(num);
}
