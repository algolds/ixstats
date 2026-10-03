import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { EditorFeature } from "~/hooks/useMapEditor";

type MapFilter = Parameters<MapLibreMap["setFilter"]>[1];

/** Outlines the selected region and haloes the multi-selected features. */
export function useSelectionHighlight(
  mapRef: { readonly current: MapLibreMap | null },
  isLoaded: boolean,
  selectedFeature: EditorFeature | null,
  selectedIds: Set<string> | undefined
) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const setFilter = (layerId: string, filter: MapFilter) => {
      if (map.getLayer(layerId)) map.setFilter(layerId, filter);
    };
    const hover: MapFilter = [
      "==",
      ["get", "id"],
      selectedFeature?.geometry ? selectedFeature.id : "",
    ];
    const multi = (
      selectedIds?.size
        ? ["in", ["get", "id"], ["literal", [...selectedIds]]]
        : ["==", ["get", "id"], ""]
    ) as MapFilter;

    setFilter("editor-subdivisions-hover", hover);
    setFilter("editor-subdivisions-selected", multi);
    setFilter("editor-points-selected", multi);
  }, [mapRef, isLoaded, selectedFeature, selectedIds]);
}
