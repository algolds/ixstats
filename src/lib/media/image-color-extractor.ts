export interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
  rgbPrimary: { r: number; g: number; b: number };
  rgbSecondary: { r: number; g: number; b: number };
  rgbAccent: { r: number; g: number; b: number };
}

/**
 * Generate theme CSS variables from extracted colors
 */
export function generateImageThemeCSS(colors: ExtractedColors): Record<string, string> {
  return {
    "--country-primary": colors.primary,
    "--country-secondary": colors.secondary,
    "--country-accent": colors.accent,
    "--country-primary-rgb": `${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}`,
    "--country-secondary-rgb": `${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}`,
    "--country-accent-rgb": `${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}`,
    "--country-glow-primary": `rgba(${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}, 0.3)`,
    "--country-glow-secondary": `rgba(${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}, 0.3)`,
    "--country-glow-accent": `rgba(${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}, 0.3)`,
    "--flag-primary": colors.primary, // Backwards compatibility
    "--flag-secondary": colors.secondary,
    "--flag-accent": colors.accent,
  };
}
