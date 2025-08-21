/**
 * Image Color Extractor - Extract dominant colors from uploaded images
 * Used for dynamic theming based on flag and coat of arms uploads
 */

export interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
  rgbPrimary: { r: number; g: number; b: number };
  rgbSecondary: { r: number; g: number; b: number };
  rgbAccent: { r: number; g: number; b: number };
}

interface ColorCluster {
  color: { r: number; g: number; b: number };
  count: number;
  percentage: number;
}

/**
 * Extract dominant colors from an image file or URL
 */
export async function extractColorsFromImage(
  imageSource: File | string
): Promise<ExtractedColors> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      try {
        // Set canvas size (smaller for performance)
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Draw image to canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = extractDominantColors(imageData);
        
        resolve(colors);
      } catch (error) {
        reject(error);
      }
    };

    let retryAttempted = false;

    const handleError = () => {
      if (!retryAttempted && typeof imageSource === 'string') {
        console.warn('CORS failed, retrying without crossOrigin for:', imageSource);
        retryAttempted = true;
        // Retry without CORS
        const img2 = new Image();
        img2.onload = img.onload;
        img2.onerror = () => reject(new Error('Failed to load image after retry'));
        img2.src = imageSource;
      } else {
        reject(new Error('Failed to load image'));
      }
    };

    img.onerror = handleError;

    // Handle different image sources
    if (typeof imageSource === 'string') {
      img.crossOrigin = 'anonymous';
      img.src = imageSource;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(imageSource);
    }
  });
}

/**
 * Extract dominant colors from image data using color quantization
 */
function extractDominantColors(imageData: ImageData): ExtractedColors {
  const data = imageData.data;
  const colorCounts = new Map<string, { color: { r: number; g: number; b: number }; count: number }>();
  
  // Sample pixels (skip some for performance)
  const step = 4; // Sample every 4th pixel
  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Skip transparent pixels and very light/dark colors
    if (a < 128 || (r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) {
      continue;
    }
    
    // Quantize colors to reduce noise
    const quantizedR = Math.round(r / 32) * 32;
    const quantizedG = Math.round(g / 32) * 32;
    const quantizedB = Math.round(b / 32) * 32;
    
    const key = `${quantizedR},${quantizedG},${quantizedB}`;
    
    if (colorCounts.has(key)) {
      colorCounts.get(key)!.count++;
    } else {
      colorCounts.set(key, {
        color: { r: quantizedR, g: quantizedG, b: quantizedB },
        count: 1
      });
    }
  }
  
  // Sort by frequency and filter
  const sortedColors = Array.from(colorCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Take top 10 colors
  
  // Calculate total pixels for percentage
  const totalPixels = sortedColors.reduce((sum, color) => sum + color.count, 0);
  
  const clusters: ColorCluster[] = sortedColors.map(color => ({
    color: color.color,
    count: color.count,
    percentage: (color.count / totalPixels) * 100
  }));
  
  // Select primary, secondary, and accent colors
  const primary = clusters[0]?.color || { r: 99, g: 102, b: 241 };
  const secondary = findDistinctColor(clusters, primary) || { r: 139, g: 92, b: 246 };
  const accent = findDistinctColor(clusters, primary, secondary) || { r: 6, g: 182, b: 212 };
  
  return {
    primary: rgbToHex(primary),
    secondary: rgbToHex(secondary),
    accent: rgbToHex(accent),
    rgbPrimary: primary,
    rgbSecondary: secondary,
    rgbAccent: accent
  };
}

/**
 * Find a color that is visually distinct from existing colors
 */
function findDistinctColor(
  clusters: ColorCluster[],
  ...existingColors: { r: number; g: number; b: number }[]
): { r: number; g: number; b: number } | null {
  for (const cluster of clusters) {
    const color = cluster.color;
    let isDistinct = true;
    
    for (const existing of existingColors) {
      const distance = colorDistance(color, existing);
      if (distance < 100) { // Minimum distance threshold
        isDistinct = false;
        break;
      }
    }
    
    if (isDistinct) {
      return color;
    }
  }
  
  return null;
}

/**
 * Calculate color distance using Euclidean distance in RGB space
 */
function colorDistance(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Convert RGB to hex
 */
function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const componentToHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${componentToHex(rgb.r)}${componentToHex(rgb.g)}${componentToHex(rgb.b)}`;
}

/**
 * Generate theme CSS variables from extracted colors
 */
export function generateImageThemeCSS(colors: ExtractedColors): Record<string, string> {
  return {
    '--country-primary': colors.primary,
    '--country-secondary': colors.secondary,
    '--country-accent': colors.accent,
    '--country-primary-rgb': `${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}`,
    '--country-secondary-rgb': `${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}`,
    '--country-accent-rgb': `${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}`,
    '--country-glow-primary': `rgba(${colors.rgbPrimary.r}, ${colors.rgbPrimary.g}, ${colors.rgbPrimary.b}, 0.3)`,
    '--country-glow-secondary': `rgba(${colors.rgbSecondary.r}, ${colors.rgbSecondary.g}, ${colors.rgbSecondary.b}, 0.3)`,
    '--country-glow-accent': `rgba(${colors.rgbAccent.r}, ${colors.rgbAccent.g}, ${colors.rgbAccent.b}, 0.3)`,
    '--flag-primary': colors.primary, // Backwards compatibility
    '--flag-secondary': colors.secondary,
    '--flag-accent': colors.accent
  };
}

/**
 * Apply extracted colors to DOM element
 */
export function applyExtractedColors(element: HTMLElement, colors: ExtractedColors): void {
  const cssVars = generateImageThemeCSS(colors);
  
  // Add themed class
  element.classList.add('image-themed', 'country-themed');
  
  // Apply CSS variables
  Object.entries(cssVars).forEach(([property, value]) => {
    element.style.setProperty(property, value);
  });
}

/**
 * Get contrasting text color for a background color
 */
export function getContrastColor(backgroundColor: string): string {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}