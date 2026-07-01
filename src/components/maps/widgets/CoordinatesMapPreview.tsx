"use client";

/**
 * CoordinatesMapPreview — snapshot replacement for CoordinatesMapEmbed.
 *
 * The old component spun up a fresh maplibregl.Map() per instance, so a wiki article
 * with several {{map}} tags exhausted the browser's WebGL context pool and the maps
 * broke. This renders each as a cached PNG from the shared offscreen factory (one
 * context for all), lazily when scrolled near view. Click promotes to a live,
 * interactive map on demand.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { getSnapshot } from "~/lib/map-snapshot/snapshot-service";
import { buildCoordsLayers } from "~/lib/map-snapshot/builders";
import { useMapDataVersion } from "~/stores/map-data-version";

const CoordinatesMapEmbed = dynamic(
  () => import("~/components/maps/widgets/CoordinatesMapEmbed").then((m) => m.CoordinatesMapEmbed),
  { ssr: false }
);

export interface CoordinatesMapPreviewProps {
  lat: number;
  lng: number;
  zoom?: number;
  options?: string; // height=400|width=100%|interactive=yes|title=My Title
}

const roundTo = (n: number, step = 40) => Math.max(step, Math.round(n / step) * step);

export function CoordinatesMapPreview({ lat, lng, zoom = 5, options = "" }: CoordinatesMapPreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [promoted, setPromoted] = useState(false);
  const version = useMapDataVersion();

  const parsed = useMemo(() => {
    const o: Record<string, string> = {};
    for (const part of options.split("|")) {
      const [k, v] = part.split("=");
      if (k && v) o[k.trim().toLowerCase()] = v.trim();
    }
    return o;
  }, [options]);

  const heightVal = parsed.height
    ? isNaN(Number(parsed.height))
      ? parsed.height
      : `${parsed.height}px`
    : "300px";
  const title = parsed.title || "";
  const allowPromote = parsed.interactive !== "no";

  const { data: worldMap, dataUpdatedAt: worldUpdatedAt } = api.geoCore.getWorldMap.useQuery(
    { layers: ["political"] },
    { enabled: inView, staleTime: 30 * 60_000, gcTime: 2 * 60 * 60_000 }
  );
  const worldPolitical = (worldMap as Record<string, unknown> | undefined)?.political as
    | GeoJSON.FeatureCollection
    | undefined;

  // Lazy: only render once scrolled near view.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Measure box.
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
    if (!inView || !size || !worldPolitical) return null;
    return [
      "coords",
      lat.toFixed(4),
      lng.toFixed(4),
      zoom,
      `${size.w}x${size.h}`,
      `d${worldUpdatedAt}`,
      `v${version}`,
    ].join(":");
  }, [inView, size, worldPolitical, lat, lng, zoom, worldUpdatedAt, version]);

  useEffect(() => {
    if (!cacheKey || !size) return;
    let cancelled = false;
    getSnapshot({
      key: cacheKey,
      width: size.w,
      height: size.h,
      projectionMode: "mercator",
      center: [lng, lat],
      zoom,
      build: (map, maplibregl) =>
        buildCoordsLayers(map, maplibregl, { lat, lng, title, worldPolitical }),
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  if (promoted) {
    return <CoordinatesMapEmbed lat={lat} lng={lng} zoom={zoom} options={options} />;
  }

  return (
    <div
      ref={boxRef}
      className={`wikios-ixworld-embed glass-hierarchy-child relative overflow-hidden rounded-xl border border-white/10 bg-[#0a1628]/40 backdrop-blur-md ${allowPromote ? "cursor-pointer" : ""}`}
      style={{ height: heightVal }}
      onClick={allowPromote ? () => setPromoted(true) : undefined}
      title={allowPromote ? "Click to interact" : undefined}
    >
      {src ? (
        <img src={src} alt={title || "Map"} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a1628]/60 backdrop-blur-sm">
          <Loader2 className="mb-2 h-6 w-6 animate-spin text-blue-400" />
          <span className="text-xs font-medium text-zinc-400">Loading map...</span>
        </div>
      )}

      {src && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/75 px-2.5 py-1 text-[10px] text-zinc-300 backdrop-blur-md select-none">
          <MapPin size={10} className="text-blue-400" />
          <span className="font-semibold">{title || "Map Embed"}</span>
          <span className="font-mono text-[9px] text-zinc-500">
            ({lat.toFixed(3)}, {lng.toFixed(3)})
          </span>
        </div>
      )}
    </div>
  );
}
