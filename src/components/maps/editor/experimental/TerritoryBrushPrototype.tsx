/**
 * TerritoryBrushPrototype — spike component (plan 012, NOT production).
 *
 * FEATURE FLAG: only renders when URL contains ?brush=1
 *
 * Usage (dev only):
 *   http://localhost:3000/maps?brush=1   (or any page that renders this)
 *
 * Mounts an isolated MapLibre GL map that:
 *  1. Renders a hard-coded two-feature fixture (left square / right square).
 *  2. Lets the user drag a brush stroke over the shared border.
 *  3. On pointer-up calls applyBrushStroke() and shows the resulting shapes
 *     as a live preview layer (green = transferred slice, blue = new source,
 *     orange = new target).
 *
 * This component is INTENTIONALLY standalone — it does NOT reuse
 * BorderEditorPanel, useBorderEditor, or any production save path.
 * The production wiring plan is in docs/design/territory-brush.md.
 *
 * SPIKE / EXPERIMENTAL — do not import from production code.
 */

"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useSearchParams } from "next/navigation";
import type { Polygon, MultiPolygon, FeatureCollection } from "geojson";
import { applyBrushStroke } from "./territory-brush-math";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture geometries (unit-square adjacency — same as the test)
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_SOURCE: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-1, 0],
      [0, 0],
      [0, 1],
      [-1, 1],
      [-1, 0],
    ],
  ],
};

