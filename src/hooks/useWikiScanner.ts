"use client";

/**
 * useWikiScanner — Scans map features against IxWiki to find unlinked pages
 * and detect data conflicts between map features and wiki infoboxes.
 *
 * Batches requests 3-at-a-time with delays to avoid hammering the wiki API.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { api } from "~/trpc/react";
import type { EditorFeature } from "~/hooks/useMapEditor";

// ── Types ──

export interface WikiMatch {
  title: string;
  confidence: number; // 0-1 based on name similarity
}

export interface WikiScanResult {
  featureId: string;
  featureName: string;
  featureType: string;
  suggestions: WikiMatch[];
}

export interface WikiConflict {
  featureId: string;
  featureName: string;
  field: string;
  mapValue: string;
  wikiValue: string;
}

export interface UseWikiScannerReturn {
  unlinkedFeatures: WikiScanResult[];
  scanning: boolean;
  scanProgress: number; // 0-100
  totalUnlinked: number;
  totalLinked: number;
  startScan: () => void;
  acceptSuggestion: (featureId: string, wikiTitle: string) => void;
  conflicts: WikiConflict[];
  scanningConflicts: boolean;
}

// ── Helpers ──

/** Compute match confidence based on name similarity. */
function computeConfidence(featureName: string, wikiTitle: string): number {
  const a = featureName.toLowerCase().trim();
  const b = wikiTitle.toLowerCase().trim();

  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.7;
  // Simple fuzzy: check if most words match
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const matchingWords = aWords.filter((w) => bWords.some((bw) => bw.includes(w) || w.includes(bw)));
  if (matchingWords.length > 0 && matchingWords.length >= aWords.length * 0.5) return 0.5;
  return 0.3;
}

