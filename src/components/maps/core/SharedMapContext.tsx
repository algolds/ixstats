"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { buildBaseStyle, MAP_DEFAULTS, type ProjectionMode } from "~/lib/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";

interface SharedMapContextType {
  map: MapLibreMap | null;
  container: HTMLDivElement | null;
  acquireMap: (slotId: string, options: AcquireOptions) => () => void;
}

interface AcquireOptions {
  container: HTMLDivElement;
  center?: [number, number];
  zoom?: number;
  bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  onReady?: (map: MapLibreMap) => void;
  interactive?: boolean;
  theme?: MapTheme;
  projectionMode?: ProjectionMode;
}

const SharedMapContext = createContext<SharedMapContextType | null>(null);

export function SharedMapProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeSlotIdRef = useRef<string | null>(null);
  const hiddenContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize map container and instance client-side on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Create the hidden storage div for the map canvas when not claimed
    const hidden = document.createElement("div");
    hidden.style.display = "none";
    document.body.appendChild(hidden);
    hiddenContainerRef.current = hidden;

    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.position = "absolute";
    container.style.inset = "0";
    hidden.appendChild(container);
    containerRef.current = container;

    let destroyed = false;

    async function initMap() {
      try {
        const mod = await import("maplibre-gl");
        const maplibregl = ("Map" in mod ? mod : (mod as any).default) as typeof mod;
        if (destroyed) return;

        const mapInstance = new maplibregl.Map({
          container,
          style: buildBaseStyle("standard", "dynamic") as any,
          center: MAP_DEFAULTS.center,
          zoom: MAP_DEFAULTS.zoom,
          minZoom: MAP_DEFAULTS.minZoom,
          maxZoom: MAP_DEFAULTS.maxZoom,
          attributionControl: false,
          dragRotate: false,
          touchPitch: false,
        });

        mapInstance.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          "bottom-right"
        );

        mapInstance.on("load", () => {
          if (destroyed) return;
          mapRef.current = mapInstance;
          setMap(mapInstance);
        });
      } catch (err) {
        console.error("[SharedMapProvider] failed to init map:", err);
      }
    }

    initMap();

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
      }
      if (hidden.parentNode) {
        hidden.parentNode.removeChild(hidden);
      }
    };
  }, []);

  // Stable across renders — only touches refs, never props/state. A new identity
  // here would make every embed's acquire effect release+re-acquire the shared
  // singleton on every ancestor re-render, which endless-loops the embeds.
  const acquireMap = useCallback((slotId: string, options: AcquireOptions) => {
    activeSlotIdRef.current = slotId;

    const setup = () => {
      const containerEl = containerRef.current;
      const mapInstance = mapRef.current;
      if (!containerEl || !mapInstance) return;

      // Append to the target component container
      options.container.appendChild(containerEl);

      // Perform resize
      setTimeout(() => {
        if (activeSlotIdRef.current === slotId) {
          mapInstance.resize();
        }
      }, 50);

      // Set projection mode and theme if customized
      const currentTheme = options.theme ?? "standard";
      const currentProj = options.projectionMode ?? "dynamic";
      const newStyle = buildBaseStyle(currentTheme, currentProj);

      const applyViewAndReady = () => {
        if (activeSlotIdRef.current !== slotId) return;

        // Handle viewport options
        if (options.bbox) {
          mapInstance.fitBounds(
            [
              [options.bbox.minLng, options.bbox.minLat],
              [options.bbox.maxLng, options.bbox.maxLat],
            ],
            { padding: options.zoom !== undefined ? options.zoom : 40, duration: 0 }
          );
        } else if (options.center) {
          mapInstance.setCenter(options.center);
          if (options.zoom !== undefined) {
            mapInstance.setZoom(options.zoom);
          }
        }

        // Configure interactivity
        if (options.interactive !== undefined) {
          if (options.interactive) {
            mapInstance.boxZoom.enable();
            mapInstance.doubleClickZoom.enable();
            mapInstance.dragPan.enable();
            mapInstance.keyboard.enable();
            mapInstance.scrollZoom.enable();
            mapInstance.touchZoomRotate.enable();
          } else {
            mapInstance.boxZoom.disable();
            mapInstance.doubleClickZoom.disable();
            mapInstance.dragPan.disable();
            mapInstance.keyboard.disable();
            mapInstance.scrollZoom.disable();
            mapInstance.touchZoomRotate.disable();
          }
        }

        options.onReady?.(mapInstance);
      };

      mapInstance.setStyle(newStyle as any, { diff: true });

      if (mapInstance.isStyleLoaded()) {
        applyViewAndReady();
      } else {
        mapInstance.once("style.load", () => {
          applyViewAndReady();
        });
      }
    };

    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      setup();
    } else {
      // If map is not loaded or style is not loaded, check
      const checkInterval = setInterval(() => {
        if (mapRef.current && mapRef.current.isStyleLoaded()) {
          clearInterval(checkInterval);
          if (activeSlotIdRef.current === slotId) {
            setup();
          }
        }
      }, 50);
    }

    // Return release function
    return () => {
      if (activeSlotIdRef.current === slotId) {
        activeSlotIdRef.current = null;
        // Move container back to hidden area
        if (containerRef.current && hiddenContainerRef.current) {
          hiddenContainerRef.current.appendChild(containerRef.current);
        }
      }
    };
  }, []);

  const value = useMemo(
    () => ({ map, container: containerRef.current, acquireMap }),
    [map, acquireMap]
  );

  return <SharedMapContext.Provider value={value}>{children}</SharedMapContext.Provider>;
}

export function useSharedMap() {
  const context = useContext(SharedMapContext);
  if (!context) {
    throw new Error("useSharedMap must be used within a SharedMapProvider");
  }
  return context;
}
