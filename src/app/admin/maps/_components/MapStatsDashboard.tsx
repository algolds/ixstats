"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { api, type RouterOutputs } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

type CountryFeature = RouterOutputs["geoCore"]["listCountries"][number];

function ProgressRow({
  label,
  value,
  percent,
  color,
  children,
}: {
  label: string;
  value: string;
  percent: number;
  color: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-body mb-2 flex justify-between">
        <span className="text-label">{label}</span>
        <span className="text-label font-medium">{value}</span>
      </div>
      <div className="bg-fill-3 h-3 overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
      {children}
    </div>
  );
}

/** Scrollable list of country features; `meta` renders the right-aligned detail. */
function FeatureListCard({
  title,
  features,
  swatchClassName,
  meta,
}: {
  title: string;
  features: CountryFeature[];
  swatchClassName?: string;
  meta: (f: CountryFeature) => React.ReactNode;
}) {
  return (
    <Card className="rounded-row p-6">
      <Eyebrow className="text-body mb-3 block">
        {title} ({features.length})
      </Eyebrow>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {features.map((f) => (
          <div
            key={f.featureId}
            className="hover:bg-fill-4 rounded-control-sm text-body flex items-center gap-2 px-2 py-1"
          >
            <div
              className={`rounded-control-sm h-2.5 w-2.5 ${swatchClassName ?? ""}`}
              style={{ backgroundColor: f.fillColor }}
            />
            <span className="text-label">{f.displayName}</span>
            {meta(f)}
          </div>
        ))}
      </div>
    </Card>
  );
}

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

  const {
    linkedFeatures: linkedCount = 0,
    unlinkedFeatures: unlinkedCount = 0,
    totalCountries = 0,
    politicalFeatures = 0,
    countriesWithGeometry = 0,
    linkageRate = 0,
  } = stats ?? {};
  const linkageCounts = [
    { value: linkedCount, label: "Linked", color: "text-green" },
    { value: unlinkedCount, label: "Unlinked", color: "text-yellow" },
    { value: totalCountries, label: "DB Countries", color: "text-blue" },
  ];

  return (
    <div className="space-y-6">
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

      <Card className="rounded-row p-6">
        <Eyebrow className="text-label text-body mb-4 block">Country linkage</Eyebrow>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ProgressRow
            label="Political features linked"
            value={`${linkedCount} / ${politicalFeatures}`}
            percent={linkageRate}
            color="bg-green"
          >
            <div className="text-footnote mt-3 grid grid-cols-3 gap-2 text-center">
              {linkageCounts.map(({ value, label, color }) => (
                <div key={label}>
                  <div className={`${color} font-semibold`}>{value}</div>
                  <div className="text-label-secondary">{label}</div>
                </div>
              ))}
            </div>
          </ProgressRow>
          <ProgressRow
            label="Countries with geometry"
            value={`${countriesWithGeometry} / ${totalCountries}`}
            percent={
              totalCountries > 0 ? Math.round((countriesWithGeometry / totalCountries) * 100) : 0
            }
            color="bg-blue"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FeatureListCard
          title="Linked Features"
          features={linkedFeatures}
          meta={(f) =>
            f.areaSqKm && (
              <span className="text-label-secondary text-footnote ml-auto">
                {Math.round(f.areaSqKm).toLocaleString()} km²
              </span>
            )
          }
        />
        <FeatureListCard
          title="Unlinked Features"
          features={unlinkedFeatures}
          swatchClassName="border-separator border"
          meta={(f) => (
            <span className="text-label-secondary text-footnote ml-auto font-mono">
              {f.featureId}
            </span>
          )}
        />
      </div>
    </div>
  );
}
