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
import { AlertTriangle } from "lucide-react";
import { formatNumber } from "~/lib/chart-utils"; // Corrected import path

interface CountryDetailPageProps {
  params: { id: string };
}

export default function CountryDetailPage({ params }: CountryDetailPageProps) {
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({ id: params.id });
  const { data: systemStatus, isLoading: systemStatusLoading, error: systemStatusError } = api.admin.getSystemStatus.useQuery();
  const currentIxTime = systemStatus?.ixTime.currentIxTime; // Access the IxTime from system status

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

            <TabsContent value="economy" className="mt-4">
              <div className="space-y-6">
                {country && country.currentStats && <EconomicSummaryWidget countryName={country.name} data={country.currentStats} />}
                {country && country.currentStats && <CoreEconomicIndicators indicators={country.currentStats} onIndicatorsChangeAction={function (i: CoreEconomicIndicators): void {
                  throw new Error("Function not implemented.");
                } } />}
              </div>
            </TabsContent>

            <TabsContent value="detailed-stats" className="mt-4">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Economic Indicators</CardTitle>
                    <CardDescription>In-depth economic metrics for {country.name}.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <p className="text-muted-foreground col-span-full">Detailed economic data display is not yet implemented as individual cards.</p>
                  </CardContent>
                </Card>
                <p className="text-muted-foreground">Comparative analysis requires data for all countries, which is not currently fetched on this page.</p>
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
