import type { FilterSpecification, ImageSource, Map as MapLibreMap } from "maplibre-gl";

/**
 * A realm map's own style layers: the base raster image under the political layer, and the hatch drawn over
 * nations nobody has claimed. Each `sync…` call is idempotent: it adds, updates or removes its source and layer
 * so the persistent world map (shared between realms) shows only what the current realm asks for.
 */

export const BASE_IMAGE_SOURCE_ID = "realm-base-image";
export const BASE_IMAGE_LAYER_ID = "realm-base-image";
export const UNCLAIMED_LAYER_ID = "realm-unclaimed-hatch";
export const UNCLAIMED_PATTERN_ID = "realm-unclaimed-hatch";
const POLITICAL_SOURCE_ID = "source-political";
const POLITICAL_FILL_ID = "fill-political";
const POLITICAL_STROKE_ID = "stroke-political";

/**
 * Where a full-globe equirectangular image is pinned: its corners at ±180° and ±85° (the Web Mercator limit),
 * top-left first, clockwise. MapLibre stretches the image linearly between them in the map's projection.
 */
export const BASE_IMAGE_COORDINATES: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [-180, 85],
  [180, 85],
  [180, -85],
  [-180, -85],
];

/** The first data layer in the style (the map's own fills and lines), which the base image goes under. */
function firstDataLayerId(map: MapLibreMap): string | undefined {
  return map
    .getStyle()
    ?.layers?.find(
      (layer) =>
        layer.id !== BASE_IMAGE_LAYER_ID &&
        (layer.id.startsWith("fill-") || layer.id.startsWith("stroke-"))
    )?.id;
}

/** Show `url` as the realm's base image (null removes it), credited with `attribution` in the map's control. */
export function syncBaseImage(
  map: MapLibreMap,
  url: string | null,
  attribution: string | null = null
): void {
  const source = map.getSource(BASE_IMAGE_SOURCE_ID) as ImageSource | undefined;
  if (!url) {
    if (map.getLayer(BASE_IMAGE_LAYER_ID)) map.removeLayer(BASE_IMAGE_LAYER_ID);
    if (source) map.removeSource(BASE_IMAGE_SOURCE_ID);
    return;
  }
  if (source && (source as unknown as { url?: string }).url !== url) {
    source.updateImage({ url, coordinates: BASE_IMAGE_COORDINATES });
  } else if (!source) {
    map.addSource(BASE_IMAGE_SOURCE_ID, {
      type: "image",
      url,
      coordinates: BASE_IMAGE_COORDINATES,
      ...(attribution && { attribution }),
    } as Parameters<MapLibreMap["addSource"]>[1]);
  }
  if (!map.getLayer(BASE_IMAGE_LAYER_ID)) {
    map.addLayer(
      {
        id: BASE_IMAGE_LAYER_ID,
        type: "raster",
        source: BASE_IMAGE_SOURCE_ID,
        paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
      },
      firstDataLayerId(map)
    );
  }
}

/**
 * A diagonal hatch, `size` pixels square: dark stripes on transparency, so the nation's own colour shows
 * through. RGBA bytes for `map.addImage`.
 */
export function hatchPattern(size = 8): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const onStripe = (x + y) % size < 2;
      const i = (y * size + x) * 4;
      data[i] = 40;
      data[i + 1] = 40;
      data[i + 2] = 40;
      data[i + 3] = onStripe ? 150 : 0;
    }
  }
  return { width: size, height: size, data };
}

/** The filter that picks the unclaimed nations' regions out of the political layer. */
export function unclaimedFilter(countryIds: readonly string[]): FilterSpecification {
  return ["in", ["get", "_countryId"], ["literal", [...countryIds]]] as FilterSpecification;
}

/**
 * Hatch the regions of `countryIds` (the realm's unclaimed nations) over their political fill, under the
 * borders. Nothing to hatch, or no political layer yet: the layer is removed (or not added).
 */
export function syncUnclaimedHatch(
  map: MapLibreMap,
  countryIds: readonly string[],
  visible: boolean
): void {
  const hasLayer = !!map.getLayer(UNCLAIMED_LAYER_ID);
  if (
    countryIds.length === 0 ||
    !map.getSource(POLITICAL_SOURCE_ID) ||
    !map.getLayer(POLITICAL_FILL_ID)
  ) {
    if (hasLayer) map.removeLayer(UNCLAIMED_LAYER_ID);
    return;
  }
  if (!map.hasImage(UNCLAIMED_PATTERN_ID)) map.addImage(UNCLAIMED_PATTERN_ID, hatchPattern());
  if (!hasLayer) {
    map.addLayer(
      {
        id: UNCLAIMED_LAYER_ID,
        type: "fill",
        source: POLITICAL_SOURCE_ID,
        filter: unclaimedFilter(countryIds),
        paint: { "fill-pattern": UNCLAIMED_PATTERN_ID },
      },
      map.getLayer(POLITICAL_STROKE_ID) ? POLITICAL_STROKE_ID : undefined
    );
  } else {
    map.setFilter(UNCLAIMED_LAYER_ID, unclaimedFilter(countryIds));
  }
  map.setLayoutProperty(UNCLAIMED_LAYER_ID, "visibility", visible ? "visible" : "none");
}
