// src/app/countries/[id]/page.tsx
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CountryInfobox } from "~/app/countries/_components/CountryInfobox";
import { CountryAtGlance } from "~/app/countries/_components/detail";
import {
  ComparativeAnalysis,
  CoreEconomicIndicators,
  EconomicDataDisplay,
  EconomicModelingEngine,
  EconomicSummaryWidget,
  HistoricalEconomicTracker,
  LaborEmployment,
} from "~/app/countries/_components/economy";
import { IncomeWealthDistribution, Demographics, FiscalSystemComponent, GovernmentSpending } from "~/app/countries/_components/economy";
import { IxTimeCalendar } from "~/app/countries/_components/charts/IxTimeCalendar";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, Info } from "lucide-react";
import { formatNumber, formatGrowthRateFromDecimal } from "~/lib/chart-utils";
import { Alert, AlertDescription } from "~/components/ui/alert";
import React from "react";
import type { 
  CoreEconomicIndicatorsData, 
  LaborEmploymentData, 
  FiscalSystemData, 
  IncomeWealthDistributionData, 
  GovernmentSpendingData, 
  DemographicsData 
} from "~/types/economics";
import { 
  generateCountryEconomicData, 
  type CountryProfile 
} from "~/lib/economic-data-templates";

// Helper function to compute economic health
function computeHealth(g: number, i: number) {
  if (g > 0.04 && i < 0.03) return { label: "Excellent", color: "text-green-600" };
  if (g > 0.02 && i < 0.05) return { label: "Good", color: "text-blue-600" };
  if (g > 0 && i < 0.08) return { label: "Moderate", color: "text-yellow-600" };
  return { label: "Concerning", color: "text-red-600" };
}

// Helper function to get economic health color
function getEconomicHealthColor(realGDPGrowthRate: number, inflationRate: number): string {
  const health = computeHealth(realGDPGrowthRate, inflationRate);
  return health.color;
}

// Helper function to get economic health label
function getEconomicHealthLabel(realGDPGrowthRate: number, inflationRate: number): string {
  const health = computeHealth(realGDPGrowthRate, inflationRate);
  return health.label;
}

// Smart normalization - only fix obviously wrong values
function smartNormalizeGrowthRate(value: number | null | undefined, fallback: number = 3.0): number {
  if (!value || !isFinite(value)) return fallback;
  
  // Real-world growth rates are typically between -10% and +20%
  // If the value is extremely large, keep dividing by 100 until reasonable
  let normalizedValue = value;
  
  // Keep dividing by 100 until we get a reasonable growth rate
  while (Math.abs(normalizedValue) > 50) {
    normalizedValue = normalizedValue / 100;
  }
  
  // If still unreasonably large after normalization, cap it
  if (Math.abs(normalizedValue) > 20) {
    return normalizedValue > 0 ? 20 : -20;
  }
  
  return normalizedValue;
}

// Helper function to generate economic data from country profile
function generateEconomicDataForCountry(country: any) {
  // Create country profile from available data
  const profile: CountryProfile = {
    population: country.currentPopulation || country.baselinePopulation || 0,
    gdpPerCapita: country.currentGdpPerCapita || country.baselineGdpPerCapita || 0,
    totalGdp: country.nominalGDP || (country.currentPopulation * country.currentGdpPerCapita) || 0,
    economicTier: country.economicTier || "Developing",
    landArea: country.landArea,
    continent: country.continent,
    region: country.region,
  };

  // Generate all economic data using the template system
  const economicData = generateCountryEconomicData(profile);

  // Override with any real data that might be available
  // This makes it easy to gradually replace template data with live data
  if (country.realGDPGrowthRate !== undefined) {
    economicData.core.realGDPGrowthRate = country.realGDPGrowthRate;
  }
  if (country.inflationRate !== undefined) {
    economicData.core.inflationRate = country.inflationRate;
  }
  if (country.unemploymentRate !== undefined) {
    economicData.labor.unemploymentRate = country.unemploymentRate;
  }
  // Add more real data overrides here as they become available

  return economicData;
}

interface CountryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CountryDetailPage({ params }: CountryDetailPageProps) {
  const { id } = use(params);
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({ id });
  const { data: systemStatus, isLoading: systemStatusLoading, error: systemStatusError } = api.admin.getSystemStatus.useQuery();
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : undefined;

