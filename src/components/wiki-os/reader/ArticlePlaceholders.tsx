import React, { useMemo } from "react";
import Link from "next/link";
import { MapPin } from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { withBasePath } from "~/lib/base-path";
import { safeDecodeURI } from "~/lib/wiki-os/transformers/safe-decode";
import { distanceKmLatLng } from "~/lib/maps/geo-math";

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

function calculateDistanceAndBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { distanceKm: number; bearing: string } {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const distanceKm = Math.round(distanceKmLatLng(lat1, lng1, lat2, lng2));

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
  const src = withBasePath(
    `/maps?embed=true&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}`
  );

  return (
    <iframe
      src={src}
      loading="lazy"
      allow="fullscreen"
      title="Map preview"
      className="rounded-control border-separator bg-fill-4 h-32 w-full overflow-hidden border"
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
        <span className="wikios-coords-pill border-separator bg-fill-4 text-caption text-tint hover:border-separator hover:bg-fill-4 inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none">
          <MapPin className="text-tint h-3 w-3" />
          <span>{label}</span>
          <span className="text-footnote tabular-nums opacity-65">
            ({lat.toFixed(2)}, {lng.toFixed(2)})
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-2 p-3">
        <div className="text-footnote flex items-center justify-between">
          <span className="text-label font-semibold">{label}</span>
          <span className="text-footnote text-label-secondary tabular-nums">Zoom {zoom}</span>
        </div>

        <CoordsMiniMap lat={lat} lng={lng} zoom={zoom} />

        <div className="text-caption text-label-secondary flex flex-col gap-0.5">
          <div>
            Latitude: <span className="text-label tabular-nums">{lat.toFixed(4)}</span>
          </div>
          <div>
            Longitude: <span className="text-label tabular-nums">{lng.toFixed(4)}</span>
          </div>
          {calc && (
            <div className="text-tint mt-1 font-semibold">
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
    return <span className="text-footnote text-label-secondary">Loading...</span>;
  }

  const metadata = data.metadata;

  return (
    <Popover>
      <PopoverTrigger>
        <span className="wikios-stat-span border-separator text-label hover:border-separator hover:text-tint cursor-pointer border-b border-dotted font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none">
          {data.value}
        </span>
      </PopoverTrigger>
      <PopoverContent className="flex w-60 flex-col gap-3 p-4">
        <div className="text-subhead text-label-secondary">Simulation metrics</div>

        <div className="flex flex-col text-left">
          <span className="text-caption text-label-secondary">{metadata?.label || "Value"}</span>
          <span className="text-title-2 text-label mt-0.5 tabular-nums">{data.value}</span>
          {metadata?.comparisonRank && (
            <span className="text-caption text-tint mt-1 font-semibold">
              {metadata.comparisonRank}
            </span>
          )}
        </div>

        <div className="border-separator text-footnote text-label-secondary flex flex-col gap-1 border-t pt-3">
          {metadata?.countryName && (
            <div className="flex justify-between">
              <span>Country</span>
              <span className="text-label font-medium">{metadata.countryName}</span>
            </div>
          )}
          {metadata?.companyName && (
            <div className="flex justify-between">
              <span>Enterprise</span>
              <span className="text-label font-medium">{metadata.companyName}</span>
            </div>
          )}
          {metadata?.lastCalculated && (
            <div className="flex justify-between">
              <span>Updated</span>
              <span className="text-label tabular-nums">
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
            className="border-separator text-caption text-tint hover:text-tint border-t pt-2 text-center font-semibold transition-colors"
          >
            Analyze Dashboard &rarr;
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}
