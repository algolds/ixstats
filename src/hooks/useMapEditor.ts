"use client";

/**
 * useMapEditor - State management hook for the MyCountry map editor.
 *
 * Handles editing mode, feature CRUD, and drawing state.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { api } from "~/trpc/react";

export type EditorMode = "view" | "add-city" | "add-subdivision" | "add-poi" | "edit-city" | "edit-subdivision" | "edit-poi";

export type FeatureType = "city" | "subdivision" | "poi";

export interface EditorFeature {
  id: string;
  type: FeatureType;
  name: string;
  coordinates?: [number, number];
  geometry?: object;
  properties: Record<string, unknown>;
}

export interface CityFormData {
  name: string;
  cityType: string;
  population?: number;
  isNationalCapital: boolean;
  isSubdivisionCapital: boolean;
  subdivisionId?: string;
  wikiPageTitle?: string;
}

export interface SubdivisionFormData {
  name: string;
  type: string;
  level: number;
  capital?: string;
  population?: number;
}

export interface POIFormData {
  name: string;
  category: string;
  description?: string;
  icon?: string;
  wikiPageTitle?: string;
}

const DEFAULT_CITY: CityFormData = {
  name: "",
  cityType: "city",
  population: undefined,
  isNationalCapital: false,
  isSubdivisionCapital: false,
};

const DEFAULT_SUBDIVISION: SubdivisionFormData = {
  name: "",
  type: "province",
  level: 1,
};

const DEFAULT_POI: POIFormData = {
  name: "",
  category: "landmark",
  description: "",
};

export function useMapEditor(countryId: string | undefined) {
  const utils = api.useUtils();
  const [mode, setMode] = useState<EditorMode>("view");
  const [selectedFeature, setSelectedFeature] = useState<EditorFeature | null>(null);
  const [pendingCoordinates, setPendingCoordinates] = useState<[number, number] | null>(null);
  const [pendingGeometry, setPendingGeometry] = useState<object | null>(null);
  const [cityForm, setCityForm] = useState<CityFormData>(DEFAULT_CITY);
  const [subdivisionForm, setSubdivisionForm] = useState<SubdivisionFormData>(DEFAULT_SUBDIVISION);
  const [poiForm, setPOIForm] = useState<POIFormData>(DEFAULT_POI);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const lastSavedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch country features
  const {
    data: features,
    isLoading: featuresLoading,
    refetch: refetchFeatures,
  } = api.geo.getCountryFeatures.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  // Check if country is linked to a map feature (non-throwing)
  const { data: linkage } = api.geo.getCountryLinkage.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 5 * 60_000 }
  );

  // Fetch country geometry (boundary for display + validation) — only if linked
  const { data: countryGeo } = api.geo.getCountryGeometry.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId && !!linkage?.isLinked, staleTime: 5 * 60_000 }
  );

  // Fetch terrain info at the pending click point
  const { data: pendingPointInfo, isLoading: isPendingPointInfoLoading } =
    api.geo.getPointInfo.useQuery(
      { lng: pendingCoordinates?.[0] ?? 0, lat: pendingCoordinates?.[1] ?? 0 },
      { enabled: !!pendingCoordinates, staleTime: 60_000 }
    );

  // Mutations
  const createCity = api.geo.createCity.useMutation({
    onSuccess: () => {
      refetchFeatures();
      utils.geo.getCapitalCities.invalidate();
      continuePlacing("add-city");
    },
  });

  const updateCity = api.geo.updateCity.useMutation({
    onSuccess: () => {
      refetchFeatures();
      resetForm();
    },
  });

  const deleteCity = api.geo.deleteCity.useMutation({
    onSuccess: () => {
      refetchFeatures();
      utils.geo.getCapitalCities.invalidate();
      setSelectedFeature(null);
    },
  });

  const createSubdivision = api.geo.createSubdivision.useMutation({
    onSuccess: () => {
      refetchFeatures();
      continuePlacing("add-subdivision");
    },
  });

  const updateSubdivision = api.geo.updateSubdivision.useMutation({
    onSuccess: () => {
      refetchFeatures();
      resetForm();
    },
  });

  const deleteSubdivision = api.geo.deleteSubdivision.useMutation({
    onSuccess: () => {
      refetchFeatures();
      setSelectedFeature(null);
    },
  });

  const createPOI = api.geo.createPOI.useMutation({
    onSuccess: () => {
      refetchFeatures();
      continuePlacing("add-poi");
    },
  });

  const updatePOI = api.geo.updatePOI.useMutation({
    onSuccess: () => {
      refetchFeatures();
      resetForm();
    },
  });

  const deletePOI = api.geo.deletePOI.useMutation({
    onSuccess: () => {
      refetchFeatures();
      setSelectedFeature(null);
    },
  });

  const resetForm = useCallback(() => {
    setMode("view");
    setSelectedFeature(null);
    setPendingCoordinates(null);
    setPendingGeometry(null);
    setCityForm(DEFAULT_CITY);
    setSubdivisionForm(DEFAULT_SUBDIVISION);
    setPOIForm(DEFAULT_POI);
    setLastSavedAt(null);
  }, []);

  /** After a successful save, stay in the same add mode and clear only location + name. */
  const continuePlacing = useCallback((currentMode: EditorMode) => {
    setPendingCoordinates(null);
    setPendingGeometry(null);
    setSelectedFeature(null);
    // Clear name but preserve type/category settings
    if (currentMode === "add-city") {
      setCityForm((prev) => ({ ...prev, name: "", population: undefined, wikiPageTitle: undefined }));
    } else if (currentMode === "add-subdivision") {
      setSubdivisionForm((prev) => ({ ...prev, name: "", population: undefined }));
    } else if (currentMode === "add-poi") {
      setPOIForm((prev) => ({ ...prev, name: "", description: "", wikiPageTitle: undefined }));
    }
    // Flash "saved" indicator
    setLastSavedAt(Date.now());
    if (lastSavedTimerRef.current) clearTimeout(lastSavedTimerRef.current);
    lastSavedTimerRef.current = setTimeout(() => setLastSavedAt(null), 2000);
  }, []);

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (mode === "add-city" || mode === "add-poi") {
        setPendingCoordinates([lng, lat]);
      }
    },
    [mode]
  );

  const handleDrawComplete = useCallback(
    (geometry: object) => {
      if (mode === "add-subdivision") {
        setPendingGeometry(geometry);
      }
    },
    [mode]
  );

  // Submit handlers
  const submitCity = useCallback(async () => {
    if (!countryId || !pendingCoordinates || !cityForm.name.trim()) return;
    await createCity.mutateAsync({
      countryId,
      name: cityForm.name.trim(),
      cityType: cityForm.cityType,
      coordinates: pendingCoordinates,
      population: cityForm.population,
      isNationalCapital: cityForm.isNationalCapital,
      isSubdivisionCapital: cityForm.isSubdivisionCapital,
      subdivisionId: cityForm.subdivisionId,
      wikiPageTitle: cityForm.wikiPageTitle,
    });
  }, [countryId, pendingCoordinates, cityForm, createCity]);

  const submitSubdivision = useCallback(async () => {
    if (!countryId || !pendingGeometry || !subdivisionForm.name.trim()) return;
    await createSubdivision.mutateAsync({
      countryId,
      name: subdivisionForm.name.trim(),
      type: subdivisionForm.type,
      level: subdivisionForm.level,
      geometry: pendingGeometry,
      capital: subdivisionForm.capital,
      population: subdivisionForm.population,
    });
  }, [countryId, pendingGeometry, subdivisionForm, createSubdivision]);

  const submitPOI = useCallback(async () => {
    if (!countryId || !pendingCoordinates || !poiForm.name.trim()) return;
    await createPOI.mutateAsync({
      countryId,
      name: poiForm.name.trim(),
      category: poiForm.category,
      coordinates: pendingCoordinates,
      description: poiForm.description,
      icon: poiForm.icon,
      wikiPageTitle: poiForm.wikiPageTitle,
    });
  }, [countryId, pendingCoordinates, poiForm, createPOI]);

  /** Enter edit mode for an existing feature, populating the appropriate form. */
  const startEditing = useCallback(
    (feature: EditorFeature) => {
      setSelectedFeature(feature);
      setLastSavedAt(null);

      switch (feature.type) {
        case "city":
          setMode("edit-city");
          setCityForm({
            name: feature.name,
            cityType: (feature.properties.cityType as string) ?? "city",
            population: (feature.properties.population as number | undefined) ?? undefined,
            isNationalCapital: !!feature.properties.isNationalCapital,
            isSubdivisionCapital: !!feature.properties.isSubdivisionCapital,
            subdivisionId: (feature.properties.subdivisionId as string | undefined) ?? undefined,
            wikiPageTitle: (feature.properties.wikiPageTitle as string | undefined) ?? undefined,
          });
          break;
        case "subdivision":
          setMode("edit-subdivision");
          setSubdivisionForm({
            name: feature.name,
            type: (feature.properties.type as string) ?? "province",
            level: (feature.properties.level as number) ?? 1,
            capital: (feature.properties.capital as string | undefined) ?? undefined,
            population: (feature.properties.population as number | undefined) ?? undefined,
          });
          break;
        case "poi":
          setMode("edit-poi");
          setPOIForm({
            name: feature.name,
            category: (feature.properties.category as string) ?? "landmark",
            description: (feature.properties.description as string | undefined) ?? undefined,
            icon: (feature.properties.icon as string | undefined) ?? undefined,
            wikiPageTitle: (feature.properties.wikiPageTitle as string | undefined) ?? undefined,
          });
          break;
      }
    },
    []
  );

  const submitEditCity = useCallback(async () => {
    if (!countryId || !selectedFeature || !cityForm.name.trim()) return;
    await updateCity.mutateAsync({
      countryId,
      cityId: selectedFeature.id,
      name: cityForm.name.trim(),
      cityType: cityForm.cityType,
      population: cityForm.population,
      isNationalCapital: cityForm.isNationalCapital,
      isSubdivisionCapital: cityForm.isSubdivisionCapital,
      wikiPageTitle: cityForm.wikiPageTitle ?? null,
    });
  }, [countryId, selectedFeature, cityForm, updateCity]);

  const submitEditSubdivision = useCallback(async () => {
    if (!countryId || !selectedFeature || !subdivisionForm.name.trim()) return;
    await updateSubdivision.mutateAsync({
      countryId,
      subdivisionId: selectedFeature.id,
      name: subdivisionForm.name.trim(),
      type: subdivisionForm.type,
      level: subdivisionForm.level,
      capital: subdivisionForm.capital,
      population: subdivisionForm.population,
    });
  }, [countryId, selectedFeature, subdivisionForm, updateSubdivision]);

  const submitEditPOI = useCallback(async () => {
    if (!countryId || !selectedFeature || !poiForm.name.trim()) return;
    await updatePOI.mutateAsync({
      countryId,
      poiId: selectedFeature.id,
      name: poiForm.name.trim(),
      category: poiForm.category,
      description: poiForm.description,
      icon: poiForm.icon,
      wikiPageTitle: poiForm.wikiPageTitle ?? null,
    });
  }, [countryId, selectedFeature, poiForm, updatePOI]);

  const handleDeleteFeature = useCallback(
    async (feature: EditorFeature) => {
      if (!countryId) return;
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
      }
    },
    [countryId, deleteCity, deleteSubdivision, deletePOI]
  );

  // Combined feature list for display
  const allFeatures: EditorFeature[] = useMemo(() => {
    if (!features) return [];
    const list: EditorFeature[] = [];

    for (const city of features.cities ?? []) {
      list.push({
        id: city.id,
        type: "city",
        name: city.name,
        coordinates: city.coordinates as [number, number] | undefined,
        properties: {
          cityType: city.type,
          population: city.population,
          isNationalCapital: city.isNationalCapital,
          isSubdivisionCapital: city.isSubdivisionCapital,
          wikiPageTitle: city.wikiPageTitle,
        },
      });
    }

    for (const sub of features.subdivisions ?? []) {
      list.push({
        id: sub.id,
        type: "subdivision",
        name: sub.name,
        geometry: sub.geometry as object | undefined,
        properties: {
          type: sub.type,
          level: sub.level,
          capital: sub.capital,
          population: sub.population,
          areaSqKm: sub.areaSqKm,
        },
      });
    }

    for (const poi of features.pois ?? []) {
      list.push({
        id: poi.id,
        type: "poi",
        name: poi.name,
        coordinates: poi.coordinates as [number, number] | undefined,
        properties: {
          category: poi.category,
          description: poi.description,
          icon: poi.icon,
          wikiPageTitle: poi.wikiPageTitle,
        },
      });
    }

    return list;
  }, [features]);

  const isMutating =
    createCity.isPending ||
    updateCity.isPending ||
    deleteCity.isPending ||
    createSubdivision.isPending ||
    updateSubdivision.isPending ||
    deleteSubdivision.isPending ||
    createPOI.isPending ||
    updatePOI.isPending ||
    deletePOI.isPending;

  const mutationError =
    createCity.error ||
    updateCity.error ||
    deleteCity.error ||
    createSubdivision.error ||
    updateSubdivision.error ||
    deleteSubdivision.error ||
    createPOI.error ||
    updatePOI.error ||
    deletePOI.error;

  return {
    // State
    mode,
    setMode,
    selectedFeature,
    setSelectedFeature,
    pendingCoordinates,
    pendingGeometry,

    // Forms
    cityForm,
    setCityForm,
    subdivisionForm,
    setSubdivisionForm,
    poiForm,
    setPOIForm,

    // Data
    features,
    allFeatures,
    countryGeo,
    linkage,
    featuresLoading,
    pendingPointInfo,
    isPendingPointInfoLoading,

    // Actions
    handleMapClick,
    handleDrawComplete,
    submitCity,
    submitSubdivision,
    submitPOI,
    handleDeleteFeature,
    resetForm,
    startEditing,
    submitEditCity,
    submitEditSubdivision,
    submitEditPOI,

    // Mutation state
    isMutating,
    mutationError,
    lastSavedAt,
  };
}
