"use client";

import { createContext, useContext } from "react";

/**
 * The realm slug a map is showing (and a world editor is editing), from `?realm=`.
 * Undefined means "the viewer's realm" (their active nation's, else IxWorld) — the
 * server resolves it, so the map and its editor always agree.
 */
const MapRealmContext = createContext<string | undefined>(undefined);

export const MapRealmProvider = MapRealmContext.Provider;

export function useMapRealm(): string | undefined {
  return useContext(MapRealmContext);
}
