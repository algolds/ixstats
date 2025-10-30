// Builder theme utilities for consistent light/dark mode support
import { type ChartColors } from "~/types/chart-types";

/**
 * Chart color palette that works with both light and dark themes
 */
export const chartColorPalette = {
  // Primary colors for main data series
  primary: [
    "hsl(var(--color-brand-primary-hsl))",
    "hsl(var(--color-brand-secondary-hsl))",
    "hsl(var(--color-brand-tertiary-hsl))",
    "hsl(var(--color-success-hsl))",
    "hsl(var(--color-warning-hsl))",
    "hsl(var(--color-error-hsl))",
  ],

  // Semantic colors
  semantic: {
    success: "hsl(var(--color-success-hsl))",
    warning: "hsl(var(--color-warning-hsl))",
    error: "hsl(var(--color-error-hsl))",
    info: "hsl(var(--color-brand-primary-hsl))",
  },

  // Economic tier colors
  economicTiers: {
    "Tier 1": "hsl(var(--color-success-hsl))",
    "Tier 2": "hsl(var(--color-brand-primary-hsl))",
    "Tier 3": "hsl(var(--color-warning-hsl))",
    "Tier 4": "hsl(var(--color-error-hsl))",
    "Tier 5": "hsl(var(--color-error-dark-hsl))",
  },

  // Social class colors
  socialClasses: {
    "Upper Class": "hsl(var(--color-brand-primary-hsl))",
    "Upper Middle Class": "hsl(var(--color-brand-secondary-hsl))",
    "Middle Class": "hsl(var(--color-success-hsl))",
    "Lower Middle Class": "hsl(var(--color-warning-hsl))",
    "Lower Class": "hsl(var(--color-error-hsl))",
  },

  // Government spending categories
  governmentSpending: {
    Defense: "hsl(var(--color-brand-primary-hsl))",
    Education: "hsl(var(--color-brand-secondary-hsl))",
    Healthcare: "hsl(var(--color-error-hsl))",
    Infrastructure: "hsl(var(--color-success-hsl))",
    "Social Security": "hsl(var(--color-warning-hsl))",
    Other: "hsl(var(--color-text-muted-hsl))",
  },

  // Age demographics
  ageGroups: {
    "0-15": "hsl(var(--color-brand-secondary-hsl))",
    "16-64": "hsl(var(--color-success-hsl))",
    "65+": "hsl(var(--color-error-hsl))",
  },

  // Geographic regions
  regions: {
    North: "hsl(var(--color-brand-primary-hsl))",
    South: "hsl(var(--color-brand-secondary-hsl))",
    East: "hsl(var(--color-success-hsl))",
    West: "hsl(var(--color-warning-hsl))",
    Central: "hsl(var(--color-error-hsl))",
  },

  // Education levels
  educationLevels: {
    "No Formal Education": "hsl(var(--color-error-hsl))",
    "Primary Education": "hsl(var(--color-warning-hsl))",
    "Secondary Education": "hsl(var(--color-success-hsl))",
    "Higher Education": "hsl(var(--color-brand-secondary-hsl))",
  },

  // Citizenship status
  citizenshipStatus: {
    Citizens: "hsl(var(--color-brand-primary-hsl))",
    "Permanent Residents": "hsl(var(--color-success-hsl))",
    "Temporary Residents": "hsl(var(--color-warning-hsl))",
    Other: "hsl(var(--color-error-hsl))",
  },

  // Gender demographics
  gender: {
    Male: "hsl(var(--color-brand-primary-hsl))",
    Female: "hsl(var(--color-brand-secondary-hsl))",
    Other: "hsl(var(--color-warning-hsl))",
  },

  // Urban/Rural split
  urbanRural: {
    Urban: "hsl(var(--color-brand-primary-hsl))",
    Rural: "hsl(var(--color-success-hsl))",
  },
};

/**
 * Get theme-aware color for chart data
 */
export function getChartColor(
  category: string,
  type: keyof typeof chartColorPalette = "primary"
): string {
  if (type === "primary") {
    const colors = chartColorPalette.primary;
    const hash = category.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length] || colors[0];
  }

  const palette = chartColorPalette[type];
  if (typeof palette === "object" && category in palette) {
    return (palette as Record<string, string>)[category];
  }

  if (typeof palette === "string") {
    return palette;
  }

  return chartColorPalette.primary[0];
}

/**
 * Get responsive button colors that work with glass physics
 */
