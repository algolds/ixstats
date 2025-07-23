/**
 * Flag Color Extractor - Extracts dominant colors from country flags
 * Used to create themed UI effects based on flag colors
 */

interface FlagColors {
  primary: string;
  secondary: string;
  accent: string;
  rgbPrimary: { r: number; g: number; b: number };
  rgbSecondary: { r: number; g: number; b: number };
  rgbAccent: { r: number; g: number; b: number };
}

// Predefined color schemes for common countries (fallback when color extraction isn't available)
const FLAG_COLOR_PRESETS: Record<string, FlagColors> = {
  "United_States": {
    primary: "#B22234",
    secondary: "#FFFFFF", 
    accent: "#3C3B6E",
    rgbPrimary: { r: 178, g: 34, b: 52 },
    rgbSecondary: { r: 255, g: 255, b: 255 },
    rgbAccent: { r: 60, g: 59, b: 110 }
  },
  "United_Kingdom": {
    primary: "#012169",
    secondary: "#FFFFFF",
    accent: "#C8102E", 
    rgbPrimary: { r: 1, g: 33, b: 105 },
    rgbSecondary: { r: 255, g: 255, b: 255 },
    rgbAccent: { r: 200, g: 16, b: 46 }
  },
  "Germany": {
    primary: "#000000",
    secondary: "#DD0000",
    accent: "#FFCE00",
    rgbPrimary: { r: 0, g: 0, b: 0 },
    rgbSecondary: { r: 221, g: 0, b: 0 },
    rgbAccent: { r: 255, g: 206, b: 0 }
  },
  "France": {
    primary: "#0055A4",
    secondary: "#FFFFFF", 
    accent: "#EF4135",
    rgbPrimary: { r: 0, g: 85, b: 164 },
    rgbSecondary: { r: 255, g: 255, b: 255 },
    rgbAccent: { r: 239, g: 65, b: 53 }
  },
  "Japan": {
    primary: "#BC002D",
    secondary: "#FFFFFF",
    accent: "#BC002D",
    rgbPrimary: { r: 188, g: 0, b: 45 },
    rgbSecondary: { r: 255, g: 255, b: 255 },
    rgbAccent: { r: 188, g: 0, b: 45 }
  },
  "Canada": {
    primary: "#FF0000",
    secondary: "#FFFFFF",
    accent: "#FF0000",
    rgbPrimary: { r: 255, g: 0, b: 0 },
    rgbSecondary: { r: 255, g: 255, b: 255 },
    rgbAccent: { r: 255, g: 0, b: 0 }
  },
  "Australia": {
    primary: "#012169",
    secondary: "#FFFFFF",
    accent: "#C8102E",
    rgbPrimary: { r: 1, g: 33, b: 105 },
    rgbSecondary: { r: 255, g: 255, b: 255 },
    rgbAccent: { r: 200, g: 16, b: 46 }
  },
  "China": {
    primary: "#DE2910",
    secondary: "#FFDE00",
    accent: "#DE2910", 
    rgbPrimary: { r: 222, g: 41, b: 16 },
    rgbSecondary: { r: 255, g: 222, b: 0 },
    rgbAccent: { r: 222, g: 41, b: 16 }
  },
  "India": {
    primary: "#FF9933",
    secondary: "#FFFFFF",
    accent: "#138808",
    rgbPrimary: { r: 255, g: 153, b: 51 },
    rgbSecondary: { r: 255, g: 255, b: 255 },
    rgbAccent: { r: 19, g: 136, b: 8 }
  },
  "Brazil": {
    primary: "#009739",
    secondary: "#FEDD00", 
    accent: "#002776",
    rgbPrimary: { r: 0, g: 151, b: 57 },
    rgbSecondary: { r: 254, g: 221, b: 0 },
    rgbAccent: { r: 0, g: 39, b: 118 }
  }
};

// Default fallback colors
const DEFAULT_COLORS: FlagColors = {
  primary: "#6366f1",
  secondary: "#8b5cf6", 
  accent: "#06b6d4",
  rgbPrimary: { r: 99, g: 102, b: 241 },
  rgbSecondary: { r: 139, g: 92, b: 246 },
  rgbAccent: { r: 6, g: 182, b: 212 }
};

