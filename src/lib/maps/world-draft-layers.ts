/**
 * The world editor's draft preview on a MapLibre map: a generated world drawn as sources and layers of its own
 * (ids start with `worldgen-draft-`, so they never meet a live one) while the realm's live layers are hidden.
 *
 * Each GeoJSON layer arrives as a JSON string and goes to the map as a blob URL through `source.setData(url)`, so
 * MapLibre's worker parses it and the main thread only posts a message. A URL is revoked once its source reports
 * loaded or failed, when its layer is dropped, or when the draft is cleared. The relief goes in as decoded
 * `ImageData` (`updateImage({ image })`), with no encoding or URL, in the Web Mercator rows the worker already
 * warped it to.
 *
 * Everything here is idempotent, because `sync()` runs on every `styledata`: after a style reload (a theme change
 * wipes all sources and layers) it adds the draft back, pushes the data again and hides the live layers that came
 * back. A live layer someone shows again while previewing is hidden again, and the visibility it is then restored
 * to is the one it was last given. A world that keeps the realm's borders has no political layer, so the live
 * borders and country names stay visible over the draft.
 */

import type {
  ExpressionSpecification,
  GeoJSONSource,
  ImageSource,
  LayerSpecification,
  Map as MapLibreMap,
  ErrorEvent as MapErrorEvent,
  MapSourceDataEvent,
  VisibilitySpecification,
} from "maplibre-gl";
import { isMapStyleReady } from "~/lib/maps/geojson-layer-helpers";
import { LAYER_CONFIGS } from "~/lib/maps/map-config";
import { MERCATOR_MAX_LAT } from "~/lib/maps/realm-map-settings";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";

const DRAFT_PREFIX = "worldgen-draft-";
const DRAFT_RELIEF_ID = `${DRAFT_PREFIX}relief`;

/**
 * The layers the draft draws: those the live map shows by default (`LAYER_CONFIGS`). Climate and ice caps stay
 * in the result for the bundle but are not drawn.
 */
const DRAFT_TYPES = ["background", "altitudes", "political", "lakes", "rivers"] as const;
type DraftType = (typeof DRAFT_TYPES)[number];

const sourceIdOf = (type: DraftType) => `${DRAFT_PREFIX}${type}`;
const strokeIdOf = (type: DraftType) => `${sourceIdOf(type)}-stroke`;

/** Draft layers, bottom to top. The relief sits over the elevation and under the countries, as the live overlay does. */
const STACK: readonly string[] = [
  sourceIdOf("background"),
  sourceIdOf("altitudes"),
  DRAFT_RELIEF_ID,
  sourceIdOf("political"),
  strokeIdOf("political"),
  sourceIdOf("lakes"),
  sourceIdOf("rivers"),
];

/** Source options for the draft: a coarse simplification and a wide buffer keep a 100k-cell world light to tile. */
const GEOJSON_OPTIONS = { tolerance: 0.5, buffer: 48, maxzoom: 8 } as const;

/** The relief is a full Web Mercator world, pinned at its corners. */
const RELIEF_COORDINATES: [[number, number], [number, number], [number, number], [number, number]] =
  [
    [-180, MERCATOR_MAX_LAT],
    [180, MERCATOR_MAX_LAT],
    [180, -MERCATOR_MAX_LAT],
    [-180, -MERCATOR_MAX_LAT],
  ];

const FILL_COLOR: ExpressionSpecification = ["coalesce", ["get", "_fillColor"], "#e8e5da"];
const lineColor = (fallback: string): ExpressionSpecification => [
  "coalesce",
  ["get", "fill"],
  fallback,
];
const RIVER_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["exponential", 1.2],
  ["zoom"],
  0,
  0.4,
  2,
  0.6,
  4,
  1.0,
  6,
  1.8,
  9,
  3.2,
];

/** The live realm layers the draft stands in for: the map's fills and lines, its labels and the realm's raster art. */
const LIVE_IDS: ReadonlySet<string> = new Set([
  "realm-base-image",
  "sovereignty-border",
  "sovereignty-labels",
  "country-name-labels",
]);
const LIVE_PREFIXES = ["fill-", "stroke-", "realm-raster-"];
/**
 * The live layers that draw the realm's borders and country names. A world that keeps the realm's borders has no
 * political layer of its own, so these stay visible over the draft.
 */
