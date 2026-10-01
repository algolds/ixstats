// Builder theme utilities for consistent light/dark mode support

/**
 * Chart color palette that works with both light and dark themes
 */
export const chartColorPalette = {
  // Primary colors for main data series
  primary: [
    "var(--color-brand-primary)",
    "var(--color-brand-secondary)",
    "var(--color-purple-500)",
    "var(--color-success)",
    "var(--color-warning)",
    "var(--color-error)",
  ],

  // Semantic colors
  semantic: {
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    error: "var(--color-error)",
    info: "var(--color-brand-primary)",
  },

  // Economic tier colors
  economicTiers: {
    "Tier 1": "var(--color-success)",
    "Tier 2": "var(--color-brand-primary)",
    "Tier 3": "var(--color-warning)",
    "Tier 4": "var(--color-error)",
    "Tier 5": "var(--color-error-dark)",
  },

  // Social class colors
  socialClasses: {
    "Upper Class": "var(--color-brand-primary)",
    "Upper Middle Class": "var(--color-brand-secondary)",
    "Middle Class": "var(--color-success)",
    "Lower Middle Class": "var(--color-warning)",
    "Lower Class": "var(--color-error)",
  },

  // Government spending categories
  governmentSpending: {
    Defense: "var(--color-brand-primary)",
    Education: "var(--color-brand-secondary)",
    Healthcare: "var(--color-error)",
    Infrastructure: "var(--color-success)",
    "Social Security": "var(--color-warning)",
    Other: "var(--color-text-muted)",
  },

  // Age demographics
  ageGroups: {
    "0-15": "var(--color-brand-secondary)",
    "16-64": "var(--color-success)",
    "65+": "var(--color-error)",
  },

  // Geographic regions
  regions: {
    North: "var(--color-brand-primary)",
    South: "var(--color-brand-secondary)",
    East: "var(--color-success)",
    West: "var(--color-warning)",
    Central: "var(--color-error)",
  },

  // Education levels
  educationLevels: {
    "No Formal Education": "var(--color-error)",
    "Primary Education": "var(--color-warning)",
    "Secondary Education": "var(--color-success)",
    "Higher Education": "var(--color-brand-secondary)",
  },

  // Citizenship status
  citizenshipStatus: {
    Citizens: "var(--color-brand-primary)",
    "Permanent Residents": "var(--color-success)",
    "Temporary Residents": "var(--color-warning)",
    Other: "var(--color-error)",
  },

  // Gender demographics
  gender: {
    Male: "var(--color-brand-primary)",
    Female: "var(--color-brand-secondary)",
    Other: "var(--color-warning)",
  },

  // Urban/Rural split
  urbanRural: {
    Urban: "var(--color-brand-primary)",
    Rural: "var(--color-success)",
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
  // oxlint-disable-next-line typescript/no-unused-vars
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
