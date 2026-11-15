"use client";

import { useSyncExternalStore } from "react";

/**
 * Halo's island material. `lens` (the default) makes the island Facet's one Chrome surface that is Lens, with solid
 * wells inside. `chrome` is a temporary comparison for admins: a Chrome island with Lens panels inside. Stored per
 * browser; only admins see the switch. Remove `chrome` once the owner picks.
 */
export type HaloMaterial = "lens" | "chrome";

const KEY = "ixstats.halo-material";
const EVENT = "ixstats-halo-material-change";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): HaloMaterial {
  try {
    return localStorage.getItem(KEY) === "chrome" ? "chrome" : "lens";
  } catch {
    return "lens";
  }
}

export function useHaloMaterial(): HaloMaterial {
  return useSyncExternalStore(subscribe, read, () => "lens");
}

export function setHaloMaterial(material: HaloMaterial): void {
  try {
    if (material === "lens") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, material);
  } catch {
    // Storage unavailable: the island stays Lens.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** The island's own surface classes for each material. */
export const ISLAND_MATERIAL: Record<HaloMaterial, string> = {
  lens: "facet-lens facet-lens-frosted",
  chrome: "facet-chrome",
};

/** A section inside the island: solid on the Lens island, Lens on the Chrome island. */
export const WELL_MATERIAL: Record<HaloMaterial, string> = {
  lens: "facet-well",
  chrome: "facet-lens",
};
