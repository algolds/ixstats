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
import { generateCountryEconomicData, type CountryProfile } from "~/lib/economic-data-templates";
import { HealthRing } from "~/components/ui/health-ring";
import { 
  AlertTriangle, 
  Crown, 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Briefcase, 
  Building, 
  PieChart, 
  Edit,
  ArrowUp,
  Lock,
  Sparkles,
  DollarSign,
  Users,
  Shield
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { Alert, AlertDescription } from "~/components/ui/alert";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

// Force dynamic rendering to avoid SSG issues with Clerk
export const dynamic = 'force-dynamic';

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

function MyCountryStandardContent() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("overview");

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: systemStatus, isLoading: systemStatusLoading } = api.admin.getSystemStatus.useQuery();
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : 0;

  // Get country data with economic information
  const { data: country, isLoading: countryLoading } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Get activity rings data using live country data
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id }
  );

  const economyData = country ? generateEconomicDataForCountry(country) : undefined;

  useEffect(() => {
    if (isLoaded && !user) {
      const returnUrl = encodeURIComponent(createUrl('/mycountry/standard'));
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Crown className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">MyCountry: {country.name}</h1>
            <p className="text-muted-foreground">Standard Dashboard & Analytics</p>
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

      {/* Key Metrics Cards */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-xl font-bold text-blue-600">{((country?.currentPopulation || 0) / 1000000).toFixed(1)}M</div>
                  <div className="text-sm text-muted-foreground">Population</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Current Population</div>
                  <div className="text-xs text-muted-foreground">
                    Total: {(country?.currentPopulation || 0).toLocaleString()} citizens
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-xl font-bold text-green-600">${((country?.currentGdpPerCapita || 0) / 1000).toFixed(0)}k</div>
                  <div className="text-sm text-muted-foreground">GDP/Capita</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">GDP per Capita</div>
                  <div className="text-xs text-muted-foreground">
                    ${(country?.currentGdpPerCapita || 0).toLocaleString()} per person
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-xl font-bold text-purple-600">{((country?.adjustedGdpGrowth || 0) * 100).toFixed(2)}%</div>
                  <div className="text-sm text-muted-foreground">Growth</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Economic Growth Rate</div>
                  <div className="text-xs text-muted-foreground">
                    Adjusted GDP growth rate
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="text-xl font-bold text-orange-600">{country.economicTier || "Unknown"}</div>
                  <div className="text-sm text-muted-foreground">Economic Tier</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Economic Development Tier</div>
                  <div className="text-xs text-muted-foreground">
                    Current: {country.economicTier}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* National Vitality Section */}
      {activityRingsData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <CardTitle>National Vitality</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">LIVE DATA</Badge>
            </div>
            <CardDescription>Real-time assessment of key national performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  label: "Economic Health",
                  value: activityRingsData.economicVitality || 0,
                  color: "#22c55e",
                  icon: DollarSign,
                },
                {
                  label: "Population Wellbeing",
                  value: activityRingsData.populationWellbeing || 0,
                  color: "#3b82f6", 
                  icon: Users,
                },
                {
                  label: "Diplomatic Standing",
                  value: activityRingsData.diplomaticStanding || 0,
                  color: "#a855f7",
                  icon: Shield,
                },
                {
                  label: "Government Efficiency",
                  value: activityRingsData.governmentalEfficiency || 0,
                  color: "#f97316",
                  icon: Building,
                },
              ].map((ring, index) => (
                <div key={index} className="flex flex-col items-center text-center gap-3">
                  <HealthRing
                    value={Number(ring.value)}
                    size={80}
                    color={ring.color}
                    className="flex-shrink-0"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <ring.icon className="h-4 w-4" style={{ color: ring.color }} />
                      <span className="font-medium text-sm">{ring.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ring.value.toFixed(1)}% performance
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link href={createUrl("/mycountry/premium")}>
                <Button variant="outline" className="bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Upgrade for Advanced Intelligence
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Crisis Status Banner */}
      <CrisisStatusBanner countryId={country.id} />

      {/* Upgrade to Premium Banner */}
      <Card className="border-gradient-to-r from-purple-500/20 to-blue-500/20 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
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

      {/* Standard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="economy" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Economy
          </TabsTrigger>
          <TabsTrigger value="labor" className="flex items-center gap-1">
            <Briefcase className="h-4 w-4" />
            Labor
          </TabsTrigger>
          <TabsTrigger value="government" className="flex items-center gap-1">
            <Building className="h-4 w-4" />
            Government
          </TabsTrigger>
          <TabsTrigger value="demographics" className="flex items-center gap-1">
            <PieChart className="h-4 w-4" />
            Demographics
          </TabsTrigger>
        </TabsList>

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
          <EconomicSummaryWidget 
            countryName={country.name} 
            data={{
              population: economyData?.core.totalPopulation ?? 0,
              gdpPerCapita: economyData?.core.gdpPerCapita ?? 0,
              totalGdp: economyData?.core.nominalGDP ?? 0,
              economicTier: country.economicTier || "Developing",
              populationGrowthRate: country.populationGrowthRate || 0.01,
              gdpGrowthRate: country.realGDPGrowthRate || country.adjustedGdpGrowth || 0.03,
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
          
          <CoreEconomicIndicators
            indicators={economyData?.core ?? { 
              totalPopulation: 0, nominalGDP: 0, gdpPerCapita: 0, 
              realGDPGrowthRate: 0, inflationRate: 0, currencyExchangeRate: 0 
            }}
            onIndicatorsChangeAction={() => {}}
            isReadOnly={true}
            showComparison={true}
          />
        </TabsContent>

        {/* Labor Tab */}
        <TabsContent value="labor" className="space-y-6">
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
        </TabsContent>

        {/* Government Tab */}
        <TabsContent value="government" className="space-y-6">
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
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics">
          <Demographics
            demographicData={{
              ...economyData?.demographics,
              ageDistribution: economyData?.demographics?.ageDistribution ?? [],
            } as any}
            totalPopulation={economyData?.core?.totalPopulation ?? 0}
            onDemographicDataChange={() => {}}
          />
        </TabsContent>
      </Tabs>

      {/* Premium Features Teaser */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
    </div>
  );
}

export default function MyCountryStandardPage() {
  useEffect(() => {
    document.title = "MyCountry Standard - IxStats";
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

  return <MyCountryStandardContent />;
}