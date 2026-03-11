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
  const { data: stats, isLoading: statsLoading } =
    api.geo.getMapStats.useQuery();
  const { data: layerInfo, isLoading: layerLoading } =
    api.geo.getLayerInfo.useQuery();
  const { data: features } = api.geo.listCountries.useQuery();

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
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase text-foreground/80">
          Layer Breakdown
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {layerInfo?.map((layer) => (
            <div
              key={layer.type}
              className="rounded-lg border border-border/50 p-3"
            >
              <div className="text-xs font-medium capitalize text-muted-foreground">
                {layer.type}
              </div>
              <div className="mt-1 text-xl font-bold text-foreground">
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
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase text-foreground/80">
          Country Linkage
        </h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Progress bar */}
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-foreground/80">
                Political features linked
              </span>
              <span className="font-medium text-foreground">
                {stats?.linkedFeatures ?? 0} / {stats?.politicalFeatures ?? 0}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                style={{ width: `${stats?.linkageRate ?? 0}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-bold text-emerald-600">
                  {stats?.linkedFeatures ?? 0}
                </div>
                <div className="text-muted-foreground">Linked</div>
              </div>
              <div>
                <div className="font-bold text-amber-600">
                  {stats?.unlinkedFeatures ?? 0}
                </div>
                <div className="text-muted-foreground">Unlinked</div>
              </div>
              <div>
                <div className="font-bold text-blue-600">
                  {stats?.totalCountries ?? 0}
                </div>
                <div className="text-muted-foreground">DB Countries</div>
              </div>
            </div>
          </div>

          {/* DB coverage */}
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-foreground/80">
                Countries with geometry
              </span>
              <span className="font-medium text-foreground">
                {stats?.countriesWithGeometry ?? 0} / {stats?.totalCountries ?? 0}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all"
                style={{
                  width: `${
                    stats && stats.totalCountries > 0
                      ? Math.round(
                          (stats.countriesWithGeometry / stats.totalCountries) *
                            100
                        )
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
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase text-emerald-600 dark:text-emerald-400">
            Linked Features ({linkedFeatures.length})
          </h3>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {linkedFeatures.map((f) => (
              <div
                key={f.featureId}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
              >
                <div
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: f.fillColor }}
                />
                <span className="text-foreground">
                  {f.displayName}
                </span>
                {f.areaSqKm && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {Math.round(f.areaSqKm).toLocaleString()} km²
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Unlinked */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase text-amber-600 dark:text-amber-400">
            Unlinked Features ({unlinkedFeatures.length})
          </h3>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {unlinkedFeatures.map((f) => (
              <div
                key={f.featureId}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
              >
                <div
                  className="h-2.5 w-2.5 rounded-sm border border-border"
                  style={{ backgroundColor: f.fillColor }}
                />
                <span className="text-foreground">
                  {f.displayName}
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
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
