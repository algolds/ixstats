// Enhanced Theme Utilities for Section-Specific Theming

import { useMemo } from "react";
import type { SectionId, SectionColorScheme, PrimitiveTheme } from "./types";

// Section to theme mapping based on the existing design system
export const SECTION_THEME_MAP: Record<SectionId, PrimitiveTheme> = {
  symbols: "gold", // National Symbols - Gold/Warning theme
  core: "blue", // Core Indicators - Blue/Primary theme
  labor: "emerald", // Labor & Employment - Green/Success theme
  fiscal: "gold", // Fiscal System - Gold/Warning theme
  government: "purple", // Government Spending - Purple theme
  demographics: "red", // Demographics - Red/Error theme
  spending: "purple", // Government Spending - Purple theme
  preview: "blue", // Preview sections - Blue theme
  sectors: "emerald", // Sectors - Green theme
};

// Enhanced color schemes with CSS custom properties and glass effects
export const SECTION_COLOR_SCHEMES: Record<PrimitiveTheme, SectionColorScheme> = {
  gold: {
    primary: "var(--color-warning)",
    secondary: "color-mix(in srgb, var(--color-warning) 80%, transparent)",
    accent: "hsl(45, 93%, 58%)", // Bright gold accent
    background: "color-mix(in srgb, var(--color-warning) 5%, transparent)",
    border: "color-mix(in srgb, var(--color-warning) 30%, transparent)",
    text: "var(--color-warning-dark)",
    muted: "color-mix(in srgb, var(--color-warning) 60%, transparent)",
  },
  blue: {
    primary: "var(--color-brand-primary)",
    secondary: "var(--color-brand-secondary)",
    accent: "hsl(217, 91%, 60%)", // Bright blue accent
    background: "color-mix(in srgb, var(--color-brand-primary) 5%, transparent)",
    border: "color-mix(in srgb, var(--color-brand-primary) 30%, transparent)",
    text: "var(--color-indigo-600)",
    muted: "color-mix(in srgb, var(--color-brand-primary) 60%, transparent)",
  },
  emerald: {
    primary: "var(--color-success)",
    secondary: "color-mix(in srgb, var(--color-success) 80%, transparent)",
    accent: "hsl(160, 84%, 39%)", // Bright emerald accent
    background: "color-mix(in srgb, var(--color-success) 5%, transparent)",
    border: "color-mix(in srgb, var(--color-success) 30%, transparent)",
    text: "var(--color-success-dark)",
    muted: "color-mix(in srgb, var(--color-success) 60%, transparent)",
  },
  purple: {
    primary: "var(--color-purple-500)",
    secondary: "color-mix(in srgb, var(--color-purple-500) 80%, transparent)",
    accent: "hsl(262, 83%, 58%)", // Bright purple accent
    background: "color-mix(in srgb, var(--color-purple-500) 5%, transparent)",
    border: "color-mix(in srgb, var(--color-purple-500) 30%, transparent)",
    text: "var(--color-purple-600)",
    muted: "color-mix(in srgb, var(--color-purple-500) 60%, transparent)",
  },
  red: {
    primary: "var(--color-error)",
    secondary: "color-mix(in srgb, var(--color-error) 80%, transparent)",
    accent: "hsl(0, 84%, 60%)", // Bright red accent
    background: "color-mix(in srgb, var(--color-error) 5%, transparent)",
    border: "color-mix(in srgb, var(--color-error) 30%, transparent)",
    text: "var(--color-error-dark)",
    muted: "color-mix(in srgb, var(--color-error) 60%, transparent)",
  },
  default: {
    primary: "hsl(217, 91%, 60%)", // Bright blue as fallback
    secondary: "hsl(217, 91%, 70%)",
    accent: "hsl(217, 91%, 50%)",
    background: "hsl(217, 91%, 95%)",
    border: "hsl(217, 30%, 70%)",
    text: "hsl(217, 100%, 95%)", // Light text for dark mode
    muted: "hsl(217, 30%, 70%)",
  },
};

// Glass depth configurations for consistent visual hierarchy
export const GLASS_DEPTHS = {
  // Facet 3: opaque roles (content is never glass); names kept for callers.
  base: {
    backdrop: "",
    bg: "bg-surface-secondary",
    border: "border-separator",
    shadow: "",
  },
  elevated: {
    backdrop: "",
    bg: "bg-surface",
    border: "border-separator",
    shadow: "shadow-card",
  },
  modal: {
    backdrop: "",
    bg: "bg-surface-elevated",
    border: "border-separator",
    shadow: "shadow-floating",
  },
};

