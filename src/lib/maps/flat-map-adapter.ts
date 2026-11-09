"use client";

/**
 * Flat mode for a MapLibre map that switches projection (the /maps world map, World Studio): while on, the map
 * draws Plate Carrée through Mercator (flat-projection.ts) and every coordinate crossing the map's API is
 * converted, so callers keep passing and reading true latitudes. Off, the map behaves exactly as before.
 *
 * Converted while on:
 * - `project` / `unproject` (events' `lngLat`, markers and popups go through these), `getCenter`, `getBounds`;
 * - camera calls: `jumpTo` / `easeTo` / `flyTo` (`center`, `around`), `fitBounds`, `cameraForBounds`;
 * - GeoJSON: `addSource` with inline data, `GeoJSONSource.setData` with an object (a URL string is the caller's
 *   to convert), and the geometry of `queryRenderedFeatures` / `querySourceFeatures` results (read lazily);
 * - image corners: `addSource`, `ImageSource.updateImage`.
 * Not converted: `updateData` diffs, tile sources (point them at their flat URLs), canvas and video sources.
 *
 * Only the outermost call converts: MapLibre calls `jumpTo` from `easeTo`, `getCenter` from its handlers and so
 * on, and those nested calls already speak carrier coordinates. Switching re-pushes each GeoJSON source's last
 * true data and each image's true corners, keeps the view on the same place, and tells `onFlatModeChange` listeners.
 * Install it when the map is created (`applyFlatMode(map, false, …)`), so sources added before a switch are tracked.
 */
import type { GeoJSON, Geometry } from "geojson";
import type {
  Coordinates,
  GeoJSONSource,
  ImageSource,
  LngLatBoundsLike,
  LngLatLike,
  Map as MapLibreMap,
  SourceSpecification,
  UpdateImageOptions,
} from "maplibre-gl";
import {
  clampFlatCenterLat,
  fromCarrierGeometry,
  fromCarrierLat,
  toCarrierGeoJSON,
  toCarrierLat,
} from "./flat-projection";
import { loadMaplibre } from "./load-maplibre";
import { MERCATOR_MAX_LAT } from "./realm-map-settings";

/** The MapLibre classes the adapter builds and patches (the module, or a stand-in in tests). */
export type FlatMaplibre = Pick<
  typeof import("maplibre-gl"),
  "LngLat" | "LngLatBounds" | "GeoJSONSource" | "ImageSource"
>;

interface FlatState {
  on: boolean;
  /** How deep in converted calls we are; only depth 0 converts. */
  depth: number;
}

const states = new WeakMap<MapLibreMap, FlatState>();
const trueData = new WeakMap<GeoJSONSource, GeoJSON>();
const trueCorners = new WeakMap<ImageSource, Coordinates>();
/** The map each source was added to: a source learns its own `map` only once MapLibre adds it to the style. */
const sourceMap = new WeakMap<GeoJSONSource | ImageSource, MapLibreMap>();
const flatSource = (source: GeoJSONSource | ImageSource) =>
  isFlatMap(sourceMap.get(source) ?? source.map);
const patchedModules = new WeakSet<FlatMaplibre>();

/** Whether `map` is drawing flat (Plate Carrée) right now. */
export function isFlatMap(map: MapLibreMap | null | undefined): boolean {
  return !!map && states.get(map)?.on === true;
}

const listeners = new WeakMap<MapLibreMap, Set<() => void>>();

/** Run `listener` after `map` switches to or from flat; returns the unsubscribe. */
export function onFlatModeChange(map: MapLibreMap, listener: () => void): () => void {
  const set = listeners.get(map) ?? new Set<() => void>();
  listeners.set(map, set);
  set.add(listener);
  return () => set.delete(listener);
}

function lngLatOf(ll: LngLatLike): { lng: number; lat: number } {
  if (Array.isArray(ll)) return { lng: ll[0], lat: ll[1] };
  return "lng" in ll ? { lng: ll.lng, lat: ll.lat } : { lng: ll.lon, lat: ll.lat };
}

const carrierLngLat = (ll: LngLatLike): [number, number] => {
  const { lng, lat } = lngLatOf(ll);
  return [lng, toCarrierLat(lat)];
};

