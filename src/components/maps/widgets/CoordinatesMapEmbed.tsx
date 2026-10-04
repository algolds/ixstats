"use client";

/** Coordinate-focused MapLibre widget; the map is created only once it scrolls into view. */

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { buildBaseStyle, MAP_SYMBOL_FONTS } from "~/lib/maps/map-config";
import { api } from "~/trpc/react";
import { MapPin, SystemRestart as Loader2 } from "iconoir-react";
import type { FeatureCollection } from "geojson";
import { loadMaplibre } from "~/lib/maps/load-maplibre";
import { addGeoLayers } from "~/components/maps/shared/geo-layers";

interface CoordinatesMapEmbedProps {
  lat: number;
  lng: number;
  zoom?: number;
  options?: string; // height=400|width=100%|interactive=yes|title=My Title
}

/** Popup title as a text node: the title comes from wiki markup, so it is never parsed as HTML. */
export function buildPopupTitleNode(title: string): HTMLDivElement {
  const titleEl = document.createElement("div");
  titleEl.textContent = title;
  titleEl.style.cssText =
    "color: #000; font-family: sans-serif; font-size: 12px; font-weight: bold; padding: 2px;";
  return titleEl;
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

  const parsedOptions = useMemo(
    () =>
      Object.fromEntries(
        options
          .split("|")
          .map((opt) => opt.split("="))
          .filter(
            (parts): parts is [string, string] => parts.length === 2 && !!parts[0] && !!parts[1]
          )
          .map(([key, value]) => [key.trim().toLowerCase(), value.trim()])
      ) as Record<string, string>,
    [options]
  );

  const heightVal = parsedOptions.height
    ? isNaN(Number(parsedOptions.height))
      ? parsedOptions.height
      : `${parsedOptions.height}px`
    : "300px";
  const interactiveVal = parsedOptions.interactive !== "no";
  const titleVal = parsedOptions.title || "";

  const { data: worldMap } = api.geoCore.getWorldMap.useQuery(
    { layers: ["political"] },
    { enabled: isInViewport, staleTime: 30 * 60_000, gcTime: 2 * 60 * 60_000 }
  );

  const worldPolitical = (worldMap as any)?.political as FeatureCollection | undefined;

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

  const initMap = useCallback(
    async (isCancelled: () => boolean) => {
      if (!containerRef.current) return;

      // maplibre-gl 6 is ESM-only, so the module namespace itself carries the
      // named exports (Map, Popup, …).
      const maplibregl = await loadMaplibre();
      await import("maplibre-gl/dist/maplibre-gl.css");
      // Unmounted (or deps changed) while MapLibre was loading — don't create an orphan map.
      if (isCancelled() || !containerRef.current) return;

      mapRef.current?.remove();

      const baseStyle: any = buildBaseStyle();
      delete baseStyle.projection; // Mercator for embeds

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
        if (isCancelled()) return;
        if (worldPolitical?.features?.length) {
          addGeoLayers(map, "source-world-political", worldPolitical, [
            {
              id: "world-political-fill",
              type: "fill",
              paint: {
                "fill-color": ["coalesce", ["get", "_fillColor"], ["get", "fillColor"], "#c5cae9"],
                "fill-opacity": 0.45,
              },
            },
            {
              id: "world-political-stroke",
              type: "line",
              paint: { "line-color": "#475569", "line-width": 0.8, "line-opacity": 0.5 },
            },
            {
              id: "world-political-labels",
              type: "symbol",
              layout: {
                "text-field": ["coalesce", ["get", "_displayName"], ["get", "name"], ""],
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
            },
          ]);
        }

        const marker = new maplibregl.Marker({ color: "#ef4444" }).setLngLat([lng, lat]).addTo(map);

        if (titleVal) {
          marker.setPopup(
            new maplibregl.Popup({ offset: 25 }).setDOMContent(buildPopupTitleNode(titleVal))
          );
        }

        setMapReady(true);
      });
    },
    [lat, lng, zoom, interactiveVal, titleVal, worldPolitical]
  );

  useEffect(() => {
    if (isInViewport) {
      let cancelled = false;
      // Small delay to ensure container has layout dimensions
      const timer = setTimeout(() => void initMap(() => cancelled), 50);
      return () => {
        cancelled = true;
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
      className="wikios-ixworld-embed bg-map-ocean/40 rounded-row border-separator relative overflow-hidden border"
      style={{ height: heightVal }}
    >
      {isInViewport && <div ref={containerRef} className="absolute inset-0 h-full w-full" />}

      {!mapReady && (
        <div className="bg-map-ocean/60 absolute inset-0 z-10 flex flex-col items-center justify-center">
          <Loader2 className="text-blue mb-2 h-6 w-6 animate-spin" />
          <span className="text-caption text-label-secondary">Loading map...</span>
        </div>
      )}

      {mapReady && (
        <div className="facet-chrome rounded-control text-footnote text-label-secondary pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 px-3 py-1 select-none">
          <MapPin className="text-blue h-2.5 w-2.5" />
          <span className="font-semibold">{titleVal || "Map Embed"}</span>
          <span className="text-footnote text-label-secondary font-mono">
            ({lat.toFixed(3)}, {lng.toFixed(3)})
          </span>
        </div>
      )}
    </div>
  );
}
