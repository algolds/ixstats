"use client";

import { useUser } from "@clerk/nextjs";

// Force dynamic rendering to avoid SSG issues with Clerk
export const dynamic = 'force-dynamic';
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
  IncomeWealthDistribution,
  Demographics,
  EconomicSummaryWidget,
  HistoricalEconomicTracker
} from "~/app/countries/_components/economy";
import { generateCountryEconomicData, type CountryProfile } from "~/lib/economic-data-templates";
import { AlertTriangle, Settings, Crown, Save, Edit, BarChart3, Users, DollarSign, Shield, Clock } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { Alert, AlertDescription } from "~/components/ui/alert";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import type { 
  CoreEconomicIndicatorsData, 
  LaborEmploymentData, 
  FiscalSystemData, 
  IncomeWealthDistributionData, 
  GovernmentSpendingData, 
  DemographicsData 
} from "~/types/economics";

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

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Economic data state
  const economyData = country ? generateEconomicDataForCountry(country) : undefined;
  const [editedEconomyData, setEditedEconomyData] = useState(economyData);

  // Update edited data when country changes
  useEffect(() => {
    setEditedEconomyData(economyData);
    setEditMode(false);
    setHasUnsavedChanges(false);
  }, [country]);

  // Mutations
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

  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !user) {
      const returnUrl = encodeURIComponent(createUrl('/mycountry'));
      window.location.href = `https://accounts.ixwiki.com/sign-in?redirect_url=${returnUrl}`;
    }
  }, [isLoaded, user, router]);

  // Loading states
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

  // No country assigned
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

  // Country not found
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
      {/* Header */}
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

      {/* Compact Status Bar with better spacing */}
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
                  <div className="text-xs text-white/80">
                    Total population: {country.currentPopulation.toLocaleString()} citizens
                  </div>
                  <div className="text-xs text-blue-200">
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
                  <div className="text-xs text-white/80">
                    ${country.currentGdpPerCapita.toLocaleString()} per person
                  </div>
                  <div className="text-xs text-green-200">
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
                  <div className="text-xs text-white/80">
                    Adjusted GDP growth rate after global factors
                  </div>
                  <div className="text-xs text-purple-200">
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
                  <div className="text-xs text-white/80">
                    Based on GDP per capita and economic indicators
                  </div>
                  <div className="text-xs text-orange-200">
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
                  <div className="text-xs text-white/80">
                    Classification based on total population size
                  </div>
                  <div className="text-xs text-pink-200">
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
                  <div className="text-xs text-white/80">
                    Most recent calculation: {new Date().toLocaleString()}
                  </div>
                  <div className="text-xs text-cyan-200">
                    Data refreshed automatically
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Crisis Status */}
      <CrisisStatusBanner countryId={country.id} />

      {/* Edit Controls */}
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

      {/* Main Dashboard with Responsive Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 min-w-fit">
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
          
          {/* Economic Summary */}
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
        </TabsContent>

        <TabsContent value="executive">
          <CountryExecutiveSection countryId={country.id} userId={user?.id} />
        </TabsContent>

        <TabsContent value="economy" className="space-y-6">
          <CoreEconomicIndicators
            indicators={editedEconomyData?.core ?? { 
              totalPopulation: 0, nominalGDP: 0, gdpPerCapita: 0, 
              realGDPGrowthRate: 0, inflationRate: 0, currencyExchangeRate: 0 
            }}
            onIndicatorsChangeAction={editMode ? (data) => handleSectionChange('core', data) : () => {}}
            isReadOnly={!editMode}
            showComparison={true}
          />
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

  // Show message when Clerk is not configured
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