"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
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
} from "lucide-react";
import { MyCountryIcon } from "~/components/ui/mycountry-logo";
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
  formatCompactNumber,
  formatCompactCurrency,
  formatCurrency,
  formatPercentWithNormalization as formatPercent,
  formatYears,
  formatHours,
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
    continent?: string | null | undefined;
    region?: string | null | undefined;
    governmentType?: string | null | undefined;
    religion?: string | null | undefined;
    leader?: string | null | undefined;
    landArea?: number | null | undefined;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    populationGrowthRate?: number | null | undefined;
    adjustedGdpGrowth?: number | null | undefined;
    populationDensity?: number | null | undefined;
    gdpDensity?: number | null | undefined;
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
  currentIxTime: _currentIxTime,
  isOwnCountry,
}: CountryEconomicPanelProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "economy" | "government" | "labor" | "demographics"
  >("overview");
  const [isPopulationModalOpen, setIsPopulationModalOpen] = useState(false);
  const [isGdpModalOpen, setIsGdpModalOpen] = useState(false);
  const [isGdpPerCapitaModalOpen, setIsGdpPerCapitaModalOpen] =
    useState(false);
  const [isGrowthModalOpen, setIsGrowthModalOpen] = useState(false);

  const highlightMetrics = useMemo(
    () => [
      {
        label: "Population",
        value: formatCompactNumber(country.currentPopulation),
        detail: `${country.currentPopulation.toLocaleString()} citizens`,
        onClick: () => setIsPopulationModalOpen(true),
      },
      {
        label: "GDP per Capita",
        value: formatCompactCurrency(country.currentGdpPerCapita),
        detail: "Nominal USD per citizen",
        onClick: () => setIsGdpPerCapitaModalOpen(true),
      },
      {
        label: "Total GDP",
        value: formatCompactCurrency(country.currentTotalGdp),
        detail: "Nominal GDP (annual)",
        onClick: () => setIsGdpModalOpen(true),
      },
      {
        label: "Growth Trend",
        value: formatPercent(country.adjustedGdpGrowth, "N/A", 2),
        detail: "Adjusted GDP growth rate",
        onClick: () => setIsGrowthModalOpen(true),
      },
    ],
    [
      country.currentPopulation,
      country.currentGdpPerCapita,
      country.currentTotalGdp,
      country.adjustedGdpGrowth,
      setIsPopulationModalOpen,
      setIsGdpPerCapitaModalOpen,
      setIsGdpModalOpen,
      setIsGrowthModalOpen,
    ]
  );

  const overviewHighlights = useMemo(
    () => [
      {
        label: "Continent",
        value: country.continent ?? "N/A",
      },
      {
        label: "Region",
        value: country.region ?? "N/A",
      },
      {
        label: "Economic Tier",
        value: country.economicTier ?? "N/A",
      },
      {
        label: "Population Tier",
        value: country.populationTier ?? "N/A",
      },
      {
        label: "Population Density",
        value:
          country.populationDensity !== null &&
          country.populationDensity !== undefined
            ? `${country.populationDensity.toFixed(1)} / km²`
            : "N/A",
      },
      {
        label: "GDP Density",
        value:
          country.gdpDensity !== null && country.gdpDensity !== undefined
            ? `${formatCompactCurrency(country.gdpDensity)} / km²`
            : "N/A",
      },
    ],
    [
      country.continent,
      country.region,
      country.economicTier,
      country.populationTier,
      country.populationDensity,
      country.gdpDensity,
    ]
  );

  const economyHighlights = useMemo(
    () => [
      {
        label: "Nominal GDP",
        value: formatCompactCurrency(economicsData.core.nominalGDP),
        detail: "Current-year GDP output",
      },
      {
        label: "Real GDP Growth",
        value: formatPercent(economicsData.core.realGDPGrowthRate, "N/A", 2),
        detail: "Inflation-adjusted growth",
      },
      {
        label: "Inflation Rate",
        value: formatPercent(economicsData.core.inflationRate),
        detail: "Consumer price index",
      },
      {
        label: "GDP per Capita",
        value: formatCompactCurrency(economicsData.core.gdpPerCapita),
        detail: "Average output per citizen",
      },
    ],
    [
      economicsData.core.nominalGDP,
      economicsData.core.realGDPGrowthRate,
      economicsData.core.inflationRate,
      economicsData.core.gdpPerCapita,
    ]
  );

  const fiscalHighlights = useMemo(
    () => [
      {
        label: "Tax Revenue",
        value: formatPercent(economicsData.fiscal.taxRevenueGDPPercent),
        detail: "Share of GDP captured as revenue",
      },
      {
        label: "Government Revenue",
        value: formatCompactCurrency(economicsData.fiscal.governmentRevenueTotal),
        detail: "Annual public revenue",
      },
      {
        label:
          economicsData.fiscal.budgetDeficitSurplus >= 0
            ? "Budget Surplus"
            : "Budget Deficit",
        value: formatCompactCurrency(
          economicsData.fiscal.budgetDeficitSurplus
        ),
        detail: "Revenue minus expenditures",
      },
      {
        label: "Debt-to-GDP",
        value: formatPercent(economicsData.fiscal.totalDebtGDPRatio),
        detail: "Total public debt burden",
      },
    ],
    [
      economicsData.fiscal.taxRevenueGDPPercent,
      economicsData.fiscal.governmentRevenueTotal,
      economicsData.fiscal.budgetDeficitSurplus,
      economicsData.fiscal.totalDebtGDPRatio,
    ]
  );

  const topSpendingCategories = useMemo(() => {
    const sorted = [...(economicsData.spending.spendingCategories ?? [])].sort(
      (a, b) => (b.amount ?? 0) - (a.amount ?? 0)
    );
    return sorted.slice(0, 3);
  }, [economicsData.spending.spendingCategories]);

  const leadershipDetails = useMemo(() => {
    const details = [
      {
        label: "Government Name",
        value: governmentStructure?.governmentName ?? "Not Published",
      },
      {
        label: "Government Type",
        value:
          governmentStructure?.governmentType ??
          country.governmentType ??
          "Not Published",
      },
      {
        label: "Head of State",
        value: governmentStructure?.headOfState ?? "Not Published",
      },
      {
        label: "Head of Government",
        value: governmentStructure?.headOfGovernment ?? "Not Published",
      },
      {
        label: "Legislature",
        value: governmentStructure?.legislatureName ?? "Not Published",
      },
      {
        label: "Executive Branch",
        value: governmentStructure?.executiveName ?? "Not Published",
      },
      {
        label: "Judicial Branch",
        value: governmentStructure?.judicialName ?? "Not Published",
      },
    ];

    return details.filter(
      (detail, index) => index < 3 || detail.value !== "Not Published"
    );
  }, [
    governmentStructure?.governmentName,
    governmentStructure?.governmentType,
    governmentStructure?.headOfState,
    governmentStructure?.headOfGovernment,
    governmentStructure?.legislatureName,
    governmentStructure?.executiveName,
    governmentStructure?.judicialName,
    country.governmentType,
  ]);

  const featuredPolicies = useMemo(() => {
    const policies = PUBLIC_POLICY_FLAGS.filter(
      (policy) => economicsData.spending[policy.key]
    ).map(({ label, description }) => ({ label, description }));
    return policies.slice(0, 4);
  }, [economicsData.spending]);

  const laborHighlights = useMemo(
    () => [
      {
        label: "Labor Force Participation",
        value: formatPercent(economicsData.labor.laborForceParticipationRate),
      },
      {
        label: "Employment Rate",
        value: formatPercent(economicsData.labor.employmentRate),
      },
      {
        label: "Unemployment Rate",
        value: formatPercent(economicsData.labor.unemploymentRate),
      },
      {
        label: "Total Workforce",
        value: formatCompactNumber(economicsData.labor.totalWorkforce),
      },
    ],
    [
      economicsData.labor.laborForceParticipationRate,
      economicsData.labor.employmentRate,
      economicsData.labor.unemploymentRate,
      economicsData.labor.totalWorkforce,
    ]
  );

  const laborSectorBreakdown = useMemo(
    () => [
      {
        label: "Agriculture",
        value: formatPercent(economicsData.labor.employmentBySector.agriculture),
      },
      {
        label: "Industry",
        value: formatPercent(economicsData.labor.employmentBySector.industry),
      },
      {
        label: "Services",
        value: formatPercent(economicsData.labor.employmentBySector.services),
      },
    ],
    [
      economicsData.labor.employmentBySector.agriculture,
      economicsData.labor.employmentBySector.industry,
      economicsData.labor.employmentBySector.services,
    ]
  );

  const laborTypeBreakdown = useMemo(
    () => [
      {
        label: "Full Time",
        value: formatPercent(economicsData.labor.employmentByType.fullTime),
      },
      {
        label: "Part Time",
        value: formatPercent(economicsData.labor.employmentByType.partTime),
      },
      {
        label: "Self Employed",
        value: formatPercent(
          economicsData.labor.employmentByType.selfEmployed
        ),
      },
      {
        label: "Informal Economy",
        value: formatPercent(economicsData.labor.employmentByType.informal),
      },
    ],
    [
      economicsData.labor.employmentByType.fullTime,
      economicsData.labor.employmentByType.partTime,
      economicsData.labor.employmentByType.selfEmployed,
      economicsData.labor.employmentByType.informal,
    ]
  );

  const laborSupportHighlights = useMemo(
    () => [
      {
        label: "Average Workweek",
        value: formatHours(economicsData.labor.averageWorkweekHours),
      },
      {
        label: "Average Annual Income",
        value: formatCurrency(economicsData.labor.averageAnnualIncome),
      },
      {
        label: "Minimum Wage",
        value: formatCurrency(economicsData.labor.minimumWage),
      },
      {
        label: "Paid Vacation Days",
        value:
          economicsData.labor.socialProtection.paidVacationDays !== null &&
          economicsData.labor.socialProtection.paidVacationDays !== undefined
            ? `${economicsData.labor.socialProtection.paidVacationDays} days`
            : "N/A",
      },
    ],
    [
      economicsData.labor.averageWorkweekHours,
      economicsData.labor.averageAnnualIncome,
      economicsData.labor.minimumWage,
      economicsData.labor.socialProtection.paidVacationDays,
    ]
  );

  const demographicsHighlights = useMemo(
    () => [
      {
        label: "Life Expectancy",
        value: formatYears(economicsData.demographics.lifeExpectancy),
      },
      {
        label: "Literacy Rate",
        value: formatPercent(economicsData.demographics.literacyRate),
      },
      {
        label: "Urban Population",
        value: formatPercent(economicsData.demographics.urbanRuralSplit.urban),
      },
      {
        label: "Rural Population",
        value: formatPercent(economicsData.demographics.urbanRuralSplit.rural),
      },
    ],
    [
      economicsData.demographics.lifeExpectancy,
      economicsData.demographics.literacyRate,
      economicsData.demographics.urbanRuralSplit.urban,
      economicsData.demographics.urbanRuralSplit.rural,
    ]
  );

  const educationHighlights = useMemo(() => {
    const topLevels = (economicsData.demographics.educationLevels ?? []).slice(
      0,
      3
    );
    return topLevels.map((level) => ({
      label: level.level,
      value: formatPercent(level.percent),
    }));
  }, [economicsData.demographics.educationLevels]);

  const citizenshipBreakdown = useMemo(() => {
    const statuses = (economicsData.demographics.citizenshipStatuses ?? []).slice(
      0,
      3
    );
    return statuses.map((status) => ({
      label: status.status,
      value: formatPercent(status.percent),
    }));
  }, [economicsData.demographics.citizenshipStatuses]);

  const ageDistributionHighlights = useMemo(() => {
    const groups = (economicsData.demographics.ageDistribution ?? []).slice(0, 4);
    return groups.map((group) => ({
      label: group.group,
      value: formatPercent(group.percent),
    }));
  }, [economicsData.demographics.ageDistribution]);

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
    <div className="space-y-8">
      <Card className="relative overflow-hidden border-none bg-gradient-to-br from-amber-50 via-white to-rose-50 shadow-xl dark:from-amber-900/30 dark:via-slate-950 dark:to-rose-950/40">
        <CardContent className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-3xl bg-white/80 p-4 shadow-inner backdrop-blur-sm dark:bg-slate-900/70">
                <MyCountryIcon size="lg" animated={false} />
              </div>
              <div>
                <Badge
                  variant="secondary"
                  className="mb-2 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
                >
                  MyCountry® Public View
                </Badge>
                <h2 className="text-2xl font-bold md:text-3xl">
                  {country.name.replace(/_/g, " ")}
                </h2>
              
              </div>
            </div>
            {isOwnCountry && (
              <Link href={createUrl("/mycountry")}>
                <Button className="gap-2 bg-amber-500 text-white shadow-md hover:bg-amber-600" size="sm">
                  <Activity className="h-4 w-4" />
                  Manage in MyCountry
                </Button>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlightMetrics.map((metric) => (
              <button
                key={metric.label}
                type="button"
                onClick={metric.onClick}
                className="rounded-2xl border border-white/60 bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-amber-400/80 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:border-white/10 dark:bg-slate-950/40"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                {metric.detail && (
                  <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

     

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <div className="overflow-x-auto">
          <TabsList className="flex w-full min-w-fit justify-start gap-2 rounded-full bg-muted/40 p-1">
            {tabConfig.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition data-[state=active]:bg-background data-[state=active]:shadow-sm sm:text-sm"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <Card className="border border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                Nation At A Glance
              </CardTitle>
              <CardDescription>
                National identity signals and macro posture pulled from the MyCountry® public profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {overviewHighlights.map((item) => (
                  <div key={item.label} className="rounded-xl border border-dashed border-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
              {(country.nationalIdentity || wikiInfobox) && (
                <div className="mt-6">
                  <NationalIdentityDisplay
                    nationalIdentity={country.nationalIdentity ?? undefined}
                    wikiInfobox={wikiInfobox ?? undefined}
                    showTitle={false}
                  />
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="economy" className="mt-6 space-y-6">
          <Card className="border border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                Economic Snapshot
              </CardTitle>
              <CardDescription>
                Public economic telemetry sourced from the MyCountry® economy builder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {economyHighlights.map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-muted/40 bg-muted/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm">
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Fiscal Outlook
                </h3>
                <p className="text-sm text-muted-foreground">
                  Revenue posture and macro-fiscal balance as declared publicly.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {fiscalHighlights.map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-dashed border-muted/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {metric.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {metric.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Top Public Investments
                </h3>
                <p className="text-sm text-muted-foreground">
                  Primary budget categories advertised through national communications.
                </p>
                <div className="mt-4 space-y-3">
                  {topSpendingCategories.length > 0 ? (
                    topSpendingCategories.map((category) => (
                      <div
                        key={category.category}
                        className="flex items-start justify-between rounded-xl border border-muted/40 bg-background/90 p-4 shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-semibold">{category.category}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPercent(category.percent)} of public budget
                          </p>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatCompactCurrency(category.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No category-level spending disclosures published.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="government" className="mt-6 space-y-6">
          <Card className="border border-border/50 shadow-sm">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leadershipDetails.map((detail) => (
                  <div key={detail.label} className="rounded-xl border border-muted/40 bg-muted/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {detail.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {detail.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm">
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
                <p className="text-sm text-muted-foreground">
                  This country has not published any flagship programs in MyCountry®.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labor" className="mt-6 space-y-6">
          <Card className="border border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Briefcase className="h-5 w-5 text-emerald-500" />
                Workforce Overview
              </CardTitle>
              <CardDescription>
                Labor market signals and workforce health indicators safe for public distribution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {laborHighlights.map((item) => (
                  <div key={item.label} className="rounded-xl border border-muted/40 bg-muted/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm">
            <CardContent className="grid gap-6 lg:grid-cols-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Employment By Sector
                </h3>
                <p className="text-sm text-muted-foreground">
                  Public workforce distribution across primary sectors.
                </p>
                <div className="mt-4 space-y-3">
                  {laborSectorBreakdown.map((sector) => (
                    <div
                      key={sector.label}
                      className="flex items-center justify-between rounded-xl border border-dashed border-muted/40 bg-background/90 p-3"
                    >
                      <span className="text-sm font-semibold">{sector.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {sector.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Employment Types
                </h3>
                <p className="text-sm text-muted-foreground">
                  Additional segmentation of the labor force mix.
                </p>
                <div className="mt-4 space-y-3">
                  {laborTypeBreakdown.map((type) => (
                    <div
                      key={type.label}
                      className="flex items-center justify-between rounded-xl border border-dashed border-muted/40 bg-background/90 p-3"
                    >
                      <span className="text-sm font-semibold">{type.label}</span>
                      <span className="text-sm text-muted-foreground">{type.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Workforce Support
                </h3>
                <p className="text-sm text-muted-foreground">
                  Public benefits and protections communicated by the nation.
                </p>
                <div className="mt-4 space-y-3">
                  {laborSupportHighlights.map((support) => (
                    <div
                      key={support.label}
                      className="flex items-center justify-between rounded-xl border border-dashed border-muted/40 bg-background/90 p-3"
                    >
                      <span className="text-sm font-semibold">{support.label}</span>
                      <span className="text-sm text-muted-foreground">{support.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demographics" className="mt-6 space-y-6">
          <Card className="border border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <PieChart className="h-5 w-5 text-rose-500" />
                Population Profile
              </CardTitle>
              <CardDescription>
                Topline demographic signals curated for diplomatic and trade audiences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {demographicsHighlights.map((item) => (
                  <div key={item.label} className="rounded-xl border border-muted/40 bg-muted/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm">
            <CardContent className="grid gap-6 lg:grid-cols-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Age Distribution
                </h3>
                <p className="text-sm text-muted-foreground">
                  Share of population by primary age brackets.
                </p>
                <div className="mt-4 space-y-3">
                  {ageDistributionHighlights.length > 0 ? (
                    ageDistributionHighlights.map((group) => (
                      <div
                        key={group.label}
                        className="flex items-center justify-between rounded-xl border border-dashed border-muted/40 bg-background/90 p-3"
                      >
                        <span className="text-sm font-semibold">{group.label}</span>
                        <span className="text-sm text-muted-foreground">{group.value}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Age distribution data is not currently published.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Education Attainment
                </h3>
                <p className="text-sm text-muted-foreground">
                  Reported share of citizens by highest completed education level.
                </p>
                <div className="mt-4 space-y-3">
                  {educationHighlights.length > 0 ? (
                    educationHighlights.map((level) => (
                      <div
                        key={level.label}
                        className="flex items-center justify-between rounded-xl border border-dashed border-muted/40 bg-background/90 p-3"
                      >
                        <span className="text-sm font-semibold">{level.label}</span>
                        <span className="text-sm text-muted-foreground">{level.value}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Education-level reporting has not been published.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Citizenship Status
                </h3>
                <p className="text-sm text-muted-foreground">
                  Public distribution of residents by legal status categories.
                </p>
                <div className="mt-4 space-y-3">
                  {citizenshipBreakdown.length > 0 ? (
                    citizenshipBreakdown.map((status) => (
                      <div
                        key={status.label}
                        className="flex items-center justify-between rounded-xl border border-dashed border-muted/40 bg-background/90 p-3"
                      >
                        <span className="text-sm font-semibold">{status.label}</span>
                        <span className="text-sm text-muted-foreground">{status.value}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No citizenship breakdown data is currently available.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              Public GDP growth telemetry sourced from the MyCountry® economy builder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adjusted GDP Growth
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {formatPercent(country.adjustedGdpGrowth, "N/A", 2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Platform-adjusted growth rate accounting for external modifiers.
              </p>
            </div>
            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Real GDP Growth
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {formatPercent(economicsData.core.realGDPGrowthRate, "N/A", 2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Inflation-adjusted growth as reported for public audiences.
              </p>
            </div>
            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Supporting Signals
              </p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>
                  • Nominal GDP:{" "}
                  <span className="font-semibold">
                    {formatCompactCurrency(economicsData.core.nominalGDP)}
                  </span>
                </li>
                <li>
                  • Inflation Rate:{" "}
                  <span className="font-semibold">
                    {formatPercent(economicsData.core.inflationRate, "N/A", 2)}
                  </span>
                </li>
                <li>
                  • Growth messaging is limited to high-level signals in this public view.
                </li>
              </ul>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            For deeper forecasting, premium scenario planning, and executive toolsets, access the full MyCountry®
            dashboard.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
