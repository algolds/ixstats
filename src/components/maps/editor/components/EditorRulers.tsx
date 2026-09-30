"use client";

/**
 * EditorRulers — Photoshop-style lng/lat rulers along the top and left edges of
 * the editor canvas, plus draggable guides.
 *
 * Re-renders on map move (throttled to one frame) so ticks and guides track the
 * camera while panning; it is its own component so that re-render stays local
 * instead of re-rendering the whole EditorMap. Drag from a ruler to add a guide;
 * double-click a guide to delete it.
 */

import React, { memo, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

export interface EditorGuide {
  id: string;
  type: "h" | "v";
  value: number;
}

interface EditorRulersProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  guides: EditorGuide[];
  setGuides?: React.Dispatch<React.SetStateAction<EditorGuide[]>>;
  showGuides: boolean;
}

const RULER = 24;

function pickStep(span: number): number {
  if (span < 0.1) return 0.01;
  if (span < 0.2) return 0.02;
  if (span < 0.5) return 0.05;
  if (span < 1) return 0.1;
  if (span < 2) return 0.2;
  if (span < 5) return 0.5;
  if (span < 10) return 1;
  if (span < 25) return 2;
  if (span < 50) return 5;
  if (span < 100) return 10;
  return 20;
}

function useMapFrameTick(map: MapLibreMap | null, isLoaded: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!map || !isLoaded) return;
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setTick((t) => (t + 1) % 1_000_000);
      });
    };
    schedule();
    map.on("move", schedule);
    map.on("resize", schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      map.off("move", schedule);
      map.off("resize", schedule);
    };
  }, [map, isLoaded]);
  return tick;
}

