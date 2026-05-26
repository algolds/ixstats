// @ts-nocheck
"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { HealthRing } from "~/components/ui/health-ring";
import { AdminHeader } from "../_components/AdminHeader";
import { usePageTitle } from "~/hooks/usePageTitle";
import {
  Activity,
  BarChart3,
  Heart,
  Shield,
  AlertTriangle,
  CheckCircle,
  GitFork,
} from "lucide-react";

const RING_META = [
  { key: "economicVitality", label: "Economic", color: "#22c55e", icon: BarChart3 },
  { key: "populationWellbeing", label: "Population", color: "#3b82f6", icon: Heart },
  { key: "diplomaticStanding", label: "Diplomatic", color: "#a855f7", icon: Shield },
  { key: "governmentalEfficiency", label: "Government", color: "#f97316", icon: Activity },
] as const;

const ENDPOINTS = {
  activityRings: {
    id: "getActivityRingsData",
    endpoint: "api.countries.getActivityRingsData",
    location: "economy.ts:344",
    formulas: {
      economicVitality: "min(100, (gdpCap/50000*100)*0.7 + clamp(growth*400,-20,20) + 30)",
      populationWellbeing: "((popGrowth>0?70:40) + max(50, 100-density/500)) / 2",
      diplomaticStanding: "clamp(influence+trade+alliance-tensions, 40, 100)",
      governmentalEfficiency: "{tier→score} * 0.8",
    },
    note: "Uses DB field if value > 5, else calculates from IxStatsCalculator",
  },
  dashboard: {
    id: "getCountryDashboard",
    endpoint: "api.mycountry.getCountryDashboard",
    location: "mycountry.ts:66 (calculateVitalityScores)",
    formulas: {
      economicVitality: "clamp(adjGdpGrowth*1000 + gdpCap/2000 + 30, 0, 100)",
      populationWellbeing: "clamp(popGrowth*2000 + tierScore*10 + 25, 0, 100)",
      diplomaticStanding: "clamp(influence+trade+alliance-tensions, 40, 100)",
      governmentalEfficiency: "clamp(60 + eco*0.3 + dip*0.2, 50, 100)",
    },
    note: "Always recalculates from current stats (no DB fallback)",
  },
};

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
    <div className="border-border/60 bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="border-border/40 bg-muted/20 flex items-center gap-3 border-b px-4 py-3">
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
          {([ENDPOINTS.activityRings, ENDPOINTS.dashboard] as const).map((ep) => {
            const data = ep.id === "getActivityRingsData" ? activityData : (dashboardData as any);
            const hasData = !!data;

            return (
              <div
                key={ep.id}
                className={`p-4 ${ep.id === "getActivityRingsData" ? "md:border-border/40 md:border-r" : ""}`}
              >
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[9px] text-blue-600 dark:text-blue-400">
                    {ep.endpoint}
                  </span>
                  <span className="text-muted-foreground text-[9px]">{ep.location}</span>
                </div>

                {!hasData ? (
                  <div className="text-muted-foreground flex items-center gap-1.5 py-4 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    No data
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {RING_META.map((ring) => {
                      const valA = activityData?.[ring.key as keyof typeof activityData] ?? 0;
                      const valD =
                        (dashboardData as any)?.[ring.key as keyof typeof dashboardData] ?? 0;
                      const currentVal = data?.[ring.key as keyof typeof data] ?? 0;
                      const diff =
                        ep.id === "getActivityRingsData" ? null : Math.abs(valA - currentVal);

                      return (
                        <div
                          key={ring.key}
                          className="flex flex-col items-center gap-1 text-center"
                        >
                          <HealthRing
                            value={currentVal}
                            size={48}
                            color={ring.color}
                            label={ring.label}
                          />
                          <span className="text-[10px] font-medium" style={{ color: ring.color }}>
                            {Math.round(currentVal)}%
                          </span>
                          {diff !== null && diff > 0 && (
                            <span className="text-[8px] text-red-500">Δ{diff.toFixed(1)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="border-border/20 mt-2 border-t pt-2">
                  <p className="text-muted-foreground text-[8px] leading-relaxed">{ep.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activityData && dashboardData && (
        <div className="border-border/40 bg-muted/10 border-t px-4 py-2">
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[9px]">
            {RING_META.map((ring) => {
              const valA = activityData[ring.key as keyof typeof activityData] ?? 0;
              const valD = (dashboardData as any)?.[ring.key] ?? 0;
              const diff = Math.abs(valA - valD);
              const match = diff < 1;
              return (
                <span key={ring.key} className="flex items-center gap-1">
                  {match ? (
                    <CheckCircle className="h-2.5 w-2.5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                  )}
                  {ring.label}: {Math.round(valA)}% vs {Math.round(valD)}%
                  {!match && <span className="text-red-500">(Δ{diff.toFixed(1)})</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RingsAuditPage() {
  usePageTitle({ title: "Admin - Rings Audit" });

  const { data: caphiriaSearch } = api.countries.getSelectList.useQuery({
    search: "Caphiria",
    limit: 1,
  });
  const { data: urceaSearch } = api.countries.getSelectList.useQuery({
    search: "Urcea",
    limit: 1,
  });
  const { data: burgundieSearch } = api.countries.getSelectList.useQuery({
    search: "Burgundie",
    limit: 1,
  });
  const { data: faneriaSearch } = api.countries.getSelectList.useQuery({
    search: "Faneria",
    limit: 1,
  });

  const countries = useMemo(() => {
    const result: { id: string; name: string; flagUrl?: string; slug?: string }[] = [];
    const push = (data: typeof caphiriaSearch) => {
      if (data?.[0])
        result.push({
          id: data[0].id,
          name: data[0].name,
          flagUrl: data[0].flagUrl,
          slug: data[0].slug,
        });
    };
    push(caphiriaSearch);
    push(urceaSearch);
    push(burgundieSearch);
    push(faneriaSearch);
    return result;
  }, [caphiriaSearch, urceaSearch, burgundieSearch, faneriaSearch]);

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={GitFork}
        title="Rings Audit"
        description="Compare ring data from conflicting endpoints and components"
      />

      {/* Formula comparison */}
      <div className="border-border/60 bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border/40 bg-muted/20 border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Formula Comparison</h3>
          <p className="text-muted-foreground text-[10px]">
            Two endpoints compute the same 4 ring metrics but use different formulas
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-border/40 bg-muted/10 border-b">
                <th className="px-3 py-2 font-medium">Ring</th>
                <th className="px-3 py-2 font-medium text-blue-600 dark:text-blue-400">
                  getActivityRingsData (economy.ts:344)
                </th>
                <th className="px-3 py-2 font-medium text-amber-600 dark:text-amber-400">
                  calculateVitalityScores (mycountry.ts:66)
                </th>
                <th className="px-3 py-2 font-medium">DB override</th>
              </tr>
            </thead>
            <tbody className="divide-border/20 divide-y">
              {(RING_META as typeof RING_META).map((ring) => (
                <tr key={ring.key} className="hover:bg-muted/5">
                  <td className="flex items-center gap-2 px-3 py-2.5 font-medium">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: ring.color }}
                    />
                    {ring.label}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[9px] text-blue-600/80 dark:text-blue-400/80">
                    {
                      ENDPOINTS.activityRings.formulas[
                        ring.key as keyof typeof ENDPOINTS.activityRings.formulas
                      ]
                    }
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[9px] text-amber-600/80 dark:text-amber-400/80">
                    {
                      ENDPOINTS.dashboard.formulas[
                        ring.key as keyof typeof ENDPOINTS.dashboard.formulas
                      ]
                    }
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 text-[10px]">
                    {ring.key === "diplomaticStanding"
                      ? "Same — identical formula"
                      : "Different — produces different values"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Country comparisons */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Country Comparison</h3>
          <span className="bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5 text-[9px]">
            {countries.length} countries
          </span>
        </div>

        {countries.length === 0 ? (
          <div className="border-border/60 bg-card text-muted-foreground flex items-center justify-center rounded-xl border py-12 text-sm">
            <div className="border-muted-foreground/30 border-t-muted-foreground mr-2 h-5 w-5 animate-spin rounded-full border-2" />
            Searching for countries...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {countries.map((c) => (
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

      {/* Component reference */}
      <div className="border-border/60 bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border/40 bg-muted/20 border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Ring Component Inventory</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-4 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: "HealthRing",
                path: "components/ui/health-ring.tsx",
                usage: "Base SVG primitive — 90% of all rings",
                sizes: "28–200px",
              },
              {
                name: "VitalityRings",
                path: "components/mycountry/primitives/VitalityRings.tsx",
                usage: "Wrapper, 3 variants (sidebar/horizontal/grid)",
                sizes: "44/48/80px",
              },
              {
                name: "VitalityRingsDisplay",
                path: "components/mycountry/primitives/tabs/VitalityRingsDisplay.tsx",
                usage: "Apple Watch-style card, animated",
                sizes: "80/110/140px",
              },
              {
                name: "QuickVitalityRings",
                path: "components/mycountry/primitives/tabs/VitalityRingsDisplay.tsx",
                usage: "Inline flex row, no card wrapper",
                sizes: "60/80px",
              },
              {
                name: "PublicVitalityRings",
                path: "components/countries/PublicVitalityRings.tsx",
                usage: "Public country profile (1 large ring + metrics)",
                sizes: "120px",
              },
              {
                name: "DiplomaticHealthRing",
                path: "components/diplomatic/DiplomaticHealthRing.tsx",
                usage: "Standalone SVG (NOT HealthRing-based)",
                sizes: "80/120/160px",
              },
              {
                name: "ActivityRings",
                path: "app/mycountry/components/ActivityRings.tsx",
                usage: "Standalone SVG (NOT HealthRing-based)",
                sizes: "80/120/160px",
              },
              {
                name: "ExecutiveActivityRings",
                path: "components/ui/executive-activity-rings.tsx",
                usage: "Composes 3 HealthRings",
                sizes: "50/80px",
              },
              {
                name: "BuilderVitalityRings",
                path: "app/builder/components/BuilderVitalityRings.tsx",
                usage: "Nation builder preview, momentum rotation",
                sizes: "50/80px",
              },
            ].map((comp) => (
              <div key={comp.name} className="border-border/30 bg-muted/10 rounded-lg border p-3">
                <div className="text-foreground mb-1 font-semibold">{comp.name}</div>
                <div className="text-muted-foreground mb-1 text-[9px]">{comp.path}</div>
                <div className="mb-1 text-[10px]">{comp.usage}</div>
                <div className="text-muted-foreground text-[9px]">Sizes: {comp.sizes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
