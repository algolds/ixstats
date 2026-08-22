"use client";

import { useEffect, useRef, useState } from "react";
import type maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_DEFAULTS, buildBaseStyle } from "~/lib/maps/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";

interface UseMapLibreInstanceOptions {
  theme?: MapTheme;
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  interactive?: boolean;
  onLoad?: (map: maplibregl.Map) => void;
}

export function useMapLibreInstance(options: UseMapLibreInstanceOptions = {}) {
  const {
    theme = "standard",
    center = MAP_DEFAULTS.center as [number, number],
    zoom = MAP_DEFAULTS.zoom,
    pitch = 0,
    bearing = 0,
    interactive = true,
    onLoad,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let isCancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    void import("maplibre-gl").then((mod) => {
      if (isCancelled || !containerRef.current || mapRef.current) return;
      const MapClass = mod.default?.Map || (mod as any).Map;
      if (!MapClass) return;

      const map = new MapClass({
        container: containerRef.current,
        style: buildBaseStyle(theme) as any,
        center,
        zoom,
        pitch,
        bearing,
        interactive,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        if (!isCancelled) {
          setIsLoaded(true);
          onLoad?.(map);
        }
      });

      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
    });

    return () => {
      isCancelled = true;
      resizeObserver?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [theme, center, zoom, pitch, bearing, interactive, onLoad]);

  return {
    map: mapRef.current,
    mapRef,
    containerRef,
    isLoaded,
  };
}