export const EditorRulers = memo(function EditorRulers({
  map,
  isLoaded,
  containerRef,
  guides,
  setGuides,
  showGuides,
}: EditorRulersProps) {
  useMapFrameTick(map, isLoaded);

  const [activeDragGuide, setActiveDragGuide] = useState<{
    type: "h" | "v";
    currentVal: number;
    screenPos: number;
  } | null>(null);
  const dragTypeRef = useRef<"h" | "v" | null>(null);
  const activeRef = useRef(activeDragGuide);
  // oxlint-disable-next-line -- latest-value ref read by the mouseup handler
  activeRef.current = activeDragGuide;

  // Guide dragging: window listeners registered once per drag, updates batched per frame.
  const isDragging = activeDragGuide !== null;
  useEffect(() => {
    if (!isDragging) return;
    let frame: number | null = null;
    let lastEvent: MouseEvent | null = null;

    const apply = () => {
      frame = null;
      const e = lastEvent;
      const rect = containerRef.current?.getBoundingClientRect();
      const type = dragTypeRef.current;
      if (!e || !rect || !map || !type) return;
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const ll = map.unproject([x, y]);
      setActiveDragGuide(
        type === "h"
          ? { type, currentVal: ll.lat, screenPos: y }
          : { type, currentVal: ll.lng, screenPos: x }
      );
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastEvent = e;
      if (frame === null) frame = requestAnimationFrame(apply);
    };

    const handleMouseUp = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      const current = activeRef.current;
      if (current && setGuides) {
        const newGuide: EditorGuide = {
          id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: current.type,
          value: current.currentVal,
        };
        setGuides((prev) => [...prev, newGuide]);
      }
      setActiveDragGuide(null);
      dragTypeRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, containerRef, map, setGuides]);

  const startDrag = (type: "h" | "v") => (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !map) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ll = map.unproject([x, y]);
    dragTypeRef.current = type;
    setActiveDragGuide(
      type === "h"
        ? { type, currentVal: ll.lat, screenPos: y }
        : { type, currentVal: ll.lng, screenPos: x }
    );
  };

  const rect = containerRef.current?.getBoundingClientRect();
  if (!map || !isLoaded || !rect) return null;

  const rulerWidth = rect.width - RULER;
  const rulerHeight = rect.height - RULER;
  const center = map.getCenter();

  const ticks: { x: number; isMajor: boolean; label?: string }[] = [];
  const yTicks: { y: number; isMajor: boolean; label?: string }[] = [];

  // Top ruler (longitude)
  const west = map.unproject([RULER, 0]).lng;
  const east = map.unproject([rect.width, 0]).lng;
  const step = pickStep(east - west);
  const minorStep = step / 5;
  const lngDecimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (
    let lng = Math.ceil(west / minorStep) * minorStep;
    lng <= Math.floor(east / minorStep) * minorStep + minorStep / 2;
    lng += minorStep
  ) {
    const x = map.project([lng, center.lat]).x - RULER;
    if (x >= 0 && x <= rulerWidth) {
      const isMajor = Math.abs(Math.round(lng / minorStep) % 5) === 0;
      ticks.push({ x, isMajor, label: isMajor ? lng.toFixed(lngDecimals) : undefined });
    }
  }

  // Left ruler (latitude)
  const north = map.unproject([0, RULER]).lat;
  const south = map.unproject([0, rect.height]).lat;
  const stepLat = pickStep(north - south);
  const minorStepLat = stepLat / 5;
  const latDecimals = Math.max(0, -Math.floor(Math.log10(stepLat)));
  for (
    let lat = Math.ceil(south / minorStepLat) * minorStepLat;
    lat <= Math.floor(north / minorStepLat) * minorStepLat + minorStepLat / 2;
    lat += minorStepLat
  ) {
    const y = map.project([center.lng, lat]).y - RULER;
    if (y >= 0 && y <= rulerHeight) {
      const isMajor = Math.abs(Math.round(lat / minorStepLat) % 5) === 0;
      yTicks.push({ y, isMajor, label: isMajor ? lat.toFixed(latDecimals) : undefined });
    }
  }

  const removeGuide = (id: string) => setGuides?.((prev) => prev.filter((g) => g.id !== id));

  return (
    <>
      {/* Top Ruler */}
      <svg
        className="border-border bg-muted/90 pointer-events-auto absolute top-0 right-0 left-[24px] z-20 h-6 cursor-ns-resize border-b select-none"
        style={{ width: rulerWidth }}
        onMouseDown={startDrag("h")}
        aria-label="Longitude ruler — drag down to add a horizontal guide"
      >
        {ticks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={t.x}
              y1={t.isMajor ? 12 : 18}
              x2={t.x}
              y2={24}
              className="stroke-muted-foreground/50"
              strokeWidth={1}
            />
            {t.label && (
              <text
                x={t.x}
                y={10}
                className="fill-muted-foreground font-mono text-xs"
                textAnchor="middle"
              >
                {t.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Left Ruler */}
      <svg
        className="border-border bg-muted/90 pointer-events-auto absolute top-[24px] bottom-0 left-0 z-20 w-6 cursor-ew-resize border-r select-none"
        style={{ height: rulerHeight }}
        onMouseDown={startDrag("v")}
        aria-label="Latitude ruler — drag right to add a vertical guide"
      >
        {yTicks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={t.isMajor ? 12 : 18}
              y1={t.y}
              x2={24}
              y2={t.y}
              className="stroke-muted-foreground/50"
              strokeWidth={1}
            />
            {t.label && (
              <text
                x={10}
                y={t.y + 3}
                className="fill-muted-foreground font-mono text-xs"
                textAnchor="end"
              >
                {t.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Corner box */}
      <div className="border-border bg-muted pointer-events-none absolute top-0 left-0 z-30 flex h-6 w-6 items-center justify-center border-r border-b">
        <span className="text-muted-foreground font-mono text-xs font-bold">°</span>
      </div>

      {/* Guides */}
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
        {showGuides &&
          guides.map((guide) => {
            if (guide.type === "v") {
              const x = map.project([guide.value, center.lat]).x;
              if (x < RULER || x > rect.width) return null;
              return (
                <line
                  key={guide.id}
                  x1={x}
                  y1={RULER}
                  x2={x}
                  y2={rect.height}
                  className="pointer-events-auto cursor-col-resize stroke-cyan-500/80"
                  strokeWidth={1.5}
                  strokeDasharray="4,4"
                  onDoubleClick={() => removeGuide(guide.id)}
                >
                  <title>Double-click to delete guide</title>
                </line>
              );
            }
            const y = map.project([center.lng, guide.value]).y;
            if (y < RULER || y > rect.height) return null;
            return (
              <line
                key={guide.id}
                x1={RULER}
                y1={y}
                x2={rect.width}
                y2={y}
                className="pointer-events-auto cursor-row-resize stroke-cyan-500/80"
                strokeWidth={1.5}
                strokeDasharray="4,4"
                onDoubleClick={() => removeGuide(guide.id)}
              >
                <title>Double-click to delete guide</title>
              </line>
            );
          })}

        {activeDragGuide &&
          (activeDragGuide.type === "v" ? (
            <line
              x1={activeDragGuide.screenPos}
              y1={RULER}
              x2={activeDragGuide.screenPos}
              y2={rect.height}
              className="stroke-amber-500/80"
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          ) : (
            <line
              x1={RULER}
              y1={activeDragGuide.screenPos}
              x2={rect.width}
              y2={activeDragGuide.screenPos}
              className="stroke-amber-500/80"
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          ))}
      </svg>
    </>
  );
});
