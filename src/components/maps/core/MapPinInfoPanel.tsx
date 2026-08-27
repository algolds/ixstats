"use client";

/**
 * MapPinInfoPanel - Panel showing info at a pinned map location.
 *
 * Shows elevation zone, climate type, country, and subdivision.
 * Uses client-side Turf.js results for instant display, enriched
 * by server-side PostGIS query when it arrives.
 */

import { useMemo } from "react";
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
import { getZoneByColor } from "~/lib/maps/elevation-config";

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
  loading,
}: {
  icon: typeof Mountain;
  label: string;
  value: string | null;
  color?: string | null;
  loading?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="bg-muted mt-0.5 flex h-6 w-6 items-center justify-center rounded-md">
        <Icon className="text-muted-foreground h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {label}
        </div>
        {loading ? (
          <div className="bg-muted mt-0.5 h-4 w-24 animate-pulse rounded" />
        ) : (
          <div className="flex items-center gap-1.5">
            {color && (
              <span
                className="border-border inline-block h-3 w-3 rounded-sm border"
                style={{ backgroundColor: color.slice(0, 7) }}
              />
            )}
            <span className="text-foreground text-sm font-medium">{value ?? "Unknown"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MapPinInfoPanel({
  pinPosition,
  clientResult,
  serverResult,
  isServerLoading,
  onClose,
}: MapPinInfoPanelProps) {
  // Prefer server result, fall back to client result
  const altClient = clientResult?.altitude?.properties;
  const climClient = clientResult?.climate?.properties;
  const polClient = clientResult?.political?.properties;

  // Derive elevation zone from fill color if metadata not available
  const altFill = (altClient?.fill as string) ?? null;
  const derivedZone = useMemo(() => (altFill ? getZoneByColor(altFill) : null), [altFill]);

  const elevZoneName =
    serverResult?.elevation?.zoneName ??
    (altClient?.zoneName as string) ??
    derivedZone?.zoneName ??
    null;
  const elevLabel =
    serverResult?.elevation?.elevationLabel ??
    (altClient?.elevationLabel as string) ??
    (derivedZone ? `${derivedZone.elevationMin}-${derivedZone.elevationMax}m` : null);
  const elevColor = serverResult?.elevation?.color ?? altFill ?? null;

  const climateName =
    serverResult?.climate?.climateName ?? (climClient?.climateName as string) ?? null;
  const climateColor = serverResult?.climate?.color ?? (climClient?.fill as string) ?? null;

  const countryName =
    serverResult?.country?.name ??
    serverResult?.country?.displayName ??
    (polClient?.displayName as string) ??
    (polClient?.featureId as string) ??
    null;

  const subdivisionName = serverResult?.subdivision?.name ?? null;
  const subdivisionType = serverResult?.subdivision?.type ?? null;

  const panelContent = (
    <>
      {/* Header */}
      <div className="border-border/50 flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-500" />
          <span className="text-foreground text-xs font-semibold">Pin Info</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Coordinates */}
      <div className="border-border/50 border-b px-4 py-2">
        <div className="text-muted-foreground font-mono text-xs">
          {formatCoord(pinPosition.lat, "lat")}, {formatCoord(pinPosition.lng, "lng")}
        </div>
      </div>

      {/* Info Rows */}
      <div className="divide-border/30 divide-y px-4">
        <InfoRow
          icon={Mountain}
          label="Elevation"
          value={elevZoneName ? `${elevZoneName}${elevLabel ? ` (${elevLabel})` : ""}` : null}
          color={elevColor}
          loading={isServerLoading && !elevZoneName}
        />
        <InfoRow
          icon={Cloud}
          label="Climate"
          value={climateName}
          color={climateColor}
          loading={isServerLoading && !climateName}
        />
        <InfoRow
          icon={Flag}
          label="Country"
          value={countryName}
          loading={isServerLoading && !countryName}
        />
        {(subdivisionName || isServerLoading) && (
          <InfoRow
            icon={Map}
            label={subdivisionType ?? "Subdivision"}
            value={subdivisionName}
            loading={isServerLoading && !subdivisionName}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 text-center">
        <span className="text-muted-foreground/40 text-[10px]">Tap map to update pin</span>
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
        className="border-border bg-card/95 absolute top-3 right-3 z-20 hidden w-72 rounded-xl border shadow-lg backdrop-blur-sm sm:block"
      >
        {panelContent}
      </div>

      {/* Mobile: bottom sheet */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 sm:hidden"
        style={{ animation: "slideInUp 0.25s ease-out" }}
      >
        <div className="bg-card rounded-t-2xl shadow-xl" style={{ maxHeight: "50vh" }}>
          <div className="flex justify-center pt-2 pb-1">
            <div className="bg-border h-1 w-8 rounded-full" />
          </div>
          {panelContent}
        </div>
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
