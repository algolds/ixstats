import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import {
  DRAFT_LAYER_KEYS,
  WorldDraft,
  type DraftImage,
  type DraftLayerKey,
} from "~/lib/maps/world-draft-layers";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";

/** What the Studio adds to the preview; all of it is optional and none of it regenerates the world. */
export type WorldOverlays = {
  /** Draft layers by key; one that is missing (or true) is shown, false hides it */
  visible?: Partial<Record<DraftLayerKey, boolean>>;
  /** A diagnostic image drawn under the relief (a `DiagnosticResult` fits); null or missing for none */
  diagnostic?: DraftImage | null;
  /** The nations' seed points; null or missing for none */
  seeds?: FeatureCollection<Point> | null;
};

const NO_OVERLAYS: WorldOverlays = {};

/**
 * Draws a generated world on the editor's map as draft sources and layers, with the live realm layers hidden, and
 * puts everything back when `result` is null or the editor unmounts. The preview is held in a ref (a `WorldDraft`),
 * not in React state, and never goes through `worldMapLayers` or `useMapData`.
 *
 * `overlays` are the Studio's layer switches, diagnostic image and seed points. Pass the same objects while nothing
 * changes (state, not a literal built on each render); a draft remembers them across worlds.
 *
 * `active` is true while a world is being previewed: the editor pauses hover hit-testing then (the live features it
 * would hit are hidden) and shows "Draft" in the status bar.
 */
export function useWorldPreview(
  map: MapLibreMap | null,
  result: WorldGenResult | null,
  overlays: WorldOverlays = NO_OVERLAYS
): { active: boolean } {
  const { visible, diagnostic = null, seeds = null } = overlays;
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

  useEffect(() => {
    for (const key of DRAFT_LAYER_KEYS) draft.current?.setVisible(key, visible?.[key] ?? true);
  }, [map, visible]);

  useEffect(() => {
    draft.current?.showDiagnostic(diagnostic);
  }, [map, diagnostic]);

  useEffect(() => {
    draft.current?.showSeeds(seeds);
  }, [map, seeds]);

  return { active: map !== null && result !== null };
}
