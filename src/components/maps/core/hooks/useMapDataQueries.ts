// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect, useMemo, useRef } from "react";
import { api } from "~/trpc/react";
import { useMapDataBatched } from "~/hooks/useMapDataBatched";
import type { MapLayerType } from "~/lib/maps/map-config";
import type { SelectedCountry } from "../IxWorldMap";

interface UseMapDataQueriesProps {
  initialLayers?: MapLayerType[];
  currentZoom?: number;
  initialCountryId?: string;
  selectedCountryId?: string | null;
  overlayVisibility: Record<string, boolean>;
  mapEngineReady: boolean;
  setMapLoadTimeout: (timeout: boolean) => void;
  mapRef: React.RefObject<any>;
  setSelectedCountry: (country: SelectedCountry | null) => void;
  onCountrySelect?: (country: SelectedCountry | null) => void;
  selectedCountry: SelectedCountry | null;
  userCountryId: string | null;
}

export function useMapDataQueries({
  initialLayers,
  currentZoom,
  initialCountryId,
  selectedCountryId,
  overlayVisibility,
  mapEngineReady,
  setMapLoadTimeout,
  mapRef,
  setSelectedCountry,
  onCountrySelect,
  selectedCountry,
  userCountryId,
}: UseMapDataQueriesProps) {
  // 2. Fetch Map Data Batched
  const {
    mapLayers,
    toggleLayer,
    visibleLayers,
    isLoading,
    error,
    overlayFeatures: batchedOverlayFeatures,
    capitalsGeoJson: batchedCapitalsGeoJson,
  } = useMapDataBatched(initialLayers, currentZoom);

  // 3. Story Pins and Labels queries
  const { data: storyPinsGeoJson, isLoading: isStoryPinsLoading } =
    api.geoFeatures.getAllStoryPins.useQuery(undefined, {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      enabled: mapEngineReady,
    });
  const { data: mapLabelsGeoJson, isLoading: isMapLabelsLoading } =
    api.geoFeatures.getAllMapLabels.useQuery(undefined, {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      enabled: mapEngineReady,
    });

  // 4. Top-25 countries
  const { data: topCountryNames, isLoading: isTopCountriesLoading } =
    api.countries.getTopCountriesByImportance.useQuery(
      { limit: 25 },
      { staleTime: 5 * 60_000, gcTime: 30 * 60_000, enabled: mapEngineReady }
    );

  // 5. Deep link country geometry
  const { data: initialGeo, isLoading: isInitialGeoLoading } =
    api.geoCore.getCountryGeometry.useQuery(
      { countryId: initialCountryId! },
      { enabled: !!initialCountryId, staleTime: 30 * 60_000 }
    );

  const isPreloading = isLoading || (!!initialCountryId && isInitialGeoLoading);

  // 6. Map Load Timeout detection
  useEffect(() => {
    if (isPreloading || mapEngineReady) return;

    const timer = setTimeout(() => {
      if (!mapEngineReady) {
        setMapLoadTimeout(true);
      }
    }, 8000);

    return () => clearTimeout(timer);
  }, [isPreloading, mapEngineReady, setMapLoadTimeout]);

  // 7. Core map layers & capitals aggregation
  const overlayFeatures = useMemo(() => {
    if (!batchedOverlayFeatures) return undefined;
    return {
      ...batchedOverlayFeatures,
      storyPins: storyPinsGeoJson ?? undefined,
      mapLabels: mapLabelsGeoJson ?? undefined,
    };
  }, [batchedOverlayFeatures, storyPinsGeoJson, mapLabelsGeoJson]);

  const capitalsGeoJson = batchedCapitalsGeoJson;
  const topCountrySet = useMemo(() => new Set(topCountryNames ?? []), [topCountryNames]);

  // 8. Deep-link country positioning effect
  const deepLinkFiredRef = useRef(false);
  useEffect(() => {
    if (!initialCountryId || !initialGeo || deepLinkFiredRef.current) return;
    if (!mapRef.current) return;

    deepLinkFiredRef.current = true;
    const country: SelectedCountry = {
      featureId: initialGeo.featureId,
      displayName: initialGeo.displayName,
      fillColor: "#e8e5da",
      centroidLng: initialGeo.centroid?.lng ?? 0,
      centroidLat: initialGeo.centroid?.lat ?? 0,
      countryId: initialGeo.country?.id ?? null,
    };
    setSelectedCountry(country);
    onCountrySelect?.(country);

    if (initialGeo.bbox) {
      const b = initialGeo.bbox;
      mapRef.current.flyTo((b.minLng + b.maxLng) / 2, (b.minLat + b.maxLat) / 2, 4);
    } else if (initialGeo.centroid) {
      mapRef.current.flyTo(initialGeo.centroid.lng, initialGeo.centroid.lat, 4);
    }
  }, [initialCountryId, initialGeo, onCountrySelect, mapRef, setSelectedCountry]);

  // 9. Controlled selectedCountryId effect
  const { data: selectedGeo } = api.geoCore.getCountryGeometry.useQuery(
    { countryId: selectedCountryId! },
    { enabled: !!selectedCountryId, staleTime: 30 * 60_000 }
  );

  useEffect(() => {
    if (selectedCountryId === null) {
      if (selectedCountry?.countryId) {
        setSelectedCountry(null);
        onCountrySelect?.(null);
      }
      return;
    }

    if (!selectedCountryId || !selectedGeo || !mapRef.current) return;
    if (selectedCountry?.countryId === selectedCountryId) return;

    const country: SelectedCountry = {
      featureId: selectedGeo.featureId,
      displayName: selectedGeo.displayName,
      fillColor: "#e8e5da",
      centroidLng: selectedGeo.centroid?.lng ?? 0,
      centroidLat: selectedGeo.centroid?.lat ?? 0,
      countryId: selectedGeo.country?.id ?? null,
    };
    setSelectedCountry(country);
    onCountrySelect?.(country);

    if (selectedGeo.bbox) {
      const b = selectedGeo.bbox;
      mapRef.current.flyTo((b.minLng + b.maxLng) / 2, (b.minLat + b.maxLat) / 2, 4);
    } else if (selectedGeo.centroid) {
      mapRef.current.flyTo(selectedGeo.centroid.lng, selectedGeo.centroid.lat, 4);
    }
  }, [
    selectedCountryId,
    selectedGeo,
    onCountrySelect,
    selectedCountry,
    mapRef,
    setSelectedCountry,
  ]);

  // 10. Fetch Optional Data-Visualizations (Choropleths and Routes)
  const { data: wealthData } = api.geoCore.getRegionalChoropleth.useQuery(
    { metric: "gdpPerCapita", groupBy: "country" },
    { enabled: overlayVisibility.wealth, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const { data: populationData } = api.geoCore.getRegionalChoropleth.useQuery(
    { metric: "population", groupBy: "country" },
    { enabled: overlayVisibility.population, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const { data: crisisData } = api.geoCore.getCrisisRiskMap.useQuery(
    {},
    { enabled: overlayVisibility.crises, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const { data: diplomacyData } = api.geoCore.getGeopoliticalOverlay.useQuery(undefined, {
    enabled: overlayVisibility.diplomacy,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const { data: transportData } = api.transport.getAllRoutesGeoJSON.useQuery(
    {},
    { enabled: overlayVisibility.transport, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const { data: economicTierData } = api.geoCore.getRegionalChoropleth.useQuery(
    { metric: "gdpPerCapita", groupBy: "country" },
    { enabled: overlayVisibility.economicTier, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const { data: vitalityData } = api.geoCore.getRegionalChoropleth.useQuery(
    { metric: "vitality", groupBy: "country" },
    { enabled: overlayVisibility.vitality, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );

  const overlayData = useMemo(
    () => ({
      wealth: wealthData ?? undefined,
      population: populationData ?? undefined,
      crises: crisisData ?? undefined,
      diplomacy: diplomacyData
        ? {
            relations: diplomacyData.relations,
            conflicts: diplomacyData.conflicts,
          }
        : undefined,
      transport: transportData ?? undefined,
      economicTier: economicTierData ?? undefined,
      vitality: vitalityData ?? undefined,
    }),
    [
      wealthData,
      populationData,
      crisisData,
      diplomacyData,
      transportData,
      economicTierData,
      vitalityData,
    ]
  );

  return {
    userCountryId,
    mapLayers,
    toggleLayer,
    visibleLayers,
    overlayFeatures,
    capitalsGeoJson,
    topCountrySet,
    isPreloading,
    overlayData,
    error,
  };
}
