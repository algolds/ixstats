import React, { useMemo } from "react";
import Link from "next/link";
import { MapPin } from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { withBasePath } from "~/lib/base-path";
import { safeDecodeURI } from "~/lib/wiki-os/transformers/safe-decode";

export function injectPlaceholderElements(html: string): string {
  let processed = html;

  // 0. Strip redundant <iframe> tags
  processed = processed.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");

  // 1. Process Coords anchors
  processed = processed.replace(
    /<a[^>]*href="[^"]*Coords(?::|%3a)([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (_match, coordsStr, label) => {
      const decoded = safeDecodeURI(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      const safeLat = (lat || "0").replace(/"/g, "&quot;");
      const safeLng = (lng || "0").replace(/"/g, "&quot;");
      const safeZoom = (zoom || "4").replace(/"/g, "&quot;");
      const safeLabel = (label || "Location").replace(/"/g, "&quot;");
      return `<span class="wikios-coords-placeholder" data-lat="${safeLat}" data-lng="${safeLng}" data-zoom="${safeZoom}" data-label="${safeLabel}">${label || "Location"}</span>`;
    }
  );

  // 2. Process raw Coords wikitext
  processed = processed.replace(
    /\[\[Coords:([^\]|]+)(?:\|([^\]]+))?\]\]/gi,
    (_match, coordsStr, label) => {
      const decoded = safeDecodeURI(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      const safeLat = (lat || "0").replace(/"/g, "&quot;");
      const safeLng = (lng || "0").replace(/"/g, "&quot;");
      const safeZoom = (zoom || "4").replace(/"/g, "&quot;");
      const safeLabel = (label || "Location").replace(/"/g, "&quot;");
      return `<span class="wikios-coords-placeholder" data-lat="${safeLat}" data-lng="${safeLng}" data-zoom="${safeZoom}" data-label="${safeLabel}">${label || "Location"}</span>`;
    }
  );

  // 3. Process MapEmbed anchors
  processed = processed.replace(
    /<a[^>]*href="[^"]*MapEmbed(?::|%3a)([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (_match, coordsStr, options) => {
      const decoded = safeDecodeURI(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      const safeLat = (lat || "0").replace(/"/g, "&quot;");
      const safeLng = (lng || "0").replace(/"/g, "&quot;");
      const safeZoom = (zoom || "4").replace(/"/g, "&quot;");
      const safeOptions = (options || "").replace(/"/g, "&quot;");
      return `<div class="wikios-map-embed-placeholder" data-lat="${safeLat}" data-lng="${safeLng}" data-zoom="${safeZoom}" data-options="${safeOptions}"></div>`;
    }
  );

  // 4. Process raw MapEmbed wikitext
  processed = processed.replace(
    /\[\[MapEmbed:([^\]|]+)(?:\|([^\]]+))?\]\]/gi,
    (_match, coordsStr, options) => {
      const decoded = safeDecodeURI(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      const safeLat = (lat || "0").replace(/"/g, "&quot;");
      const safeLng = (lng || "0").replace(/"/g, "&quot;");
      const safeZoom = (zoom || "4").replace(/"/g, "&quot;");
      const safeOptions = (options || "").replace(/"/g, "&quot;");
      return `<div class="wikios-map-embed-placeholder" data-lat="${safeLat}" data-lng="${safeLng}" data-zoom="${safeZoom}" data-options="${safeOptions}"></div>`;
    }
  );

  // 5. Process Template stats anchors
  processed = processed.replace(
    /<a[^>]*href="[^"]*Template(?::|%3a)([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (match, templateName) => {
      const decoded = safeDecodeURI(templateName);
      if (
        decoded.startsWith("MyCountry:") ||
        decoded.startsWith("CountryData:") ||
        decoded.startsWith("BusinessData:")
      ) {
        const safeKey = decoded.replace(/"/g, "&quot;");
        return `<span class="wikios-stat-placeholder" data-key="${safeKey}"></span>`;
      }
      return match;
    }
  );

  // 6. Process raw wikitext templates
  processed = processed.replace(
    /\{\{((?:MyCountry|CountryData|BusinessData):[^}\n]+?)\}\}/gi,
    (_match, key) => {
      const safeKey = key.replace(/"/g, "&quot;");
      return `<span class="wikios-stat-placeholder" data-key="${safeKey}"></span>`;
    }
  );

  return processed;
}

export function calculateDistanceAndBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { distanceKm: number; bearing: string } {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c);

  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  brng = (brng + 360) % 360;

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(brng / 45) % 8;
  const bearing = directions[index]!;

  return { distanceKm, bearing };
}

const CoordsMiniMap = ({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) => {
  const src = `/maps?embed=true&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}`;

  return (
    <iframe
      src={src}
      loading="lazy"
      allow="fullscreen"
      title="Map preview"
      className="h-32 w-full overflow-hidden rounded-lg border border-white/10 bg-white/5"
      style={{ height: 130, border: "none" }}
    />
  );
};

export function CoordsPill({
  lat,
  lng,
  zoom,
  label,
  viewerCentroid,
}: {
  lat: number;
  lng: number;
  zoom: number;
  label: string;
  viewerCentroid?: { lat: number; lng: number } | null;
}) {
  const calc = useMemo(() => {
    if (!viewerCentroid) return null;
    return calculateDistanceAndBearing(viewerCentroid.lat, viewerCentroid.lng, lat, lng);
  }, [viewerCentroid, lat, lng]);

  return (
    <Popover>
      <PopoverTrigger>
        <span className="wikios-coords-pill inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-blue-400 transition-all select-none hover:border-white/20 hover:bg-white/10">
          <MapPin className="h-3 w-3 animate-pulse text-blue-400" />
          <span>{label}</span>
          <span className="text-[10px] opacity-65 tabular-nums">
            ({lat.toFixed(2)}, {lng.toFixed(2)})
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent className="z-[10001] flex w-64 flex-col gap-2 rounded-xl border border-white/10 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-zinc-200">{label}</span>
          <span className="text-[10px] text-zinc-400 tabular-nums">Zoom {zoom}</span>
        </div>

        <CoordsMiniMap lat={lat} lng={lng} zoom={zoom} />

        <div className="flex flex-col gap-0.5 text-[10px] font-medium text-zinc-400">
          <div>
            Latitude: <span className="text-zinc-200 tabular-nums">{lat.toFixed(4)}</span>
          </div>
          <div>
            Longitude: <span className="text-zinc-200 tabular-nums">{lng.toFixed(4)}</span>
          </div>
          {calc && (
            <div className="mt-1 font-semibold text-blue-400">
              Distance: {calc.distanceKm.toLocaleString()} km {calc.bearing} of home
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

import type { WikiPlaceholderMetadata } from "~/server/shared/wiki-placeholders";

export type DynamicStatMetadata =
  | WikiPlaceholderMetadata
  | {
      label?: string;
      comparisonRank?: string;
      countryName?: string;
      companyName?: string;
      lastCalculated?: string | number | Date;
      detailsUrl?: string;
      [key: string]: unknown;
    };

export interface DynamicStatData {
  value: string;
  rawVal?: unknown;
  metadata?: DynamicStatMetadata;
}

export function DynamicStatSpan({
  data,
}: {
  placeholderKey: string;
  data?: DynamicStatData | null;
}) {
  if (!data) {
    return <span className="text-xs text-zinc-500">Loading...</span>;
  }

  const metadata = data.metadata;

  return (
    <Popover>
      <PopoverTrigger>
        <span className="wikios-stat-span cursor-pointer border-b border-dotted border-white/40 font-semibold text-zinc-200 transition-all select-none hover:border-white/90 hover:text-white">
          {data.value}
        </span>
      </PopoverTrigger>
      <PopoverContent className="z-[10001] flex w-60 flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-xl">
        <div className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          Simulation Metrics
        </div>

        <div className="flex flex-col text-left">
          <span className="text-xs font-medium text-zinc-400">{metadata?.label || "Value"}</span>
          <span className="mt-0.5 text-xl leading-tight font-bold text-white">{data.value}</span>
          {metadata?.comparisonRank && (
            <span className="mt-1 text-[10px] font-semibold text-blue-400">
              {metadata.comparisonRank}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 border-t border-white/5 pt-2.5 text-[10px] text-zinc-400">
          {metadata?.countryName && (
            <div className="flex justify-between">
              <span>Country</span>
              <span className="font-medium text-zinc-200">{metadata.countryName}</span>
            </div>
          )}
          {metadata?.companyName && (
            <div className="flex justify-between">
              <span>Enterprise</span>
              <span className="font-medium text-zinc-200">{metadata.companyName}</span>
            </div>
          )}
          {metadata?.lastCalculated && (
            <div className="flex justify-between">
              <span>Updated</span>
              <span className="text-zinc-200 tabular-nums">
                {new Date(metadata.lastCalculated).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {metadata?.detailsUrl && (
          <Link
            href={withBasePath(metadata.detailsUrl)}
            className="border-t border-white/5 pt-2 text-center text-[10px] font-bold text-blue-400 transition-colors hover:text-blue-300"
          >
            Analyze Dashboard &rarr;
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}
