import { useCallback } from "react";
import { api } from "~/trpc/react";
import type {
  EditorFeature,
  EditorMode,
  CityFormData,
  SubdivisionFormData,
  POIFormData,
  StoryPinFormData,
  MapLabelFormData,
  PeakFormData,
  NamedRiverFormData,
  NamedLakeFormData,
} from "./editor-types";

import type { FeatureType } from "~/types/maps/editor-domain";
import type { EditorAction } from "./useMapHistory";

interface UseMapFeatureMutationsOptions {
  countryId: string | undefined;
  selectedFeature: EditorFeature | null;
  pendingCoordinates: [number, number] | null;
  pendingGeometry: object | null;
  cityForm: CityFormData;
  subdivisionForm: SubdivisionFormData;
  poiForm: POIFormData;
  storyPinForm: StoryPinFormData;
  mapLabelForm: MapLabelFormData;
  peakForm: PeakFormData;
  riverForm: NamedRiverFormData;
  lakeForm: NamedLakeFormData;
  editingRouteId: string | null;
  editingRouteVertices: [number, number][];
  resetForm: () => void;
  setMode: (mode: EditorMode) => void;
  invalidateAllMapData: () => void;
  debouncedRefetch: () => void;
  setLastSavedAt: (date: Date) => void;
  setMutationError: (err: string | null) => void;
  pushAction?: (action: EditorAction) => void;
}

