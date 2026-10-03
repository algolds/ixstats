"use client";

/**
 * useMapEditorBulkOps — multi-feature editor operations: bulk delete / bulk
 * attribute edit, city placement tools (scatter, regional capitals, snap to
 * border / coast), the gap & empty-region overlays and GeoJSON import.
 *
 * Each operation records exactly one undo step (a "batch" history action).
 */

import { useCallback, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { calculateNegativeSpaceGaps } from "~/lib/maps/map-editor-geom";
import { snapToLayerFeatures } from "~/components/maps/editor/utils/map-helpers";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import type { EditorFeature, FeatureType } from "./editor-types";
import type { EditorAction, HistoryData, PushableEditorAction } from "./useMapHistory";
import type { useHistoryReversalExecutor } from "./useHistoryReversalExecutor";
import {
  findContainingRegion,
  findEmptyRegions,
  interiorPoint,
  isPolygonal,
  nearestPointOnBoundary,
  nudgeToward,
  planGeoJSONImport,
  randomPointsInPolygon,
} from "./editor-geo-ops";

type BulkEditField = "color" | "type" | "level" | "governmentType";

/** Runs async tasks with bounded concurrency; collects per-item success. */
async function runLimited<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<{ successCount: number; failCount: number }> {
  let cursor = 0;
  let successCount = 0;
  let failCount = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!;
      try {
        await task(item);
        successCount++;
      } catch (e) {
        failCount++;
        console.warn("[map-editor] bulk item failed", e);
      }
    }
  });
  await Promise.all(workers);
  return { successCount, failCount };
}

type PlannedFeature = ReturnType<typeof planGeoJSONImport>["features"][number];

const ofType = <T>(value: unknown, type: "string" | "number", fallback?: T) =>
  typeof value === type ? (value as T) : fallback;

/** History snapshot used to create a feature imported from GeoJSON, with defaults for missing properties. */
function importedFeatureData(f: PlannedFeature): HistoryData {
  const p = f.properties;
  if (f.kind === "subdivision") {
    return {
      name: f.name,
      type: ofType(p.type, "string", "province"),
      level: ofType(p.level, "number", 1),
      geometry: f.geometry,
    };
  }
  if (f.kind === "city") {
    return {
      name: f.name,
      cityType: ofType(p.cityType, "string", "city"),
      coordinates: f.coordinates,
      population: ofType(p.population, "number"),
    };
  }
  return {
    name: f.name,
    category: ofType(p.category, "string", "landmark"),
    coordinates: f.coordinates,
    description: ofType(p.description, "string"),
  };
}

interface UseMapEditorBulkOpsProps {
  countryId?: string;
  /** Raw country features query result (for the gap computation). */
  features: { subdivisions?: unknown[] } | null | undefined;
  countryGeo: unknown;
  allFeatures: EditorFeature[];
  selectedIds: Set<string>;
  selectedFeature: EditorFeature | null;
  showGaps: boolean;
  setShowGaps: (v: boolean) => void;
  historyExecutor: ReturnType<typeof useHistoryReversalExecutor>;
  pushAction: (action: PushableEditorAction) => void;
  afterWrite: () => void;
  setMutationError: (err: string | null) => void;
  resetForm: () => void;
  clearMultiSelect: () => void;
  updatePointCoordinates: (
    type?: FeatureType,
    id?: string,
    coords?: [number, number]
  ) => Promise<void>;
  worldMapLayers?: MapLayerData[];
}

