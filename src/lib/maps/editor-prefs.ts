/**
 * editor-prefs — Simple localStorage-backed editor preference module.
 *
 * Keeps pure geometry libraries (border-editor.ts) free of localStorage.
 * Read prefs at the call site, not inside the geometry helpers.
 *
 * Keys are prefixed "ixeditor." to avoid collisions.
 */

const PREFS_KEY = "ixeditor-snap-enabled";
const TOLERANCE_KEY = "ixeditor-snap-tolerance";
const SNAP_LAYERS_OFF_KEY = "ixeditor-snap-layers-off";
const DEFAULT_ENABLED = true;
const DEFAULT_TOLERANCE = 0.015; // ~1.7 km at equator

const memoryStore: Record<string, string> = {};

function readPref(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    return memoryStore[key] ?? null;
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
    memoryStore[key] = value;
  } catch {
    /* quota / private-browsing — silently ignore */
  }
}

export function getSnapEnabled(): boolean {
  const raw = readPref(PREFS_KEY);
  return raw === null ? DEFAULT_ENABLED : raw !== "false";
}

export function setSnapEnabled(enabled: boolean): void {
  writePref(PREFS_KEY, String(enabled));
}

export function getSnapTolerance(): number {
  const n = parseFloat(readPref(TOLERANCE_KEY) ?? "");
  return isNaN(n) || n <= 0 ? DEFAULT_TOLERANCE : n;
}

export function setSnapTolerance(tolerance: number): void {
  writePref(TOLERANCE_KEY, String(tolerance));
}

/** Background layers the editor snaps to. "background" is the landmass, i.e. the coastline. */
export const SNAP_LAYER_TYPES = ["rivers", "lakes", "background", "altitudes", "climate"] as const;
export type SnapLayerType = (typeof SNAP_LAYER_TYPES)[number];

/** Snap layers the user switched off (all layers are on by default). */
export function getDisabledSnapLayers(): Set<SnapLayerType> {
  const off = (readPref(SNAP_LAYERS_OFF_KEY) ?? "").split(",");
  return new Set(SNAP_LAYER_TYPES.filter((layer) => off.includes(layer)));
}

export function setSnapLayerEnabled(layer: SnapLayerType, enabled: boolean): void {
  const off = getDisabledSnapLayers();
  if (enabled) off.delete(layer);
  else off.add(layer);
  writePref(SNAP_LAYERS_OFF_KEY, [...off].join(","));
}

/** The visible layers minus the snap layers the user switched off. */
export function withoutDisabledSnapLayers(visibleLayers: ReadonlySet<string>): Set<string> {
  const off: ReadonlySet<string> = getDisabledSnapLayers();
  return new Set([...visibleLayers].filter((layer) => !off.has(layer)));
}
