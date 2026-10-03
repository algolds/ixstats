import type {
  ExpressionSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  MapGeoJSONFeature,
  MapMouseEvent,
  Popup,
} from "maplibre-gl";
import type { Point as GeoPoint } from "geojson";
import type { SelectedCountry, SelectedFeature } from "../IxWorldMap";
import { INTERACTION_COLORS } from "~/lib/maps/map-config";
import { transientMapStore } from "../../editor/utils/transientStore";
import { escHtml } from "./map-core-helpers";

const POLITICAL_SOURCE = "source-political";
const SUBDIVISION_SOURCE = "source-overlay-subdivisions";
const SUBDIVISION_FILL = "overlay-subdivisions-fill";
const MARKER_LAYERS = ["overlay-cities-circle", "capitals-star", "overlay-pois-circle"];
const CLICK_LAYERS = [...MARKER_LAYERS, "story-pins-icon"];
const HOVER_LAYERS = [...MARKER_LAYERS, SUBDIVISION_FILL, "story-pins-icon"];

/** Which political polygon / overlay marker / subdivision the pointer currently highlights. */
export interface HoverState {
  featureId: number | null;
  overlayKey: string | null;
  subdivisionId: number | null;
}

type Props = Record<string, unknown>;
type CountryHoverHandler = ((country: SelectedCountry | null) => void) | undefined;

/** True when a screen point is on the visible globe disc (or anywhere on a flat map). */
export function isPointOnGlobeOrMap(map: MapLibreMap, pt: { x: number; y: number }): boolean {
  try {
    // `transform` is an undocumented internal that MapLibre 6 no longer exposes on the public
    // Map type; still probed defensively at runtime, with the geometric fallback below covering
    // both the "missing" and "removed" cases.
    const transform = (map as unknown as { transform?: { isPointOnMapSurface?: unknown } })
      .transform;
    if (typeof transform?.isPointOnMapSurface === "function") {
      return transform.isPointOnMapSurface(pt) as boolean;
    }
  } catch (err) {
    console.debug("[useWorldMapInteractions] Point surface check error:", err);
  }

  // Fallback for flat projection / high zoom or missing transform method
  if (map.getZoom() >= 4.5) return true;
  const canvas = map.getCanvas();
  if (!canvas) return true;
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight / 2;
  const cursorDistSq = (pt.x - cx) ** 2 + (pt.y - cy) ** 2;

  const center = map.getCenter();
  let edgeLat = center.lat - 88;
  if (edgeLat < -90) edgeLat = center.lat + 88;
  const edgeScreen = map.project({ lng: center.lng, lat: edgeLat });
  const radiusSq = (edgeScreen.x - cx) ** 2 + (edgeScreen.y - cy) ** 2;
  return radiusSq > 0 ? cursorDistSq <= radiusSq : true;
}

function setHover(map: MapLibreMap, source: string, id: number, hover: boolean) {
  if (!map.getSource(source)) return;
  try {
    map.setFeatureState({ source, id }, { hover });
  } catch (err) {
    console.debug("[useWorldMapInteractions] Hover state error:", err);
  }
}

function clearSubdivisionHover(map: MapLibreMap, hover: HoverState) {
  if (hover.subdivisionId === null) return;
  setHover(map, SUBDIVISION_SOURCE, hover.subdivisionId, false);
  hover.subdivisionId = null;
}

/** Drop every hover highlight (pointer left the globe or the canvas). */
export function clearAllHover(
  map: MapLibreMap,
  hover: HoverState,
  popup: Popup | null,
  onCountryHover: CountryHoverHandler
) {
  popup?.remove();
  hover.overlayKey = null;
  clearSubdivisionHover(map, hover);
  if (hover.featureId !== null) {
    setHover(map, POLITICAL_SOURCE, hover.featureId, false);
    onCountryHover?.(null);
  }
  hover.featureId = null;
}

