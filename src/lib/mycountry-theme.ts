/**
 * MyCountry Theme System
 * Unified theming utilities for the executive dashboard
 */

export type TabTheme =
  | "executive"
  | "economy"
  | "labor"
  | "government"
  | "demographics"
  | "intelligence"
  | "detailed"
  | "modeling";

export type IconCategory = "primary" | "secondary" | "tertiary" | "accent";

/**
 * Icon mappings for each tab using Tabler and Lucide icons
 */
export const MyCountryTabIcons = {
  executive: {
    primary: "Crown", // Leadership symbol
    secondary: "Gavel", // Executive authority
    tertiary: "Shield", // Protection/security
    accent: "Star", // Excellence/achievement
  },
  economy: {
    primary: "TrendingUp", // Economic growth
    secondary: "DollarSign", // Currency/financial
    tertiary: "BarChart3", // Data visualization
    accent: "Target", // Goals/objectives
  },
  labor: {
    primary: "Users", // Workforce
    secondary: "Briefcase", // Employment
    tertiary: "Settings", // Industrial/mechanical
    accent: "Activity", // Productivity
  },
  government: {
    primary: "Building", // Government institutions
    secondary: "FileText", // Documentation/policy
    tertiary: "Scale", // Justice/regulation
    accent: "Globe", // National scope
  },
  demographics: {
    primary: "Users", // Population
    secondary: "PieChart", // Demographics breakdown
    tertiary: "Map", // Geographic distribution
    accent: "Calendar", // Time/age factors
  },
  intelligence: {
    primary: "Shield", // Security
    secondary: "Eye", // Surveillance/monitoring
    tertiary: "Lock", // Classified/secure
    accent: "Zap", // Strategic operations
  },
  detailed: {
    primary: "BarChart4", // Advanced analytics
    secondary: "TrendingUp", // Trend analysis
    tertiary: "Search", // Investigation/research
    accent: "LineChart", // Data visualization
  },
  modeling: {
    primary: "Calculator", // Mathematical modeling
    secondary: "GitBranch", // Scenario branches
    tertiary: "Cpu", // Computational power
    accent: "Layers", // Model layers/complexity
  },
} as const;

/**
 * Color definitions for each tab theme
 */
export const TabColors = {
  executive: {
    primary: "#B45309", // Amber-700
    secondary: "#F59E0B", // Amber-500
    accent: "#FBBF24", // Amber-400
    background: "rgba(180, 83, 9, 0.08)",
    glow: "rgba(180, 83, 9, 0.3)",
    icon: "#92400E", // Amber-800
  },
  economy: {
    primary: "#059669", // Emerald-600
    secondary: "#10B981", // Emerald-500
    accent: "#34D399", // Emerald-400
    background: "rgba(5, 150, 105, 0.08)",
    glow: "rgba(5, 150, 105, 0.3)",
    icon: "#047857", // Emerald-700
  },
  labor: {
    primary: "#DC2626", // Red-600
    secondary: "#EF4444", // Red-500
    accent: "#F87171", // Red-400
    background: "rgba(220, 38, 38, 0.08)",
    glow: "rgba(220, 38, 38, 0.3)",
    icon: "#B91C1C", // Red-700
  },
  government: {
    primary: "#7C3AED", // Violet-600
    secondary: "#8B5CF6", // Violet-500
    accent: "#A78BFA", // Violet-400
    background: "rgba(124, 58, 237, 0.08)",
    glow: "rgba(124, 58, 237, 0.3)",
    icon: "#6D28D9", // Violet-700
  },
  demographics: {
    primary: "#0891B2", // Cyan-600
    secondary: "#06B6D4", // Cyan-500
    accent: "#22D3EE", // Cyan-400
    background: "rgba(8, 145, 178, 0.08)",
    glow: "rgba(8, 145, 178, 0.3)",
    icon: "#0E7490", // Cyan-700
  },
  intelligence: {
    primary: "#1F2937", // Gray-800
    secondary: "#374151", // Gray-700
    accent: "#6B7280", // Gray-500
    background: "rgba(31, 41, 55, 0.08)",
    glow: "rgba(31, 41, 55, 0.3)",
    icon: "#111827", // Gray-900
  },
  detailed: {
    primary: "#BE185D", // Pink-700
    secondary: "#EC4899", // Pink-500
    accent: "#F472B6", // Pink-400
    background: "rgba(190, 24, 93, 0.08)",
    glow: "rgba(190, 24, 93, 0.3)",
    icon: "#9D174D", // Pink-800
  },
  modeling: {
    primary: "#1E40AF", // Blue-700
    secondary: "#3B82F6", // Blue-500
    accent: "#60A5FA", // Blue-400
    background: "rgba(30, 64, 175, 0.08)",
    glow: "rgba(30, 64, 175, 0.3)",
    icon: "#1E3A8A", // Blue-800
  },
} as const;

