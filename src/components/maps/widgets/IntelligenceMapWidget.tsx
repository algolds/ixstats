"use client";

/**
 * IntelligenceMapWidget - Geopolitical analytics view.
 *
 * Shows country in regional context with neighbors colored by
 * diplomatic relationship strength:
 * - Green = ally/friendly (strength >= 70)
 * - Yellow = neutral (strength 30-69)
 * - Red = hostile (strength < 30)
 * - Gray = no relationship data
 *
 * Themed indigo border, follows sidebar widget pattern.
 */

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Brain } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { buildBaseStyle, getCountryColor, MAP_SYMBOL_FONTS } from "~/lib/map-config";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import { MapPin, Loader2 } from "lucide-react";

interface IntelligenceMapWidgetProps {
  countryId: string;
  countryName: string;
  className?: string;
}

function getRelationshipColor(strength: number | null | undefined): string {
  if (strength == null) return "#94a3b8"; // gray — no data
  if (strength >= 70) return "#22c55e"; // green — ally
  if (strength >= 30) return "#eab308"; // yellow — neutral
  return "#ef4444"; // red — hostile
}

export function IntelligenceMapWidget({
  countryId,
  countryName: _countryName,
  className = "",
}: IntelligenceMapWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const {
    geometry,
    centroid,
    bbox,
    featureId,
    fillColor,
    neighbors,
    isLoading: geoLoading,
    hasGeometry,
  } = useCountryMapEmbed(countryId);

  const { data: relations, isLoading: relationsLoading } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 5 * 60_000 }
  );

  const isLoading = geoLoading || relationsLoading;

  // Build neighbor relationship lookup
  const neighborRelations = useMemo(() => {
    if (!neighbors || !relations) return new Map<string, number>();
    const lookup = new Map<string, number>();
    for (const rel of relations) {
      lookup.set(rel.targetCountryId, rel.strength ?? 0);
    }
    return lookup;
  }, [neighbors, relations]);

  const allyCount = relations?.filter((r) => (r.strength ?? 0) >= 70).length ?? 0;
  const hostileCount = relations?.filter((r) => (r.strength ?? 0) < 30).length ?? 0;

  const initMap = useCallback(async () => {
    if (!containerRef.current || !geometry) return;

    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const baseStyle = buildBaseStyle() as maplibregl.StyleSpecification;
    delete (baseStyle as Record<string, unknown>).projection;

    const initialCenter: [number, number] = centroid ? [centroid.lng, centroid.lat] : [10, 5];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle,
      center: initialCenter,
      zoom: 3,
      attributionControl: false,
      interactive: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      const color = fillColor || (featureId ? getCountryColor(featureId) : "#c5cae9");

      // ── Neighbor relationship indicators ──
      if (neighbors.length > 0) {
        const neighborPoints: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: neighbors
            .filter((n) => n.centroidLng && n.centroidLat)
            .map((n) => {
              const strength = n.countryId ? neighborRelations.get(n.countryId) : undefined;
              return {
                type: "Feature" as const,
                properties: {
                  name: n.displayName,
                  countryId: n.countryId,
                  strength: strength ?? -1,
                  color: getRelationshipColor(strength),
                },
                geometry: {
                  type: "Point" as const,
                  coordinates: [n.centroidLng, n.centroidLat],
                },
              };
            }),
        };

        map.addSource("source-neighbors", { type: "geojson", data: neighborPoints });

        // Colored circles showing relationship status
        map.addLayer({
          id: "neighbor-dots",
          type: "circle",
          source: "source-neighbors",
          paint: {
            "circle-radius": 6,
            "circle-color": ["get", "color"] as unknown as string,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.85,
          },
        });

        // Neighbor name labels
        map.addLayer({
          id: "neighbor-labels",
          type: "symbol",
          source: "source-neighbors",
          layout: {
            "text-field": ["get", "name"] as unknown as string,
            "text-size": 9,
            "text-offset": [0, 1.5],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-optional": true,
            "text-font": [...MAP_SYMBOL_FONTS.regular],
          },
          paint: {
            "text-color": "#666",
            "text-halo-color": "#fff",
            "text-halo-width": 1,
          },
        });
      }

      // ── Country fill (with glow effect via wider stroke) ──
      map.addSource("source-country", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: geometry as GeoJSON.Geometry,
            },
          ],
        },
      });

      // Glow layer — wider, translucent stroke
      map.addLayer({
        id: "country-glow",
        type: "line",
        source: "source-country",
        paint: {
          "line-color": "#6366f1",
          "line-width": 5,
          "line-opacity": 0.25,
          "line-blur": 3,
        },
      });

      map.addLayer({
        id: "country-fill",
        type: "fill",
        source: "source-country",
        paint: { "fill-color": color, "fill-opacity": 0.45 },
      });

      map.addLayer({
        id: "country-stroke",
        type: "line",
        source: "source-country",
        paint: { "line-color": "#6366f1", "line-width": 1.5 },
      });

      // Fit to bounds
      if (bbox) {
        map.fitBounds(
          [
            [bbox.minLng, bbox.minLat],
            [bbox.maxLng, bbox.maxLat],
          ],
          { padding: 50, maxZoom: 8, duration: 0 }
        );
      }

      setMapReady(true);
    });
  }, [geometry, centroid, bbox, featureId, fillColor, neighbors, neighborRelations]);

  useEffect(() => {
    if (geometry) {
      initMap();
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [initMap, geometry]);

  if (isLoading) {
    return (
      <div
        className={`glass-hierarchy-child overflow-hidden rounded-xl border border-indigo-500/15 ${className}`}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Brain className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-foreground text-xs font-medium">Geopolitical Intel</span>
          </div>
        </div>
        <div className="bg-muted flex h-48 items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  if (!hasGeometry) {
    return (
      <div
        className={`glass-hierarchy-child overflow-hidden rounded-xl border border-indigo-500/15 ${className}`}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Brain className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-foreground text-xs font-medium">Geopolitical Intel</span>
          </div>
        </div>
        <div className="bg-muted flex h-48 flex-col items-center justify-center gap-2">
          <MapPin className="text-muted-foreground h-6 w-6" />
          <span className="text-muted-foreground text-xs">No map data available</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`glass-hierarchy-child overflow-hidden rounded-xl border border-indigo-500/15 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-foreground text-xs font-medium">Geopolitical Intel</span>
        </div>
        <div className="flex items-center gap-1">
          {allyCount > 0 && (
            <Badge
              variant="outline"
              className="h-4 border-green-500/30 px-1.5 text-[9px] text-green-500"
            >
              {allyCount} ALLY
            </Badge>
          )}
          {hostileCount > 0 && (
            <Badge
              variant="outline"
              className="h-4 border-red-500/30 px-1.5 text-[9px] text-red-500"
            >
              {hostileCount} HOSTILE
            </Badge>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="relative h-48">
        <div ref={containerRef} className="absolute inset-0" />
        {!mapReady && (
          <div className="bg-muted absolute inset-0 flex items-center justify-center">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      {/* Legend + Footer */}
      <div className="border-border/50 border-t px-3 py-1.5">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground flex items-center gap-2.5 text-[9px]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Ally
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
              Neutral
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Hostile
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
              Unknown
            </span>
          </div>
          <a
            href={createUrl(`/maps?country=${countryId}`)}
            className="text-[10px] text-indigo-500 hover:text-indigo-600"
          >
            Full map →
          </a>
        </div>
      </div>
    </div>
  );
}
