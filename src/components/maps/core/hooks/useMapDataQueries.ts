import { useEffect, useMemo, useRef } from "react";
import { api } from "~/trpc/react";
import { useMapDataBatched } from "~/hooks/useMapDataBatched";
import type { MapLayerType } from "~/lib/maps/map-config";
import type { RouterOutputs } from "~/trpc/react";
import type { SelectedCountry, IxWorldMapRef } from "../IxWorldMap";

type ChoroplethMetric = "gdpPerCapita" | "population" | "vitality" | "health" | "tradeBalance";

const useChoropleth = (realm: string | undefined, metric: ChoroplethMetric, enabled?: boolean) =>
  api.geoCore.getRegionalChoropleth.useQuery(
    { metric, groupBy: "country", realm },
    { staleTime: 5 * 60_000, gcTime: 30 * 60_000, enabled: !!enabled }
  );

type CountryGeo = NonNullable<RouterOutputs["geoCore"]["getCountryGeometry"]>;

/** Select a country from its fetched geometry and fly the camera to its bounds (or centroid). */
function focusCountry(
  geo: CountryGeo,
  map: IxWorldMapRef,
  setSelectedCountry: (country: SelectedCountry | null) => void,
  onCountrySelect?: (country: SelectedCountry | null) => void
) {
  const country: SelectedCountry = {
    featureId: geo.featureId,
    displayName: geo.displayName,
    fillColor: "#e8e5da",
    centroidLng: geo.centroid?.lng ?? 0,
    centroidLat: geo.centroid?.lat ?? 0,
    countryId: geo.country?.id ?? null,
  };
  setSelectedCountry(country);
  onCountrySelect?.(country);

  const { bbox, centroid } = geo;
  if (bbox) map.flyTo((bbox.minLng + bbox.maxLng) / 2, (bbox.minLat + bbox.maxLat) / 2, 4);
  else if (centroid) map.flyTo(centroid.lng, centroid.lat, 4);
}

interface UseMapDataQueriesProps {
  /** Realm slug the map shows (`?realm=`); undefined = the viewer's realm */
  realm?: string;
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
}

export function useMapDataQueries({
  realm,
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
}: UseMapDataQueriesProps) {
  const {
    mapLayers,
    toggleLayer,
    visibleLayers,
    isLoading,
    error,
    overlayFeatures: batchedOverlayFeatures,
    capitalsGeoJson: batchedCapitalsGeoJson,
    realmId,
  } = useMapDataBatched(initialLayers, currentZoom, realm);

  const cacheOpts = { staleTime: 5 * 60_000, gcTime: 30 * 60_000 };
  const { data: storyPinsGeoJson } = api.geoFeatures.getAllStoryPins.useQuery(
    { realm },
    { ...cacheOpts, enabled: mapEngineReady }
  );
  const { data: mapLabelsGeoJson } = api.geoFeatures.getAllMapLabels.useQuery(
    { realm },
    { ...cacheOpts, enabled: mapEngineReady }
  );
  const { data: topCountryNames } = api.countries.getTopCountriesByImportance.useQuery(
    { limit: 25, realm },
    { ...cacheOpts, enabled: mapEngineReady }
  );

  const { data: initialGeo, isLoading: isInitialGeoLoading } =
    api.geoCore.getCountryGeometry.useQuery(
      { countryId: initialCountryId! },
      { enabled: !!initialCountryId, staleTime: 30 * 60_000 }
    );

  const isPreloading = isLoading || (!!initialCountryId && isInitialGeoLoading);

  useEffect(() => {
    if (isPreloading || mapEngineReady) return;

    const timer = setTimeout(() => setMapLoadTimeout(true), 8000);

    return () => clearTimeout(timer);
  }, [isPreloading, mapEngineReady, setMapLoadTimeout]);

  const overlayFeatures = useMemo(() => {
    if (!batchedOverlayFeatures) return undefined;
    return {
      ...batchedOverlayFeatures,
      storyPins: storyPinsGeoJson ?? undefined,
      mapLabels: mapLabelsGeoJson ?? undefined,
    };
  }, [batchedOverlayFeatures, storyPinsGeoJson, mapLabelsGeoJson]);

  const topCountrySet = useMemo(() => new Set(topCountryNames ?? []), [topCountryNames]);

  const deepLinkFiredRef = useRef(false);
  useEffect(() => {
    if (!initialCountryId || !initialGeo || deepLinkFiredRef.current) return;
    if (!mapRef.current) return;

    deepLinkFiredRef.current = true;
    focusCountry(initialGeo, mapRef.current, setSelectedCountry, onCountrySelect);
  }, [initialCountryId, initialGeo, onCountrySelect, mapRef, setSelectedCountry]);

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

    focusCountry(selectedGeo, mapRef.current, setSelectedCountry, onCountrySelect);
  }, [
    selectedCountryId,
    selectedGeo,
    onCountrySelect,
    selectedCountry,
    mapRef,
    setSelectedCountry,
  ]);

  const { data: wealthData } = useChoropleth(realm, "gdpPerCapita", overlayVisibility.wealth);
  const { data: populationData } = useChoropleth(realm, "population", overlayVisibility.population);
  const { data: economicTierData } = useChoropleth(
    realm,
    "gdpPerCapita",
    overlayVisibility.economicTier
  );
  const { data: vitalityData } = useChoropleth(realm, "vitality", overlayVisibility.vitality);
  const { data: healthData } = useChoropleth(realm, "health", overlayVisibility.health);
  const { data: tradeBalanceData } = useChoropleth(
    realm,
    "tradeBalance",
    overlayVisibility.tradeBalance
  );
  const { data: crisisData } = api.geoCore.getCrisisRiskMap.useQuery(
    { realm },
    { ...cacheOpts, enabled: overlayVisibility.crises }
  );
  const { data: diplomacyData } = api.geoCore.getGeopoliticalOverlay.useQuery(
    { realm },
    { ...cacheOpts, enabled: overlayVisibility.diplomacy }
  );
  const { data: transportData } = api.transport.getAllRoutesGeoJSON.useQuery(
    { realm },
    { ...cacheOpts, enabled: overlayVisibility.transport }
  );
  const { data: canonDensityData } = api.geoCore.getCanonDensity.useQuery(
    { realm },
    { ...cacheOpts, enabled: !!overlayVisibility.canonDensity }
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
      health: healthData ?? undefined,
      tradeBalance: tradeBalanceData ?? undefined,
      canonDensity: canonDensityData ?? undefined,
    }),
    [
      wealthData,
      populationData,
      crisisData,
      diplomacyData,
      transportData,
      economicTierData,
      vitalityData,
      healthData,
      tradeBalanceData,
      canonDensityData,
    ]
  );

  return {
    mapLayers,
    toggleLayer,
    visibleLayers,
    overlayFeatures,
    capitalsGeoJson: batchedCapitalsGeoJson,
    topCountrySet,
    isPreloading,
    overlayData,
    error,
    realmId,
  };
}
