// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * ProvinceGeneratorPreview — Experimental spike (Plan 015)
 *
 * FLAG-GATED: renders only when `?provgen=1` is in the URL.
 *
 * Picks a country by featureId, runs generateProvinces() client-side,
 * and draws the resulting Voronoi cells as a colored preview layer on
 * a MapLibre map. No data is persisted; this is a read-only prototype.
 *
 * To open:  /maps?provgen=1
 * Or:       /maps?provgen=1&feature=<featureId>&count=8
 *
 * DO NOT import this from any production editor component. It is only
 * rendered via the flag guard in ProvinceGeneratorGate.tsx.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { featureCollection, feature as turfFeature } from "@turf/helpers";
import { generateProvinces, totalProvinceArea } from "~/lib/province-generator";
import { api } from "~/trpc/react";

// ──────────────────────────────────────────────────────────────
// Colour palette for Voronoi cells (loops)
// ──────────────────────────────────────────────────────────────
const PROVINCE_COLORS = [
  "#e53e3e", "#dd6b20", "#d69e2e", "#38a169",
  "#3182ce", "#805ad5", "#d53f8c", "#319795",
  "#718096", "#c05621", "#2b6cb0", "#276749",
];

function colorForIndex(i: number): string {
  return PROVINCE_COLORS[i % PROVINCE_COLORS.length] ?? "#888";
}

// ──────────────────────────────────────────────────────────────
// Province preview FeatureCollection builder
// ──────────────────────────────────────────────────────────────
function buildPreviewFC(provinces: (Polygon | MultiPolygon)[]): FeatureCollection {
  return featureCollection(
    provinces.map((geom, i) =>
      turfFeature(geom, { provinceIndex: i, color: colorForIndex(i) })
    )
  );
}

