import { useSyncExternalStore } from "react";
import {
  DEFAULT_TERRAIN,
  readTerrainPrefs,
  writeTerrainPrefs,
  type TerrainPrefs,
} from "~/lib/maps/terrain";

// One choice for the page: the map settings, Halo's command and the T key all read and change it.
let current: TerrainPrefs | null = null;
const listeners = new Set<() => void>();
const get = () => (current ??= readTerrainPrefs());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Change the viewer's terrain choice (kept in browser storage). */
export function setTerrainPrefs(change: Partial<TerrainPrefs>): void {
  current = { ...get(), ...change };
  writeTerrainPrefs(current);
  for (const listener of listeners) listener();
}

/** Flip 3D terrain between auto and off. */
export const toggleTerrain = () => setTerrainPrefs({ mode: get().mode === "off" ? "auto" : "off" });

/** The viewer's terrain choice: 3D on or off, and its exaggeration. */
export function useTerrainPrefs(): TerrainPrefs {
  return useSyncExternalStore(subscribe, get, () => DEFAULT_TERRAIN);
}
