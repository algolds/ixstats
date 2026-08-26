import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import type { SelectedCountry, SelectedFeature, HoveredCountry } from "../IxWorldMap";
import type { ProjectionMode } from "~/lib/maps/map-config";
import type { OverlayVisibility } from "../IxWorldMap";
import { buildDefaultVisibility, applyOverlayToggle } from "~/lib/maps/overlay-registry";

interface UseMapStateProps {
  userCountryId: string | null;
  isAdmin: boolean;
  onCountrySelect?: (country: SelectedCountry | null) => void;
  mapRef: React.RefObject<any>;
  measureToolRef: React.RefObject<any>;
  mapLayers: any[];
  layerDataMap: Record<string, any>;
  isPinToolActive: boolean;
  pinPosition: any;
  dropPin: (lng: number, lat: number, layerDataMap: any) => void;
  clearPin: () => void;
}

export function useMapState({
  userCountryId,
  // oxlint-disable-next-line eslint/no-unused-vars
  isAdmin,
  onCountrySelect,
  mapRef,
  // oxlint-disable-next-line eslint/no-unused-vars
  measureToolRef,
  mapLayers,
  layerDataMap,
  isPinToolActive,
  pinPosition,
  dropPin,
  clearPin,
}: UseMapStateProps) {
  const utils = api.useUtils();
  const hoverDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (hoverDebounceRef.current) clearTimeout(hoverDebounceRef.current);
    };
  }, []);

  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<HoveredCountry | null>(null);
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

  // WebGL Error listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWebGLErrorEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      setWebglError(customEvent.detail?.error || "WebGL Error detected");
    };

    const handleContextLostEvent = () => {
      setWebglError("WebGL context lost. Hardware acceleration might be disabled or overloaded.");
    };

    window.addEventListener("webgl-error" as any, handleWebGLErrorEvent);
    window.addEventListener("webgl-context-lost" as any, handleContextLostEvent);

    return () => {
      window.removeEventListener("webgl-error" as any, handleWebGLErrorEvent);
      window.removeEventListener("webgl-context-lost" as any, handleContextLostEvent);
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
        const currentZoom = mapRef.current.getMap()?.getZoom() ?? 1.8;
        const targetZoom = currentZoom >= 4 ? Math.max(currentZoom, 4) : 4;
        mapRef.current.flyTo(country.centroidLng, country.centroidLat, targetZoom);
      }
    },
    [onCountrySelect, mapRef]
  );

  const handleCountryHover = useCallback(
    (country: HoveredCountry | null) => {
      setHoveredCountry(country);
      if (hoverDebounceRef.current) {
        clearTimeout(hoverDebounceRef.current);
        hoverDebounceRef.current = undefined;
      }
      if (!country) return;
      hoverDebounceRef.current = setTimeout(() => {
        if (country.displayName) {
          const wikiOpts = { staleTime: 24 * 60 * 60_000 };
          void utils.countries.getWikiRichIntro.prefetch(
            { countryName: country.displayName },
            wikiOpts
          );
          const opts = { staleTime: 10 * 60_000 };
          if (country.countryId) {
            void utils.countries.getMapSummary.prefetch({ countryId: country.countryId }, opts);
            void utils.geoCore.getNeighbors.prefetch({ countryId: country.countryId }, opts);
            void utils.geoSovereignty.getCountrySovereignty.prefetch(
              { countryId: country.countryId },
              opts
            );
          }
        }
      }, 200);
    },
    [utils]
  );

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (pinToolRef.current) {
        dropPin(lng, lat, layerDataMap);
      }
    },
    [dropPin, layerDataMap]
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
      alert("You must have a country to edit the map. Go to /mycountry to create or claim one.");
    }
  }, [userCountryId]);

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
      const zoom = result.type === "country" ? 4 : result.type === "subdivision" ? 6 : 8;
      mapRef.current?.flyTo(result.centroidLng, result.centroidLat, zoom);

      if (result.type === "country") {
        const country: SelectedCountry = {
          featureId: result.id,
          displayName: result.name,
          fillColor: "#e8e5da",
          centroidLng: result.centroidLng,
          centroidLat: result.centroidLat,
          countryId: result.countryId,
        };
        setSelectedCountry(country);
        onCountrySelect?.(country);
      }
    },
    [onCountrySelect, mapRef]
  );

  const handleNeighborClick = useCallback(
    (neighbor: {
      featureId: string;
      countryId: string | null;
      displayName: string;
      centroidLng?: number;
      centroidLat?: number;
    }) => {
      let lng = neighbor.centroidLng ?? 0;
      let lat = neighbor.centroidLat ?? 0;

      if (lng === 0 && lat === 0) {
        const politicalLayer = mapLayers.find((l) => l.type === "political");
        if (politicalLayer?.data) {
          const match = politicalLayer.data.features.find(
            (f: any) =>
              f.properties?._id === neighbor.featureId ||
              f.properties?._displayName === neighbor.displayName
          );
          if (match?.properties) {
            lng = match.properties._centroidLng ?? 0;
            lat = match.properties._centroidLat ?? 0;
          }
        }
      }

      const country: SelectedCountry = {
        featureId: neighbor.featureId,
        displayName: neighbor.displayName,
        fillColor: "#e8e5da",
        centroidLng: lng,
        centroidLat: lat,
        countryId: neighbor.countryId,
      };
      setSelectedCountry(country);
      setGeographyFilter(null);
      onCountrySelect?.(country);

      if (mapRef.current && (lng !== 0 || lat !== 0)) {
        const currentZoom = mapRef.current.getMap()?.getZoom() ?? 1.8;
        const targetZoom = currentZoom >= 4 ? Math.max(currentZoom, 4) : 4;
        mapRef.current.flyTo(lng, lat, targetZoom);
      }
    },
    [onCountrySelect, mapLayers, mapRef]
  );

  return {
    selectedCountry,
    setSelectedCountry,
    hoveredCountry,
    setHoveredCountry,
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
    setIsEditing,
    isWorldEditing,
    setIsWorldEditing,
    selectedRouteId,
    setSelectedRouteId,
    storyPinModalId,
    setStoryPinModalId,
    editingCountryId,
    setEditingCountryId,
    currentZoom,
    setCurrentZoom,
    overlayVisibility,
    setOverlayVisibility,
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