// ──────────────────────────────────────────────────────────────
// Tiny seeded color picker for stable label colors
// ──────────────────────────────────────────────────────────────
const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────
export function ProvinceGeneratorPreview() {
  const searchParams = useSearchParams();

  // URL params
  const initialFeatureId = searchParams.get("feature") ?? "";
  const initialCount = Math.max(1, Math.min(50, parseInt(searchParams.get("count") ?? "6", 10) || 6));

  // UI state
  const [featureId, setFeatureId] = useState(initialFeatureId);
  const [count, setCount] = useState(initialCount);
  const [seed, setSeed] = useState(42);
  const [submitted, setSubmitted] = useState(!!initialFeatureId);

  // Map refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const sourcesReady = useRef(false);

  // ── tRPC: country list for the picker dropdown ──────────────
  const { data: countryList } = api.geoCore.listCountries.useQuery();

  // ── tRPC: country geometry on demand ───────────────────────
  const { data: geoData, isFetching } = api.geoCore.getCountryGeometry.useQuery(
    { featureId: featureId || undefined },
    { enabled: submitted && featureId.length > 0 }
  );

  // ── Client-side province generation ────────────────────────
  const provinces = useMemo(() => {
    const geom = geoData?.geometry as Polygon | MultiPolygon | undefined;
    if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) return [];
    return generateProvinces(geom, count, { seed });
  }, [geoData?.geometry, count, seed]);

  const previewFC = useMemo(() => buildPreviewFC(provinces), [provinces]);

  const countryArea = useMemo(() => {
    const geom = geoData?.geometry as Polygon | MultiPolygon | undefined;
    if (!geom) return 0;
    return totalProvinceArea([geom]);
  }, [geoData?.geometry]);

  const coveragePct = useMemo(() => {
    if (countryArea === 0 || provinces.length === 0) return 0;
    return (totalProvinceArea(provinces) / countryArea) * 100;
  }, [provinces, countryArea]);

  // ── Map init ───────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("maplibre-gl").then(({ default: maplibregl }) => {
      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "background", type: "background", paint: { "background-color": "#0a1628" } }],
        },
        center: [0, 20],
        zoom: 2,
      });

      map.on("load", () => {
        // Province fill layer — data-driven color from feature property
        map.addSource("provinces", { type: "geojson", data: EMPTY_FC });
        map.addLayer({
          id: "province-fill",
          type: "fill",
          source: "provinces",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.35,
          },
        });
        map.addLayer({
          id: "province-line",
          type: "line",
          source: "provinces",
          paint: {
            "line-color": "#fff",
            "line-width": 1.2,
            "line-opacity": 0.8,
          },
        });

        // Country outline
        map.addSource("country-border", { type: "geojson", data: EMPTY_FC });
        map.addLayer({
          id: "country-border-line",
          type: "line",
          source: "country-border",
          paint: {
            "line-color": "#f6e05e",
            "line-width": 2,
          },
        });

        sourcesReady.current = true;
        mapRef.current = map;
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      sourcesReady.current = false;
    };
  }, []);

  // ── Update province source when provinces change ───────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourcesReady.current) return;

    const provinceSource = map.getSource("provinces");
    if (provinceSource) provinceSource.setData(previewFC);
  }, [previewFC]);

  // ── Update country border when geometry changes ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourcesReady.current) return;
    const geom = geoData?.geometry as Polygon | MultiPolygon | undefined;
    const borderSource = map.getSource("country-border");
    if (borderSource) {
      borderSource.setData(
        geom
          ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: geom, properties: {} }] }
          : EMPTY_FC
      );
    }
    // Fly to bounding box
    if (geoData?.bbox) {
      const { minLng, minLat, maxLng, maxLat } = geoData.bbox;
      if (minLng != null && minLat != null && maxLng != null && maxLat != null) {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, duration: 800 });
      }
    }
  }, [geoData]);

  // ── Handlers ───────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (!featureId) return;
    setSubmitted(true);
  }, [featureId]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-yellow-500/40 bg-black/40 px-4 py-2">
        <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs font-mono text-yellow-300">
          EXPERIMENTAL · provgen=1
        </span>
        <h1 className="text-sm font-semibold">Province Generator Spike — Plan 015</h1>
        <span className="ml-auto text-xs text-gray-400">Read-only · no data saved</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 border-b border-white/10 bg-gray-800/60 px-4 py-3">
        {/* Country picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Country (featureId)</label>
          {countryList && countryList.length > 0 ? (
            <select
              className="rounded border border-white/20 bg-gray-700 px-2 py-1 text-sm text-white"
              value={featureId}
              onChange={(e) => { setFeatureId(e.target.value); setSubmitted(false); }}
            >
              <option value="">— select —</option>
              {countryList.map((c) => (
                <option key={c.featureId} value={c.featureId}>
                  {c.displayName ?? c.featureId}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="w-48 rounded border border-white/20 bg-gray-700 px-2 py-1 text-sm text-white"
              placeholder="featureId (e.g. country_123)"
              value={featureId}
              onChange={(e) => { setFeatureId(e.target.value); setSubmitted(false); }}
            />
          )}
        </div>

        {/* Count */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Province count (1–50)</label>
          <input
            type="number"
            min={1}
            max={50}
            className="w-24 rounded border border-white/20 bg-gray-700 px-2 py-1 text-sm text-white"
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
          />
        </div>

        {/* Seed */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Seed</label>
          <input
            type="number"
            className="w-24 rounded border border-white/20 bg-gray-700 px-2 py-1 text-sm text-white"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
          />
        </div>

        <button
          className="rounded bg-yellow-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          onClick={handleGenerate}
          disabled={!featureId || isFetching}
        >
          {isFetching ? "Loading…" : "Generate"}
        </button>

        {/* Stats */}
        {provinces.length > 0 && (
          <div className="ml-auto flex gap-4 text-xs text-gray-300">
            <span><span className="font-mono text-yellow-300">{provinces.length}</span> provinces</span>
            <span>Coverage: <span className="font-mono text-green-300">{coveragePct.toFixed(1)}%</span></span>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {!featureId && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Select a country and click Generate
          </div>
        )}
      </div>
    </div>
  );
}
