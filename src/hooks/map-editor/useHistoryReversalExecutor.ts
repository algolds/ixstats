"use client";

/**
 * useHistoryReversalExecutor — applies editor history actions against the server.
 *
 * Updates are *partial* patches (only the recorded keys are sent), so undoing a
 * move never renames a city or clears its capital flag. Re-created features get
 * new ids; an alias map keeps later history entries pointing at the live id.
 */

import { useCallback, useRef } from "react";
import { api } from "~/trpc/react";
import type { FeatureType } from "./editor-types";
import type { EditorAction, HistoryData } from "./useMapHistory";
import {
  bool,
  coords,
  geometry,
  has,
  hexColor,
  int,
  labelType,
  lineString,
  num,
  storyCategory,
  str,
  type GeometryInput,
} from "./history-coercion";

interface UseHistoryReversalExecutorProps {
  countryId?: string;
  invalidateAllMapData: () => void;
  debouncedRefetch: () => void;
}

export function useHistoryReversalExecutor({ countryId }: UseHistoryReversalExecutorProps) {
  const createCity = api.geoFeatures.createCity.useMutation();
  const updateCity = api.geoFeatures.updateCity.useMutation();
  const deleteCity = api.geoFeatures.deleteCity.useMutation();

  const createSubdivision = api.geoFeatures.createSubdivision.useMutation();
  const updateSubdivision = api.geoFeatures.updateSubdivision.useMutation();
  const deleteSubdivision = api.geoFeatures.deleteSubdivision.useMutation();
  const upsertSubdivision = api.countryGeo.upsertSubdivision.useMutation();

  const createPOI = api.geoFeatures.createPOI.useMutation();
  const updatePOI = api.geoFeatures.updatePOI.useMutation();
  const deletePOI = api.geoFeatures.deletePOI.useMutation();

  const createStoryPin = api.geoFeatures.createStoryPin.useMutation();
  const updateStoryPin = api.geoFeatures.updateStoryPin.useMutation();
  const deleteStoryPin = api.geoFeatures.deleteStoryPin.useMutation();

  const createMapLabel = api.geoFeatures.createMapLabel.useMutation();
  const updateMapLabel = api.geoFeatures.updateMapLabel.useMutation();
  const deleteMapLabel = api.geoFeatures.deleteMapLabel.useMutation();

  const createPeak = api.geoFeatures.createPeak.useMutation();
  const updatePeak = api.geoFeatures.updatePeak.useMutation();
  const deletePeak = api.geoFeatures.deletePeak.useMutation();

  const createRiver = api.geoFeatures.createNamedRiver.useMutation();
  const updateRiver = api.geoFeatures.updateNamedRiver.useMutation();
  const deleteRiver = api.geoFeatures.deleteNamedRiver.useMutation();

  const createLake = api.geoFeatures.createNamedLake.useMutation();
  const updateLake = api.geoFeatures.updateNamedLake.useMutation();
  const deleteLake = api.geoFeatures.deleteNamedLake.useMutation();

  const createRoute = api.transport.createRoute.useMutation();
  const updateRoute = api.transport.updateRoute.useMutation();
  const updateRouteGeometry = api.transport.updateRouteGeometry.useMutation();
  const deleteRoute = api.transport.deleteRoute.useMutation();

  // Recorded id → live id, for features re-created by undo/redo.
  const aliasRef = useRef(new Map<string, string>());

  const resolveId = useCallback((id: string): string => {
    let current = id;
    const seen = new Set<string>();
    while (aliasRef.current.has(current) && !seen.has(current)) {
      seen.add(current);
      current = aliasRef.current.get(current)!;
    }
    return current;
  }, []);

  const recordAlias = useCallback((recordedId: string, liveId: string | undefined) => {
    if (liveId && liveId !== recordedId) aliasRef.current.set(recordedId, liveId);
  }, []);

  const deleteFeatureById = useCallback(
    async (featureType: FeatureType, recordedId: string) => {
      if (!countryId) return;
      const featureId = resolveId(recordedId);
      switch (featureType) {
        case "city":
          await deleteCity.mutateAsync({ countryId, cityId: featureId });
          break;
        case "subdivision":
          await deleteSubdivision.mutateAsync({ countryId, subdivisionId: featureId });
          break;
        case "poi":
          await deletePOI.mutateAsync({ countryId, poiId: featureId });
          break;
        case "storyPin":
          await deleteStoryPin.mutateAsync({ countryId, pinId: featureId });
          break;
        case "mapLabel":
          await deleteMapLabel.mutateAsync({ countryId, labelId: featureId });
          break;
        case "peak":
          await deletePeak.mutateAsync({ countryId, peakId: featureId });
          break;
        case "river":
          await deleteRiver.mutateAsync({ countryId, riverId: featureId });
          break;
        case "lake":
          await deleteLake.mutateAsync({ countryId, lakeId: featureId });
          break;
        case "route":
          await deleteRoute.mutateAsync({ countryId, id: featureId });
          break;
      }
    },
    [
      countryId,
      resolveId,
      deleteCity,
      deleteSubdivision,
      deletePOI,
      deleteStoryPin,
      deleteMapLabel,
      deletePeak,
      deleteRiver,
      deleteLake,
      deleteRoute,
    ]
  );

  /** Creates a feature from a snapshot and returns its new id. */
  const recreateFeature = useCallback(
    async (featureType: FeatureType, data: HistoryData): Promise<string | undefined> => {
      if (!countryId) return undefined;
      switch (featureType) {
        case "city": {
          const res = await createCity.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored City",
            cityType: str(data.cityType) ?? str(data.type) ?? "city",
            coordinates: coords(data.coordinates) ?? [0, 0],
            population: int(data.population),
            isNationalCapital: bool(data.isNationalCapital) ?? false,
            isSubdivisionCapital: bool(data.isSubdivisionCapital) ?? false,
            subdivisionId: str(data.subdivisionId),
            wikiPageTitle: str(data.wikiPageTitle),
          });
          return res.id;
        }
        case "subdivision": {
          const res = await createSubdivision.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored Region",
            type: str(data.type) ?? "region",
            level: num(data.level) ?? 1,
            geometry: geometry(data.geometry) as Parameters<
              typeof createSubdivision.mutateAsync
            >[0]["geometry"],
            capital: str(data.capital),
            population: int(data.population),
          });
          return res.id;
        }
        case "poi": {
          const res = await createPOI.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored POI",
            category: str(data.category) ?? "landmark",
            coordinates: coords(data.coordinates) ?? [0, 0],
            description: str(data.description),
            icon: str(data.icon),
            wikiPageTitle: str(data.wikiPageTitle),
          });
          return res.id;
        }
        case "storyPin": {
          const res = await createStoryPin.mutateAsync({
            countryId,
            title: str(data.title) ?? str(data.name) ?? "Restored Story",
            content: str(data.content) ?? "—",
            contentFormat: data.contentFormat === "markdown" ? "markdown" : "plain",
            category: storyCategory(data.category) ?? "cultural",
            importance: Math.min(2, int(data.importance) ?? 0),
            coordinates: coords(data.coordinates) ?? [0, 0],
            ixTimeYear:
              num(data.ixTimeYear) !== undefined ? Math.round(num(data.ixTimeYear)!) : undefined,
            eraLabel: str(data.eraLabel),
            wikiPageTitle: str(data.wikiPageTitle),
          });
          return res.id;
        }
        case "mapLabel": {
          const res = await createMapLabel.mutateAsync({
            countryId,
            text: str(data.text) ?? str(data.name) ?? "Restored Label",
            labelType: labelType(data.labelType) ?? "region",
            coordinates: coords(data.coordinates) ?? [0, 0],
            fontSize: num(data.fontSize),
            color: hexColor(data.color),
            rotation: num(data.rotation),
            fontWeight: data.fontWeight === "bold" ? "bold" : undefined,
            opacity: num(data.opacity),
            wikiPageTitle: str(data.wikiPageTitle),
          });
          return res.id;
        }
        case "peak": {
          const res = await createPeak.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored Peak",
            coordinates: coords(data.coordinates) ?? [0, 0],
            elevation: num(data.elevation) ?? 1000,
            prominence: num(data.prominence),
          });
          return res.id;
        }
        case "river": {
          const res = await createRiver.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored River",
            geometry: data.geometry as Parameters<typeof createRiver.mutateAsync>[0]["geometry"],
          });
          return res.id;
        }
        case "lake": {
          const res = await createLake.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored Lake",
            geometry: data.geometry as Parameters<typeof createLake.mutateAsync>[0]["geometry"],
          });
          return res.id;
        }
        case "route": {
          const line = lineString(data.geometry);
          if (!line) return undefined;
          const res = await createRoute.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored Route",
            routeType: str(data.routeType) ?? "road",
            geometry: line,
          });
          return (res as { id?: string } | null)?.id;
        }
        default:
          return undefined;
      }
    },
    [
      countryId,
      createCity,
      createSubdivision,
      createPOI,
      createStoryPin,
      createMapLabel,
      createPeak,
      createRiver,
      createLake,
      createRoute,
    ]
  );

  /** Applies a partial snapshot to an existing feature (only the keys present are sent). */
  const restoreFeatureData = useCallback(
    async (
      featureType: FeatureType,
      recordedId: string,
      data: HistoryData,
      cascaded?: EditorAction["cascadedUpdates"],
      side: "previousData" | "newData" = "previousData"
    ) => {
      if (!countryId) return;
      const featureId = resolveId(recordedId);
      switch (featureType) {
        case "city":
          await updateCity.mutateAsync({
            countryId,
            cityId: featureId,
            ...(has(data, "name") && str(data.name) ? { name: str(data.name) } : {}),
            ...(has(data, "cityType") ? { cityType: str(data.cityType) } : {}),
            ...(coords(data.coordinates) ? { coordinates: coords(data.coordinates) } : {}),
            ...(has(data, "population") ? { population: int(data.population) } : {}),
            ...(has(data, "isNationalCapital")
              ? { isNationalCapital: bool(data.isNationalCapital) }
              : {}),
            ...(has(data, "isSubdivisionCapital")
              ? { isSubdivisionCapital: bool(data.isSubdivisionCapital) }
              : {}),
          });
          break;
        case "subdivision": {
          const hasStyle = has(data, "color") || has(data, "governmentType");
          // The attribute upsert defaults type/level when omitted, so it needs both.
          const canUpsertStyle = hasStyle && !!str(data.type) && num(data.level) !== undefined;
          const cascadedNeighbors = (cascaded ?? [])
            .map((c) => ({
              subdivisionId: resolveId(c.featureId),
              geometry: geometry(c[side]?.geometry),
            }))
            .filter((c): c is { subdivisionId: string; geometry: GeometryInput } => !!c.geometry);
          const hasCore =
            !!str(data.name) ||
            !!geometry(data.geometry) ||
            has(data, "capital") ||
            has(data, "population") ||
            cascadedNeighbors.length > 0 ||
            (!canUpsertStyle && (!!str(data.type) || num(data.level) !== undefined));
          if (hasCore) {
            await updateSubdivision.mutateAsync({
              countryId,
              subdivisionId: featureId,
              ...(str(data.name) ? { name: str(data.name) } : {}),
              ...(str(data.type) ? { type: str(data.type) } : {}),
              ...(num(data.level) !== undefined ? { level: num(data.level) } : {}),
              ...(geometry(data.geometry) ? { geometry: geometry(data.geometry) } : {}),
              ...(has(data, "capital") && str(data.capital) ? { capital: str(data.capital) } : {}),
              ...(has(data, "population") ? { population: int(data.population) } : {}),
              ...(cascadedNeighbors.length > 0 ? { cascadedNeighbors } : {}),
            });
          }
          // color / governmentType are not on geoFeatures.updateSubdivision — use the attribute upsert.
          if (canUpsertStyle) {
            await upsertSubdivision.mutateAsync({
              countryId,
              id: featureId,
              type: str(data.type),
              level: num(data.level),
              ...(has(data, "color") ? { color: hexColor(data.color) ?? null } : {}),
              ...(has(data, "governmentType")
                ? { governmentType: str(data.governmentType) ?? null }
                : {}),
            });
          }
          break;
        }
        case "poi":
          await updatePOI.mutateAsync({
            countryId,
            poiId: featureId,
            ...(str(data.name) ? { name: str(data.name) } : {}),
            ...(str(data.category) ? { category: str(data.category) } : {}),
            ...(coords(data.coordinates) ? { coordinates: coords(data.coordinates) } : {}),
            ...(has(data, "description") ? { description: str(data.description) } : {}),
            ...(has(data, "icon") ? { icon: str(data.icon) } : {}),
          });
          break;
        case "storyPin":
          await updateStoryPin.mutateAsync({
            countryId,
            pinId: featureId,
            ...(str(data.title) ? { title: str(data.title) } : {}),
            ...(str(data.content) ? { content: str(data.content) } : {}),
            ...(storyCategory(data.category) ? { category: storyCategory(data.category) } : {}),
            ...(coords(data.coordinates) ? { coordinates: coords(data.coordinates) } : {}),
          });
          break;
        case "mapLabel":
          await updateMapLabel.mutateAsync({
            countryId,
            labelId: featureId,
            ...(str(data.text) ? { text: str(data.text) } : {}),
            ...(labelType(data.labelType) ? { labelType: labelType(data.labelType) } : {}),
            ...(coords(data.coordinates) ? { coordinates: coords(data.coordinates) } : {}),
            ...(num(data.fontSize) !== undefined ? { fontSize: num(data.fontSize) } : {}),
            ...(hexColor(data.color) ? { color: hexColor(data.color) } : {}),
          });
          break;
        case "peak":
          await updatePeak.mutateAsync({
            countryId,
            peakId: featureId,
            ...(str(data.name) ? { name: str(data.name) } : {}),
            ...(coords(data.coordinates) ? { coordinates: coords(data.coordinates) } : {}),
            ...(num(data.elevation) !== undefined ? { elevation: num(data.elevation) } : {}),
            ...(has(data, "prominence") ? { prominence: num(data.prominence) ?? null } : {}),
          });
          break;
        case "river":
          await updateRiver.mutateAsync({
            countryId,
            riverId: featureId,
            ...(str(data.name) ? { name: str(data.name) } : {}),
            ...(geometry(data.geometry) ? { geometry: geometry(data.geometry) } : {}),
          });
          break;
        case "lake":
          await updateLake.mutateAsync({
            countryId,
            lakeId: featureId,
            ...(str(data.name) ? { name: str(data.name) } : {}),
            ...(geometry(data.geometry) ? { geometry: geometry(data.geometry) } : {}),
          });
          break;
        case "route": {
          const line = lineString(data.geometry);
          if (line) {
            await updateRouteGeometry.mutateAsync({ countryId, id: featureId, geometry: line });
          }
          if (str(data.name) || str(data.routeType)) {
            await updateRoute.mutateAsync({
              countryId,
              id: featureId,
              ...(str(data.name) ? { name: str(data.name) } : {}),
              ...(str(data.routeType) ? { routeType: str(data.routeType) } : {}),
            });
          }
          break;
        }
      }
    },
    [
      countryId,
      resolveId,
      updateCity,
      updateSubdivision,
      upsertSubdivision,
      updatePOI,
      updateStoryPin,
      updateMapLabel,
      updatePeak,
      updateRiver,
      updateLake,
      updateRoute,
      updateRouteGeometry,
    ]
  );

  const applyInverseAction = useCallback(
    async (action: EditorAction): Promise<void> => {
      if (action.type === "batch") {
        // Undo sub-actions in reverse order.
        for (const sub of [...(action.subActions ?? [])].reverse()) {
          await applyInverseAction(sub);
        }
        return;
      }
      if (action.type === "create") {
        await deleteFeatureById(action.featureType, action.featureId);
      } else if (action.type === "delete" && action.previousData) {
        const newId = await recreateFeature(action.featureType, action.previousData);
        recordAlias(action.featureId, newId);
      } else if (action.type === "update" && action.previousData) {
        await restoreFeatureData(
          action.featureType,
          action.featureId,
          action.previousData,
          action.cascadedUpdates,
          "previousData"
        );
      }
    },
    [deleteFeatureById, recreateFeature, restoreFeatureData, recordAlias]
  );

  const applyForwardAction = useCallback(
    async (action: EditorAction): Promise<void> => {
      if (action.type === "batch") {
        for (const sub of action.subActions ?? []) {
          await applyForwardAction(sub);
        }
        return;
      }
      if (action.type === "create" && action.newData) {
        const newId = await recreateFeature(action.featureType, action.newData);
        recordAlias(action.featureId, newId);
      } else if (action.type === "delete") {
        await deleteFeatureById(action.featureType, action.featureId);
      } else if (action.type === "update" && action.newData) {
        await restoreFeatureData(
          action.featureType,
          action.featureId,
          action.newData,
          action.cascadedUpdates,
          "newData"
        );
      }
    },
    [recreateFeature, deleteFeatureById, restoreFeatureData, recordAlias]
  );

  return {
    resolveId,
    deleteFeatureById,
    recreateFeature,
    restoreFeatureData,
    applyInverseAction,
    applyForwardAction,
  };
}
