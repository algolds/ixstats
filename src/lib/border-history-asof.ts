/**
 * mergeBordersAsOf — pure "as-of" merge for political border history.
 *
 * For each country in the current political FeatureCollection, picks the latest
 * BorderHistory snapshot with `changedAt <= asOf`. If no such snapshot exists,
 * the country's current geometry is preserved unchanged. Features without a
 * `properties.countryId` are passed through (they are not country polygons and
 * have no history dimension).
 *
 * Read-only. Returns a new array; never mutates inputs.
 */
import type { Feature, Geometry } from "geojson";

export interface BorderHistoryRow {
  countryId: string;
  geometry: unknown;
  changedAt: Date;
}

export function mergeBordersAsOf(
  currentFeatures: Feature[],
  history: BorderHistoryRow[],
  asOf: Date
): Feature[] {
  const asOfMs = asOf.getTime();

  const latestByCountry = new Map<string, BorderHistoryRow>();
  for (const row of history) {
    if (row.changedAt.getTime() > asOfMs) continue;
    const existing = latestByCountry.get(row.countryId);
    if (!existing || row.changedAt.getTime() > existing.changedAt.getTime()) {
      latestByCountry.set(row.countryId, row);
    }
  }

  return currentFeatures.map((feature) => {
    const countryId = (feature.properties as { countryId?: unknown } | null)?.countryId;
    if (typeof countryId !== "string") return feature;

    const snapshot = latestByCountry.get(countryId);
    if (!snapshot) return feature;

    return {
      ...feature,
      geometry: snapshot.geometry as Geometry,
    };
  });
}
