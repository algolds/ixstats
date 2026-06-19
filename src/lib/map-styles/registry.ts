import standardStyleTemplate from "./standard.json";
import darkStyleTemplate from "./dark.json";
import paperStyleTemplate from "./paper.json";

export type MapTheme = "standard" | "dark" | "paper";

export interface FontConfig {
  regular: string[];
  bold: string[];
  sans: string[];
}

/**
 * Recursively scans a style object to resolve placeholder fonts
 * with runtime-specific font arrays (DejaVu vs Noto Sans).
 */
export function resolveStylePlaceholders(obj: any, glyphsUrl: string, fonts: FontConfig): any {
  if (Array.isArray(obj)) {
    if (obj.length === 1) {
      if (obj[0] === "__FONT_REGULAR__") return [...fonts.regular];
      if (obj[0] === "__FONT_BOLD__") return [...fonts.bold];
      if (obj[0] === "__FONT_SANS__") return [...fonts.sans];
    }
    return obj.map((item) => resolveStylePlaceholders(item, glyphsUrl, fonts));
  } else if (obj !== null && typeof obj === "object") {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = resolveStylePlaceholders(obj[key], glyphsUrl, fonts);
    }
    return res;
  }
  return obj;
}

/**
 * Resolves the MapLibre Style Specification object for the requested theme.
 */
export function getStyleForTheme(
  theme: MapTheme,
  glyphsUrl: string,
  fonts: FontConfig
): Record<string, unknown> {
  let template: Record<string, unknown>;

  switch (theme) {
    case "dark":
      template = darkStyleTemplate as Record<string, unknown>;
      break;
    case "paper":
      template = paperStyleTemplate as Record<string, unknown>;
      break;
    case "standard":
    default:
      template = standardStyleTemplate as Record<string, unknown>;
      break;
  }

  // Deep clone and resolve placeholders
  const style = JSON.parse(JSON.stringify(template));
  style.glyphs = glyphsUrl;

  return resolveStylePlaceholders(style, glyphsUrl, fonts);
}
