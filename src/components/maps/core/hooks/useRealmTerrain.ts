import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { DEM_MAX_ZOOM } from "~/lib/maps/dem";
import { RASTER_TILE_SIZE } from "~/lib/maps/raster-tiles";
import {
  colorReliefRamp,
  HILLSHADE_PAINT,
  TERRAIN_SKY,
  terrainFrame,
  type TerrainPrefs,
} from "~/lib/maps/terrain";

/** Hillshade and colour relief read one copy of the DEM, the 3D terrain another (MapLibre renders both better). */
const DEM_SOURCE = "realm-dem";
const TERRAIN_SOURCE = "realm-dem-terrain";
export const COLOR_RELIEF_LAYER = "realm-color-relief";
export const HILLSHADE_LAYER = "realm-hillshade";
const POLITICAL_FILL = "fill-political";

/** The layer just above the elevation bands (the colour relief covers them), else just under the political fill. */
function aboveAltitudes(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  let last = -1;
  layers.forEach((layer, i) => {
    if ("source" in layer && layer.source === "source-altitudes") last = i;
  });
  const next = last >= 0 ? layers[last + 1]?.id : undefined;
  return next === COLOR_RELIEF_LAYER
    ? layers[last + 2]?.id
    : (next ?? (map.getLayer(POLITICAL_FILL) ? POLITICAL_FILL : undefined));
}

function dropTerrain(map: MapLibreMap): void {
  if (map.getTerrain()) map.setTerrain(null);
  for (const id of [COLOR_RELIEF_LAYER, HILLSHADE_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [DEM_SOURCE, TERRAIN_SOURCE]) if (map.getSource(id)) map.removeSource(id);
}

/** Point both DEM sources at `url`, rebuilding them when it changed (a new version, or flat mode). */
function syncSources(map: MapLibreMap, url: string): void {
  const current = map.getSource(DEM_SOURCE) as { tiles?: string[] } | undefined;
  if (current && current.tiles?.[0] !== url) dropTerrain(map);
  const spec = {
    type: "raster-dem" as const,
    tiles: [url],
    tileSize: RASTER_TILE_SIZE,
    maxzoom: DEM_MAX_ZOOM,
    encoding: "terrarium" as const,
  };
  if (!map.getSource(DEM_SOURCE)) map.addSource(DEM_SOURCE, spec);
  if (!map.getSource(TERRAIN_SOURCE)) map.addSource(TERRAIN_SOURCE, spec);
}

function syncLayer(
  map: MapLibreMap,
  id: string,
  shown: boolean,
  add: () => void,
  before: () => string | undefined
) {
  if (!shown) {
    if (map.getLayer(id)) map.removeLayer(id);
    return;
  }
  if (map.getLayer(id)) map.moveLayer(id, before());
  else add();
}

/** The DEM's sources and its colour relief and hillshade layers as asked (all removed without a DEM). */
function syncTerrainLayers(
  map: MapLibreMap,
  demUrl: string | null,
  hillshade: boolean,
  colorRelief: boolean
): void {
  try {
    if (!demUrl) {
      dropTerrain(map);
      return;
    }
    syncSources(map, demUrl);
    const colorReliefLayer = {
      id: COLOR_RELIEF_LAYER,
      type: "color-relief" as const,
      source: DEM_SOURCE,
      paint: { "color-relief-color": colorReliefRamp() },
    };
    syncLayer(
      map,
      COLOR_RELIEF_LAYER,
      colorRelief,
      () => map.addLayer(colorReliefLayer, aboveAltitudes(map)),
      () => aboveAltitudes(map)
    );
    const underPolitical = () => (map.getLayer(POLITICAL_FILL) ? POLITICAL_FILL : undefined);
    const hillshadeLayer = {
      id: HILLSHADE_LAYER,
      type: "hillshade" as const,
      source: DEM_SOURCE,
      paint: HILLSHADE_PAINT,
    };
    syncLayer(
      map,
      HILLSHADE_LAYER,
      hillshade,
      () => map.addLayer(hillshadeLayer, underPolitical()),
      underPolitical
    );
  } catch (err) {
    console.warn("[useRealmTerrain] layers:", err);
  }
}

/** 3D terrain on (at `exaggeration`, with the horizon haze) or off. */
function setTerrain(map: MapLibreMap, terrain: boolean, exaggeration: number): void {
  try {
    const on = map.getTerrain();
    if (terrain && (!on || on.exaggeration !== exaggeration)) {
      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration });
      map.setSky(TERRAIN_SKY);
    } else if (!terrain && on) map.setTerrain(null);
  } catch (err) {
    console.warn("[useRealmTerrain] terrain:", err);
  }
}

export interface RealmTerrainOptions {
  map: MapLibreMap | null;
  isLoaded: boolean;
  /** The DEM tile URL template (absolute), or null when the realm has no elevation model. */
  demUrl: string | null;
  /** Shade the land (the Relief switch). */
  hillshade: boolean;
  /** Colour the land and sea by height (off under a base map's art). */
  colorRelief: boolean;
  prefs: TerrainPrefs;
  /** A style swap (theme) or new data layers drop or reorder custom layers: sync again after them. */
  theme: unknown;
  layers: unknown;
}

/**
 * The realm's terrain on the world map: GPU hillshade and colour relief from its DEM, and 3D terrain that rises past
 * TERRAIN_ZOOM with the camera tilting in (terrainFrame), rotation and tilt by right-drag or Ctrl-drag while 3D is on. Without a DEM nothing is added and the baked relief overlay shows instead.
 */
export function useRealmTerrain({
  map,
  isLoaded,
  demUrl,
  hillshade,
  colorRelief,
  prefs,
  theme,
  layers,
}: RealmTerrainOptions) {
  useEffect(() => {
    if (map && isLoaded) syncTerrainLayers(map, demUrl, hillshade, colorRelief);
  }, [map, isLoaded, demUrl, hillshade, colorRelief, theme, layers]);

  const { mode, exaggeration } = prefs;
  useEffect(() => {
    if (!map || !isLoaded || !demUrl) return;
    let prevZoom = map.getZoom();
    const frame = () => {
      const zoom = map.getZoom();
      const { terrain, pitchTo } = terrainFrame(mode, prevZoom, zoom, map.getPitch());
      prevZoom = zoom;
      setTerrain(map, terrain, exaggeration);
      if (pitchTo !== null) map.easeTo({ pitch: pitchTo, duration: 900 });
    };
    frame();
    const rotate = mode === "auto";
    if (rotate) map.dragRotate.enable();
    else if (map.getBearing() !== 0) map.easeTo({ bearing: 0, duration: 600 });
    map.on("zoomend", frame);
    return () => {
      map.off("zoomend", frame);
      if (rotate) map.dragRotate.disable();
    };
  }, [map, isLoaded, demUrl, mode, exaggeration, theme]);
}
