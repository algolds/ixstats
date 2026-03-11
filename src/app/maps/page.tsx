"use client";

/**
 * World Map Page - Public standalone world map viewer.
 *
 * Full-screen interactive globe/map showing the IxEarth fictional world.
 * Features:
 * - Globe projection at low zoom, flat at high zoom
 * - Country click for info popup
 * - Layer toggles (political, climate, altitude, hydrology, ice)
 * - Deep linking: ?country=<countryId> auto-selects and flies to a country
 *
 * When NEXT_PUBLIC_IXWORLD_STANDALONE=true (maps.ixwiki.com), renders full-screen.
 */

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapContainer } from "~/components/maps/core/MapContainer";
import { usePageTitle } from "~/hooks/usePageTitle";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";

const isStandalone =
  process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true";

export const dynamic = "force-dynamic";

export default function WorldMapPage() {
  usePageTitle({ title: isStandalone ? "IxWorld Map" : "World Map" });
  const searchParams = useSearchParams();
  const initialCountryId = searchParams.get("country") || undefined;

  const [selectedCountry, setSelectedCountry] =
    useState<SelectedCountry | null>(null);

  const handleCountrySelect = useCallback(
    (country: SelectedCountry | null) => {
      setSelectedCountry(country);
    },
    []
  );

  return (
    <div className={`relative ${isStandalone ? "h-dvh" : "h-[calc(100dvh-64px)]"}`}>
      <MapContainer
        showControls={true}
        showPopup={true}
        onCountrySelect={handleCountrySelect}
        initialCountryId={initialCountryId}
      />
    </div>
  );
}
