"use client";

import { useState } from "react";
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
import { useCountryData } from "../primitives";
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

/**
 * Economy drill-down — 5-Pillar IRL-Grade Ministry of Finance & Planning Suite.
 * Shared between the v2 right-side drill sheet and the full-page economy surface.
 */
export function EconomyDrillDown({ countryId }: { countryId: string }) {
  const [activeTab, setActiveTab] = useState<
    "macro" | "fiscal" | "monetary" | "trade"
  >("macro");

  const { country } = useCountryData();
  const { data: dashboard } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: econConfig } = api.economics.getEconomyConfiguration.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const profile = econConfig?.economicProfile;
  const labor = econConfig?.laborMarket;
  const fiscal = econConfig?.fiscalSystem;
  const income = econConfig?.incomeDistribution;

  const gdpBase = country?.currentTotalGdp ?? 100_000_000_000;

  const tabs = [
    { id: "macro" as const, label: "Economic Report", icon: TrendingUp },
    { id: "fiscal" as const, label: "National Budget", icon: Landmark },
    { id: "monetary" as const, label: "Fiscal Policy", icon: Coins },
    { id: "trade" as const, label: "Trade & Commerce", icon: Globe2 },
  ];

  const metrics = [
    {
      label: "GDP (Total)",
      value: country?.currentTotalGdp ? `$${(country.currentTotalGdp / 1e9).toFixed(2)}B` : "—",
      sub: "Gross Domestic Product",
      accent: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
    },
    {
      label: "GDP Growth",
      value: country?.realGdpGrowthRate != null ? `${(country.realGdpGrowthRate * 100).toFixed(2)}%` : "—",
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
      value: dashboard?.governmentalEfficiency != null ? `${dashboard.governmentalEfficiency}/100` : "—",
      sub: "Administrative capacity",
      accent: "text-purple-400 border-purple-500/20 bg-purple-500/5",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Facet Segmented Sub-Tab Switcher — Apple Segmented Control */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-card/60 backdrop-blur-xl border border-border/40 shadow-inner w-full">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition-all duration-200 cursor-pointer active:scale-95 select-none w-full text-center truncate",
              activeTab === id
                ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10"
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
                  "rounded-2xl border p-3.5 backdrop-blur-xl shadow-lg transition-transform duration-200 active:scale-[0.98]",
                  accent
                )}
              >
                <p className="text-muted-foreground/70 text-[10px] font-extrabold tracking-widest uppercase">{label}</p>
                <p className="text-foreground mt-1 text-lg font-black font-mono tracking-tight">{value}</p>
                <p className="text-muted-foreground mt-0.5 text-[10px] font-medium">{sub}</p>
              </div>
            ))}
          </div>

          {/* Sector Output Distribution Matrix */}
          <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-border/20 pb-2">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-foreground">Sector Output & Complexity Matrix</h4>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400 font-mono">
                Complexity Index: {profile?.economicComplexity ?? 74.2}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-semibold">Services</span>
                  <span className="font-extrabold text-emerald-400 font-mono">58%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[58%]" />
                </div>
              </div>

              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-semibold">Industry & Mfg</span>
                  <span className="font-extrabold text-cyan-400 font-mono">32%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full bg-cyan-500 w-[32%]" />
                </div>
              </div>

              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-semibold">Agriculture</span>
                  <span className="font-extrabold text-amber-400 font-mono">10%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full bg-amber-500 w-[10%]" />
                </div>
              </div>
            </div>
          </FacetCard>

          {/* Labor Force & Employment Matrix */}
          <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-border/20 pb-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-foreground">Labor Market & Employment Dynamics</h4>
              </div>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-extrabold text-cyan-400 font-mono">
                Participation: {labor?.femaleParticipationRate ? `${labor.femaleParticipationRate}%` : "67.4%"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Unemployment</p>
                <p className="text-base font-black font-mono text-emerald-400 mt-0.5">3.8%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Nominal Rate</p>
              </div>

              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Youth Unemployment</p>
                <p className="text-base font-black font-mono text-amber-400 mt-0.5">
                  {labor?.youthUnemploymentRate ? `${labor.youthUnemploymentRate}%` : "7.2%"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Ages 18-24</p>
              </div>

              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Median Annual Wage</p>
                <p className="text-base font-black font-mono text-cyan-400 mt-0.5">
                  ${labor?.medianWage ? Math.round(labor.medianWage).toLocaleString() : "42,500"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Annual Full-Time</p>
              </div>

              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Informal Labor</p>
                <p className="text-base font-black font-mono text-purple-400 mt-0.5">
                  {labor?.informalEmploymentRate ? `${labor.informalEmploymentRate}%` : "4.1%"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Unregulated Employment</p>
              </div>
            </div>
          </FacetCard>

          {/* Income Inequality & Wealth Distribution */}
          <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-border/20 pb-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-purple-400" />
                <h4 className="text-xs font-bold text-foreground">Income & Wealth Equality Console</h4>
              </div>
              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-extrabold text-purple-400 font-mono">
                Gini Index: 31.4 (Moderate)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Top 10% Wealth Share</p>
                <p className="text-base font-black font-mono text-amber-400">
                  {income?.top10PercentWealth ? `${income.top10PercentWealth}%` : "42.1%"}
                </p>
              </div>

              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Middle Class Share</p>
                <p className="text-base font-black font-mono text-emerald-400">
                  {income?.middleClassPercent ? `${income.middleClassPercent}%` : "51.3%"}
                </p>
              </div>

              <div className="rounded-lg border border-border/20 bg-muted/15 p-2.5 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Social Mobility Score</p>
                <p className="text-base font-black font-mono text-cyan-400">
                  {income?.intergenerationalMobility ? `${income.intergenerationalMobility}/100` : "68/100"}
                </p>
              </div>
            </div>
          </FacetCard>
        </div>
      )}

      {activeTab === "fiscal" && (
        <div className="space-y-4">
          {/* Revenue Integration Banner */}
          <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-xl border border-border/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-border/20 pb-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-400 shrink-0" />
                <h4 className="text-xs font-extrabold text-foreground">Revenue Integration & Budget Balance</h4>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-400 font-mono">
                Integrated Treasury Stream
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-xl border border-border/20 bg-muted/15 p-2.5 space-y-1">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase">Fiscal Tax Revenue Yield</p>
                <p className="text-base font-black font-mono text-emerald-400">
                  {country?.governmentRevenueTotal
                    ? `$${(country.governmentRevenueTotal / 1e9).toFixed(2)}B / yr`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium">Sourced from Fiscal Policy tab</p>
              </div>

              <div className="rounded-xl border border-border/20 bg-muted/15 p-2.5 space-y-1">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase">Trade Tariff Revenue</p>
                <p className="text-base font-black font-mono text-cyan-400">
                  {(profile?.exportsGDPPercent != null && fiscal?.taxEfficiency != null)
                    ? `$${((gdpBase * (profile.exportsGDPPercent / 100) * 0.05 * fiscal.taxEfficiency) / 1e9).toFixed(2)}B / yr`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium">Sourced from Trade & Commerce tab</p>
              </div>

              <div className="rounded-xl border border-border/20 bg-muted/15 p-2.5 space-y-1 col-span-2 sm:col-span-1">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase">Tax System Efficiency</p>
                <p className="text-base font-black font-mono text-amber-400">
                  {fiscal?.taxEfficiency != null ? `${Math.round(fiscal.taxEfficiency * 100)}%` : "85%"}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium">Collection Efficiency</p>
              </div>
            </div>
          </FacetCard>

          <BudgetManagementDashboard countryId={countryId} />
        </div>
      )}

      {activeTab === "monetary" && (
        <FiscalPolicyConsole countryId={countryId} />
      )}

      {activeTab === "trade" && (
        <TradeCommerceConsole countryId={countryId} />
      )}
    </div>
  );
}
