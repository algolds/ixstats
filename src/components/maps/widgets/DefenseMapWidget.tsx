"use client";

/**
 * DefenseMapWidget - Territory defense overview.
 *
 * Shows country territory with subdivision boundaries as defense zones,
 * with a readiness overlay and military branch stats.
 * Themed red border, follows sidebar widget pattern.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { Shield } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { buildBaseStyle, getCountryColor, MAP_SYMBOL_FONTS } from "~/lib/map-config";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import { MapPin, Loader2 } from "lucide-react";

interface DefenseMapWidgetProps {
  countryId: string;
  countryName: string;
  className?: string;
}

export function DefenseMapWidget({
  countryId,
  countryName: _countryName,
  className = "",
}: DefenseMapWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const {
    geometry,
    centroid,
    bbox,
    featureId,
    fillColor,
    subdivisions,
    isLoading: geoLoading,
    hasGeometry,
  } = useCountryMapEmbed(countryId);

  const { data: securityData, isLoading: securityLoading } =
    api.security.getSecurityAssessment.useQuery(
      { countryId },
      { enabled: !!countryId, staleTime: 5 * 60_000 }
    );

  const { data: branches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 5 * 60_000 }
  );

  const isLoading = geoLoading || securityLoading;
  const securityScore = securityData?.overallSecurityScore ?? 0;
  const securityLevel = securityData?.securityLevel?.replace("_", " ") ?? "unknown";
  const branchCount = branches?.length ?? 0;
  const avgReadiness = branchCount > 0
    ? Math.round(branches!.reduce((sum, b) => sum + (b.readinessLevel ?? 0), 0) / branchCount)
    : 0;

  const readinessColor =
    avgReadiness >= 75 ? "text-green-500" :
    avgReadiness >= 50 ? "text-yellow-500" :
    "text-red-500";

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

    const initialCenter: [number, number] = centroid
      ? [centroid.lng, centroid.lat]
      : [10, 5];

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

      // ── Subdivision boundaries (defense zones) ──
      if (subdivisions.length > 0) {
        const subGeo: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: subdivisions
            .filter((s) => s.geometry)
            .map((s) => ({
              type: "Feature" as const,
              properties: { name: s.name },
              geometry: s.geometry as GeoJSON.Geometry,
            })),
        };

        map.addSource("source-subdivisions", { type: "geojson", data: subGeo });

        // Subdivision fills with slight opacity variation for "zone" feel
        map.addLayer({
          id: "subdivision-fill",
          type: "fill",
          source: "source-subdivisions",
          paint: {
            "fill-color": "#ef4444",
            "fill-opacity": 0.08,
          },
        });

        map.addLayer({
          id: "subdivision-stroke",
          type: "line",
          source: "source-subdivisions",
          paint: {
            "line-color": "#ef4444",
            "line-width": 0.8,
            "line-dasharray": [4, 2],
            "line-opacity": 0.6,
          },
        });

        // Zone labels
        map.addLayer({
          id: "subdivision-labels",
          type: "symbol",
          source: "source-subdivisions",
          layout: {
            "text-field": ["get", "name"] as unknown as string,
            "text-size": 9,
            "text-allow-overlap": false,
            "text-optional": true,
            "text-font": [...MAP_SYMBOL_FONTS.regular],
          },
          paint: {
            "text-color": "#ef4444",
            "text-halo-color": "#fff",
            "text-halo-width": 1,
            "text-opacity": 0.7,
          },
          minzoom: 5,
        });
      }

      // ── Country fill ──
      map.addSource("source-country", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: geometry as GeoJSON.Geometry,
          }],
        },
      });

      map.addLayer({
        id: "country-fill",
        type: "fill",
        source: "source-country",
        paint: { "fill-color": color, "fill-opacity": 0.35 },
      });

      map.addLayer({
        id: "country-stroke",
        type: "line",
        source: "source-country",
        paint: { "line-color": "#ef4444", "line-width": 2 },
      });

      // Fit to bounds
      if (bbox) {
        map.fitBounds(
          [[bbox.minLng, bbox.minLat], [bbox.maxLng, bbox.maxLat]],
          { padding: 40, maxZoom: 10, duration: 0 }
        );
      }

      setMapReady(true);
    });
  }, [geometry, centroid, bbox, featureId, fillColor, subdivisions]);

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
      <div className={`glass-hierarchy-child overflow-hidden rounded-xl border border-red-500/15 ${className}`}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Defense Overview</span>
          </div>
        </div>
        <div className="flex h-48 items-center justify-center bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!hasGeometry) {
    return (
      <div className={`glass-hierarchy-child overflow-hidden rounded-xl border border-red-500/15 ${className}`}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Defense Overview</span>
          </div>
        </div>
        <div className="flex h-48 flex-col items-center justify-center gap-2 bg-muted">
          <MapPin className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">No map data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-hierarchy-child overflow-hidden rounded-xl border border-red-500/15 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-red-500" />
          <span className="text-xs font-medium text-foreground">Defense Overview</span>
        </div>
        <Badge
          variant="outline"
          className={`h-4 px-1.5 text-[9px] ${
            securityScore >= 75
              ? "border-green-500/30 text-green-500"
              : securityScore >= 50
                ? "border-yellow-500/30 text-yellow-500"
                : "border-red-500/30 text-red-500"
          }`}
        >
          {securityLevel.toUpperCase()}
        </Badge>
      </div>

      {/* Map */}
      <div className="relative h-48">
        <div ref={containerRef} className="absolute inset-0" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between border-t border-border/50 px-3 py-1.5">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{branchCount} branches</span>
          <span className={readinessColor}>{avgReadiness}% ready</span>
          {(securityData?.activeThreatCount ?? 0) > 0 && (
            <span className="text-red-500">{securityData?.activeThreatCount} threats</span>
          )}
        </div>
        <a
          href={createUrl(`/maps?country=${countryId}`)}
          className="text-[10px] text-red-500 hover:text-red-600"
        >
          Full map →
        </a>
      </div>
    </div>
  );
}
