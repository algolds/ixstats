"use client";

/**
 * CountryMapPreview — passive, non-interactive country map rendered as a cached PNG
 * snapshot from the shared offscreen factory (one WebGL context for ALL previews on
 * the page). Stays in sync with the origin via `mapDataVersion`. Click to "promote"
 * to a live, interactive instance (the re-parented singleton) on demand.
 *
 * Drop-in for CountryMapEmbed on read-only surfaces (cards, lists, infoboxes, heroes).
 */

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { MapPin, Loader2 } from "lucide-react";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { getSnapshot } from "~/lib/map-snapshot/snapshot-service";
import { buildCountryLayers } from "~/lib/map-snapshot/builders";
import { useMapDataVersion } from "~/stores/map-data-version";

const CountryMapEmbed = dynamic(
  () => import("~/components/maps/widgets/CountryMapEmbed").then((m) => m.CountryMapEmbed),
  { ssr: false }
);

export interface CountryMapPreviewProps {
  countryId: string;
  height?: string; // tailwind height class, matches CountryMapEmbed
  className?: string;
  showNeighbors?: boolean;
  showCities?: boolean;
  showSubdivisions?: boolean;
  boundsPadding?: number;
  /** Allow click-to-promote to a live interactive map. Default true. */
  promoteOnClick?: boolean;
}

// Round measured size so tiny layout jitters reuse the same cached snapshot.
const roundTo = (n: number, step = 40) => Math.max(step, Math.round(n / step) * step);

export function CountryMapPreview({
  countryId,
  height = "h-64",
  className = "",
  showNeighbors = true,
  showCities = true,
  showSubdivisions = false,
  boundsPadding = 30,
  promoteOnClick = true,
}: CountryMapPreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [promoted, setPromoted] = useState(false);
  const version = useMapDataVersion();

  const data = useCountryMapEmbed(countryId);

  // Measure the box; round to keep the snapshot cache warm across minor resizes.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const w = roundTo(el.clientWidth);
      const h = roundTo(el.clientHeight);
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cacheKey = useMemo(() => {
    if (!size || !data.geometry) return null;
    return [
      "country",
      countryId,
      `${size.w}x${size.h}`,
      showNeighbors ? "n" : "",
      showCities ? "c" : "",
      showSubdivisions ? "s" : "",
      `d${data.dataUpdatedAt}`,
      `v${version}`,
    ].join(":");
  }, [
    size,
    data.geometry,
    data.dataUpdatedAt,
    countryId,
    showNeighbors,
    showCities,
    showSubdivisions,
    version,
  ]);

  useEffect(() => {
    if (!cacheKey || !size || !data.geometry) return;
    let cancelled = false;
    getSnapshot({
      key: cacheKey,
      width: size.w,
      height: size.h,
      projectionMode: "mercator",
      bbox: data.bbox,
      center: data.centroid ? [data.centroid.lng, data.centroid.lat] : undefined,
      zoom: 3,
      boundsPadding,
      maxZoom: 10,
      build: (map, maplibregl) =>
        buildCountryLayers(
          map,
          maplibregl,
          { ...(data as any), countryId },
          { showNeighbors, showCities, showSubdivisions }
        ),
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // data fields are stable references from the query's useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Promoted → hand off to the live interactive embed (uses the shared singleton).
  if (promoted) {
    return (
      <CountryMapEmbed
        countryId={countryId}
        height={height}
        className={className}
        showNeighbors={showNeighbors}
        showCities={showCities}
        showSubdivisions={showSubdivisions}
        interactive
        boundsPadding={boundsPadding}
      />
    );
  }

  if (data.isLoading) {
    return (
      <div className={`bg-muted flex items-center justify-center ${height} ${className}`}>
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data.hasGeometry) {
    return (
      <div
        className={`bg-muted flex flex-col items-center justify-center gap-2 ${height} ${className}`}
      >
        <MapPin className="text-muted-foreground h-6 w-6" />
        <span className="text-muted-foreground text-xs">No map data available</span>
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      className={`bg-muted relative overflow-hidden ${height} ${className} ${promoteOnClick ? "cursor-pointer" : ""}`}
      style={{ minHeight: 200 }}
      onClick={promoteOnClick ? () => setPromoted(true) : undefined}
      title={promoteOnClick ? "Click to interact" : undefined}
    >
      {src ? (
        <img src={src} alt="Country map" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
