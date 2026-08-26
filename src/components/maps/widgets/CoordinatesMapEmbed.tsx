"use client";

/**
 * CoordinatesMapEmbed - Native coordinate-focused MapLibre GL map widget.
 *
 * Automatically initializes and renders the map when it enters the viewport
 * using an IntersectionObserver. Displays a loading overlay during initialization.
 * Eliminates click-to-load and prevents WebGL bottleneck issues.
 */

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { buildBaseStyle, MAP_SYMBOL_FONTS } from "~/lib/maps/map-config";
import { api } from "~/trpc/react";
import { MapPin, SystemRestart as Loader2 } from "iconoir-react";

export interface CoordinatesMapEmbedProps {
  lat: number;
  lng: number;
  zoom?: number;
  options?: string; // height=400|width=100%|interactive=yes|title=My Title
}

export function CoordinatesMapEmbed({
  lat,
  lng,
  zoom = 5,
  options = "",
}: CoordinatesMapEmbedProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const [isInViewport, setIsInViewport] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Parse wikitext options
  const parsedOptions = useMemo(() => {
    const opts: Record<string, string> = {};
    if (options) {
      options.split("|").forEach((opt) => {
        const parts = opt.split("=");
        if (parts.length === 2 && parts[0] && parts[1]) {
          opts[parts[0].trim().toLowerCase()] = parts[1].trim();
        }
      });
    }
    return opts;
  }, [options]);

  const heightVal = parsedOptions.height
    ? isNaN(Number(parsedOptions.height))
      ? parsedOptions.height
      : `${parsedOptions.height}px`
    : "300px";
  const interactiveVal = parsedOptions.interactive !== "no";
  const titleVal = parsedOptions.title || "";

  // Fetch world political layer (shared cache with main map)
  const { data: worldMap } = api.geoCore.getWorldMap.useQuery(
    { layers: ["political"] },
    { enabled: isInViewport, staleTime: 30 * 60_000, gcTime: 2 * 60 * 60_000 }
  );

  const worldPolitical = useMemo(() => {
    return (worldMap as any)?.political as any;
  }, [worldMap]);

  // Viewport detection
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect(); // Load once and keep loaded
        }
      },
      { rootMargin: "200px" } // Pre-load 200px before scrolling into view
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const initMap = useCallback(async () => {
    if (!containerRef.current) return;

    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    // Clean up existing
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const baseStyle: any = buildBaseStyle();
    // Force Mercator projection for embeds
    delete baseStyle.projection;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle,
      center: [lng, lat],
      zoom: zoom,
      attributionControl: false,
      interactive: interactiveVal,
    });

    mapRef.current = map;

    map.on("load", () => {
      // 1. Add world political borders
      if (worldPolitical && worldPolitical.features && worldPolitical.features.length > 0) {
        map.addSource("source-world-political", {
          type: "geojson",
          data: worldPolitical,
        });

        // Fill color layer with colors from feature properties
        map.addLayer({
          id: "world-political-fill",
          type: "fill",
          source: "source-world-political",
          paint: {
            "fill-color": ["coalesce", ["get", "_fillColor"], ["get", "fillColor"], "#c5cae9"],
            "fill-opacity": 0.45,
          },
        });

        // Country border line layer
        map.addLayer({
          id: "world-political-stroke",
          type: "line",
          source: "source-world-political",
          paint: {
            "line-color": "#475569",
            "line-width": 0.8,
            "line-opacity": 0.5,
          },
        });

        // Country name labels layer
        map.addLayer({
          id: "world-political-labels",
          type: "symbol",
          source: "source-world-political",
          layout: {
            "text-field": [
              "coalesce",
              ["get", "_displayName"],
              ["get", "name"],
              "",
            ] as unknown as string,
            "text-size": 10,
            "text-allow-overlap": false,
            "text-optional": true,
            "text-font": [...MAP_SYMBOL_FONTS.regular],
          },
          paint: {
            "text-color": "#475569",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
            "text-opacity": 0.8,
          },
          minzoom: 2,
        });
      }

      // 2. Add Red marker/pin at [lng, lat]
      const marker = new maplibregl.Marker({ color: "#ef4444" }).setLngLat([lng, lat]).addTo(map);

      // 3. Add popup if title is available
      if (titleVal) {
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
          `<div style="color: #000; font-family: sans-serif; font-size: 12px; font-weight: bold; padding: 2px;">${titleVal}</div>`
        );
        marker.setPopup(popup);
      }

      setMapReady(true);
    });
  }, [lat, lng, zoom, interactiveVal, titleVal, worldPolitical]);

  useEffect(() => {
    if (isInViewport) {
      // Small delay to ensure container has layout dimensions
      const timer = setTimeout(() => initMap(), 50);
      return () => {
        clearTimeout(timer);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          setMapReady(false);
        }
      };
    }
    return undefined;
  }, [initMap, isInViewport]);

  // Resize map when container dimensions change
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  // oxlint-disable-next-line
  }, [mapReady]);

  return (
    <div
      ref={elementRef}
      className="wikios-ixworld-embed facet-hierarchy-child relative overflow-hidden rounded-xl border border-white/10 bg-map-ocean/40 backdrop-blur-md"
      style={{ height: heightVal }}
    >
      {isInViewport && <div ref={containerRef} className="absolute inset-0 h-full w-full" />}

      {!mapReady && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-map-ocean/60 backdrop-blur-sm">
          <Loader2 className="mb-2 h-6 w-6 animate-spin text-blue-400" />
          <span className="text-xs font-medium text-zinc-400">Loading map...</span>
        </div>
      )}

      {/* Floating control bar or details overlay */}
      {mapReady && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/75 px-2.5 py-1 text-[10px] text-zinc-300 backdrop-blur-md select-none">
          <MapPin className="h-2.5 w-2.5 text-blue-400" />
          <span className="font-semibold">{titleVal || "Map Embed"}</span>
          <span className="font-mono text-[9px] text-zinc-500">
            ({lat.toFixed(3)}, {lng.toFixed(3)})
          </span>
        </div>
      )}
    </div>
  );
}
