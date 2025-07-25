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
import { CountryIntelligenceSection } from "~/app/countries/_components/CountryIntelligenceSection";
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
import { AlertTriangle, Settings, Crown, Save, Edit, BarChart3, Users, DollarSign, Shield, Clock, TrendingUp, Activity } from "lucide-react";
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

function MyCountryContent() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  // FIX 1: Moved state declaration before it's used in hooks.
  const [activeTab, setActiveTab] = useState("overview");

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: country, isLoading: countryLoading, refetch: refetchCountry } = api.countries.getByIdWithEconomicData.useQuery(
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
    { enabled: activeTab === 'detailed' } 
  );
  
  // FIX 2: Corrected the parameters for getForecast to match the API definition.
  // The original call used 'years', which is not a valid parameter according to the error.
  // We now calculate a 10-year window for the forecast.
  const now = new Date();
  const forecastStartTime = now.getTime();
  const forecastEndTime = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate()).getTime();

  const { data: forecast, isLoading: forecastLoading } = api.countries.getForecast.useQuery(
    { id: country?.id || '', startTime: forecastStartTime, endTime: forecastEndTime },
    { enabled: !!country?.id && activeTab === 'detailed' }
  );

  const [editMode, setEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const economyData = country ? generateEconomicDataForCountry(country) : undefined;
  const [editedEconomyData, setEditedEconomyData] = useState(economyData);

  useEffect(() => {
    setEditedEconomyData(economyData);
    setEditMode(false);
    setHasUnsavedChanges(false);
  }, [country]);

  const updateEconomicDataMutation = api.countries.updateEconomicData.useMutation({
    onSuccess: () => {
      refetchCountry();
      setHasUnsavedChanges(false);
      setEditMode(false);
    }
  });

  const handleSectionChange = (section: string, newData: any) => {
    setEditedEconomyData((prev: any) => ({
      ...prev,
      [section]: { ...prev?.[section], ...newData },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!country || !editedEconomyData) return;
    try {
      await updateEconomicDataMutation.mutateAsync({
        countryId: country.id,
        economicData: {
          ...editedEconomyData.core,
          ...editedEconomyData.labor,
          ...editedEconomyData.fiscal,
          ...editedEconomyData.spending,
          ...editedEconomyData.income,
          ...editedEconomyData.demographics,
        },
      });
    } catch (error) {
      console.error('Failed to save economic data:', error);
    }
  };

  const handleCancel = () => {
    setEditedEconomyData(economyData);
    setEditMode(false);
    setHasUnsavedChanges(false);
  };

  useEffect(() => {
    if (isLoaded && !user) {
      const returnUrl = encodeURIComponent(createUrl('/mycountry'));
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Crown className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold">MyCountry: {country.name}</h1>
            <p className="text-muted-foreground">Executive Dashboard & Management Center</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href={createUrl(`/countries/${country.id}`)}>
            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Public View
            </Button>
          </Link>
          <Badge variant="outline">{country.economicTier}</Badge>
          <Badge variant="outline">Tier {country.populationTier}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-base font-bold text-blue-600">{(country.currentPopulation / 1000000).toFixed(1)}M</div>
                  <div className="text-xs text-muted-foreground">Population</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Current Population</div>
                  <div className="text-xs text-muted-foreground">
                    Total population: {country.currentPopulation.toLocaleString()} citizens
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Population Tier: {country.populationTier}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-3 border rounded-lg bg-green-50 dark:bg-green-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-base font-bold text-green-600">${(country.currentGdpPerCapita / 1000).toFixed(0)}k</div>
                  <div className="text-xs text-muted-foreground">GDP/Capita</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">GDP per Capita</div>
                  <div className="text-xs text-muted-foreground">
                    ${country.currentGdpPerCapita.toLocaleString()} per person
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Economic strength indicator
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-3 border rounded-lg bg-purple-50 dark:bg-purple-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-base font-bold text-purple-600">{(country.adjustedGdpGrowth * 100).toFixed(2)}%</div>
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
                <div className="text-center p-3 border rounded-lg bg-orange-50 dark:bg-orange-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-base font-bold text-orange-600">{country.economicTier}</div>
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
                <div className="text-center p-3 border rounded-lg bg-pink-50 dark:bg-pink-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-base font-bold text-pink-600">T{country.populationTier}</div>
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
                <div className="text-center p-3 border rounded-lg bg-cyan-50 dark:bg-cyan-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-base font-bold text-cyan-600">{new Date().toLocaleDateString()}</div>
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

      <CrisisStatusBanner countryId={country.id} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Unsaved Changes
            </Badge>
          )}
          {editMode && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Edit className="h-3 w-3" />
              Edit Mode
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button 
                onClick={handleSave} 
                disabled={!hasUnsavedChanges || updateEconomicDataMutation.isPending}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updateEconomicDataMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setEditMode(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Data
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-9 min-w-fit">
            <TabsTrigger value="overview" className="flex items-center gap-1 text-xs lg:text-sm">
              <BarChart3 className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Over</span>
            </TabsTrigger>
            <TabsTrigger value="executive" className="flex items-center gap-1 text-xs lg:text-sm">
              <Crown className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Executive</span>
              <span className="sm:hidden">Exec</span>
            </TabsTrigger>
            <TabsTrigger value="economy" className="flex items-center gap-1 text-xs lg:text-sm">
              <DollarSign className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Economy</span>
              <span className="sm:hidden">Econ</span>
            </TabsTrigger>
            <TabsTrigger value="labor" className="flex items-center gap-1 text-xs lg:text-sm">
              <Users className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Labor</span>
              <span className="sm:hidden">Lab</span>
            </TabsTrigger>
            <TabsTrigger value="government" className="flex items-center gap-1 text-xs lg:text-sm">
              <Settings className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Government</span>
              <span className="sm:hidden">Gov</span>
            </TabsTrigger>
            <TabsTrigger value="demographics" className="flex items-center gap-1 text-xs lg:text-sm">
              <Users className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Demographics</span>
              <span className="sm:hidden">Demo</span>
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="flex items-center gap-1 text-xs lg:text-sm">
              <Shield className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Intelligence</span>
              <span className="sm:hidden">Intel</span>
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex items-center gap-1 text-xs lg:text-sm">
              <Activity className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Detailed</span>
              <span className="sm:hidden">Detail</span>
            </TabsTrigger>
            <TabsTrigger value="modeling" className="flex items-center gap-1 text-xs lg:text-sm">
              <BarChart3 className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">Modeling</span>
              <span className="sm:hidden">Model</span>
            </TabsTrigger>
          </TabsList>
        </div>

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

        <TabsContent value="executive">
          <CountryExecutiveSection countryId={country.id} userId={user?.id} />
        </TabsContent>

        <TabsContent value="economy" className="space-y-6">
          <div className="animate-in slide-in-from-bottom-4 duration-700">
            <CoreEconomicIndicators
              indicators={editedEconomyData?.core ?? { 
                totalPopulation: 0, nominalGDP: 0, gdpPerCapita: 0, 
                realGDPGrowthRate: 0, inflationRate: 0, currencyExchangeRate: 0 
              }}
              onIndicatorsChangeAction={editMode ? (data) => handleSectionChange('core', data) : () => {}}
              isReadOnly={!editMode}
              showComparison={true}
            />
          </div>
          
          <div className="animate-in slide-in-from-bottom-4 duration-700 delay-200">
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
        </TabsContent>

        <TabsContent value="labor">
          <LaborEmployment
            laborData={editedEconomyData?.labor ?? { 
              laborForceParticipationRate: 0, employmentRate: 0, unemploymentRate: 0, 
              totalWorkforce: 0, averageWorkweekHours: 0, minimumWage: 0, 
              averageAnnualIncome: 0, employmentBySector: { agriculture: 0, industry: 0, services: 0 }, 
              employmentByType: { fullTime: 0, partTime: 0, temporary: 0, selfEmployed: 0, informal: 0 }, 
              skillsAndProductivity: { averageEducationYears: 0, tertiaryEducationRate: 0, vocationalTrainingRate: 0, skillsGapIndex: 0, laborProductivityIndex: 0, productivityGrowthRate: 0 }, 
              demographicsAndConditions: { youthUnemploymentRate: 0, femaleParticipationRate: 0, genderPayGap: 0, unionizationRate: 0, workplaceSafetyIndex: 0, averageCommutingTime: 0 }, 
              regionalEmployment: { urban: { participationRate: 0, unemploymentRate: 0, averageIncome: 0 }, rural: { participationRate: 0, unemploymentRate: 0, averageIncome: 0 } }, 
              socialProtection: { unemploymentBenefitCoverage: 0, pensionCoverage: 0, healthInsuranceCoverage: 0, paidSickLeaveDays: 0, paidVacationDays: 0, parentalLeaveWeeks: 0 } 
            }}
            totalPopulation={editedEconomyData?.core?.totalPopulation ?? 0}
            onLaborDataChangeAction={editMode ? (data) => handleSectionChange('labor', data) : () => {}}
            isReadOnly={!editMode}
            showComparison={true}
          />
        </TabsContent>

        <TabsContent value="government" className="space-y-6">
          <FiscalSystemComponent
            fiscalData={editedEconomyData?.fiscal ?? {
              taxRevenueGDPPercent: 0, governmentRevenueTotal: 0, taxRevenuePerCapita: 0,
              governmentBudgetGDPPercent: 0, budgetDeficitSurplus: 0, internalDebtGDPPercent: 0,
              externalDebtGDPPercent: 0, totalDebtGDPRatio: 0, debtPerCapita: 0,
              interestRates: 0, debtServiceCosts: 0,
              taxRates: { personalIncomeTaxRates: [], corporateTaxRates: [], salesTaxRate: 0, propertyTaxRate: 0, payrollTaxRate: 0, exciseTaxRates: [], wealthTaxRate: 0 },
              governmentSpendingByCategory: [],
            }}
            nominalGDP={editedEconomyData?.core?.nominalGDP ?? 0}
            totalPopulation={editedEconomyData?.core?.totalPopulation ?? 0}
            onFiscalDataChange={editMode ? (data) => handleSectionChange('fiscal', data) : () => {}}
            isReadOnly={!editMode}
            showAnalytics={true}
          />
          
          <GovernmentSpending
            totalSpending={editedEconomyData?.spending?.totalSpending ?? 0}
            spendingGDPPercent={editedEconomyData?.spending?.spendingGDPPercent ?? 0}
            spendingPerCapita={editedEconomyData?.spending?.spendingPerCapita ?? 0}
            spendingCategories={editedEconomyData?.spending?.spendingCategories ?? []}
            deficitSurplus={editedEconomyData?.spending?.deficitSurplus ?? 0}
            nominalGDP={editedEconomyData?.core?.nominalGDP ?? 0}
            totalPopulation={editedEconomyData?.core?.totalPopulation ?? 0}
            onSpendingDataChangeAction={editMode ? (data) => handleSectionChange('spending', data) : () => {}}
            isReadOnly={!editMode}
          />
        </TabsContent>

        <TabsContent value="demographics">
          <Demographics
            demographicData={{
              ...editedEconomyData?.demographics,
              ageDistribution: editedEconomyData?.demographics?.ageDistribution ?? [],
            } as any}
            totalPopulation={editedEconomyData?.core?.totalPopulation ?? 0}
            onDemographicDataChangeAction={editMode ? (data) => handleSectionChange('demographics', data) : () => {}}
          />
        </TabsContent>

        <TabsContent value="intelligence">
          <CountryIntelligenceSection countryId={country.id} />
        </TabsContent>

        <TabsContent value="detailed" className="space-y-6">
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
                      
                      {/* FIX 3: The properties 'projected2040GdpPerCapita' and 'projected2040Population' 
                          do not exist on the 'forecast' object according to the TypeScript error.
                          This section has been updated to reflect the available data or show a message.
                          If these properties ARE expected, the tRPC client-side types may need to be updated. */}
                      {forecast ? (
                        <div>
                          <h4 className="text-sm font-medium mb-3">10-Year Projections</h4>
                          <div className="p-4 border rounded-lg">
                             <p className="text-muted-foreground">Forecast data is available but detailed projections for 2040 are not provided in the current data structure.</p>
                             {/* You can map over `forecast.forecast` array here if needed */}
                          </div>
                        </div>
                      ) : (
                         <p>No forecast data available.</p>
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

            <div className="animate-in slide-in-from-bottom-4 duration-700 delay-500">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Economic Timeline & Events
                  </CardTitle>
                  <CardDescription>
                    Track significant economic events and their impact on {country.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {historicalLoading ? (
                    <div className="space-y-4">
                      <div className="h-4 bg-muted animate-pulse rounded" />
                      <div className="h-20 bg-muted animate-pulse rounded" />
                      <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                    </div>
                  ) : historicalData && historicalData.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm font-medium text-muted-foreground mb-2">First Recorded Data</div>
                          <div className="text-base font-semibold">
                            {new Date(historicalData[0]?.ixTimeTimestamp || 0).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            GDP/Capita: ${((historicalData[0]?.gdpPerCapita || 0) / 1000).toFixed(0)}k
                          </div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm font-medium text-muted-foreground mb-2">Latest Data Point</div>
                          <div className="text-base font-semibold">
                            {new Date(historicalData[historicalData.length - 1]?.ixTimeTimestamp || 0).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            GDP/Capita: ${((historicalData[historicalData.length - 1]?.gdpPerCapita || 0) / 1000).toFixed(0)}k
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-3">Economic Milestones</h4>
                        <div className="space-y-3">
                          {historicalData.slice(0, 5).map((point, index) => (
                            <div key={index} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              <div className="flex-1">
                                <div className="text-sm font-medium">
                                  {new Date(point.ixTimeTimestamp).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Population: {(point.population / 1000000).toFixed(1)}M, 
                                  GDP/Capita: ${(point.gdpPerCapita / 1000).toFixed(0)}k
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="mb-2">No Timeline Data</p>
                      <p className="text-sm">Historical timeline will be populated as economic events are recorded.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="modeling">
          <Card>
            <CardContent className="p-8 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Advanced Economic Modeling</h3>
              <p className="text-muted-foreground mb-4">
                Access advanced economic modeling tools, scenario planning, and predictive analytics.
              </p>
              <Link href={createUrl(`/countries/${country.id}/modeling`)}>
                <Button>Open Modeling Suite</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function MyCountryPage() {
  useEffect(() => {
    document.title = "My Country - IxStats";
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

  return <MyCountryContent />;
}
