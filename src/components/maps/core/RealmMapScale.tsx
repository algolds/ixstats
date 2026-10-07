"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { FacetMaterial } from "~/components/ui/facet";
import { formatLngLat, measureScaleSpanKm, scaleBarFor } from "./utils/realm-scale";

const MAX_BAR_PX = 100;

/**
 * A scale bar measured on the realm's planet (MapLibre's own assumes Earth) and the cursor's coordinates. Both
 * are written straight into the DOM once per animation frame, never through React state (the viewer's
 * no-state-per-frame rule).
 */
export function RealmMapScale({ map, radiusKm }: { map: MapLibreMap | null; radiusKm: number }) {
  const barRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const coordsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!map) return;
    let scaleFrame = 0;
    let cursorFrame = 0;
    let cursor: { lng: number; lat: number } | null = null;

    const drawScale = () => {
      scaleFrame = 0;
      const bar = scaleBarFor(measureScaleSpanKm(map, MAX_BAR_PX, radiusKm), MAX_BAR_PX);
      if (!bar || !barRef.current || !labelRef.current) return;
      barRef.current.style.width = `${bar.widthPx}px`;
      labelRef.current.textContent = bar.label;
    };
    const onMove = () => {
      if (!scaleFrame) scaleFrame = requestAnimationFrame(drawScale);
    };
    const drawCursor = () => {
      cursorFrame = 0;
      if (coordsRef.current) {
        coordsRef.current.textContent = cursor ? formatLngLat(cursor.lng, cursor.lat) : "";
      }
    };
    const onMouseMove = (e: MapMouseEvent) => {
      cursor = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      if (!cursorFrame) cursorFrame = requestAnimationFrame(drawCursor);
    };
    const onMouseOut = () => {
      cursor = null;
      if (!cursorFrame) cursorFrame = requestAnimationFrame(drawCursor);
    };

    drawScale();
    map.on("move", onMove);
    map.on("resize", onMove);
    map.on("mousemove", onMouseMove);
    map.on("mouseout", onMouseOut);
    return () => {
      map.off("move", onMove);
      map.off("resize", onMove);
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseOut);
      if (scaleFrame) cancelAnimationFrame(scaleFrame);
      if (cursorFrame) cancelAnimationFrame(cursorFrame);
    };
  }, [map, radiusKm]);

  return (
    <FacetMaterial
      layer="chrome"
      className="rounded-row text-label-secondary text-caption pointer-events-none flex items-center gap-3 px-2 py-1 tabular-nums"
      data-testid="realm-map-scale"
    >
      <span className="flex flex-col items-start">
        <span ref={labelRef} data-testid="realm-map-scale-label" />
        <span
          ref={barRef}
          aria-hidden
          className="block h-1 border-x border-b border-current"
          style={{ width: 0 }}
        />
      </span>
      <span ref={coordsRef} data-testid="realm-map-coordinates" aria-live="off" />
    </FacetMaterial>
  );
}
