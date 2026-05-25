/**
 * Canonical Elevation Zone Configuration
 *
 * Single source of truth for the IxEarth 9-zone elevation system.
 * Used by: terrain generator, SVG parser, pin info tool, base layer queries.
 *
 * Color key matches the IxWiki topographic legend.
 */

export interface ElevationZoneConfig {
  zoneId: string;
  zoneName: string;
  elevationMin: number; // meters
  elevationMax: number; // meters
  color: string; // hex with alpha (8-char)
  sortOrder: number;
  /** Normalized 0-1 range for procedural generation mapping */
  normalizedMin: number;
  normalizedMax: number;
}

/**
 * The canonical 9-zone elevation system matching the IxWiki topographic legend.
 * Sorted from lowest to highest elevation.
 */
export const ELEVATION_ZONES: ElevationZoneConfig[] = [
  {
    zoneId: "zone_0",
    zoneName: "Coastal Lowlands",
    elevationMin: 0,
    elevationMax: 99,
    color: "#a8c995ff",
    sortOrder: 0,
    normalizedMin: 0,
    normalizedMax: 0.017,
  },
  {
    zoneId: "zone_1",
    zoneName: "Low Hills",
    elevationMin: 100,
    elevationMax: 349,
    color: "#c3d3a1ff",
    sortOrder: 1,
    normalizedMin: 0.017,
    normalizedMax: 0.058,
  },
  {
    zoneId: "zone_2",
    zoneName: "Rolling Hills",
    elevationMin: 350,
    elevationMax: 499,
    color: "#dcdcacff",
    sortOrder: 2,
    normalizedMin: 0.058,
    normalizedMax: 0.083,
  },
  {
    zoneId: "zone_3",
    zoneName: "Uplands",
    elevationMin: 500,
    elevationMax: 999,
    color: "#f7e6b8ff",
    sortOrder: 3,
    normalizedMin: 0.083,
    normalizedMax: 0.167,
  },
  {
    zoneId: "zone_4",
    zoneName: "Low Mountains",
    elevationMin: 1000,
    elevationMax: 1999,
    color: "#dac497ff",
    sortOrder: 4,
    normalizedMin: 0.167,
    normalizedMax: 0.333,
  },
  {
    zoneId: "zone_5",
    zoneName: "Mid Mountains",
    elevationMin: 2000,
    elevationMax: 2999,
    color: "#bea276ff",
    sortOrder: 5,
    normalizedMin: 0.333,
    normalizedMax: 0.5,
  },
  {
    zoneId: "zone_6",
    zoneName: "High Mountains",
    elevationMin: 3000,
    elevationMax: 3999,
    color: "#9c7b50ff",
    sortOrder: 6,
    normalizedMin: 0.5,
    normalizedMax: 0.667,
  },
  {
    zoneId: "zone_7",
    zoneName: "Alpine",
    elevationMin: 4000,
    elevationMax: 4999,
    color: "#796142ff",
    sortOrder: 7,
    normalizedMin: 0.667,
    normalizedMax: 0.833,
  },
  {
    zoneId: "zone_8",
    zoneName: "Extreme Alpine",
    elevationMin: 5000,
    elevationMax: 9999,
    color: "#4f4236ff",
    sortOrder: 8,
    normalizedMin: 0.833,
    normalizedMax: 1.0,
  },
];

/** Maximum world elevation in meters (used for normalization) */
export const MAX_WORLD_ELEVATION = 6000;

/** Look up elevation zone by its hex color (for SVG import color matching) */
export function getZoneByColor(hexColor: string): ElevationZoneConfig | null {
  const normalized = hexColor.toLowerCase().replace(/^#/, "");
  return (
    ELEVATION_ZONES.find((z) => {
      const zColor = z.color.toLowerCase().replace(/^#/, "");
      // Match with or without alpha channel
      return zColor === normalized || zColor.slice(0, 6) === normalized.slice(0, 6);
    }) ?? null
  );
}

/** Look up elevation zone for a given elevation in meters */
export function getZoneForElevation(meters: number): ElevationZoneConfig | null {
  return ELEVATION_ZONES.find((z) => meters >= z.elevationMin && meters <= z.elevationMax) ?? null;
}

/**
 * Convert a normalized [0-1] elevation value to meters.
 * Uses a non-linear curve that allocates more of the 0-1 range
 * to lower elevations (more common) and compresses high elevations.
 */
export function normalizeToMeters(
  value: number,
  maxElevation: number = MAX_WORLD_ELEVATION
): number {
  // Power curve: most terrain is low elevation
  const curved = Math.pow(Math.max(0, Math.min(1, value)), 1.5);
  return Math.round(curved * maxElevation);
}

/**
 * Get the elevation zone for a normalized [0-1] value.
 * Maps procedural generator output directly to the 9-zone system.
 */
export function getZoneForNormalizedValue(value: number): ElevationZoneConfig | null {
  const meters = normalizeToMeters(value);
  return getZoneForElevation(meters);
}

/**
 * Get the AltitudeZone format expected by the terrain generator.
 * Bridges between the canonical config and the generator's internal format.
 */
export function getGeneratorZones(): Array<{
  id: string;
  name: string;
  minElev: number;
  maxElev: number;
  color: string;
  elevationMin: number;
  elevationMax: number;
}> {
  return ELEVATION_ZONES.map((z) => ({
    id: z.zoneId,
    name: z.zoneName,
    minElev: z.normalizedMin,
    maxElev: z.normalizedMax,
    color: z.color,
    elevationMin: z.elevationMin,
    elevationMax: z.elevationMax,
  }));
}
