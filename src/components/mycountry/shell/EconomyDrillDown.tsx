"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  StatUp as TrendingUp,
  Bank as Landmark,
  Coins,
  Globe as Globe2,
  SystemRestart as Loader2,
  Suitcase as Briefcase,
  Reports as PieChart,
  ScaleFrameEnlarge as Scale,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import {
  economicRelationsOf,
  finiteOrNull,
  savedTariffRate,
} from "~/lib/economy/country-relations";

const BudgetManagementDashboard = dynamic(
  () =>
    import("~/components/mycountry/domains/government/BudgetManagementDashboard").then((m) => ({
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

const InfrastructureMaintenanceCard = dynamic(
  () =>
    import("~/components/mycountry/domains/government/budget/InfrastructureMaintenanceCard").then(
      (m) => ({
        default: m.InfrastructureMaintenanceCard,
      })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const SECTOR_BAR_COLORS = [
  { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  { text: "text-cyan-600 dark:text-cyan-400", bar: "bg-cyan-500" },
  { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  { text: "text-indigo-600 dark:text-indigo-400", bar: "bg-indigo-500" },
  { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500" },
  { text: "text-teal-600 dark:text-teal-400", bar: "bg-teal-500" },
];

/** Missing data renders as "—", never a stand-in figure. */
function pct(value: number | null, digits = 1): string {
  return value == null ? "—" : `${value.toFixed(digits)}%`;
}

/** Gini on a 0–100 scale (stored as either a 0–1 coefficient or a 0–100 index), with a band. */
function giniLabel(raw: number | null): string {
  if (raw == null) return "—";
  const gini = raw <= 1 ? raw * 100 : raw;
  const band = gini < 30 ? "Low" : gini < 40 ? "Moderate" : gini < 50 ? "High" : "Very high";
  return `${gini.toFixed(1)} (${band})`;
}

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

  // Economy relation rows ride along on the country record (getByIdWithEconomicData).
  const {
    economicProfile: profile,
    laborMarket: labor,
    fiscalSystem: fiscal,
    incomeDistribution: income,
  } = economicRelationsOf(country);

  const gdp = finiteOrNull(country?.currentTotalGdp);
  const sectors = useMemo(
    () => parseSectorBreakdown(profile?.sectorBreakdown),
    [profile?.sectorBreakdown]
  );

  const complexity = finiteOrNull(profile?.economicComplexity);
  const unemployment = finiteOrNull(country?.unemploymentRate);
  const youthUnemployment = finiteOrNull(labor?.youthUnemploymentRate);
  const femaleParticipation = finiteOrNull(labor?.femaleParticipationRate);
  const medianWage = finiteOrNull(labor?.medianWage);
  const informalEmployment = finiteOrNull(labor?.informalEmploymentRate);
  const gini = finiteOrNull(country?.incomeInequalityGini);
  const top10Wealth = finiteOrNull(income?.top10PercentWealth);
  const middleClass = finiteOrNull(income?.middleClassPercent);
  const mobility = finiteOrNull(income?.intergenerationalMobility);
  const taxEfficiency = finiteOrNull(fiscal?.taxEfficiency);

  // Tariff revenue: saved Fiscal Policy tariff rate on recorded imports, net of tax efficiency.
  const tariffRate = savedTariffRate(fiscal?.exciseTaxRates);
  const importsPct = finiteOrNull(profile?.importsGDPPercent);
  const tariffRevenue =
    gdp != null && importsPct != null && tariffRate != null && taxEfficiency != null
      ? gdp * (importsPct / 100) * (tariffRate / 100) * taxEfficiency
      : null;

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
        accent: "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
      },
      {
        label: "GDP Growth",
        value:
          country?.realGdpGrowthRate != null
            ? `${(country.realGdpGrowthRate * 100).toFixed(2)}%`
            : "—",
        sub: "Annual real rate",
        accent: "text-cyan-600 dark:text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
      },
      {
        label: "Economic Vitality",
        value: dashboard?.economicVitality != null ? `${dashboard.economicVitality}/100` : "—",
        sub: "National vitality band",
        accent: "text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/5",
      },
      {
        label: "Government Efficiency",
        value:
          dashboard?.governmentalEfficiency != null
            ? `${dashboard.governmentalEfficiency}/100`
            : "—",
        sub: "Administrative capacity",
        accent: "text-indigo-600 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/5",
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
      {/* Sub-tab switcher (shared with the other domain sections) */}
      <SectionTabBar
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        activeClassName="border-emerald-500/40 bg-emerald-500/20 text-emerald-950 dark:text-emerald-300"
      />

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
                <p className="text-muted-foreground/70 text-xs font-semibold tracking-wider uppercase">
                  {label}
                </p>
                <p className="text-foreground mt-1 font-mono text-lg font-bold tracking-tight tabular-nums">
                  {value}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs font-medium">{sub}</p>
              </div>
            ))}
          </div>

          {/* Sector Output Distribution Matrix */}
          <FacetCard depth={1} surface="solid" className="space-y-3 p-4">
            <div className="border-border/20 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-foreground text-xs font-semibold">
                  Sector Output & Complexity Matrix
                </h4>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Complexity Index: {complexity != null ? complexity.toFixed(1) : "—"}
              </span>
            </div>

            {sectors.length === 0 ? (
              <p className="text-muted-foreground py-2 text-center text-xs">
                No sector breakdown recorded. Add one in the Country Editor (Economics step).
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                {sectors.map((sector, idx) => {
                  const color = SECTOR_BAR_COLORS[idx % SECTOR_BAR_COLORS.length]!;
                  return (
                    <div
                      key={`${sector.name}-${idx}`}
                      className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5"
                    >
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground truncate font-semibold capitalize">
                          {sector.name}
                        </span>
                        <span className={cn("font-mono font-bold tabular-nums", color.text)}>
                          {sector.share.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-muted/30 h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className={cn("h-full", color.bar)}
                          style={{ width: `${Math.min(sector.share, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FacetCard>

          {/* Labor Force & Employment Matrix */}
          <FacetCard depth={1} surface="solid" className="space-y-3 p-4">
            <div className="border-border/20 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <h4 className="text-foreground text-xs font-semibold">
                  Labor Market & Employment Dynamics
                </h4>
              </div>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                Female participation: {pct(femaleParticipation)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="border-border/20 bg-muted/15 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Unemployment
                </p>
                <p className="mt-0.5 font-mono text-base font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {pct(unemployment)}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">Nominal Rate</p>
              </div>

              <div className="border-border/20 bg-muted/15 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Youth Unemployment
                </p>
                <p className="mt-0.5 font-mono text-base font-bold text-amber-600 tabular-nums dark:text-amber-400">
                  {pct(youthUnemployment)}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">Ages 18-24</p>
              </div>

              <div className="border-border/20 bg-muted/15 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Median Annual Wage
                </p>
                <p className="mt-0.5 font-mono text-base font-bold text-cyan-600 tabular-nums dark:text-cyan-400">
                  {medianWage != null ? `$${Math.round(medianWage).toLocaleString()}` : "—"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">Annual Full-Time</p>
              </div>

              <div className="border-border/20 bg-muted/15 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Informal Labor
                </p>
                <p className="text-foreground mt-0.5 font-mono text-base font-bold tabular-nums">
                  {pct(informalEmployment)}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">Unregulated Employment</p>
              </div>
            </div>
          </FacetCard>

          {/* Income Inequality & Wealth Distribution */}
          <FacetCard depth={1} surface="solid" className="space-y-3 p-4">
            <div className="border-border/20 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-indigo-500" />
                <h4 className="text-foreground text-xs font-semibold">
                  Income & Wealth Equality Console
                </h4>
              </div>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-500 dark:text-indigo-400">
                Gini Index: {giniLabel(gini)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Top 10% Wealth Share
                </p>
                <p className="font-mono text-base font-bold text-amber-600 tabular-nums dark:text-amber-400">
                  {pct(top10Wealth)}
                </p>
              </div>

              <div className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Middle Class Share
                </p>
                <p className="font-mono text-base font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {pct(middleClass)}
                </p>
              </div>

              <div className="border-border/20 bg-muted/15 space-y-1 rounded-lg border p-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Social Mobility Score
                </p>
                <p className="font-mono text-base font-bold text-cyan-600 tabular-nums dark:text-cyan-400">
                  {mobility != null ? `${Math.round(mobility)}/100` : "—"}
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
            surface="solid"
            className="border-border/30 space-y-3 border p-4 shadow-lg"
          >
            <div className="border-border/20 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-foreground text-xs font-semibold">
                  Revenue Integration & Budget Balance
                </h4>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Integrated Treasury Stream
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div className="border-border/20 bg-muted/15 space-y-1 rounded-xl border p-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Fiscal Tax Revenue Yield
                </p>
                <p className="font-mono text-base font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {country?.governmentRevenueTotal
                    ? `$${(country.governmentRevenueTotal / 1e9).toFixed(2)}B / yr`
                    : "—"}
                </p>
                <p className="text-muted-foreground text-xs font-medium">
                  Sourced from Fiscal Policy tab
                </p>
              </div>

              <div className="border-border/20 bg-muted/15 space-y-1 rounded-xl border p-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Trade Tariff Revenue
                </p>
                <p className="font-mono text-base font-bold text-cyan-600 tabular-nums dark:text-cyan-400">
                  {tariffRevenue != null ? `$${(tariffRevenue / 1e9).toFixed(2)}B / yr` : "—"}
                </p>
                <p className="text-muted-foreground text-xs font-medium">
                  Fiscal Policy tariff rate on recorded imports
                </p>
              </div>

              <div className="border-border/20 bg-muted/15 col-span-2 space-y-1 rounded-xl border p-2.5 sm:col-span-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Tax System Efficiency
                </p>
                <p className="font-mono text-base font-bold text-amber-600 tabular-nums dark:text-amber-400">
                  {taxEfficiency != null ? `${Math.round(taxEfficiency * 100)}%` : "—"}
                </p>
                <p className="text-muted-foreground text-xs font-medium">Collection Efficiency</p>
              </div>
            </div>
          </FacetCard>

          <BudgetManagementDashboard countryId={countryId} />

          <InfrastructureMaintenanceCard countryId={countryId} />
        </div>
      )}

      {activeTab === "monetary" && <FiscalPolicyConsole countryId={countryId} />}

      {activeTab === "trade" && <TradeCommerceConsole countryId={countryId} />}
    </div>
  );
}

export const EconomyDrillDown = React.memo(EconomyDrillDownComponent);
