import type {
  Map as MapLibreMap,
  GeoJSONSource,
  LayerSpecification,
  MapLayerMouseEvent,
  ExpressionSpecification,
} from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { ROUTE_STYLES, ROUTE_COLORS } from "~/lib/maps/map-config";

export const ROUTES_SOURCE = "transport-routes-source";
export const HUBS_SOURCE = "transport-hubs-source";
export const HUBS_LAYER = "transport-hubs-circle";
export const ROUTES_GLOW_LAYER = "transport-routes-glow";
export const ROUTES_FLOW_LAYER = "transport-routes-flow";
const ROUTES_INTERNATIONAL_LAYER = "transport-routes-international";
const ROUTES_ARROWS_LAYER = "transport-routes-arrows";

interface RouteLayerConfig {
  id: string;
  minzoom: number;
  filter: ExpressionSpecification;
  dash?: [number, number];
}

const routeTypeIn = (types: string[]): ExpressionSpecification => [
  "in",
  ["get", "routeType"],
  ["literal", types],
];

/** Zoom-dependent visibility tiers (Strategic z0, Regional z4, Infrastructure z6) and dashed air/ferry. */
const ROUTE_LAYER_CONFIGS: RouteLayerConfig[] = [
  {
    id: "transport-routes-solid-tier0",
    minzoom: 0,
    filter: routeTypeIn(["rail", "high_speed_rail", "highway", "motorway", "shipping_lane"]),
  },
  {
    id: "transport-routes-solid-tier4",
    minzoom: 4,
    filter: routeTypeIn(["road", "trunk", "canal", "military_supply", "military_naval"]),
  },
  {
    id: "transport-routes-solid-tier6",
    minzoom: 6,
    filter: routeTypeIn([
      "secondary",
      "pipeline",
      "power_grid",
      "fiber",
      "freight_rail",
      "commuter_rail",
    ]),
  },
  {
    id: "transport-routes-dashed-air",
    minzoom: 0,
    filter: ["==", ["get", "routeType"], "air_corridor"],
    dash: [6, 4],
  },
  {
    id: "transport-routes-dashed-ferry",
    minzoom: 4,
    filter: ["==", ["get", "routeType"], "ferry"],
    dash: [4, 3],
  },
];

export const ALL_ROUTE_LAYERS = ROUTE_LAYER_CONFIGS.map((cfg) => cfg.id);

const ALL_TRANSPORT_LAYERS = [
  ROUTES_INTERNATIONAL_LAYER,
  ROUTES_GLOW_LAYER,
  ...ALL_ROUTE_LAYERS,
  ROUTES_FLOW_LAYER,
  ROUTES_ARROWS_LAYER,
  HUBS_LAYER,
];

const HUB_COLORS: Record<string, string> = {
  station: "#64748b",
  port: "#3b82f6",
  airport: "#a855f7",
  junction: "#f59e0b",
  interchange: "#ef4444",
};

const STATUS_OPACITY: Record<string, number> = {
  planned: 0.4,
  under_construction: 0.7,
  operational: 1.0,
  abandoned: 0.3,
};

/** Status opacities while a route is selected (everything else recedes). */
const DIMMED_STATUS_OPACITY: Record<string, number> = {
  planned: 0.2,
  under_construction: 0.35,
  operational: 0.35,
  abandoned: 0.15,
};

const matchExpression = (
  property: string,
  table: Record<string, string | number>,
  fallback: string | number
) =>
  [
    "match",
    ["get", property],
    ...Object.entries(table).flat(),
    fallback,
  ] as ExpressionSpecification;

const COLOR_EXPRESSION = matchExpression("routeType", ROUTE_COLORS, "#888888");
const TYPE_WIDTH_EXPRESSION = matchExpression(
  "routeType",
  Object.fromEntries(Object.entries(ROUTE_STYLES).map(([type, style]) => [type, style.width])),
  1.5
);

