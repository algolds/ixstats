"use client";

import React, { Suspense, lazy } from "react";
import { MapPin, Loader2 } from "lucide-react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";

const MapContainer = lazy(() =>
  import("~/components/maps/core/MapContainer").then((m) => ({ default: m.MapContainer }))
);

interface GeographyMapProps {
  countryId: string;
  height?: string;
  className?: string;
  onCountryClick?: (countryId: string | null) => void;
}

/**
 * GeographyMap — P-E Tier-0 embed for the MyCountry Geography section.
 *
 * Wraps the canonical `MapContainer` (the same component that powers
 * `/maps` and the world editor) so the Geography section shares the
 * authoritative rendering surface with the rest of the app. Click events
 * bubble up via `onCountryClick` so the parent can route them to the
 * appropriate editor.
 *
 * Lazy-loaded because MapContainer pulls in MapLibre + the full geometry
 * pipeline; this keeps the rest of the Geography section cheap to mount.
 */
export const GeographyMap = React.memo(function GeographyMap({
  countryId,
  height = "h-80",
  className = "",
  onCountryClick,
}: GeographyMapProps) {
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
          onCountrySelect={(c: SelectedCountry | null) => {
            onCountryClick?.(c?.countryId ?? null);
          }}
          showControls={true}
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
