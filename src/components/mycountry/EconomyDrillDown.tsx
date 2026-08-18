import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  TrendingUp,
  Landmark,
  Coins,
  Globe2,
  Loader2,
  Briefcase,
  PieChart,
  Scale,
} from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { useCountryData } from "./primitives";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const BudgetManagementDashboard = dynamic(
  () =>
    import("~/components/government/BudgetManagementDashboard").then((m) => ({
      default: m.BudgetManagementDashboard,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const FiscalPolicyConsole = dynamic(
  () =>
    import("./FiscalPolicyConsole").then((m) => ({
      default: m.FiscalPolicyConsole,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const TradeCommerceConsole = dynamic(
  () =>
    import("./TradeCommerceConsole").then((m) => ({
      default: m.TradeCommerceConsole,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

export interface EconomyDrillDownProps {
  countryId: string;
}

/**
 * Economy drill-down — 5-Pillar IRL-Grade Ministry of Finance & Planning Suite.
 * Shared between the v2 right-side drill sheet and the full-page economy surface.
 */
function EconomyDrillDownComponent({ countryId }: EconomyDrillDownProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<"macro" | "fiscal" | "monetary" | "trade">("macro");

  const { country } = useCountryData();
  const { data: dashboard } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: econConfig } = api.economics.getEconomyConfiguration.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const profile = (econConfig as any)?.economicProfile;
  const labor = (econConfig as any)?.laborMarket;
  const fiscal = (econConfig as any)?.fiscalSystem;
  const income = (econConfig as any)?.incomeDistribution;

  const gdpBase = country?.currentTotalGdp ?? 100_000_000_000;

  const tabs = useMemo(
    () => [
      { id: "macro" as const, label: "Economic Report", icon: TrendingUp },
      { id: "fiscal" as const, label: "National Budget", icon: Landmark },
      { id: "monetary" as const, label: "Fiscal Policy", icon: Coins },
      { id: "trade" as const, label: "Trade & Commerce", icon: Globe2 },
    ],
    []
  );

  const metrics = useMemo(
    () => [
      {
        label: "GDP (Total)",
        value: country?.currentTotalGdp ? `$${(country.currentTotalGdp / 1e9).toFixed(2)}B` : "—",
        sub: "Gross Domestic Product",
        accent: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
      },
      {
        label: "GDP Growth",
        value:
          country?.realGdpGrowthRate != null
            ? `${(country.realGdpGrowthRate * 100).toFixed(2)}%`
            : "—",
        sub: "Annual real rate",
        accent: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
      },
      {
        label: "Economic Vitality",
        value: dashboard?.economicVitality != null ? `${dashboard.economicVitality}/100` : "—",
        sub: "National vitality band",
        accent: "text-amber-400 border-amber-500/20 bg-amber-500/5",
      },
      {
        label: "Government Efficiency",
        value:
          dashboard?.governmentalEfficiency != null
            ? `${dashboard.governmentalEfficiency}/100`
            : "—",
        sub: "Administrative capacity",
        accent: "text-purple-400 border-purple-500/20 bg-purple-500/5",
      },
    ],
    [
      country?.currentTotalGdp,
      country?.realGdpGrowthRate,
      dashboard?.economicVitality,
      dashboard?.governmentalEfficiency,
    ]
  );

  return (
    <div className="space-y-4">
      {/* Facet Segmented Sub-Tab Switcher — Apple Segmented Control */}
      <div className="bg-card/60 border-border/40 grid w-full grid-cols-2 gap-1.5 rounded-2xl border p-1.5 shadow-inner backdrop-blur-xl sm:grid-cols-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex w-full cursor-pointer items-center justify-center gap-2 truncate rounded-xl px-3 py-2 text-center text-xs font-extrabold transition-all duration-200 select-none active:scale-95",
              activeTab === id
                ? "border border-emerald-500/40 bg-gradient-to-r from-emerald-500/25 to-teal-500/20 text-emerald-400 shadow-sm shadow-emerald-500/10"
                : "text-muted-foreground hover:bg-muted/20 hover:text-foreground border border-transparent"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {activeTab === "macro" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map(({ label, value, sub, accent }) => (
              <div
                key={label}
                className={cn(
                  "rounded-2xl border p-3.5 shadow-lg backdrop-blur-xl transition-transform duration-200 active:scale-[0.98]",
                  accent
                )}
              >
                <p className="text-muted-foreground/70 text-[10px] font-semibold tracking-wider uppercase">
                  {label}
                </p>
                <p className="text-foreground mt-1 font-mono text-lg font-bold tracking-tight tabular-nums">
                  {value}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[10px] font-medium">{sub}</p>
              </div>
            ))}
          </div>

          {/* Sector Output Distribution Matrix */}
          <FacetCard depth={1} className="bg-card/30 space-y-3 p-4 backdrop-blur-md">
            <div className="border-border/20 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-400" />
                <h4 className="text-foreground text-xs font-semibold">
                  Sector Output & Complexity Matrix
                </h4>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                Complexity Index: {profile?.economicComplexity ?? 74.2}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-semibold">Services</span>
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">58%</span>
                </div>
                <div className="bg-muted/30 h-1.5 w-full overflow-hidden rounded-full">
                  <div className="h-full w-[58%] bg-emerald-500" />
                </div>
              </div>

              <div className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-semibold">Industry & Mfg</span>
                  <span className="font-mono font-bold text-cyan-400 tabular-nums">32%</span>
                </div>
                <div className="bg-muted/30 h-1.5 w-full overflow-hidden rounded-full">
                  <div className="h-full w-[32%] bg-cyan-500" />
                </div>
              </div>

              <div className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-semibold">Agriculture</span>
                  <span className="font-mono font-bold text-amber-400 tabular-nums">10%</span>
                </div>
                <div className="bg-muted/30 h-1.5 w-full overflow-hidden rounded-full">
                  <div className="h-full w-[10%] bg-amber-500" />
                </div>
              </div>
            </div>
          </FacetCard>

          {/* Labor Force & Employment Matrix */}
          <FacetCard depth={1} className="bg-card/30 space-y-3 p-4 backdrop-blur-md">
            <div className="border-border/20 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-cyan-400" />
                <h4 className="text-foreground text-xs font-semibold">
                  Labor Market & Employment Dynamics
                </h4>
              </div>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-400">
                Participation:{" "}
                {labor?.femaleParticipationRate ? `${labor.femaleParticipationRate}%` : "67.4%"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="border-border/20 bg-muted/15 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Unemployment
                </p>
                <p className="mt-0.5 font-mono text-base font-bold text-emerald-400 tabular-nums">
                  3.8%
                </p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">Nominal Rate</p>
              </div>

              <div className="border-border/20 bg-muted/15 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Youth Unemployment
                </p>
                <p className="mt-0.5 font-mono text-base font-bold text-amber-400 tabular-nums">
                  {labor?.youthUnemploymentRate ? `${labor.youthUnemploymentRate}%` : "7.2%"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">Ages 18-24</p>
              </div>

              <div className="border-border/20 bg-muted/15 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Median Annual Wage
                </p>
                <p className="mt-0.5 font-mono text-base font-bold text-cyan-400 tabular-nums">
                  $
                  {(labor as any)?.medianWage
                    ? Math.round((labor as any).medianWage).toLocaleString()
                    : "42,500"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">Annual Full-Time</p>
              </div>

              <div className="border-border/20 bg-muted/15 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Informal Labor
                </p>
                <p className="mt-0.5 font-mono text-base font-bold text-purple-400 tabular-nums">
                  {(labor as any)?.informalEmploymentRate
                    ? `${(labor as any).informalEmploymentRate}%`
                    : "4.1%"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">Unregulated Employment</p>
              </div>
            </div>
          </FacetCard>

          {/* Income Inequality & Wealth Distribution */}
          <FacetCard depth={1} className="bg-card/30 space-y-3 p-4 backdrop-blur-md">
            <div className="border-border/20 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-purple-400" />
                <h4 className="text-foreground text-xs font-semibold">
                  Income & Wealth Equality Console
                </h4>
              </div>
              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-purple-400">
                Gini Index: 31.4 (Moderate)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Top 10% Wealth Share
                </p>
                <p className="font-mono text-base font-bold text-amber-400 tabular-nums">
                  {income?.top10PercentWealth ? `${income.top10PercentWealth}%` : "42.1%"}
                </p>
              </div>

              <div className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Middle Class Share
                </p>
                <p className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                  {income?.middleClassPercent ? `${income.middleClassPercent}%` : "51.3%"}
                </p>
              </div>

              <div className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Social Mobility Score
                </p>
                <p className="font-mono text-base font-bold text-cyan-400 tabular-nums">
                  {income?.intergenerationalMobility
                    ? `${income.intergenerationalMobility}/100`
                    : "68/100"}
                </p>
              </div>
            </div>
          </FacetCard>
        </div>
      )}

      {activeTab === "fiscal" && (
        <div className="space-y-4">
          {/* Revenue Integration Banner */}
          <FacetCard
            depth={1}
            className="bg-card/30 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
          >
            <div className="border-border/20 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 shrink-0 text-emerald-400" />
                <h4 className="text-foreground text-xs font-semibold">
                  Revenue Integration & Budget Balance
                </h4>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                Integrated Treasury Stream
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div className="border-border/20 bg-muted/15 space-y-1 rounded-xl border p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Fiscal Tax Revenue Yield
                </p>
                <p className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                  {country?.governmentRevenueTotal
                    ? `$${(country.governmentRevenueTotal / 1e9).toFixed(2)}B / yr`
                    : "—"}
                </p>
                <p className="text-muted-foreground text-[10px] font-medium">
                  Sourced from Fiscal Policy tab
                </p>
              </div>

              <div className="border-border/20 bg-muted/15 space-y-1 rounded-xl border p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Trade Tariff Revenue
                </p>
                <p className="font-mono text-base font-bold text-cyan-400 tabular-nums">
                  {profile?.exportsGDPPercent != null && fiscal?.taxEfficiency != null
                    ? `$${((gdpBase * (profile.exportsGDPPercent / 100) * 0.05 * fiscal.taxEfficiency) / 1e9).toFixed(2)}B / yr`
                    : "—"}
                </p>
                <p className="text-muted-foreground text-[10px] font-medium">
                  Sourced from Trade & Commerce tab
                </p>
              </div>

              <div className="border-border/20 bg-muted/15 col-span-2 space-y-1 rounded-xl border p-2.5 sm:col-span-1">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Tax System Efficiency
                </p>
                <p className="font-mono text-base font-bold text-amber-400 tabular-nums">
                  {fiscal?.taxEfficiency != null
                    ? `${Math.round(fiscal.taxEfficiency * 100)}%`
                    : "85%"}
                </p>
                <p className="text-muted-foreground text-[10px] font-medium">
                  Collection Efficiency
                </p>
              </div>
            </div>
          </FacetCard>

          <BudgetManagementDashboard countryId={countryId} />
        </div>
      )}

      {activeTab === "monetary" && <FiscalPolicyConsole countryId={countryId} />}

      {activeTab === "trade" && <TradeCommerceConsole countryId={countryId} />}
    </div>
  );
}

export const EconomyDrillDown = React.memo(EconomyDrillDownComponent);