const isSelected = (selectedRouteId: string | null | undefined): ExpressionSpecification => [
  "==",
  ["get", "id"],
  selectedRouteId ?? "",
];

const widthExpression = (selectedRouteId: string | null | undefined) =>
  ["case", isSelected(selectedRouteId), 6, TYPE_WIDTH_EXPRESSION] as ExpressionSpecification;

const opacityExpression = (selectedRouteId: string | null | undefined) =>
  [
    "case",
    isSelected(selectedRouteId),
    1.0,
    selectedRouteId
      ? matchExpression("status", DIMMED_STATUS_OPACITY, 0.35)
      : matchExpression("status", STATUS_OPACITY, 0.8),
  ] as ExpressionSpecification;

const radiusByConnections = (one: number, five: number, ten: number) => [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "connections"], 1],
  1,
  one,
  5,
  five,
  10,
  ten,
];

const HUB_RADIUS_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2,
  radiusByConnections(2.5, 4.5, 6.5),
  8,
  radiusByConnections(4.5, 7.5, 11),
  14,
  radiusByConnections(7, 12, 18),
] as ExpressionSpecification;

/** Dash pattern that slides by `offset`, giving the animated "flow" effect on a fixed dash cycle. */
export function buildFlowDashArray(offset: number): [number, number, number, number] {
  const dash = 6;
  const gap = 4;
  const period = dash + gap;
  const s = ((offset % period) + period) % period;

  if (s < dash) {
    return [Math.max(0.01, dash - s), gap, Math.max(0.01, s), 0.01];
  }
  const u = s - dash;
  return [0.01, Math.max(0.01, gap - u), dash, Math.max(0.01, u)];
}

const lineLayout = (visible: boolean) => ({
  "line-cap": "round" as const,
  "line-join": "round" as const,
  visibility: visible ? ("visible" as const) : ("none" as const),
});

interface TransportLayerState {
  hubData?: FeatureCollection;
  routeData: FeatureCollection;
  visible: boolean;
  animateFlows: boolean;
  selectedRouteId: string | null | undefined;
}

/** True when every transport layer (and the hubs layer, if hub data exists) is already on the map. */
export function hasAllTransportLayers(map: MapLibreMap, hasHubs: boolean) {
  return (
    ALL_TRANSPORT_LAYERS.every((id) => id === HUBS_LAYER || map.getLayer(id)) &&
    (!hasHubs || !!map.getLayer(HUBS_LAYER))
  );
}

function buildLayerSpecs({
  hubData,
  visible,
  animateFlows,
  selectedRouteId,
}: TransportLayerState): LayerSpecification[] {
  const specs: unknown[] = [
    {
      id: ROUTES_INTERNATIONAL_LAYER,
      type: "line",
      source: ROUTES_SOURCE,
      filter: ["==", ["get", "isInternational"], true],
      paint: {
        "line-color": "#38bdf8",
        "line-width": ["+", TYPE_WIDTH_EXPRESSION, 3],
        "line-opacity": 0.4,
        "line-blur": 1.5,
      },
      layout: lineLayout(visible),
    },
    {
      id: ROUTES_GLOW_LAYER,
      type: "line",
      source: ROUTES_SOURCE,
      filter: isSelected(selectedRouteId),
      paint: {
        "line-color": COLOR_EXPRESSION,
        "line-width": 12,
        "line-blur": 6,
        "line-opacity": 0.35,
      },
      layout: lineLayout(visible && !!selectedRouteId),
    },
    ...ROUTE_LAYER_CONFIGS.map((cfg) => ({
      id: cfg.id,
      type: "line",
      source: ROUTES_SOURCE,
      minzoom: cfg.minzoom,
      filter: cfg.filter,
      layout: lineLayout(visible),
      paint: {
        "line-color": COLOR_EXPRESSION,
        "line-width": widthExpression(selectedRouteId),
        "line-opacity": opacityExpression(selectedRouteId),
        ...(cfg.dash && { "line-dasharray": cfg.dash }),
      },
    })),
    {
      id: ROUTES_FLOW_LAYER,
      type: "line",
      source: ROUTES_SOURCE,
      filter: ["==", ["get", "status"], "operational"],
      layout: lineLayout(visible && animateFlows),
      paint: {
        "line-color": "#ffffff",
        "line-width": TYPE_WIDTH_EXPRESSION,
        "line-opacity": 0.35,
        "line-dasharray": buildFlowDashArray(0),
      },
    },
    {
      id: ROUTES_ARROWS_LAYER,
      type: "symbol",
      source: ROUTES_SOURCE,
      minzoom: 6,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 150,
        "icon-image": "triangle-15",
        "icon-size": 0.6,
        "icon-rotate": 90,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-color": COLOR_EXPRESSION,
        "icon-opacity": [
          "case",
          ["==", ["get", "status"], "abandoned"],
          0.2,
          ["==", ["get", "status"], "planned"],
          0.3,
          0.6,
        ],
      },
    },
  ];
  if (hubData) {
    specs.push({
      id: HUBS_LAYER,
      type: "circle",
      source: HUBS_SOURCE,
      paint: {
        "circle-radius": HUB_RADIUS_EXPRESSION,
        "circle-color": matchExpression("hubType", HUB_COLORS, "#64748b"),
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.9,
      },
    });
  }
  return specs as LayerSpecification[];
}

