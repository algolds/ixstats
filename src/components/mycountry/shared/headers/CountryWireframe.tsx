"use client";

import React from "react";
import { MapPin } from "lucide-react";
import type { Geometry } from "geojson";

type LngLat = [number, number];

interface CityPoint {
  coordinates?: LngLat | number[] | null;
  isNationalCapital?: boolean | null;
  name?: string;
}

interface CountryWireframeProps {
  geometry: Geometry | null;
  cities?: CityPoint[];
  className?: string;
  /** Stroke/glow color. Defaults to emerald to match the Geography section. */
  color?: string;
  label?: string;
}

const VIEW_W = 1000;
const PAD = 40;

/**
 * Flatten a GeoJSON Polygon/MultiPolygon into an array of rings ([lng,lat][]).
 * Returns [] for unsupported geometry types or null.
 */
export function extractRings(geometry: Geometry | null): LngLat[][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring) => ring.map((p) => [p[0], p[1]] as LngLat));
  }
  if (geometry.type === "MultiPolygon") {
    const rings: LngLat[][] = [];
    for (const poly of geometry.coordinates) {
      for (const ring of poly) {
        rings.push(ring.map((p) => [p[0], p[1]] as LngLat));
      }
    }
    return rings;
  }
  return [];
}

export const CountryWireframe = React.memo(function CountryWireframe({
  geometry,
  cities = [],
  className = "",
  color = "#10b981",
  label,
}: CountryWireframeProps) {
  const model = React.useMemo(() => {
    const rings = extractRings(geometry);
    if (rings.length === 0) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const r of rings) {
      for (const p of r) {
        if (p[1] < minLat) minLat = p[1];
        if (p[1] > maxLat) maxLat = p[1];
      }
    }
    const kx = Math.max(0.1, Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180));

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const projRings = rings.map((r) =>
      r.map((p) => {
        const x = p[0] * kx;
        const y = p[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        return [x, y] as LngLat;
      })
    );

    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);
    const scale = (VIEW_W - 2 * PAD) / spanX;
    const viewH = spanY * scale + 2 * PAD;

    const toScreen = (px: number, py: number): LngLat => [
      PAD + (px - minX) * scale,
      PAD + (maxY - py) * scale,
    ];

    const ringPaths = projRings.map((r) =>
      r
        .map(([x, y]) =>
          toScreen(x, y)
            .map((n) => n.toFixed(1))
            .join(",")
        )
        .join(" ")
    );

    const cityDots = cities
      .filter(
        (c): c is CityPoint & { coordinates: number[] } =>
          Array.isArray(c.coordinates) && c.coordinates.length >= 2
      )
      .map((c) => {
        const [x, y] = toScreen(c.coordinates[0] * kx, c.coordinates[1]);
        return { x, y, capital: !!c.isNationalCapital };
      })
      .filter((d) => d.x >= 0 && d.x <= VIEW_W && d.y >= 0 && d.y <= viewH);

    return { ringPaths, viewH, cityDots };
  }, [geometry, cities]);

  if (!model) {
    return (
      <div className={`bg-card/40 flex h-full w-full items-center justify-center ${className}`}>
        <p className="text-muted-foreground text-xs">No map geometry linked to this country.</p>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#0a1628] ${className}`}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${model.viewH}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <defs>
          <pattern id="cw-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke={color} strokeOpacity="0.08" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={VIEW_W} height={model.viewH} fill="url(#cw-grid)" />
        {model.ringPaths.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill={color}
            fillOpacity="0.06"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        ))}
        {model.cityDots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.capital ? 7 : 4}
            fill={d.capital ? "#fbbf24" : color}
            stroke="#0a1628"
            strokeWidth="1.5"
            style={{ filter: `drop-shadow(0 0 4px ${d.capital ? "#fbbf24" : color})` }}
          />
        ))}
      </svg>
      <div className="border-border bg-card/85 text-muted-foreground pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] backdrop-blur-sm">
        <MapPin className="h-2.5 w-2.5" />
        {label ?? "Wireframe"}
      </div>
    </div>
  );
});
