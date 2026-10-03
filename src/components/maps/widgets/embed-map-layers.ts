import type { FilterSpecification, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { getCountryColor, MAP_SYMBOL_FONTS } from "~/lib/maps/map-config";
import { createStarImage } from "~/components/maps/core/utils/map-core-helpers";
import type { useCountryMapEmbedState } from "./hooks/useCountryMapEmbedState";

type EmbedState = ReturnType<typeof useCountryMapEmbedState>;

export interface EmbedLayerOptions {
  state: EmbedState;
  countryId: string;
  showNeighbors: boolean;
  showCities: boolean;
  showSubdivisions: boolean;
  boundsPadding: number;
  onCountryClick?: () => void;
  onNeighborClick?: (countryId: string) => void;
  onFeatureClick?: (feature: { kind: "city" | "subdivision"; id: string }) => void;
}

const EMBED_LAYER_IDS = [
  "world-political-fill",
  "world-political-stroke",
  "neighbor-labels",
  "highlighted-countries-fill",
  "highlighted-countries-stroke",
  "highlighted-labels",
  "subdivision-fill",
  "subdivision-stroke",
  "country-fill",
  "country-stroke",
  "capital-star",
  "city-circles",
  "city-labels",
];

const EMBED_SOURCE_IDS = [
  "source-world-political",
  "source-highlighted-countries",
  "source-subdivisions",
  "source-country",
  "source-cities",
];

const WORLD_MAP_LAYERS = [
  "fill-background",
  "fill-altitudes",
  "fill-climate",
  "fill-biomes",
  "fill-political",
  "stroke-political",
  "fill-lakes",
  "line-rivers",
  "fill-icecaps",
  "country-name-labels",
  "sovereignty-border",
  "sovereignty-labels",
];

/** Hide the (empty) base world layers; the embed draws its own. */
function hideWorldLayers(map: MapLibreMap) {
  for (const id of WORLD_MAP_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
  }
}

function removeEmbedLayers(map: MapLibreMap) {
  for (const id of EMBED_LAYER_IDS) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of EMBED_SOURCE_IDS) if (map.getSource(id)) map.removeSource(id);
}

const collection = (features: Feature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

const featureProps = (e: MapLayerMouseEvent) => e.features?.[0]?.properties;

/** Pointer cursor + click handler for a layer. */
function bindClickable(
  map: MapLibreMap,
  layerId: string,
  onClick: (e: MapLayerMouseEvent) => void
) {
  map.on("click", layerId, onClick);
  map.on("mouseenter", layerId, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", layerId, () => {
    map.getCanvas().style.cursor = "";
  });
}

function isHighlighted(
  f: Feature,
  { highlightIdsMemo: ids, highlightNamesMemo: names }: EmbedState
) {
  const p = f.properties;
  return (
    ids.has(p?._countryId) ||
    ids.has(p?.countryId) ||
    names.has(p?._id) ||
    names.has(p?.id) ||
    names.has(p?._displayName)
  );
}

function isTargetCountry(f: Feature, countryId: string, state: EmbedState) {
  const p = f.properties;
  return (
    p?._countryId === countryId ||
    (!!state.featureId && (p?._id === state.featureId || p?.id === state.featureId)) ||
    (!!state.displayName && p?._displayName === state.displayName)
  );
}

const labelLayout = (size: number, font: readonly string[]) => ({
  "text-field": ["coalesce", ["get", "_displayName"], ""] as unknown as string,
  "text-size": size,
  "text-allow-overlap": false,
  "text-optional": true,
  "text-font": [...font],
});

/** Grey neighbour countries, plus highlighted (partner embassy) countries in their own colour. */
function addWorldPolitical(map: MapLibreMap, o: EmbedLayerOptions) {
  const { state, countryId, showNeighbors, onNeighborClick } = o;
  if (!state.worldPolitical?.features.length) return;

  const others: Feature[] = [];
  const highlighted: Feature[] = [];
  for (const f of state.worldPolitical.features) {
    if (isTargetCountry(f, countryId, state)) continue;
    (isHighlighted(f, state) ? highlighted : others).push(f);
  }

  map.addSource("source-world-political", { type: "geojson", data: collection(others) });
  map.addLayer({
    id: "world-political-fill",
    type: "fill",
    source: "source-world-political",
    paint: { "fill-color": "#94a3b8", "fill-opacity": 0.2 },
  });
  map.addLayer({
    id: "world-political-stroke",
    type: "line",
    source: "source-world-political",
    paint: { "line-color": "#64748b", "line-width": 0.5, "line-opacity": 0.4 },
  });
  if (showNeighbors) {
    map.addLayer({
      id: "neighbor-labels",
      type: "symbol",
      source: "source-world-political",
      layout: labelLayout(10, MAP_SYMBOL_FONTS.regular),
      paint: {
        "text-color": "#64748b",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1,
        "text-opacity": 0.7,
      },
      minzoom: 3,
    });
  }

  if (highlighted.length === 0) return;
  map.addSource("source-highlighted-countries", { type: "geojson", data: collection(highlighted) });
  map.addLayer({
    id: "highlighted-countries-fill",
    type: "fill",
    source: "source-highlighted-countries",
    paint: { "fill-color": ["coalesce", ["get", "_fillColor"], "#06b6d4"], "fill-opacity": 0.45 },
  });
  map.addLayer({
    id: "highlighted-countries-stroke",
    type: "line",
    source: "source-highlighted-countries",
    paint: { "line-color": "#333", "line-width": 1.2 },
  });

  const clickNeighbor =
    onNeighborClick &&
    ((e: MapLayerMouseEvent) => {
      const props = featureProps(e);
      const cid = props?.countryId || props?._countryId;
      if (cid) onNeighborClick(cid);
    });
  if (showNeighbors) {
    map.addLayer({
      id: "highlighted-labels",
      type: "symbol",
      source: "source-highlighted-countries",
      layout: labelLayout(10.5, MAP_SYMBOL_FONTS.bold),
      paint: {
        "text-color": "#0e7490", // Cyan/Teal labels for partner countries
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5,
        "text-opacity": 0.95,
      },
      minzoom: 2,
    });
    if (clickNeighbor) bindClickable(map, "highlighted-labels", clickNeighbor);
  }
  if (clickNeighbor) bindClickable(map, "highlighted-countries-fill", clickNeighbor);
}

