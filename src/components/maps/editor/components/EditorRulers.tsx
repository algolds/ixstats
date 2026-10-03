"use client";

/**
 * Lng/lat rulers along the top and left edges of the editor canvas, plus draggable guides.
 * Re-renders on map move (throttled to one frame) so ticks and guides track the camera; it is its
 * own component so that re-render stays local instead of re-rendering the whole EditorMap.
 */

import React, { memo, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

interface EditorGuide {
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

/** Major tick spacing (degrees) for a visible span: the first row whose limit exceeds the span. */
const STEPS: [limit: number, step: number][] = [
  [0.1, 0.01],
  [0.2, 0.02],
  [0.5, 0.05],
  [1, 0.1],
  [2, 0.2],
  [5, 0.5],
  [10, 1],
  [25, 2],
  [50, 5],
  [100, 10],
];

const pickStep = (span: number) => STEPS.find(([limit]) => span < limit)?.[1] ?? 20;

interface Tick {
  pos: number;
  isMajor: boolean;
  label?: string;
}

/** Ticks between `lo` and `hi` (degrees), placed by `toScreen` and kept within [0, size]. */
function rulerTicks(lo: number, hi: number, toScreen: (value: number) => number, size: number) {
  const step = pickStep(hi - lo);
  const minorStep = step / 5;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks: Tick[] = [];
  for (
    let v = Math.ceil(lo / minorStep) * minorStep;
    v <= Math.floor(hi / minorStep) * minorStep + minorStep / 2;
    v += minorStep
  ) {
    const pos = toScreen(v) - RULER;
    if (pos >= 0 && pos <= size) {
      const isMajor = Math.abs(Math.round(v / minorStep) % 5) === 0;
      ticks.push({ pos, isMajor, label: isMajor ? v.toFixed(decimals) : undefined });
    }
  }
  return ticks;
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

type DragGuide = { type: "h" | "v"; currentVal: number; screenPos: number };

/** The guide a drag at container pixel (x, y) would create: horizontal follows latitude, vertical longitude. */
function dragGuideAt(map: MapLibreMap, type: "h" | "v", x: number, y: number): DragGuide {
  const ll = map.unproject([x, y]);
  return type === "h"
    ? { type, currentVal: ll.lat, screenPos: y }
    : { type, currentVal: ll.lng, screenPos: x };
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

  const [activeDragGuide, setActiveDragGuide] = useState<DragGuide | null>(null);
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
      setActiveDragGuide(dragGuideAt(map, type, x, y));
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
          id: `guide-${crypto.randomUUID()}`,
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
    dragTypeRef.current = type;
    setActiveDragGuide(dragGuideAt(map, type, e.clientX - rect.left, e.clientY - rect.top));
  };

  const rect = containerRef.current?.getBoundingClientRect();
  if (!map || !isLoaded || !rect) return null;

  const rulerWidth = rect.width - RULER;
  const rulerHeight = rect.height - RULER;
  const center = map.getCenter();

  const ticks = rulerTicks(
    map.unproject([RULER, 0]).lng,
    map.unproject([rect.width, 0]).lng,
    (lng) => map.project([lng, center.lat]).x,
    rulerWidth
  );
  const yTicks = rulerTicks(
    map.unproject([0, rect.height]).lat,
    map.unproject([0, RULER]).lat,
    (lat) => map.project([center.lng, lat]).y,
    rulerHeight
  );

  const removeGuide = (id: string) => setGuides?.((prev) => prev.filter((g) => g.id !== id));

  return (
    <>
      <svg
        className="border-separator bg-fill-2 pointer-events-auto absolute top-0 right-0 left-[24px] z-20 h-6 cursor-ns-resize border-b select-none"
        style={{ width: rulerWidth }}
        onMouseDown={startDrag("h")}
        aria-label="Longitude ruler: drag down to add a horizontal guide"
      >
        {ticks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={t.pos}
              y1={t.isMajor ? 12 : 18}
              x2={t.pos}
              y2={24}
              className="stroke-label-tertiary"
              strokeWidth={1}
            />
            {t.label && (
              <text
                x={t.pos}
                y={10}
                className="fill-label-secondary text-footnote tabular-nums"
                textAnchor="middle"
              >
                {t.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      <svg
        className="border-separator bg-fill-2 pointer-events-auto absolute top-[24px] bottom-0 left-0 z-20 w-6 cursor-ew-resize border-r select-none"
        style={{ height: rulerHeight }}
        onMouseDown={startDrag("v")}
        aria-label="Latitude ruler: drag right to add a vertical guide"
      >
        {yTicks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={t.isMajor ? 12 : 18}
              y1={t.pos}
              x2={24}
              y2={t.pos}
              className="stroke-label-tertiary"
              strokeWidth={1}
            />
            {t.label && (
              <text
                x={10}
                y={t.pos + 3}
                className="fill-label-secondary text-footnote tabular-nums"
                textAnchor="end"
              >
                {t.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="border-separator bg-fill-3 pointer-events-none absolute top-0 left-0 z-30 flex h-6 w-6 items-center justify-center border-r border-b">
        <span className="text-label-secondary text-caption font-mono font-semibold">°</span>
      </div>

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
                  className="stroke-cyan/80 pointer-events-auto cursor-col-resize"
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
                className="stroke-cyan/80 pointer-events-auto cursor-row-resize"
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
              className="stroke-yellow/80"
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          ) : (
            <line
              x1={RULER}
              y1={activeDragGuide.screenPos}
              x2={rect.width}
              y2={activeDragGuide.screenPos}
              className="stroke-yellow/80"
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          ))}
      </svg>
    </>
  );
});
