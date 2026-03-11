"use client";

/**
 * CountryMapEmbed - Lightweight country-focused MapLibre map.
 *
 * Renders a single country's territory zoomed to its bounding box,
 * with dimmed neighbors, city markers, and capital stars.
 * Much lighter than MapContainer (2-4 sources vs 10+).
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { buildBaseStyle, getCountryColor } from "~/lib/map-config";
import { MapPin, Loader2 } from "lucide-react";

export interface CountryMapEmbedProps {
  countryId: string;
  height?: string;
  className?: string;
  showNeighbors?: boolean;
  showCities?: boolean;
  showSubdivisions?: boolean;
  interactive?: boolean;
  onCountryClick?: () => void;
  onNeighborClick?: (countryId: string) => void;
  boundsPadding?: number;
}

/** 5-pointed star image for capital markers */
function createStarImage(size: number, fill: string, stroke: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 1;
  const innerR = outerR * 0.4;
  const spikes = 5;

  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 2) * -1 + (Math.PI / spikes) * i;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

export function CountryMapEmbed({
  countryId,
  height = "h-64",
  className = "",
  showNeighbors = true,
  showCities = true,
  showSubdivisions = false,
  interactive = true,
  onCountryClick,
  onNeighborClick,
  boundsPadding = 40,
}: CountryMapEmbedProps) {
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
    cities,
    capital,
    subdivisions,
    isLoading,
    hasGeometry,
  } = useCountryMapEmbed(countryId);

  // Build neighbor GeoJSON
  const neighborGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const initMap = useCallback(async () => {
    if (!containerRef.current || !geometry) return;

    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    // Clean up existing
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const baseStyle = buildBaseStyle() as maplibregl.StyleSpecification;
    // Force mercator for country embeds (no globe transition needed)
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
      interactive,
    });

    mapRef.current = map;

    map.on("load", () => {
      // ── Neighbor fill (dimmed context) ──
      if (showNeighbors && neighbors.length > 0) {
        // We don't have neighbor geometries from the getNeighbors endpoint.
        // Instead, render a subtle point marker at each neighbor centroid.
        const neighborPoints: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: neighbors
            .filter((n) => n.centroidLng && n.centroidLat)
            .map((n) => ({
              type: "Feature" as const,
              properties: {
                name: n.displayName,
                countryId: n.countryId,
              },
              geometry: {
                type: "Point" as const,
                coordinates: [n.centroidLng, n.centroidLat],
              },
            })),
        };
        neighborGeoRef.current = neighborPoints;

        map.addSource("source-neighbors", {
          type: "geojson",
          data: neighborPoints,
        });

        // Neighbor name labels
        map.addLayer({
          id: "neighbor-labels",
          type: "symbol",
          source: "source-neighbors",
          layout: {
            "text-field": ["get", "name"] as unknown as string,
            "text-size": 10,
            "text-allow-overlap": false,
            "text-optional": true,
            "text-font": ["DejaVu Sans Regular"],
          },
          paint: {
            "text-color": "#888",
            "text-halo-color": "#fff",
            "text-halo-width": 1,
          },
          minzoom: 3,
        });
      }

      // ── Subdivision boundaries ──
      if (showSubdivisions && subdivisions.length > 0) {
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

        map.addLayer({
          id: "subdivision-stroke",
          type: "line",
          source: "source-subdivisions",
          paint: {
            "line-color": "#666",
            "line-width": 0.5,
            "line-dasharray": [3, 2],
          },
        });
      }

      // ── Country fill ──
      const countryColor =
        fillColor || (featureId ? getCountryColor(featureId) : "#c5cae9");

      const countryGeo: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { _fillColor: countryColor },
            geometry: geometry as GeoJSON.Geometry,
          },
        ],
      };

      map.addSource("source-country", { type: "geojson", data: countryGeo });

      map.addLayer({
        id: "country-fill",
        type: "fill",
        source: "source-country",
        paint: {
          "fill-color": countryColor,
          "fill-opacity": 0.45,
        },
      });

      map.addLayer({
        id: "country-stroke",
        type: "line",
        source: "source-country",
        paint: {
          "line-color": "#333",
          "line-width": 1.5,
        },
      });

      // ── City markers ──
      if (showCities && cities.length > 0) {
        const cityFeatures: GeoJSON.Feature[] = [];

        for (const city of cities) {
          const coords = city.coordinates as [number, number] | null;
          if (!coords || !Array.isArray(coords) || coords.length < 2) continue;

          cityFeatures.push({
            type: "Feature",
            properties: {
              name: city.name,
              isCapital: city.isNationalCapital,
              population: city.population,
            },
            geometry: {
              type: "Point",
              coordinates: coords,
            },
          });
        }

        if (cityFeatures.length > 0) {
          const cityGeo: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: cityFeatures,
          };

          map.addSource("source-cities", { type: "geojson", data: cityGeo });

          // Capital star icon
          if (capital) {
            const starImg = createStarImage(24, "#d4a017", "#7a5c00");
            map.addImage("capital-star", starImg, { sdf: false });

            map.addLayer({
              id: "capital-star",
              type: "symbol",
              source: "source-cities",
              filter: ["==", ["get", "isCapital"], true],
              layout: {
                "icon-image": "capital-star",
                "icon-size": 0.7,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
            });
          }

          // Non-capital city dots
          map.addLayer({
            id: "city-circles",
            type: "circle",
            source: "source-cities",
            filter: ["!=", ["get", "isCapital"], true],
            paint: {
              "circle-radius": 3,
              "circle-color": "#555",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1,
            },
          });

          // City name labels
          map.addLayer({
            id: "city-labels",
            type: "symbol",
            source: "source-cities",
            layout: {
              "text-field": ["get", "name"] as unknown as string,
              "text-size": 11,
              "text-offset": [0, 1.2],
              "text-anchor": "top",
              "text-allow-overlap": false,
              "text-optional": true,
              "text-font": ["DejaVu Sans Regular"],
            },
            paint: {
              "text-color": "#333",
              "text-halo-color": "#fff",
              "text-halo-width": 1.5,
            },
          });
        }
      }

      // ── Fit to bounds ──
      if (bbox) {
        map.fitBounds(
          [
            [bbox.minLng, bbox.minLat],
            [bbox.maxLng, bbox.maxLat],
          ],
          { padding: boundsPadding, maxZoom: 10, duration: 0 }
        );
      }

      // ── Click handlers ──
      if (onCountryClick) {
        map.on("click", "country-fill", () => onCountryClick());
      }

      if (onNeighborClick && showNeighbors) {
        map.on("click", "neighbor-labels", (e) => {
          const cid = e.features?.[0]?.properties?.countryId;
          if (cid) onNeighborClick(cid);
        });
        map.on("mouseenter", "neighbor-labels", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "neighbor-labels", () => {
          map.getCanvas().style.cursor = "";
        });
      }

      setMapReady(true);
    });
  }, [
    geometry,
    centroid,
    bbox,
    featureId,
    fillColor,
    neighbors,
    cities,
    capital,
    subdivisions,
    showNeighbors,
    showCities,
    showSubdivisions,
    interactive,
    onCountryClick,
    onNeighborClick,
    boundsPadding,
  ]);

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

  // ── Loading state ──
  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${height} ${className}`}
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── No geometry fallback ──
  if (!hasGeometry) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-muted ${height} ${className}`}
      >
        <MapPin className="h-6 w-6 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          No map data available
        </span>
      </div>
    );
  }

  return (
    <div className={`relative ${height} ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