/** Editor point layers the transport layers must sit beneath. */
const EDITOR_POINT_LAYERS = [
  "editor-points-capital",
  "editor-points-city",
  "editor-points-poi",
  "editor-points-labels",
  "editor-pending-point-layer",
];

/** Add any missing sources and layers, then order them beneath the editor point layers. */
export function addTransportLayers(map: MapLibreMap, state: TransportLayerState) {
  if (!map.getSource(ROUTES_SOURCE)) {
    map.addSource(ROUTES_SOURCE, { type: "geojson", data: state.routeData });
  }
  if (state.hubData && !map.getSource(HUBS_SOURCE)) {
    map.addSource(HUBS_SOURCE, { type: "geojson", data: state.hubData });
  }
  for (const spec of buildLayerSpecs(state)) {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  }

  const beforeId = EDITOR_POINT_LAYERS.find((id) => map.getLayer(id));
  for (const layerId of ALL_TRANSPORT_LAYERS) {
    if (map.getLayer(layerId)) map.moveLayer(layerId, beforeId);
  }
}

export function removeTransportLayers(map: MapLibreMap) {
  for (const layerId of ALL_TRANSPORT_LAYERS) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  if (map.getSource(HUBS_SOURCE)) map.removeSource(HUBS_SOURCE);
  if (map.getSource(ROUTES_SOURCE)) map.removeSource(ROUTES_SOURCE);
}

type FeatureClick = (id: string, lngLat: { lng: number; lat: number }) => void;

/**
 * Click handler for features of `layers`: reports the clicked feature's id and flags the event so
 * map-level click handlers (country selection) ignore it.
 */
export function createFeatureClickHandler(
  map: MapLibreMap,
  layers: string[],
  getCallback: () => FeatureClick | undefined
) {
  return (e: MapLayerMouseEvent) => {
    const callback = getCallback();
    if (!callback) return;
    const id = map.queryRenderedFeatures(e.point, { layers })[0]?.properties?.id as
      string | undefined;
    if (!id) return;
    (e.originalEvent as MouseEvent & { routeClicked?: boolean }).routeClicked = true;
    (e as MapLayerMouseEvent & { routeClicked?: boolean }).routeClicked = true;
    callback(id, e.lngLat);
    e.preventDefault?.();
  };
}

interface TransportEventHandlers {
  onRouteClick: (e: MapLayerMouseEvent) => void;
  onHubClick: (e: MapLayerMouseEvent) => void;
  onEnter: () => void;
  onLeave: () => void;
}

