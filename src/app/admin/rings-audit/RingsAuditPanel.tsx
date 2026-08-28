"use client";
// src/app/admin/rings-audit/RingsAuditPanel.tsx
// Rings Audit and Vitality Calibration Panel

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { HealthRing } from "~/components/ui/health-ring";
import { AdminHeader } from "../_components/AdminHeader";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Activity, StatsReport as BarChart3, Heart, Shield } from "iconoir-react";

const RING_META = [
  { key: "economicVitality", label: "Economic", color: "#22c55e", icon: BarChart3 },
  { key: "populationWellbeing", label: "Population", color: "#3b82f6", icon: Heart },
  { key: "diplomaticStanding", label: "Diplomatic", color: "#a855f7", icon: Shield },
  { key: "governmentalEfficiency", label: "Government", color: "#f97316", icon: Activity },
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
    <div className="border-border/30 bg-card/25 overflow-hidden rounded-2xl border shadow-xs backdrop-blur-md">
      <div className="border-border/20 bg-muted/20 flex items-center gap-3 border-b px-4 py-3">
        {flagUrl && (
          <img src={flagUrl} alt="" className="h-6 w-10 rounded object-cover shadow-sm" />
        )}
        <div>
          <span className="text-foreground font-semibold">{countryName}</span>
          {slug && <span className="text-muted-foreground ml-2 text-[10px]">/ {slug}</span>}
        </div>
        <span className="text-muted-foreground ml-auto font-mono text-[9px]">
          {countryId.slice(0, 8)}...
        </span>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center justify-center p-8 text-sm">
          <div className="border-muted-foreground/30 border-t-muted-foreground mr-2 h-5 w-5 animate-spin rounded-full border-2" />
          Loading ring data...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
          {ENDPOINTS.map((ep) => {
            const data = ep.id === "getActivityRingsData" ? activityData : (dashboardData as any);

            return (
              <div
                key={ep.id}
                className={`p-4 ${ep.id === "getActivityRingsData" ? "md:border-border/40 md:border-r" : ""}`}
              >
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[9px] text-blue-600 dark:text-blue-400">
                    {ep.endpoint}
                  </span>
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
                    <div className="grid grid-cols-1 gap-y-1.5 text-xs">
                      {RING_META.map(({ key, label, color }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-muted-foreground">{label}:</span>
                          <span className="font-mono font-bold">
                            {Math.round(Number(data[key]) || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground p-4 text-xs">No data available</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RingsAuditPanel() {
  usePageTitle({ title: "Admin - Rings Audit" });

  const { data: countriesData, isLoading } = api.countries.getAll.useQuery(
    { limit: 20 },
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
          <div className="text-muted-foreground p-8 text-center text-sm">
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