const carrierCorners = (c: Coordinates): Coordinates =>
  c.map(([lng, lat]) => [lng, toCarrierLat(lat)]) as Coordinates;

/** Corners held inside Mercator's range: a flat image pinned at the poles, until its owner re-syncs it. */
const mercatorCorners = (c: Coordinates): Coordinates =>
  c.map(([lng, lat]) => [
    lng,
    Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat)),
  ]) as Coordinates;

function carrierCamera<T extends { center?: LngLatLike; around?: LngLatLike }>(options: T): T {
  return {
    ...options,
    ...(options.center !== undefined ? { center: carrierLngLat(options.center) } : {}),
    ...(options.around !== undefined ? { around: carrierLngLat(options.around) } : {}),
  };
}

/** A queried feature whose geometry reads back in true coordinates, converted on first read. */
function trueFeature<F extends { geometry: Geometry }>(feature: F): F {
  const getter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(feature), "geometry")?.get;
  if (!getter) {
    feature.geometry = fromCarrierGeometry(feature.geometry);
    return feature;
  }
  const read: () => Geometry = getter.bind(feature);
  let geometry: Geometry | undefined;
  Object.defineProperty(feature, "geometry", {
    configurable: true,
    get: () => (geometry ??= fromCarrierGeometry(read())),
    set: (value: Geometry) => {
      geometry = value;
    },
  });
  return feature;
}

/** GeoJSON `setData` and image `updateImage` convert for flat maps and remember what they were given. Once. */
function patchSources(m: FlatMaplibre): void {
  if (patchedModules.has(m)) return;
  patchedModules.add(m);
  const setData = m.GeoJSONSource.prototype.setData;
  m.GeoJSONSource.prototype.setData = function (this: GeoJSONSource, data: GeoJSON | string) {
    if (typeof data === "string") {
      trueData.delete(this);
      return setData.call(this, data);
    }
    trueData.set(this, data);
    return setData.call(this, flatSource(this) ? toCarrierGeoJSON(data) : data);
  };
  const updateImage = m.ImageSource.prototype.updateImage;
  m.ImageSource.prototype.updateImage = function (this: ImageSource, options: UpdateImageOptions) {
    if (!options.coordinates) return updateImage.call(this, options);
    trueCorners.set(this, options.coordinates);
    return updateImage.call(
      this,
      flatSource(this) ? { ...options, coordinates: carrierCorners(options.coordinates) } : options
    );
  };
}

