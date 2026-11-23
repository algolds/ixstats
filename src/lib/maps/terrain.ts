/**
 * The world map's terrain from a realm's elevation model (src/lib/maps/dem.ts): GPU hillshade, a continuous colour
 * relief (land in the elevation key's colours, the sea darkening with depth) and 3D terrain that rises as the
 * viewer zooms in. Pure, client-safe: style values, the auto-tilt rule and the viewer's stored choice.
 */
import type {
  ExpressionSpecification,
  HillshadeLayerSpecification,
  SkySpecification,
} from "maplibre-gl";
import { ELEVATION_ZONES } from "./elevation-config";

export type TerrainMode = "auto" | "off";
export interface TerrainPrefs {
  /** "auto": 3D terrain rises past TERRAIN_ZOOM; "off": always flat (hillshade and colour relief stay). */
  mode: TerrainMode;
  /** Vertical exaggeration of the 3D terrain. */
  exaggeration: number;
}

export const DEFAULT_TERRAIN: TerrainPrefs = { mode: "auto", exaggeration: 1.5 };
export const EXAGGERATION_RANGE = { min: 1, max: 4, step: 0.25 } as const;

/** 3D terrain is on from this zoom; the camera tilts once the viewer zooms past TILT_ZOOM. */
export const TERRAIN_ZOOM = 3.5;
export const TILT_ZOOM = 4;
export const TILT_PITCH = 45;

/**
 * What the camera does after a zoom from `prevZoom` to `zoom`: whether terrain is on, and a pitch to ease to (null:
 * leave it). Zooming in past TILT_ZOOM on a flat camera tilts it; zooming out below TERRAIN_ZOOM flattens it. Only
 * a crossing moves the camera, so a viewer who tilts or flattens it by hand keeps their choice.
 */
export function terrainFrame(
  mode: TerrainMode,
  prevZoom: number,
  zoom: number,
  pitch: number
): { terrain: boolean; pitchTo: number | null } {
  if (mode === "off") return { terrain: false, pitchTo: pitch > 0 ? 0 : null };
  const terrain = zoom >= TERRAIN_ZOOM;
  if (prevZoom < TILT_ZOOM && zoom >= TILT_ZOOM && pitch < 1)
    return { terrain, pitchTo: TILT_PITCH };
  if (prevZoom >= TERRAIN_ZOOM && zoom < TERRAIN_ZOOM && pitch > 0) return { terrain, pitchTo: 0 };
  return { terrain, pitchTo: null };
}

const opaque = (hex: string) => hex.slice(0, 7);

/**
 * The colour relief: transparent at sea level so the map's own sea shows, a darkening wash with depth, and on land
 * each elevation band's key colour at its middle (the first at the coast), blended between them.
 */
export function colorReliefRamp(): ExpressionSpecification {
  const land = ELEVATION_ZONES.flatMap((zone, i) => [
    i === 0 ? 0.5 : (zone.elevationMin + Math.min(zone.elevationMax, 7000)) / 2,
    opaque(zone.color),
  ]);
  return [
    "interpolate",
    ["linear"],
    ["elevation"],
    -6000,
    "rgba(6, 22, 46, 0.45)",
    -2500,
    "rgba(12, 34, 64, 0.32)",
    -200,
    "rgba(24, 60, 100, 0.14)",
    -1,
    "rgba(40, 90, 130, 0.04)",
    0,
    "rgba(0, 0, 0, 0)",
    ...land,
  ] as ExpressionSpecification;
}

/** Hillshade from four lights (north-west strongest), shadows and highlights soft enough to sit over colour. */
export const HILLSHADE_PAINT: HillshadeLayerSpecification["paint"] = {
  "hillshade-method": "multidirectional",
  "hillshade-illumination-direction": [270, 315, 0, 45],
  "hillshade-illumination-altitude": [30, 35, 30, 30],
  "hillshade-shadow-color": [
    "rgba(26, 30, 40, 0.28)",
    "rgba(26, 30, 40, 0.5)",
    "rgba(26, 30, 40, 0.28)",
    "rgba(26, 30, 40, 0.2)",
  ],
  "hillshade-highlight-color": [
    "rgba(255, 255, 255, 0.12)",
    "rgba(255, 255, 255, 0.22)",
    "rgba(255, 255, 255, 0.12)",
    "rgba(255, 255, 255, 0.08)",
  ],
  "hillshade-exaggeration": 0.6,
};

/** Haze toward the horizon while the camera is tilted; no globe atmosphere. */
export const TERRAIN_SKY: SkySpecification = {
  "sky-color": "#c4d6e8",
  "horizon-color": "#e9eff4",
  "fog-color": "#e9eff4",
  "sky-horizon-blend": 0.6,
  "horizon-fog-blend": 0.7,
  "fog-ground-blend": 0.4,
  "atmosphere-blend": 0,
};

const STORAGE_KEY = "ixmaps:terrain";

/** The viewer's stored choice, or the default (also when storage is blocked or holds something else). */
export function readTerrainPrefs(): TerrainPrefs {
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null"
    ) as Partial<TerrainPrefs> | null;
    const mode = raw?.mode === "off" ? "off" : "auto";
    const e = Number(raw?.exaggeration);
    const exaggeration =
      e >= EXAGGERATION_RANGE.min && e <= EXAGGERATION_RANGE.max ? e : DEFAULT_TERRAIN.exaggeration;
    return { mode, exaggeration };
  } catch {
    return DEFAULT_TERRAIN;
  }
}

export function writeTerrainPrefs(prefs: TerrainPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ponytail: a blocked storage keeps the choice for this page only
  }
}
