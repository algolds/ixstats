"use client";

/**
 * World Map Page - Public standalone world map viewer.
 *
 * Full-screen interactive globe/map showing the IxEarth fictional world.
 * Features:
 * - Globe projection at low zoom, flat at high zoom
 * - Country click for info popup
 * - Layer toggles (political, climate, altitude, hydrology, ice)
 * - Deep linking via URL params:
 *   ?country=<countryId>  — auto-select by database ID
 *   ?name=<countryName>   — auto-select by country name (wiki-friendly)
 *   ?lat=X&lng=Y&zoom=Z   — coordinate deep-link
 *   ?layer=climate         — show a specific layer on load
 *   ?embed=true            — chromeless mode for iframe embedding (no nav, no controls)
 *
 * When running on maps.ixwiki.com, renders full-screen (standalone mode).
 */

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MapContainer } from "~/components/maps/core/MapContainer";
import { usePageTitle } from "~/hooks/usePageTitle";
import { isStandaloneClient } from "~/lib/standalone-detection";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type { MapLayerType } from "~/lib/map-config";

const isStandalone = isStandaloneClient();

export const dynamic = "force-dynamic";

export default function WorldMapPage() {
  const searchParams = useSearchParams();

  // --- Embed mode: chromeless for wiki iframe embedding ---
  const isEmbed = searchParams.get("embed") === "true";

  usePageTitle({
    title: isEmbed ? "IxWorld" : isStandalone ? "IxMaps" : "World Map",
  });

  // --- Country resolution: by ID or by name ---
  const countryIdParam = searchParams.get("country") || undefined;
  const countryNameParam = searchParams.get("name") || undefined;

  // If name param provided, resolve to countryId via tRPC
  const { data: resolvedCountry } = api.countries.getByNameWithAtomic.useQuery(
    { name: countryNameParam! },
    { enabled: !!countryNameParam && !countryIdParam }
  );

  const initialCountryId = countryIdParam || resolvedCountry?.id || undefined;

  // --- Coordinate deep-linking ---
  const initialLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : undefined;
  const initialLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : undefined;
  const initialZoom = searchParams.get("zoom") ? parseFloat(searchParams.get("zoom")!) : undefined;
  const initialCenter =
    initialLng !== undefined && initialLat !== undefined && !isNaN(initialLng) && !isNaN(initialLat)
      ? ([initialLng, initialLat] as [number, number])
      : undefined;

  // --- Layer selection via URL ---
  const layerParam = searchParams.get("layer") as MapLayerType | null;
  const initialLayers = layerParam
    ? (["background", "political", layerParam] as MapLayerType[])
    : undefined;

  const [, setSelectedCountry] = useState<SelectedCountry | null>(null);

  const handleCountrySelect = useCallback((country: SelectedCountry | null) => {
    setSelectedCountry(country);
  }, []);

  // In embed mode: hide navigation, controls, use full viewport
  const containerClass = isEmbed ? "h-dvh w-dvw" : "h-dvh";

  return (
    <div className={`relative ${containerClass}`} data-maps-page>
      <MapContainer
        showControls={!isEmbed}
        showTools={!isEmbed}
        showPopup={!isEmbed}
        onCountrySelect={handleCountrySelect}
        initialCountryId={initialCountryId}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        initialLayers={initialLayers}
      />
    </div>
  );
}