  if (isLoading || systemStatusLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-1/2 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full md:col-span-2" />
        </div>
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-red-500">
        <AlertTriangle className="inline-block mr-2" />
        Error loading country data: {error.message}
      </div>
    );
  }
  
  if (systemStatusError) {
    console.error("Error loading system status:", systemStatusError.message);
  }

  if (!country) {
    return <div className="container mx-auto px-4 py-8">Country not found.</div>;
  }

  // Generate economic data using the template system
  const economyData = generateEconomicDataForCountry(country);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/countries">Countries</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{country.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">{country.name}</h1>
          <p className="text-muted-foreground">
            Detailed information and economic statistics for {country.name}.
          </p>
        </div>
        {currentIxTime && (
          <Card className="p-0">
            <CardHeader className="p-2">
              <CardTitle className="text-sm">Current IxTime</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="text-lg font-semibold">
                {systemStatus?.ixTime?.formattedIxTime ?? 'Loading...'}
              </div>
            </CardContent>
          </Card>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CountryInfobox countryName={country.name} />
        </div>
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="economy">Economy</TabsTrigger>
              <TabsTrigger value="labor">Labor</TabsTrigger>
              <TabsTrigger value="government">Government</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="demographics">Demographics</TabsTrigger>
              <TabsTrigger value="historical-data">History</TabsTrigger>
              <TabsTrigger value="modeling">Modeling</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="space-y-6">
                {country && (
                  <CountryAtGlance 
                    country={{
                      ...country,
                      // Smart normalize only obviously wrong values
                      populationGrowthRate: smartNormalizeGrowthRate(country.populationGrowthRate, 1.0),
                      adjustedGdpGrowth: smartNormalizeGrowthRate(country.adjustedGdpGrowth, 3.0),
                      maxGdpGrowthRate: smartNormalizeGrowthRate(country.maxGdpGrowthRate, 5.0),
                    }} 
                    currentIxTime={currentIxTime ?? 0} 
                    isLoading={isLoading} 
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="economy" className="mt-4">
              <div className="space-y-6">
                {/* Economic Summary Widget */}
                {country && <EconomicSummaryWidget countryName={country.name} data={{
                  population: economyData.core.totalPopulation,
                  gdpPerCapita: economyData.core.gdpPerCapita,
                  totalGdp: economyData.core.nominalGDP,
                  economicTier: country.economicTier || "Developing",
                  populationGrowthRate: smartNormalizeGrowthRate(country.populationGrowthRate, 1.0),
                  gdpGrowthRate: smartNormalizeGrowthRate(country.realGDPGrowthRate || country.adjustedGdpGrowth, 3.0),
                  unemploymentRate: economyData.labor.unemploymentRate,
                  laborForceParticipationRate: economyData.labor.laborForceParticipationRate,
                  taxRevenueGDPPercent: economyData.fiscal.taxRevenueGDPPercent,
                  budgetBalance: economyData.fiscal.budgetDeficitSurplus,
                  debtToGDP: economyData.fiscal.totalDebtGDPRatio,
                  populationDensity: country.populationDensity,
                  gdpDensity: country.gdpDensity,
                  landArea: country.landArea,
                }} />}
                
                <CoreEconomicIndicators
                  indicators={economyData.core}
                  onIndicatorsChangeAction={() => {}}
                  isReadOnly={true}
                  showComparison={false}
                />
              </div>
            </TabsContent>

            <TabsContent value="labor" className="mt-4">
              <LaborEmployment
                laborData={economyData.labor}
                totalPopulation={economyData.core.totalPopulation}
                onLaborDataChangeAction={() => {}}
                isReadOnly={true}
                showComparison={false}
              />
            </TabsContent>

            <TabsContent value="government" className="mt-4">
              <div className="space-y-6">
                {/* Fiscal System */}
                <FiscalSystemComponent
                  fiscalData={economyData.fiscal}
                  referenceCountry={{
                    name: "Reference Country",
                    countryCode: "REF",
                    gdp: economyData.core.nominalGDP,
                    population: economyData.core.totalPopulation,
                    gdpPerCapita: economyData.core.gdpPerCapita,
                    taxRevenuePercent: economyData.fiscal.taxRevenueGDPPercent,
                    unemploymentRate: economyData.labor.unemploymentRate,
                  }}
                  nominalGDP={economyData.core.nominalGDP}
                  totalPopulation={economyData.core.totalPopulation}
                  onFiscalDataChange={() => {}}
                />
                
                {/* Government Spending */}
                <GovernmentSpending
                  spendingData={economyData.spending}
                  nominalGDP={economyData.core.nominalGDP}
                  totalPopulation={economyData.core.totalPopulation}
                  onSpendingDataChangeAction={() => {}}
                  isReadOnly={true}
                />
              </div>
            </TabsContent>

            <TabsContent value="income" className="mt-4">
              <IncomeWealthDistribution
                incomeData={economyData.income}
                totalPopulation={economyData.core.totalPopulation}
                gdpPerCapita={economyData.core.gdpPerCapita}
                onIncomeDataChange={() => {}}
              />
            </TabsContent>

            <TabsContent value="demographics" className="mt-4">
              <Demographics
                demographicData={{
                  ...economyData.demographics,
                  ageDistribution: economyData.demographics.ageDistribution.map(group => ({
                    ...group,
                    color: group.color ?? '#000000' // Use nullish coalescing for cleaner default
                  }))
                }}
                totalPopulation={economyData.core.totalPopulation}
                onDemographicDataChange={() => {}}
              />
            </TabsContent>

            <TabsContent value="historical-data" className="mt-4">
              {country && country.historicalData && (
                <HistoricalEconomicTracker
                  countryId={country.id}
                  countryName={country.name}
                  historicalData={country.historicalData}
                />
              )}
            </TabsContent>

            <TabsContent value="modeling" className="mt-4">
              {country && <EconomicModelingEngine country={country} />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}