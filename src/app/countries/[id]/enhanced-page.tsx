"use client";

import { use } from "react";
import { api } from "~/trpc/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CountryAtGlance } from "~/app/countries/_components/detail";
import { 
  AlertTriangle, 
  Eye, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Globe, 
  BarChart3, 
  Activity,
  Briefcase,
  Building,
  PieChart,
  Edit
} from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";
import { createUrl } from "~/lib/url-utils";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { HealthRing } from "~/components/ui/health-ring";
import { getFlagColors, generateFlagThemeCSS } from "~/lib/flag-color-extractor";

// Import economy components for migration
import { CoreEconomicIndicatorsComponent } from "~/app/builder/components/CoreEconomicIndicators";
import { LaborEmploymentComponent } from "~/app/builder/components/LaborEmployment";
import { FiscalSystemComponent } from "~/app/builder/components/FiscalSystem";
import { GovernmentSpending } from "~/app/builder/components/GovernmentSpending";
import { Demographics } from "~/app/builder/components/Demographics";
import { EconomicSummaryWidget } from "~/app/countries/_components/economy";
import { generateCountryEconomicData, type CountryProfile } from "~/lib/economic-data-templates";

interface EnhancedPublicCountryPageProps {
  params: Promise<{ id: string }>;
}

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