const FIXTURE_TARGET: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewState {
  source: Polygon | MultiPolygon;
  target: Polygon | MultiPolygon;
  issues: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Brush state hook
// ─────────────────────────────────────────────────────────────────────────────

function useBrushStroke(
  radiusKm: number,
  source: Polygon | MultiPolygon,
  target: Polygon | MultiPolygon
) {
  const [strokePoints, setStrokePoints] = useState<[number, number][]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>(
    "Drag on the map near the shared border to paint."
  );

  const commitStroke = useCallback(
    (points: [number, number][]) => {
      if (points.length === 0) return;
      const result = applyBrushStroke(points, radiusKm, source, target);
      if (!result) {
        setStatusMsg(
          "No overlap with source — try dragging closer to the left square."
        );
        setPreview(null);
      } else {
        setPreview(result);
        setStatusMsg(
          `Transfer complete. Issues: ${result.issues.length > 0 ? result.issues.join(", ") : "none"}`
        );
      }
      setStrokePoints([]);
    },
    [radiusKm, source, target]
  );

  return { strokePoints, setStrokePoints, preview, isPainting, setIsPainting, commitStroke, statusMsg };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inner prototype — rendered only when ?brush=1 is in the URL.
 * Dynamically imports MapLibre to avoid SSR issues.
 */
function BrushProtoInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  // maplibre-gl: typed as any because the map object is acquired via dynamic import
  // at runtime; using unknown would require excessive type assertions throughout.
  const mapRef = useRef<any>(null);
  const [radiusKm, setRadiusKm] = useState(15);
  const [source, setSource] = useState<Polygon | MultiPolygon>(FIXTURE_SOURCE);
  const [target, setTarget] = useState<Polygon | MultiPolygon>(FIXTURE_TARGET);
  const [mapReady, setMapReady] = useState(false);

  const {
    strokePoints,
    setStrokePoints,
    preview,
    isPainting,
    setIsPainting,
    commitStroke,
    statusMsg,
  } = useBrushStroke(radiusKm, source, target);

  // ── Apply preview to committed state ────────────────────────────────────
  const applyPreview = useCallback(() => {
    if (!preview) return;
    setSource(preview.source);
    setTarget(preview.target);
  }, [preview]);

  // ── Initialize MapLibre ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamic import to avoid SSR/Turbopack issues with maplibre-gl
    void import("maplibre-gl").then(({ default: maplibregl }) => {
      void import("maplibre-gl/dist/maplibre-gl.css").catch(() => {
        /* css import may fail in jest/test environments */
      });

      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#1a1a2e" },
            },
          ],
        },
        center: [0, 0.5],
        zoom: 5,
        attributionControl: false,
      });

      map.on("load", () => {
        // ── Source feature layers ──────────────────────────────────────────
        map.addSource("brush-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", geometry: FIXTURE_SOURCE, properties: { role: "source" } },
            ],
          },
        });

        map.addSource("brush-target", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", geometry: FIXTURE_TARGET, properties: { role: "target" } },
            ],
          },
        });

        map.addSource("brush-preview-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addSource("brush-preview-target", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addSource("brush-stroke", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

        map.addLayer({
          id: "source-fill",
          type: "fill",
          source: "brush-source",
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.4 },
        });
        map.addLayer({
          id: "target-fill",
          type: "fill",
          source: "brush-target",
          paint: { "fill-color": "#f59e0b", "fill-opacity": 0.4 },
        });
        map.addLayer({
          id: "source-outline",
          type: "line",
          source: "brush-source",
          paint: { "line-color": "#60a5fa", "line-width": 2 },
        });
        map.addLayer({
          id: "target-outline",
          type: "line",
          source: "brush-target",
          paint: { "line-color": "#fbbf24", "line-width": 2 },
        });

        // Preview layers (shown after applyBrushStroke)
        map.addLayer({
          id: "preview-source-fill",
          type: "fill",
          source: "brush-preview-source",
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.7 },
        });
        map.addLayer({
          id: "preview-target-fill",
          type: "fill",
          source: "brush-preview-target",
          paint: { "fill-color": "#f59e0b", "fill-opacity": 0.7 },
        });
        map.addLayer({
          id: "preview-source-outline",
          type: "line",
          source: "brush-preview-source",
          paint: { "line-color": "#93c5fd", "line-width": 3, "line-dasharray": [4, 2] },
        });
        map.addLayer({
          id: "preview-target-outline",
          type: "line",
          source: "brush-preview-target",
          paint: { "line-color": "#fde68a", "line-width": 3, "line-dasharray": [4, 2] },
        });

        mapRef.current = map;
        setMapReady(true);
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Map is intentionally initialized once on mount only.
  }, []);

  // ── Pointer event handlers ───────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!mapRef.current || !mapReady) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPainting(true);

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const lngLat = mapRef.current.unproject([x, y]);
      setStrokePoints([[lngLat.lng, lngLat.lat]]);
    },
    [mapReady, setIsPainting, setStrokePoints]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPainting || !mapRef.current || !mapReady) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const lngLat = mapRef.current.unproject([x, y]);
      const pt: [number, number] = [lngLat.lng, lngLat.lat];

      setStrokePoints((prev) => [...prev, pt]);

      // Update the stroke visualisation source
      const src = mapRef.current.getSource("brush-stroke");
      if (src && strokePoints.length > 0) {
        const lineFC: FeatureCollection = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [...strokePoints, pt],
              },
            },
          ],
        };
        src.setData(lineFC);
      }
    },
    [isPainting, mapReady, strokePoints, setStrokePoints]
  );

  const handlePointerUp = useCallback(() => {
    if (!isPainting) return;
    setIsPainting(false);
    commitStroke(strokePoints);
  }, [isPainting, setIsPainting, commitStroke, strokePoints]);

  // ── Sync geometries to map sources ───────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const srcSource = mapRef.current.getSource("brush-source");
    if (srcSource) {
      const fc: FeatureCollection = {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: source, properties: {} }],
      };
      srcSource.setData(fc);
    }
    const tgtSource = mapRef.current.getSource("brush-target");
    if (tgtSource) {
      const fc: FeatureCollection = {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: target, properties: {} }],
      };
      tgtSource.setData(fc);
    }
  }, [source, target, mapReady]);

  // ── Sync preview to map ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const previewSrcSource = mapRef.current.getSource("brush-preview-source");
    const previewTgtSource = mapRef.current.getSource("brush-preview-target");

    if (!previewSrcSource || !previewTgtSource) return;

    if (!preview) {
      const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
      previewSrcSource.setData(empty);
      previewTgtSource.setData(empty);
    } else {
      previewSrcSource.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: preview.source, properties: {} }],
      });
      previewTgtSource.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: preview.target, properties: {} }],
      });
    }
  }, [preview, mapReady]);

  // ── Memoised radius label ────────────────────────────────────────────────
  const radiusLabel = useMemo(() => `${radiusKm} km`, [radiusKm]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        zIndex: 9999,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          background: "#1e293b",
          borderBottom: "1px solid #334155",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          color: "#f1f5f9",
          fontFamily: "monospace",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#fbbf24", fontWeight: "bold" }}>
          [SPIKE] Territory Brush — plan 012
        </span>
        <span style={{ color: "#94a3b8" }}>|</span>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Brush radius:
          <input
            type="range"
            min={2}
            max={80}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            style={{ width: 100 }}
          />
          <span style={{ minWidth: 50, color: "#7dd3fc" }}>{radiusLabel}</span>
        </label>
        {preview && (
          <>
            <button
              onClick={applyPreview}
              style={{
                background: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "4px 12px",
                cursor: "pointer",
                fontFamily: "monospace",
              }}
            >
              Apply
            </button>
            <button
              onClick={() => {
                setSource(FIXTURE_SOURCE);
                setTarget(FIXTURE_TARGET);
              }}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "4px 12px",
                cursor: "pointer",
                fontFamily: "monospace",
              }}
            >
              Reset
            </button>
          </>
        )}
        <span
          style={{
            marginLeft: "auto",
            color: preview ? "#4ade80" : "#94a3b8",
            maxWidth: 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {statusMsg}
        </span>
      </div>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          background: "rgba(15,23,42,0.85)",
          borderRadius: 6,
          padding: "8px 12px",
          color: "#f1f5f9",
          fontFamily: "monospace",
          fontSize: 12,
          lineHeight: 1.8,
          zIndex: 10,
          border: "1px solid #334155",
        }}
      >
        <div>
          <span style={{ color: "#60a5fa" }}>■</span> Source (loses area)
        </div>
        <div>
          <span style={{ color: "#fbbf24" }}>■</span> Target (gains area)
        </div>
        <div>
          <span style={{ color: "#93c5fd" }}>⋯</span> Preview source
        </div>
        <div>
          <span style={{ color: "#fde68a" }}>⋯</span> Preview target
        </div>
        <div style={{ color: "#94a3b8", marginTop: 4 }}>
          Drag over left→right to transfer
        </div>
      </div>

      {/* Map canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, cursor: isPainting ? "crosshair" : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported guard — gates on ?brush=1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop this anywhere in the maps page tree (server component wrapping is fine —
 * this is a client component). Renders nothing unless ?brush=1 is in the URL.
 *
 * Example:
 *   // src/app/maps/page.tsx
 *   import { TerritoryBrushPrototype } from
 *     "~/components/maps/editor/experimental/TerritoryBrushPrototype";
 *
 *   export default function MapsPage() {
 *     return (
 *       <>
 *         <TerritoryBrushPrototype />
 *         <IxWorldMap ... />
 *       </>
 *     );
 *   }
 */
export function TerritoryBrushPrototype() {
  const searchParams = useSearchParams();
  const brushEnabled = searchParams.get("brush") === "1";

  if (!brushEnabled) return null;
  return <BrushProtoInner />;
}
