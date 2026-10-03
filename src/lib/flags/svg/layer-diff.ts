/**
 * Layer diff computation: compare incoming parsed features against existing DB
 * features.
 */

import type { ParsedFeature } from "../svg-parser";

interface FeatureDiffEntry {
  featureId: string;
  displayName: string;
  status: "added" | "modified" | "removed" | "unchanged";
  changes?: {
    geometryChanged: boolean;
    propertiesChanged: boolean;
    areaDeltaSqKm?: number;
  };
  existingCountryId?: string | null;
  existingCountryName?: string | null;
}

interface LayerDiff {
  layerType: string;
  totalExisting: number;
  totalIncoming: number;
  added: FeatureDiffEntry[];
  modified: FeatureDiffEntry[];
  removed: FeatureDiffEntry[];
  unchanged: FeatureDiffEntry[];
  preservedLinkages: Array<{ featureId: string; countryId: string; countryName?: string }>;
  summary: {
    addedCount: number;
    modifiedCount: number;
    removedCount: number;
    unchangedCount: number;
    linkagesPreserved: number;
    linkagesLost: number;
  };
}

/**
 * Compare incoming parsed features against existing DB features to produce a diff.
 * Uses featureId as the stable key (matches the @@unique constraint on MapLayer).
 */
export function computeLayerDiff(
  incomingFeatures: ParsedFeature[],
  existingFeatures: Array<{
    featureId: string;
    displayName: string | null;
    geometry: unknown;
    countryId: string | null;
    areaSqKm: number | null;
    properties: unknown;
    country?: { name: string } | null;
  }>
): LayerDiff {
  const existingMap = new Map(existingFeatures.map((f) => [f.featureId, f]));
  const incomingMap = new Map(incomingFeatures.map((f) => [f.featureId, f]));

  const added: FeatureDiffEntry[] = [];
  const modified: FeatureDiffEntry[] = [];
  const removed: FeatureDiffEntry[] = [];
  const unchanged: FeatureDiffEntry[] = [];
  const preservedLinkages: Array<{ featureId: string; countryId: string; countryName?: string }> =
    [];
  let linkagesLost = 0;

  // Check incoming features against existing
  for (const incoming of incomingFeatures) {
    const existing = existingMap.get(incoming.featureId);
    if (!existing) {
      added.push({
        featureId: incoming.featureId,
        displayName: incoming.displayName,
        status: "added",
      });
      continue;
    }

    // Feature exists — check for modifications via full JSON comparison
    const geometryChanged = JSON.stringify(incoming.geometry) !== JSON.stringify(existing.geometry);
    const propertiesChanged =
      JSON.stringify(incoming.properties) !== JSON.stringify(existing.properties);
    const areaDelta = incoming.areaSqKm - (existing.areaSqKm ?? 0);

    if (geometryChanged || propertiesChanged) {
      modified.push({
        featureId: incoming.featureId,
        displayName: incoming.displayName,
        status: "modified",
        changes: { geometryChanged, propertiesChanged, areaDeltaSqKm: areaDelta },
        existingCountryId: existing.countryId,
        existingCountryName: existing.country?.name ?? null,
      });
    } else {
      unchanged.push({
        featureId: incoming.featureId,
        displayName: incoming.displayName,
        status: "unchanged",
        existingCountryId: existing.countryId,
        existingCountryName: existing.country?.name ?? null,
      });
    }

    // Preserve linkage for both modified and unchanged features
    if (existing.countryId) {
      preservedLinkages.push({
        featureId: incoming.featureId,
        countryId: existing.countryId,
        countryName: existing.country?.name ?? undefined,
      });
    }
  }

  // Check for removed features (in DB but not in incoming)
  for (const existing of existingFeatures) {
    if (!incomingMap.has(existing.featureId)) {
      removed.push({
        featureId: existing.featureId,
        displayName: existing.displayName ?? existing.featureId,
        status: "removed",
        existingCountryId: existing.countryId,
        existingCountryName: existing.country?.name ?? null,
      });
      if (existing.countryId) linkagesLost++;
    }
  }

  return {
    layerType: "",
    totalExisting: existingFeatures.length,
    totalIncoming: incomingFeatures.length,
    added,
    modified,
    removed,
    unchanged,
    preservedLinkages,
    summary: {
      addedCount: added.length,
      modifiedCount: modified.length,
      removedCount: removed.length,
      unchangedCount: unchanged.length,
      linkagesPreserved: preservedLinkages.length,
      linkagesLost,
    },
  };
}
