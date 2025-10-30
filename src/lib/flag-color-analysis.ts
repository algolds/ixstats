/**
 * Flag Color Analysis Utility
 * Analyzes flag images to determine optimal text color for readability
 */

interface ColorAnalysisResult {
  dominantColors: string[];
  brightness: number;
  contrast: number;
  recommendedTextColor: string;
  backgroundColor: string;
}

/**
 * Converts RGB values to perceived brightness (0-255)
 * Uses relative luminance formula for better perceived brightness
 */
function calculatePerceivedBrightness(r: number, g: number, b: number): number {
  // Convert to linear RGB
  const linearR = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const linearG = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const linearB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Calculate relative luminance
  return 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
}

/**
 * Calculates contrast ratio between two colors
 */
function calculateContrastRatio(brightness1: number, brightness2: number): number {
  const lighter = Math.max(brightness1, brightness2);
  const darker = Math.min(brightness1, brightness2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Analyzes an image and returns color analysis
 */
export async function analyzeFlagImage(imageUrl: string): Promise<ColorAnalysisResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        // Scale down for performance
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const colors: { [key: string]: number } = {};
        let totalBrightness = 0;
        let pixelCount = 0;

        // Sample pixels and analyze colors
        for (let i = 0; i < data.length; i += 16) {
          // Sample every 4th pixel for performance
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          const a = data[i + 3] / 255;

          if (a > 0.5) {
            // Only consider non-transparent pixels
            const brightness = calculatePerceivedBrightness(r, g, b);
            totalBrightness += brightness;
            pixelCount++;

            // Group similar colors
            const colorKey = `${Math.round(r * 16)}-${Math.round(g * 16)}-${Math.round(b * 16)}`;
            colors[colorKey] = (colors[colorKey] || 0) + 1;
          }
        }

        const avgBrightness = totalBrightness / pixelCount;

        // Find dominant colors
        const sortedColors = Object.entries(colors)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([color]) => {
            const [r, g, b] = color.split("-").map((n) => Math.round((parseInt(n) * 255) / 16));
            return `rgb(${r}, ${g}, ${b})`;
          });

        // Determine optimal text color
        const whiteBrightness = 1;
        const blackBrightness = 0;

        const whiteContrast = calculateContrastRatio(avgBrightness, whiteBrightness);
        const blackContrast = calculateContrastRatio(avgBrightness, blackBrightness);

        // WCAG AA compliance requires 4.5:1 contrast ratio for normal text
        let recommendedTextColor: string;
        let backgroundColor: string;

        if (whiteContrast >= blackContrast) {
          if (whiteContrast >= 4.5) {
            recommendedTextColor = "white";
            backgroundColor = "rgba(0, 0, 0, 0.5)";
          } else {
            recommendedTextColor = "white";
            backgroundColor = "rgba(0, 0, 0, 0.7)";
          }
        } else {
          if (blackContrast >= 4.5) {
            recommendedTextColor = "black";
            backgroundColor = "rgba(255, 255, 255, 0.5)";
          } else {
            recommendedTextColor = "black";
            backgroundColor = "rgba(255, 255, 255, 0.7)";
          }
        }

        resolve({
          dominantColors: sortedColors,
          brightness: avgBrightness,
          contrast: Math.max(whiteContrast, blackContrast),
          recommendedTextColor,
          backgroundColor,
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

/**
 * Quick fallback color analysis based on URL or country name patterns
 * Used when image analysis fails or for better performance
 */
export function getFallbackTextColor(countryName?: string): ColorAnalysisResult {
  // Common patterns for countries with dark flags
  const darkFlagPatterns = [
    "japan",
    "south korea",
    "germany",
    "estonia",
    "afghanistan",
    "albania",
    "austria",
    "belgium",
    "egypt",
    "estonia",
  ];

  // Common patterns for countries with light flags
  const lightFlagPatterns = [
    "finland",
    "israel",
    "greece",
    "argentina",
    "honduras",
    "somalia",
    "uruguay",
    "guatemala",
    "el salvador",
  ];

  const lowerName = countryName?.toLowerCase() || "";

  if (darkFlagPatterns.some((pattern) => lowerName.includes(pattern))) {
    return {
      dominantColors: ["#000000"],
      brightness: 0.1,
      contrast: 15,
      recommendedTextColor: "white",
      backgroundColor: "rgba(0, 0, 0, 0.6)",
    };
  }

  if (lightFlagPatterns.some((pattern) => lowerName.includes(pattern))) {
    return {
      dominantColors: ["#ffffff"],
      brightness: 0.9,
      contrast: 15,
      recommendedTextColor: "black",
      backgroundColor: "rgba(255, 255, 255, 0.6)",
    };
  }

  // Default for mixed/unknown flags - use safer dark background
  return {
    dominantColors: [],
    brightness: 0.5,
    contrast: 4.5,
    recommendedTextColor: "white",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  };
}

/**
 * Main function to get optimal text styling for a flag
 */
export async function getOptimalTextStyling(
  imageUrl?: string,
  countryName?: string
): Promise<{
  color: string;
  textShadow?: string;
  backgroundColor?: string;
  backdropFilter?: string;
}> {
  try {
    let analysis: ColorAnalysisResult;

    if (imageUrl) {
      try {
        analysis = await analyzeFlagImage(imageUrl);
      } catch {
        analysis = getFallbackTextColor(countryName);
      }
    } else {
      analysis = getFallbackTextColor(countryName);
    }

    const isWhiteText = analysis.recommendedTextColor === "white";

    // Create sophisticated multi-layer text shadows for better readability
    const textShadow = isWhiteText
      ? [
          "0 0 20px rgba(0, 0, 0, 0.9)", // Large glow
          "0 0 10px rgba(0, 0, 0, 0.8)", // Medium glow
          "0 2px 4px rgba(0, 0, 0, 0.9)", // Sharp shadow
          "0 1px 2px rgba(0, 0, 0, 1)", // Crisp edge
          "1px 1px 0 rgba(0, 0, 0, 0.8)", // Outline
          "-1px -1px 0 rgba(0, 0, 0, 0.8)", // Outline
          "1px -1px 0 rgba(0, 0, 0, 0.8)", // Outline
          "-1px 1px 0 rgba(0, 0, 0, 0.8)", // Outline
        ].join(", ")
      : [
          "0 0 20px rgba(255, 255, 255, 0.9)", // Large glow
          "0 0 10px rgba(255, 255, 255, 0.8)", // Medium glow
          "0 2px 4px rgba(0, 0, 0, 0.7)", // Dark shadow for contrast
          "0 1px 2px rgba(0, 0, 0, 0.9)", // Crisp dark edge
          "1px 1px 0 rgba(255, 255, 255, 0.8)", // White outline
          "-1px -1px 0 rgba(255, 255, 255, 0.8)",
          "1px -1px 0 rgba(255, 255, 255, 0.8)",
          "-1px 1px 0 rgba(255, 255, 255, 0.8)",
        ].join(", ");

    return {
      color: analysis.recommendedTextColor,
      textShadow,
      backgroundColor: undefined, // Remove background boxes
      backdropFilter: undefined,
    };
  } catch (error) {
    console.warn("Flag color analysis failed, using default styling:", error);
    // Safe default
    return {
      color: "white",
      textShadow: [
        "0 0 20px rgba(0, 0, 0, 0.9)",
        "0 0 10px rgba(0, 0, 0, 0.8)",
        "0 2px 4px rgba(0, 0, 0, 0.9)",
        "0 1px 2px rgba(0, 0, 0, 1)",
        "1px 1px 0 rgba(0, 0, 0, 0.8)",
        "-1px -1px 0 rgba(0, 0, 0, 0.8)",
        "1px -1px 0 rgba(0, 0, 0, 0.8)",
        "-1px 1px 0 rgba(0, 0, 0, 0.8)",
      ].join(", "),
      backgroundColor: undefined,
      backdropFilter: undefined,
    };
  }
}
