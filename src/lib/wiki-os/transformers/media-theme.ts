// src/lib/wiki-os/media-theme.ts
// Core TypeScript definitions, media type detection, the attributes a picture carries so the
// stylesheet can theme it, and storage utilities for WikiOS dynamic & theme-compliant image/media
// rendering (Auto, Plinth). The filters themselves are CSS (styles/wiki-os/foundations.css).

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

export const MEDIA_THEME_STORAGE_KEY = "wikios-media-theme-mode";
export const MEDIA_THEME_EVENT_NAME = "wikios-media-theme-changed";
export const MEDIA_IMAGE_OVERRIDE_EVENT_NAME = "wikios-media-override-changed";

/**
 * Normalize any legacy mode string to one of the 2 canonical modes: "auto" | "plinth".
 */
export function normalizeMediaMode(mode: string | null | undefined): "auto" | "plinth" {
  if (!mode) return "auto";
  if (mode === "plinth" || mode === "plate") return "plinth";
  return "auto";
}

/** URL fragments that identify each media type, in precedence order. */
const MEDIA_TYPE_URL_HINTS: Array<[MediaType, string[]]> = [
  ["math", ["/math/", "mwe-math", "ext.math"]],
  // Vector graphics: charts, schematics, icons, flags, seals
  ["svg", [".svg", "format=svg"]],
  ["diagram", ["diagram", "schematic", "chart", "graph", "drawing"]],
  ["photo", [".jpg", ".jpeg", ".webp", "photo"]],
];

/**
 * Detect media type from URL, filename, or DOM element.
 */
export function detectMediaType(src: string | null | undefined, el?: Element | null): MediaType {
  if (!src) return "unknown";

  const lowerSrc = src.toLowerCase();
  const elementHints: Partial<Record<MediaType, unknown>> = {
    math:
      el?.classList.contains("mwe-math-fallback-image-inline") || el?.closest(".mwe-math-element"),
    svg: el?.getAttribute("data-is-svg") === "true",
  };

  for (const [type, hints] of MEDIA_TYPE_URL_HINTS) {
    if (elementHints[type] || hints.some((hint) => lowerSrc.includes(hint))) return type;
  }
  return "unknown";
}

/**
 * What the stylesheet needs to theme a picture: what it is and, only when this picture has a mode
 * of its own, which one. Neither depends on the reader's theme or stored mode, so the server and the
 * first client render write the same attributes. The theme is `<html data-theme>` (set before first
 * paint) and the reader's mode is `<html data-media-theme>`; foundations.css combines them: in the
 * dark theme "auto" inverts vector art, diagrams and formulas, and "plinth" sets transparent art on a
 * light plate. Photos stay as they are, and in the light theme every picture does.
 */
export interface MediaThemeAttributes {
  "data-media-kind": MediaType;
  "data-media-mode"?: "auto" | "plinth";
}

export function mediaThemeAttributes(
  mediaType: MediaType,
  ownMode?: "auto" | "plinth"
): MediaThemeAttributes {
  return ownMode
    ? { "data-media-kind": mediaType, "data-media-mode": ownMode }
    : { "data-media-kind": mediaType };
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

/** The mode chosen this session, for a browser that will not let the page use localStorage. */
let sessionMode: "auto" | "plinth" = "auto";

/** `<html data-media-theme>`: the reader's mode, which the stylesheet themes pictures by. */
function mirrorMode(mode: "auto" | "plinth"): void {
  const root = document.documentElement;
  if (root.getAttribute("data-media-theme") !== mode) root.setAttribute("data-media-theme", mode);
}

/** Read global media theme mode from localStorage (and mirror it on <html>). */
export function getStoredMediaThemeMode(): "auto" | "plinth" {
  if (typeof window === "undefined") return "auto";
  let mode = sessionMode;
  try {
    // Nothing stored (or nothing stored yet: storage that reads but cannot be written to keeps no choice)
    // leaves the mode chosen this session standing.
    const stored = localStorage.getItem(MEDIA_THEME_STORAGE_KEY);
    if (stored !== null) mode = normalizeMediaMode(stored);
  } catch {
    // storage is blocked: the mode chosen this session stands
  }
  mirrorMode(mode);
  return mode;
}

/**
 * Save global media theme mode to localStorage and emit custom event.
 */
export function setStoredMediaThemeMode(mode: MediaThemeMode): void {
  if (typeof window === "undefined") return;
  const canonical = normalizeMediaMode(mode);
  sessionMode = canonical;
  try {
    localStorage.setItem(MEDIA_THEME_STORAGE_KEY, canonical);
  } catch {
    // storage is blocked: the mode lasts for this session
  }
  mirrorMode(canonical);
  window.dispatchEvent(new CustomEvent(MEDIA_THEME_EVENT_NAME, { detail: { mode: canonical } }));
}