function addSubdivisions(map: MapLibreMap, o: EmbedLayerOptions) {
  const subdivisions = o.state.subdivisions;
  if (!o.showSubdivisions || !subdivisions.length) return;

  const features = subdivisions
    .filter((s) => s.geometry)
    .map((s): Feature => ({
      type: "Feature",
      properties: { name: s.name, _subId: s.id },
      geometry: s.geometry as Geometry,
    }));
  map.addSource("source-subdivisions", { type: "geojson", data: collection(features) });

  // Invisible fill for click targeting (only when click-to-manage is active)
  if (o.onFeatureClick) {
    map.addLayer({
      id: "subdivision-fill",
      type: "fill",
      source: "source-subdivisions",
      paint: { "fill-color": "#666", "fill-opacity": 0.01 },
    });
  }
  map.addLayer({
    id: "subdivision-stroke",
    type: "line",
    source: "source-subdivisions",
    paint: { "line-color": "#666", "line-width": 0.5, "line-dasharray": [3, 2] },
  });
}

function addCountry(map: MapLibreMap, { state }: EmbedLayerOptions) {
  const color = state.fillColor || (state.featureId ? getCountryColor(state.featureId) : "#c5cae9");
  const feature: Feature = {
    type: "Feature",
    properties: { _fillColor: color },
    geometry: state.geometry as Geometry,
  };
  map.addSource("source-country", { type: "geojson", data: collection([feature]) });
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
    paint: { "line-color": "#333", "line-width": 1.5 },
  });
}

/** Sentinel "never" population threshold (Infinity isn't valid in expressions). */
const NEVER = 1e15;

/**
 * Cities reveal relative to the zoom the fitted view settles at, so the default view shows only
 * the national capital regardless of country size; region capitals then cities appear as the
 * user zooms in past that baseline and hide again when zooming back out.
 */
const CITY_REVEAL_TIERS = [
  { delta: 3, popThreshold: 0, regionCapitals: true },
  { delta: 2, popThreshold: 100000, regionCapitals: true },
  { delta: 1, popThreshold: 500000, regionCapitals: true },
];

function bindCityReveal(map: MapLibreMap) {
  let baselineZoom: number | null = null;
  let lastThreshold: number | null = null; // skip rebuilding the filter on every zoom frame

  const update = () => {
    const zoom = map.getZoom();
    // Before the fit settles, treat the current zoom as the baseline → capitals only.
    const delta = zoom - (baselineZoom ?? zoom);
    const tier = CITY_REVEAL_TIERS.find((t) => delta >= t.delta);
    const popThreshold = tier?.popThreshold ?? NEVER;
    if (lastThreshold === popThreshold) return;
    lastThreshold = popThreshold;

    const anyOf: unknown[] = [[">=", ["coalesce", ["get", "population"], 0], popThreshold]];
    if (tier?.regionCapitals) anyOf.push(["==", ["get", "isRegionCapital"], true]);
    if (map.getLayer("city-circles")) {
      map.setFilter("city-circles", [
        "all",
        ["!=", ["get", "isCapital"], true],
        ["any", ...anyOf],
      ] as FilterSpecification);
    }
  };

  map.on("zoom", update);
  update();
  return () => {
    baselineZoom = map.getZoom();
    update();
  };
}

const isCapitalFilter = ["==", ["get", "isCapital"], true] as FilterSpecification;

