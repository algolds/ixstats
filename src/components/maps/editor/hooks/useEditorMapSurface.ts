import { useEffect, type RefObject } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { MapTheme } from "~/lib/map-styles/registry";
import { buildBaseStyle, mapHomeCenter } from "~/lib/maps/map-config";
import { acquireSurface } from "~/lib/maps/map-engine";
import { isIxWorldView } from "~/lib/realms/realm-ids";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";

function lockFlatProjection(map: MapLibreMap) {
  const withProjection = map as MapLibreMap & { setProjection?: (spec: { type: string }) => void };
  withProjection.setProjection?.({ type: "mercator" });
}

interface UseEditorMapSurfaceProps {
  containerRef: RefObject<HTMLDivElement | null>;
  mapRef: { current: MapLibreMap | null };
  isLoaded: boolean;
  setIsLoaded: (loaded: boolean) => void;
  theme: MapTheme;
  countryBbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  countryCentroid: { lng: number; lat: number } | null;
  /** Publishes (or clears) the map instance to the plugin context. */
  setPluginMap: (map: MapLibreMap | null) => void;
  onMapReady?: (map: MapLibreMap | null) => void;
}

/** Owns the editor map's lifetime: borrows the persistent surface, restyles on theme change, fits the country. */
export function useEditorMapSurface({
  containerRef,
  mapRef,
  isLoaded,
  setIsLoaded,
  theme,
  countryBbox,
  countryCentroid,
  setPluginMap,
  onMapReady,
}: UseEditorMapSurfaceProps) {
  // With no country to centre on, open on the realm's home view (IxWorld's prime meridian there)
  const homeCenter = mapHomeCenter(isIxWorldView(useMapRealm()));

  // Theme change: swap the base style, then wait for it before layers are re-added.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    setIsLoaded(false);
    map.setStyle(buildBaseStyle(theme) as StyleSpecification, { diff: true });
    const onStyleLoad = () => setIsLoaded(true);
    map.once("style.load", onStyleLoad);
    return () => {
      map.off("style.load", onStyleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // The editor is always flat; re-lock after load and style changes.
  useEffect(() => {
    if (mapRef.current && isLoaded) lockFlatProjection(mapRef.current);
  }, [mapRef, isLoaded, theme]);

  // Borrow the persistent "editor" instance (kept warm across navigation).
  useEffect(() => {
    if (!containerRef.current) return;

    const handle = acquireSurface("editor", {
      container: containerRef.current,
      initialCenter: countryCentroid ? [countryCentroid.lng, countryCentroid.lat] : homeCenter,
      initialZoom: 4,
      theme,
      projectionMode: "mercator",
      interactive: true,
      onCreate: (map, maplibregl) => {
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
          "top-right"
        );
      },
      onReady: (map) => {
        mapRef.current = map;
        // The engine resolves ready after style.load, so the style is safe to touch here.
        lockFlatProjection(map);
        setIsLoaded(true);
        setPluginMap(map);
        onMapReady?.(map);
      },
    });

    handle.ready.catch((err) => {
      console.error("[EditorMap] init error:", err);
    });

    return () => {
      onMapReady?.(null);
      handle.release();
      mapRef.current = null;
      setPluginMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit to the country once loaded.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    if (countryBbox) {
      map.fitBounds(
        [
          [countryBbox.minLng, countryBbox.minLat],
          [countryBbox.maxLng, countryBbox.maxLat],
        ],
        { padding: 60, duration: 1000 }
      );
    } else if (countryCentroid) {
      map.flyTo({ center: [countryCentroid.lng, countryCentroid.lat], zoom: 5, duration: 1000 });
    }
  }, [mapRef, isLoaded, countryBbox, countryCentroid]);
}
