"use client";

import { useState } from 'react';
import { 
  Crown, Brain, BarChart3, TrendingUp, Briefcase, 
  Building, PieChart, Target, Sparkles, ArrowUp, Lock, Activity, DollarSign
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { CountryExecutiveSection } from "~/app/countries/_components/CountryExecutiveSection";
import { LiveIntelligenceSection } from "~/app/countries/_components/LiveIntelligenceSection";
import { CountryAtGlance } from "~/app/countries/_components/detail";
import { 
  LaborEmployment,
  FiscalSystemComponent,
  GovernmentSpending,
  Demographics,
  EconomicSummaryWidget
} from "~/app/countries/_components/economy";
import { TrendRiskAnalytics } from "~/components/analytics/TrendRiskAnalytics";
import { ComparativeAnalysis } from "~/app/countries/_components/economy/ComparativeAnalysis";
import { ThemedTabContent } from '~/components/ui/themed-tab-content';
import { useCountryData } from './primitives';
import { api } from "~/trpc/react";
import { useUser } from "@clerk/nextjs";
import Link from 'next/link';
import { createUrl } from '~/lib/url-utils';
import { GovernmentStructureDisplay } from './GovernmentStructureDisplay';

interface MyCountryTabSystemProps {
  variant?: 'unified' | 'standard' | 'premium';
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

export function MyCountryTabSystem({ variant = 'unified' }: MyCountryTabSystemProps) {
  const { user } = useUser();
  const { country, economyData, currentIxTime } = useCountryData();
  
  // Fetch government structure for dynamic spending data
  const { data: governmentStructure } = api.government.getByCountryId.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id }
  );
  const [activeTab, setActiveTab] = useState(
    variant === 'premium' ? "executive" : 
    variant === 'standard' ? "overview" : "executive"
  );

  // Data queries for analytics tab
  const { data: historicalData, isLoading: historicalLoading } = api.countries.getHistoricalData.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id && activeTab === 'analytics' }
  );

  const { data: allCountries, isLoading: allCountriesLoading } = api.countries.getAll.useQuery(
    { limit: 200 },
    { enabled: activeTab === 'analytics' } 
  );
  
  const now = new Date();
  const forecastStartTime = now.getTime();
  const forecastEndTime = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate()).getTime();

  const { data: forecast, isLoading: forecastLoading } = api.countries.getForecast.useQuery(
    { id: country?.id || '', startTime: forecastStartTime, endTime: forecastEndTime },
    { enabled: !!country?.id && activeTab === 'analytics' }
  );

  if (!country) return null;

  const renderTabsList = () => {
    const baseTabs = [
      { value: "overview", icon: BarChart3, label: "Overview", shortLabel: "Over" },
      { value: "economy", icon: TrendingUp, label: "Economy", shortLabel: "Econ" },
      { value: "labor", icon: Briefcase, label: "Labor", shortLabel: "Lab" },
      { value: "government", icon: Building, label: "Government", shortLabel: "Gov" },
      { value: "demographics", icon: PieChart, label: "Demographics", shortLabel: "Demo" }
    ];

    let tabs = [...baseTabs];

    // Add premium/executive tabs
    if (variant === 'premium' || variant === 'unified') {
      tabs.unshift(
        { value: "executive", icon: Crown, label: "Executive", shortLabel: "Exec" },
        { value: "intelligence", icon: Brain, label: "Intelligence", shortLabel: "Intel" }
      );
    }

    // Add analytics for premium and unified
    if (variant === 'premium' || variant === 'unified') {
      tabs.push({ value: "analytics", icon: Target, label: "Analytics", shortLabel: "Analyze" });
    }

    const colCount = tabs.length <= 5 ? 5 : Math.min(8, tabs.length);

    return (
      <div className="overflow-x-auto">
        <TabsList className={`grid w-full grid-cols-4 lg:grid-cols-${colCount} min-w-fit`}>
          {tabs.map(tab => (
            <TabsTrigger 
              key={tab.value} 
              value={tab.value} 
              className={`flex items-center gap-1 text-xs lg:text-sm ${
                ['executive', 'intelligence', 'economy', 'labor', 'government', 'demographics'].includes(tab.value) 
                  ? `tab-trigger-${tab.value}` 
                  : ''
              }`}
            >
              <tab.icon className="h-3 w-3 lg:h-4 lg:w-4 tab-icon" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    );
  };

  const renderPremiumUpgradeTeaser = () => {
    if (variant === 'premium') return null;

    return (
      <>
        {/* Upgrade Banner for Standard */}
        {variant === 'standard' && (
          <Card className="border-gradient-to-r from-purple-500/20 to-blue-500/20 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500">
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
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Upgrade to Premium
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Premium Features Teaser */}
        {variant === 'standard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <Crown className="h-8 w-8 text-purple-500" />
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle>Premium Command Center</CardTitle>
                <CardDescription>
                  Advanced country management with real-time decision support
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>• Real-time crisis monitoring</div>
                  <div>• Strategic decision recommendations</div>
                  <div>• Premium briefings & alerts</div>
                </div>
                <Link href={createUrl("/mycountry/premium")} className="block mt-4">
                  <Button variant="outline" className="w-full">
                    <ArrowUp className="h-4 w-4 mr-2" />
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
                    <Badge variant="outline" className="text-xs">PREVIEW</Badge>
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <CardTitle>Intelligence Briefings</CardTitle>
                <CardDescription>
                  AI-powered insights and predictive analytics
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div>• National performance analysis</div>
                  <div>• Forward-looking intelligence</div>
                  <div>• Risk assessment & mitigation</div>
                </div>
                <Link href={createUrl("/mycountry/premium")} className="block">
                  <Button variant="outline" className="w-full">
                    <ArrowUp className="h-4 w-4 mr-2" />
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
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>
                  Deep economic modeling and scenario planning
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>• Multi-year projections</div>
                  <div>• Policy impact simulation</div>
                  <div>• Comparative benchmarking</div>
                </div>
                <Link href={createUrl("/mycountry/premium")} className="block mt-4">
                  <Button variant="outline" className="w-full">
                    <ArrowUp className="h-4 w-4 mr-2" />
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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      {renderTabsList()}

      {/* Executive Command Center Tab */}
      {(variant === 'premium' || variant === 'unified') && (
        <TabsContent value="executive">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <CountryExecutiveSection countryId={country.id} userId={user?.id} />
          </ThemedTabContent>
        </TabsContent>
      )}

      {/* Intelligence Tab */}
      {(variant === 'premium' || variant === 'unified') && (
        <TabsContent value="intelligence">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <LiveIntelligenceSection 
              countryId={country.id} 
              country={{
                name: country.name,
                economicTier: country.economicTier,
                currentGdpPerCapita: country.currentGdpPerCapita,
                currentTotalGdp: country.currentTotalGdp || (country.currentPopulation * country.currentGdpPerCapita),
                currentPopulation: country.currentPopulation,
                populationTier: country.populationTier,
                populationGrowthRate: country.populationGrowthRate,
                adjustedGdpGrowth: country.adjustedGdpGrowth,
                populationDensity: country.populationDensity ?? undefined,
                landArea: country.landArea,
                continent: country.continent,
                region: country.region,
              }}
            />
          </ThemedTabContent>
        </TabsContent>
      )}

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
          {/* Government Sub-Tabs */}
          <Tabs defaultValue="structure" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
              <TabsTrigger value="structure" className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                <span className="hidden sm:inline">Structure & Branches</span>
                <span className="sm:hidden">Structure</span>
              </TabsTrigger>
              <TabsTrigger value="spending" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Spending & Budget</span>
                <span className="sm:hidden">Budget</span>
              </TabsTrigger>
              <TabsTrigger value="fiscal" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">Fiscal System</span>
                <span className="sm:hidden">Fiscal</span>
              </TabsTrigger>
            </TabsList>

            {/* Structure & Branches Tab */}
            <TabsContent value="structure" className="space-y-6">
              <div className="animate-in slide-in-from-bottom-4 duration-700">
                {country?.id ? (
                  <GovernmentStructureDisplay 
                    countryId={country.id} 
                    variant="full" 
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
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
                  fiscalData={economyData?.fiscal ?? {
                    taxRevenueGDPPercent: 0, governmentRevenueTotal: 0, taxRevenuePerCapita: 0,
                    governmentBudgetGDPPercent: 0, budgetDeficitSurplus: 0, internalDebtGDPPercent: 0,
                    externalDebtGDPPercent: 0, totalDebtGDPRatio: 0, debtPerCapita: 0,
                    interestRates: 0, debtServiceCosts: 0,
                    taxRates: { personalIncomeTaxRates: [], corporateTaxRates: [], salesTaxRate: 0, propertyTaxRate: 0, payrollTaxRate: 0, exciseTaxRates: [], wealthTaxRate: 0 },
                    governmentSpendingByCategory: [],
                  }}
                  nominalGDP={economyData?.core?.nominalGDP ?? 0}
                  totalPopulation={economyData?.core?.totalPopulation ?? 0}
                  onFiscalDataChange={() => {}}
                  isReadOnly={true}
                  showAnalytics={variant === 'premium'}
                  governmentStructure={governmentStructure}
                  countryId={country?.id}
                />
              </div>
            </TabsContent>
          </Tabs>
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
            onDemographicDataChangeAction={() => {}}
          />
        </ThemedTabContent>
      </TabsContent>

      {/* Advanced Analytics Tab */}
      {(variant === 'premium' || variant === 'unified') && (
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
                          unemployment: 5.0,
                          inflation: 2.5,
                          taxRevenue: 25.0,
                          debtToGdp: 60.0,
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
      )}

      {/* Render premium upgrade teaser */}
      {renderPremiumUpgradeTeaser()}
    </Tabs>
  );
}