"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_DEFAULTS, buildBaseStyle } from "~/lib/maps/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";
import { acquireSurface } from "~/lib/maps/map-engine";

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

    const map = new maplibregl.Map({
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
      setIsLoaded(true);
      onLoad?.(map);
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, []);

  return {
    map: mapRef.current,
    mapRef,
    containerRef,
    isLoaded,
  };
}
