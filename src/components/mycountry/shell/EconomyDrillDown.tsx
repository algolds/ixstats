"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
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
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { api } from "~/trpc/react";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import {
  economicRelationsOf,
  finiteOrNull,
  savedTariffRate,
} from "~/lib/economy/country-relations";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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

/**
 * A section panel inside the Economy drill-down. It renders both inside the drill sheet and on
 * the full page, so it is always opaque (`surface="solid"`): blur never stacks inside the sheet.
 */
function EconomySection({
  title,
  icon: Icon,
  accessory,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-card">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
          <h3 className="text-label text-headline">{title}</h3>
        </div>
        {accessory}
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}

/** A captioned figure: eyebrow label, value, optional footnote. */
function StatTile({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-row p-2", className)}>
      <Eyebrow className="block">{label}</Eyebrow>
      <p className="text-label text-title-3 mt-0.5 tabular-nums">{value}</p>
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
      },
      {
        label: "GDP Growth",
        value:
          country?.realGdpGrowthRate != null
            ? `${(country.realGdpGrowthRate * 100).toFixed(2)}%`
            : "—",
        sub: "Annual real rate",
      },
      {
        label: "Economic Vitality",
        value: dashboard?.economicVitality != null ? `${dashboard.economicVitality}/100` : "—",
        sub: "National vitality band",
      },
      {
        label: "Government Efficiency",
        value:
          dashboard?.governmentalEfficiency != null
            ? `${dashboard.governmentalEfficiency}/100`
            : "—",
        sub: "Administrative capacity",
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
      <SectionTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "macro" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map(({ label, value, sub }) => (
              <Card key={label} className="rounded-card p-4">
                <Eyebrow className="block">{label}</Eyebrow>
                <p className="text-label text-title-3 mt-1 tabular-nums">{value}</p>
                <p className="text-label-secondary text-footnote mt-0.5">{sub}</p>
              </Card>
            ))}
          </div>

          {/* Sector output distribution */}
          <EconomySection
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
                No sector breakdown recorded. Add one in the Country Editor (Economics step).
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
          </EconomySection>

          {/* Labor force and employment */}
          <EconomySection
            title="Labor market and employment"
            icon={Briefcase}
            accessory={
              <Badge variant="default" className="tabular-nums">
                Female participation {pct(femaleParticipation)}
              </Badge>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Unemployment" value={pct(unemployment)} note="Nominal rate" />
              <StatTile
                label="Youth unemployment"
                value={pct(youthUnemployment)}
                note="Ages 18-24"
              />
              <StatTile
                label="Median annual wage"
                value={medianWage != null ? `$${Math.round(medianWage).toLocaleString()}` : "—"}
                note="Annual full-time"
              />
              <StatTile
                label="Informal labor"
                value={pct(informalEmployment)}
                note="Unregulated employment"
              />
            </div>
          </EconomySection>

          {/* Income inequality and wealth distribution */}
          <EconomySection
            title="Income and wealth equality"
            icon={Scale}
            accessory={
              <Badge variant="default" className="tabular-nums">
                Gini {giniLabel(gini)}
              </Badge>
            }
          >
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Top 10% wealth share" value={pct(top10Wealth)} />
              <StatTile label="Middle class share" value={pct(middleClass)} />
              <StatTile
                label="Social mobility"
                value={mobility != null ? `${Math.round(mobility)}/100` : "—"}
              />
            </div>
          </EconomySection>
        </div>
      )}

      {activeTab === "fiscal" && (
        <div className="space-y-4">
          {/* Revenue integration */}
          <EconomySection
            title="Revenue integration and budget balance"
            icon={Landmark}
            accessory={<Badge variant="default">Integrated treasury</Badge>}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile
                label="Tax revenue yield"
                value={
                  country?.governmentRevenueTotal
                    ? `$${(country.governmentRevenueTotal / 1e9).toFixed(2)}B / yr`
                    : "—"
                }
                note="Sourced from the Fiscal Policy tab"
              />
              <StatTile
                label="Trade tariff revenue"
                value={tariffRevenue != null ? `$${(tariffRevenue / 1e9).toFixed(2)}B / yr` : "—"}
                note="Fiscal Policy tariff rate on recorded imports"
              />
              <StatTile
                label="Tax system efficiency"
                value={taxEfficiency != null ? `${Math.round(taxEfficiency * 100)}%` : "—"}
                note="Collection efficiency"
                className="col-span-2 sm:col-span-1"
              />
            </div>
          </EconomySection>

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