/** Wraps the map's own methods once; they pass straight through until flat mode is on. */
function install(map: MapLibreMap, m: FlatMaplibre): FlatState {
  const existing = states.get(map);
  if (existing) return existing;
  patchSources(m);
  const st: FlatState = { on: false, depth: 0 };
  states.set(map, st);
  const live = () => st.on && st.depth === 0;
  const nest = <R>(run: () => R): R => {
    st.depth++;
    try {
      return run();
    } finally {
      st.depth--;
    }
  };
  const toTrue = (ll: { lng: number; lat: number }) => new m.LngLat(ll.lng, fromCarrierLat(ll.lat));
  const carrierBounds = (bounds: LngLatBoundsLike) => {
    const b = m.LngLatBounds.convert(bounds);
    return new m.LngLatBounds(
      [b.getWest(), toCarrierLat(b.getSouth())],
      [b.getEast(), toCarrierLat(b.getNorth())]
    );
  };

  const { project, unproject, getCenter, getBounds, jumpTo, easeTo, flyTo } = map;
  const { fitBounds, cameraForBounds, queryRenderedFeatures, querySourceFeatures, addSource } = map;
  map.project = (ll) => {
    const c = live();
    return nest(() => project.call(map, c ? carrierLngLat(ll) : ll));
  };
  map.unproject = (point) => {
    const c = live();
    const ll = nest(() => unproject.call(map, point));
    return c ? toTrue(ll) : ll;
  };
  map.getCenter = () => {
    const c = live();
    const ll = nest(() => getCenter.call(map));
    return c ? toTrue(ll) : ll;
  };
  map.getBounds = () => {
    const c = live();
    const b = nest(() => getBounds.call(map));
    if (!c) return b;
    return new m.LngLatBounds(
      [b.getWest(), fromCarrierLat(b.getSouth())],
      [b.getEast(), fromCarrierLat(b.getNorth())]
    );
  };
  map.jumpTo = (options, eventData) => {
    const c = live();
    return nest(() => jumpTo.call(map, c ? carrierCamera(options) : options, eventData));
  };
  map.easeTo = (options, eventData) => {
    const c = live();
    return nest(() => easeTo.call(map, c ? carrierCamera(options) : options, eventData));
  };
  map.flyTo = (options, eventData) => {
    const c = live();
    return nest(() => flyTo.call(map, c ? carrierCamera(options) : options, eventData));
  };
  map.fitBounds = (bounds, options, eventData) => {
    const c = live();
    return nest(() => fitBounds.call(map, c ? carrierBounds(bounds) : bounds, options, eventData));
  };
  map.cameraForBounds = (bounds, options) => {
    const c = live();
    const camera = nest(() =>
      cameraForBounds.call(map, c ? carrierBounds(bounds) : bounds, options)
    );
    return c && camera?.center
      ? { ...camera, center: toTrue(m.LngLat.convert(camera.center)) }
      : camera;
  };
  map.queryRenderedFeatures = (...args: Parameters<MapLibreMap["queryRenderedFeatures"]>) => {
    const c = live();
    const found = nest(() => queryRenderedFeatures.apply(map, args));
    return c ? found.map(trueFeature) : found;
  };
  map.querySourceFeatures = (...args: Parameters<MapLibreMap["querySourceFeatures"]>) => {
    const c = live();
    const found = nest(() => querySourceFeatures.apply(map, args));
    return c ? found.map(trueFeature) : found;
  };
  map.addSource = (id: string, spec: SourceSpecification) => {
    const inline = spec.type === "geojson" && typeof spec.data === "object" ? spec.data : null;
    const corners = spec.type === "image" ? spec.coordinates : null;
    let given = spec;
    if (st.on && inline) given = { ...spec, data: toCarrierGeoJSON(inline) } as SourceSpecification;
    if (st.on && corners)
      given = { ...spec, coordinates: carrierCorners(corners) } as SourceSpecification;
    const result = addSource.call(map, id, given);
    const source = map.getSource(id);
    if (source instanceof m.GeoJSONSource || source instanceof m.ImageSource)
      sourceMap.set(source, map);
    if (inline && source instanceof m.GeoJSONSource) trueData.set(source, inline);
    if (corners && source instanceof m.ImageSource) trueCorners.set(source, corners);
    return result;
  };
  return st;
}

/**
 * Switch `map` to flat (Plate Carrée) or back, with the module's classes given (the testable core of
 * `setFlatMode`). The caller sets the projection itself: flat is Mercator underneath.
 */
export function applyFlatMode(map: MapLibreMap, on: boolean, m: FlatMaplibre): void {
  const st = install(map, m);
  if (st.on === on) return;
  const center = map.getCenter();
  const zoom = map.getZoom();
  st.on = on;
  map.setTransformConstrain(
    on
      ? (c, z) => ({
          center: new m.LngLat(
            c.lng,
            clampFlatCenterLat(c.lat, z, map.getContainer().clientHeight)
          ),
          zoom: z,
        })
      : null
  );
  // ponytail: getStyle() serialises the style; fine for a mode switch, never per frame
  for (const id of Object.keys(map.getStyle()?.sources ?? {})) {
    const source = map.getSource(id);
    if (source instanceof m.GeoJSONSource) {
      const data = trueData.get(source);
      if (data) void source.setData(data);
    } else if (source instanceof m.ImageSource) {
      const corners = trueCorners.get(source);
      if (corners) source.setCoordinates(on ? carrierCorners(corners) : mercatorCorners(corners));
    }
  }
  map.jumpTo({ center, zoom });
  for (const listener of listeners.get(map) ?? []) listener();
}

/** Switch `map` to flat (Plate Carrée) or back; see the module comment. */
export async function setFlatMode(map: MapLibreMap, on: boolean): Promise<void> {
  // A map never switched to flat has nothing to undo (and needn't load MapLibre to say so)
  if (!on && !states.get(map)?.on) return;
  applyFlatMode(map, on, await loadMaplibre());
}