export function useMapFeatureMutations({
  countryId,
  selectedFeature,
  pendingCoordinates,
  pendingGeometry,
  cityForm,
  subdivisionForm,
  poiForm,
  storyPinForm,
  mapLabelForm,
  peakForm,
  riverForm,
  lakeForm,
  editingRouteId,
  editingRouteVertices,
  resetForm,
  setMode,
  invalidateAllMapData,
  debouncedRefetch,
  setLastSavedAt,
  setMutationError,
  pushAction,
}: UseMapFeatureMutationsOptions) {
  const createCity = api.geoFeatures.createCity.useMutation();
  const updateCity = api.geoFeatures.updateCity.useMutation();
  const deleteCity = api.geoFeatures.deleteCity.useMutation();

  const createSubdivision = api.geoFeatures.createSubdivision.useMutation();
  const updateSubdivision = api.geoFeatures.updateSubdivision.useMutation();
  const deleteSubdivision = api.geoFeatures.deleteSubdivision.useMutation();

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

  const createNamedRiver = api.geoFeatures.createNamedRiver.useMutation();
  const updateNamedRiver = api.geoFeatures.updateNamedRiver.useMutation();
  const deleteNamedRiver = api.geoFeatures.deleteNamedRiver.useMutation();

  const createNamedLake = api.geoFeatures.createNamedLake.useMutation();
  const updateNamedLake = api.geoFeatures.updateNamedLake.useMutation();
  const deleteNamedLake = api.geoFeatures.deleteNamedLake.useMutation();

  const createRoute = api.transport.createRoute.useMutation();
  const updateRoute = api.transport.updateRoute.useMutation();
  const updateRouteGeometry = api.transport.updateRouteGeometry.useMutation();
  const deleteRoute = api.transport.deleteRoute.useMutation();

  const isMutating =
    createCity.isPending ||
    updateCity.isPending ||
    deleteCity.isPending ||
    createSubdivision.isPending ||
    updateSubdivision.isPending ||
    deleteSubdivision.isPending ||
    createPOI.isPending ||
    updatePOI.isPending ||
    deletePOI.isPending ||
    createStoryPin.isPending ||
    updateStoryPin.isPending ||
    deleteStoryPin.isPending ||
    createMapLabel.isPending ||
    updateMapLabel.isPending ||
    deleteMapLabel.isPending ||
    createPeak.isPending ||
    updatePeak.isPending ||
    deletePeak.isPending ||
    createNamedRiver.isPending ||
    updateNamedRiver.isPending ||
    deleteNamedRiver.isPending ||
    createNamedLake.isPending ||
    updateNamedLake.isPending ||
    deleteNamedLake.isPending ||
    createRoute.isPending ||
    updateRoute.isPending ||
    updateRouteGeometry.isPending ||
    deleteRoute.isPending;

  const onSuccess = useCallback(
    (
      type?: "create" | "update" | "delete",
      featureType?: FeatureType,
      featureId?: string,
      description?: string,
      prev?: Record<string, string | number | boolean | object | null | undefined>,
      next?: Record<string, string | number | boolean | object | null | undefined>
    ) => {
      if (type && featureType && featureId && description) {
        pushAction?.({
          type,
          featureType,
          featureId,
          description,
          timestamp: Date.now(),
          previousData: prev,
          newData: next,
        });
      }
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
      setLastSavedAt(new Date());
      setMutationError(null);
    },
    [pushAction, resetForm, setMode, invalidateAllMapData, debouncedRefetch, setLastSavedAt, setMutationError]
  );

  const submitCity = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      const res = await createCity.mutateAsync({
        countryId,
        name: cityForm.name,
        cityType: cityForm.cityType,
        coordinates: pendingCoordinates,
        population: cityForm.population,
        isNationalCapital: cityForm.isNationalCapital,
        isSubdivisionCapital: cityForm.isSubdivisionCapital,
        subdivisionId: cityForm.subdivisionId,
      });
      onSuccess(
        "create",
        "city",
        res.id,
        `Created City "${cityForm.name}"`,
        undefined,
        { ...cityForm, coordinates: pendingCoordinates }
      );
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to create city");
    }
  }, [countryId, pendingCoordinates, cityForm, createCity, onSuccess, setMutationError]);

  const submitEditCity = useCallback(
    async (overrideForm?: Partial<CityFormData>) => {
      if (!countryId || !selectedFeature) return;
      const form = { ...cityForm, ...overrideForm };
      try {
        await updateCity.mutateAsync({
          countryId,
          cityId: selectedFeature.id,
          name: form.name,
          cityType: form.cityType,
          coordinates: selectedFeature.coordinates!,
          population: form.population,
          isNationalCapital: form.isNationalCapital,
          isSubdivisionCapital: form.isSubdivisionCapital,
        });
        onSuccess(
          "update",
          "city",
          selectedFeature.id,
          `Updated City "${form.name}"`,
          { ...selectedFeature.properties, coordinates: selectedFeature.coordinates },
          { ...form, coordinates: selectedFeature.coordinates }
        );
      } catch (e) {
        setMutationError(e instanceof Error && e.message ? e.message : "Failed to update city");
      }
    },
    [countryId, selectedFeature, cityForm, updateCity, onSuccess, setMutationError]
  );

  const submitSubdivision = useCallback(async () => {
    if (!countryId || !pendingGeometry) return;
    try {
      const res = await createSubdivision.mutateAsync({
        countryId,
        name: subdivisionForm.name,
        type: subdivisionForm.type,
        level: subdivisionForm.level,
        geometry: pendingGeometry as Parameters<typeof createSubdivision.mutateAsync>[0]["geometry"],
        capital: subdivisionForm.capital,
        population: subdivisionForm.population,
      });
      onSuccess(
        "create",
        "subdivision",
        res.id,
        `Created Region "${subdivisionForm.name}"`,
        undefined,
        { ...subdivisionForm, geometry: pendingGeometry }
      );
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to create subdivision");
    }
  }, [countryId, pendingGeometry, subdivisionForm, createSubdivision, onSuccess, setMutationError]);

  const submitEditSubdivision = useCallback(
    async (overrideForm?: Partial<SubdivisionFormData>) => {
      if (!countryId || !selectedFeature) return;
      const form = { ...subdivisionForm, ...overrideForm };
      try {
        await updateSubdivision.mutateAsync({
          countryId,
          subdivisionId: selectedFeature.id,
          name: form.name,
          type: form.type,
          level: form.level,
          geometry: (selectedFeature.geometry || form.geometry) as Parameters<
            typeof updateSubdivision.mutateAsync
          >[0]["geometry"],
          capital: form.capital,
          population: form.population,
        });
        onSuccess(
          "update",
          "subdivision",
          selectedFeature.id,
          `Updated Region "${form.name}"`,
          { ...selectedFeature.properties, geometry: selectedFeature.geometry },
          { ...form, geometry: selectedFeature.geometry || form.geometry }
        );
      } catch (e) {
        setMutationError(e instanceof Error && e.message ? e.message : "Failed to update subdivision");
      }
    },
    [countryId, selectedFeature, subdivisionForm, updateSubdivision, onSuccess, setMutationError]
  );

  const submitPOI = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      const res = await createPOI.mutateAsync({
        countryId,
        name: poiForm.name,
        category: poiForm.category,
        coordinates: pendingCoordinates,
        description: poiForm.description,
        icon: poiForm.icon,
        wikiPageTitle: poiForm.wikiPageTitle,
      });
      onSuccess(
        "create",
        "poi",
        res.id,
        `Created POI "${poiForm.name}"`,
        undefined,
        { ...poiForm, coordinates: pendingCoordinates }
      );
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to create POI");
    }
  }, [countryId, pendingCoordinates, poiForm, createPOI, onSuccess, setMutationError]);

  const submitEditPOI = useCallback(
    async (overrideForm?: Partial<POIFormData>) => {
      if (!countryId || !selectedFeature) return;
      const form = { ...poiForm, ...overrideForm };
      try {
        await updatePOI.mutateAsync({
          countryId,
          poiId: selectedFeature.id,
          name: form.name,
          category: form.category,
          coordinates: selectedFeature.coordinates!,
          description: form.description,
          icon: form.icon,
          wikiPageTitle: form.wikiPageTitle,
        });
        onSuccess(
          "update",
          "poi",
          selectedFeature.id,
          `Updated POI "${form.name}"`,
          { ...selectedFeature.properties, coordinates: selectedFeature.coordinates },
          { ...form, coordinates: selectedFeature.coordinates }
        );
      } catch (e) {
        setMutationError(e instanceof Error && e.message ? e.message : "Failed to update POI");
      }
    },
    [countryId, selectedFeature, poiForm, updatePOI, onSuccess, setMutationError]
  );

  const submitStoryPin = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createStoryPin.mutateAsync({
        countryId,
        title: storyPinForm.title,
        coordinates: pendingCoordinates,
        content: storyPinForm.content,
        ixTimeYear: storyPinForm.ixTimeYear,
        category: storyPinForm.category,
      });
      onSuccess();
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to create story pin");
    }
  }, [countryId, pendingCoordinates, storyPinForm, createStoryPin, onSuccess, setMutationError]);

  const submitEditStoryPin = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateStoryPin.mutateAsync({
        countryId,
        pinId: selectedFeature.id,
        title: storyPinForm.title,
        coordinates: selectedFeature.coordinates!,
        content: storyPinForm.content,
        ixTimeYear: storyPinForm.ixTimeYear,
        category: storyPinForm.category,
      });
      onSuccess();
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to update story pin");
    }
  }, [countryId, selectedFeature, storyPinForm, updateStoryPin, onSuccess, setMutationError]);

  const submitMapLabel = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createMapLabel.mutateAsync({
        countryId,
        text: mapLabelForm.text,
        labelType: mapLabelForm.labelType,
        coordinates: pendingCoordinates,
        fontSize: mapLabelForm.fontSize,
        color: mapLabelForm.color,
      });
      onSuccess();
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to create map label");
    }
  }, [countryId, pendingCoordinates, mapLabelForm, createMapLabel, onSuccess, setMutationError]);

  const submitEditMapLabel = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateMapLabel.mutateAsync({
        countryId,
        labelId: selectedFeature.id,
        text: mapLabelForm.text,
        labelType: mapLabelForm.labelType,
        coordinates: selectedFeature.coordinates!,
        fontSize: mapLabelForm.fontSize,
        color: mapLabelForm.color,
      });
      onSuccess();
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to update map label");
    }
  }, [countryId, selectedFeature, mapLabelForm, updateMapLabel, onSuccess, setMutationError]);

  const submitPeak = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      const res = await createPeak.mutateAsync({
        countryId,
        name: peakForm.name,
        elevation: peakForm.elevation,
        coordinates: pendingCoordinates,
      });
      onSuccess(
        "create",
        "peak",
        res.id,
        `Created Peak "${peakForm.name}"`,
        undefined,
        { ...peakForm, coordinates: pendingCoordinates }
      );
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to create peak");
    }
  }, [countryId, pendingCoordinates, peakForm, createPeak, onSuccess, setMutationError]);

  const submitEditPeak = useCallback(
    async (overrideForm?: Partial<PeakFormData>) => {
      if (!countryId || !selectedFeature) return;
      const form = { ...peakForm, ...overrideForm };
      try {
        await updatePeak.mutateAsync({
          countryId,
          peakId: selectedFeature.id,
          name: form.name,
          elevation: form.elevation,
          coordinates: selectedFeature.coordinates!,
        });
        onSuccess(
          "update",
          "peak",
          selectedFeature.id,
          `Updated Peak "${form.name}"`,
          { ...selectedFeature.properties, coordinates: selectedFeature.coordinates },
          { ...form, coordinates: selectedFeature.coordinates }
        );
      } catch (e) {
        setMutationError(e instanceof Error && e.message ? e.message : "Failed to update peak");
      }
    },
    [countryId, selectedFeature, peakForm, updatePeak, onSuccess, setMutationError]
  );

  const submitRiver = useCallback(async () => {
    if (!countryId || !pendingGeometry) return;
    try {
      const res = await createNamedRiver.mutateAsync({
        countryId,
        name: riverForm.name,
        geometry: pendingGeometry as Parameters<typeof createNamedRiver.mutateAsync>[0]["geometry"],
      });
      onSuccess(
        "create",
        "river",
        res.id,
        `Created River "${riverForm.name}"`,
        undefined,
        { ...riverForm, geometry: pendingGeometry }
      );
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to create river");
    }
  }, [countryId, pendingGeometry, riverForm, createNamedRiver, onSuccess, setMutationError]);

  const submitEditRiver = useCallback(
    async (overrideForm?: Partial<NamedRiverFormData>) => {
      if (!countryId || !selectedFeature) return;
      const form = { ...riverForm, ...overrideForm };
      try {
        await updateNamedRiver.mutateAsync({
          countryId,
          riverId: selectedFeature.id,
          name: form.name,
        });
        onSuccess(
          "update",
          "river",
          selectedFeature.id,
          `Updated River "${form.name}"`,
          { ...selectedFeature.properties },
          { ...form }
        );
      } catch (e) {
        setMutationError(e instanceof Error && e.message ? e.message : "Failed to update river");
      }
    },
    [countryId, selectedFeature, riverForm, updateNamedRiver, onSuccess, setMutationError]
  );

  const submitLake = useCallback(async () => {
    if (!countryId || !pendingGeometry) return;
    try {
      const res = await createNamedLake.mutateAsync({
        countryId,
        name: lakeForm.name,
        geometry: pendingGeometry as Parameters<typeof createNamedLake.mutateAsync>[0]["geometry"],
      });
      onSuccess(
        "create",
        "lake",
        res.id,
        `Created Lake "${lakeForm.name}"`,
        undefined,
        { ...lakeForm, geometry: pendingGeometry }
      );
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : "Failed to create lake");
    }
  }, [countryId, pendingGeometry, lakeForm, createNamedLake, onSuccess, setMutationError]);

  const submitEditLake = useCallback(
    async (overrideForm?: Partial<NamedLakeFormData>) => {
      if (!countryId || !selectedFeature) return;
      const form = { ...lakeForm, ...overrideForm };
      try {
        await updateNamedLake.mutateAsync({
          countryId,
          lakeId: selectedFeature.id,
          name: form.name,
        });
        onSuccess(
          "update",
          "lake",
          selectedFeature.id,
          `Updated Lake "${form.name}"`,
          { ...selectedFeature.properties },
          { ...form }
        );
      } catch (e) {
        setMutationError(e instanceof Error && e.message ? e.message : "Failed to update lake");
      }
    },
    [countryId, selectedFeature, lakeForm, updateNamedLake, onSuccess, setMutationError]
  );

  const deleteFeature = useCallback(
    async (feature: EditorFeature) => {
      if (!countryId) return;
      try {
        switch (feature.type) {
          case "city":
            await deleteCity.mutateAsync({ countryId, cityId: feature.id });
            break;
          case "subdivision":
            await deleteSubdivision.mutateAsync({ countryId, subdivisionId: feature.id });
            break;
          case "poi":
            await deletePOI.mutateAsync({ countryId, poiId: feature.id });
            break;
          case "storyPin":
            await deleteStoryPin.mutateAsync({ countryId, pinId: feature.id });
            break;
          case "mapLabel":
            await deleteMapLabel.mutateAsync({ countryId, labelId: feature.id });
            break;
          case "peak":
            await deletePeak.mutateAsync({ countryId, peakId: feature.id });
            break;
          case "river":
            await deleteNamedRiver.mutateAsync({ countryId, riverId: feature.id });
            break;
          case "lake":
            await deleteNamedLake.mutateAsync({ countryId, lakeId: feature.id });
            break;
          case "route":
            await deleteRoute.mutateAsync({ countryId, id: feature.id });
            break;
        }
        onSuccess(
          "delete",
          feature.type as FeatureType,
          feature.id,
          `Deleted ${feature.type} "${feature.name}"`,
          {
            ...feature.properties,
            coordinates: feature.coordinates,
            geometry: feature.geometry,
            name: feature.name,
          }
        );
      } catch (e) {
        setMutationError(e instanceof Error && e.message ? e.message : "Failed to delete feature");
      }
    },
    [
      countryId,
      deleteCity,
      deleteSubdivision,
      deletePOI,
      deleteStoryPin,
      deleteMapLabel,
      deletePeak,
      deleteNamedRiver,
      deleteNamedLake,
      deleteRoute,
      onSuccess,
      setMutationError,
    ]
  );

  return {
    isMutating,
    submitCity,
    submitEditCity,
    submitSubdivision,
    submitEditSubdivision,
    submitPOI,
    submitEditPOI,
    submitStoryPin,
    submitEditStoryPin,
    submitMapLabel,
    submitEditMapLabel,
    submitPeak,
    submitEditPeak,
    submitRiver,
    submitEditRiver,
    submitLake,
    submitEditLake,
    deleteFeature,
    updateRouteGeometry,
    createRoute,
    updateRoute,
  };
}
