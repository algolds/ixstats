"use client";

/**
 * MapStatsDashboard - Map coverage metrics and statistics.
 *
 * Shows layer-by-layer feature counts, linkage breakdown,
 * and a list of unlinked political features.
 */

import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";

export function MapStatsDashboard() {
  const { data: stats, isLoading: statsLoading } = api.geoCore.getMapStats.useQuery();
  const { data: layerInfo, isLoading: layerLoading } = api.geoCore.getLayerInfo.useQuery();
  const { data: features } = api.geoCore.listCountries.useQuery();

  const unlinkedFeatures = features?.filter((f) => !f.isClaimed) ?? [];
  const linkedFeatures = features?.filter((f) => f.isClaimed) ?? [];

  if (statsLoading || layerLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Layer breakdown */}
      <FacetCard className="rounded-xl p-6">
        <Eyebrow className="text-foreground/80 mb-4 block text-sm">Layer Breakdown</Eyebrow>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {layerInfo?.map((layer) => (
            <div key={layer.type} className="border-border/50 rounded-lg border p-3">
              <div className="text-muted-foreground text-xs font-medium capitalize">
                {layer.type}
              </div>
              <div className="text-foreground mt-1 text-xl font-bold">
                {layer.featureCount.toLocaleString()}
              </div>
              <div
                className={`mt-1 text-xs ${layer.available ? "text-emerald-500" : "text-muted-foreground"}`}
              >
                {layer.available ? "Active" : "Empty"}
              </div>
            </div>
          ))}
        </div>
      </FacetCard>

      {/* Linkage overview */}
      <FacetCard className="rounded-xl p-6">
        <Eyebrow className="text-foreground/80 mb-4 block text-sm">Country Linkage</Eyebrow>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Progress bar */}
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-foreground/80">Political features linked</span>
              <span className="text-foreground font-medium">
                {stats?.linkedFeatures ?? 0} / {stats?.politicalFeatures ?? 0}
              </span>
            </div>
            <div className="bg-muted h-3 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${stats?.linkageRate ?? 0}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-bold text-emerald-600">{stats?.linkedFeatures ?? 0}</div>
                <div className="text-muted-foreground">Linked</div>
              </div>
              <div>
                <div className="font-bold text-amber-600">{stats?.unlinkedFeatures ?? 0}</div>
                <div className="text-muted-foreground">Unlinked</div>
              </div>
              <div>
                <div className="font-bold text-blue-600">{stats?.totalCountries ?? 0}</div>
                <div className="text-muted-foreground">DB Countries</div>
              </div>
            </div>
          </div>

          {/* DB coverage */}
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-foreground/80">Countries with geometry</span>
              <span className="text-foreground font-medium">
                {stats?.countriesWithGeometry ?? 0} / {stats?.totalCountries ?? 0}
              </span>
            </div>
            <div className="bg-muted h-3 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{
                  width: `${
                    stats && stats.totalCountries > 0
                      ? Math.round((stats.countriesWithGeometry / stats.totalCountries) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </FacetCard>

      {/* Linked features list */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Linked */}
        <FacetCard className="rounded-xl p-6">
          <Eyebrow className="mb-3 block text-sm">
            Linked Features ({linkedFeatures.length})
          </Eyebrow>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {linkedFeatures.map((f) => (
              <div
                key={f.featureId}
                className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1 text-sm"
              >
                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: f.fillColor }} />
                <span className="text-foreground">{f.displayName}</span>
                {f.areaSqKm && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    {Math.round(f.areaSqKm).toLocaleString()} km²
                  </span>
                )}
              </div>
            ))}
          </div>
        </FacetCard>

        {/* Unlinked */}
        <FacetCard className="rounded-xl p-6">
          <Eyebrow className="mb-3 block text-sm">
            Unlinked Features ({unlinkedFeatures.length})
          </Eyebrow>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {unlinkedFeatures.map((f) => (
              <div
                key={f.featureId}
                className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1 text-sm"
              >
                <div
                  className="border-border h-2.5 w-2.5 rounded-sm border"
                  style={{ backgroundColor: f.fillColor }}
                />
                <span className="text-foreground">{f.displayName}</span>
                <span className="text-muted-foreground ml-auto font-mono text-xs">
                  {f.featureId}
                </span>
              </div>
            ))}
          </div>
        </FacetCard>
      </div>
    </div>
  );
}
