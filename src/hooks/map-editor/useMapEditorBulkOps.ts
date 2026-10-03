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

  const bulkDeleteSelected = useCallback(async () => {
    if (!countryId || selectedIds.size === 0) return { successCount: 0, failCount: 0 };
    const toDelete = allFeatures.filter((f) => selectedIds.has(f.id) && f.type !== "gap");
    const subActions: EditorAction[] = [];
    setIsBulkBusy(true);
    try {
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
      if (subActions.length > 0) {
        pushAction({
          type: "batch",
          featureType: toDelete[0]!.type,
          featureId: toDelete[0]!.id,
          description: `Deleted ${subActions.length} feature${subActions.length === 1 ? "" : "s"}`,
          subActions,
        });
      }
      if (selectedFeature && selectedIds.has(selectedFeature.id)) resetForm();
      clearMultiSelect();
      afterWrite();
      if (result.failCount > 0) {
        setMutationError(`${result.failCount} of ${toDelete.length} deletions failed`);
      }
      return result;
    } finally {
      setIsBulkBusy(false);
    }
  }, [
    countryId,
    selectedIds,
    allFeatures,
    historyExecutor,
    pushAction,
    selectedFeature,
    resetForm,
    clearMultiSelect,
    afterWrite,
  ]);

  /** Applies one attribute to every selected region (one undo step). */
  const bulkEditSelected = useCallback(
    async (
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
        return { successCount: 0, failCount: 0 };
      }
      const regions = allFeatures.filter((f) => selectedIds.has(f.id) && f.type === "subdivision");
      const subActions: EditorAction[] = [];
      setIsBulkBusy(true);
      try {
        const result = await runLimited(regions, 4, async (r) => {
          const base: HistoryData = {
            type: (r.properties.type as string) || "region",
            level: Number(r.properties.level) || 1,
          };
          const prev: HistoryData = { ...base, [field]: r.properties[field] ?? null };
          const next: HistoryData = { ...base, [field]: valueArg };
          const action: EditorAction = {
            type: "update",
            featureType: "subdivision",
            featureId: r.id,
            description: `Set ${field} on "${r.name}"`,
            timestamp: Date.now(),
            previousData: prev,
            newData: next,
          };
          await historyExecutor.applyForwardAction(action);
          subActions.push(action);
        });
        if (subActions.length > 0) {
          pushAction({
            type: "batch",
            featureType: "subdivision",
            featureId: subActions[0]!.featureId,
            description: `Set ${field} on ${subActions.length} region${subActions.length === 1 ? "" : "s"}`,
            subActions,
          });
        }
        afterWrite();
        return result;
      } finally {
        setIsBulkBusy(false);
      }
    },
    [countryId, allFeatures, selectedIds, historyExecutor, pushAction, afterWrite]
  );

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
  const createCitiesBatch = useCallback(
    async (
      cities: Array<{
        name: string;
        cityType: string;
        coordinates: [number, number];
        subdivisionId?: string;
        isSubdivisionCapital?: boolean;
      }>,
      description: string
    ) => {
      if (!countryId || cities.length === 0) return { successCount: 0, failCount: 0 };
      const subActions: EditorAction[] = [];
      setIsBulkBusy(true);
      try {
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
        if (subActions.length > 0) {
          pushAction({
            type: "batch",
            featureType: "city",
            featureId: subActions[0]!.featureId,
            description,
            subActions,
          });
        }
        afterWrite();
        return result;
      } finally {
        setIsBulkBusy(false);
      }
    },
    [countryId, historyExecutor, pushAction, afterWrite]
  );

  const scatterCities = useCallback(
    async (count?: number, type?: string, prefix?: string) => {
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
    },
    [selectedFeature, allFeatures, createCitiesBatch]
  );

  const createCentroidCities = useCallback(
    async (_countryId?: string) => {
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
    },
    [showGaps, emptyRegions, allFeatures, createCitiesBatch]
  );

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

  const importGeoJSON = useCallback(
    async (doc: unknown) => {
      if (!countryId) return { created: 0, skipped: 0, failed: 0 };
      const plan = planGeoJSONImport(doc);
      const subActions: EditorAction[] = [];
      setIsBulkBusy(true);
      try {
        const result = await runLimited(plan.features, 3, async (f) => {
          const data: HistoryData =
            f.kind === "subdivision"
              ? {
                  name: f.name,
                  type: typeof f.properties.type === "string" ? f.properties.type : "province",
                  level: typeof f.properties.level === "number" ? f.properties.level : 1,
                  geometry: f.geometry,
                }
              : f.kind === "city"
                ? {
                    name: f.name,
                    cityType:
                      typeof f.properties.cityType === "string" ? f.properties.cityType : "city",
                    coordinates: f.coordinates,
                    population:
                      typeof f.properties.population === "number"
                        ? f.properties.population
                        : undefined,
                  }
                : {
                    name: f.name,
                    category:
                      typeof f.properties.category === "string"
                        ? f.properties.category
                        : "landmark",
                    coordinates: f.coordinates,
                    description:
                      typeof f.properties.description === "string"
                        ? f.properties.description
                        : undefined,
                  };
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
        if (subActions.length > 0) {
          pushAction({
            type: "batch",
            featureType: subActions[0]!.featureType,
            featureId: subActions[0]!.featureId,
            description: `Imported ${subActions.length} feature${subActions.length === 1 ? "" : "s"} from GeoJSON`,
            subActions,
          });
        }
        afterWrite();
        return { created: result.successCount, failed: result.failCount, skipped: plan.skipped };
      } finally {
        setIsBulkBusy(false);
      }
    },
    [countryId, historyExecutor, pushAction, afterWrite]
  );

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