const TOOLTIP_TYPES: Record<string, { fallback: string; prop?: string }> = {
  "capitals-star": { fallback: "Capital" },
  "overlay-cities-circle": { prop: "cityType", fallback: "City" },
  "overlay-pois-circle": { prop: "category", fallback: "POI" },
  [SUBDIVISION_FILL]: { prop: "type", fallback: "Region" },
  "story-pins-icon": { fallback: "Story Pin" },
};

function tooltipHtml(layerId: string, name: string, props: Props): string {
  const hint = TOOLTIP_TYPES[layerId];
  const type = hint ? String((hint.prop && props[hint.prop]) || hint.fallback) : "";
  const safeType = escHtml(type);
  const safeName = escHtml(name);
  return safeType
    ? `<strong>${safeName}</strong><span class="ixmap-tt-type">${safeType}</span>`
    : `<strong>${safeName}</strong>`;
}

/** Highlight the overlay marker / subdivision under the pointer and keep its tooltip in step. */
function syncOverlayHover(
  map: MapLibreMap,
  hover: HoverState,
  popup: Popup | null,
  hit: MapGeoJSONFeature | undefined,
  lngLat: { lng: number; lat: number }
) {
  if (!hit) {
    if (hover.overlayKey) {
      hover.overlayKey = null;
      popup?.remove();
    }
    clearSubdivisionHover(map, hover);
    return;
  }

  const props: Props = hit.properties ?? {};
  const name = String(props.name ?? props.title ?? "");
  const layerId = hit.layer?.id ?? "";
  const featureKey = `${layerId}:${props.id ?? name}`;

  const subId = layerId === SUBDIVISION_FILL ? (hit.id as number) : null;
  if (hover.subdivisionId !== subId) {
    clearSubdivisionHover(map, hover);
    if (subId !== null) setHover(map, SUBDIVISION_SOURCE, subId, true);
    hover.subdivisionId = subId;
  }

  if (name && featureKey !== hover.overlayKey) {
    hover.overlayKey = featureKey;
    popup
      ?.setLngLat(lngLat)
      .setHTML(tooltipHtml(layerId, name, props))
      .addTo(map);
  } else if (hover.overlayKey === featureKey) {
    popup?.setLngLat(lngLat);
  }
}

/** Map a political polygon's properties to the selected/hovered country shape. */
function toCountry(properties: MapGeoJSONFeature["properties"]): SelectedCountry {
  return {
    featureId: properties?._id || "",
    displayName: properties?._displayName || "Unknown",
    fillColor: properties?._fillColor || "#e8e5da",
    centroidLng: properties?._centroidLng || 0,
    centroidLat: properties?._centroidLat || 0,
    countryId: (properties?._countryId as string) || null,
  };
}

function syncPoliticalHover(
  map: MapLibreMap,
  hover: HoverState,
  e: MapMouseEvent,
  setCursor: (cursor: string) => void,
  onCountryHover: CountryHoverHandler
) {
  const feature = map.queryRenderedFeatures(e.point, { layers: ["fill-political"] })[0];
  const nextId = feature?.id != null ? (feature.id as number) : null;
  if (hover.featureId === nextId) return;

  if (hover.featureId !== null) setHover(map, POLITICAL_SOURCE, hover.featureId, false);
  hover.featureId = nextId;

  if (!feature || nextId === null) {
    transientMapStore.setHoveredFeatureId(null);
    transientMapStore.setCursorCoords(null);
    onCountryHover?.(null);
    setCursor("");
    return;
  }

  setHover(map, POLITICAL_SOURCE, nextId, true);
  setCursor("pointer");
  const props = feature.properties;
  transientMapStore.setHoveredFeatureId(
    (props?._countryId as string) || (props?._id as string) || String(nextId)
  );
  if (e.lngLat) transientMapStore.setCursorCoords([e.lngLat.lng, e.lngLat.lat]);
  onCountryHover?.(toCountry(props));
}

interface HoverContext {
  map: MapLibreMap;
  hover: HoverState;
  popup: Popup | null;
  isMeasuring: boolean;
  onCountryHover: CountryHoverHandler;
}

