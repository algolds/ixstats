// Enhanced Theme Utilities for Section-Specific Theming

import { useMemo } from 'react';
import type { SectionId, SectionColorScheme, PrimitiveTheme } from './types';

// Section to theme mapping based on the existing design system
export const SECTION_THEME_MAP: Record<SectionId, PrimitiveTheme> = {
  symbols: 'gold',      // National Symbols - Gold/Warning theme
  core: 'blue',         // Core Indicators - Blue/Primary theme  
  labor: 'emerald',     // Labor & Employment - Green/Success theme
  fiscal: 'gold',       // Fiscal System - Gold/Warning theme
  government: 'purple', // Government Spending - Purple theme
  demographics: 'red'   // Demographics - Red/Error theme
};

// Enhanced color schemes with CSS custom properties and glass effects
export const SECTION_COLOR_SCHEMES: Record<PrimitiveTheme, SectionColorScheme> = {
  gold: {
    primary: 'hsl(var(--color-warning-hsl))',
    secondary: 'hsl(var(--color-warning-hsl) / 0.8)',
    accent: 'hsl(45, 93%, 58%)', // Bright gold accent
    background: 'hsl(var(--color-warning-hsl) / 0.05)',
    border: 'hsl(var(--color-warning-hsl) / 0.3)',
    text: 'hsl(var(--color-warning-dark-hsl))',
    muted: 'hsl(var(--color-warning-hsl) / 0.6)'
  },
  blue: {
    primary: 'hsl(var(--color-brand-primary-hsl))',
    secondary: 'hsl(var(--color-brand-secondary-hsl))',
    accent: 'hsl(217, 91%, 60%)', // Bright blue accent
    background: 'hsl(var(--color-brand-primary-hsl) / 0.05)',
    border: 'hsl(var(--color-brand-primary-hsl) / 0.3)',
    text: 'hsl(var(--color-brand-primary-dark-hsl))',
    muted: 'hsl(var(--color-brand-primary-hsl) / 0.6)'
  },
  emerald: {
    primary: 'hsl(var(--color-success-hsl))',
    secondary: 'hsl(var(--color-success-hsl) / 0.8)',
    accent: 'hsl(160, 84%, 39%)', // Bright emerald accent
    background: 'hsl(var(--color-success-hsl) / 0.05)',
    border: 'hsl(var(--color-success-hsl) / 0.3)',
    text: 'hsl(var(--color-success-dark-hsl))',
    muted: 'hsl(var(--color-success-hsl) / 0.6)'
  },
  purple: {
    primary: 'hsl(var(--color-purple-hsl))',
    secondary: 'hsl(var(--color-purple-hsl) / 0.8)',
    accent: 'hsl(262, 83%, 58%)', // Bright purple accent
    background: 'hsl(var(--color-purple-hsl) / 0.05)',
    border: 'hsl(var(--color-purple-hsl) / 0.3)',
    text: 'hsl(var(--color-purple-dark-hsl))',
    muted: 'hsl(var(--color-purple-hsl) / 0.6)'
  },
  red: {
    primary: 'hsl(var(--color-error-hsl))',
    secondary: 'hsl(var(--color-error-hsl) / 0.8)',
    accent: 'hsl(0, 84%, 60%)', // Bright red accent
    background: 'hsl(var(--color-error-hsl) / 0.05)',
    border: 'hsl(var(--color-error-hsl) / 0.3)',
    text: 'hsl(var(--color-error-dark-hsl))',
    muted: 'hsl(var(--color-error-hsl) / 0.6)'
  },
  default: {
    primary: 'hsl(217, 91%, 60%)', // Bright blue as fallback
    secondary: 'hsl(217, 91%, 70%)',
    accent: 'hsl(217, 91%, 50%)',
    background: 'hsl(217, 91%, 95%)',
    border: 'hsl(217, 30%, 70%)',
    text: 'hsl(217, 100%, 95%)', // Light text for dark mode
    muted: 'hsl(217, 30%, 70%)'
  }
};

// Glass depth configurations for consistent visual hierarchy
export const GLASS_DEPTHS = {
  base: {
    backdrop: 'backdrop-blur-sm',
    bg: 'bg-[var(--color-bg-secondary)]/70 dark:bg-[var(--color-bg-secondary)]/80',
    border: 'border-[var(--color-border-primary)]/30 dark:border-[var(--color-border-primary)]/40',
    shadow: 'shadow-sm dark:shadow-md'
  },
  elevated: {
    backdrop: 'backdrop-blur-md',
    bg: 'bg-[var(--color-bg-secondary)]/80 dark:bg-[var(--color-bg-secondary)]/90',
    border: 'border-[var(--color-border-primary)]/40 dark:border-[var(--color-border-primary)]/50',
    shadow: 'shadow-lg dark:shadow-xl'
  },
  modal: {
    backdrop: 'backdrop-blur-lg',
    bg: 'bg-[var(--color-bg-secondary)]/90 dark:bg-[var(--color-bg-secondary)]/95',
    border: 'border-[var(--color-border-primary)]/50 dark:border-[var(--color-border-primary)]/60',
    shadow: 'shadow-2xl dark:shadow-3xl'
  }
};