export default function EnhancedPublicCountryPage({ params }: EnhancedPublicCountryPageProps) {
  const { id } = use(params);
  const { user } = useUser();
  
  const { data: country, isLoading, error } = api.countries.getByIdAtTime.useQuery(
    { id },
    { 
      retry: false
    }
  );
  const { data: systemStatus } = api.admin.getSystemStatus.useQuery();
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : 0;
  const isOwnCountry = userProfile?.countryId && country?.id && userProfile.countryId === country.id;

  // Generate economic data for tabs
  const economicData = country ? generateEconomicDataForCountry(country) : null;

  // Activity rings data
  const activityData = [
    {
      label: "Economic Health",
      value: country ? Math.min(100, (((country as any).currentGdpPerCapita || (country as any).baselineGdpPerCapita || 0) / 50000) * 100) : 0,
      color: "#22c55e",
      icon: DollarSign,
    },
    {
      label: "Population Growth",
      value: country ? Math.min(100, Math.max(0, (((country as any).populationGrowthRate || 0.01) * 100 + 2) * 25)) : 0,
      color: "#3b82f6", 
      icon: Users,
    },
    {
      label: "Development Index",
      value: country ? Math.min(100, (((country as any).currentGdpPerCapita || (country as any).baselineGdpPerCapita || 0) / 80000) * 100) : 0,
      color: "#8b5cf6",
      icon: TrendingUp,
    },
  ];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Country Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The requested country could not be found or you don't have permission to view it.
            </p>
            <Link href={createUrl("/countries")}>
              <Button>Browse Countries</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const flagColors = getFlagColors(country.name);
  const flagThemeCSS = generateFlagThemeCSS(flagColors);

  return (
    <div 
      className="container mx-auto px-4 py-8 space-y-6 country-themed"
      style={flagThemeCSS}
    >
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={createUrl("/countries")}>Countries</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{country.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header with Country Name and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{country.name}</h1>
          <div className="flex gap-2">
            <Badge variant="outline">{(country as any).economicTier || 'Unknown'}</Badge>
            <Badge variant="outline">Tier {(country as any).populationTier || 'Unknown'}</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isOwnCountry && (
            <>
              <Link href={createUrl("/mycountry/editor")}>
                <Button variant="outline" className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Data
                </Button>
              </Link>
              <Link href={createUrl("/mycountry")}>
                <Button className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  My Country Dashboard
                </Button>
              </Link>
            </>
          )}
          <Button variant="outline" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {(country as any).analytics?.visits || Math.floor(Math.random() * 1000) + 100} views
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar - RETAINED from original */}
        <div className="space-y-6">
          {/* Activity Rings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" style={{ color: flagColors.primary }} />
                National Vitality
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {activityData.map((ring) => (
                  <div key={ring.label} className="flex items-center gap-4">
                    <HealthRing
                      value={Number(ring.value)}
                      size={80}
                      color={ring.color}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <ring.icon className="h-4 w-4" style={{ color: ring.color }} />
                        <span className="font-medium">{ring.label}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {ring.value.toFixed(1)}% performance
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" style={{ color: flagColors.secondary }} />
                Key Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Population</span>
                  <span className="font-semibold">{formatPopulation((country as any).currentPopulation || (country as any).baselinePopulation || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total GDP</span>
                  <span className="font-semibold">{formatCurrency((country as any).currentTotalGdp || (country as any).nominalGDP || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">GDP per Capita</span>
                  <span className="font-semibold">{formatCurrency((country as any).currentGdpPerCapita || (country as any).baselineGdpPerCapita || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Growth Rate</span>
                  <span className="font-semibold">{(((country as any).adjustedGdpGrowth || 0) * 100).toFixed(2)}%</span>
                </div>
                {(country as any).populationDensity && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pop. Density</span>
                    <span className="font-semibold">{((country as any).populationDensity || 0).toFixed(1)}/km²</span>
                  </div>
                )}
                {(country as any).landArea && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Land Area</span>
                    <span className="font-semibold">{((country as any).landArea || 0).toLocaleString()} km²</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Country Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" style={{ color: flagColors.accent }} />
                Country Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {country.continent && (
                  <div>
                    <span className="text-sm text-muted-foreground">Location:</span>
                    <p className="font-medium">
                      {country.region ? `${country.region}, ${country.continent}` : country.continent}
                    </p>
                  </div>
                )}
                {country.governmentType && (
                  <div>
                    <span className="text-sm text-muted-foreground">Government:</span>
                    <p className="font-medium">{country.governmentType}</p>
                  </div>
                )}
                {country.leader && (
                  <div>
                    <span className="text-sm text-muted-foreground">Leader:</span>
                    <p className="font-medium">{country.leader}</p>
                  </div>
                )}
                {country.religion && (
                  <div>
                    <span className="text-sm text-muted-foreground">Primary Religion:</span>
                    <p className="font-medium">{country.religion}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area - NEW TABBED INTERFACE */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview" className="space-y-4">
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

            {/* Overview Tab - Original CountryAtGlance */}
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
                isLoading={isLoading} 
              />

              {/* Recent Activity/Updates */}
              {country.analytics && country.analytics.riskFlags?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Recent Developments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {country.analytics.riskFlags.slice(0, 3).map((flag: string, i: number) => (
                        <div key={`risk-${i}-${flag}`} className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded border-l-4 border-yellow-400">
                          <p className="text-sm">{flag.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {IxTime.formatIxTime(currentIxTime, true)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Economy Tab - Migrated from MyCountry */}
            <TabsContent value="economy" className="space-y-6">
              {economicData && (
                <>
                  <EconomicSummaryWidget 
                    countryName={country.name}
                    data={{
                      population: economicData.core.totalPopulation,
                      gdpPerCapita: economicData.core.gdpPerCapita,
                      totalGdp: economicData.core.nominalGDP,
                      economicTier: country.economicTier || "Developing",
                      populationGrowthRate: country.populationGrowthRate || 0.01,
                      gdpGrowthRate: country.realGDPGrowthRate || country.adjustedGdpGrowth || 0.03,
                      unemploymentRate: economicData.labor.unemploymentRate,
                      laborForceParticipationRate: economicData.labor.laborForceParticipationRate,
                      taxRevenueGDPPercent: economicData.fiscal.taxRevenueGDPPercent,
                      budgetBalance: economicData.fiscal.budgetDeficitSurplus,
                      debtToGDP: economicData.fiscal.totalDebtGDPRatio,
                      populationDensity: country.populationDensity,
                      gdpDensity: country.gdpDensity,
                      landArea: country.landArea,
                    }}
                  />
                  <CoreEconomicIndicatorsComponent 
                    indicators={economicData.core}
                    onIndicatorsChangeAction={() => {}}
                    isReadOnly={true}
                    showComparison={false}
                  />
                </>
              )}
            </TabsContent>

            {/* Labor Tab - Migrated from MyCountry */}
            <TabsContent value="labor" className="space-y-6">
              {economicData && (
                <LaborEmploymentComponent 
                  laborData={economicData.labor}
                  totalPopulation={economicData.core.totalPopulation}
                  onLaborDataChangeAction={() => {}}
                  isReadOnly={true}
                  showComparison={false}
                />
              )}
            </TabsContent>

            {/* Government Tab - Migrated from MyCountry */}
            <TabsContent value="government" className="space-y-6">
              {economicData && (
                <>
                  <GovernmentSpending 
                    spendingData={economicData.spending}
                    nominalGDP={economicData.core.nominalGDP}
                    totalPopulation={economicData.core.totalPopulation}
                    onSpendingDataChangeAction={() => {}}
                    isReadOnly={true}
                  />
                  <FiscalSystemComponent 
                    fiscalData={economicData.fiscal}
                    referenceCountry={{
                      name: "Reference",
                      countryCode: "REF",
                      gdp: economicData.core.nominalGDP,
                      gdpPerCapita: economicData.core.gdpPerCapita,
                      taxRevenuePercent: economicData.fiscal.taxRevenueGDPPercent,
                      unemploymentRate: economicData.labor.unemploymentRate,
                      population: economicData.core.totalPopulation
                    }}
                    nominalGDP={economicData.core.nominalGDP}
                    totalPopulation={economicData.core.totalPopulation}
                    onFiscalDataChange={() => {}}
                  />
                </>
              )}
            </TabsContent>

            {/* Demographics Tab - Migrated from MyCountry */}
            <TabsContent value="demographics" className="space-y-6">
              {economicData && (
                <Demographics 
                  demographicData={{
                    ...economicData.demographics,
                    ageDistribution: economicData.demographics.ageDistribution || [],
                  } as any}
                  totalPopulation={economicData.core.totalPopulation}
                  onDemographicDataChange={() => {}}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}