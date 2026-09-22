"use client";

import { useCallback } from "react";
import { api } from "~/trpc/react";
import type { FeatureType } from "./editor-types";
import type { EditorAction } from "./useMapHistory";

interface UseHistoryReversalExecutorProps {
  countryId?: string;
  invalidateAllMapData: () => void;
  debouncedRefetch: () => void;
}

export function useHistoryReversalExecutor({
  countryId,
  invalidateAllMapData,
  debouncedRefetch,
}: UseHistoryReversalExecutorProps) {
  const createCity = api.geoFeatures.createCity.useMutation();
  const updateCity = api.geoFeatures.updateCity.useMutation();
  const deleteCity = api.geoFeatures.deleteCity.useMutation();

  const createSubdivision = api.geoFeatures.createSubdivision.useMutation();
  const updateSubdivision = api.geoFeatures.updateSubdivision.useMutation();
  const deleteSubdivision = api.geoFeatures.deleteSubdivision.useMutation();

  const createPOI = api.geoFeatures.createPOI.useMutation();
  const updatePOI = api.geoFeatures.updatePOI.useMutation();
  const deletePOI = api.geoFeatures.deletePOI.useMutation();

  const createPeak = api.geoFeatures.createPeak.useMutation();
  const updatePeak = api.geoFeatures.updatePeak.useMutation();
  const deletePeak = api.geoFeatures.deletePeak.useMutation();

  const createRiver = api.geoFeatures.createNamedRiver.useMutation();
  const deleteRiver = api.geoFeatures.deleteNamedRiver.useMutation();

  const createLake = api.geoFeatures.createNamedLake.useMutation();
  const deleteLake = api.geoFeatures.deleteNamedLake.useMutation();

  const createRoute = api.transport.createRoute.useMutation();
  const updateRouteGeometry = api.transport.updateRouteGeometry.useMutation();
  const deleteRoute = api.transport.deleteRoute.useMutation();

  const deleteFeatureById = useCallback(
    async (featureType: FeatureType, featureId: string) => {
      if (!countryId) return;
      switch (featureType) {
        case "city":
          await deleteCity.mutateAsync({ countryId, cityId: featureId });
          break;
        case "subdivision":
          await deleteSubdivision.mutateAsync({ countryId, subdivisionId: featureId });
          break;
        case "poi":
        case "storyPin":
        case "mapLabel":
          await deletePOI.mutateAsync({ countryId, poiId: featureId });
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
      deleteCity,
      deleteSubdivision,
      deletePOI,
      deletePeak,
      deleteRiver,
      deleteLake,
      deleteRoute,
    ]
  );

  const recreateFeature = useCallback(
    async (featureType: FeatureType, data: Record<string, string | number | boolean | object | null | undefined>) => {
      if (!countryId) return;
      switch (featureType) {
        case "city":
          await createCity.mutateAsync({
            countryId,
            name: (data.name as string) || "Restored City",
            cityType: (data.cityType as string) || "city",
            coordinates: (data.coordinates as [number, number]) || [0, 0],
            population: typeof data.population === "number" ? data.population : undefined,
            isNationalCapital: !!data.isNationalCapital,
            isSubdivisionCapital: !!data.isSubdivisionCapital,
            subdivisionId: (data.subdivisionId as string) || undefined,
          });
          break;
        case "subdivision":
          await createSubdivision.mutateAsync({
            countryId,
            name: (data.name as string) || "Restored Region",
            type: (data.type as string) || "region",
            level: typeof data.level === "number" ? data.level : 1,
            geometry: data.geometry as Parameters<typeof createSubdivision.mutateAsync>[0]["geometry"],
            capital: (data.capital as string) || undefined,
            population: typeof data.population === "number" ? data.population : undefined,
          });
          break;
        case "poi":
        case "storyPin":
        case "mapLabel":
          await createPOI.mutateAsync({
            countryId,
            name: (data.name as string) || (data.title as string) || "Restored POI",
            category: (data.category as string) || "general",
            coordinates: (data.coordinates as [number, number]) || [0, 0],
            description: (data.description as string) || undefined,
          });
          break;
        case "peak":
          await createPeak.mutateAsync({
            countryId,
            name: (data.name as string) || "Restored Peak",
            coordinates: (data.coordinates as [number, number]) || [0, 0],
            elevation: typeof data.elevation === "number" ? data.elevation : 1000,
            prominence: typeof data.prominence === "number" ? data.prominence : undefined,
          });
          break;
        case "river":
          await createRiver.mutateAsync({
            countryId,
            name: (data.name as string) || "Restored River",
            geometry: data.geometry as Parameters<typeof createRiver.mutateAsync>[0]["geometry"],
            lengthKm: typeof data.lengthKm === "number" ? data.lengthKm : 10,
          });
          break;
        case "lake":
          await createLake.mutateAsync({
            countryId,
            name: (data.name as string) || "Restored Lake",
            geometry: data.geometry as Parameters<typeof createLake.mutateAsync>[0]["geometry"],
            areaKm2: typeof data.areaKm2 === "number" ? data.areaKm2 : 5,
          });
          break;
        case "route":
          await createRoute.mutateAsync({
            countryId,
            name: (data.name as string) || "Restored Route",
            routeType: (data.routeType as string) || "road",
            geometry: data.geometry as Parameters<typeof createRoute.mutateAsync>[0]["geometry"],
          });
          break;
      }
    },
    [
      countryId,
      createCity,
      createSubdivision,
      createPOI,
      createPeak,
      createRiver,
      createLake,
      createRoute,
    ]
  );

  const restoreFeatureData = useCallback(
    async (
      featureType: FeatureType,
      featureId: string,
      data: Record<string, string | number | boolean | object | null | undefined>
    ) => {
      if (!countryId) return;
      switch (featureType) {
        case "city":
          await updateCity.mutateAsync({
            countryId,
            cityId: featureId,
            name: (data.name as string) || "Updated City",
            cityType: (data.cityType as string) || "city",
            coordinates: (data.coordinates as [number, number]) || [0, 0],
            population: typeof data.population === "number" ? data.population : undefined,
            isNationalCapital: !!data.isNationalCapital,
            isSubdivisionCapital: !!data.isSubdivisionCapital,
          });
          break;
        case "subdivision":
          await updateSubdivision.mutateAsync({
            countryId,
            subdivisionId: featureId,
            name: (data.name as string) || "Updated Region",
            type: (data.type as string) || "region",
            level: typeof data.level === "number" ? data.level : 1,
            capital: (data.capital as string) || undefined,
            population: typeof data.population === "number" ? data.population : undefined,
          });
          break;
        case "poi":
        case "storyPin":
        case "mapLabel":
          await updatePOI.mutateAsync({
            countryId,
            poiId: featureId,
            name: (data.name as string) || "Updated POI",
            category: (data.category as string) || "general",
            coordinates: (data.coordinates as [number, number]) || [0, 0],
            description: (data.description as string) || undefined,
          });
          break;
        case "peak":
          await updatePeak.mutateAsync({
            countryId,
            peakId: featureId,
            name: (data.name as string) || "Updated Peak",
            coordinates: (data.coordinates as [number, number]) || [0, 0],
            elevation: typeof data.elevation === "number" ? data.elevation : 1000,
            prominence: typeof data.prominence === "number" ? data.prominence : undefined,
          });
          break;
        case "route":
          if (data.geometry) {
            await updateRouteGeometry.mutateAsync({
              countryId,
              id: featureId,
              geometry: data.geometry as Parameters<typeof updateRouteGeometry.mutateAsync>[0]["geometry"],
            });
          }
          break;
      }
    },
    [countryId, updateCity, updateSubdivision, updatePOI, updatePeak, updateRouteGeometry]
  );

  const applyInverseAction = useCallback(
    async (action: EditorAction) => {
      if (action.type === "create") {
        await deleteFeatureById(action.featureType, action.featureId);
      } else if (action.type === "delete" && action.previousData) {
        await recreateFeature(action.featureType, action.previousData);
      } else if (action.type === "update" && action.previousData) {
        await restoreFeatureData(action.featureType, action.featureId, action.previousData);
      }
    },
    [deleteFeatureById, recreateFeature, restoreFeatureData]
  );

  const applyForwardAction = useCallback(
    async (action: EditorAction) => {
      if (action.type === "create" && action.newData) {
        await recreateFeature(action.featureType, action.newData);
      } else if (action.type === "delete") {
        await deleteFeatureById(action.featureType, action.featureId);
      } else if (action.type === "update" && action.newData) {
        await restoreFeatureData(action.featureType, action.featureId, action.newData);
      }
    },
    [recreateFeature, deleteFeatureById, restoreFeatureData]
  );

  return {
    deleteFeatureById,
    recreateFeature,
    restoreFeatureData,
    applyInverseAction,
    applyForwardAction,
  };
}