/** Pointer moved over the map: update polygon, marker and subdivision highlights + tooltip. */
export function updateHover(
  { map, hover, popup, isMeasuring, onCountryHover }: HoverContext,
  e: MapMouseEvent
) {
  const canvas = map.getCanvas();
  if (!isPointOnGlobeOrMap(map, e.point)) {
    clearAllHover(map, hover, popup, onCountryHover);
    if (!isMeasuring) canvas.style.cursor = "default";
    return;
  }

  const layers = HOVER_LAYERS.filter((id) => map.getLayer(id));
  const overlayHit = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : undefined;
  syncOverlayHover(map, hover, popup, overlayHit, e.lngLat);
  if (overlayHit && !isMeasuring) canvas.style.cursor = "pointer";

  syncPoliticalHover(
    map,
    hover,
    e,
    (cursor) => {
      if (!isMeasuring && !overlayHit) canvas.style.cursor = cursor;
    },
    onCountryHover
  );
}

const FEATURE_TYPES: Record<string, SelectedFeature["featureType"]> = {
  "story-pins-icon": "storyPin",
  "overlay-pois-circle": "poi",
  "capitals-star": "capital",
};

const str = (v: unknown) => (v ? String(v) : undefined);
const strOrNull = (v: unknown) => (v ? String(v) : null);
const numOrNull = (v: unknown) => (v != null ? Number(v) : null);

/** Type-specific fields of a clicked overlay marker. */
const FEATURE_EXTRAS: Record<
  SelectedFeature["featureType"],
  (p: Props) => Partial<SelectedFeature>
> = {
  city: (p) => ({
    cityType: str(p.cityType),
    population: numOrNull(p.population),
    isCapital: !!p.isCapital,
  }),
  capital: (p) => ({
    cityType: str(p.cityType),
    population: numOrNull(p.population),
    isCapital: true,
  }),
  poi: (p) => ({
    category: str(p.category),
    icon: strOrNull(p.icon),
    description: strOrNull(p.description),
  }),
  storyPin: (p) => ({
    category: str(p.category),
    ixTimeYear: numOrNull(p.ixTimeYear),
    eraLabel: strOrNull(p.eraLabel),
  }),
};

/** The overlay marker (city, capital, POI, story pin) under a click, if any. */
export function pickOverlayFeature(
  map: MapLibreMap,
  point: MapMouseEvent["point"]
): SelectedFeature | null {
  const layers = CLICK_LAYERS.filter((id) => map.getLayer(id));
  const hit = layers.length ? map.queryRenderedFeatures(point, { layers })[0] : undefined;
  if (!hit) return null;

  const props: Props = hit.properties ?? {};
  const featureType = FEATURE_TYPES[hit.layer?.id ?? ""] ?? "city";
  return {
    id: String(props.id ?? ""),
    featureType,
    name: String((featureType === "storyPin" ? props.title : props.name) ?? ""),
    countryId: String(props.countryId ?? ""),
    countryName: String(props.countryName ?? ""),
    countrySlug: strOrNull(props.countrySlug),
    coordinates: (hit.geometry as GeoPoint).coordinates as [number, number],
    ...FEATURE_EXTRAS[featureType](props),
    wikiPageTitle: strOrNull(props.wikiPageTitle),
  };
}

/** The political country polygon under a click, if any. */
export function pickCountry(
  map: MapLibreMap,
  point: MapMouseEvent["point"]
): SelectedCountry | null {
  const feature = map.queryRenderedFeatures(point, { layers: ["fill-political"] })[0];
  return feature ? toCountry(feature.properties) : null;
}

const whenSelected = (on: number, off: number): ExpressionSpecification => [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  on,
  off,
];

export const SELECTED_COUNTRY_LAYERS: LayerSpecification[] = [
  {
    id: "selected-country-fill",
    type: "fill",
    source: POLITICAL_SOURCE,
    paint: {
      "fill-color": INTERACTION_COLORS.selected,
      "fill-opacity": whenSelected(0.4, 0),
    },
  },
  {
    id: "selected-country-outline",
    type: "line",
    source: POLITICAL_SOURCE,
    paint: {
      "line-color": INTERACTION_COLORS.selectedStroke,
      "line-width": whenSelected(3, 0),
    },
  },
];