/** Bind (`bind: true`) or unbind click and hover handlers on the route and hub layers. */
export function setTransportEvents(map: MapLibreMap, h: TransportEventHandlers, bind: boolean) {
  const targets: [string, (e: MapLayerMouseEvent) => void][] = [
    ...ALL_ROUTE_LAYERS.map((id): [string, (e: MapLayerMouseEvent) => void] => [
      id,
      h.onRouteClick,
    ]),
    [HUBS_LAYER, h.onHubClick],
  ];
  for (const [layerId, onClick] of targets) {
    if (bind) {
      // Layers that don't exist yet are skipped; setupLayers rebinds once they do.
      if (!map.getLayer(layerId)) continue;
      map.on("click", layerId, onClick);
      map.on("mouseenter", layerId, h.onEnter);
      map.on("mouseleave", layerId, h.onLeave);
    } else {
      map.off("click", layerId, onClick);
      map.off("mouseenter", layerId, h.onEnter);
      map.off("mouseleave", layerId, h.onLeave);
    }
  }
}

/** Push changed GeoJSON into the route/hub sources (creating them if absent). */
export function syncTransportSources(
  map: MapLibreMap,
  routeData: FeatureCollection,
  hubData: FeatureCollection | undefined,
  prev: { routes: FeatureCollection | null; hubs: FeatureCollection | null }
) {
  const sync = (sourceId: string, data: FeatureCollection, key: "routes" | "hubs") => {
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!source) {
      map.addSource(sourceId, { type: "geojson", data });
      prev[key] = data;
    } else if ("setData" in source && prev[key] !== data) {
      prev[key] = data;
      source.setData(data);
    }
  };
  sync(ROUTES_SOURCE, routeData, "routes");
  if (hubData) sync(HUBS_SOURCE, hubData, "hubs");
}

/** Glow halo and width/opacity emphasis for the selected route (GPU-only property updates). */
export function applyRouteSelection(
  map: MapLibreMap,
  selectedRouteId: string | null | undefined,
  visible: boolean
) {
  if (map.getLayer(ROUTES_GLOW_LAYER)) {
    if (selectedRouteId) map.setFilter(ROUTES_GLOW_LAYER, isSelected(selectedRouteId));
    map.setLayoutProperty(
      ROUTES_GLOW_LAYER,
      "visibility",
      visible && selectedRouteId ? "visible" : "none"
    );
  }
  for (const id of ALL_ROUTE_LAYERS) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "line-width", widthExpression(selectedRouteId));
    map.setPaintProperty(id, "line-opacity", opacityExpression(selectedRouteId));
  }
}

export function applyTransportVisibility(
  map: MapLibreMap,
  { visible, selectedRouteId, animateFlows }: Omit<TransportLayerState, "routeData" | "hubData">
) {
  const shown: Record<string, boolean> = {
    [ROUTES_GLOW_LAYER]: visible && !!selectedRouteId,
    [ROUTES_FLOW_LAYER]: visible && animateFlows,
  };
  for (const layerId of ALL_TRANSPORT_LAYERS) {
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, "visibility", (shown[layerId] ?? visible) ? "visible" : "none");
  }
}

/** Keep routes of the visible types that were already built by `maxBuiltYear`. */
export function filterRouteData(
  data: FeatureCollection,
  visibleTypes: string[] | undefined,
  maxBuiltYear?: number | null
): FeatureCollection {
  const typeSet = visibleTypes?.length ? new Set(visibleTypes) : null;
  const yearLimit = maxBuiltYear ?? null;
  if (!typeSet && yearLimit === null) return data;
  return {
    type: "FeatureCollection",
    features: data.features.filter((f) => {
      if (!f.properties) return false;
      if (typeSet && !typeSet.has(f.properties.routeType as string)) return false;
      const builtYear = f.properties.builtYear;
      return !(yearLimit !== null && typeof builtYear === "number" && builtYear > yearLimit);
    }),
  };
}
