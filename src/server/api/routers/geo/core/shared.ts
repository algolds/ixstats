import { z } from "zod";

/** Reusable Zod schema for WGS84 coordinate pair [lng, lat] with bounds checking. */
export const coordinatesSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
    message: "Coordinates must be valid WGS84 (lng: -180 to 180, lat: -90 to 90)",
  });

/**
 * Climate color map: maps fill colors to human-readable Trewartha climate names.
 * Includes both canonical Trewartha colors and legacy SVG colors for backward compat.
 */
export const CLIMATE_COLOR_MAP: Record<string, string> = {
  // Canonical Trewartha colors (from climate-system.ts)
  "#990000": "Ar: Tropical Wet",
  "#ff3300": "Aw: Tropical Wet-And-Dry",
  "#ffff33": "Bw: Desert or Arid",
  "#ff9933": "Bs: Steppe or Semiarid",
  "#669900": "Cs: Subtropical Dry Summer",
  "#336600": "Cf: Subtropical Humid",
  "#00ff99": "Do: Temperate Oceanic",
  "#0099ff": "Dc: Temperate Continental",
  "#0066cc": "E: Boreal",
  "#b9b9b9": "Ft: Tundra",
  "#99ffff": "Fi: Ice Cap",
  "#ffccff": "H: Highland",
  // Legacy SVG colors (pre-Trewartha import data)
  "#00fd97": "Do: Temperate Oceanic",
  "#326500": "Cf: Subtropical Humid",
  "#fd9833": "Bs: Steppe or Semiarid",
  "#659700": "Cs: Subtropical Dry Summer",
  "#fc3502": "Aw: Tropical Wet-And-Dry",
  "#980000": "Ar: Tropical Wet",
  "#fcfc33": "Bw: Desert or Arid",
  "#0098fd": "Dc: Temperate Continental",
  "#9ea7b0": "Ft: Tundra",
  "#0065ca": "E: Boreal",
  "#fecbfe": "H: Highland",
};
