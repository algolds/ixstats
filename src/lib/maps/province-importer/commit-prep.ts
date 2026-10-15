/**
 * Pure geometry steps of the province import wizard that sit between alignment and commit:
 * snapping aligned city points onto the country border, and the final conformance pass
 * (sanitize → simplify → clip) applied to provinces before they are committed.
 * Split out of useProvinceImporter.ts.
 */

import type { Polygon, MultiPolygon } from "geojson";
import { sanitizeRegionShape } from "~/lib/maps/border-editor";
import type { ProvinceFeature } from "./types";
import { clipProvincesToBorder, simplifyProvinces, snapPointToCountryBorderJS } from "./topology";

/** A city point after the SVG → lng/lat affine (see `applyCityAffine`). */
export interface AlignedCity {
  name: string;
  lat: number;
  lng: number;
  isCapital: boolean;
}

/** The city has numeric, non-NaN lng and lat. */
export function hasValidLngLat(c: { lng: unknown; lat: unknown }): boolean {
  return typeof c.lng === "number" && !isNaN(c.lng) && typeof c.lat === "number" && !isNaN(c.lat);
}

/**
 * Drop cities without valid coordinates and snap the rest onto the country border
 * (within 10km); counts how many actually moved.
 */
export function snapCitiesToBorder(
  aligned: AlignedCity[],
  countryBorder: Polygon | MultiPolygon,
  provinces: ProvinceFeature[]
): { alignedCities: AlignedCity[]; snappedCitiesCount: number } {
  let snappedCount = 0;
  const snapped = aligned.filter(hasValidLngLat).map((c) => {
    const snappedCoords = snapPointToCountryBorderJS(
      [c.lng, c.lat],
      countryBorder,
      provinces,
      10000 // 10km
    );
    const wasSnapped =
      Math.abs(snappedCoords[0] - c.lng) > 1e-8 || Math.abs(snappedCoords[1] - c.lat) > 1e-8;
    if (wasSnapped) {
      snappedCount++;
    }
    return {
      ...c,
      lng: snappedCoords[0],
      lat: snappedCoords[1],
    };
  });
  return { alignedCities: snapped, snappedCitiesCount: snappedCount };
}

/** Final conformance before commit: sanitize shapes + simplify + clip to the country border. */
export function conformProvincesToBorder(
  provinces: ProvinceFeature[],
  countryBorder: Polygon | MultiPolygon,
  simplifyTolerance: number
): ProvinceFeature[] {
  // Sanitize: remove spikes, degenerate vertices
  let source: ProvinceFeature[] = provinces.map((p) => {
    if (!p.included || !p.geometry) return p;
    const { geometry: sanitized } = sanitizeRegionShape(
      p.geometry as Polygon | MultiPolygon,
      countryBorder
    );
    return { ...p, geometry: sanitized };
  });

  // Final simplification pass (safety valve)
  source = simplifyProvinces(source, simplifyTolerance);

  // Clip to country border
  const clipped = clipProvincesToBorder(source, countryBorder);
  return clipped.provinces;
}
