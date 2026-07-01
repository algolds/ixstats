// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * Pure layer builders for map snapshots. Given a (reset) MapLibre instance + data,
 * they add the static sources/layers for one preview. No interactivity, no hover,
 * no zoom-LOD, no DOM markers (a DOM Marker is not captured by canvas.toDataURL —
 * the pin here is a circle layer on purpose). Mirrors the visual output of the live
 * embeds using the same colors/fonts so previews match the origin.
 */

import { getCountryColor, MAP_SYMBOL_FONTS } from "~/lib/map-config";
import { createStarImage } from "~/components/maps/core/utils/map-core-helpers";

/** Data shape a country preview needs (subset of useCountryMapEmbed's result). */
export interface CountrySnapshotData {
  countryId: string;
  geometry: GeoJSON.Geometry | null;
  fillColor?: string | null;
  featureId?: string | null;
  displayName?: string | null;
  cities?: Array<{
    id: string;
    name: string;
    coordinates: [number, number] | null;
    isNationalCapital?: boolean;
    isSubdivisionCapital?: boolean;
    population?: number | null;
  }>;
  capital?: unknown;
  subdivisions?: Array<{ id: string; name: string; geometry?: GeoJSON.Geometry | null }>;
  worldPolitical?: GeoJSON.FeatureCollection;
}

export interface CountrySnapshotOpts {
  showNeighbors?: boolean;
  showCities?: boolean;
  showSubdivisions?: boolean;
}

export function buildCountryLayers(
  map: any,
  maplibregl: any,
  data: CountrySnapshotData,
  opts: CountrySnapshotOpts = {}
) {
  const { showNeighbors = true, showCities = true, showSubdivisions = false } = opts;
  const countryId = data.countryId;

  // Dimmed neighbours (everything that isn't this country).
  if (showNeighbors && data.worldPolitical?.features?.length) {
    const others: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: data.worldPolitical.features.filter(
        (f: any) => f.properties?._countryId !== countryId
      ),
    };
    map.addSource("snap-world", { type: "geojson", data: others });
    map.addLayer({
      id: "snap-world-fill",
      type: "fill",
      source: "snap-world",
      paint: { "fill-color": "#94a3b8", "fill-opacity": 0.2 },
    });
    map.addLayer({
      id: "snap-world-stroke",
      type: "line",
      source: "snap-world",
      paint: { "line-color": "#64748b", "line-width": 0.5, "line-opacity": 0.4 },
    });
  }

  // Subdivision boundaries (dashed).
  if (showSubdivisions && data.subdivisions?.length) {
    const subGeo: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: data.subdivisions
        .filter((s) => s.geometry)
        .map((s) => ({
          type: "Feature" as const,
          properties: { name: s.name },
          geometry: s.geometry as GeoJSON.Geometry,
        })),
    };
    map.addSource("snap-subs", { type: "geojson", data: subGeo });
    map.addLayer({
      id: "snap-subs-stroke",
      type: "line",
      source: "snap-subs",
      paint: { "line-color": "#666", "line-width": 0.5, "line-dasharray": [3, 2] },
    });
  }

  // Target country fill + stroke.
  if (data.geometry) {
    const color = data.fillColor || (data.featureId ? getCountryColor(data.featureId) : "#c5cae9");
    map.addSource("snap-country", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: data.geometry }],
      } as GeoJSON.FeatureCollection,
    });
    map.addLayer({
      id: "snap-country-fill",
      type: "fill",
      source: "snap-country",
      paint: { "fill-color": color, "fill-opacity": 0.45 },
    });
    map.addLayer({
      id: "snap-country-stroke",
      type: "line",
      source: "snap-country",
      paint: { "line-color": "#333", "line-width": 1.5 },
    });
  }

  // Capital + notable cities (static: capital star, dots for capitals/large cities).
  if (showCities && data.cities?.length) {
    const feats: GeoJSON.Feature[] = [];
    for (const c of data.cities) {
      const coords = c.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length < 2) continue;
      const isRegionCap = !!c.isSubdivisionCapital;
      if (!c.isNationalCapital && !isRegionCap && (c.population ?? 0) < 500000) continue;
      feats.push({
        type: "Feature",
        properties: { name: c.name, isCapital: !!c.isNationalCapital },
        geometry: { type: "Point", coordinates: coords },
      });
    }
    if (feats.length) {
      map.addSource("snap-cities", {
        type: "geojson",
        data: { type: "FeatureCollection", features: feats } as GeoJSON.FeatureCollection,
      });
      if (!map.hasImage("snap-capital-star")) {
        map.addImage("snap-capital-star", createStarImage(24, "#d4a017", "#7a5c00"), { sdf: false });
      }
      map.addLayer({
        id: "snap-capital-star",
        type: "symbol",
        source: "snap-cities",
        filter: ["==", ["get", "isCapital"], true],
        layout: {
          "icon-image": "snap-capital-star",
          "icon-size": 0.7,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      map.addLayer({
        id: "snap-city-dots",
        type: "circle",
        source: "snap-cities",
        filter: ["!=", ["get", "isCapital"], true],
        paint: {
          "circle-radius": 3,
          "circle-color": "#555",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "snap-city-labels",
        type: "symbol",
        source: "snap-cities",
        filter: ["==", ["get", "isCapital"], true],
        layout: {
          "text-field": ["get", "name"] as unknown as string,
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-optional": true,
          "text-font": [...MAP_SYMBOL_FONTS.regular],
        },
        paint: { "text-color": "#333", "text-halo-color": "#fff", "text-halo-width": 1.5 },
      });
    }
  }
}

export interface CoordsSnapshotData {
  lat: number;
  lng: number;
  title?: string;
  worldPolitical?: GeoJSON.FeatureCollection;
}

export function buildCoordsLayers(map: any, _maplibregl: any, data: CoordsSnapshotData) {
  if (data.worldPolitical?.features?.length) {
    map.addSource("snap-world", { type: "geojson", data: data.worldPolitical });
    map.addLayer({
      id: "snap-world-fill",
      type: "fill",
      source: "snap-world",
      paint: {
        "fill-color": ["coalesce", ["get", "_fillColor"], ["get", "fillColor"], "#c5cae9"],
        "fill-opacity": 0.45,
      },
    });
    map.addLayer({
      id: "snap-world-stroke",
      type: "line",
      source: "snap-world",
      paint: { "line-color": "#475569", "line-width": 0.8, "line-opacity": 0.5 },
    });
    map.addLayer({
      id: "snap-world-labels",
      type: "symbol",
      source: "snap-world",
      layout: {
        "text-field": ["coalesce", ["get", "_displayName"], ["get", "name"], ""] as unknown as string,
        "text-size": 10,
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

  // Red pin as a circle layer (DOM markers aren't captured by toDataURL).
  map.addSource("snap-pin", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [data.lng, data.lat] } },
      ],
    } as GeoJSON.FeatureCollection,
  });
  map.addLayer({
    id: "snap-pin-circle",
    type: "circle",
    source: "snap-pin",
    paint: {
      "circle-radius": 6,
      "circle-color": "#ef4444",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
}
