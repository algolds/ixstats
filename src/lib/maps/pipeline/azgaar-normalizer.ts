/**
 * Azgaar Graph Normalizer
 *
 * Translates Azgaar / Voronoi packed graph outputs into IxStates-compatible
 * GeoJSON layer collections and entity payloads (Country, City, Subdivision, NamedRiver, etc.)
 */

import type { FeatureCollection } from "geojson";
import type { PackedGraph } from "~/lib/worldgen/types";
import { exportToGeoJSON } from "~/lib/worldgen/export-geojson";
import { exportToGeoJSON as exportToGeoJSONV2 } from "~/lib/worldgen/v2/export";
import { cellLng, cellLat } from "~/lib/worldgen/voronoi-mesh";

export interface NormalizedCountryPayload {
  featureId: string;
  name: string;
  color: string;
  areaSqKm: number;
  centroid: [number, number];
  boundingBox: [number, number, number, number];
  capitalName?: string;
  capitalCoordinates?: [number, number];
}

export interface NormalizedCityPayload {
  name: string;
  type: string;
  coordinates: [number, number];
  population: number;
  isCapital: boolean;
  countryFeatureId: string;
}

export interface NormalizedRiverPayload {
  name: string;
  geometry: any;
  lengthKm: number;
  countryFeatureId?: string;
}

export interface NormalizedMapData {
  layers: Record<string, FeatureCollection>;
  countries: NormalizedCountryPayload[];
  cities: NormalizedCityPayload[];
  rivers: NormalizedRiverPayload[];
  metadata: {
    seed: number;
    cellCount: number;
    countryCount: number;
    cityCount: number;
    riverCount: number;
  };
}

/**
 * Normalize a PackedGraph output into structured realm map layers and entity datasets.
 */
export function normalizeAzgaarGraph(graph: PackedGraph, seed = 42): NormalizedMapData {
  // 1. Export 7 GeoJSON layers sharing 100% identical cell topology & boundary alignment
  const isV2Graph =
    graph &&
    graph.cells &&
    ((graph.cells as any).isLand !== undefined || (graph.cells as any).plate !== undefined);
  const rawLayers = isV2Graph ? exportToGeoJSONV2(graph as any) : exportToGeoJSON(graph);

  // 2. Extract country metadata from states and political layer
  const countries: NormalizedCountryPayload[] = [];
  const politicalLayer = rawLayers.political;

  if (politicalLayer && politicalLayer.features) {
    for (const feat of politicalLayer.features) {
      const props = feat.properties || {};
      const featureId = String(
        props.id || props.featureId || props._id || `state_${countries.length}`
      );
      const name = String(props.name || props._displayName || `Nation ${countries.length + 1}`);
      const color = String(props.fill || props._fillColor || "#3b82f6");
      const areaSqKm = Number(props.areaSqKm || props._areaSqKm || 50000);
      const centroid: [number, number] = [
        Number(props._centroidLng ?? props.centroidLng ?? 0),
        Number(props._centroidLat ?? props.centroidLat ?? 0),
      ];
      const bbox = (props.boundingBox as [number, number, number, number]) || [-180, -90, 180, 90];

      countries.push({
        featureId,
        name,
        color,
        areaSqKm,
        centroid,
        boundingBox: bbox,
        capitalName: props.capitalName ? String(props.capitalName) : undefined,
      });
    }
  }

  // Fallback if no states generated
  if (countries.length === 0 && graph.states) {
    for (const state of graph.states) {
      if (!state || !state.id || !state.name) continue; // skip invalid/unclaimed
      countries.push({
        featureId: `state_${state.id}`,
        name: state.name,
        color: state.color || "#6366f1",
        areaSqKm: state.area || 100000,
        centroid: [0, 0],
        boundingBox: [-180, -90, 180, 90],
      });
    }
  }

  // 3. Extract city markers from settlements or burgs
  const cities: NormalizedCityPayload[] = [];
  const burgList = (graph as any).settlements || graph.burgs || [];
  for (const burg of burgList) {
    if (!burg || !burg.name) continue;
    const countryFeatureId = burg.state
      ? `state_${burg.state}`
      : countries[0]?.featureId || "unclaimed";
    cities.push({
      name: burg.name,
      type: burg.isCapital ? "national_capital" : "city",
      coordinates: [burg.lng ?? 0, burg.lat ?? 0],
      population: Math.round(burg.population || 50000),
      isCapital: Boolean(burg.isCapital),
      countryFeatureId,
    });
  }

  // 4. Extract named rivers
  const rivers: NormalizedRiverPayload[] = [];
  if (graph.rivers) {
    for (const river of graph.rivers) {
      if (!river || !river.name || !river.cells) continue;
      const coordinates = Array.isArray(river.cells)
        ? river.cells.map((ci: any) =>
            typeof ci === "number" ? [cellLng(graph, ci), cellLat(graph, ci)] : ci
          )
        : [];
      rivers.push({
        name: river.name,
        geometry: {
          type: "LineString",
          coordinates,
        },
        lengthKm: Math.round((river as any).lengthKm || (river as any).length || 100),
      });
    }
  }

  return {
    layers: rawLayers,
    countries,
    cities,
    rivers,
    metadata: {
      seed,
      cellCount: graph.cells.n,
      countryCount: countries.length,
      cityCount: cities.length,
      riverCount: rivers.length,
    },
  };
}
