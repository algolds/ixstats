// @ts-nocheck
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  TrendingUp,
  BarChart3,
  Building,
  Users,
  Activity,
  PieChart,
  Briefcase,
  DollarSign,
  Globe,
  Factory,
  Wheat,
  ShoppingBag,
  Crown,
  MapPin,
  Heart,
} from "lucide-react";
import { NationalIdentityDisplay } from "~/components/countries/NationalIdentityDisplay";
import { createUrl } from "~/lib/url-utils";
import type {
  CoreEconomicIndicatorsData,
  DemographicsData,
  LaborEmploymentData,
  FiscalSystemData,
  GovernmentSpendingData,
} from "~/types/economics";
import type { CountryInfobox } from "~/lib/mediawiki-service";
import { GdpDetailsModal } from "~/components/modals/GdpDetailsModal";
import { GdpPerCapitaDetailsModal } from "~/components/modals/GdpPerCapitaDetailsModal";
import { PopulationDetailsModal } from "~/components/modals/PopulationDetailsModal";
import {
  MetricCardGrid,
  type MetricGridItem,
  StatGaugeGrid,
  SectorBreakdownCard,
  type SectorData,
} from "~/components/mycountry/primitives";
import {
  formatCompactNumber,
  formatCompactCurrency,
  formatCurrency,
  formatPercentWithNormalization as formatPercent,
  formatYears,
  formatHours,
  safeFormatCurrency,
} from "~/lib/format-utils";

const PUBLIC_POLICY_FLAGS: Array<{
  key: keyof GovernmentSpendingData;
  label: string;
  description: string;
}> = [
  {
    key: "universalHealthcare",
    label: "Universal Healthcare",
    description: "Nationwide public health coverage",
  },
  {
    key: "freeEducation",
    label: "Free Education",
    description: "Tuition-free education for citizens",
  },
  {
    key: "renewableEnergyTransition",
    label: "Renewable Energy",
    description: "National transition toward clean energy",
  },
  {
    key: "publicTransportExpansion",
    label: "Transit Expansion",
    description: "Major investments in public transport",
  },
  {
    key: "disasterPreparedness",
    label: "Disaster Preparedness",
    description: "Coordinated response & resilience planning",
  },
  {
    key: "infrastructureBankFund",
    label: "Infrastructure Bank",
    description: "Dedicated infrastructure innovation fund",
  },
  {
    key: "carbonNeutrality",
    label: "Carbon Neutrality",
    description: "Long-term commitment to net-zero emissions",
  },
  {
    key: "affordableHousing",
    label: "Affordable Housing",
    description: "Public housing and affordability programs",
  },
];

interface CountryEconomicPanelProps {
  country: {
    id: string;
    name: string;
    continent?: string | null;
    region?: string | null;
    governmentType?: string | null;
    religion?: string | null;
    leader?: string | null;
    landArea?: number | null;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    populationGrowthRate?: number | null;
    adjustedGdpGrowth?: number | null;
    populationDensity?: number | null;
    gdpDensity?: number | null;
    economicTier: string;
    populationTier: string;
    lastCalculated?: Date | number;
    baselineDate?: Date | number;
    nationalIdentity?: {
      officialName?: string | null;
      governmentType?: string | null;
      capitalCity?: string | null;
      currency?: string | null;
      currencySymbol?: string | null;
      motto?: string | null;
    } | null;
  };
  economicsData: {
    core: CoreEconomicIndicatorsData;
    demographics: DemographicsData;
    labor: LaborEmploymentData;
    fiscal: FiscalSystemData;
    spending: GovernmentSpendingData;
  };
  governmentStructure?: {
    governmentName?: string | null;
    governmentType?: string | null;
    headOfState?: string | null;
    headOfGovernment?: string | null;
    legislatureName?: string | null;
    executiveName?: string | null;
    judicialName?: string | null;
    totalBudget?: number;
    budgetCurrency?: string;
  } | null;
  wikiInfobox: CountryInfobox | null;
  currentIxTime: number;
  isOwnCountry: boolean;
  isMounted: boolean;
}