export function useMapEditorBulkOps({
  countryId,
  features,
  countryGeo,
  allFeatures,
  selectedIds,
  selectedFeature,
  showGaps,
  setShowGaps,
  historyExecutor,
  pushAction,
  afterWrite,
  setMutationError,
  resetForm,
  clearMultiSelect,
  updatePointCoordinates,
  worldMapLayers,
}: UseMapEditorBulkOpsProps) {
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [gapRecalcTick, setGapRecalcTick] = useState(0);

  const noResult = { successCount: 0, failCount: 0 };

  /** Run a bulk operation with the busy flag set. */
  const withBusy = async <T>(work: () => Promise<T>): Promise<T> => {
    setIsBulkBusy(true);
    try {
      return await work();
    } finally {
      setIsBulkBusy(false);
    }
  };

  /** Record the sub-actions as one undo step (nothing when none succeeded). */
  const pushBatch = (
    subActions: EditorAction[],
    description: string,
    head?: { type: FeatureType; id: string }
  ) => {
    if (subActions.length === 0) return;
    pushAction({
      type: "batch",
      featureType: head?.type ?? subActions[0]!.featureType,
      featureId: head?.id ?? subActions[0]!.featureId,
      description,
      subActions,
    });
  };

  const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  const bulkDeleteSelected = async () => {
    if (!countryId || selectedIds.size === 0) return noResult;
    const toDelete = allFeatures.filter((f) => selectedIds.has(f.id) && f.type !== "gap");
    const subActions: EditorAction[] = [];
    return withBusy(async () => {
      const result = await runLimited(toDelete, 4, async (feat) => {
        await historyExecutor.deleteFeatureById(feat.type, feat.id);
        subActions.push({
          type: "delete",
          featureType: feat.type,
          featureId: feat.id,
          description: `Deleted ${feat.type} "${feat.name}"`,
          timestamp: Date.now(),
          previousData: {
            ...feat.properties,
            name: feat.name,
            coordinates: feat.coordinates,
            geometry: feat.geometry,
          },
        });
      });
      pushBatch(subActions, `Deleted ${plural(subActions.length, "feature")}`, toDelete[0]);
      if (selectedFeature && selectedIds.has(selectedFeature.id)) resetForm();
      clearMultiSelect();
      afterWrite();
      if (result.failCount > 0) {
        setMutationError(`${result.failCount} of ${toDelete.length} deletions failed`);
      }
      return result;
    });
  };

  /** Applies one attribute to every selected region (one undo step). */
  const bulkEditSelected = async (
    fieldArg?: string[] | string,
    valueArg?: Record<string, string | number | boolean | null> | string | number | boolean | null
  ): Promise<{ successCount: number; failCount: number }> => {
    const field = (Array.isArray(fieldArg) ? fieldArg[0] : fieldArg) as BulkEditField | undefined;
    if (
      !countryId ||
      !field ||
      valueArg === undefined ||
      valueArg === null ||
      typeof valueArg === "object"
    ) {
      return noResult;
    }
    const regions = allFeatures.filter((f) => selectedIds.has(f.id) && f.type === "subdivision");
    const subActions: EditorAction[] = [];
    return withBusy(async () => {
      const result = await runLimited(regions, 4, async (r) => {
        const base: HistoryData = {
          type: (r.properties.type as string) || "region",
          level: Number(r.properties.level) || 1,
        };
        const action: EditorAction = {
          type: "update",
          featureType: "subdivision",
          featureId: r.id,
          description: `Set ${field} on "${r.name}"`,
          timestamp: Date.now(),
          previousData: { ...base, [field]: r.properties[field] ?? null },
          newData: { ...base, [field]: valueArg },
        };
        await historyExecutor.applyForwardAction(action);
        subActions.push(action);
      });
      pushBatch(subActions, `Set ${field} on ${plural(subActions.length, "region")}`);
      afterWrite();
      return result;
    });
  };

  // Gaps & empty regions (computed only while the overlay is on)
  const gapFeatures = useMemo<FeatureCollection | null>(() => {
    void gapRecalcTick;
    if (!showGaps || !countryGeo || !features?.subdivisions) return null;
    try {
      return calculateNegativeSpaceGaps(countryGeo, features.subdivisions);
    } catch {
      return null;
    }
  }, [showGaps, countryGeo, features?.subdivisions, gapRecalcTick]);

  const emptyRegions = useMemo(
    () => (showGaps ? findEmptyRegions(allFeatures) : []),
    [showGaps, allFeatures]
  );

  const emptyRegionsFeatures = useMemo<FeatureCollection | null>(
    () =>
      showGaps
        ? {
            type: "FeatureCollection",
            features: emptyRegions.map((r) => ({
              type: "Feature" as const,
              geometry: r.geometry as GeoJSON.Geometry,
              properties: { id: r.id, name: r.name },
            })),
          }
        : null,
    [showGaps, emptyRegions]
  );

  const recalculateGaps = useCallback(() => {
    setShowGaps(true);
    setGapRecalcTick((t) => t + 1);
  }, []);

  /** Creates several cities and records them as one undo step. */
  const createCitiesBatch = async (
    cities: Array<{
      name: string;
      cityType: string;
      coordinates: [number, number];
      subdivisionId?: string;
      isSubdivisionCapital?: boolean;
    }>,
    description: string
  ) => {
    if (!countryId || cities.length === 0) return noResult;
    const subActions: EditorAction[] = [];
    return withBusy(async () => {
      const result = await runLimited(cities, 4, async (c) => {
        const data: HistoryData = { ...c };
        const id = await historyExecutor.recreateFeature("city", data);
        if (id) {
          subActions.push({
            type: "create",
            featureType: "city",
            featureId: id,
            description: `Created City "${c.name}"`,
            timestamp: Date.now(),
            newData: data,
          });
        }
      });
      pushBatch(subActions, description);
      afterWrite();
      return result;
    });
  };

  const scatterCities = async (count?: number, type?: string, prefix?: string) => {
    const region =
      selectedFeature?.type === "subdivision"
        ? allFeatures.find((f) => f.id === selectedFeature.id)
        : undefined;
    if (!region || !isPolygonal(region.geometry)) {
      setMutationError("Select a region first — cities are scattered inside it.");
      return;
    }
    const n = Math.max(1, Math.min(50, Math.round(count ?? 5)));
    const pts = randomPointsInPolygon(region.geometry, n);
    const label = (prefix?.trim() || region.name).slice(0, 90);
    await createCitiesBatch(
      pts.map((coordinates, i) => ({
        name: `${label} ${i + 1}`,
        cityType: type || "town",
        coordinates,
        subdivisionId: region.id,
      })),
      `Scattered ${pts.length} cities in "${region.name}"`
    );
  };

  const createCentroidCities = async (_countryId?: string) => {
    const regions = showGaps ? emptyRegions : findEmptyRegions(allFeatures);
    const cities = regions.flatMap((r) => {
      const p = isPolygonal(r.geometry) ? interiorPoint(r.geometry) : null;
      return p
        ? [
            {
              name: r.name,
              cityType: "city",
              coordinates: p,
              subdivisionId: r.id,
              isSubdivisionCapital: true,
            },
          ]
        : [];
    });
    if (cities.length === 0) {
      setMutationError("Every region already has a city.");
      return;
    }
    await createCitiesBatch(cities, `Created ${cities.length} regional capitals`);
  };

  const resolveCity = useCallback(
    (cityId?: string) => {
      const id = cityId ?? (selectedFeature?.type === "city" ? selectedFeature.id : undefined);
      return id
        ? allFeatures.find((f) => f.id === id && f.type === "city" && f.coordinates)
        : undefined;
    },
    [selectedFeature, allFeatures]
  );

  const snapCityToSubdivisionBorder = useCallback(
    async (cityId?: string) => {
      const city = resolveCity(cityId);
      if (!city?.coordinates) return;
      const linked = allFeatures.find((f) => f.id === city.properties.subdivisionId);
      const region = linked ?? findContainingRegion(city.coordinates, allFeatures);
      if (!region || !isPolygonal(region.geometry)) {
        setMutationError(`"${city.name}" is not inside a region.`);
        return;
      }
      const onEdge = nearestPointOnBoundary(city.coordinates, region.geometry);
      await updatePointCoordinates("city", city.id, nudgeToward(onEdge, city.coordinates));
    },
    [resolveCity, allFeatures, updatePointCoordinates]
  );

  const snapCityToCoastline = useCallback(
    async (cityId?: string) => {
      const city = resolveCity(cityId);
      if (!city?.coordinates) return;
      const layers = worldMapLayers;
      let target: [number, number] | null = null;
      if (layers?.some((l) => l.type === "background")) {
        const snapped = snapToLayerFeatures(city.coordinates, layers, new Set(["background"]), 3);
        if (snapped[0] !== city.coordinates[0] || snapped[1] !== city.coordinates[1])
          target = snapped;
      }
      if (!target) {
        setMutationError(`No coastline within 3° of "${city.name}".`);
        return;
      }
      await updatePointCoordinates("city", city.id, nudgeToward(target, city.coordinates, 0.01));
    },
    [resolveCity, worldMapLayers, updatePointCoordinates]
  );

  const importGeoJSON = async (doc: unknown) => {
    if (!countryId) return { created: 0, skipped: 0, failed: 0 };
    const plan = planGeoJSONImport(doc);
    const subActions: EditorAction[] = [];
    return withBusy(async () => {
      const result = await runLimited(plan.features, 3, async (f) => {
        const data = importedFeatureData(f);
        const id = await historyExecutor.recreateFeature(f.kind, data);
        if (!id) throw new Error("Create returned no id");
        subActions.push({
          type: "create",
          featureType: f.kind,
          featureId: id,
          description: `Imported ${f.kind} "${f.name}"`,
          timestamp: Date.now(),
          newData: data,
        });
      });
      pushBatch(subActions, `Imported ${plural(subActions.length, "feature")} from GeoJSON`);
      afterWrite();
      return { created: result.successCount, failed: result.failCount, skipped: plan.skipped };
    });
  };

  return {
    isBulkBusy,
    bulkDeleteSelected,
    bulkEditSelected,
    gapFeatures,
    emptyRegionsFeatures,
    recalculateGaps,
    scatterCities,
    createCentroidCities,
    snapCityToSubdivisionBorder,
    snapCityToCoastline,
    importGeoJSON,
  };
}
