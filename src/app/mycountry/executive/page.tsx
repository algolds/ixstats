"use client";

import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CountryExecutiveSection } from "~/app/countries/_components/CountryExecutiveSection";
import { LiveIntelligenceSection } from "~/app/countries/_components/LiveIntelligenceSection";
import { CountryAtGlance } from "~/app/countries/_components/detail";
import { CrisisStatusBanner } from "~/app/countries/_components/CrisisStatusBanner";
import { 
  CoreEconomicIndicators,
  LaborEmployment,
  FiscalSystemComponent,
  GovernmentSpending,
  Demographics,
  EconomicSummaryWidget
} from "~/app/countries/_components/economy";
import { TrendRiskAnalytics } from "~/components/analytics/TrendRiskAnalytics";
import { ComparativeAnalysis } from "~/app/countries/_components/economy/ComparativeAnalysis";
import { generateCountryEconomicData, type CountryProfile } from "~/lib/economic-data-templates";
import { 
  AlertTriangle, 
  Crown, 
  BarChart3, 
  Users, 
  DollarSign, 
  Shield, 
  Clock, 
  TrendingUp, 
  Activity, 
  Briefcase, 
  Building, 
  PieChart, 
  Eye, 
  Search, 
  Calculator,
  Edit,
  Settings,
  Zap,
  Target,
  Brain,
  Sparkles
} from "lucide-react";
import { getTabIcon, type TabTheme } from '~/lib/mycountry-theme';
import { ThemedTabContent } from '~/components/ui/themed-tab-content';
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { Alert, AlertDescription } from "~/components/ui/alert";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

// Force dynamic rendering to avoid SSG issues with Clerk
export const dynamic = 'force-dynamic';

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

// Generate economic data helper
function generateEconomicDataForCountry(country: any) {
  const profile: CountryProfile = {
    population: country.currentPopulation || country.baselinePopulation || 0,
    gdpPerCapita: country.currentGdpPerCapita || country.baselineGdpPerCapita || 0,
    totalGdp: country.nominalGDP || (country.currentPopulation * country.currentGdpPerCapita) || 0,
    economicTier: country.economicTier || "Developing",
    landArea: country.landArea,
    continent: country.continent,
    region: country.region,
  };

  const economicData = generateCountryEconomicData(profile);

  // Override with real data
  if (country.realGDPGrowthRate !== undefined) {
    economicData.core.realGDPGrowthRate = country.realGDPGrowthRate;
  }
  if (country.inflationRate !== undefined) {
    economicData.core.inflationRate = country.inflationRate;
  }
  if (country.unemploymentRate !== undefined) {
    economicData.labor.unemploymentRate = country.unemploymentRate;
  }

  return economicData;
}

// Check if Clerk is configured
const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')
);

