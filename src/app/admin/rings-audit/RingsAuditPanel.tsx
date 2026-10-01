"use client";
// src/app/admin/rings-audit/RingsAuditPanel.tsx
// Rings Audit and Vitality Calibration Panel

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import { HealthRing } from "~/components/ui/health-ring";
import { AdminHeader } from "../_components/AdminHeader";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Activity, StatsReport as BarChart3, Heart, Shield } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";

const RING_META = [
  { key: "economicVitality", label: "Economic", color: "var(--color-chart-3)", icon: BarChart3 },
  { key: "populationWellbeing", label: "Population", color: "var(--color-chart-1)", icon: Heart },
  { key: "diplomaticStanding", label: "Diplomatic", color: "var(--color-chart-4)", icon: Shield },
  {
    key: "governmentalEfficiency",
    label: "Government",
    color: "var(--color-chart-2)",
    icon: Activity,
  },
] as const;

const ENDPOINTS = [
  {
    id: "getActivityRingsData",
    endpoint: "api.countries.getActivityRingsData",
    note: "Uses DB field if value > 5, else calculates from IxStatsCalculator",
  },
  {
    id: "getCountryDashboard",
    endpoint: "api.mycountry.getCountryDashboard",
    note: "Always recalculates from current stats (no DB fallback)",
  },
] as const;

function CountryRingsCard({
  countryId,
  countryName,
  flagUrl,
  slug,
}: {
  countryId: string;
  countryName: string;
  flagUrl?: string;
  slug?: string;
}) {
  const { data: activityData, isLoading: loadingA } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: dashboardData, isLoading: loadingD } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const loading = loadingA || loadingD;

  return (
    <FacetCard className="overflow-hidden">
      <div className="border-separator bg-fill-4 flex items-center gap-3 border-b px-4 py-3">
        {flagUrl && (
          <img src={flagUrl} alt="" className="rounded-control-sm h-6 w-10 object-cover" />
        )}
        <div>
          <span className="text-label font-semibold">{countryName}</span>
          {slug && <span className="text-label-secondary text-footnote ml-2">/ {slug}</span>}
        </div>
        <span className="text-label-secondary text-footnote ml-auto font-mono">
          {countryId.slice(0, 8)}...
        </span>
      </div>

      {loading ? (
        <div className="text-label-secondary text-body flex items-center justify-center p-8">
          <div className="border-separator-opaque border-t-separator-opaque mr-2 h-5 w-5 animate-spin rounded-full border-2" />
          Loading ring data...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
          {ENDPOINTS.map((ep) => {
            const data = ep.id === "getActivityRingsData" ? activityData : (dashboardData as any);

            return (
              <div
                key={ep.id}
                className={`p-4 ${ep.id === "getActivityRingsData" ? "md:border-separator md:border-r" : ""}`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="blue" className="font-mono">
                    {ep.endpoint}
                  </Badge>
                </div>

                {data ? (
                  <div className="flex items-center gap-6">
                    <div className="grid grid-cols-2 gap-3">
                      {RING_META.map(({ key, color }) => (
                        <HealthRing
                          key={key}
                          value={Math.round(Number(data[key]) || 0)}
                          size={52}
                          color={color}
                        />
                      ))}
                    </div>
                    <div className="text-footnote grid grid-cols-1 gap-y-2">
                      {RING_META.map(({ key, label, color }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-label-secondary">{label}:</span>
                          <span className="font-mono font-semibold">
                            {Math.round(Number(data[key]) || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-label-secondary text-footnote p-4">No data available</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </FacetCard>
  );
}

export function RingsAuditPanel() {
  usePageTitle({ title: "Admin - Rings Audit" });

  const { data: countriesData, isLoading } = api.countries.getAll.useQuery(
    { limit: 20, realm: ALL_REALMS },
    { refetchOnWindowFocus: false }
  );

  const sampleCountries = useMemo(
    () => countriesData?.countries?.slice(0, 10) ?? [],
    [countriesData]
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Activity}
        title="Vitality Rings Calibration"
        description="Audit ring math convergence across economic, population, diplomatic, and governmental dimensions."
      />

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-label-secondary text-body p-8 text-center">
            Loading sample nations...
          </div>
        ) : (
          <div className="space-y-4">
            {sampleCountries.map((c: any) => (
              <CountryRingsCard
                key={c.id}
                countryId={c.id}
                countryName={c.name}
                flagUrl={c.flagUrl}
                slug={c.slug}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default RingsAuditPanel;
