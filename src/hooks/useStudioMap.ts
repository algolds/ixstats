"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, ProjectionSpecification, StyleSpecification } from "maplibre-gl";
import { loadMaplibre } from "~/lib/maps/load-maplibre";
import { buildBaseStyle, getProjectionSpec, type ProjectionMode } from "~/lib/maps/map-config";

/** The Studio map's projections: the globe (flat once zoomed in, as on the world map) or flat Mercator. */
export type StudioProjection = "globe" | "flat";

const MODES: Record<StudioProjection, ProjectionMode> = { globe: "dynamic", flat: "mercator" };

/**
 * World Studio's own MapLibre map: the base style in the element `containerRef` is put on, in `projection`. The globe
 * shows land near the poles at its true shape, which flat Mercator stretches; the relief and diagnostic images are
 * Mercator images, which MapLibre wraps onto the globe. The style is the "standard" theme: the editor takes its
 * theme as a prop that nothing in the app sets (there is no map theme preference to follow), so the Studio has
 * nothing to follow either; if one appears, restyle on change as `useEditorMapSurface` does. `map` is null until the
 * style has loaded, and again once the map is removed on unmount. It is not the realm editor's map: the Studio has
 * no realm layers, only the draft.
 */
export function useStudioMap(projection: StudioProjection) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  // The map is built in the projection asked first; later changes go through setProjection
  const first = useRef(projection);

  useEffect(() => {
    let cancelled = false;
    let built: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;

    void (async () => {
      const maplibregl = await loadMaplibre();
      await import("maplibre-gl/dist/maplibre-gl.css");
      const container = containerRef.current;
      if (cancelled || !container) return;
      const instance = new maplibregl.Map({
        container,
        style: buildBaseStyle("standard", MODES[first.current]) as StyleSpecification,
        center: [0, 20],
        zoom: 1.4,
        attributionControl: false,
        dragRotate: false,
        renderWorldCopies: false,
      });
      built = instance;
      instance.on("load", () => {
        if (!cancelled) setMap(instance);
      });
      observer = new ResizeObserver(() => instance.resize());
      observer.observe(container);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      built?.remove();
      setMap(null);
    };
  }, []);

  useEffect(() => {
    map?.setProjection(getProjectionSpec(MODES[projection]) as ProjectionSpecification);
  }, [map, projection]);

  return { containerRef, map };
}
