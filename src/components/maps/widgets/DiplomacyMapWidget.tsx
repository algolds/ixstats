"use client";

/**
 * DiplomacyMapWidget - Minimal embassy network map.
 *
 * Flat mercator projection showing only the home country and partner countries
 * with dashed connection lines. No world layer — just the relevant geometries.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { Building2, MapPin, Loader2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { buildBaseStyle, getCountryColor } from "~/lib/map-config";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";

interface DiplomacyMapWidgetProps {
  countryId: string;
  countryName: string;
  className?: string;
}

export function DiplomacyMapWidget({
  countryId,
  countryName: _countryName,
  className = "",
}: DiplomacyMapWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  // Fetch home country geometry
  const { data: homeGeo, isLoading: homeLoading } = api.geo.getCountryGeometry.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30 * 60_000 },
  );

  // Fetch embassies
  const { data: embassies, isLoading: embassyLoading } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 5 * 60_000 },
  );

  // Get active partner country IDs
  const partnerIds = useMemo(() => {
    if (!embassies) return [];
    const ids = new Set<string>();
    for (const e of embassies) {
      if (e.countryId && e.countryId !== countryId && (e.status === "ACTIVE" || e.status === "active")) {
        ids.add(e.countryId);
      }
    }
    return Array.from(ids);
  }, [embassies, countryId]);

  // Fetch geometry for first partner (keep it minimal — one query, not N)
  const firstPartnerId = partnerIds[0] ?? null;
  const { data: partnerGeo, isLoading: partnerLoading } = api.geo.getCountryGeometry.useQuery(
    { countryId: firstPartnerId! },
    { enabled: !!firstPartnerId, staleTime: 30 * 60_000 },
  );

  const partnersLoading = !!firstPartnerId && partnerLoading;
  const partnerGeos = useMemo(() => {
    if (!firstPartnerId || !partnerGeo) return [];
    return [{ id: firstPartnerId, geo: partnerGeo }];
  }, [firstPartnerId, partnerGeo]);

  const isLoading = homeLoading || embassyLoading;
  const hasGeometry = !!homeGeo?.geometry;
  const activePartnerCount = partnerIds.length;

  // Initialize map once all data is ready
  useEffect(() => {
    if (!containerRef.current || !homeGeo?.geometry || !homeGeo?.centroid) return;
    if (initializedRef.current) return;
    // Don't wait for partners if there are none
    if (partnerIds.length > 0 && partnersLoading) return;

    initializedRef.current = true;

    let map: any = null;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css");

      if (!containerRef.current) return;

      const baseStyle = buildBaseStyle() as any;
      delete baseStyle.projection; // Force flat mercator

      map = new maplibregl.Map({
        container: containerRef.current,
        style: baseStyle,
        center: [homeGeo.centroid!.lng, homeGeo.centroid!.lat],
        zoom: 3,
        attributionControl: false,
        interactive: true,
      });

      mapRef.current = map;

      map.on("load", () => {
        const homeColor = homeGeo.featureId ? getCountryColor(homeGeo.featureId) : "#c5cae9";

        // ── Home country ──
        map.addSource("home", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: homeGeo.geometry },
        });
        map.addLayer({
          id: "home-fill",
          type: "fill",
          source: "home",
          paint: { "fill-color": homeColor, "fill-opacity": 0.5 },
        });
        map.addLayer({
          id: "home-stroke",
          type: "line",
          source: "home",
          paint: { "line-color": "#06b6d4", "line-width": 2 },
        });

        // ── Partner countries ──
        const connectionLines: GeoJSON.Feature[] = [];

        for (const partner of partnerGeos) {
          if (!partner.geo.geometry || !partner.geo.centroid) continue;

          const pColor = partner.geo.featureId ? getCountryColor(partner.geo.featureId) : "#06b6d4";

          map.addSource(`partner-${partner.id}`, {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: partner.geo.geometry },
          });
          map.addLayer({
            id: `partner-fill-${partner.id}`,
            type: "fill",
            source: `partner-${partner.id}`,
            paint: { "fill-color": pColor, "fill-opacity": 0.35 },
          });
          map.addLayer({
            id: `partner-stroke-${partner.id}`,
            type: "line",
            source: `partner-${partner.id}`,
            paint: { "line-color": "#06b6d4", "line-width": 1.5, "line-opacity": 0.6 },
          });

          // Connection line
          connectionLines.push({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [homeGeo.centroid!.lng, homeGeo.centroid!.lat],
                [partner.geo.centroid.lng, partner.geo.centroid.lat],
              ],
            },
          });
        }

        // ── Connection lines ──
        if (connectionLines.length > 0) {
          map.addSource("connections", {
            type: "geojson",
            data: { type: "FeatureCollection", features: connectionLines },
          });
          map.addLayer({
            id: "connection-lines",
            type: "line",
            source: "connections",
            paint: {
              "line-color": "#06b6d4",
              "line-width": 1.5,
              "line-opacity": 0.5,
              "line-dasharray": [4, 4],
            },
          });
        }

        // ── Fit bounds to show all countries ──
        if (homeGeo.bbox) {
          let minLng = homeGeo.bbox.minLng;
          let maxLng = homeGeo.bbox.maxLng;
          let minLat = homeGeo.bbox.minLat;
          let maxLat = homeGeo.bbox.maxLat;

          for (const partner of partnerGeos) {
            if (partner.geo.bbox) {
              minLng = Math.min(minLng, partner.geo.bbox.minLng);
              maxLng = Math.max(maxLng, partner.geo.bbox.maxLng);
              minLat = Math.min(minLat, partner.geo.bbox.minLat);
              maxLat = Math.max(maxLat, partner.geo.bbox.maxLat);
            }
          }

          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 40, maxZoom: 6, duration: 0 }
          );
        }

        setMapReady(true);
      });
    })();

    return () => {
      if (map) {
        map.remove();
        mapRef.current = null;
        initializedRef.current = false;
        setMapReady(false);
      }
    };
  }, [homeGeo, partnerGeos, partnerIds.length, partnersLoading]);

  if (isLoading) {
    return (
      <div className={`glass-hierarchy-child overflow-hidden rounded-xl border border-cyan-500/15 ${className}`}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Embassy Network</span>
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
      <div className={`glass-hierarchy-child overflow-hidden rounded-xl border border-cyan-500/15 ${className}`}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Embassy Network</span>
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
    <div className={`glass-hierarchy-child overflow-hidden rounded-xl border border-cyan-500/15 ${className}`}>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-cyan-500" />
          <span className="text-xs font-medium">Embassy Network</span>
        </div>
        <Badge variant="outline" className="h-4 border-cyan-500/30 px-1.5 text-[9px] text-cyan-500">
          {activePartnerCount} PARTNER{activePartnerCount !== 1 ? "S" : ""}
        </Badge>
      </div>

      <div className="relative h-48">
        <div ref={containerRef} className="absolute inset-0" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          {activePartnerCount} active embass{activePartnerCount !== 1 ? "ies" : "y"}
        </span>
        <a href={createUrl(`/maps?country=${countryId}`)} className="text-[10px] text-cyan-500 hover:text-cyan-600">
          Full map →
        </a>
      </div>
    </div>
  );
}
