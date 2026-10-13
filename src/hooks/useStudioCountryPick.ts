"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { DRAFT_POLITICAL_ID } from "~/lib/maps/world-draft-layers";
import type { WorldSlot } from "~/lib/worldgen/v2/types";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";

/** The slot key of the draft country under the pointer, or null (the sea, a fitted world's kept borders, no world). */
function slotKeyAt(map: MapLibreMap, event: MapMouseEvent): string | null {
  if (!map.getLayer(DRAFT_POLITICAL_ID)) return null;
  const [feature] = map.queryRenderedFeatures(event.point, { layers: [DRAFT_POLITICAL_ID] });
  const key = feature?.properties?.slotKey;
  return typeof key === "string" ? key : null;
}

/**
 * A country of the generated world, picked by clicking it on the Studio map. A click elsewhere clears it, and so does
 * a new world (slot keys hold within one world). The cursor is a pointer over a country.
 */
export function useStudioCountryPick(map: MapLibreMap | null, result: WorldGenResult | null) {
  const [picked, setPicked] = useState<{ key: string; world: WorldGenResult } | null>(null);
  const world = useRef(result);
  useEffect(() => {
    world.current = result;
  });

  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    const click = (event: MapMouseEvent) => {
      const key = slotKeyAt(map, event);
      setPicked(key && world.current ? { key, world: world.current } : null);
    };
    const move = (event: MapMouseEvent) => {
      canvas.style.cursor = slotKeyAt(map, event) ? "pointer" : "";
    };
    map.on("click", click);
    map.on("mousemove", move);
    return () => {
      map.off("click", click);
      map.off("mousemove", move);
      canvas.style.cursor = "";
    };
  }, [map]);

  const slot: WorldSlot | null =
    picked && result && picked.world === result
      ? (result.slots.find((s) => s.key === picked.key) ?? null)
      : null;
  return { slot, clear: () => setPicked(null) };
}
