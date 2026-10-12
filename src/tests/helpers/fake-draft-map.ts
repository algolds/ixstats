/**
 * A MapLibre map reduced to what the world preview touches: an ordered style with layout properties, sources
 * (GeoJSON and image) and `on`/`off`/`emit`. It is as strict as the real map where a mistake would show:
 * removing a source a layer still uses, or adding a layer before one that does not exist, throws.
 */
import type { Map as MapLibreMap } from "maplibre-gl";

type Spec = { id: string; type?: string; source?: string; layout?: Record<string, string> };

type SpecValue = string | number | boolean | undefined | SpecValue[] | { [key: string]: SpecValue };

type ImageUpdate = { image: { data: Uint8ClampedArray }; coordinates?: SpecValue };

export type FakeSource = {
  spec: Record<string, SpecValue>;
  setData: jest.Mock<Promise<void>, [string]>;
  updateImage: jest.Mock<void, [ImageUpdate]>;
};

/** The parts of a MapLibre event the preview reads (`error` events carry the id of a failing source too). */
type MapEvent = { sourceId?: string; isSourceLoaded?: boolean };
type Handler = (event: MapEvent) => void;

export function fakeDraftMap(live: (string | { id: string; visibility: string })[] = []) {
  const order: string[] = [];
  const layers = new Map<string, { spec: Spec; layout: Record<string, string> }>();
  const sources = new Map<string, FakeSource>();
  const handlers = new Map<string, Set<Handler>>();
  const style = { _loaded: true };

  const putLayer = (spec: Spec, before?: string) => {
    if (before !== undefined && !layers.has(before)) throw new Error(`no layer ${before}`);
    layers.set(spec.id, { spec, layout: { ...spec.layout } });
    order.splice(before === undefined ? order.length : order.indexOf(before), 0, spec.id);
  };
  const addLive = (item: string | { id: string; visibility: string }) => {
    const id = typeof item === "string" ? item : item.id;
    putLayer({ id, layout: typeof item === "string" ? {} : { visibility: item.visibility } });
  };
  live.forEach(addLive);

  const map = {
    style,
    getLayersOrder: () => [...order],
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    addSource: jest.fn((id: string, spec: Record<string, SpecValue>) => {
      if (sources.has(id)) throw new Error(`source ${id} exists`);
      sources.set(id, {
        spec,
        setData: jest.fn((_url: string) => Promise.resolve()),
        updateImage: jest.fn((_update: ImageUpdate) => {}),
      });
    }),
    removeSource: jest.fn((id: string) => {
      if ([...layers.values()].some((l) => l.spec.source === id)) {
        throw new Error(`source ${id} is in use`);
      }
      sources.delete(id);
    }),
    addLayer: jest.fn((spec: Spec, before?: string) => {
      if (layers.has(spec.id)) throw new Error(`layer ${spec.id} exists`);
      if (spec.source && !sources.has(spec.source)) throw new Error(`no source ${spec.source}`);
      putLayer(spec, before);
    }),
    removeLayer: jest.fn((id: string) => {
      layers.delete(id);
      order.splice(order.indexOf(id), 1);
    }),
    getLayoutProperty: (id: string, name: string) => layers.get(id)?.layout[name],
    // undefined unsets the property, as on the real map
    setLayoutProperty: jest.fn((id: string, name: string, value: string | undefined) => {
      const layer = layers.get(id);
      if (!layer) throw new Error(`no layer ${id}`);
      if (value === undefined) delete layer.layout[name];
      else layer.layout[name] = value;
    }),
    on: jest.fn((type: string, handler: Handler) => {
      handlers.set(type, (handlers.get(type) ?? new Set()).add(handler));
    }),
    off: jest.fn((type: string, handler: Handler) => {
      handlers.get(type)?.delete(handler);
    }),
  };

  return {
    map: map as never as MapLibreMap,
    fake: map,
    order,
    layers,
    sources,
    addLive,
    /** The ids of the draft sources and layers now on the map */
    draftIds: () => order.filter((id) => id.startsWith("worldgen-draft-")),
    visibility: (id: string) => layers.get(id)?.layout.visibility,
    listeners: (type: string) => handlers.get(type)?.size ?? 0,
    emit: (type: string, event: MapEvent = {}) => {
      for (const handler of handlers.get(type) ?? []) handler(event);
    },
    /** A theme change: every source and layer goes, and the live ones are made anew. */
    reload: (again: (string | { id: string; visibility: string })[]) => {
      order.length = 0;
      layers.clear();
      sources.clear();
      again.forEach(addLive);
    },
    setLoaded: (loaded: boolean) => {
      style._loaded = loaded;
    },
  };
}
