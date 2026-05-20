/**
 * Builder Theme System
 * 
 * Unified theming for the MyCountry Builder system.
 * Follows the same structure as src/lib/mycountry-theme.ts for consistency.
 * 
 * Primary Builder Identity: Amber/Gold (matches MyCountry executive/overview theme)
 * Each section has unique accents while maintaining overall builder identity.
 */

// ─── Types ───

export type BuilderSection =
  | "foundation"
  | "identity"
  | "government"
  | "economics"
  | "preview"
  | "import";

export type BuilderTabTheme =
  | "builder"      // Overall builder theme
  | "foundation"
  | "identity"
  | "government"
  | "economics"
  | "preview"
  | "import";

export type IconCategory = "primary" | "secondary" | "tertiary" | "accent";

// ─── Constants ───

export const BUILDER_SECTIONS: BuilderSection[] = [
  "foundation",
  "identity",
  "government",
  "economics",
  "preview",
  "import",
];

/** Steps that form the actual build flow */
export const BUILD_STEPS: BuilderSection[] = BUILDER_SECTIONS;

// ─── Primary Builder Theme (Amber/Gold) ───

/**
 * Global builder accent colors - used for overall builder identity
 */
export const BUILDER_ACCENT = {
  primary: "#f59e0b",    // amber-500
  secondary: "#eab308",  // yellow-500
  tertiary: "#fbbf24",   // amber-400
  accent: "#f59e0b",     // amber-500
  gradient: "from-amber-500 to-yellow-500",
  activeGlow: "shadow-amber-500/30",
  border: "border-amber-500/20",
  darkBorder: "dark:border-amber-500/20",
  text: "text-amber-500",
  ring: "#f59e0b",
  background: "rgba(245, 158, 11, 0.08)",
  glow: "rgba(245, 158, 11, 0.3)",
} as const;

// ─── Section Theme Interface ───

export interface BuilderSectionTheme {
  /** Tailwind gradient classes (e.g., "from-emerald-500 to-teal-500") */
  gradient: string;
  /** Shadow glow for active state */
  activeGlow: string;
  /** Border color class */
  border: string;
  /** Dark mode border */
  darkBorder: string;
  /** Background gradient for sections */
  bgGradient: string;
  /** Text color class */
  text: string;
  /** Primary accent color name */
  accentColor: string;
  /** Ring/focus color (hex) */
  ring: string;
  /** Section display title */
  flavorTitle: string;
  /** Section subtitle/description */
  flavorSubtitle: string;
}

// ─── Section Themes ───

/**
 * Per-section theme definitions
 * Each section has unique accents while maintaining builder identity
 */
