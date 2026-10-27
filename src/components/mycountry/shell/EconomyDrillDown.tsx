"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  StatUp as TrendingUp,
  Bank as Landmark,
  Coins,
  Globe as Globe2,
  Suitcase as Briefcase,
  Reports as PieChart,
  ScaleFrameEnlarge as Scale,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { api, type RouterOutputs } from "~/trpc/react";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import {
  economicRelationsOf,
  economyFiguresOf,
  finiteOrNull,
} from "~/lib/economy/country-relations";
import { incomeSharesOf } from "~/lib/economy/income-classes";
import { nationalRevenue, REVENUE_BASIS_NOTE } from "./fiscal/nationalRevenue";
import { Card } from "~/components/ui/card";
import { SheetSection } from "./SheetSection";
import { economyTabFromParam, type EconomyTab } from "~/lib/mycountry/routes";

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

const FiscalPolicyConsole = dynamic(
  () =>
    import("./FiscalPolicyConsole").then((m) => ({
      default: m.FiscalPolicyConsole,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="rounded-card h-64" />,
  }
);

const TradeCommerceConsole = dynamic(
  () =>
    import("./TradeCommerceConsole").then((m) => ({
      default: m.TradeCommerceConsole,
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

/** A captioned figure: label, value, optional footnote. */
function StatTile({
  label,
  value,
  note,
  className,
  roomy,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  className?: string;
  /** Larger card padding for the headline figures. */
  roomy?: boolean;
}) {
  return (
    <Card className={cn(roomy ? "rounded-card p-4" : "rounded-row p-2", className)}>
      <span className="text-label-secondary text-footnote block">{label}</span>
      <p className={cn("text-label text-title-3 tabular-nums", roomy ? "mt-1" : "mt-0.5")}>
        {value}
      </p>
      {note && <p className="text-label-secondary text-footnote mt-0.5">{note}</p>}
    </Card>
  );
}

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

type Country = ReturnType<typeof useCountryData>["country"];
type Dashboard = RouterOutputs["mycountry"]["getCountryDashboard"];

// Short labels so all four fit a phone-width bar without truncating.
const TABS: Array<{ id: EconomyTab; label: string; icon: typeof TrendingUp }> = [
  { id: "report", label: "Report", icon: TrendingUp },
  { id: "budget", label: "Budget", icon: Landmark },
  { id: "taxes", label: "Taxes", icon: Coins },
  { id: "trade", label: "Trade", icon: Globe2 },
];

/** Whole dollars as billions, e.g. "$1.25B"; "—" when missing or zero. */
const billions = (amount: number | null | undefined, suffix = "") =>
  amount ? `$${(amount / 1e9).toFixed(2)}B${suffix}` : "—";

const outOf100 = (score: number | null | undefined) => (score != null ? `${score}/100` : "—");

function MacroTab({
  country,
  countryId,
  dashboard,
  onDeclare,
}: {
  country: Country;
  countryId: string;
  dashboard: Dashboard | undefined;
  onDeclare?: (goal: string) => void;
}) {
  // Economy relation rows ride along on the country record (getByIdWithEconomicData).
  const {
    economicProfile: profile,
    laborMarket: labor,
    incomeDistribution: income,
  } = economicRelationsOf(country);
  const figures = economyFiguresOf(country);
  const sectors = parseSectorBreakdown(profile?.sectorBreakdown);
  const complexity = finiteOrNull(profile?.economicComplexity);
  const growth = figures.gdpGrowth;
  const medianWage = finiteOrNull(labor?.medianWage);
  const shares = incomeSharesOf(income?.economicClasses);
  const mobility = figures.socialMobilityIndex ?? finiteOrNull(income?.intergenerationalMobility);

  const metrics = [
    {
      label: "Total GDP",
      value: billions(figures.currentTotalGdp),
      sub: "Gross Domestic Product",
    },
    {
      label: "GDP growth",
      value: growth != null ? `${(growth * 100).toFixed(2)}%` : "—",
      sub: "Annual real rate",
    },
    {
      label: "Economic vitality",
      value: outOf100(dashboard?.economicVitality),
      sub: "National vitality band",
    },
    {
      label: "Government efficiency",
      value: outOf100(dashboard?.governmentalEfficiency),
      sub: "Administrative capacity",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map(({ label, value, sub }) => (
          <StatTile key={label} label={label} value={value} note={sub} roomy />
        ))}
      </div>

      <SheetSection
        title="Sector output and complexity"
        icon={PieChart}
        accessory={
          <Badge variant="default" className="tabular-nums">
            Complexity {complexity != null ? complexity.toFixed(1) : "—"}
          </Badge>
        }
      >
        {sectors.length === 0 ? (
          <p className="text-label-secondary text-footnote py-2 text-center">
            No sector breakdown is recorded for this nation.
          </p>
        ) : (
          <div className="text-footnote grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sectors.map((sector, idx) => (
              <Card key={`${sector.name}-${idx}`} className="space-y-2 p-2">
                <div className="text-footnote flex justify-between gap-2">
                  <span className="text-label-secondary truncate font-medium capitalize">
                    {sector.name}
                  </span>
                  <span className="text-label font-semibold tabular-nums">
                    {sector.share.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-fill-3 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-tint/70 h-full rounded-full"
                    style={{ width: `${Math.min(sector.share, 100)}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </SheetSection>

      <SheetSection
        title="Labor market and employment"
        icon={Briefcase}
        accessory={
          <Badge variant="default" className="tabular-nums">
            Female participation {pct(finiteOrNull(labor?.femaleParticipationRate))}
          </Badge>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Unemployment"
            value={pct(figures.unemploymentRate)}
            note="Nominal rate"
          />
          <StatTile
            label="Youth unemployment"
            value={pct(finiteOrNull(labor?.youthUnemploymentRate))}
            note="Ages 18-24"
          />
          <StatTile
            label="Median annual wage"
            value={medianWage != null ? `$${Math.round(medianWage).toLocaleString()}` : "—"}
            note="Annual full-time"
          />
          <StatTile
            label="Informal labor"
            value={pct(finiteOrNull(labor?.informalEmploymentRate))}
            note="Unregulated employment"
          />
        </div>
      </SheetSection>

      <SheetSection
        title="Income and wealth equality"
        icon={Scale}
        accessory={
          <Badge variant="default" className="tabular-nums">
            Gini {giniLabel(figures.incomeInequalityGini)}
          </Badge>
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            label="Top 10% wealth share"
            value={pct(shares.top10WealthShare)}
            note="From income classes"
          />
          <StatTile
            label="Middle class share"
            value={pct(shares.middleClassShare)}
            note="Of the population"
          />
          <StatTile
            label="Social mobility"
            value={mobility != null ? `${Math.round(mobility)}/100` : "—"}
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
        accessory={<Badge variant="default">Integrated treasury</Badge>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label="Tax revenue yield"
            value={billions(revenue.total, " / yr")}
            note={revenue.basis ? REVENUE_BASIS_NOTE[revenue.basis] : "No tax rates set yet"}
          />
          <StatTile
            label="Trade tariff revenue"
            value={billions(tariffRevenue, " / yr")}
            note={
              efficiency == null
                ? "Import tariff yield, before collection losses"
                : "Import tariff yield after collection"
            }
          />
          <StatTile
            label="Tax system efficiency"
            value={pct(efficiency != null ? efficiency * 100 : null, 0)}
            note="Collection efficiency"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </SheetSection>

      <BudgetManagementDashboard countryId={countryId} revenue={revenue} />
    </div>
  );
}

interface EconomyDrillDownProps {
  countryId: string;
  /** Opens the Directive composer with a goal (the infrastructure card's rehabilitation). */
  onDeclare?: (goal: string) => void;
}

/** Economy drill-down: report, budget, taxes and trade tabs. Shared between the drill sheet and the full-page economy surface. */
function EconomyDrillDownComponent({
  countryId,
  onDeclare,
}: EconomyDrillDownProps): React.JSX.Element {
  // `?tab=` opens a console directly (the First steps links, old ids too); the bar takes over.
  const tabParam = useSearchParams()?.get("tab");
  const [activeTab, setActiveTab] = useState<EconomyTab>(
    () => economyTabFromParam(tabParam) ?? "report"
  );
  const { country } = useCountryData();
  const { data: dashboard } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  return (
    <div className="space-y-4">
      <SectionTabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === "report" && (
        <MacroTab
          country={country}
          countryId={countryId}
          dashboard={dashboard}
          onDeclare={onDeclare}
        />
      )}
      {activeTab === "budget" && <FiscalTab country={country} countryId={countryId} />}
      {activeTab === "taxes" && <FiscalPolicyConsole countryId={countryId} />}
      {activeTab === "trade" && <TradeCommerceConsole countryId={countryId} />}
    </div>
  );
}

export const EconomyDrillDown = React.memo(EconomyDrillDownComponent);
