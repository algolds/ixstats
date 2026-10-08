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
 *   ?layers=political,POIs — comma-separated initial layers
 *   ?embed=true            — chromeless mode for iframe embedding (no nav, no controls)
 *   ?controls=true         — force-show zoom/layer controls even in embed mode
 *   ?realm=<slug>          — show that realm's map (default: the viewer's active nation's realm, else IxWorld)
 *
 * When running on maps.ixwiki.com, renders full-screen (standalone mode).
 */

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MapContainer } from "~/components/maps/core/MapContainer";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { isStandaloneClient } from "~/lib/system/standalone-detection";
import type { MapLayerType } from "~/lib/maps/map-config";

const isStandalone = isStandaloneClient();

export const dynamic = "force-dynamic";

export default function WorldMapPage() {
  const searchParams = useSearchParams();

  const isEmbed = searchParams.get("embed") === "true";

  usePageTitle({
    title: isEmbed ? "World Map" : isStandalone ? "IxMaps" : "World Map",
  });

  const countryIdParam = searchParams.get("country") || undefined;
  const countryNameParam = searchParams.get("name") || undefined;

  // If name param provided, resolve to countryId via tRPC
  const { data: resolvedCountry } = api.countries.getByNameWithAtomic.useQuery(
    { name: countryNameParam! },
    { enabled: !!countryNameParam && !countryIdParam }
  );

  const initialCountryId = countryIdParam || resolvedCountry?.id || undefined;

  // Memoised so the map container (and its memoised map) doesn't see a new array every render.
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const zoomParam = searchParams.get("zoom");
  const initialZoom = zoomParam ? parseFloat(zoomParam) : undefined;
  const initialCenter = useMemo(() => {
    const lat = latParam ? parseFloat(latParam) : NaN;
    const lng = lngParam ? parseFloat(lngParam) : NaN;
    return !isNaN(lng) && !isNaN(lat) ? ([lng, lat] as [number, number]) : undefined;
  }, [latParam, lngParam]);

  const layerParam = searchParams.get("layer") as MapLayerType | null;
  const layersParam = searchParams.get("layers");
  const initialLayers = useMemo(
    () =>
      layersParam
        ? (["background", ...layersParam.split(",").filter(Boolean)] as MapLayerType[])
        : layerParam
          ? (["background", "political", layerParam] as MapLayerType[])
          : undefined,
    [layersParam, layerParam]
  );

  const embedControls = searchParams.get("controls") === "true";

  const realm = searchParams.get("realm") || undefined;

  // In embed mode: hide navigation, controls, use full viewport
  const containerClass = isEmbed ? "h-dvh w-dvw" : "h-dvh";

  return (
    <div className={`relative ${containerClass}`} data-maps-page>
      <MapContainer
        showControls={embedControls || !isEmbed}
        showTools={!isEmbed}
        showPopup={!isEmbed}
        showLoading={!isEmbed}
        initialCountryId={initialCountryId}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        initialLayers={initialLayers}
        realm={realm}
      />
    </div>
  );
}