export function CountryEconomicPanel({
  country,
  economicsData,
  governmentStructure,
  wikiInfobox,
  isOwnCountry,
}: CountryEconomicPanelProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "economy" | "government" | "labor" | "demographics"
  >("overview");
  const [isPopulationModalOpen, setIsPopulationModalOpen] = useState(false);
  const [isGdpModalOpen, setIsGdpModalOpen] = useState(false);
  const [isGdpPerCapitaModalOpen, setIsGdpPerCapitaModalOpen] = useState(false);
  const [isGrowthModalOpen, setIsGrowthModalOpen] = useState(false);

  // Combined overview + key metrics for the Nation At A Glance section
  const nationAtAGlanceMetrics: MetricGridItem[] = useMemo(
    () => [
      {
        id: "population",
        title: "Population",
        value: Math.round(country.currentPopulation).toLocaleString(),
        description: `${country.populationTier} tier`,
        icon: Users,
        onClick: () => setIsPopulationModalOpen(true),
      },
      {
        id: "total-gdp",
        title: "Total GDP",
        value: formatCompactCurrency(country.currentTotalGdp),
        description: "Nominal GDP (annual)",
        icon: BarChart3,
        onClick: () => setIsGdpModalOpen(true),
      },
      {
        id: "gdp-per-capita",
        title: "GDP per Capita",
        value: formatCompactCurrency(country.currentGdpPerCapita),
        description: "Nominal USD per citizen",
        icon: DollarSign,
        onClick: () => setIsGdpPerCapitaModalOpen(true),
      },
      {
        id: "growth",
        title: "Growth Trend",
        value: formatPercent(country.adjustedGdpGrowth, "N/A", 2),
        description: "Adjusted GDP growth rate",
        icon: TrendingUp,
        status: (country.adjustedGdpGrowth ?? 0) > 0 ? ("success" as const) : ("error" as const),
        onClick: () => setIsGrowthModalOpen(true),
      },
      { id: "continent", title: "Continent", value: country.continent ?? "N/A", icon: Globe },
      {
        id: "economic-tier",
        title: "Economic Tier",
        value: country.economicTier ?? "N/A",
        icon: TrendingUp,
      },
      {
        id: "pop-density",
        title: "Population Density",
        value:
          country.populationDensity != null
            ? `${Math.round(country.populationDensity).toLocaleString()} / km²`
            : "N/A",
        icon: Users,
      },
      {
        id: "gdp-density",
        title: "GDP Density",
        value:
          country.gdpDensity != null ? `${formatCompactCurrency(country.gdpDensity)} / km²` : "N/A",
        icon: DollarSign,
      },
    ],
    [country]
  );

  // Government & National Identity fields
  const govFields = useMemo(() => {
    const fields: Array<{
      label: string;
      value: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = [];

    const govName = governmentStructure?.governmentName || country?.nationalIdentity?.officialName;
    if (govName) fields.push({ label: "Government", value: govName, icon: Building });

    const govType =
      governmentStructure?.governmentType ||
      country?.governmentType ||
      country?.nationalIdentity?.governmentType;
    if (govType) fields.push({ label: "Government Type", value: govType, icon: Crown });

    const hos = governmentStructure?.headOfState || country?.leader;
    if (hos) fields.push({ label: "Head of State", value: hos, icon: Users });

    if (governmentStructure?.headOfGovernment)
      fields.push({
        label: "Head of Government",
        value: governmentStructure.headOfGovernment,
        icon: Users,
      });

    const capital = country?.nationalIdentity?.capitalCity || wikiInfobox?.capital;
    if (capital) fields.push({ label: "Capital", value: capital, icon: MapPin });

    if (country?.religion) fields.push({ label: "Religion", value: country.religion, icon: Heart });

    const curr = country?.nationalIdentity?.currency || wikiInfobox?.currency;
    if (curr)
      fields.push({
        label: "Currency",
        value:
          curr +
          (country?.nationalIdentity?.currencySymbol
            ? ` (${country.nationalIdentity.currencySymbol})`
            : ""),
        icon: Globe,
      });

    if (governmentStructure?.legislatureName)
      fields.push({
        label: "Legislature",
        value: governmentStructure.legislatureName,
        icon: Building,
      });
    if (governmentStructure?.executiveName)
      fields.push({ label: "Executive", value: governmentStructure.executiveName, icon: Building });
    if (governmentStructure?.judicialName)
      fields.push({ label: "Judiciary", value: governmentStructure.judicialName, icon: Building });

    if (typeof governmentStructure?.totalBudget === "number") {
      fields.push({
        label: "Total Budget",
        value: safeFormatCurrency(
          governmentStructure.totalBudget,
          governmentStructure?.budgetCurrency || "USD",
          false,
          "USD"
        ),
        icon: TrendingUp,
      });
    }

    return fields;
  }, [governmentStructure, country, wikiInfobox]);

  // Economy metrics
  const economyMetrics: MetricGridItem[] = useMemo(
    () => [
      {
        id: "nominal-gdp",
        title: "Nominal GDP",
        value: formatCompactCurrency(economicsData.core.nominalGDP),
        description: "Current-year GDP output",
        icon: BarChart3,
      },
      {
        id: "real-growth",
        title: "Real GDP Growth",
        value: formatPercent(economicsData.core.realGDPGrowthRate, "N/A", 2),
        description: "Inflation-adjusted growth",
        icon: TrendingUp,
        status:
          (economicsData.core.realGDPGrowthRate ?? 0) > 0
            ? ("success" as const)
            : ("error" as const),
      },
      {
        id: "inflation",
        title: "Inflation Rate",
        value: formatPercent(economicsData.core.inflationRate),
        description: "Consumer price index",
        icon: Activity,
      },
      {
        id: "gdp-per-capita-econ",
        title: "GDP per Capita",
        value: formatCompactCurrency(economicsData.core.gdpPerCapita),
        description: "Average output per citizen",
        icon: DollarSign,
      },
    ],
    [economicsData.core]
  );

  const sectorData: SectorData[] = useMemo(() => {
    const primary = economicsData.labor?.employmentBySector?.agriculture ?? 0;
    const secondary = economicsData.labor?.employmentBySector?.industry ?? 0;
    const tertiary = economicsData.labor?.employmentBySector?.services ?? 0;
    const total = country.currentTotalGdp;

    return [
      {
        id: "agriculture",
        name: "Agriculture",
        value: total * primary,
        percentage: primary * 100,
        color: "green",
        icon: Wheat,
      },
      {
        id: "industry",
        name: "Industry",
        value: total * secondary,
        percentage: secondary * 100,
        color: "blue",
        icon: Factory,
      },
      {
        id: "services",
        name: "Services",
        value: total * tertiary,
        percentage: tertiary * 100,
        color: "purple",
        icon: ShoppingBag,
      },
    ];
  }, [economicsData.labor, country.currentTotalGdp]);

  const fiscalMetrics: MetricGridItem[] = useMemo(
    () => [
      {
        id: "tax-revenue",
        title: "Tax Revenue",
        value: formatPercent(economicsData.fiscal.taxRevenueGDPPercent),
        description: "Share of GDP captured as revenue",
        icon: DollarSign,
      },
      {
        id: "gov-revenue",
        title: "Government Revenue",
        value: formatCompactCurrency(economicsData.fiscal.governmentRevenueTotal),
        description: "Annual public revenue",
        icon: Building,
      },
      {
        id: "budget-balance",
        title: economicsData.fiscal.budgetDeficitSurplus >= 0 ? "Budget Surplus" : "Budget Deficit",
        value: formatCompactCurrency(economicsData.fiscal.budgetDeficitSurplus),
        description: "Revenue minus expenditures",
        icon: BarChart3,
        status:
          economicsData.fiscal.budgetDeficitSurplus >= 0
            ? ("success" as const)
            : ("warning" as const),
      },
      {
        id: "debt-gdp",
        title: "Debt-to-GDP",
        value: formatPercent(economicsData.fiscal.totalDebtGDPRatio),
        description: "Total public debt burden",
        icon: TrendingUp,
      },
    ],
    [economicsData.fiscal]
  );

  const leadershipMetrics: MetricGridItem[] = useMemo(() => {
    const items: MetricGridItem[] = [
      {
        id: "gov-name",
        title: "Government Name",
        value: governmentStructure?.governmentName ?? "Not Published",
        icon: Building,
      },
      {
        id: "gov-type",
        title: "Government Type",
        value: governmentStructure?.governmentType ?? country.governmentType ?? "Not Published",
        icon: Building,
      },
      {
        id: "head-state",
        title: "Head of State",
        value: governmentStructure?.headOfState ?? "Not Published",
        icon: Users,
      },
      {
        id: "head-gov",
        title: "Head of Government",
        value: governmentStructure?.headOfGovernment ?? "Not Published",
        icon: Users,
      },
      {
        id: "legislature",
        title: "Legislature",
        value: governmentStructure?.legislatureName ?? "Not Published",
        icon: Building,
      },
      {
        id: "executive",
        title: "Executive Branch",
        value: governmentStructure?.executiveName ?? "Not Published",
        icon: Building,
      },
      {
        id: "judicial",
        title: "Judicial Branch",
        value: governmentStructure?.judicialName ?? "Not Published",
        icon: Building,
      },
    ];
    return items.filter((item, index) => index < 3 || item.value !== "Not Published");
  }, [governmentStructure, country.governmentType]);

  const featuredPolicies = useMemo(() => {
    return PUBLIC_POLICY_FLAGS.filter((policy) => economicsData.spending[policy.key])
      .map(({ label, description }) => ({ label, description }))
      .slice(0, 4);
  }, [economicsData.spending]);

  const laborGauges = useMemo(
    () => [
      {
        label: "Participation",
        value: (economicsData.labor.laborForceParticipationRate ?? 0) * 100,
        unit: "%" as const,
        color: "green" as const,
        icon: Briefcase,
      },
      {
        label: "Employment",
        value: (economicsData.labor.employmentRate ?? 0) * 100,
        unit: "%" as const,
        color: "blue" as const,
        icon: Users,
      },
      {
        label: "Unemployment",
        value: (economicsData.labor.unemploymentRate ?? 0) * 100,
        unit: "%" as const,
        color: "red" as const,
        icon: Users,
      },
      {
        label: "Total Workforce",
        value: economicsData.labor.totalWorkforce ?? 0,
        max: country.currentPopulation,
        unit: "" as const,
        color: "purple" as const,
        icon: Users,
      },
    ],
    [economicsData.labor, country.currentPopulation]
  );

  const laborSectorBreakdown = useMemo(
    () => [
      {
        label: "Agriculture",
        value: formatPercent((economicsData.labor as any).employmentBySector?.agriculture),
      },
      { label: "Industry", value: formatPercent((economicsData.labor as any).employmentBySector?.industry) },
      { label: "Services", value: formatPercent((economicsData.labor as any).employmentBySector?.services) },
    ],
    [(economicsData.labor as any).employmentBySector]
  );

  const laborTypeBreakdown = useMemo(
    () => [
      { label: "Full Time", value: formatPercent((economicsData.labor as any).employmentByType?.fullTime) },
      { label: "Part Time", value: formatPercent((economicsData.labor as any).employmentByType?.partTime) },
      {
        label: "Self Employed",
        value: formatPercent((economicsData.labor as any).employmentByType?.selfEmployed),
      },
      {
        label: "Informal Economy",
        value: formatPercent((economicsData.labor as any).employmentByType?.informal),
      },
    ],
    [(economicsData.labor as any).employmentByType]
  );

  const laborSupportHighlights = useMemo(
    () => [
      { label: "Average Workweek", value: formatHours(economicsData.labor.averageWorkweekHours) },
      {
        label: "Average Annual Income",
        value: formatCurrency(economicsData.labor.averageAnnualIncome),
      },
      { label: "Minimum Wage", value: formatCurrency(economicsData.labor.minimumWage) },
      {
        label: "Paid Vacation Days",
        value:
          (economicsData.labor as any).socialProtection?.paidVacationDays != null
            ? `${(economicsData.labor as any).socialProtection.paidVacationDays} days`
            : "N/A",
      },
    ],
    [economicsData.labor]
  );

  const demographicsMetrics: MetricGridItem[] = useMemo(
    () => [
      {
        id: "life-expectancy",
        title: "Life Expectancy",
        value: formatYears(economicsData.demographics.lifeExpectancy),
        icon: Users,
      },
      {
        id: "literacy",
        title: "Literacy Rate",
        value: formatPercent(economicsData.demographics.literacyRate),
        icon: Users,
      },
      {
        id: "urban",
        title: "Urban Population",
        value: formatPercent(economicsData.demographics.urbanRuralSplit.urban),
        icon: Building,
      },
      {
        id: "rural",
        title: "Rural Population",
        value: formatPercent(economicsData.demographics.urbanRuralSplit.rural),
        icon: Globe,
      },
    ],
    [economicsData.demographics]
  );

  const ageDistribution = useMemo(
    () => (economicsData.demographics.ageDistribution ?? []).slice(0, 4),
    [economicsData.demographics.ageDistribution]
  );
  const educationLevels = useMemo(
    () => (economicsData.demographics.educationLevels ?? []).slice(0, 3),
    [economicsData.demographics.educationLevels]
  );
  const citizenshipStatuses = useMemo(
    () => (economicsData.demographics.citizenshipStatuses ?? []).slice(0, 3),
    [economicsData.demographics.citizenshipStatuses]
  );

  const tabConfig: Array<{
    value: typeof activeTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { value: "overview", label: "Overview", shortLabel: "Over", icon: TrendingUp },
    { value: "economy", label: "Economy", shortLabel: "Econ", icon: BarChart3 },
    { value: "government", label: "Government", shortLabel: "Gov", icon: Building },
    { value: "labor", label: "Labor", shortLabel: "Labor", icon: Briefcase },
    { value: "demographics", label: "Demographics", shortLabel: "Demo", icon: PieChart },
  ];

  return (
    <div className="space-y-6">
      {/* Tab System - directly, no hero card */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <div className="overflow-x-auto">
          <TabsList className="bg-muted/40 flex w-full min-w-fit justify-start gap-2 rounded-full p-1">
            {tabConfig.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-background flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition data-[state=active]:shadow-sm sm:text-sm"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview Tab - Nation At A Glance + Government & National Identity */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <Card className="border-border/50 border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <TrendingUp className="h-5 w-5 text-amber-500" />
                    Nation At A Glance
                  </CardTitle>
                  <CardDescription>
                    Key metrics and national identity from the MyCountry public profile.
                  </CardDescription>
                </div>
                {isOwnCountry && (
                  <Link href={"/mycountry"}>
                    <Button variant="outline" size="sm" className="gap-2 text-xs">
                      <Activity className="h-3 w-3" />
                      Manage
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <MetricCardGrid
                metrics={nationAtAGlanceMetrics}
                theme="overview"
                columns={4}
                animate={false}
              />

              {(country.nationalIdentity || wikiInfobox) && (
                <NationalIdentityDisplay
                  nationalIdentity={country.nationalIdentity ?? undefined}
                  wikiInfobox={wikiInfobox ?? undefined}
                  showTitle={false}
                />
              )}
            </CardContent>
          </Card>

          {/* Government & National Identity */}
          {govFields.length > 0 && (
            <Card className="border-border/50 border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Building className="h-5 w-5 text-indigo-500" />
                  Government & National Identity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {govFields.map((field) => {
                    const Icon = field.icon;
                    return (
                      <div key={field.label} className="flex items-start gap-3">
                        <Icon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                          <p className="text-muted-foreground mb-0.5 text-xs">{field.label}</p>
                          <p className="text-sm font-semibold">{field.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(country?.nationalIdentity?.motto || wikiInfobox?.motto) && (
                  <div className="mt-6 border-t pt-6">
                    <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                      National Motto
                    </p>
                    <p className="text-muted-foreground border-primary/30 border-l-4 pl-4 text-base italic">
                      &ldquo;{country?.nationalIdentity?.motto || wikiInfobox?.motto}&rdquo;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Economy Tab */}
        <TabsContent value="economy" className="mt-6 space-y-6">
          <Card className="border-border/50 border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                Economic Snapshot
              </CardTitle>
              <CardDescription>
                Public economic telemetry sourced from the MyCountry economy builder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetricCardGrid
                metrics={economyMetrics}
                theme="economy"
                columns={4}
                animate={false}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectorBreakdownCard
              title="Economic Sectors"
              subtitle="Output distribution by sector"
              sectors={sectorData}
              totalValue={country.currentTotalGdp}
              showProgressBars
              showTrends={false}
              layout="list"
            />
            <Card className="border-border/50 border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Fiscal Outlook</CardTitle>
                <CardDescription>Revenue posture and macro-fiscal balance.</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricCardGrid
                  metrics={fiscalMetrics}
                  theme="economy"
                  columns={2}
                  animate={false}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Government Tab */}
        <TabsContent value="government" className="mt-6 space-y-6">
          <Card className="border-border/50 border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Building className="h-5 w-5 text-indigo-500" />
                Government Leadership
              </CardTitle>
              <CardDescription>
                Structural overview aligned with the MyGovernment preview experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetricCardGrid
                metrics={leadershipMetrics}
                theme="government"
                columns={3}
                animate={false}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5 text-indigo-500" />
                Featured Public Programs
              </CardTitle>
              <CardDescription>
                High-visibility national initiatives highlighted for the international community.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {featuredPolicies.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {featuredPolicies.map((policy) => (
                    <div
                      key={policy.label}
                      className="rounded-xl border border-dashed border-indigo-200/80 bg-indigo-50/60 p-4 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100"
                    >
                      <p className="text-sm font-semibold">{policy.label}</p>
                      <p className="mt-1 text-xs">{policy.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  This country has not published any flagship programs.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Labor Tab */}
        <TabsContent value="labor" className="mt-6 space-y-6">
          <Card className="border-border/50 border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Briefcase className="h-5 w-5 text-emerald-500" />
                Workforce Overview
              </CardTitle>
              <CardDescription>
                Labor market signals and workforce health indicators.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatGaugeGrid gauges={laborGauges} columns={4} animate={false} />
            </CardContent>
          </Card>

          <Card className="border-border/50 border shadow-sm">
            <CardContent className="grid gap-6 pt-6 lg:grid-cols-3">
              <div>
                <h3 className="text-foreground text-base font-semibold">Employment By Sector</h3>
                <p className="text-muted-foreground text-sm">Public workforce distribution.</p>
                <div className="mt-4 space-y-3">
                  {laborSectorBreakdown.map((sector) => (
                    <div
                      key={sector.label}
                      className="border-muted/40 bg-background/90 flex items-center justify-between rounded-xl border border-dashed p-3"
                    >
                      <span className="text-sm font-semibold">{sector.label}</span>
                      <span className="text-muted-foreground text-sm">{sector.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-foreground text-base font-semibold">Employment Types</h3>
                <p className="text-muted-foreground text-sm">Labor force segmentation.</p>
                <div className="mt-4 space-y-3">
                  {laborTypeBreakdown.map((type) => (
                    <div
                      key={type.label}
                      className="border-muted/40 bg-background/90 flex items-center justify-between rounded-xl border border-dashed p-3"
                    >
                      <span className="text-sm font-semibold">{type.label}</span>
                      <span className="text-muted-foreground text-sm">{type.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-foreground text-base font-semibold">Workforce Support</h3>
                <p className="text-muted-foreground text-sm">Benefits and protections.</p>
                <div className="mt-4 space-y-3">
                  {laborSupportHighlights.map((support) => (
                    <div
                      key={support.label}
                      className="border-muted/40 bg-background/90 flex items-center justify-between rounded-xl border border-dashed p-3"
                    >
                      <span className="text-sm font-semibold">{support.label}</span>
                      <span className="text-muted-foreground text-sm">{support.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="mt-6 space-y-6">
          <Card className="border-border/50 border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <PieChart className="h-5 w-5 text-rose-500" />
                Population Profile
              </CardTitle>
              <CardDescription>
                Topline demographic signals for diplomatic and trade audiences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetricCardGrid
                metrics={demographicsMetrics}
                theme="demographics"
                columns={4}
                animate={false}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 border shadow-sm">
            <CardContent className="grid gap-6 pt-6 lg:grid-cols-3">
              <div>
                <h3 className="text-foreground text-base font-semibold">Age Distribution</h3>
                <p className="text-muted-foreground text-sm">Share by primary age brackets.</p>
                <div className="mt-4 space-y-3">
                  {ageDistribution.length > 0 ? (
                    ageDistribution.map((group) => (
                      <div
                        key={group.group}
                        className="border-muted/40 bg-background/90 flex items-center justify-between rounded-xl border border-dashed p-3"
                      >
                        <span className="text-sm font-semibold">{group.group}</span>
                        <span className="text-muted-foreground text-sm">
                          {formatPercent(group.percent)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">Not currently published.</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-foreground text-base font-semibold">Education Attainment</h3>
                <p className="text-muted-foreground text-sm">By highest completed level.</p>
                <div className="mt-4 space-y-3">
                  {educationLevels.length > 0 ? (
                    educationLevels.map((level) => (
                      <div
                        key={level.level}
                        className="border-muted/40 bg-background/90 flex items-center justify-between rounded-xl border border-dashed p-3"
                      >
                        <span className="text-sm font-semibold">{level.level}</span>
                        <span className="text-muted-foreground text-sm">
                          {formatPercent(level.percent)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">Not currently published.</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-foreground text-base font-semibold">Citizenship Status</h3>
                <p className="text-muted-foreground text-sm">Residents by legal status.</p>
                <div className="mt-4 space-y-3">
                  {citizenshipStatuses.length > 0 ? (
                    citizenshipStatuses.map((status) => (
                      <div
                        key={status.status}
                        className="border-muted/40 bg-background/90 flex items-center justify-between rounded-xl border border-dashed p-3"
                      >
                        <span className="text-sm font-semibold">{status.status}</span>
                        <span className="text-muted-foreground text-sm">
                          {formatPercent(status.percent)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">Not currently available.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Modals */}
      <PopulationDetailsModal
        isOpen={isPopulationModalOpen}
        onClose={() => setIsPopulationModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
      <GdpPerCapitaDetailsModal
        isOpen={isGdpPerCapitaModalOpen}
        onClose={() => setIsGdpPerCapitaModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
      <GdpDetailsModal
        isOpen={isGdpModalOpen}
        onClose={() => setIsGdpModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
      <Dialog open={isGrowthModalOpen} onOpenChange={setIsGrowthModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Growth Momentum</DialogTitle>
            <DialogDescription>
              Public GDP growth telemetry from the MyCountry economy builder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-muted/40 bg-muted/10 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Adjusted GDP Growth
              </p>
              <p className="text-foreground mt-2 text-xl font-semibold">
                {formatPercent(country.adjustedGdpGrowth, "N/A", 2)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Platform-adjusted growth rate accounting for external modifiers.
              </p>
            </div>
            <div className="border-muted/40 bg-muted/10 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Real GDP Growth
              </p>
              <p className="text-foreground mt-2 text-xl font-semibold">
                {formatPercent(economicsData.core.realGDPGrowthRate, "N/A", 2)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Inflation-adjusted growth as reported for public audiences.
              </p>
            </div>
            <div className="border-muted/40 bg-muted/10 rounded-lg border p-4 sm:col-span-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Supporting Signals
              </p>
              <ul className="text-muted-foreground mt-2 space-y-2 text-sm">
                <li>
                  Nominal GDP:{" "}
                  <span className="font-semibold">
                    {formatCompactCurrency(economicsData.core.nominalGDP)}
                  </span>
                </li>
                <li>
                  Inflation Rate:{" "}
                  <span className="font-semibold">
                    {formatPercent(economicsData.core.inflationRate, "N/A", 2)}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