/**
 * Gets flag colors for a country, either from presets or generates them
 */
export function getFlagColors(countryName: string): FlagColors {
  // Normalize country name
  const normalizedName = countryName.replace(/\s+/g, '_');
  
  // Check if we have a preset for this country
  if (FLAG_COLOR_PRESETS[normalizedName]) {
    return FLAG_COLOR_PRESETS[normalizedName];
  }
  
  // Generate colors based on country name hash (for consistency)
  return generateFlagColors(countryName);
}

/**
 * Generates consistent colors based on country name
 */
function generateFlagColors(countryName: string): FlagColors {
  // Simple hash function for consistency
  let hash = 0;
  for (let i = 0; i < countryName.length; i++) {
    const char = countryName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Generate colors based on hash
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 120) % 360;
  const hue3 = (hue1 + 240) % 360;
  
  const primary = hslToHex(hue1, 70, 50);
  const secondary = hslToHex(hue2, 60, 60);
  const accent = hslToHex(hue3, 80, 45);
  
  return {
    primary,
    secondary,
    accent,
    rgbPrimary: hexToRgb(primary),
    rgbSecondary: hexToRgb(secondary),
    rgbAccent: hexToRgb(accent)
  };
}

/**
 * Converts HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Converts hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1] || '63', 16),
    g: parseInt(result[2] || '66', 16), 
    b: parseInt(result[3] || 'f1', 16)
  } : { r: 99, g: 102, b: 241 };
}

/**
 * Generates CSS custom properties for flag-based theming
 */
export function generateFlagThemeCSS(colors: FlagColors): Record<string, string> {
  return {
    // Legacy flag variables for backwards compatibility
    '--flag-primary': colors.primary,
    '--flag-secondary': colors.secondary,
    '--flag-accent': colors.accent,
    '--flag-primary-rgb': `${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}`,
    '--flag-secondary-rgb': `${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}`,
    '--flag-accent-rgb': `${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}`,
    '--flag-glow-primary': `rgba(${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}, 0.3)`,
    '--flag-glow-secondary': `rgba(${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}, 0.3)`,
    '--flag-glow-accent': `rgba(${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}, 0.3)`,
    '--flag-border-primary': `rgba(${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}, 0.5)`,
    '--flag-border-secondary': `rgba(${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}, 0.5)`,
    '--flag-border-accent': `rgba(${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}, 0.5)`,
    
    // New country theming variables
    '--country-primary': colors.primary,
    '--country-secondary': colors.secondary,
    '--country-accent': colors.accent,
    '--country-tertiary': colors.primary, // Use primary as tertiary fallback
    '--country-text': '#ffffff',
    '--country-text-muted': '#e5e7eb'
  };
}

/**
 * Apply country theming to an element
 */
export function applyCountryTheming(element: HTMLElement, countryName: string): void {
  const colors = getFlagColors(countryName);
  const cssVars = generateFlagThemeCSS(colors);
  
  // Add country-themed class
  element.classList.add('country-themed');
  
  // Apply CSS variables
  Object.entries(cssVars).forEach(([property, value]) => {
    element.style.setProperty(property, value);
  });
}

/**
 * Creates flag-themed CSS classes
 */
export function getFlagThemeClasses(countryName: string): string {
  const colors = getFlagColors(countryName);
  return `
    .flag-glow-primary {
      box-shadow: 0 0 20px rgba(${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}, 0.4),
                  0 0 40px rgba(${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}, 0.2);
      border: 1px solid rgba(${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}, 0.3);
    }
    
    .flag-glow-secondary {
      box-shadow: 0 0 20px rgba(${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}, 0.4),
                  0 0 40px rgba(${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}, 0.2);
      border: 1px solid rgba(${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}, 0.3);
    }
    
    .flag-glow-accent {
      box-shadow: 0 0 20px rgba(${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}, 0.4),
                  0 0 40px rgba(${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}, 0.2);
      border: 1px solid rgba(${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}, 0.3);
    }
  `;
}