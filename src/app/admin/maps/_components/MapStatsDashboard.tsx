"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

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
      <Card className="rounded-row p-6">
        <Eyebrow className="text-label text-body mb-4 block">Layer breakdown</Eyebrow>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {layerInfo?.map((layer) => (
            <div key={layer.type} className="border-separator rounded-control border p-3">
              <div className="text-label-secondary text-caption capitalize">{layer.type}</div>
              <div className="text-label text-title-2 mt-1">
                {layer.featureCount.toLocaleString()}
              </div>
              <div
                className={`text-footnote mt-1 ${layer.available ? "text-green" : "text-label-secondary"}`}
              >
                {layer.available ? "Active" : "Empty"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Linkage overview */}
      <Card className="rounded-row p-6">
        <Eyebrow className="text-label text-body mb-4 block">Country linkage</Eyebrow>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Progress bar */}
          <div>
            <div className="text-body mb-2 flex justify-between">
              <span className="text-label">Political features linked</span>
              <span className="text-label font-medium">
                {stats?.linkedFeatures ?? 0} / {stats?.politicalFeatures ?? 0}
              </span>
            </div>
            <div className="bg-fill-3 h-3 overflow-hidden rounded-full">
              <div
                className="bg-green h-full rounded-full"
                style={{ width: `${stats?.linkageRate ?? 0}%` }}
              />
            </div>
            <div className="text-footnote mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-green font-semibold">{stats?.linkedFeatures ?? 0}</div>
                <div className="text-label-secondary">Linked</div>
              </div>
              <div>
                <div className="text-yellow font-semibold">{stats?.unlinkedFeatures ?? 0}</div>
                <div className="text-label-secondary">Unlinked</div>
              </div>
              <div>
                <div className="text-blue font-semibold">{stats?.totalCountries ?? 0}</div>
                <div className="text-label-secondary">DB Countries</div>
              </div>
            </div>
          </div>

          {/* DB coverage */}
          <div>
            <div className="text-body mb-2 flex justify-between">
              <span className="text-label">Countries with geometry</span>
              <span className="text-label font-medium">
                {stats?.countriesWithGeometry ?? 0} / {stats?.totalCountries ?? 0}
              </span>
            </div>
            <div className="bg-fill-3 h-3 overflow-hidden rounded-full">
              <div
                className="bg-blue h-full rounded-full"
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
      </Card>

      {/* Linked features list */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Linked */}
        <Card className="rounded-row p-6">
          <Eyebrow className="text-body mb-3 block">
            Linked Features ({linkedFeatures.length})
          </Eyebrow>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {linkedFeatures.map((f) => (
              <div
                key={f.featureId}
                className="hover:bg-fill-4 rounded-control-sm text-body flex items-center gap-2 px-2 py-1"
              >
                <div
                  className="rounded-control-sm h-2.5 w-2.5"
                  style={{ backgroundColor: f.fillColor }}
                />
                <span className="text-label">{f.displayName}</span>
                {f.areaSqKm && (
                  <span className="text-label-secondary text-footnote ml-auto">
                    {Math.round(f.areaSqKm).toLocaleString()} km²
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Unlinked */}
        <Card className="rounded-row p-6">
          <Eyebrow className="text-body mb-3 block">
            Unlinked Features ({unlinkedFeatures.length})
          </Eyebrow>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {unlinkedFeatures.map((f) => (
              <div
                key={f.featureId}
                className="hover:bg-fill-4 rounded-control-sm text-body flex items-center gap-2 px-2 py-1"
              >
                <div
                  className="border-separator rounded-control-sm h-2.5 w-2.5 border"
                  style={{ backgroundColor: f.fillColor }}
                />
                <span className="text-label">{f.displayName}</span>
                <span className="text-label-secondary text-footnote ml-auto font-mono">
                  {f.featureId}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
