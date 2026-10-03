/**
 * Azgaar Graph Normalizer
 *
 * Translates Azgaar / Voronoi packed graph outputs into IxStates-compatible
 * GeoJSON layer collections and entity payloads (Country, City, Subdivision, NamedRiver, etc.)
 */

import type { FeatureCollection } from "geojson";
import type { PackedGraph } from "~/lib/worldgen/types";
import { exportToGeoJSON } from "~/lib/worldgen/v2/export";
import { cellLng, cellLat } from "~/lib/worldgen/v2/mesh";

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

interface NormalizedCityPayload {
  name: string;
  type: string;
  coordinates: [number, number];
  population: number;
  isCapital: boolean;
  countryFeatureId: string;
}

interface NormalizedRiverPayload {
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

/** First truthy value, mirroring a chain of `||` fallbacks. */
const firstTruthy = <T>(...values: T[]): T | undefined => values.find(Boolean);

/** Countries from the political layer, else from the graph's states. */
function extractCountries(
  politicalLayer: FeatureCollection | undefined,
  graph: PackedGraph
): NormalizedCountryPayload[] {
  const countries: NormalizedCountryPayload[] = (politicalLayer?.features ?? []).map(
    (feat, i): NormalizedCountryPayload => {
      const props = feat.properties || {};
      return {
        featureId: String(firstTruthy(props.id, props.featureId, props._id) ?? `state_${i}`),
        name: String(firstTruthy(props.name, props._displayName) ?? `Nation ${i + 1}`),
        color: String(firstTruthy(props.fill, props._fillColor) ?? "#3b82f6"),
        areaSqKm: Number(firstTruthy(props.areaSqKm, props._areaSqKm) ?? 50000),
        centroid: [
          Number(props._centroidLng ?? props.centroidLng ?? 0),
          Number(props._centroidLat ?? props.centroidLat ?? 0),
        ],
        boundingBox: (props.boundingBox as [number, number, number, number]) || [
          -180, -90, 180, 90,
        ],
        capitalName: props.capitalName ? String(props.capitalName) : undefined,
      };
    }
  );
  if (countries.length > 0) return countries;

  // Fallback if no states generated: skip invalid/unclaimed states
  return (graph.states ?? [])
    .filter((state) => state?.id && state.name)
    .map((state) => ({
      featureId: `state_${state.id}`,
      name: state.name,
      color: state.color || "#6366f1",
      areaSqKm: state.area || 100000,
      centroid: [0, 0],
      boundingBox: [-180, -90, 180, 90],
    }));
}

/** City markers from settlements or burgs. */
function extractCities(graph: PackedGraph, fallbackCountryId: string): NormalizedCityPayload[] {
  const burgList = (graph as any).settlements || graph.burgs || [];
  return burgList
    .filter((burg: any) => burg?.name)
    .map((burg: any): NormalizedCityPayload => ({
      name: burg.name,
      type: burg.isCapital ? "national_capital" : "city",
      coordinates: [burg.lng ?? 0, burg.lat ?? 0],
      population: Math.round(burg.population || 50000),
      isCapital: Boolean(burg.isCapital),
      countryFeatureId: burg.state ? `state_${burg.state}` : fallbackCountryId,
    }));
}

function extractRivers(graph: PackedGraph): NormalizedRiverPayload[] {
  return (graph.rivers ?? [])
    .filter((river) => river?.name && river.cells)
    .map((river) => ({
      name: river.name,
      geometry: {
        type: "LineString",
        coordinates: Array.isArray(river.cells)
          ? river.cells.map((ci: any) =>
              typeof ci === "number" ? [cellLng(graph as any, ci), cellLat(graph as any, ci)] : ci
            )
          : [],
      },
      lengthKm: Math.round((river as any).lengthKm || (river as any).length || 100),
    }));
}

/**
 * Normalize a PackedGraph output into structured realm map layers and entity datasets.
 */
export function normalizeAzgaarGraph(graph: PackedGraph, seed = 42): NormalizedMapData {
  // 7 GeoJSON layers sharing identical cell topology and boundary alignment
  const layers = exportToGeoJSON(graph as any);
  const countries = extractCountries(layers.political, graph);
  const cities = extractCities(graph, countries[0]?.featureId || "unclaimed");
  const rivers = extractRivers(graph);

  return {
    layers,
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