export const BUILDER_SECTION_THEMES: Record<BuilderSection, BuilderSectionTheme> = {
  foundation: {
    gradient: "from-amber-500 to-yellow-500",
    activeGlow: "shadow-amber-500/30",
    border: "border-amber-500/30",
    darkBorder: "dark:border-amber-500/20",
    bgGradient: "from-amber-500/8 via-amber-500/3 to-transparent",
    text: "text-amber-500",
    accentColor: "amber",
    ring: "#f59e0b",
    flavorTitle: "Foundation",
    flavorSubtitle: "Choose the roots of your nation",
  },
  identity: {
    gradient: "from-teal-500 to-cyan-500",
    activeGlow: "shadow-teal-500/30",
    border: "border-teal-500/30",
    darkBorder: "dark:border-teal-500/20",
    bgGradient: "from-teal-500/8 via-teal-500/3 to-transparent",
    text: "text-teal-500",
    accentColor: "teal",
    ring: "#14b8a6",
    flavorTitle: "National Identity",
    flavorSubtitle: "Define your nation's character and soul",
  },
  government: {
    gradient: "from-cyan-500 to-blue-500",
    activeGlow: "shadow-cyan-500/30",
    border: "border-cyan-500/30",
    darkBorder: "dark:border-cyan-500/20",
    bgGradient: "from-cyan-500/8 via-cyan-500/3 to-transparent",
    text: "text-cyan-500",
    accentColor: "cyan",
    ring: "#06b6d4",
    flavorTitle: "Government",
    flavorSubtitle: "Architect the halls of power",
  },
  economics: {
    gradient: "from-green-500 to-emerald-500",
    activeGlow: "shadow-green-500/30",
    border: "border-green-500/30",
    darkBorder: "dark:border-green-500/20",
    bgGradient: "from-green-500/8 via-green-500/3 to-transparent",
    text: "text-green-500",
    accentColor: "green",
    ring: "#22c55e",
    flavorTitle: "Economics",
    flavorSubtitle: "Shape the engines of prosperity",
  },
  preview: {
    gradient: "from-amber-400 to-yellow-400",
    activeGlow: "shadow-amber-400/30",
    border: "border-amber-400/30",
    darkBorder: "dark:border-amber-400/20",
    bgGradient: "from-amber-400/8 via-amber-400/3 to-transparent",
    text: "text-amber-400",
    accentColor: "amber",
    ring: "#fbbf24",
    flavorTitle: "Preview",
    flavorSubtitle: "Inspect your creation before it enters the world",
  },
  import: {
    gradient: "from-blue-500 to-indigo-500",
    activeGlow: "shadow-blue-500/30",
    border: "border-blue-500/30",
    darkBorder: "dark:border-blue-500/20",
    bgGradient: "from-blue-500/8 via-blue-500/3 to-transparent",
    text: "text-blue-500",
    accentColor: "blue",
    ring: "#3b82f6",
    flavorTitle: "Import from Wiki",
    flavorSubtitle: "Automagically import your country data from multiple wiki sources",
  },
};

// Legacy alias for backwards compatibility
export const BUILDER_THEME = BUILDER_SECTION_THEMES;

// ─── Tab Color Definitions (matches mycountry-theme.ts structure) ───

/**
 * Color definitions for builder tabs - matches TabColors structure in mycountry-theme.ts
 */
export const BuilderTabColors = {
  builder: {
    primary: "#b45309",    // Amber-700
    secondary: "#f59e0b",  // Amber-500
    accent: "#fbbf24",     // Amber-400
    background: "rgba(245, 158, 11, 0.08)",
    glow: "rgba(245, 158, 11, 0.3)",
    icon: "#92400e",       // Amber-800
  },
  foundation: {
    primary: "#b45309",    // Amber-700
    secondary: "#f59e0b",  // Amber-500
    accent: "#fbbf24",     // Amber-400
    background: "rgba(245, 158, 11, 0.08)",
    glow: "rgba(245, 158, 11, 0.3)",
    icon: "#92400e",       // Amber-800
  },
  identity: {
    primary: "#0d9488",    // Teal-600
    secondary: "#14b8a6",  // Teal-500
    accent: "#2dd4bf",     // Teal-400
    background: "rgba(20, 184, 166, 0.08)",
    glow: "rgba(20, 184, 166, 0.3)",
    icon: "#0f766e",       // Teal-700
  },
  government: {
    primary: "#0891b2",    // Cyan-600
    secondary: "#06b6d4",  // Cyan-500
    accent: "#22d3ee",     // Cyan-400
    background: "rgba(6, 182, 212, 0.08)",
    glow: "rgba(6, 182, 212, 0.3)",
    icon: "#0e7490",       // Cyan-700
  },
  economics: {
    primary: "#16a34a",    // Green-600
    secondary: "#22c55e",  // Green-500
    accent: "#4ade80",     // Green-400
    background: "rgba(34, 197, 94, 0.08)",
    glow: "rgba(34, 197, 94, 0.3)",
    icon: "#15803d",       // Green-700
  },
  preview: {
    primary: "#f59e0b",    // Amber-500
    secondary: "#fbbf24",  // Amber-400
    accent: "#fcd34d",     // Amber-300
    background: "rgba(251, 191, 36, 0.08)",
    glow: "rgba(251, 191, 36, 0.3)",
    icon: "#b45309",       // Amber-700
  },
  import: {
    primary: "#3b82f6",    // Blue-500
    secondary: "#60a5fa",  // Blue-400
    accent: "#93c5fd",     // Blue-300
    background: "rgba(59, 130, 246, 0.08)",
    glow: "rgba(59, 130, 246, 0.3)",
    icon: "#1d4ed8",       // Blue-700
  },
} as const;