// Utility hook to get section-specific theme
export function useSectionTheme(sectionId?: SectionId, overrideTheme?: PrimitiveTheme) {
  return useMemo(() => {
    const theme = overrideTheme || (sectionId ? SECTION_THEME_MAP[sectionId] : 'default');
    const colors = SECTION_COLOR_SCHEMES[theme];
    
    return {
      theme,
      colors,
      cssVars: {
        '--primitive-primary': colors.primary,
        '--primitive-secondary': colors.secondary,
        '--primitive-accent': colors.accent,
        '--primitive-background': colors.background,
        '--primitive-border': colors.border,
        '--primitive-text': colors.text,
        '--primitive-muted': colors.muted,
      }
    };
  }, [sectionId, overrideTheme]);
}

// Utility to get section colors without hook
export function getSectionColors(sectionId?: SectionId, theme?: PrimitiveTheme): SectionColorScheme {
  const resolvedTheme = theme || (sectionId ? SECTION_THEME_MAP[sectionId] : 'default');
  return SECTION_COLOR_SCHEMES[resolvedTheme];
}

// Utility to generate chart colors for consistent theming with complementary colors
export function generateSectionChartColors(sectionId?: SectionId, theme?: PrimitiveTheme, count: number = 5): string[] {
  const colors = getSectionColors(sectionId, theme);
  
  // Define base hue and complementary color schemes for each theme
  const themeColorConfig = {
    gold: { baseHue: 45, complementary: [25, 65, 195, 285] }, // Orange, yellow-green, blue, purple
    blue: { baseHue: 217, complementary: [37, 157, 277, 337] }, // Orange, cyan, purple, pink
    emerald: { baseHue: 160, complementary: [340, 200, 280, 40] }, // Red-pink, light blue, purple, orange
    purple: { baseHue: 262, complementary: [82, 142, 22, 202] }, // Green, teal, yellow-green, blue
    red: { baseHue: 0, complementary: [120, 180, 240, 300] }, // Green, cyan, blue, magenta
    default: { baseHue: 220, complementary: [40, 100, 160, 280] }
  };
  
  const config = themeColorConfig[theme || 'default'] || themeColorConfig.default;
                 
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) {
      // Primary theme color for the main data
      return colors.primary;
    } else if (i === 1) {
      // Accent theme color for secondary data
      return colors.accent;
    } else if (i < 6) {
      // Use complementary colors for variety - NO BLACK, ensure lightness > 50%
      const complementaryHue = config.complementary[(i - 2) % config.complementary.length];
      const saturation = Math.max(75, 90 - (i * 2)); // Higher saturation for vibrancy
      const lightness = Math.max(55, 65 + (i % 2 === 0 ? 10 : -5)); // Ensure never too dark
      return `hsl(${complementaryHue}, ${saturation}%, ${lightness}%)`;
    } else {
      // For additional colors, create triadic variations - NO BLACK, ALWAYS BRIGHT
      const triadicOffset = 120 * ((i - 6) % 3); // Triadic color harmony
      const newHue = (config.baseHue + triadicOffset) % 360;
      const saturation = Math.max(70, 90 - ((i - 6) * 2)); // Higher minimum saturation
      const lightness = Math.max(55, 70 + ((i - 6) % 2 === 0 ? 10 : -5)); // ALWAYS bright colors
      return `hsl(${newHue}, ${saturation}%, ${lightness}%)`;
    }
  });
}

// Utility to get glass classes with theme integration
export function getGlassClasses(
  depth: 'base' | 'elevated' | 'modal' = 'base',
  theme?: PrimitiveTheme,
  sectionId?: SectionId
): string {
  const glassConfig = GLASS_DEPTHS[depth];
  const colors = getSectionColors(sectionId, theme);
  
  return [
    glassConfig.backdrop,
    glassConfig.bg,
    glassConfig.border,
    glassConfig.shadow,
    'rounded-lg',
    'transition-all duration-200 ease-out',
    'hover:shadow-lg hover:bg-[var(--color-bg-secondary)]/80',
    'dark:hover:bg-[var(--color-bg-secondary)]/95',
    'focus-within:shadow-lg focus-within:bg-[var(--color-bg-secondary)]/85',
    'dark:focus-within:bg-[var(--color-bg-secondary)]/95',
    'group-hover:shadow-md'
  ].join(' ');
}

// Export section theme mapping for external use
export type SectionTheme = typeof SECTION_THEME_MAP;