/**
 * CSS class generators for tab theming
 */
export const getTabThemeClasses = (theme: TabTheme) => {
  return {
    content: `tab-content-${theme}`,
    interactive: "tab-interactive",
    glass: "glass-card-themed",
    icon: "tab-icon",
    metric: {
      primary: "tab-metric-primary",
      secondary: "tab-metric-secondary",
      small: "tab-metric-small",
    },
    effects: {
      shimmer: "tab-shimmer",
      glow: "tab-glow",
    },
  };
};

/**
 * Get icon component name for a specific tab and category
 */
export const getTabIcon = (theme: TabTheme, category: IconCategory = "primary") => {
  return MyCountryTabIcons[theme][category];
};

/**
 * Get color values for a specific tab theme
 */
export const getTabColors = (theme: TabTheme) => {
  return TabColors[theme];
};

/**
 * Generate CSS custom properties for a tab theme
 */
export const getTabCSSProperties = (theme: TabTheme) => {
  const colors = getTabColors(theme);
  return {
    "--current-tab-primary": colors.primary,
    "--current-tab-secondary": colors.secondary,
    "--current-tab-accent": colors.accent,
    "--current-tab-bg": colors.background,
    "--current-tab-glow": colors.glow,
    "--current-tab-icon": colors.icon,
  };
};

/**
 * Utility to combine tab theme with additional classes
 */
export const combineTabClasses = (theme: TabTheme, additionalClasses: string[] = []) => {
  const themeClasses = getTabThemeClasses(theme);
  return [themeClasses.content, ...additionalClasses].filter(Boolean).join(" ");
};

/**
 * Check if a tab theme is valid
 */
export const isValidTabTheme = (theme: string): theme is TabTheme => {
  return Object.keys(MyCountryTabIcons).includes(theme);
};

/**
 * Get all available tab themes
 */
export const getAllTabThemes = (): TabTheme[] => {
  return Object.keys(MyCountryTabIcons) as TabTheme[];
};

/**
 * Get theme-specific animation delays for staggered effects
 */
export const getTabAnimationDelay = (theme: TabTheme, index: number = 0) => {
  const baseDelays: Record<TabTheme, number> = {
    executive: 0,
    economy: 100,
    labor: 200,
    government: 300,
    demographics: 400,
    intelligence: 500,
    detailed: 600,
    modeling: 700,
  };

  return baseDelays[theme] + index * 50;
};

/**
 * Generate theme-aware Tailwind classes
 */
export const getTabTailwindClasses = (theme: TabTheme) => {
  const colors = getTabColors(theme);

  // Convert hex colors to Tailwind-compatible values
  const colorMap: Record<string, string> = {
    "#B45309": "amber-700",
    "#F59E0B": "amber-500",
    "#FBBF24": "amber-400",
    "#059669": "emerald-600",
    "#10B981": "emerald-500",
    "#34D399": "emerald-400",
    "#DC2626": "red-600",
    "#EF4444": "red-500",
    "#F87171": "red-400",
    "#7C3AED": "violet-600",
    "#8B5CF6": "violet-500",
    "#A78BFA": "violet-400",
    "#0891B2": "cyan-600",
    "#06B6D4": "cyan-500",
    "#22D3EE": "cyan-400",
    "#1F2937": "gray-800",
    "#374151": "gray-700",
    "#6B7280": "gray-500",
    "#BE185D": "pink-700",
    "#EC4899": "pink-500",
    "#F472B6": "pink-400",
    "#1E40AF": "blue-700",
    "#3B82F6": "blue-500",
    "#60A5FA": "blue-400",
  };

  return {
    text: {
      primary: `text-${colorMap[colors.primary] || "gray-800"}`,
      secondary: `text-${colorMap[colors.secondary] || "gray-600"}`,
      accent: `text-${colorMap[colors.accent] || "gray-500"}`,
    },
    bg: {
      primary: `bg-${colorMap[colors.primary] || "gray-800"}`,
      secondary: `bg-${colorMap[colors.secondary] || "gray-600"}`,
      accent: `bg-${colorMap[colors.accent] || "gray-500"}`,
    },
    border: {
      primary: `border-${colorMap[colors.primary] || "gray-800"}`,
      secondary: `border-${colorMap[colors.secondary] || "gray-600"}`,
      accent: `border-${colorMap[colors.accent] || "gray-500"}`,
    },
  };
};

/**
 * Default export with all utilities
 */
export default {
  TabIcons: MyCountryTabIcons,
  TabColors,
  getTabThemeClasses,
  getTabIcon,
  getTabColors,
  getTabCSSProperties,
  combineTabClasses,
  isValidTabTheme,
  getAllTabThemes,
  getTabAnimationDelay,
  getTabTailwindClasses,
};
