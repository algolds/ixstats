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
