"use client";

import { Skeleton } from "~/components/ui/skeleton";
import {
  Xmark as X,
  MapPin,
  ModernTv as Mountain,
  Cloud,
  WhiteFlag as Flag,
  Map,
} from "iconoir-react";
import type { ClientPointQueryResult } from "~/lib/maps/map-point-query";
import type { PinPosition } from "~/hooks/useMapPinInfo";
import { getZoneByColor, isLandBand } from "~/lib/maps/elevation-config";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";

interface PointInfoServerResult {
  coordinates: { lng: number; lat: number };
  elevation: {
    zoneId: string | null;
    zoneName: string | null;
    elevationMin: number | null;
    elevationMax: number | null;
    elevationLabel: string | null;
    color: string | null;
  } | null;
  climate: {
    climateId: string | null;
    climateName: string | null;
    color: string | null;
  } | null;
  country: {
    featureId: string;
    displayName: string;
    countryId: string | null;
    name?: string;
    slug?: string | null;
    flag?: string | null;
  } | null;
  subdivision: {
    id: string;
    name: string;
    type: string | null;
  } | null;
}

interface MapPinInfoPanelProps {
  pinPosition: PinPosition;
  clientResult: ClientPointQueryResult | null;
  serverResult: PointInfoServerResult | null;
  isServerLoading: boolean;
  onClose: () => void;
}

function formatCoord(value: number, type: "lat" | "lng"): string {
  const abs = Math.abs(value);
  const dir = type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${abs.toFixed(4)}${dir}`;
}

function InfoRow({
  icon: Icon,
  label,
  value,
  color,
  serverLoading,
}: {
  icon: typeof Mountain;
  label: string;
  value: string | null;
  color?: string | null;
  /** The server lookup is still pending, so an empty value may yet fill in. */
  serverLoading: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-2">
      <Icon className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <Eyebrow className="block">{label}</Eyebrow>
        {serverLoading && !value ? (
          <Skeleton className="mt-0.5 h-4 w-24 rounded-xs" />
        ) : (
          <div className="flex items-center gap-2">
            {color && (
              <span
                className="border-separator inline-block h-3 w-3 rounded-xs border"
                style={{ backgroundColor: color.slice(0, 7) }}
              />
            )}
            <span className="text-label text-body font-medium">{value ?? "Unknown"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const firstDefined = <T,>(...values: (T | null | undefined)[]): T | null =>
  values.find((v) => v != null) ?? null;

type ClientProps = Record<string, unknown> | null | undefined;
type ServerResult = PointInfoServerResult | null;

/** Server (PostGIS) values win; the instant client-side lookup fills in until they arrive. */
function resolveElevation(server: ServerResult, props: ClientProps) {
  const fill = (props?.fill as string) ?? null;
  // Derive the elevation zone from the fill colour when metadata isn't available (a land-only band has none)
  const zone = fill && !isLandBand(props) ? getZoneByColor(fill) : null;
  return {
    zoneName: firstDefined(server?.elevation?.zoneName, props?.zoneName as string, zone?.zoneName),
    label: firstDefined(
      server?.elevation?.elevationLabel,
      props?.elevationLabel as string,
      zone && `${zone.elevationMin}-${zone.elevationMax}m`
    ),
    color: firstDefined(server?.elevation?.color, fill),
  };
}

function resolveCountryName(server: ServerResult, props: ClientProps) {
  return firstDefined(
    server?.country?.name,
    server?.country?.displayName,
    props?.displayName as string,
    props?.featureId as string
  );
}

function resolveClimate(server: ServerResult, props: ClientProps) {
  return {
    name: firstDefined(server?.climate?.climateName, props?.climateName as string),
    color: firstDefined(server?.climate?.color, props?.fill as string),
  };
}

export default function MapPinInfoPanel({
  pinPosition,
  clientResult,
  serverResult,
  isServerLoading,
  onClose,
}: MapPinInfoPanelProps) {
  const elevation = resolveElevation(serverResult, clientResult?.altitude?.properties);
  const climate = resolveClimate(serverResult, clientResult?.climate?.properties);
  const countryName = resolveCountryName(serverResult, clientResult?.political?.properties);
  const subdivision = serverResult?.subdivision;
  const { zoneName, label } = elevation;

  const rows = [
    {
      icon: Mountain,
      label: "Elevation",
      value: zoneName ? `${zoneName}${label ? ` (${label})` : ""}` : null,
      color: elevation.color,
    },
    { icon: Cloud, label: "Climate", value: climate.name, color: climate.color },
    { icon: Flag, label: "Country", value: countryName },
    ...(subdivision?.name || isServerLoading
      ? [{ icon: Map, label: subdivision?.type ?? "Subdivision", value: subdivision?.name ?? null }]
      : []),
  ];

  const panelContent = (
    <>
      <div className="border-separator flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <MapPin className="text-blue h-4 w-4" aria-hidden />
          <h3 className="text-label text-headline">Pin info</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close pin info"
          className="text-label-secondary h-8 w-8 rounded-full"
        >
          <X aria-hidden />
        </Button>
      </div>

      <div className="border-separator border-b px-4 py-2">
        <div className="text-label-secondary text-footnote font-mono">
          {formatCoord(pinPosition.lat, "lat")}, {formatCoord(pinPosition.lng, "lng")}
        </div>
      </div>

      <div className="divide-separator divide-y px-4">
        {rows.map((row) => (
          <InfoRow key={row.label} serverLoading={isServerLoading} {...row} />
        ))}
      </div>

      <div className="px-4 py-2 text-center">
        <span className="text-label-secondary text-footnote">Tap map to update pin</span>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: top-right card */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 z-20 hidden w-72 sm:block"
      >
        <FacetMaterial layer="chrome" className="rounded-card">
          {panelContent}
        </FacetMaterial>
      </div>

      {/* Mobile: bottom sheet */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 sm:hidden"
        style={{ animation: "slideInUp 0.25s ease-out" }}
      >
        <FacetMaterial layer="chrome" className="rounded-t-card max-h-[50vh] rounded-b-none">
          <div className="flex justify-center pt-2 pb-1">
            <div className="bg-separator h-1 w-8 rounded-full" />
          </div>
          {panelContent}
        </FacetMaterial>
      </div>

      <style jsx>{`
        @keyframes slideInUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