// ─── Icon Mappings ───

/**
 * Icon mappings for each builder section
 */
export const BuilderTabIcons = {
  builder: {
    primary: "Hammer",
    secondary: "Wrench",
    tertiary: "Cog",
    accent: "Sparkles",
  },
  foundation: {
    primary: "Globe",
    secondary: "Map",
    tertiary: "Flag",
    accent: "Star",
  },
  identity: {
    primary: "Crown",
    secondary: "Shield",
    tertiary: "Flag",
    accent: "Sparkles",
  },
  government: {
    primary: "Building",
    secondary: "Landmark",
    tertiary: "Scale",
    accent: "Gavel",
  },
  economics: {
    primary: "TrendingUp",
    secondary: "DollarSign",
    tertiary: "BarChart3",
    accent: "Coins",
  },
  preview: {
    primary: "Eye",
    secondary: "FileCheck",
    tertiary: "CheckCircle",
    accent: "Rocket",
  },
  import: {
    primary: "Download",
    secondary: "Upload",
    tertiary: "Globe",
    accent: "Database",
  },
} as const;

// ─── Utility Functions ───

/**
 * Get theme for a specific builder section
 */
export function getBuilderSectionTheme(section: BuilderSection): BuilderSectionTheme {
  return BUILDER_SECTION_THEMES[section];
}

/**
 * Get tab colors for a specific builder section
 */
export function getBuilderTabColors(section: BuilderTabTheme) {
  return BuilderTabColors[section];
}

/**
 * Get icon for a specific builder section and category
 */
export function getBuilderIcon(section: BuilderTabTheme, category: IconCategory = "primary") {
  return BuilderTabIcons[section][category];
}

/**
 * Generate CSS custom properties for a builder section
 */
export function getBuilderCSSProperties(section: BuilderTabTheme): Record<string, string> {
  const colors = BuilderTabColors[section];
  return {
    "--builder-primary": colors.primary,
    "--builder-secondary": colors.secondary,
    "--builder-accent": colors.accent,
    "--builder-background": colors.background,
    "--builder-glow": colors.glow,
    "--builder-icon": colors.icon,
  };
}

/**
 * Get Tailwind classes for builder section theming
 */
export function getBuilderThemeClasses(section: BuilderSection) {
  const theme = BUILDER_SECTION_THEMES[section];
  return {
    container: `bg-gradient-to-br ${theme.bgGradient}`,
    card: `border ${theme.border} ${theme.darkBorder}`,
    activeCard: `border ${theme.border} ${theme.darkBorder} ${theme.activeGlow}`,
    text: theme.text,
    gradient: `bg-gradient-to-r ${theme.gradient}`,
    icon: `${theme.text}`,
    badge: `${theme.border} ${theme.text}`,
  };
}

// ─── Legacy Compatibility ───

/**
 * Map old BuilderStep names to new BuilderSection names.
 * foundation -> foundation, core -> identity, government -> government,
 * economics -> economics, preview -> preview
 */
export function legacyStepToSection(step: string): BuilderSection {
  if (step === "core") return "identity";
  if (step === "welcome" || step === "import") return "foundation";
  if (BUILDER_SECTIONS.includes(step as BuilderSection)) return step as BuilderSection;
  return "foundation";
}

export function sectionToLegacyStep(section: BuilderSection): string {
  if (section === "identity") return "core";
  return section;
}
