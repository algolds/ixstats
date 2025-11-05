"use client";

import { useState, useEffect } from "react";
import {
  Crown,
  Brain,
  BarChart3,
  TrendingUp,
  Briefcase,
  Building,
  PieChart,
  Target,
  Sparkles,
  ArrowUp,
  Lock,
  Activity,
  DollarSign,
  Users,
  Globe,
  Calendar,
  TrendingDown,
  MapPin,
  Heart,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { CountryExecutiveSection } from "~/app/countries/_components/CountryExecutiveSection";
import { LiveIntelligenceSection } from "~/app/countries/_components/LiveIntelligenceSection";
import { CountryAtGlance } from "~/app/countries/_components/detail";
import { safeFormatCurrency } from "~/lib/format-utils";
import {
  LaborEmployment,
  FiscalSystemComponent,
  GovernmentSpending,
  Demographics,
  EconomicSummaryWidget,
} from "~/app/countries/_components/economy";
import { SimplifiedTrendRiskAnalytics } from "~/components/analytics/SimplifiedTrendRiskAnalytics";
import { ComparativeAnalysis } from "~/app/countries/_components/economy/ComparativeAnalysis";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useCountryData } from "./primitives";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import { GovernmentStructureDisplay } from "./GovernmentStructureDisplay";
import { IntelligenceOverview } from "./IntelligenceOverview";
import { InlineHelpIcon } from "~/components/ui/help-icon";

interface MyCountryTabSystemProps {
  variant?: "unified" | "standard" | "premium";
}

// Smart normalization helper
function smartNormalizeGrowthRate(value: number | null | undefined, fallback = 3.0): number {
  if (!value || !isFinite(value)) return fallback;

  let normalizedValue = value;
  while (Math.abs(normalizedValue) > 50) {
    normalizedValue = normalizedValue / 100;
  }

  if (Math.abs(normalizedValue) > 20) {
    return normalizedValue > 0 ? 20 : -20;
  }

  return normalizedValue;
}