const BORDER_IDS: ReadonlySet<string> = new Set([
  "fill-political",
  "stroke-political",
  "sovereignty-border",
  "sovereignty-labels",
  "country-name-labels",
]);

const isLiveRealmLayer = (id: string): boolean =>
  !id.startsWith(DRAFT_PREFIX) && (LIVE_IDS.has(id) || LIVE_PREFIXES.some((p) => id.startsWith(p)));

function layerSpecs(type: DraftType): LayerSpecification[] {
  const config = LAYER_CONFIGS[type];
  const source = sourceIdOf(type);
  if (config.type === "line") {
    return [
      {
        id: source,
        type: "line",
        source,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": lineColor(config.strokeColor ?? "#5295c4"),
          "line-width": RIVER_WIDTH,
          "line-opacity": 0.9,
        },
      },
    ];
  }
  const specs: LayerSpecification[] = [
    {
      id: source,
      type: "fill",
      source,
      paint: {
        "fill-color":
          typeof config.fillColor === "string" && config.fillColor !== "from-property"
            ? config.fillColor
            : FILL_COLOR,
        "fill-opacity": config.fillOpacity,
      },
    },
  ];
  if (config.strokeColor) {
    specs.push({
      id: strokeIdOf(type),
      type: "line",
      source,
      paint: {
        "line-color": config.strokeColor,
        "line-width": config.strokeWidth ?? 1,
        "line-opacity": 0.8,
      },
    });
  }
  return specs;
}

export class WorldDraft {
  private shown: WorldGenResult | null = null;
  /** Live layer id to the visibility it had before it was hidden (undefined = the default, visible) */
  private readonly hidden = new Map<string, VisibilitySpecification | undefined>();
  /** The JSON last given to each draft source, so an unchanged layer is not parsed again */
  private readonly pushed = new Map<string, string>();
  /** Blob URLs handed to a source and not yet revoked, by source */
  private readonly pending = new Map<string, string[]>();
  private listening = false;
  private busy = false;
  private image: { relief: WorldGenResult["relief"]; data: ImageData } | null = null;
  /** The image each relief source holds, so a source made anew after a style reload is fed again */
  private readonly imageOn = new WeakMap<ImageSource, ImageData>();

  constructor(private readonly map: MapLibreMap) {}

  show(result: WorldGenResult): void {
    this.shown = result;
    this.push();
  }

  /** Brings the map back to the draft after a style change; a no-op when nothing is shown or nothing changed. */
  sync(): void {
    this.push();
  }

