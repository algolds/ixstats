// src/app/countries/[id]/page.tsx
"use client";

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
  // CountryEconomicDataSection, // Not strictly needed if EconomicDataDisplay is used directly as cards
  EconomicDataDisplay,
  EconomicModelingEngine,
  EconomicSummaryWidget,
  HistoricalEconomicTracker,
  LaborEmployment,
} from "~/app/countries/_components/economy";
import { IxTimeCalendar } from "~/app/countries/_components/charts/IxTimeCalendar";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, Info } from "lucide-react";
import { formatNumber, formatGrowthRateFromDecimal } from "~/lib/chart-utils"; // Corrected import path
import { Alert, AlertDescription } from "~/components/ui/alert";

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

interface CountryDetailPageProps {
  params: { id: string };
}

export default function CountryDetailPage({ params }: CountryDetailPageProps) {
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({ id: params.id });
  const { data: systemStatus, isLoading: systemStatusLoading, error: systemStatusError } = api.admin.getSystemStatus.useQuery();
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : undefined; // Access the IxTime from system status, ensure it's a number

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
    // Non-critical error, perhaps log it or show a minor warning
    console.error("Error loading system status:", systemStatusError.message);
  }

  if (!country) {
    return <div className="container mx-auto px-4 py-8">Country not found.</div>;
  }

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
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="economy">Economy</TabsTrigger>
              <TabsTrigger value="detailed-stats">Detailed Stats</TabsTrigger>
              <TabsTrigger value="labor-employment">Labor</TabsTrigger>
              <TabsTrigger value="historical-data">History</TabsTrigger>
              <TabsTrigger value="modeling">Modeling</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="space-y-6">
                {country && (
                  <CountryAtGlance country={country} currentIxTime={currentIxTime ?? 0} isLoading={isLoading} />
                )}
                {country && country.currentStats && <EconomicSummaryWidget countryName={country.name} data={country.currentStats} />}
              </div>
            </TabsContent>

            <TabsContent value="economy" className="mt-4">
              <div className="space-y-6">
                {country && country.currentStats && <EconomicSummaryWidget countryName={country.name} data={country.currentStats} />}
                {country && country.currentStats && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">
                        Economic Health: <span className={getEconomicHealthColor(country.currentStats.realGDPGrowthRate, country.currentStats.inflationRate)}>{getEconomicHealthLabel(country.currentStats.realGDPGrowthRate, country.currentStats.inflationRate)}</span>
                      </div>
                      <p className="text-sm">
                        Based on {formatGrowthRateFromDecimal(country.currentStats.realGDPGrowthRate)} growth &
                        {formatGrowthRateFromDecimal(country.currentStats.inflationRate)} inflation.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
                {country && (
                  <EconomicDataDisplay
                    countryId={country.id}
                    countryName={country.name}
                    isEditable={true}
                    mode="full"
                    showTabs={true}
                    defaultTab="core"
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="labor-employment" className="mt-4">
              {country && country.laborMarket && country.currentPopulation !== undefined && (
                <LaborEmployment
                  laborData={country.laborMarket}
                  totalPopulation={country.currentPopulation}
                  onLaborDataChangeAction={function (d) { /* TODO: Implement server action */ console.log('Labor data changed:', d); }}
                />
              )}
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