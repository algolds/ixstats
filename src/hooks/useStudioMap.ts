"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { loadMaplibre } from "~/lib/maps/load-maplibre";
import { buildBaseStyle } from "~/lib/maps/map-config";

/**
 * World Studio's own MapLibre map: the base style, forced to Mercator (the relief and diagnostic images are pinned to
 * Mercator corners), in the element `containerRef` is put on. The style is the "standard" theme: the editor takes its
 * theme as a prop that nothing in the app sets (there is no map theme preference to follow), so the Studio has
 * nothing to follow either; if one appears, restyle on change as `useEditorMapSurface` does. `map` is null until the style has loaded, and again once
 * the map is removed on unmount. It is not the realm editor's map: the Studio has no realm layers, only the draft.
 */
export function useStudioMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

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
        style: buildBaseStyle("standard", "mercator") as StyleSpecification,
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

  return { containerRef, map };
}
