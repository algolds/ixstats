"use client";

import React, { Suspense, lazy, useMemo } from "react";
import { MapPin, Loader2 } from "lucide-react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";

const MapContainer = lazy(() =>
  import("~/components/maps/core/MapContainer").then((m) => ({ default: m.MapContainer }))
);

export type BoundingBox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

interface GeographyMapProps {
  countryId: string;
  centroid?: { lng: number; lat: number } | null;
  boundingBox?: BoundingBox | null;
  height?: string;
  className?: string;
  onCountryClick?: (countryId: string | null) => void;
}

/**
 * Convert a geographic bounding box into a MapLibre zoom level
 * (mercator). Picks the smaller dimension (lng or lat span) so the
 * whole country fits within the viewport. Returns a sensible default
 * (4) for missing data.
 */
function bboxToZoom(bbox: BoundingBox | null | undefined, viewportSize = 600): number {
  if (!bbox) return 4;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngSpan = Math.max(1e-6, maxLng - minLng);
  const latSpan = Math.max(1e-6, maxLat - minLat);
  // Mercator: world width in pixels = 256 * 2^zoom.
  // 1 deg lng ≈ 1 at equator (cos compensation for typical country latitudes
  // is small enough to ignore for the initial-view heuristic).
  const zoomLng = Math.log2((viewportSize * 0.7) / (256 * lngSpan / 360));
  const zoomLat = Math.log2((viewportSize * 0.7) / (256 * latSpan / 180));
  const z = Math.min(zoomLng, zoomLat);
  return Math.max(1.5, Math.min(8, Math.round(z * 10) / 10));
}

/**
 * GeographyMap — P-E Tier-0 embed for the MyCountry Geography section.
 *
 * Renders the canonical `MapContainer` (the same component that powers
 * `/maps` and the world editor) so the Geography section shares the
 * authoritative rendering surface with the rest of the app. Click events
 * bubble up via `onCountryClick` so the parent can route them to the
 * appropriate editor.
 *
 * For the MyCountry preview, the map is:
 *   - Forced to mercator (flat projection) for predictable framing
 *   - Initial-centered on the country's centroid
 *   - Initial-zoomed to fit the country's bounding box
 *   - Hidden controls / popups / edit buttons (preview only)
 *
 * Lazy-loaded because MapContainer pulls in MapLibre + the full geometry
 * pipeline; this keeps the rest of the Geography section cheap to mount.
 */
export const GeographyMap = React.memo(function GeographyMap({
  countryId,
  centroid,
  boundingBox,
  height = "h-80",
  className = "",
  onCountryClick,
}: GeographyMapProps) {
  const initialCenter = useMemo<[number, number] | undefined>(() => {
    if (centroid && Number.isFinite(centroid.lng) && Number.isFinite(centroid.lat)) {
      return [centroid.lng, centroid.lat];
    }
    return undefined;
  }, [centroid]);

  const initialZoom = useMemo(() => bboxToZoom(boundingBox), [boundingBox]);

  return (
    <div className={`border-border bg-card/40 relative overflow-hidden rounded-lg border ${height} ${className}`}>
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        }
      >
        <MapContainer
          initialLayers={["background", "altitudes", "rivers", "lakes", "political", "country_labels"]}
          selectedCountryId={countryId}
          initialCountryId={countryId}
          onCountrySelect={(c: SelectedCountry | null) => {
            onCountryClick?.(c?.countryId ?? null);
          }}
          forceFlatProjection={true}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          showControls={false}
          showTools={false}
          showPopup={false}
          hideEditButtons={true}
        />
      </Suspense>
      <div className="border-border bg-card/85 pointer-events-none absolute top-2 right-2 rounded border px-2 py-0.5 text-[9px] backdrop-blur-sm">
        <span className="text-muted-foreground flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5" />
          {countryId.slice(0, 8)}
        </span>
      </div>
    </div>
  );
});
