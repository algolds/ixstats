import { useCallback } from "react";
import { api } from "~/trpc/react";
import type {
  EditorFeature,
  CityFormData,
  SubdivisionFormData,
  POIFormData,
  StoryPinFormData,
  MapLabelFormData,
  PeakFormData,
  NamedRiverFormData,
  NamedLakeFormData,
} from "./editor-types";

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
  setMode: (mode: any) => void;
  invalidateAllMapData: () => void;
  debouncedRefetch: () => void;
  setLastSavedAt: (date: Date) => void;
  setMutationError: (err: string | null) => void;
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

  const onSuccess = useCallback(() => {
    setLastSavedAt(new Date());
    resetForm();
    setMode("view");
    invalidateAllMapData();
    debouncedRefetch();
  }, [resetForm, setMode, invalidateAllMapData, debouncedRefetch, setLastSavedAt]);

  const submitCity = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createCity.mutateAsync({
        countryId,
        name: cityForm.name,
        cityType: cityForm.cityType,
        coordinates: pendingCoordinates,
        population: cityForm.population,
        isNationalCapital: cityForm.isNationalCapital,
        isSubdivisionCapital: cityForm.isSubdivisionCapital,
        subdivisionId: cityForm.subdivisionId,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create city");
    }
  }, [countryId, pendingCoordinates, cityForm, createCity, onSuccess, setMutationError]);

  const submitEditCity = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateCity.mutateAsync({
        countryId,
        cityId: selectedFeature.id,
        name: cityForm.name,
        cityType: cityForm.cityType,
        coordinates: selectedFeature.coordinates!,
        population: cityForm.population,
        isNationalCapital: cityForm.isNationalCapital,
        isSubdivisionCapital: cityForm.isSubdivisionCapital,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update city");
    }
  }, [countryId, selectedFeature, cityForm, updateCity, onSuccess, setMutationError]);

  const submitSubdivision = useCallback(async () => {
    if (!countryId || !pendingGeometry) return;
    try {
      await createSubdivision.mutateAsync({
        countryId,
        name: subdivisionForm.name,
        type: subdivisionForm.type,
        level: subdivisionForm.level,
        geometry: pendingGeometry as Record<string, unknown>,
        capital: subdivisionForm.capital,
        population: subdivisionForm.population,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create subdivision");
    }
  }, [countryId, pendingGeometry, subdivisionForm, createSubdivision, onSuccess, setMutationError]);

  const submitEditSubdivision = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateSubdivision.mutateAsync({
        countryId,
        subdivisionId: selectedFeature.id,
        name: subdivisionForm.name,
        type: subdivisionForm.type,
        level: subdivisionForm.level,
        geometry: (selectedFeature.geometry || subdivisionForm.geometry) as Record<string, unknown>,
        capital: subdivisionForm.capital,
        population: subdivisionForm.population,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update subdivision");
    }
  }, [countryId, selectedFeature, subdivisionForm, updateSubdivision, onSuccess, setMutationError]);

  const submitPOI = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createPOI.mutateAsync({
        countryId,
        name: poiForm.name,
        category: poiForm.category,
        coordinates: pendingCoordinates,
        description: poiForm.description,
        icon: poiForm.icon,
        wikiPageTitle: poiForm.wikiPageTitle,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create POI");
    }
  }, [countryId, pendingCoordinates, poiForm, createPOI, onSuccess, setMutationError]);

  const submitEditPOI = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updatePOI.mutateAsync({
        countryId,
        poiId: selectedFeature.id,
        name: poiForm.name,
        category: poiForm.category,
        coordinates: selectedFeature.coordinates!,
        description: poiForm.description,
        icon: poiForm.icon,
        wikiPageTitle: poiForm.wikiPageTitle,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update POI");
    }
  }, [countryId, selectedFeature, poiForm, updatePOI, onSuccess, setMutationError]);

  const submitStoryPin = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createStoryPin.mutateAsync({
        countryId,
        title: storyPinForm.title,
        coordinates: pendingCoordinates,
        content: storyPinForm.content,
        ixTimeYear: storyPinForm.ixTimeYear,
        category: storyPinForm.category as any,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create story pin");
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
        category: storyPinForm.category as any,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update story pin");
    }
  }, [countryId, selectedFeature, storyPinForm, updateStoryPin, onSuccess, setMutationError]);

  const submitMapLabel = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createMapLabel.mutateAsync({
        countryId,
        text: mapLabelForm.text,
        labelType: mapLabelForm.labelType as any,
        coordinates: pendingCoordinates,
        fontSize: mapLabelForm.fontSize,
        color: mapLabelForm.color,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create map label");
    }
  }, [countryId, pendingCoordinates, mapLabelForm, createMapLabel, onSuccess, setMutationError]);

  const submitEditMapLabel = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateMapLabel.mutateAsync({
        countryId,
        labelId: selectedFeature.id,
        text: mapLabelForm.text,
        labelType: mapLabelForm.labelType as any,
        coordinates: selectedFeature.coordinates!,
        fontSize: mapLabelForm.fontSize,
        color: mapLabelForm.color,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update map label");
    }
  }, [countryId, selectedFeature, mapLabelForm, updateMapLabel, onSuccess, setMutationError]);

  const submitPeak = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createPeak.mutateAsync({
        countryId,
        name: peakForm.name,
        elevation: peakForm.elevation,
        coordinates: pendingCoordinates,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create peak");
    }
  }, [countryId, pendingCoordinates, peakForm, createPeak, onSuccess, setMutationError]);

  const submitEditPeak = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updatePeak.mutateAsync({
        countryId,
        peakId: selectedFeature.id,
        name: peakForm.name,
        elevation: peakForm.elevation,
        coordinates: selectedFeature.coordinates!,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update peak");
    }
  }, [countryId, selectedFeature, peakForm, updatePeak, onSuccess, setMutationError]);

  const submitRiver = useCallback(async () => {
    if (!countryId || !pendingGeometry) return;
    try {
      await createNamedRiver.mutateAsync({
        countryId,
        name: riverForm.name,
        geometry: pendingGeometry as any,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create river");
    }
  }, [countryId, pendingGeometry, riverForm, createNamedRiver, onSuccess, setMutationError]);

  const submitEditRiver = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateNamedRiver.mutateAsync({
        countryId,
        riverId: selectedFeature.id,
        name: riverForm.name,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update river");
    }
  }, [countryId, selectedFeature, riverForm, updateNamedRiver, onSuccess, setMutationError]);

  const submitLake = useCallback(async () => {
    if (!countryId || !pendingGeometry) return;
    try {
      await createNamedLake.mutateAsync({
        countryId,
        name: lakeForm.name,
        geometry: pendingGeometry as any,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create lake");
    }
  }, [countryId, pendingGeometry, lakeForm, createNamedLake, onSuccess, setMutationError]);

  const submitEditLake = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateNamedLake.mutateAsync({
        countryId,
        lakeId: selectedFeature.id,
        name: lakeForm.name,
      });
      onSuccess();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update lake");
    }
  }, [countryId, selectedFeature, lakeForm, updateNamedLake, onSuccess, setMutationError]);

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
        onSuccess();
      } catch (e: any) {
        setMutationError(e.message || "Failed to delete feature");
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