export function getButtonColors(
  variant: "primary" | "secondary" | "success" | "warning" | "error" = "primary"
) {
  const variants = {
    primary: {
      base: "bg-[var(--color-brand-primary)]/20 border-[var(--color-brand-primary)]/50 text-[var(--color-brand-primary)]",
      hover:
        "hover:bg-[var(--color-brand-primary)]/30 hover:border-[var(--color-brand-primary)]/70",
      active: "active:bg-[var(--color-brand-primary)]/40",
      selected:
        "bg-[var(--color-brand-primary)]/30 border-[var(--color-brand-primary)]/70 shadow-lg",
    },
    secondary: {
      base: "bg-[var(--color-brand-secondary)]/20 border-[var(--color-brand-secondary)]/50 text-[var(--color-brand-secondary)]",
      hover:
        "hover:bg-[var(--color-brand-secondary)]/30 hover:border-[var(--color-brand-secondary)]/70",
      active: "active:bg-[var(--color-brand-secondary)]/40",
      selected:
        "bg-[var(--color-brand-secondary)]/30 border-[var(--color-brand-secondary)]/70 shadow-lg",
    },
    success: {
      base: "bg-[var(--color-success)]/20 border-[var(--color-success)]/50 text-[var(--color-success)]",
      hover: "hover:bg-[var(--color-success)]/30 hover:border-[var(--color-success)]/70",
      active: "active:bg-[var(--color-success)]/40",
      selected: "bg-[var(--color-success)]/30 border-[var(--color-success)]/70 shadow-lg",
    },
    warning: {
      base: "bg-[var(--color-warning)]/20 border-[var(--color-warning)]/50 text-[var(--color-warning)]",
      hover: "hover:bg-[var(--color-warning)]/30 hover:border-[var(--color-warning)]/70",
      active: "active:bg-[var(--color-warning)]/40",
      selected: "bg-[var(--color-warning)]/30 border-[var(--color-warning)]/70 shadow-lg",
    },
    error: {
      base: "bg-[var(--color-error)]/20 border-[var(--color-error)]/50 text-[var(--color-error)]",
      hover: "hover:bg-[var(--color-error)]/30 hover:border-[var(--color-error)]/70",
      active: "active:bg-[var(--color-error)]/40",
      selected: "bg-[var(--color-error)]/30 border-[var(--color-error)]/70 shadow-lg",
    },
  };

  return variants[variant];
}

/**
 * Get text colors for different states
 */
export function getTextColors() {
  return {
    primary: "text-[var(--color-text-primary)]",
    secondary: "text-[var(--color-text-secondary)]",
    muted: "text-[var(--color-text-muted)]",
    success: "text-[var(--color-success)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
    brand: "text-[var(--color-brand-primary)]",
  };
}

/**
 * Get background colors for different states
 */
export function getBackgroundColors() {
  return {
    primary: "bg-[var(--color-bg-primary)]",
    secondary: "bg-[var(--color-bg-secondary)]",
    tertiary: "bg-[var(--color-bg-tertiary)]",
    surface: "bg-[var(--color-surface)]",
    overlay: "bg-[var(--color-overlay)]",
  };
}

/**
 * Get border colors for different states
 */
export function getBorderColors() {
  return {
    primary: "border-[var(--color-border-primary)]",
    secondary: "border-[var(--color-border-secondary)]",
    focus: "border-[var(--color-border-focus)]",
    success: "border-[var(--color-success)]",
    warning: "border-[var(--color-warning)]",
    error: "border-[var(--color-error)]",
  };
}

/**
 * Generate chart-compatible colors for Recharts, Chart.js, etc.
 */
export function generateChartColors(
  count: number,
  type: keyof typeof chartColorPalette = "primary"
): string[] {
  const colors: string[] = [];

  if (type === "primary") {
    const baseColors = chartColorPalette.primary;
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
  } else {
    const palette = chartColorPalette[type];
    if (typeof palette === "object") {
      const paletteColors = Object.values(palette);
      for (let i = 0; i < count; i++) {
        colors.push(paletteColors[i % paletteColors.length]);
      }
    }
  }

  return colors;
}

/**
 * Convert theme color to various formats for different chart libraries
 */
export function convertThemeColorForChart(
  colorVar: string,
  opacity: number = 1
): {
  hsl: string;
  rgb: string;
  hex: string;
} {
  // For now, return the HSL format that works with CSS variables
  // In a real implementation, you might want to compute actual values
  return {
    hsl: `hsl(${colorVar})`,
    rgb: `hsl(${colorVar})`, // Charts typically accept HSL as well
    hex: `hsl(${colorVar})`, // Fallback to HSL
  };
}

/**
 * Get status indicator colors
 */
export function getStatusColors() {
  return {
    online: "text-[var(--color-success)] bg-[var(--color-success)]/20",
    offline: "text-[var(--color-error)] bg-[var(--color-error)]/20",
    pending: "text-[var(--color-warning)] bg-[var(--color-warning)]/20",
    loading: "text-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/20",
  };
}
