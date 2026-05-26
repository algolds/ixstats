"use client";

/**
 * WorldMapManager - Admin interactive map view.
 *
 * Shows the full world map with country click-to-inspect.
 * Displays feature details and linked Country info in a side panel.
 */

import { useState, useCallback } from "react";
import { MapContainer } from "~/components/maps/core/MapContainer";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";

export function WorldMapManager() {
  const [selectedFeature, setSelectedFeature] = useState<SelectedCountry | null>(null);

  // Fetch country list for the selected feature lookup
  const { data: featureList } = api.geoCore.listCountries.useQuery();

  const handleSelect = useCallback((country: SelectedCountry | null) => {
    setSelectedFeature(country);
  }, []);

  const selectedInfo = featureList?.find((f) => f.featureId === selectedFeature?.featureId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Map area */}
      <div className="lg:col-span-2">
        <div className="border-border relative h-[500px] overflow-hidden rounded-xl border">
          <MapContainer
            showControls={true}
            showTools={false}
            showPopup={false}
            onCountrySelect={handleSelect}
          />
        </div>
      </div>

      {/* Detail panel */}
      <div className="space-y-4">
        <div className="border-border bg-card rounded-xl border p-4">
          <h3 className="text-foreground text-sm font-semibold">Feature Inspector</h3>

          {selectedFeature ? (
            <div className="mt-3 space-y-3">
              {/* Feature header */}
              <div className="flex items-center gap-2">
                <div
                  className="border-border h-5 w-5 rounded border"
                  style={{ backgroundColor: selectedFeature.fillColor }}
                />
                <span className="text-foreground text-lg font-semibold">
                  {selectedFeature.displayName}
                </span>
              </div>

              {/* Feature details */}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Feature ID</dt>
                  <dd className="text-foreground font-mono">{selectedFeature.featureId}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Centroid</dt>
                  <dd className="text-foreground font-mono">
                    {selectedFeature.centroidLat.toFixed(2)},{" "}
                    {selectedFeature.centroidLng.toFixed(2)}
                  </dd>
                </div>
                {selectedInfo?.areaSqKm && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Area</dt>
                    <dd className="text-foreground">
                      {Math.round(selectedInfo.areaSqKm).toLocaleString()} km²
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    {selectedInfo?.isClaimed ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Claimed
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Unclaimed
                      </span>
                    )}
                  </dd>
                </div>
                {selectedInfo?.countryId && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Country ID</dt>
                    <dd className="text-muted-foreground truncate font-mono text-xs">
                      {selectedInfo.countryId}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <p className="text-muted-foreground mt-3 text-sm">
              Click a country on the map to inspect it
            </p>
          )}
        </div>

        {/* Quick stats */}
        <div className="border-border bg-card rounded-xl border p-4">
          <h3 className="text-foreground text-sm font-semibold">Layer Counts</h3>
          <LayerCountList />
        </div>
      </div>
    </div>
  );
}

function LayerCountList() {
  const { data: layerInfo, isLoading } = api.geoCore.getLayerInfo.useQuery();

  if (isLoading) {
    return <p className="text-muted-foreground mt-2 text-sm">Loading...</p>;
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {layerInfo?.map((layer) => (
        <li key={layer.type} className="flex items-center justify-between text-sm">
          <span className="text-foreground/80 capitalize">{layer.type}</span>
          <span className="text-muted-foreground font-mono">
            {layer.featureCount.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
