"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "~/trpc/react";
import type {
  EditorMode,
  EditorFeature,
  CityFormData,
  POIFormData,
  StoryPinFormData,
  MapLabelFormData,
  PeakFormData,
} from "./editor-types";
import type { useMapHistory } from "./useMapHistory";

interface UsePointFeatureEditorProps {
  countryId?: string;
  isWorldMode?: boolean;
  history: ReturnType<typeof useMapHistory>;
  refetchFeatures: () => void;
}

export function usePointFeatureEditor({
  countryId,
  isWorldMode,
  history,
  refetchFeatures,
}: UsePointFeatureEditorProps) {
  const utils = api.useUtils();

  // Point Form States
  const [cityForm, setCityForm] = useState<CityFormData>({
    name: "",
    cityType: "city",
    isNationalCapital: false,
    isSubdivisionCapital: false,
  });

  const [poiForm, setPOIForm] = useState<POIFormData>({
    name: "",
    category: "landmark",
  });

  const [storyPinForm, setStoryPinForm] = useState<StoryPinFormData>({
    title: "",
    content: "",
    contentFormat: "markdown",
    category: "cultural",
    importance: 3,
  });

  const [mapLabelForm, setMapLabelForm] = useState<MapLabelFormData>({
    text: "",
    labelType: "geographic",
    fontSize: 14,
    color: "#333333",
    rotation: 0,
    letterSpacing: 0,
    fontWeight: "normal",
    opacity: 1.0,
    minZoom: 0,
    maxZoom: 24,
  });

  const [peakForm, setPeakForm] = useState<PeakFormData>({
    name: "",
    elevation: 1000,
  });

  // tRPC Mutations
  const upsertCityMut = api.countryGeo.upsertCity.useMutation();
  const deleteCityMut = api.geoFeatures.deleteCity.useMutation();
  const upsertPoiMut = api.countryGeo.upsertPoi.useMutation();
  const deletePoiMut = api.geoFeatures.deletePOI.useMutation();
  const upsertStoryPinMut = api.countryGeo.upsertStoryPin.useMutation();
  const deleteStoryPinMut = api.geoFeatures.deleteStoryPin.useMutation();
  const upsertMapLabelMut = api.countryGeo.upsertMapLabel.useMutation();
  const deleteMapLabelMut = api.geoFeatures.deleteMapLabel.useMutation();
  const upsertPeakMut = api.geoFeatures.createPeak.useMutation();
  const deletePeakMut = api.geoFeatures.deletePeak.useMutation();

  const isMutating =
    upsertCityMut.isPending ||
    deleteCityMut.isPending ||
    upsertPoiMut.isPending ||
    deletePoiMut.isPending ||
    upsertStoryPinMut.isPending ||
    deleteStoryPinMut.isPending ||
    upsertMapLabelMut.isPending ||
    deleteMapLabelMut.isPending ||
    upsertPeakMut.isPending ||
    deletePeakMut.isPending;

  const resetPointForms = useCallback(() => {
    setCityForm({ name: "", cityType: "city", isNationalCapital: false, isSubdivisionCapital: false });
    setPOIForm({ name: "", category: "landmark" });
    setStoryPinForm({ title: "", content: "", contentFormat: "markdown", category: "cultural", importance: 3 });
    setMapLabelForm({ text: "", labelType: "geographic", fontSize: 14, color: "#333333", rotation: 0, letterSpacing: 0, fontWeight: "normal", opacity: 1.0, minZoom: 0, maxZoom: 24 });
    setPeakForm({ name: "", elevation: 1000 });
  }, []);

  const populatePointForm = useCallback((feature: EditorFeature) => {
    const p = feature.properties ?? {};
    switch (feature.type) {
      case "city":
        setCityForm({
          name: feature.name,
          cityType: p.cityType ?? "city",
          population: p.population,
          isNationalCapital: p.isNationalCapital ?? false,
          isSubdivisionCapital: p.isSubdivisionCapital ?? false,
          subdivisionId: p.subdivisionId,
          wikiPageTitle: p.wikiPageTitle,
          elevation: p.elevation,
          foundedYear: p.foundedYear,
          coordinates: feature.coordinates,
        });
        break;
      case "poi":
        setPOIForm({
          name: feature.name,
          category: p.category ?? "landmark",
          description: p.description,
          icon: p.icon,
          wikiPageTitle: p.wikiPageTitle,
          subdivisionId: p.subdivisionId,
          coordinates: feature.coordinates,
        });
        break;
      case "storyPin":
        setStoryPinForm({
          title: feature.name,
          content: p.content ?? "",
          contentFormat: p.contentFormat ?? "markdown",
          category: p.category ?? "cultural",
          importance: p.importance ?? 3,
          ixTimeYear: p.ixTimeYear,
          eraLabel: p.eraLabel,
          wikiPageTitle: p.wikiPageTitle,
          photos: p.photos,
          thumbnailUrl: p.thumbnailUrl,
          storylineId: p.storylineId,
          storylineOrder: p.storylineOrder,
          coordinates: feature.coordinates,
        });
        break;
      case "mapLabel":
        setMapLabelForm({
          text: feature.name,
          labelType: p.labelType ?? "geographic",
          fontSize: p.fontSize ?? 14,
          color: p.color ?? "#333333",
          rotation: p.rotation ?? 0,
          letterSpacing: p.letterSpacing ?? 0,
          fontWeight: p.fontWeight ?? "normal",
          opacity: p.opacity ?? 1.0,
          minZoom: p.minZoom ?? 0,
          maxZoom: p.maxZoom ?? 24,
          wikiPageTitle: p.wikiPageTitle,
          coordinates: feature.coordinates,
        });
        break;
      case "peak":
        setPeakForm({
          name: feature.name,
          elevation: p.elevation ?? 1000,
          prominence: p.prominence,
          subdivisionId: p.subdivisionId,
          wikiPageTitle: p.wikiPageTitle,
          coordinates: feature.coordinates,
        });
        break;
    }
  }, []);

  return {
    cityForm,
    setCityForm,
    poiForm,
    setPOIForm,
    storyPinForm,
    setStoryPinForm,
    mapLabelForm,
    setMapLabelForm,
    peakForm,
    setPeakForm,
    isMutating,
    resetPointForms,
    populatePointForm,
    upsertCityMut,
    deleteCityMut,
    upsertPoiMut,
    deletePoiMut,
    upsertStoryPinMut,
    deleteStoryPinMut,
    upsertMapLabelMut,
    deleteMapLabelMut,
    upsertPeakMut,
    deletePeakMut,
  };
}