export function MyCountryTabSystem({ variant = "unified" }: MyCountryTabSystemProps) {
  const { user } = useUser();
  const { country, economyData, currentIxTime } = useCountryData();

  // Fetch government structure for dynamic spending data
  const { data: governmentStructure } = api.government.getByCountryId.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );
  const [activeTab, setActiveTab] = useState(
    variant === "premium" ? "executive" : variant === "standard" ? "overview" : "executive"
  );

  // Handle URL hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      const validTabs = [
        "overview",
        "economy",
        "labor",
        "government",
        "demographics",
        "executive",
        "intelligence",
        "analytics",
      ];
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };

    // Check hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Data queries for analytics tab
  const { data: historicalData, isLoading: historicalLoading } =
    api.countries.getHistoricalData.useQuery(
      { countryId: country?.id || "" },
      { enabled: !!country?.id && activeTab === "analytics" }
    );

  const { data: allCountries, isLoading: allCountriesLoading } = api.countries.getAll.useQuery(
    { limit: 200 },
    { enabled: activeTab === "analytics" }
  );

  const now = new Date();
  const forecastStartTime = now.getTime();
  const forecastEndTime = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate()).getTime();

  const { data: forecast, isLoading: forecastLoading } = api.countries.getForecast.useQuery(
    { id: country?.id || "", startTime: forecastStartTime, endTime: forecastEndTime },
    { enabled: !!country?.id && activeTab === "analytics" }
  );

  if (!country) return null;

  const renderTabsList = () => {
    const baseTabs = [
      { value: "overview", icon: BarChart3, label: "Overview", shortLabel: "Over" },
      { value: "economy", icon: TrendingUp, label: "Economy", shortLabel: "Econ" },
      { value: "labor", icon: Briefcase, label: "Labor", shortLabel: "Lab" },
      { value: "government", icon: Building, label: "Government", shortLabel: "Gov" },
      { value: "demographics", icon: PieChart, label: "Demographics", shortLabel: "Demo" },
    ];

    let tabs = [...baseTabs];

    // Add premium/executive tabs
    if (variant === "premium" || variant === "unified") {
      tabs.unshift(
        { value: "executive", icon: Crown, label: "Executive", shortLabel: "Exec" },
        { value: "intelligence", icon: Brain, label: "Intelligence", shortLabel: "Intel" }
      );
    }

    // Add analytics for premium and unified
    if (variant === "premium" || variant === "unified") {
      tabs.push({ value: "analytics", icon: Target, label: "Analytics", shortLabel: "Analyze" });
    }

    const colCount = tabs.length <= 5 ? 5 : Math.min(8, tabs.length);

    return (
      <div className="overflow-x-auto">
        <TabsList className={`grid w-full grid-cols-4 lg:grid-cols-${colCount} min-w-fit`}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs lg:text-sm ${
                [
                  "executive",
                  "intelligence",
                  "economy",
                  "labor",
                  "government",
                  "demographics",
                ].includes(tab.value)
                  ? `tab-trigger-${tab.value}`
                  : ""
              }`}
            >
              <tab.icon className="tab-icon h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    );
  };

  const renderPremiumUpgradeTeaser = () => {
    if (variant === "premium") return null;

    return (
      <>
        {/* Upgrade Banner for Standard */}
        {variant === "standard" && (
          <Card className="mb-6 border-purple-200/30 bg-gradient-to-r from-purple-50/80 to-blue-50/80 dark:from-purple-950/30 dark:to-blue-950/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-gradient-to-r from-purple-500 to-blue-500 p-3">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Unlock Premium Features</h3>
                    <p className="text-muted-foreground">
                      Access Premium Command Center, Advanced Intelligence, and Predictive Analytics
                    </p>
                  </div>
                </div>
                <Link href={createUrl("/mycountry/premium")}>
                  <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Upgrade to Premium
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Premium Features Teaser */}
        {variant === "standard" && (
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <Crown className="h-8 w-8 text-purple-500" />
                  <Lock className="text-muted-foreground h-4 w-4" />
                </div>
                <CardTitle>Premium Command Center</CardTitle>
                <CardDescription>
                  Advanced country management with real-time decision support
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-muted-foreground space-y-2 text-sm">
                  <div>• Real-time crisis monitoring</div>
                  <div>• Strategic decision recommendations</div>
                  <div>• Premium briefings & alerts</div>
                </div>
                <Link href={createUrl("/mycountry/premium")} className="mt-4 block">
                  <Button variant="outline" className="w-full">
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Upgrade to Access
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <Activity className="h-8 w-8 text-blue-500" />
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      PREVIEW
                    </Badge>
                    <Lock className="text-muted-foreground h-4 w-4" />
                  </div>
                </div>
                <CardTitle>Intelligence Briefings</CardTitle>
                <CardDescription>AI-powered insights and predictive analytics</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-muted-foreground mb-4 space-y-2 text-sm">
                  <div>• National performance analysis</div>
                  <div>• Forward-looking intelligence</div>
                  <div>• Risk assessment & mitigation</div>
                </div>
                <Link href={createUrl("/mycountry/premium")} className="block">
                  <Button variant="outline" className="w-full">
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Upgrade for Full Access
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <BarChart3 className="h-8 w-8 text-green-500" />
                  <Lock className="text-muted-foreground h-4 w-4" />
                </div>
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>Deep economic modeling and scenario planning</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-muted-foreground space-y-2 text-sm">
                  <div>• Multi-year projections</div>
                  <div>• Policy impact simulation</div>
                  <div>• Comparative benchmarking</div>
                </div>
                <Link href={createUrl("/mycountry/premium")} className="mt-4 block">
                  <Button variant="outline" className="w-full">
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Upgrade to Access
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </>
    );
  };

  // Handle tab change and update URL hash
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Update URL hash without triggering page reload
    window.history.replaceState(null, "", `#${value}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      {renderTabsList()}

      {/* Executive Command Center Tab */}
      {(variant === "premium" || variant === "unified") && (
        <TabsContent value="executive" id="executive">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <CountryExecutiveSection countryId={country.id} userId={user?.id} />
          </ThemedTabContent>
        </TabsContent>
      )}

      {/* Intelligence Tab */}
      {(variant === "premium" || variant === "unified") && (
        <TabsContent value="intelligence" id="intelligence">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <IntelligenceOverview countryData={country} />
          </ThemedTabContent>
        </TabsContent>
      )}

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-6" id="overview">
        {/* Government & National Identity */}
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Government & National Identity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(governmentStructure?.governmentName ||
                (country as any)?.nationalIdentity?.officialName) && (
                <div className="flex items-start gap-3">
                  <Building className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Government</p>
                    <p className="font-semibold">
                      {governmentStructure?.governmentName ||
                        (country as any)?.nationalIdentity?.officialName}
                    </p>
                  </div>
                </div>
              )}

              {(governmentStructure?.governmentType ||
                country?.governmentType ||
                (country as any)?.nationalIdentity?.governmentType) && (
                <div className="flex items-start gap-3">
                  <Crown className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Government Type</p>
                    <p className="font-semibold">
                      {governmentStructure?.governmentType ||
                        country?.governmentType ||
                        (country as any)?.nationalIdentity?.governmentType}
                    </p>
                  </div>
                </div>
              )}

              {(governmentStructure?.headOfState || (country as any)?.leader) && (
                <div className="flex items-start gap-3">
                  <Users className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Head of State</p>
                    <p className="font-semibold">
                      {governmentStructure?.headOfState || (country as any)?.leader}
                    </p>
                  </div>
                </div>
              )}

              {governmentStructure?.headOfGovernment && (
                <div className="flex items-start gap-3">
                  <Users className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Head of Government</p>
                    <p className="font-semibold">{governmentStructure.headOfGovernment}</p>
                  </div>
                </div>
              )}

              {(country as any)?.nationalIdentity?.capitalCity && (
                <div className="flex items-start gap-3">
                  <MapPin className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Capital</p>
                    <p className="font-semibold">
                      {(country as any)?.nationalIdentity?.capitalCity}
                    </p>
                  </div>
                </div>
              )}

              {(country as any)?.religion && (
                <div className="flex items-start gap-3">
                  <Heart className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Religion</p>
                    <p className="font-semibold">{(country as any).religion}</p>
                  </div>
                </div>
              )}

              {(country as any)?.nationalIdentity?.currency && (
                <div className="flex items-start gap-3">
                  <Globe className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Currency</p>
                    <p className="font-semibold">
                      {(country as any)?.nationalIdentity?.currency}
                      {(country as any)?.nationalIdentity?.currencySymbol
                        ? ` (${(country as any).nationalIdentity.currencySymbol})`
                        : ""}
                    </p>
                  </div>
                </div>
              )}

              {governmentStructure?.legislatureName && (
                <div className="flex items-start gap-3">
                  <Building className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Legislature</p>
                    <p className="font-semibold">{governmentStructure.legislatureName}</p>
                  </div>
                </div>
              )}

              {governmentStructure?.executiveName && (
                <div className="flex items-start gap-3">
                  <Building className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Executive</p>
                    <p className="font-semibold">{governmentStructure.executiveName}</p>
                  </div>
                </div>
              )}

              {governmentStructure?.judicialName && (
                <div className="flex items-start gap-3">
                  <Building className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Judiciary</p>
                    <p className="font-semibold">{governmentStructure.judicialName}</p>
                  </div>
                </div>
              )}

              {typeof governmentStructure?.totalBudget === "number" && (
                <div className="flex items-start gap-3">
                  <TrendingUp className="text-primary mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Total Budget</p>
                    <p className="font-semibold">
                      {safeFormatCurrency(
                        governmentStructure!.totalBudget!,
                        governmentStructure?.budgetCurrency || "USD",
                        false,
                        "USD"
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {(country as any)?.nationalIdentity?.motto && (
              <div className="mt-6 border-t pt-6">
                <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                  National Motto
                </p>
                <p className="text-muted-foreground border-primary/30 border-l-4 pl-4 text-base italic">
                  &ldquo;{(country as any)?.nationalIdentity?.motto}&rdquo;
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <CountryAtGlance
          country={{
            ...country,
            lastCalculated:
              typeof country.lastCalculated === "number"
                ? country.lastCalculated
                : country.lastCalculated instanceof Date
                  ? country.lastCalculated.getTime()
                  : 0,
            baselineDate:
              typeof country.baselineDate === "number"
                ? country.baselineDate
                : country.baselineDate instanceof Date
                  ? country.baselineDate.getTime()
                  : 0,
          }}
          currentIxTime={currentIxTime}
          isLoading={false}
        />
      </TabsContent>

      {/* Economy Tab */}
      <TabsContent value="economy" className="space-y-6" id="economy">
        <ThemedTabContent theme="economy" className="tab-content-enter space-y-6">
          <div className="animate-in slide-in-from-bottom-4 duration-700">
            <EconomicSummaryWidget
              countryName={country.name}
              data={{
                population: economyData?.core.totalPopulation ?? 0,
                gdpPerCapita: economyData?.core.gdpPerCapita ?? 0,
                totalGdp: economyData?.core.nominalGDP ?? 0,
                economicTier: country.economicTier || "Developing",
                populationGrowthRate: smartNormalizeGrowthRate(country.populationGrowthRate, 1.0),
                gdpGrowthRate: smartNormalizeGrowthRate(
                  country.realGDPGrowthRate || country.adjustedGdpGrowth,
                  3.0
                ),
                unemploymentRate: economyData?.labor.unemploymentRate ?? 0,
                laborForceParticipationRate: economyData?.labor.laborForceParticipationRate ?? 0,
                taxRevenueGDPPercent: economyData?.fiscal.taxRevenueGDPPercent ?? 0,
                budgetBalance: economyData?.fiscal.budgetDeficitSurplus ?? 0,
                debtToGDP: economyData?.fiscal.totalDebtGDPRatio ?? 0,
                populationDensity: country.populationDensity,
                gdpDensity: country.gdpDensity,
                landArea: country.landArea,
              }}
            />
          </div>

          {/* Comprehensive Economic Analysis */}
          <Card className="glass-surface glass-refraction border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Comprehensive Economic Analysis
                <InlineHelpIcon
                  title="Economic Analysis"
                  content="View detailed breakdowns of economic sectors, trade relationships, productivity metrics, income distribution, and business climate indicators for comprehensive economic planning."
                />
              </CardTitle>
              <CardDescription>
                Detailed breakdown of {country.name}'s economic structure, trade, and productivity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Economic Sub-Tabs */}
              <Tabs defaultValue="sectors" className="space-y-4">
                <TabsList className="bg-muted/50 grid w-full grid-cols-2 lg:grid-cols-5">
                  <TabsTrigger
                    value="sectors"
                    className="data-[state=active]:bg-background flex items-center gap-2"
                  >
                    <Building className="h-4 w-4" />
                    <span className="hidden sm:inline">Economic Sectors</span>
                    <span className="sm:hidden">Sectors</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="trade"
                    className="data-[state=active]:bg-background flex items-center gap-2"
                  >
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">Trade & International</span>
                    <span className="sm:hidden">Trade</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="productivity"
                    className="data-[state=active]:bg-background flex items-center gap-2"
                  >
                    <Activity className="h-4 w-4" />
                    <span className="hidden sm:inline">Productivity</span>
                    <span className="sm:hidden">Product</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="income"
                    className="data-[state=active]:bg-background flex items-center gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span className="hidden sm:inline">Income & Wealth</span>
                    <span className="sm:hidden">Income</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="business"
                    className="data-[state=active]:bg-background flex items-center gap-2"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span className="hidden sm:inline">Business Climate</span>
                    <span className="sm:hidden">Business</span>
                  </TabsTrigger>
                </TabsList>

                {/* Economic Sectors Tab */}
                <TabsContent value="sectors" className="space-y-6">
                  <div className="animate-in slide-in-from-bottom-4 duration-700">
                    {/* Economic Structure Cards */}
                    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 text-center dark:border-green-700/40 dark:from-green-900/20 dark:to-emerald-900/20">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {((economyData?.core.nominalGDP ?? 0) * 0.05).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">Primary Sector</div>
                        <div className="text-muted-foreground text-xs">(Agriculture, Mining)</div>
                        <div className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">
                          5.0%
                        </div>
                      </Card>
                      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 text-center dark:border-blue-700/40 dark:from-blue-900/20 dark:to-cyan-900/20">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {((economyData?.core.nominalGDP ?? 0) * 0.25).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">Secondary Sector</div>
                        <div className="text-muted-foreground text-xs">(Manufacturing)</div>
                        <div className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                          25.0%
                        </div>
                      </Card>
                      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-4 text-center dark:border-purple-700/40 dark:from-purple-900/20 dark:to-violet-900/20">
                        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                          {((economyData?.core.nominalGDP ?? 0) * 0.55).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">Tertiary Sector</div>
                        <div className="text-muted-foreground text-xs">(Services)</div>
                        <div className="mt-2 text-sm font-medium text-purple-600 dark:text-purple-400">
                          55.0%
                        </div>
                      </Card>
                      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-center dark:border-emerald-700/40 dark:from-emerald-900/20 dark:to-teal-900/20">
                        <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                          {((economyData?.core.nominalGDP ?? 0) * 0.15).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">Quaternary Sector</div>
                        <div className="text-muted-foreground text-xs">(Knowledge, Tech)</div>
                        <div className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          15.0%
                        </div>
                      </Card>
                    </div>

                    {/* Sector Breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Major Economic Sectors</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          {
                            name: "Services",
                            percent: 35,
                            amount: (economyData?.core.nominalGDP ?? 0) * 0.35,
                            color: "purple",
                          },
                          {
                            name: "Manufacturing",
                            percent: 25,
                            amount: (economyData?.core.nominalGDP ?? 0) * 0.25,
                            color: "blue",
                          },
                          {
                            name: "Finance & Business",
                            percent: 20,
                            amount: (economyData?.core.nominalGDP ?? 0) * 0.2,
                            color: "emerald",
                          },
                          {
                            name: "Technology & Information",
                            percent: 15,
                            amount: (economyData?.core.nominalGDP ?? 0) * 0.15,
                            color: "cyan",
                          },
                          {
                            name: "Agriculture & Mining",
                            percent: 5,
                            amount: (economyData?.core.nominalGDP ?? 0) * 0.05,
                            color: "green",
                          },
                        ].map((sector) => (
                          <div key={sector.name}>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium">{sector.name}</span>
                              <span className="text-muted-foreground text-sm">
                                {sector.percent}% •{" "}
                                {sector.amount.toLocaleString("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                  notation: "compact",
                                  maximumFractionDigits: 1,
                                })}
                              </span>
                            </div>
                            <div className="bg-muted h-2 overflow-hidden rounded-full">
                              <div
                                className={`h-full bg-${sector.color}-500 dark:bg-${sector.color}-400 transition-all`}
                                style={{ width: `${sector.percent}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Trade & International Tab */}
                <TabsContent value="trade" className="space-y-6">
                  <div className="animate-in slide-in-from-bottom-4 duration-700">
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-900/20 dark:to-emerald-900/20">
                        <div className="text-muted-foreground mb-2 text-sm">Total Exports</div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {((economyData?.core.nominalGDP ?? 0) * 0.35).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">35% of GDP</div>
                      </Card>
                      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:from-blue-900/20 dark:to-cyan-900/20">
                        <div className="text-muted-foreground mb-2 text-sm">Total Imports</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {((economyData?.core.nominalGDP ?? 0) * 0.32).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">32% of GDP</div>
                      </Card>
                      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-900/20 dark:to-teal-900/20">
                        <div className="text-muted-foreground mb-2 text-sm">Trade Balance</div>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {((economyData?.core.nominalGDP ?? 0) * 0.03).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">Surplus +3% GDP</div>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Export Composition</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {[
                            { name: "Manufactured Goods", value: 45 },
                            { name: "Technology Products", value: 25 },
                            { name: "Services", value: 15 },
                            { name: "Agricultural Products", value: 10 },
                            { name: "Raw Materials", value: 5 },
                          ].map((item) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{item.name}</span>
                              <span className="font-medium">{item.value}%</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Import Composition</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {[
                            { name: "Energy & Fuels", value: 30 },
                            { name: "Manufactured Goods", value: 25 },
                            { name: "Technology Products", value: 20 },
                            { name: "Raw Materials", value: 15 },
                            { name: "Food & Agricultural", value: 10 },
                          ].map((item) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{item.name}</span>
                              <span className="font-medium">{item.value}%</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                {/* Productivity Tab */}
                <TabsContent value="productivity" className="space-y-6">
                  <div className="animate-in slide-in-from-bottom-4 duration-700">
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">Labor Productivity</div>
                        <div className="text-2xl font-bold">125.0</div>
                        <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                          +2.5% annually
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">Innovation Index</div>
                        <div className="text-2xl font-bold">72/100</div>
                        <div className="text-muted-foreground mt-1 text-xs">Global ranking</div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">R&D Investment</div>
                        <div className="text-2xl font-bold">2.8%</div>
                        <div className="text-muted-foreground mt-1 text-xs">Of GDP</div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">Competitiveness</div>
                        <div className="text-2xl font-bold">68/100</div>
                        <div className="text-muted-foreground mt-1 text-xs">Global index</div>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Productivity Metrics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm">Infrastructure Quality</span>
                            <span className="text-sm font-medium">75/100</span>
                          </div>
                          <div className="bg-muted h-2 overflow-hidden rounded-full">
                            <div
                              className="h-full bg-blue-500 dark:bg-blue-400"
                              style={{ width: "75%" }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm">Human Capital Index</span>
                            <span className="text-sm font-medium">82/100</span>
                          </div>
                          <div className="bg-muted h-2 overflow-hidden rounded-full">
                            <div
                              className="h-full bg-purple-500 dark:bg-purple-400"
                              style={{ width: "82%" }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm">Technology Adoption</span>
                            <span className="text-sm font-medium">70/100</span>
                          </div>
                          <div className="bg-muted h-2 overflow-hidden rounded-full">
                            <div
                              className="h-full bg-emerald-500 dark:bg-emerald-400"
                              style={{ width: "70%" }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Income & Wealth Tab */}
                <TabsContent value="income" className="space-y-6">
                  <div className="animate-in slide-in-from-bottom-4 duration-700">
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">Median Income</div>
                        <div className="text-2xl font-bold">
                          {((economyData?.core.gdpPerCapita ?? 0) * 0.75).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          })}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">Per year</div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">Gini Coefficient</div>
                        <div className="text-2xl font-bold">0.38</div>
                        <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                          Moderate inequality
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">Poverty Rate</div>
                        <div className="text-2xl font-bold">8.5%</div>
                        <div className="text-muted-foreground mt-1 text-xs">Below poverty line</div>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Income Distribution</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          {
                            class: "Lower Class",
                            percent: 15,
                            income: (economyData?.core.gdpPerCapita ?? 0) * 0.3,
                          },
                          {
                            class: "Lower Middle Class",
                            percent: 25,
                            income: (economyData?.core.gdpPerCapita ?? 0) * 0.6,
                          },
                          {
                            class: "Middle Class",
                            percent: 35,
                            income: (economyData?.core.gdpPerCapita ?? 0) * 0.9,
                          },
                          {
                            class: "Upper Middle Class",
                            percent: 20,
                            income: (economyData?.core.gdpPerCapita ?? 0) * 1.5,
                          },
                          {
                            class: "Upper Class",
                            percent: 5,
                            income: (economyData?.core.gdpPerCapita ?? 0) * 4.0,
                          },
                        ].map((item) => (
                          <div key={item.class}>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium">{item.class}</span>
                              <span className="text-muted-foreground text-sm">
                                {item.percent}% •{" "}
                                {item.income.toLocaleString("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            </div>
                            <div className="bg-muted h-2 overflow-hidden rounded-full">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all"
                                style={{ width: `${item.percent}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Business Climate Tab */}
                <TabsContent value="business" className="space-y-6">
                  <div className="animate-in slide-in-from-bottom-4 duration-700">
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">
                          Ease of Doing Business
                        </div>
                        <div className="text-2xl font-bold">Rank #45</div>
                        <div className="text-muted-foreground mt-1 text-xs">Out of 190</div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">Startup Formation</div>
                        <div className="text-2xl font-bold">12.5</div>
                        <div className="text-muted-foreground mt-1 text-xs">Per 1000 people</div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">FDI Inflow</div>
                        <div className="text-2xl font-bold">
                          {((economyData?.core.nominalGDP ?? 0) * 0.025).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">2.5% of GDP</div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-muted-foreground mb-2 text-sm">
                          Credit to Private Sector
                        </div>
                        <div className="text-2xl font-bold">85%</div>
                        <div className="text-muted-foreground mt-1 text-xs">Of GDP</div>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Business Environment</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>Time to Start a Business</span>
                            <span className="font-medium">8 days</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Cost to Start (% of income)</span>
                            <span className="font-medium">2.5%</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Regulatory Quality</span>
                            <span className="font-medium">72/100</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Access to Finance</span>
                            <span className="font-medium">68/100</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Business Demographics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>Small Businesses (0-50)</span>
                            <span className="font-medium">85%</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Medium Businesses (50-250)</span>
                            <span className="font-medium">12%</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Large Businesses (250+)</span>
                            <span className="font-medium">3%</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Entrepreneurship Rate</span>
                            <span className="font-medium">15.2%</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </ThemedTabContent>
      </TabsContent>

      {/* Labor Tab */}
      <TabsContent value="labor" id="labor">
        <ThemedTabContent theme="labor" className="tab-content-enter">
          <LaborEmployment
            laborData={
              economyData?.labor ?? {
                laborForceParticipationRate: 0,
                employmentRate: 0,
                unemploymentRate: 0,
                totalWorkforce: 0,
                averageWorkweekHours: 0,
                minimumWage: 0,
                averageAnnualIncome: 0,
                employmentBySector: { agriculture: 0, industry: 0, services: 0 },
                employmentByType: {
                  fullTime: 0,
                  partTime: 0,
                  temporary: 0,
                  selfEmployed: 0,
                  informal: 0,
                },
                skillsAndProductivity: {
                  averageEducationYears: 0,
                  tertiaryEducationRate: 0,
                  vocationalTrainingRate: 0,
                  skillsGapIndex: 0,
                  laborProductivityIndex: 0,
                  productivityGrowthRate: 0,
                },
                demographicsAndConditions: {
                  youthUnemploymentRate: 0,
                  femaleParticipationRate: 0,
                  genderPayGap: 0,
                  unionizationRate: 0,
                  workplaceSafetyIndex: 0,
                  averageCommutingTime: 0,
                },
                regionalEmployment: {
                  urban: { participationRate: 0, unemploymentRate: 0, averageIncome: 0 },
                  rural: { participationRate: 0, unemploymentRate: 0, averageIncome: 0 },
                },
                socialProtection: {
                  unemploymentBenefitCoverage: 0,
                  pensionCoverage: 0,
                  healthInsuranceCoverage: 0,
                  paidSickLeaveDays: 0,
                  paidVacationDays: 0,
                  parentalLeaveWeeks: 0,
                },
              }
            }
            totalPopulation={economyData?.core?.totalPopulation ?? 0}
            onLaborDataChangeAction={() => {}}
            isReadOnly={true}
            showComparison={true}
          />
        </ThemedTabContent>
      </TabsContent>

      {/* Government Tab */}
      <TabsContent value="government" className="space-y-6" id="government">
        <ThemedTabContent theme="government" className="tab-content-enter space-y-6">
          {/* Editor Navigation Card */}
          <Card className="glass-surface glass-refraction border-amber-200 bg-gradient-to-r from-amber-50/50 to-yellow-50/50 dark:border-amber-700/40 dark:from-amber-950/20 dark:to-yellow-950/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-amber-500/10 p-3 dark:bg-amber-400/10">
                  <DollarSign className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-foreground mb-2 text-lg font-semibold">
                    Need to Edit Your Government?
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    To build or modify your tax system, government structure, budgets, and
                    departments, use the <strong>MyCountry Editor</strong>. This page shows your
                    current government stats and overview.
                  </p>
                  <Link href={createUrl("/mycountry/editor")}>
                    <Button className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600">
                      <DollarSign className="mr-2 h-4 w-4" />
                      Open MyCountry Editor
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-surface glass-refraction border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Government Structure & Overview
              </CardTitle>
              <CardDescription>
                View your current government structure, spending, and fiscal system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Government Sub-Tabs */}
              <Tabs defaultValue="structure" className="space-y-4">
                <TabsList className="bg-muted/50 grid w-full grid-cols-2 lg:grid-cols-3">
                  <TabsTrigger
                    value="structure"
                    className="data-[state=active]:bg-background flex items-center gap-2"
                  >
                    <Crown className="h-4 w-4" />
                    <span className="hidden sm:inline">Structure & Branches</span>
                    <span className="sm:hidden">Structure</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="spending"
                    className="data-[state=active]:bg-background flex items-center gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span className="hidden sm:inline">Spending & Budget</span>
                    <span className="sm:hidden">Budget</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="fiscal"
                    className="data-[state=active]:bg-background flex items-center gap-2"
                  >
                    <Building className="h-4 w-4" />
                    <span className="hidden sm:inline">Fiscal System</span>
                    <span className="sm:hidden">Fiscal</span>
                  </TabsTrigger>
                </TabsList>

                {/* Structure & Branches Tab */}
                <TabsContent value="structure" className="space-y-6">
                  <div className="animate-in slide-in-from-bottom-4 duration-700">
                    {country?.id ? (
                      <GovernmentStructureDisplay countryId={country.id} variant="full" />
                    ) : (
                      <div className="text-muted-foreground py-8 text-center">
                        Loading government structure...
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Spending & Budget Tab */}
                <TabsContent value="spending" className="space-y-6">
                  <div className="animate-in slide-in-from-bottom-4 duration-700">
                    <GovernmentSpending
                      {...(economyData?.spending ?? {
                        education: 0,
                        healthcare: 0,
                        socialSafety: 0,
                        totalSpending: 0,
                        spendingGDPPercent: 0,
                        spendingPerCapita: 0,
                        spendingCategories: [],
                        deficitSurplus: 0,
                        performanceBasedBudgeting: false,
                        universalBasicServices: false,
                        greenInvestmentPriority: false,
                        digitalGovernmentInitiative: false,
                      })}
                      nominalGDP={economyData?.core?.nominalGDP ?? 0}
                      totalPopulation={economyData?.core?.totalPopulation ?? 0}
                      onSpendingDataChangeAction={() => {}}
                      isReadOnly={true}
                    />
                  </div>
                </TabsContent>

                {/* Fiscal System Tab */}
                <TabsContent value="fiscal" className="space-y-6">
                  <div className="animate-in slide-in-from-bottom-4 duration-700">
                    <FiscalSystemComponent
                      fiscalData={
                        economyData?.fiscal ?? {
                          taxRevenueGDPPercent: 0,
                          governmentRevenueTotal: 0,
                          taxRevenuePerCapita: 0,
                          governmentBudgetGDPPercent: 0,
                          budgetDeficitSurplus: 0,
                          internalDebtGDPPercent: 0,
                          externalDebtGDPPercent: 0,
                          totalDebtGDPRatio: 0,
                          debtPerCapita: 0,
                          interestRates: 0,
                          debtServiceCosts: 0,
                          taxRates: {
                            personalIncomeTaxRates: [],
                            corporateTaxRates: [],
                            salesTaxRate: 0,
                            propertyTaxRate: 0,
                            payrollTaxRate: 0,
                            exciseTaxRates: [],
                            wealthTaxRate: 0,
                          },
                          governmentSpendingByCategory: [],
                        }
                      }
                      nominalGDP={economyData?.core?.nominalGDP ?? 0}
                      totalPopulation={economyData?.core?.totalPopulation ?? 0}
                      onFiscalDataChange={() => {}}
                      isReadOnly={true}
                      showAnalytics={variant === "premium"}
                      governmentStructure={governmentStructure}
                      countryId={country?.id}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </ThemedTabContent>
      </TabsContent>

      {/* Demographics Tab */}
      <TabsContent value="demographics" id="demographics">
        <ThemedTabContent theme="demographics" className="tab-content-enter">
          <Demographics
            demographicData={
              {
                ...economyData?.demographics,
                ageDistribution: economyData?.demographics?.ageDistribution ?? [],
              } as any
            }
            totalPopulation={economyData?.core?.totalPopulation ?? 0}
            onDemographicDataChangeAction={() => {}}
          />
        </ThemedTabContent>
      </TabsContent>

      {/* Advanced Analytics Tab */}
      {(variant === "premium" || variant === "unified") && (
        <TabsContent value="analytics" className="space-y-6" id="analytics">
          <ThemedTabContent theme="detailed" className="tab-content-enter space-y-6">
            <div className="space-y-6">
              <div className="animate-in slide-in-from-bottom-4 duration-700">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Economic Trends & Projections
                    </CardTitle>
                    <CardDescription>
                      Historical performance and future economic projections for {country.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historicalLoading || forecastLoading ? (
                      <div className="space-y-4">
                        <div className="bg-muted h-4 animate-pulse rounded" />
                        <div className="bg-muted h-64 animate-pulse rounded" />
                        <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
                      </div>
                    ) : historicalData && historicalData.length > 0 ? (
                      <div className="space-y-6">
                        <div>
                          <h4 className="mb-3 text-sm font-medium">GDP Growth Over Time</h4>
                          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-lg border p-3 text-center">
                              <div className="text-2xl font-bold text-blue-600">
                                {historicalData.length}
                              </div>
                              <div className="text-muted-foreground text-sm">Data Points</div>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <div className="text-2xl font-bold text-green-600">
                                $
                                {(
                                  (historicalData[historicalData.length - 1]?.gdpPerCapita || 0) /
                                  1000
                                ).toFixed(0)}
                                k
                              </div>
                              <div className="text-muted-foreground text-sm">Latest GDP/Capita</div>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <div className="text-2xl font-bold text-purple-600">
                                {(
                                  (historicalData[historicalData.length - 1]?.population || 0) /
                                  1000000
                                ).toFixed(1)}
                                M
                              </div>
                              <div className="text-muted-foreground text-sm">Latest Population</div>
                            </div>
                          </div>

                          {/* Simple GDP Trend Visualization */}
                          <div className="mt-4">
                            <div className="mb-2 flex items-center gap-2">
                              {historicalData.length >= 2 && (
                                <>
                                  {historicalData[historicalData.length - 1]!.gdpPerCapita >
                                  historicalData[0]!.gdpPerCapita ? (
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className="text-sm font-medium">
                                    {(
                                      ((historicalData[historicalData.length - 1]!.gdpPerCapita -
                                        historicalData[0]!.gdpPerCapita) /
                                        historicalData[0]!.gdpPerCapita) *
                                      100
                                    ).toFixed(1)}
                                    % total change
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="bg-muted h-2 overflow-hidden rounded-full">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, ((historicalData.length - 1) / 30) * 100))}%`,
                                }}
                              />
                            </div>
                            <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                              <span>
                                Start: ${(historicalData[0]!.gdpPerCapita / 1000).toFixed(1)}k
                              </span>
                              <span>
                                Current: $
                                {(
                                  (historicalData[historicalData.length - 1]!.gdpPerCapita || 0) /
                                  1000
                                ).toFixed(1)}
                                k
                              </span>
                            </div>
                          </div>
                        </div>

                        {forecast && (
                          <div>
                            <h4 className="mb-3 text-sm font-medium">10-Year Projections</h4>
                            <div className="rounded-lg border p-4">
                              <p className="text-muted-foreground">
                                Advanced forecasting models available in Executive tier.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-muted-foreground py-8 text-center">
                        <BarChart3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p className="mb-2">No Historical Data Available</p>
                        <p className="text-sm">
                          Historical data will appear once the country has been calculated over
                          time.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="animate-in slide-in-from-bottom-4 delay-200 duration-700">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Economic Health & Risk Analysis
                    </CardTitle>
                    <CardDescription>
                      Comprehensive analysis of economic stability, trends, and risk factors
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SimplifiedTrendRiskAnalytics countryId={country.id} userId={user?.id} />
                  </CardContent>
                </Card>
              </div>

              <div className="animate-in slide-in-from-bottom-4 delay-300 duration-700">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Comparative Analysis
                    </CardTitle>
                    <CardDescription>
                      Compare {country.name} with similar countries and regional peers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {allCountriesLoading ? (
                      <div className="space-y-4">
                        <div className="bg-muted h-4 animate-pulse rounded" />
                        <div className="bg-muted h-32 animate-pulse rounded" />
                        <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                      </div>
                    ) : allCountries && allCountries.countries ? (
                      <ComparativeAnalysis
                        userCountry={{
                          id: country.id,
                          name: country.name,
                          region: country.region || "Unknown",
                          tier: country.economicTier || "Developing",
                          gdp:
                            country.currentTotalGdp ||
                            country.currentPopulation * country.currentGdpPerCapita,
                          gdpPerCapita: country.currentGdpPerCapita || 0,
                          population: country.currentPopulation || 0,
                          growthRate: smartNormalizeGrowthRate(
                            country.realGDPGrowthRate || country.adjustedGdpGrowth
                          ),
                          unemployment:
                            country.unemploymentRate || economyData?.labor?.unemploymentRate || 5.0,
                          inflation:
                            country.inflationRate || economyData?.core?.inflationRate || 2.5,
                          taxRevenue:
                            country.taxRevenueGDPPercent ||
                            economyData?.fiscal?.taxRevenueGDPPercent ||
                            25.0,
                          debtToGdp:
                            country.totalDebtGDPRatio ||
                            economyData?.fiscal?.totalDebtGDPRatio ||
                            60.0,
                          competitivenessIndex: 50 + (country.economicVitality || 0) / 5,
                          innovationIndex: 50 + (country.governmentalEfficiency || 0) / 5,
                          color: "#3B82F6",
                        }}
                        allCountries={allCountries.countries.map((c) => ({
                          id: c.id,
                          name: c.name,
                          region: c.region || "Unknown",
                          tier: c.economicTier || "Developing",
                          gdp: c.currentTotalGdp || c.currentPopulation * c.currentGdpPerCapita,
                          gdpPerCapita: c.currentGdpPerCapita || 0,
                          population: c.currentPopulation || 0,
                          growthRate: smartNormalizeGrowthRate(c.adjustedGdpGrowth),
                          unemployment: c.unemploymentRate || 5.0,
                          inflation: c.inflationRate || 2.5,
                          taxRevenue: c.taxRevenueGDPPercent || 25.0,
                          debtToGdp: c.totalDebtGDPRatio || 60.0,
                          competitivenessIndex: 50 + ((c as any).economicVitality || 0) / 5,
                          innovationIndex: 50 + ((c as any).governmentalEfficiency || 0) / 5,
                          color: c.id === country.id ? "#FF6B6B" : "#8884d8",
                        }))}
                      />
                    ) : (
                      <div className="text-muted-foreground py-8 text-center">
                        <BarChart3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p className="mb-2">Comparative Analysis Unavailable</p>
                        <p className="text-sm">
                          Unable to load country comparison data at this time.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Vitality Scores Section */}
              <div className="animate-in slide-in-from-bottom-4 delay-400 duration-700">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      National Vitality Scores
                    </CardTitle>
                    <CardDescription>
                      Comprehensive health indicators across key national areas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950/20 dark:to-orange-950/20">
                        <div className="mb-2 flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-amber-600" />
                          <h4 className="text-sm font-semibold">Economic Vitality</h4>
                        </div>
                        <div className="mb-1 text-3xl font-bold text-amber-600">
                          {(Number(country.economicVitality) || 0).toFixed(1)}%
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Economic health and performance
                        </p>
                      </div>

                      <div className="rounded-lg border bg-gradient-to-br from-cyan-50 to-blue-50 p-4 dark:from-cyan-950/20 dark:to-blue-950/20">
                        <div className="mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4 text-cyan-600" />
                          <h4 className="text-sm font-semibold">Population Wellbeing</h4>
                        </div>
                        <div className="mb-1 text-3xl font-bold text-cyan-600">
                          {(Number(country.populationWellbeing) || 0).toFixed(1)}%
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Quality of life and development
                        </p>
                      </div>

                      <div className="rounded-lg border bg-gradient-to-br from-violet-50 to-purple-50 p-4 dark:from-violet-950/20 dark:to-purple-950/20">
                        <div className="mb-2 flex items-center gap-2">
                          <Globe className="h-4 w-4 text-violet-600" />
                          <h4 className="text-sm font-semibold">Diplomatic Standing</h4>
                        </div>
                        <div className="mb-1 text-3xl font-bold text-violet-600">
                          {(Number(country.diplomaticStanding) || 0).toFixed(1)}%
                        </div>
                        <p className="text-muted-foreground text-xs">
                          International relations strength
                        </p>
                      </div>

                      <div className="rounded-lg border bg-gradient-to-br from-red-50 to-rose-50 p-4 dark:from-red-950/20 dark:to-rose-950/20">
                        <div className="mb-2 flex items-center gap-2">
                          <Building className="h-4 w-4 text-red-600" />
                          <h4 className="text-sm font-semibold">Government Efficiency</h4>
                        </div>
                        <div className="mb-1 text-3xl font-bold text-red-600">
                          {(Number(country.governmentalEfficiency) || 0).toFixed(1)}%
                        </div>
                        <p className="text-muted-foreground text-xs">Governance effectiveness</p>
                      </div>
                    </div>

                    <div className="bg-muted/50 mt-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="mb-1 font-semibold">Overall National Health</h4>
                          <p className="text-muted-foreground text-sm">
                            Average of all vitality indicators
                          </p>
                        </div>
                        <div className="text-4xl font-bold text-purple-600">
                          {(
                            ((Number(country.economicVitality) || 0) +
                              (Number(country.populationWellbeing) || 0) +
                              (Number(country.diplomaticStanding) || 0) +
                              (Number(country.governmentalEfficiency) || 0)) /
                            4
                          ).toFixed(1) + "%"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </ThemedTabContent>
        </TabsContent>
      )}

      {/* Render premium upgrade teaser */}
      {renderPremiumUpgradeTeaser()}
    </Tabs>
  );
}