// Utility hook to get section-specific theme
export function useSectionTheme(sectionId?: SectionId, overrideTheme?: PrimitiveTheme) {
  return useMemo(() => {
    const theme = overrideTheme || (sectionId ? SECTION_THEME_MAP[sectionId] : "default");
    const colors =
      SECTION_COLOR_SCHEMES[theme as PrimitiveTheme] || SECTION_COLOR_SCHEMES["default"];

    return {
      theme,
      colors,
      cssVars: {
        "--primitive-primary": colors.primary,
        "--primitive-secondary": colors.secondary,
        "--primitive-accent": colors.accent,
        "--primitive-background": colors.background,
        "--primitive-border": colors.border,
        "--primitive-text": colors.text,
        "--primitive-muted": colors.muted,
      },
    };
  }, [sectionId, overrideTheme]);
}

// Utility to get section colors without hook
export function getSectionColors(
  sectionId?: SectionId,
  theme?: PrimitiveTheme
): SectionColorScheme {
  const resolvedTheme = theme || (sectionId ? SECTION_THEME_MAP[sectionId] : "default");
  return SECTION_COLOR_SCHEMES[resolvedTheme as PrimitiveTheme] || SECTION_COLOR_SCHEMES["default"];
}

// Utility to generate chart colors for consistent theming with complementary colors
export function generateSectionChartColors(
  sectionId?: SectionId,
  theme?: PrimitiveTheme,
  count: number = 5
): string[] {
  const colors = getSectionColors(sectionId, theme);

  // Define a set of vibrant, distinct fallback colors
  const vibrantFallbacks = [
    "hsl(217, 91%, 60%)", // Blue
    "hsl(160, 84%, 60%)", // Emerald
    "hsl(45, 93%, 58%)", // Gold
    "hsl(262, 83%, 58%)", // Purple
    "hsl(0, 84%, 60%)", // Red
    "hsl(300, 80%, 60%)", // Magenta
    "hsl(60, 90%, 60%)", // Yellow
    "hsl(180, 80%, 60%)", // Cyan
  ];

  // Define base hue and complementary color schemes for each theme
  const themeColorConfig = {
    gold: { baseHue: 45, complementary: [25, 65, 195, 285] }, // Orange, yellow-green, blue, purple
    blue: { baseHue: 217, complementary: [37, 157, 277, 337] }, // Orange, cyan, purple, pink
    emerald: { baseHue: 160, complementary: [340, 200, 280, 40] }, // Red-pink, light blue, purple, orange
    purple: { baseHue: 262, complementary: [82, 142, 22, 202] }, // Green, teal, yellow-green, blue
    red: { baseHue: 0, complementary: [120, 180, 240, 300] }, // Green, cyan, blue, magenta
    default: { baseHue: 220, complementary: [40, 100, 160, 280] },
  };

  const config = themeColorConfig[theme || "default"] || themeColorConfig.default;

  return Array.from({ length: count }, (_, i) => {
    // Use vibrant fallbacks for the first few colors to ensure visibility
    if (i < vibrantFallbacks.length) {
      return vibrantFallbacks[i];
    }

    // Fallback to existing complementary/triadic logic for additional colors
    if (i === 0) {
      return colors.primary;
    } else if (i === 1) {
      return colors.accent;
    } else if (i < 6) {
      const complementaryHue = config.complementary[(i - 2) % config.complementary.length];
      const saturation = Math.max(75, 90 - i * 2);
      const lightness = Math.max(55, 65 + (i % 2 === 0 ? 10 : -5));
      return `hsl(${complementaryHue}, ${saturation}%, ${lightness}%)`;
    } else {
      const triadicOffset = 120 * ((i - 6) % 3);
      const newHue = (config.baseHue + triadicOffset) % 360;
      const saturation = Math.max(70, 90 - (i - 6) * 2);
      const lightness = Math.max(55, 70 + ((i - 6) % 2 === 0 ? 10 : -5));
      return `hsl(${newHue}, ${saturation}%, ${lightness}%)`;
    }
  });
}

// Utility to get glass classes with theme integration
export function getGlassClasses(
  depth: "base" | "elevated" | "modal" = "base",
  theme?: PrimitiveTheme,
  sectionId?: SectionId
): string {
  const glassConfig = GLASS_DEPTHS[depth];
  // oxlint-disable-next-line eslint/no-unused-vars
  const colors = getSectionColors(sectionId, theme);

  return [
    glassConfig.backdrop,
    glassConfig.bg,
    glassConfig.border,
    glassConfig.shadow,
    "rounded-control",
    "transition-[border-color,box-shadow] duration-fast ease-out-facet",
  ]
    .filter(Boolean)
    .join(" ");
}

// Export section theme mapping for external use
export type SectionTheme = typeof SECTION_THEME_MAP;
