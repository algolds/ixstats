import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type {
  SelectedCountry,
  SelectedFeature,
  HoveredCountry,
  IxWorldMapRef,
  NeighborTarget,
  OverlayVisibility,
} from "../IxWorldMap";
import type { ProjectionMode } from "~/lib/maps/map-config";
import { buildDefaultVisibility, applyOverlayToggle } from "~/lib/maps/overlay-registry";

interface UseMapStateProps {
  userCountryId: string | null;
  onCountrySelect?: (country: SelectedCountry | null) => void;
  mapRef: React.RefObject<any>;
  /**
   * Returns the loaded map layers at call time. A getter (backed by a ref in MapContainer)
   * because the layers are fetched after this hook runs; passing them by value handed the
   * pin tool and neighbour lookup an empty list.
   */
  getMapLayers: () => Array<{ type: string; data: any }>;
  isPinToolActive: boolean;
  pinPosition: any;
  dropPin: (lng: number, lat: number, layerDataMap: any) => void;
  clearPin: () => void;
}

const DEFAULT_COUNTRY_FILL = "#e8e5da";

const SEARCH_RESULT_ZOOM: Record<string, number> = { country: 4, subdivision: 6 };

const toSelectedCountry = (
  featureId: string,
  displayName: string,
  countryId: string | null,
  centroidLng: number,
  centroidLat: number
): SelectedCountry => ({
  featureId,
  displayName,
  fillColor: DEFAULT_COUNTRY_FILL,
  centroidLng,
  centroidLat,
  countryId,
});

/** Warm the query cache for a hovered country so its panel opens instantly. */
function prefetchCountry(utils: ReturnType<typeof api.useUtils>, country: HoveredCountry) {
  const { displayName, countryId } = country;
  if (!displayName) return;
  void utils.countries.getWikiRichIntro.prefetch(
    { countryName: displayName, countryId: countryId ?? undefined },
    { staleTime: 24 * 60 * 60_000 }
  );
  if (!countryId) return;
  const opts = { staleTime: 10 * 60_000 };
  void utils.countries.getMapSummary.prefetch({ countryId }, opts);
  void utils.geoCore.getNeighbors.prefetch({ countryId }, opts);
  void utils.geoSovereignty.getCountrySovereignty.prefetch({ countryId }, opts);
}

/** Fly to a country, zooming in to at least level 4 but never out. */
const flyToCountry = (map: IxWorldMapRef, lng: number, lat: number) => {
  map.flyTo(lng, lat, Math.max(map.getMap()?.getZoom() ?? 1.8, 4));
};