/** Simple delay helper. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Haversine distance in km between two [lng, lat] points. */
function haversineKm(coords1: [number, number], coords2: [number, number]): number {
  const R = 6371;
  const dLat = ((coords2[1] - coords1[1]) * Math.PI) / 180;
  const dLng = ((coords2[0] - coords1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((coords1[1] * Math.PI) / 180) *
      Math.cos((coords2[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Hook ──

export function useWikiScanner(params: {
  features: EditorFeature[];
  onLinkFeature: (featureId: string, featureType: string, wikiTitle: string) => Promise<void>;
}): UseWikiScannerReturn {
  const { features, onLinkFeature } = params;

  const [scanResults, setScanResults] = useState<WikiScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [conflicts, setConflicts] = useState<WikiConflict[]>([]);
  const [scanningConflicts, setScanningConflicts] = useState(false);
  const abortRef = useRef(false);

  const utils = api.useUtils();

  // Separate linked and unlinked features
  const { linked, unlinked } = useMemo(() => {
    const linked: EditorFeature[] = [];
    const unlinked: EditorFeature[] = [];
    for (const f of features) {
      const wikiTitle = f.properties.wikiPageTitle as string | undefined;
      if (wikiTitle && wikiTitle.trim()) {
        linked.push(f);
      } else {
        unlinked.push(f);
      }
    }
    return { linked, unlinked };
  }, [features]);

  // Scan unlinked features for wiki page matches, then scan linked features for conflicts
  const startScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setScanProgress(0);
    setScanResults([]);
    setConflicts([]);
    abortRef.current = false;

    const results: WikiScanResult[] = [];
    const totalToScan = unlinked.length;

    // Process in batches of 3
    for (let i = 0; i < unlinked.length; i += 3) {
      if (abortRef.current) break;

      const batch = unlinked.slice(i, i + 3);
      const batchPromises = batch.map(async (feature) => {
        try {
          const searchResults = await utils.wikios.searchPages.fetch({
            query: feature.name,
            limit: 5,
            wiki: "ixwiki",
          });

          if (!searchResults || searchResults.length === 0) {
            return {
              featureId: feature.id,
              featureName: feature.name,
              featureType: feature.type,
              suggestions: [] as WikiMatch[],
            };
          }

          const suggestions: WikiMatch[] = searchResults.map((r: { title: string }) => ({
            title: r.title,
            confidence: computeConfidence(feature.name, r.title),
          }));

          // Sort by confidence descending
          suggestions.sort((a, b) => b.confidence - a.confidence);

          return {
            featureId: feature.id,
            featureName: feature.name,
            featureType: feature.type,
            suggestions,
          };
        } catch {
          return {
            featureId: feature.id,
            featureName: feature.name,
            featureType: feature.type,
            suggestions: [] as WikiMatch[],
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      const progress = totalToScan > 0 ? Math.round(((i + batch.length) / totalToScan) * 100) : 100;
      setScanProgress(progress);

      // Small delay between batches to avoid hammering
      if (i + 3 < unlinked.length) {
        await delay(300);
      }
    }

    setScanResults(results);
    setScanProgress(100);
    setScanning(false);

    // Now scan linked features for conflicts
    if (linked.length > 0 && !abortRef.current) {
      setScanningConflicts(true);
      const detectedConflicts: WikiConflict[] = [];

      for (let i = 0; i < linked.length; i += 3) {
        if (abortRef.current) break;

        const batch = linked.slice(i, i + 3);
        const conflictPromises = batch.map(async (feature) => {
          const wikiTitle = feature.properties.wikiPageTitle as string;
          try {
            const infobox = await utils.wikios.getInfobox.fetch({
              title: wikiTitle,
              wiki: "ixwiki",
            });

            if (!infobox?.fields) return [];

            const featureConflicts: WikiConflict[] = [];
            const fields = infobox.fields;

            // Check population
            const popField = fields.find(
              (f: { key: string }) =>
                f.key === "population_estimate" ||
                f.key === "population_total" ||
                f.key === "population_census"
            );
            if (popField && feature.properties.population) {
              const wikiPop = parseInt(String(popField.value).replace(/[,.\s]/g, ""), 10);
              const mapPop = feature.properties.population as number;
              if (
                !isNaN(wikiPop) &&
                wikiPop > 0 &&
                Math.abs(wikiPop - mapPop) / Math.max(wikiPop, mapPop) > 0.1
              ) {
                featureConflicts.push({
                  featureId: feature.id,
                  featureName: feature.name,
                  field: "Population",
                  mapValue: mapPop.toLocaleString(),
                  wikiValue: wikiPop.toLocaleString(),
                });
              }
            }

            // Check coordinates
            if (feature.coordinates) {
              const latField = fields.find(
                (f: { key: string }) => f.key === "latd" || f.key === "latitude"
              );
              const lngField = fields.find(
                (f: { key: string }) => f.key === "longd" || f.key === "longitude"
              );
              if (latField && lngField) {
                const wikiLat = parseFloat(String(latField.value));
                const wikiLng = parseFloat(String(lngField.value));
                if (!isNaN(wikiLat) && !isNaN(wikiLng)) {
                  const distance = haversineKm(feature.coordinates, [wikiLng, wikiLat]);
                  if (distance > 50) {
                    featureConflicts.push({
                      featureId: feature.id,
                      featureName: feature.name,
                      field: "Coordinates",
                      mapValue: `${feature.coordinates[1].toFixed(2)}, ${feature.coordinates[0].toFixed(2)}`,
                      wikiValue: `${wikiLat.toFixed(2)}, ${wikiLng.toFixed(2)}`,
                    });
                  }
                }
              }
            }

            // Check area for subdivisions
            if (feature.type === "subdivision" && feature.properties.areaSqKm) {
              const areaField = fields.find(
                (f: { key: string }) => f.key === "area_km2" || f.key === "area"
              );
              if (areaField) {
                const wikiArea = parseFloat(String(areaField.value).replace(/[,\s]/g, ""));
                const mapArea = feature.properties.areaSqKm as number;
                if (
                  !isNaN(wikiArea) &&
                  wikiArea > 0 &&
                  Math.abs(wikiArea - mapArea) / Math.max(wikiArea, mapArea) > 0.15
                ) {
                  featureConflicts.push({
                    featureId: feature.id,
                    featureName: feature.name,
                    field: "Area (km²)",
                    mapValue: mapArea.toLocaleString(),
                    wikiValue: wikiArea.toLocaleString(),
                  });
                }
              }
            }

            return featureConflicts;
          } catch {
            return [];
          }
        });

        const batchConflicts = await Promise.all(conflictPromises);
        detectedConflicts.push(...batchConflicts.flat());

        if (i + 3 < linked.length) {
          await delay(300);
        }
      }

      setConflicts(detectedConflicts);
      setScanningConflicts(false);
    }
  }, [scanning, unlinked, linked, utils]);

  const acceptSuggestion = useCallback(
    async (featureId: string, wikiTitle: string) => {
      const feature = features.find((f) => f.id === featureId);
      if (!feature) return;

      await onLinkFeature(featureId, feature.type, wikiTitle);

      // Remove from scan results
      setScanResults((prev) => prev.filter((r) => r.featureId !== featureId));
    },
    [features, onLinkFeature]
  );

  return {
    unlinkedFeatures: scanResults,
    scanning,
    scanProgress,
    totalUnlinked: unlinked.length,
    totalLinked: linked.length,
    startScan,
    acceptSuggestion,
    conflicts,
    scanningConflicts,
  };
}