/** City markers; returns the callback to run once the fitted view has settled. */
function addCities(map: MapLibreMap, o: EmbedLayerOptions): (() => void) | undefined {
  const { state, onFeatureClick } = o;
  if (!o.showCities) return;

  const features = state.cities.flatMap((city: any): Feature[] => {
    const coords = city.coordinates as [number, number] | null;
    if (!Array.isArray(coords) || coords.length < 2) return [];

    // Only national capitals, region capitals, and cities over 200k population
    const isRegionCapital = !!city.isSubdivisionCapital;
    if (!city.isNationalCapital && !isRegionCapital && (city.population ?? 0) < 200000) return [];

    return [
      {
        type: "Feature",
        properties: {
          _cityId: city.id,
          name: city.name,
          isCapital: city.isNationalCapital,
          isRegionCapital,
          population: city.population,
        },
        geometry: { type: "Point", coordinates: coords },
      },
    ];
  });
  if (features.length === 0) return;

  map.addSource("source-cities", { type: "geojson", data: collection(features) });

  if (state.capital) {
    if (!map.hasImage("capital-star")) {
      map.addImage("capital-star", createStarImage(24, "#d4a017", "#7a5c00"), { sdf: false });
    }
    map.addLayer({
      id: "capital-star",
      type: "symbol",
      source: "source-cities",
      filter: isCapitalFilter,
      layout: {
        "icon-image": "capital-star",
        "icon-size": 0.7,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }

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
  map.addLayer({
    id: "city-labels",
    type: "symbol",
    source: "source-cities",
    filter: isCapitalFilter,
    layout: {
      "text-field": ["get", "name"] as unknown as string,
      "text-size": 11,
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-optional": true,
      "text-font": [...MAP_SYMBOL_FONTS.regular],
    },
    paint: { "text-color": "#333", "text-halo-color": "#fff", "text-halo-width": 1.5 },
  });

  const settle = bindCityReveal(map);

  // Show non-capital labels on hover of city markers
  let hoveredCityId: string | null = null;
  map.on("mousemove", "city-circles", (e) => {
    const id = featureProps(e)?._cityId;
    if (!e.features?.length || id === hoveredCityId) return;
    hoveredCityId = id;
    map.getCanvas().style.cursor = "pointer";
    map.setFilter("city-labels", [
      "any",
      isCapitalFilter,
      ["==", ["get", "_cityId"], id],
    ] as FilterSpecification);
  });
  map.on("mouseleave", "city-circles", () => {
    hoveredCityId = null;
    map.getCanvas().style.cursor = "";
    map.setFilter("city-labels", isCapitalFilter);
  });

  if (onFeatureClick) {
    for (const layerId of ["city-circles", "capital-star"]) {
      bindClickable(map, layerId, (e) => {
        const id = featureProps(e)?._cityId;
        if (id) onFeatureClick({ kind: "city", id: String(id) });
      });
    }
  }
  return settle;
}

type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

const centroidOf = (f: Feature): [number, number] | null => {
  const lng = f.properties?._centroidLng;
  const lat = f.properties?._centroidLat;
  return typeof lng === "number" && typeof lat === "number" ? [lng, lat] : null;
};

/** The country's own bbox, grown to cover the centroids of any highlighted countries. */
function fitBbox(state: EmbedState): Bbox | null {
  let bbox: Bbox | null = state.bbox ? { ...state.bbox } : null;
  const hasHighlights = state.highlightIdsMemo.size > 0 || state.highlightNamesMemo.size > 0;
  if (!hasHighlights || !state.worldPolitical) return bbox;

  const points = state.worldPolitical.features
    .filter((f) => isHighlighted(f, state))
    .map(centroidOf);
  const first = points[0];
  if (!bbox && first) {
    bbox = { minLng: first[0], minLat: first[1], maxLng: first[0], maxLat: first[1] };
  }
  if (bbox) {
    for (const p of points) {
      if (!p) continue;
      bbox.minLng = Math.min(bbox.minLng, p[0]);
      bbox.maxLng = Math.max(bbox.maxLng, p[0]);
      bbox.minLat = Math.min(bbox.minLat, p[1]);
      bbox.maxLat = Math.max(bbox.maxLat, p[1]);
    }
  }
  return bbox;
}

/** Draw the embed's own layers onto a freshly loaded map and wire up its interactions. */
export function populateEmbedMap(map: MapLibreMap, o: EmbedLayerOptions) {
  hideWorldLayers(map);
  removeEmbedLayers(map);

  addWorldPolitical(map, o);
  addSubdivisions(map, o);
  addCountry(map, o);
  const onFitSettled = addCities(map, o);

  const bbox = fitBbox(o.state);
  if (bbox) {
    map.fitBounds(
      [
        [bbox.minLng, bbox.minLat],
        [bbox.maxLng, bbox.maxLat],
      ],
      { padding: o.boundsPadding, maxZoom: 10, duration: 0 }
    );
    map.once("idle", () => onFitSettled?.());
  }

  const { onCountryClick, onNeighborClick, onFeatureClick } = o;
  if (onCountryClick) map.on("click", "country-fill", () => onCountryClick());
  if (onNeighborClick && o.showNeighbors) {
    bindClickable(map, "neighbor-labels", (e) => {
      const cid = featureProps(e)?.countryId;
      if (cid) onNeighborClick(cid);
    });
  }
  if (onFeatureClick && o.showSubdivisions) {
    bindClickable(map, "subdivision-fill", (e) => {
      const id = featureProps(e)?._subId;
      if (id) onFeatureClick({ kind: "subdivision", id: String(id) });
    });
  }
}
