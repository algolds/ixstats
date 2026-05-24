"use client";

/**
 * MiniWorldMap - Compact map widget for embedding in dashboards/cards.
 *
 * Shows a small interactive globe with political borders.
 * Click opens the full map page.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapContainer } from "~/components/maps/core/MapContainer";
import { createUrl } from "~/lib/url-utils";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";

interface MiniWorldMapProps {
  className?: string;
  height?: string;
}

export function MiniWorldMap({
  className = "",
  height = "h-64",
}: MiniWorldMapProps) {
  const router = useRouter();

  const handleCountrySelect = useCallback(
    (country: SelectedCountry | null) => {
      if (country) {
        router.push(createUrl("/maps"));
      }
    },
    [router]
  );

  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-card shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <h3 className="text-sm font-medium text-foreground">World Map</h3>
        <a
          href={"/maps"}
          className="text-xs text-blue-500 hover:text-blue-600"
        >
          Open full map
        </a>
      </div>

      {/* Map */}
      <div className={height}>
        <MapContainer
          showControls={false}
          showPopup={false}
          onCountrySelect={handleCountrySelect}
          initialLayers={["background", "political", "lakes", "icecaps"]}
        />
      </div>
    </div>
  );
}
