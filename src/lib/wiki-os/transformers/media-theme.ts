// src/lib/wiki-os/media-theme.ts
// Core TypeScript definitions, media type detection, CSS filter math, and storage utilities
// for WikiOS dynamic & theme-compliant image/media rendering (Auto, Plinth).

export type MediaThemeMode =
  | "auto"
  | "plinth"
  // Legacy aliases:
  | "adaptive"
  | "plate"
  | "raw"
  | "original"
  | "invert";

export type MediaType = "svg" | "math" | "diagram" | "photo" | "unknown";

export interface MediaFilterStyle {
  filter?: string;
  backgroundColor?: string;
  boxShadow?: string;
  borderRadius?: string;
  padding?: string;
}

export const MEDIA_THEME_STORAGE_KEY = "wikios-media-theme-mode";
export const MEDIA_THEME_EVENT_NAME = "wikios-media-theme-changed";
export const MEDIA_IMAGE_OVERRIDE_EVENT_NAME = "wikios-media-override-changed";

/**
 * Filter string for hue-preserved luminance inversion.
 * Inverts lightness (0.92) while rotating hue by 180° so original chromatic hues
 * (blues, reds, greens, yellows in coats of arms, flags, and diagrams) remain faithful
 * while pure black (#000000) becomes crisp readable light gray/white (#e5e5e5).
 */
export const HUE_PRESERVED_INVERT_FILTER =
  "invert(0.92) hue-rotate(180deg) brightness(1.05) contrast(1.02)";

/**
 * Pure monochrome invert filter (for pure black-and-white math equations or mono icons).
 */
export const PURE_INVERT_FILTER = "brightness(0) invert(1)";

/**
 * Normalize any legacy mode string to one of the 2 canonical modes: "auto" | "plinth".
 */
export function normalizeMediaMode(mode: string | null | undefined): "auto" | "plinth" {
  if (!mode) return "auto";
  if (mode === "plinth" || mode === "plate") return "plinth";
  return "auto";
}

/**
 * Detect media type from URL, filename, or DOM element.
 */
export function detectMediaType(src: string | null | undefined, el?: Element | null): MediaType {
  if (!src) return "unknown";

  const lowerSrc = src.toLowerCase();

  // 1. Math formulas (LaTeX/MathML renders)
  if (
    lowerSrc.includes("/math/") ||
    lowerSrc.includes("mwe-math") ||
    lowerSrc.includes("ext.math") ||
    el?.classList.contains("mwe-math-fallback-image-inline") ||
    el?.closest(".mwe-math-element")
  ) {
    return "math";
  }

  // 2. SVGs (vector graphics, charts, schematics, icons, flags, seals)
  if (
    lowerSrc.includes(".svg") ||
    lowerSrc.includes("format=svg") ||
    (lowerSrc.includes("/special:filepath/") && lowerSrc.endsWith(".svg")) ||
    el?.getAttribute("data-is-svg") === "true"
  ) {
    return "svg";
  }

  // 3. Transparent diagrams or charts
  if (
    lowerSrc.includes("diagram") ||
    lowerSrc.includes("schematic") ||
    lowerSrc.includes("chart") ||
    lowerSrc.includes("graph") ||
    lowerSrc.includes("drawing")
  ) {
    return "diagram";
  }

  // 4. Photographs (JPEG, WebP photos, historical archives)
  if (
    lowerSrc.includes(".jpg") ||
    lowerSrc.includes(".jpeg") ||
    lowerSrc.includes(".webp") ||
    lowerSrc.includes("photo")
  ) {
    return "photo";
  }

  // Default fallback
  return "unknown";
}

/**
 * Compute the CSS filter and container style for a given image based on the active mode,
 * media type, and whether the current UI theme is dark.
 */
export function getMediaFilterStyle(
  mode: MediaThemeMode,
  mediaType: MediaType,
  isDark: boolean
): MediaFilterStyle {
  const canonicalMode = normalizeMediaMode(mode);

  // Light Mode: all images render naturally without inversion or plinth
  if (!isDark) {
    return { filter: "none" };
  }

  // Dark Mode Handling:
  switch (canonicalMode) {
    case "plinth":
      // Apply plinth mat to transparent assets (SVGs, math, diagrams, unknown)
      if (mediaType !== "photo") {
        return {
          filter: "none",
          backgroundColor: "rgba(255, 255, 255, 0.94)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2)",
          borderRadius: "8px",
          padding: "6px",
        };
      }
      return { filter: "none" };

    case "auto":
    default:
      // Auto mode: automatically invert SVGs, math, and diagrams in dark mode
      if (mediaType === "svg" || mediaType === "diagram") {
        return { filter: HUE_PRESERVED_INVERT_FILTER };
      }
      if (mediaType === "math") {
        return { filter: PURE_INVERT_FILTER };
      }
      // Photos remain natural in auto mode
      return { filter: "none" };
  }
}

/**
 * Extract clean canonical image identifier for per-image overrides.
 */
export function getImageIdentifier(src: string): string {
  if (!src) return "";
  try {
    const clean = src.split("?")[0]!.split("#")[0]!;
    const parts = clean.split("/");
    return decodeURIComponent(parts[parts.length - 1] || clean);
  } catch {
    return src;
  }
}

/**
 * Read global media theme mode from localStorage.
 */
export function getStoredMediaThemeMode(): "auto" | "plinth" {
  if (typeof window === "undefined") return "auto";
  try {
    const stored = localStorage.getItem(MEDIA_THEME_STORAGE_KEY);
    const mode = normalizeMediaMode(stored);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-media-theme", mode);
    }
    return mode;
  } catch {
    return "auto";
  }
}

/**
 * Save global media theme mode to localStorage and emit custom event.
 */
export function setStoredMediaThemeMode(mode: MediaThemeMode): void {
  if (typeof window === "undefined") return;
  try {
    const canonical = normalizeMediaMode(mode);
    localStorage.setItem(MEDIA_THEME_STORAGE_KEY, canonical);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-media-theme", canonical);
    }
    window.dispatchEvent(
      new CustomEvent(MEDIA_THEME_EVENT_NAME, { detail: { mode: canonical } })
    );
  } catch {
    // ignore
  }
}

/**
 * Human-readable labels and descriptions for media theme modes.
 */
export const MEDIA_THEME_OPTIONS: {
  value: "auto" | "plinth";
  label: string;
  shortLabel: string;
  description: string;
  iconName: "auto" | "plinth";
}[] = [
  {
    value: "auto",
    label: "Auto (Adaptive)",
    shortLabel: "Auto",
    description: "Inverts black SVGs & formulas in dark mode; keeps photos natural",
    iconName: "auto",
  },
  {
    value: "plinth",
    label: "Plinth (Light Plate)",
    shortLabel: "Plinth",
    description: "Renders transparent images on a frosted translucent light backplate",
    iconName: "plinth",
  },
];
