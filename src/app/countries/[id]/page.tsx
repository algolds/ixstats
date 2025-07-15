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
import { AlertTriangle, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber, formatGrowthRateFromDecimal } from "~/lib/chart-utils";
import { Alert, AlertDescription } from "~/components/ui/alert";
import React, { useEffect, useState } from "react";
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
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "~/components/ui/accordion";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

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

  // Get current user and their linked countryId
  const { user, isLoaded } = useUser();
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  const isOwnCountry = userProfile?.countryId && country?.id && userProfile.countryId === country.id;

  // Horizontal collapse state for infobox
  const [infoboxCollapsed, setInfoboxCollapsed] = React.useState(false);

  // Responsive effect: collapsed by default on mobile, expanded on desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setInfoboxCollapsed(window.innerWidth < 1024); // <lg breakpoint
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const router = useRouter();

  // Track if component is mounted to avoid SSR/CSR mismatch
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // Accordion default value: only set after mount to avoid hydration mismatch
  const [accordionValue, setAccordionValue] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    setAccordionValue(window.innerWidth < 1024 ? undefined : 'infobox');
  }, []);

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
    <>
      <SignedIn>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Horizontally and vertically collapsible infobox sidebar */}
            <div
              className={`transition-all duration-300 relative ${infoboxCollapsed ? 'w-14 min-w-[3.5rem] max-w-[3.5rem] overflow-x-hidden' : 'w-full min-w-[260px] max-w-lg'} lg:col-span-1`}
              style={{ minHeight: '100%' }}
            >
              {/* Horizontal collapse/expand button - moved to left edge */}
              <button
                className="absolute top-2 left-2 z-10 bg-muted rounded-full p-1 hover:bg-accent transition-colors"
                onClick={() => setInfoboxCollapsed((c) => !c)}
                aria-label={infoboxCollapsed ? 'Expand infobox' : 'Collapse infobox'}
              >
                {infoboxCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </button>
              {/* Vertically collapsible infobox, only show trigger when horizontally collapsed */}
              <div className={`transition-all duration-300 ${infoboxCollapsed ? 'flex flex-col items-center justify-start' : ''}`}>
                {/* Only render Accordion after mount to avoid hydration mismatch */}
                {mounted && (
                  <Accordion type="single" collapsible defaultValue={accordionValue}>
                    <AccordionItem value="infobox">
                      <AccordionTrigger className={`text-lg font-semibold ${infoboxCollapsed ? 'justify-center px-0' : ''}`}></AccordionTrigger>
                      {/* Only show details if not horizontally collapsed */}
                      {!infoboxCollapsed && (
                        <AccordionContent>
                          <CountryInfobox countryName={country.name} />
                        </AccordionContent>
                      )}
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            </div>
            <div className="lg:col-span-2">
              <Tabs defaultValue="overview" className="w-full">
                {/* TabsList: main navbar for country sections */}
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="economy">Economy</TabsTrigger>
                  <TabsTrigger value="labor">Labor</TabsTrigger>
                  <TabsTrigger value="government">Government</TabsTrigger>
                  <TabsTrigger value="income">Income</TabsTrigger>
                  <TabsTrigger value="demographics">Demographics</TabsTrigger>
                  <TabsTrigger value="historical-data">History</TabsTrigger>
                  {/* Advanced Modeling as a real tab, only for own country */}
                  {isOwnCountry && (
                    <TabsTrigger
                      value="modeling"
                      onClick={e => {
                        e.preventDefault();
                        router.push(`/countries/${country.id}/modeling`);
                      }}
                    >
                      Advanced Modeling
                    </TabsTrigger>
                  )}
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
                      nominalGDP={economyData.core.nominalGDP}
                      totalPopulation={economyData.core.totalPopulation}
                      isReadOnly={true}
                      showAnalytics={true}
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
                    onIncomeDataChangeAction={() => {}}
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
                    onDemographicDataChangeAction={() => {}}
                  />
                </TabsContent>

                <TabsContent value="historical-data" className="mt-4">
                  {/* Hydration-safe milestone/history rendering */}
                  {country && country.historicalData?.length > 0 ? (
                    <HistoryMilestonesList
                      historicalData={country.historicalData}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No historical data or milestones available yet.</p>
                      <p className="text-xs">Updates and milestones will appear here as the country is updated.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Card className="max-w-md w-full text-center">
            <CardHeader>
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                You must be signed in to view country details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignInButton mode="modal" />
            </CardContent>
          </Card>
        </div>
      </SignedOut>
    </>
  );
}

// In HistoryMilestonesList, only render on client (after mount) to avoid hydration mismatch
function HistoryMilestonesList({ historicalData }: { historicalData?: any[] }) {
  const [formattedHistory, setFormattedHistory] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && historicalData) {
      setFormattedHistory(
        historicalData.slice(-20).reverse().map((point) => ({
          ...point,
          formattedDate: point.ixTimeTimestamp ? new Date(point.ixTimeTimestamp).toLocaleDateString() : '',
        }))
      );
    }
  }, [historicalData, mounted]);
  if (!mounted) return null;
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-2">Recent Updates & Milestones</h3>
      <ul className="divide-y divide-border">
        {formattedHistory.map((point, idx) => (
          <li key={idx} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between">
            <span>
              <span className="font-medium">{point.formattedDate}</span>
              {point.population && (
                <span className="ml-2 text-sm text-muted-foreground">Pop: {point.population.toLocaleString()}</span>
              )}
              {point.gdpPerCapita && (
                <span className="ml-2 text-sm text-muted-foreground">GDP p.c.: ${point.gdpPerCapita.toLocaleString()}</span>
              )}
              {point.totalGdp && (
                <span className="ml-2 text-sm text-muted-foreground">Total GDP: ${point.totalGdp.toLocaleString()}</span>
              )}
            </span>
            <span className="text-xs text-muted-foreground mt-1 md:mt-0">{point.populationGrowthRate !== undefined ? `Pop Growth: ${(point.populationGrowthRate * 100).toFixed(2)}%` : ''} {point.gdpGrowthRate !== undefined ? `GDP Growth: ${(point.gdpGrowthRate * 100).toFixed(2)}%` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}