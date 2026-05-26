"use client";

/**
 * MapStatsDashboard - Map coverage metrics and statistics.
 *
 * Shows layer-by-layer feature counts, linkage breakdown,
 * and a list of unlinked political features.
 */

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
      <div className="border-border bg-card rounded-xl border p-6">
        <h3 className="text-foreground/80 mb-4 text-sm font-semibold uppercase">Layer Breakdown</h3>
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
      </div>

      {/* Linkage overview */}
      <div className="border-border bg-card rounded-xl border p-6">
        <h3 className="text-foreground/80 mb-4 text-sm font-semibold uppercase">Country Linkage</h3>
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
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
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
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all"
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
      </div>

      {/* Linked features list */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Linked */}
        <div className="border-border bg-card rounded-xl border p-6">
          <h3 className="mb-3 text-sm font-semibold text-emerald-600 uppercase dark:text-emerald-400">
            Linked Features ({linkedFeatures.length})
          </h3>
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
        </div>

        {/* Unlinked */}
        <div className="border-border bg-card rounded-xl border p-6">
          <h3 className="mb-3 text-sm font-semibold text-amber-600 uppercase dark:text-amber-400">
            Unlinked Features ({unlinkedFeatures.length})
          </h3>
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
        </div>
      </div>
    </div>
  );
}