export function useMapState({
  userCountryId,
  onCountrySelect,
  mapRef,
  getMapLayers,
  isPinToolActive,
  pinPosition,
  dropPin,
  clearPin,
}: UseMapStateProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const hoverDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (hoverDebounceRef.current) clearTimeout(hoverDebounceRef.current);
    };
  }, []);

  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [mapEngineReady, setMapEngineReady] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [mapLoadTimeout, setMapLoadTimeout] = useState(false);

  const [geographyFilter, setGeographyFilter] = useState<{
    type: "continent" | "region";
    value: string;
  } | null>(null);
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>("dynamic");
  const [isEditing, setIsEditing] = useState(false);
  const [isWorldEditing, setIsWorldEditing] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [storyPinModalId, setStoryPinModalId] = useState<string | null>(null);
  const [editingCountryId, setEditingCountryId] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | undefined>(undefined);

  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>(() =>
    buildDefaultVisibility()
  );

  const [labelsVisible, setLabelsVisible] = useState(true);
  const toggleLabels = useCallback(() => setLabelsVisible((v) => !v), []);

  const toggleOverlay = useCallback((key: keyof OverlayVisibility) => {
    setOverlayVisibility((prev) => applyOverlayToggle(prev, key as string));
  }, []);

  useEffect(() => {
    const onWebglError = (e: Event) =>
      setWebglError((e as CustomEvent).detail?.error || "WebGL Error detected");
    const onContextLost = () =>
      setWebglError("WebGL context lost. Hardware acceleration might be disabled or overloaded.");

    window.addEventListener("webgl-error", onWebglError);
    window.addEventListener("webgl-context-lost", onContextLost);
    return () => {
      window.removeEventListener("webgl-error", onWebglError);
      window.removeEventListener("webgl-context-lost", onContextLost);
    };
  }, []);

  const measuringRef = useRef(false);
  // oxlint-disable-next-line
  measuringRef.current = isMeasuring;
  const pinToolRef = useRef(false);
  // oxlint-disable-next-line
  pinToolRef.current = isPinToolActive;

  const handleFeatureClick = useCallback(
    (feature: SelectedFeature | null) => {
      setSelectedFeature(feature);
      if (feature) {
        setSelectedCountry(null);
        mapRef.current?.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
      }
    },
    [mapRef]
  );

  const handleCountryClick = useCallback(
    (country: SelectedCountry | null) => {
      if (measuringRef.current) return;
      if (pinToolRef.current) return;

      setSelectedFeature(null);
      setSelectedCountry(country);
      setGeographyFilter(null);
      onCountrySelect?.(country);

      if (country && mapRef.current) {
        flyToCountry(mapRef.current, country.centroidLng, country.centroidLat);
      }
    },
    [onCountrySelect, mapRef]
  );

  // Hover only warms the query cache. It deliberately does not store the hovered country in
  // React state: that re-rendered the whole map container (every panel and control) each
  // time the pointer crossed a border.
  const handleCountryHover = useCallback(
    (country: HoveredCountry | null) => {
      if (hoverDebounceRef.current) {
        clearTimeout(hoverDebounceRef.current);
        hoverDebounceRef.current = undefined;
      }
      if (!country) return;
      hoverDebounceRef.current = setTimeout(() => prefetchCountry(utils, country), 200);
    },
    [utils]
  );

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (pinToolRef.current) {
        const layerDataMap: Record<string, any> = {};
        for (const ml of getMapLayers()) layerDataMap[ml.type] = ml.data;
        dropPin(lng, lat, layerDataMap);
      }
    },
    [dropPin, getMapLayers]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedCountry(null);
    onCountrySelect?.(null);
  }, [onCountrySelect]);

  const handleEditMap = useCallback(() => {
    if (selectedCountry?.countryId) {
      setEditingCountryId(selectedCountry.countryId);
      setIsEditing(true);
    }
  }, [selectedCountry]);

  const handleExitEditor = useCallback(() => {
    setIsEditing(false);
    setEditingCountryId(null);
  }, []);

  const handleOpenMyEditor = useCallback(() => {
    if (userCountryId) {
      setEditingCountryId(userCountryId);
      setIsEditing(true);
    } else {
      notify.info(
        "You need a country to edit the map",
        "Create or claim one from MyCountry first."
      );
    }
  }, [userCountryId, notify]);

  const handleOpenWorldEditor = useCallback(() => {
    setIsWorldEditing(true);
  }, []);

  const handleEscapePress = useCallback(() => {
    if (isPinToolActive && pinPosition) {
      clearPin();
    } else if (selectedFeature) {
      setSelectedFeature(null);
    } else if (selectedCountry) {
      setSelectedCountry(null);
      onCountrySelect?.(null);
    }
  }, [isPinToolActive, pinPosition, clearPin, selectedFeature, selectedCountry, onCountrySelect]);

  const handleSearchResult = useCallback(
    (result: {
      type: string;
      id: string;
      name: string;
      countryId: string | null;
      centroidLng: number;
      centroidLat: number;
    }) => {
      const zoom = SEARCH_RESULT_ZOOM[result.type] ?? 8;
      mapRef.current?.flyTo(result.centroidLng, result.centroidLat, zoom);

      if (result.type === "country") {
        const country = toSelectedCountry(
          result.id,
          result.name,
          result.countryId,
          result.centroidLng,
          result.centroidLat
        );
        setSelectedCountry(country);
        onCountrySelect?.(country);
      }
    },
    [onCountrySelect, mapRef]
  );

  const handleNeighborClick = useCallback(
    (neighbor: NeighborTarget) => {
      let lng = neighbor.centroidLng ?? 0;
      let lat = neighbor.centroidLat ?? 0;

      if (lng === 0 && lat === 0) {
        const match = getMapLayers()
          .find((l) => l.type === "political")
          ?.data?.features.find(
            (f: any) =>
              f.properties?._id === neighbor.featureId ||
              f.properties?._displayName === neighbor.displayName
          );
        lng = match?.properties?._centroidLng ?? 0;
        lat = match?.properties?._centroidLat ?? 0;
      }

      const country = toSelectedCountry(
        neighbor.featureId,
        neighbor.displayName,
        neighbor.countryId,
        lng,
        lat
      );
      setSelectedCountry(country);
      setGeographyFilter(null);
      onCountrySelect?.(country);

      if (mapRef.current && (lng !== 0 || lat !== 0)) flyToCountry(mapRef.current, lng, lat);
    },
    [onCountrySelect, getMapLayers, mapRef]
  );

  return {
    selectedCountry,
    setSelectedCountry,
    selectedFeature,
    setSelectedFeature,
    isMeasuring,
    setIsMeasuring,
    mapEngineReady,
    setMapEngineReady,
    webglError,
    mapLoadTimeout,
    setMapLoadTimeout,
    geographyFilter,
    setGeographyFilter,
    projectionMode,
    setProjectionMode,
    isEditing,
    isWorldEditing,
    setIsWorldEditing,
    selectedRouteId,
    setSelectedRouteId,
    storyPinModalId,
    setStoryPinModalId,
    editingCountryId,
    currentZoom,
    setCurrentZoom,
    overlayVisibility,
    labelsVisible,
    toggleLabels,
    toggleOverlay,
    handleFeatureClick,
    handleCountryClick,
    handleCountryHover,
    handleMapClick,
    handleClosePanel,
    handleEditMap,
    handleExitEditor,
    handleOpenMyEditor,
    handleOpenWorldEditor,
    handleEscapePress,
    handleSearchResult,
    handleNeighborClick,
  };
}