function MyCountryExecutiveContent() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("executive");

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: country, isLoading: countryLoading, refetch: refetchCountry } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  const { data: systemStatus, isLoading: systemStatusLoading } = api.admin.getSystemStatus.useQuery();
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : 0;

  const { data: historicalData, isLoading: historicalLoading } = api.countries.getHistoricalData.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id }
  );

  const { data: allCountries, isLoading: allCountriesLoading } = api.countries.getAll.useQuery(
    { limit: 200 },
    { enabled: activeTab === 'analytics' } 
  );
  
  // 10-year forecast for analytics
  const now = new Date();
  const forecastStartTime = now.getTime();
  const forecastEndTime = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate()).getTime();

  const { data: forecast, isLoading: forecastLoading } = api.countries.getForecast.useQuery(
    { id: country?.id || '', startTime: forecastStartTime, endTime: forecastEndTime },
    { enabled: !!country?.id && activeTab === 'analytics' }
  );

  const economyData = country ? generateEconomicDataForCountry(country) : undefined;

  useEffect(() => {
    if (isLoaded && !user) {
      const returnUrl = encodeURIComponent(createUrl('/mycountry/executive'));
      window.location.href = `https://accounts.ixwiki.com/sign-in?redirect_url=${returnUrl}`;
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || profileLoading || countryLoading || systemStatusLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!userProfile?.countryId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="text-2xl font-bold">No Country Assigned</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              You don't have a country assigned to your account yet. Contact an administrator to claim a country 
              or browse available countries to request ownership.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href={createUrl("/countries")}>
                <Button variant="outline">Browse Countries</Button>
              </Link>
              <Link href={createUrl("/admin")}>
                <Button>Contact Admin</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Country not found or access denied. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Premium Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">MyCountry Executive: {country.name}</h1>
              <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <Sparkles className="h-3 w-3 mr-1" />
                PREMIUM
              </Badge>
            </div>
            <p className="text-muted-foreground">Executive Command Center & Intelligence Suite</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href={createUrl(`/countries/${country.id}`)}>
            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Public View
            </Button>
          </Link>
          <Link href={createUrl("/mycountry/editor")}>
            <Button variant="outline" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit Data
            </Button>
          </Link>
          <Badge variant="outline">{country.economicTier}</Badge>
          <Badge variant="outline">Tier {country.populationTier}</Badge>
        </div>
      </div>

      {/* Executive Dashboard Cards */}
      <Card className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/50 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-lg font-bold text-blue-600">{(country.currentPopulation / 1000000).toFixed(1)}M</div>
                  <div className="text-xs text-muted-foreground">Population</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Current Population</div>
                  <div className="text-xs text-muted-foreground">
                    Total: {(country.currentPopulation || 0).toLocaleString()} citizens
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Population Tier: {country.populationTier}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-lg font-bold text-green-600">${(country.currentGdpPerCapita / 1000).toFixed(0)}k</div>
                  <div className="text-xs text-muted-foreground">GDP/Capita</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">GDP per Capita</div>
                  <div className="text-xs text-muted-foreground">
                    ${(country.currentGdpPerCapita || 0).toLocaleString()} per person
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Economic strength indicator
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-lg font-bold text-purple-600">{(country.adjustedGdpGrowth * 100).toFixed(2)}%</div>
                  <div className="text-xs text-muted-foreground">Growth</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Economic Growth Rate</div>
                  <div className="text-xs text-muted-foreground">
                    Adjusted GDP growth rate after global factors
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {country.adjustedGdpGrowth > 0.05 ? "Strong growth" : 
                      country.adjustedGdpGrowth > 0.02 ? "Moderate growth" : 
                      country.adjustedGdpGrowth > 0 ? "Slow growth" : "Declining"}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-lg font-bold text-orange-600">{country.economicTier}</div>
                  <div className="text-xs text-muted-foreground">Economic Tier</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Economic Development Tier</div>
                  <div className="text-xs text-muted-foreground">
                    Based on GDP per capita and economic indicators
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Current classification: {country.economicTier}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-pink-50 dark:bg-pink-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-lg font-bold text-pink-600">T{country.populationTier}</div>
                  <div className="text-xs text-muted-foreground">Pop Tier</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Population Tier</div>
                  <div className="text-xs text-muted-foreground">
                    Classification based on total population size
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tier {country.populationTier} country
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-cyan-50 dark:bg-cyan-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-lg font-bold text-cyan-600">{new Date().toLocaleDateString()}</div>
                  <div className="text-xs text-muted-foreground">Last Update</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Last Data Update</div>
                  <div className="text-xs text-muted-foreground">
                    Most recent calculation: {new Date().toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Data refreshed automatically
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Crisis Status Banner */}
      <CrisisStatusBanner countryId={country.id} />

      {/* Executive Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 min-w-fit">
            <TabsTrigger value="executive" className="flex items-center gap-1 text-xs lg:text-sm tab-trigger-executive">
              <Crown className="h-3 w-3 lg:h-4 lg:w-4 tab-icon" />
              <span className="hidden sm:inline">Executive</span>
              <span className="sm:hidden">Exec</span>
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="flex items-center gap-1 text-xs lg:text-sm tab-trigger-intelligence">
              <Brain className="h-3 w-3 lg:h-4 lg:w-4 tab-icon" />
              <span className="hidden sm:inline">Intelligence</span>
              <span className="sm:hidden">Intel</span>
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex items-center gap-1 text-xs lg:text-sm">
              <BarChart3 className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Over</span>
            </TabsTrigger>
            <TabsTrigger value="economy" className="flex items-center gap-1 text-xs lg:text-sm tab-trigger-economy">
              <TrendingUp className="h-3 w-3 lg:h-4 lg:w-4 tab-icon" />
              <span className="hidden sm:inline">Economy</span>
              <span className="sm:hidden">Econ</span>
            </TabsTrigger>
            <TabsTrigger value="labor" className="flex items-center gap-1 text-xs lg:text-sm tab-trigger-labor">
              <Briefcase className="h-3 w-3 lg:h-4 lg:w-4 tab-icon" />
              <span className="hidden sm:inline">Labor</span>
              <span className="sm:hidden">Lab</span>
            </TabsTrigger>
            <TabsTrigger value="government" className="flex items-center gap-1 text-xs lg:text-sm tab-trigger-government">
              <Building className="h-3 w-3 lg:h-4 lg:w-4 tab-icon" />
              <span className="hidden sm:inline">Government</span>
              <span className="sm:hidden">Gov</span>
            </TabsTrigger>
            <TabsTrigger value="demographics" className="flex items-center gap-1 text-xs lg:text-sm tab-trigger-demographics">
              <PieChart className="h-3 w-3 lg:h-4 lg:w-4 tab-icon" />
              <span className="hidden sm:inline">Demographics</span>
              <span className="sm:hidden">Demo</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 text-xs lg:text-sm tab-trigger-detailed">
              <Target className="h-3 w-3 lg:h-4 lg:w-4 tab-icon" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Analyze</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Executive Command Center Tab */}
        <TabsContent value="executive">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <CountryExecutiveSection countryId={country.id} userId={user?.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <LiveIntelligenceSection countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <CountryAtGlance 
            country={{
              ...country,
              lastCalculated: typeof country.lastCalculated === 'number' ? country.lastCalculated : 
                                (country.lastCalculated instanceof Date ? country.lastCalculated.getTime() : 0),
              baselineDate: typeof country.baselineDate === 'number' ? country.baselineDate : 
                              (country.baselineDate instanceof Date ? country.baselineDate.getTime() : 0)
            }} 
            currentIxTime={currentIxTime} 
            isLoading={false} 
          />
        </TabsContent>

        {/* Economy Tab */}
        <TabsContent value="economy" className="space-y-6">
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
                  gdpGrowthRate: smartNormalizeGrowthRate(country.realGDPGrowthRate || country.adjustedGdpGrowth, 3.0),
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
            
            <div className="animate-in slide-in-from-bottom-4 duration-700 delay-200">
              <CoreEconomicIndicators
                indicators={economyData?.core ?? { 
                  totalPopulation: 0, nominalGDP: 0, gdpPerCapita: 0, 
                  realGDPGrowthRate: 0, inflationRate: 0, currencyExchangeRate: 0 
                }}
                onIndicatorsChangeAction={() => {}}
                isReadOnly={true}
                showComparison={true}
              />
            </div>
          </ThemedTabContent>
        </TabsContent>

        {/* Labor Tab */}
        <TabsContent value="labor">
          <ThemedTabContent theme="labor" className="tab-content-enter">
            <LaborEmployment
              laborData={economyData?.labor ?? { 
                laborForceParticipationRate: 0, employmentRate: 0, unemploymentRate: 0, 
                totalWorkforce: 0, averageWorkweekHours: 0, minimumWage: 0, 
                averageAnnualIncome: 0, employmentBySector: { agriculture: 0, industry: 0, services: 0 }, 
                employmentByType: { fullTime: 0, partTime: 0, temporary: 0, selfEmployed: 0, informal: 0 }, 
                skillsAndProductivity: { averageEducationYears: 0, tertiaryEducationRate: 0, vocationalTrainingRate: 0, skillsGapIndex: 0, laborProductivityIndex: 0, productivityGrowthRate: 0 }, 
                demographicsAndConditions: { youthUnemploymentRate: 0, femaleParticipationRate: 0, genderPayGap: 0, unionizationRate: 0, workplaceSafetyIndex: 0, averageCommutingTime: 0 }, 
                regionalEmployment: { urban: { participationRate: 0, unemploymentRate: 0, averageIncome: 0 }, rural: { participationRate: 0, unemploymentRate: 0, averageIncome: 0 } }, 
                socialProtection: { unemploymentBenefitCoverage: 0, pensionCoverage: 0, healthInsuranceCoverage: 0, paidSickLeaveDays: 0, paidVacationDays: 0, parentalLeaveWeeks: 0 } 
              }}
              totalPopulation={economyData?.core?.totalPopulation ?? 0}
              onLaborDataChangeAction={() => {}}
              isReadOnly={true}
              showComparison={true}
            />
          </ThemedTabContent>
        </TabsContent>

        {/* Government Tab */}
        <TabsContent value="government" className="space-y-6">
          <ThemedTabContent theme="government" className="tab-content-enter space-y-6">
            <FiscalSystemComponent
              fiscalData={economyData?.fiscal ?? {
                taxRevenueGDPPercent: 0, governmentRevenueTotal: 0, taxRevenuePerCapita: 0,
                governmentBudgetGDPPercent: 0, budgetDeficitSurplus: 0, internalDebtGDPPercent: 0,
                externalDebtGDPPercent: 0, totalDebtGDPRatio: 0, debtPerCapita: 0,
                interestRates: 0, debtServiceCosts: 0,
                taxRates: { personalIncomeTaxRates: [], corporateTaxRates: [], salesTaxRate: 0, propertyTaxRate: 0, payrollTaxRate: 0, exciseTaxRates: [], wealthTaxRate: 0 },
                governmentSpendingByCategory: [],
              }}
              referenceCountry={{
                name: "Reference",
                countryCode: "REF",
                gdp: economyData?.core?.nominalGDP ?? 0,
                gdpPerCapita: economyData?.core?.gdpPerCapita ?? 0,
                taxRevenuePercent: economyData?.fiscal?.taxRevenueGDPPercent ?? 0,
                unemploymentRate: economyData?.labor?.unemploymentRate ?? 0,
                population: economyData?.core?.totalPopulation ?? 0
              }}
              nominalGDP={economyData?.core?.nominalGDP ?? 0}
              totalPopulation={economyData?.core?.totalPopulation ?? 0}
              onFiscalDataChange={() => {}}
              isReadOnly={true}
              showAnalytics={true}
            />
            
            <GovernmentSpending
              spendingData={economyData?.spending ?? {
                totalSpending: 0,
                spendingGDPPercent: 0,
                spendingPerCapita: 0,
                spendingCategories: [],
                deficitSurplus: 0
              }}
              nominalGDP={economyData?.core?.nominalGDP ?? 0}
              totalPopulation={economyData?.core?.totalPopulation ?? 0}
              onSpendingDataChangeAction={() => {}}
              isReadOnly={true}
            />
          </ThemedTabContent>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics">
          <ThemedTabContent theme="demographics" className="tab-content-enter">
            <Demographics
              demographicData={{
                ...economyData?.demographics,
                ageDistribution: economyData?.demographics?.ageDistribution ?? [],
              } as any}
              totalPopulation={economyData?.core?.totalPopulation ?? 0}
              onDemographicDataChange={() => {}}
            />
          </ThemedTabContent>
        </TabsContent>

        {/* Advanced Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
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
                        <div className="h-4 bg-muted animate-pulse rounded" />
                        <div className="h-64 bg-muted animate-pulse rounded" />
                        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                      </div>
                    ) : historicalData && historicalData.length > 0 ? (
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-sm font-medium mb-3">GDP Growth Over Time</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="text-center p-3 border rounded-lg">
                              <div className="text-2xl font-bold text-blue-600">
                                {historicalData.length}
                              </div>
                              <div className="text-sm text-muted-foreground">Data Points</div>
                            </div>
                            <div className="text-center p-3 border rounded-lg">
                              <div className="text-2xl font-bold text-green-600">
                                ${((historicalData[historicalData.length - 1]?.gdpPerCapita || 0) / 1000).toFixed(0)}k
                              </div>
                              <div className="text-sm text-muted-foreground">Latest GDP/Capita</div>
                            </div>
                            <div className="text-center p-3 border rounded-lg">
                              <div className="text-2xl font-bold text-purple-600">
                                {((historicalData[historicalData.length - 1]?.population || 0) / 1000000).toFixed(1)}M
                              </div>
                              <div className="text-sm text-muted-foreground">Latest Population</div>
                            </div>
                          </div>
                        </div>
                        
                        {forecast && (
                          <div>
                            <h4 className="text-sm font-medium mb-3">10-Year Projections</h4>
                            <div className="p-4 border rounded-lg">
                              <p className="text-muted-foreground">Advanced forecasting models available in Executive tier.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="mb-2">No Historical Data Available</p>
                        <p className="text-sm">Historical data will appear once the country has been calculated over time.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="animate-in slide-in-from-bottom-4 duration-700 delay-200">
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
                    <TrendRiskAnalytics 
                      countryId={country.id}
                      userId={user?.id}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="animate-in slide-in-from-bottom-4 duration-700 delay-300">
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
                        <div className="h-4 bg-muted animate-pulse rounded" />
                        <div className="h-32 bg-muted animate-pulse rounded" />
                        <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                      </div>
                    ) : allCountries && allCountries.countries ? (
                      <ComparativeAnalysis 
                        userCountry={{
                          id: country.id,
                          name: country.name,
                          region: country.region || 'Unknown',
                          tier: country.economicTier || 'Developing',
                          gdp: country.currentTotalGdp || 0,
                          gdpPerCapita: country.currentGdpPerCapita || 0,
                          population: country.currentPopulation || 0,
                          growthRate: country.realGDPGrowthRate || country.adjustedGdpGrowth || 0,
                          unemployment: economyData?.labor.unemploymentRate || 0,
                          inflation: economyData?.core.inflationRate || 0,
                          taxRevenue: economyData?.fiscal.taxRevenueGDPPercent || 0,
                          debtToGdp: economyData?.fiscal.totalDebtGDPRatio || 0,
                          competitivenessIndex: 50,
                          innovationIndex: 50,
                          color: '#3B82F6'
                        }}
                        allCountries={allCountries.countries.map(c => ({
                          id: c.id,
                          name: c.name,
                          region: c.region || 'Unknown',
                          tier: c.economicTier || 'Developing',
                          gdp: c.currentTotalGdp || 0,
                          gdpPerCapita: c.currentGdpPerCapita || 0,
                          population: c.currentPopulation || 0,
                          growthRate: c.adjustedGdpGrowth || 0,
                          unemployment: 5.0, // Default placeholder
                          inflation: 2.5, // Default placeholder
                          taxRevenue: 25.0, // Default placeholder
                          debtToGdp: 60.0, // Default placeholder
                          competitivenessIndex: 50,
                          innovationIndex: 50,
                          color: c.id === country.id ? '#FF6B6B' : '#8884d8'
                        }))}
                      />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="mb-2">Comparative Analysis Unavailable</p>
                        <p className="text-sm">Unable to load country comparison data at this time.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </ThemedTabContent>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function MyCountryExecutivePage() {
  useEffect(() => {
    document.title = "MyCountry Executive - IxStats";
  }, []);

  if (!isClerkConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="text-2xl font-bold">Authentication Not Configured</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              User authentication is not set up for this application. Please contact an administrator 
              to configure authentication or browse countries without signing in.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href={createUrl("/countries")}>
                <Button variant="outline">Browse Countries</Button>
              </Link>
              <Link href={createUrl("/dashboard")}>
                <Button>View Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <MyCountryExecutiveContent />;
}