  /** Removes the draft, restores the live layers' visibility and revokes every blob URL. */
  clear(): void {
    const { map } = this;
    this.shown = null;
    this.image = null;
    this.pushed.clear();
    if (isMapStyleReady(map)) {
      for (const id of STACK) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [...DRAFT_TYPES.map(sourceIdOf), DRAFT_RELIEF_ID]) {
        if (map.getSource(id)) map.removeSource(id);
      }
      for (const [id, visibility] of this.hidden) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
      }
    }
    this.hidden.clear();
    this.revokeAll();
  }

  private push(): void {
    const { map, shown } = this;
    if (!shown || this.busy || !isMapStyleReady(map)) return;
    this.busy = true;
    try {
      // getLayersOrder, not getStyle(): this runs on every styledata and must not serialise the whole style
      const ids = map.getLayersOrder();
      // Under the first live layer: the draft takes the place of the live stack
      const anchor = ids.find(isLiveRealmLayer);
      for (const type of DRAFT_TYPES) {
        const json = shown.layers[type];
        if (json === undefined) this.removeType(type);
        else this.pushType(type, json, anchor);
      }
      this.pushRelief(shown.relief, anchor);
      this.hideLive(ids, shown.layers.political !== undefined);
    } finally {
      this.busy = false;
    }
  }

  private pushType(type: DraftType, json: string, anchor: string | undefined): void {
    const { map } = this;
    const sourceId = sourceIdOf(type);
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!source || this.pushed.get(sourceId) !== json) {
      const url = this.blobUrl(sourceId, json);
      if (source) void source.setData(url).catch(() => {});
      else map.addSource(sourceId, { type: "geojson", data: url, ...GEOJSON_OPTIONS });
      this.pushed.set(sourceId, json);
    }
    for (const spec of layerSpecs(type)) {
      if (!map.getLayer(spec.id)) map.addLayer(spec, this.beforeFor(spec.id, anchor));
    }
  }

  private removeType(type: DraftType): void {
    const { map } = this;
    for (const id of [strokeIdOf(type), sourceIdOf(type)]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(sourceIdOf(type))) map.removeSource(sourceIdOf(type));
    this.pushed.delete(sourceIdOf(type));
    this.release(sourceIdOf(type));
  }

  private pushRelief(relief: WorldGenResult["relief"], anchor: string | undefined): void {
    const { map } = this;
    if (this.image?.relief !== relief) {
      this.image = { relief, data: new ImageData(relief.rgba, relief.width, relief.height) };
    }
    let source = map.getSource(DRAFT_RELIEF_ID) as ImageSource | undefined;
    if (!source) {
      map.addSource(DRAFT_RELIEF_ID, { type: "image", coordinates: RELIEF_COORDINATES });
      source = map.getSource(DRAFT_RELIEF_ID) as ImageSource;
    }
    if (this.imageOn.get(source) !== this.image.data) {
      source.updateImage({ image: this.image.data, coordinates: RELIEF_COORDINATES });
      this.imageOn.set(source, this.image.data);
    }
    if (!map.getLayer(DRAFT_RELIEF_ID)) {
      map.addLayer(
        {
          id: DRAFT_RELIEF_ID,
          type: "raster",
          source: DRAFT_RELIEF_ID,
          paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
        },
        this.beforeFor(DRAFT_RELIEF_ID, anchor)
      );
    }
  }

  /** Where a draft layer goes: under the next draft layer up the stack, else under the first live layer. */
  private beforeFor(id: string, anchor: string | undefined): string | undefined {
    const above = STACK.slice(STACK.indexOf(id) + 1).find((other) => this.map.getLayer(other));
    return above ?? anchor;
  }

  /** Hides the live layers (not the borders, when the draft has none of its own); puts back any it no longer hides. */
  private hideLive(ids: readonly string[], draftHasBorders: boolean): void {
    const { map } = this;
    const live = ids.filter(isLiveRealmLayer);
    const hide = new Set(live.filter((id) => draftHasBorders || !BORDER_IDS.has(id)));
    for (const [id, prior] of this.hidden) {
      if (hide.has(id)) continue;
      // Gone from the map, or no longer to be hidden
      if (live.includes(id)) map.setLayoutProperty(id, "visibility", prior);
      this.hidden.delete(id);
    }
    for (const id of hide) {
      const visibility = map.getLayoutProperty(id, "visibility");
      // Already hidden by us; a layer that is visible again was shown (or made anew) since
      if (visibility === "none" && this.hidden.has(id)) continue;
      this.hidden.set(id, visibility);
      if (visibility !== "none") map.setLayoutProperty(id, "visibility", "none");
    }
  }

  private blobUrl(sourceId: string, json: string): string {
    const url = URL.createObjectURL(new Blob([json], { type: "application/geo+json" }));
    const urls = this.pending.get(sourceId) ?? [];
    urls.push(url);
    this.pending.set(sourceId, urls);
    if (!this.listening) {
      this.map.on("sourcedata", this.onSourceData);
      this.map.on("error", this.onError);
      this.listening = true;
    }
    return url;
  }

  /** A source with nothing left to load has read its URLs (a newer one supersedes an older). */
  private readonly onSourceData = (event: MapSourceDataEvent): void => {
    if (event.isSourceLoaded) this.release(event.sourceId);
  };

  /** A source that failed to load will not read its URLs either. */
  private readonly onError = (event: MapErrorEvent & { sourceId?: string }): void => {
    if (event.sourceId !== undefined) this.release(event.sourceId);
  };

  private release(sourceId: string): void {
    const urls = this.pending.get(sourceId);
    if (!urls) return;
    for (const url of urls) URL.revokeObjectURL(url);
    this.pending.delete(sourceId);
    if (this.pending.size === 0) this.stopListening();
  }

  private revokeAll(): void {
    for (const urls of this.pending.values()) for (const url of urls) URL.revokeObjectURL(url);
    this.pending.clear();
    this.stopListening();
  }

  private stopListening(): void {
    if (this.listening) {
      this.map.off("sourcedata", this.onSourceData);
      this.map.off("error", this.onError);
    }
    this.listening = false;
  }
}
