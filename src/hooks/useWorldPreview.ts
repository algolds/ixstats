import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { WorldDraft } from "~/lib/maps/world-draft-layers";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";

/**
 * Draws a generated world on the editor's map as draft sources and layers, with the live realm layers hidden, and
 * puts everything back when `result` is null or the editor unmounts. The preview is held in a ref (a `WorldDraft`),
 * not in React state, and never goes through `worldMapLayers` or `useMapData`.
 *
 * `active` is true while a world is being previewed: the editor pauses hover hit-testing then (the live features it
 * would hit are hidden) and shows "Draft" in the status bar.
 */
export function useWorldPreview(
  map: MapLibreMap | null,
  result: WorldGenResult | null
): { active: boolean } {
  const draft = useRef<WorldDraft | null>(null);

  // The draft follows the map, and follows its style: a style change re-runs `sync`
  useEffect(() => {
    if (!map) return;
    const current = new WorldDraft(map);
    draft.current = current;
    const onStyleData = () => current.sync();
    map.on("styledata", onStyleData);
    return () => {
      map.off("styledata", onStyleData);
      current.clear();
      draft.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (result) draft.current?.show(result);
    else draft.current?.clear();
  }, [map, result]);

  return { active: map !== null && result !== null };
}
