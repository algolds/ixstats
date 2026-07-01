"use client";

import { create } from "zustand";

/**
 * Global "map origin changed" signal. Snapshot previews fold `version` into their
 * cache key, so bumping it forces every on-screen preview to re-render from the
 * shared origin — the "change the main map, all update in the background" path.
 *
 * Bump it wherever origin map data is mutated/invalidated (geo editor mutations,
 * subdivision/city/border edits, manual admin refresh).
 */
interface MapDataVersionState {
  version: number;
  bumpMapDataVersion: () => void;
}

export const useMapDataVersionStore = create<MapDataVersionState>((set) => ({
  version: 0,
  bumpMapDataVersion: () => set((s) => ({ version: s.version + 1 })),
}));

/** Subscribe to the current map-data version (re-renders on bump). */
export const useMapDataVersion = () => useMapDataVersionStore((s) => s.version);

/** Bump from anywhere, incl. non-React code (tRPC onSuccess handlers, etc.). */
export const bumpMapDataVersion = () => useMapDataVersionStore.getState().bumpMapDataVersion();
