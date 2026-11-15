"use client";

import { formatCompactCurrency } from "~/lib/utils/format-utils";
import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  StatUp as TrendingUp,
  Bank as Landmark,
  Building,
  Coins,
  Globe as Globe2,
  Suitcase as Briefcase,
  Reports as PieChart,
  ScaleFrameEnlarge as Scale,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import {
  economicRelationsOf,
  economyFiguresOf,
  figureOrEstimate,
  finiteOrNull,
} from "~/lib/economy/country-relations";
import { incomeSharesOf } from "~/lib/economy/income-classes";
import { nationalRevenue, REVENUE_BASIS_NOTE } from "~/lib/economy/national-revenue";
import { SheetSection } from "./SheetSection";
import { TaxesTelemetryView, TradeTelemetryView } from "./EconomyTelemetryTabs";
import { economyTabFromParam, editorHref, type EconomyTab } from "~/lib/mycountry/routes";

const BudgetManagementDashboard = dynamic(
  () =>
    import("~/components/mycountry/domains/government/BudgetManagementDashboard").then((m) => ({
      default: m.BudgetManagementDashboard,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="rounded-card h-64" />,
  }
);

const CorporationsTreasuryConsole = dynamic(
  () =>
    import("./CorporationsTreasuryConsole").then((m) => ({
      default: m.CorporationsTreasuryConsole,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="rounded-card h-64" />,
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
    loading: () => <Skeleton className="rounded-card h-64" />,
  }
);

/** The note on a figure the nation never recorded, shown as its estimate (owner decision 2026-10-28). */
const ESTIMATE_NOTE = "Estimated from your economy";

/** Missing data renders as a plain reason in secondary ink, never a stand-in figure, bare dash, or loud tinted headline. */
function unrecorded(reason = "Not recorded"): React.ReactNode {
  return <span className="text-label-secondary text-callout font-normal">{reason}</span>;
}

function pct(value: number | null, digits = 1): React.ReactNode {
  return value == null ? unrecorded() : `${value.toFixed(digits)}%`;
}

function pctNote(value: number | null, digits = 1): string {
  return value == null ? "not recorded" : `${value.toFixed(digits)}%`;
}

/** Gini on a 0–100 scale (stored as either a 0–1 coefficient or a 0–100 index), with a band. */
function giniLabel(raw: number | null): string {
  if (raw == null) return "not recorded";
  const gini = raw <= 1 ? raw * 100 : raw;
  const band = gini < 30 ? "Low" : gini < 40 ? "Moderate" : gini < 50 ? "High" : "Very high";
  return `${gini.toFixed(1)} (${band})`;
}

type Country = ReturnType<typeof useCountryData>["country"];

// Short labels so all five fit a phone-width bar without truncating.
const TABS: Array<{ id: EconomyTab; label: string; icon: typeof TrendingUp }> = [
  { id: "report", label: "Report", icon: TrendingUp },
  { id: "budget", label: "Budget", icon: Landmark },
  { id: "taxes", label: "Taxes", icon: Coins },
  { id: "trade", label: "Trade", icon: Globe2 },
  { id: "corporations", label: "Corporations", icon: Building },
];

/** Whole dollars in compact notation, e.g. "$1.3B", "$44.5T"; plain reason when missing or zero. */
const billions = (
  amount: number | null | undefined,
  suffix = "",
  empty = "Not recorded"
): React.ReactNode => (amount ? `${formatCompactCurrency(amount)}${suffix}` : unrecorded(empty));

function MacroTab({
  country,
  countryId,
  onDeclare,
}: {
  country: Country;
  countryId: string;
  onDeclare?: (goal: string) => void;
}) {
  // Economy relation rows ride along on the country record (getByIdWithEconomicData).
  const {
    economicProfile: profile,
    laborMarket: labor,
    incomeDistribution: income,
  } = economicRelationsOf(country);
  const figures = economyFiguresOf(country);
  const unemployment = figureOrEstimate(country, "unemploymentRate", figures.unemploymentRate);
  const inflation = figureOrEstimate(country, "inflationRate", figures.inflationRate);
  const debt = figureOrEstimate(country, "totalDebtGDPRatio", figures.totalDebtGDPRatio);
  const sectors = parseSectorBreakdown(profile?.sectorBreakdown);
  const complexity = finiteOrNull(profile?.economicComplexity);
  const growth = figures.gdpGrowth;
  const exportsPct = finiteOrNull(profile?.exportsGDPPercent);
  const importsPct = finiteOrNull(profile?.importsGDPPercent);
  const medianWage = finiteOrNull(labor?.medianWage);
  const shares = incomeSharesOf(income?.economicClasses);
  const mobility = figures.socialMobilityIndex ?? finiteOrNull(income?.intergenerationalMobility);

  const metrics: Array<{ label: string; value: React.ReactNode; note?: string }> = [
    {
      label: "Total GDP",
      value: billions(figures.currentTotalGdp),
    },
    {
      label: "GDP growth",
      value: growth != null ? `${(growth * 100).toFixed(2)}%` : unrecorded(),
    },
    {
      label: "Exports",
      value: pct(exportsPct),
      note: exportsPct != null ? "Share of GDP" : "No trade recorded yet",
    },
    {
      label: "Imports",
      value: pct(importsPct),
      note: importsPct != null ? "Share of GDP" : "No trade recorded yet",
    },
  ];

  return (
    <div className="space-y-4">
      <Card content="data" padding="md">
        <div className="sm:divide-separator/60 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-0 sm:divide-x">
          {metrics.map(({ label, value, note }) => (
            <Stat
              key={label}
              size="sm"
              label={label}
              value={value}
              hint={note}
              className="sm:px-4 first:sm:pl-0 last:sm:pr-0"
            />
          ))}
        </div>
      </Card>

      <SheetSection
        title="Sector output and complexity"
        icon={PieChart}
        accessory={
          <span className="text-label-secondary text-footnote tabular-nums">
            Complexity {complexity != null ? complexity.toFixed(1) : "not recorded"}
          </span>
        }
      >
        {sectors.length === 0 ? (
          <EmptyState
            compact
            icon={<PieChart />}
            title="No sector breakdown is recorded for this nation."
            message="Declare an economic Directive to diversify or record output across sectors."
            action={
              onDeclare ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeclare("Develop and diversify national economic sectors")}
                >
                  Declare Directive
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="text-footnote grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((sector, idx) => (
              <div key={`${sector.name}-${idx}`} className="space-y-1.5">
                <div className="text-footnote flex justify-between gap-2">
                  <span className="text-label-secondary truncate font-medium capitalize">
                    {sector.name}
                  </span>
                  <span className="text-label font-semibold tabular-nums">
                    {sector.share.toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={Math.min(sector.share, 100)}
                  aria-hidden
                  className="bg-fill-3 h-1.5"
                />
              </div>
            ))}
          </div>
        )}
      </SheetSection>

      <SheetSection
        title="Labor market and employment"
        icon={Briefcase}
        accessory={
          <span className="text-label-secondary text-footnote tabular-nums">
            Female participation {pctNote(finiteOrNull(labor?.femaleParticipationRate))}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            size="sm"
            label="Unemployment"
            value={pct(unemployment.value)}
            hint={unemployment.estimated ? ESTIMATE_NOTE : undefined}
          />
          <Stat
            size="sm"
            label="Youth unemployment"
            value={pct(finiteOrNull(labor?.youthUnemploymentRate))}
            hint="Ages 18–24"
          />
          <Stat
            size="sm"
            label="Median annual wage"
            value={
              medianWage != null ? `$${Math.round(medianWage).toLocaleString()}` : unrecorded()
            }
          />
          <Stat
            size="sm"
            label="Informal labor"
            value={pct(finiteOrNull(labor?.informalEmploymentRate))}
          />
        </div>
      </SheetSection>

      <SheetSection
        title="Prices and public debt"
        icon={Coins}
        accessory={
          <Button asChild variant="outline" size="sm">
            <Link href={editorHref("scale")}>
              Edit baselines
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Stat
            size="sm"
            label="Inflation"
            value={pct(inflation.value)}
            hint={inflation.estimated ? ESTIMATE_NOTE : undefined}
          />
          <Stat
            size="sm"
            label="Debt to GDP"
            value={pct(debt.value)}
            hint={debt.estimated ? ESTIMATE_NOTE : undefined}
          />
        </div>
      </SheetSection>

      <SheetSection
        title="Income and wealth equality"
        icon={Scale}
        accessory={
          <span className="text-label-secondary text-footnote tabular-nums">
            Gini {giniLabel(figures.incomeInequalityGini)}
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat size="sm" label="Top 10% wealth share" value={pct(shares.top10WealthShare)} />
          <Stat size="sm" label="Middle class share" value={pct(shares.middleClassShare)} />
          <Stat
            size="sm"
            label="Social mobility"
            value={mobility != null ? `${Math.round(mobility)}/100` : unrecorded()}
          />
        </div>
      </SheetSection>

      <InfrastructureMaintenanceCard countryId={countryId} onDeclareDirective={onDeclare} />
    </div>
  );
}

function FiscalTab({ country, countryId }: { country: Country; countryId: string }) {
  // The one revenue figure: saved rates on today's GDP, else the founding estimate.
  const revenue = nationalRevenue(country);
  const tariffRevenue = revenue.yields.byChannel.tariff ?? null;
  const efficiency = revenue.taxEfficiency;

  return (
    <div className="space-y-4">
      <SheetSection
        title="Revenue integration and budget balance"
        icon={Landmark}
        accessory={
          <Button asChild variant="outline" size="sm">
            <Link href={editorHref("budget")}>
              Configure budget
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat
            size="sm"
            label="Tax revenue yield"
            value={billions(revenue.total, " / yr", "No tax rates set")}
            hint={revenue.basis ? REVENUE_BASIS_NOTE[revenue.basis] : "No tax rates set yet"}
          />
          <Stat
            size="sm"
            label="Trade tariff revenue"
            value={billions(tariffRevenue, " / yr", "Not recorded")}
            hint={efficiency == null ? "Before collection losses" : "After collection"}
          />
          <Stat
            size="sm"
            label="Tax system efficiency"
            value={pct(efficiency != null ? efficiency * 100 : null, 0)}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </SheetSection>

      <BudgetManagementDashboard countryId={countryId} revenue={revenue} isReadOnly />
    </div>
  );
}

interface EconomyDrillDownProps {
  countryId: string;
  /** Opens the Directive composer with a goal (the infrastructure card's rehabilitation). */
  onDeclare?: (goal: string) => void;
}

/** Economy drill-down: report, budget, taxes, trade and corporations tabs. Shared between the drill sheet and the full-page economy surface. */
export function EconomyDrillDown({
  countryId,
  onDeclare,
}: EconomyDrillDownProps): React.JSX.Element {
  // `?tab=` opens a console directly (the First steps links, old ids too); the bar takes over.
  const tabParam = useSearchParams()?.get("tab");
  const [activeTab, setActiveTab] = useState<EconomyTab>(
    () => economyTabFromParam(tabParam) ?? "report"
  );
  const [syncedTabParam, setSyncedTabParam] = useState(tabParam);
  if (tabParam !== syncedTabParam) {
    setSyncedTabParam(tabParam);
    const next = economyTabFromParam(tabParam);
    if (next) setActiveTab(next);
  }
  const { country } = useCountryData();

  return (
    <div className="space-y-4">
      <SectionTabBar
        aria-label="Economy sections"
        tabs={TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === "report" && (
        <MacroTab country={country} countryId={countryId} onDeclare={onDeclare} />
      )}
      {activeTab === "budget" && <FiscalTab country={country} countryId={countryId} />}
      {activeTab === "taxes" && <TaxesTelemetryView />}
      {activeTab === "trade" && <TradeTelemetryView countryId={countryId} />}
      {activeTab === "corporations" && (
        <CorporationsTreasuryConsole countryId={countryId} countryName={country?.name} />
      )}
    </div>
  );
}
