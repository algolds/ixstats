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
import { createUrl } from "~/lib/url-utils";
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
import type { DmInputs } from "@prisma/client";
import { CountryIntelligenceSection } from "~/app/countries/_components/CountryIntelligenceSection";
import { CountryExecutiveSection } from "~/app/countries/_components/CountryExecutiveSection";
import { CrisisStatusBanner } from "~/app/countries/_components/CrisisStatusBanner";
import { GlowingEffect } from "~/components/ui/glowing-effect";

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
function smartNormalizeGrowthRate(value: number | null | undefined, fallback = 3.0): number {
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

  // Generate economic data using the template system
  const economyData = country ? generateEconomicDataForCountry(country) : undefined;

  // State for edit mode and unsaved changes
  const [editMode, setEditMode] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [editedEconomyData, setEditedEconomyData] = React.useState(economyData);

  // tRPC mutation for saving economic data
  const updateEconomicDataMutation = api.countries.updateEconomicData.useMutation();

  // When country or economyData changes, reset edit state
  useEffect(() => {
    setEditedEconomyData(economyData);
    setEditMode(false);
    setHasUnsavedChanges(false);
  }, [country, isOwnCountry]);

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
      setHasUnsavedChanges(false);
      setEditMode(false);
      // Optionally refetch country data
    } catch (error) {
      // Handle error (show toast, etc.)
    }
  };

  const handleCancel = () => {
    setEditedEconomyData(economyData);
    setEditMode(false);
    setHasUnsavedChanges(false);
  };

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

  return (
    <>
      <SignedIn>
        <div className="container mx-auto px-4 py-8 space-y-6">
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
              <div className="relative w-full rounded-2xl bg-white/10 dark:bg-neutral-900/60 backdrop-blur-[12px] shadow-xl border border-white/10 dark:border-neutral-800/60 overflow-visible">
                <GlowingEffect blur={16} spread={32} glow={true} disabled={false} className="z-0" />
                <Tabs defaultValue="overview" className="w-full relative z-10">
                  {/* TabsList: main navbar for country sections */}
                  <TabsList className="flex w-full justify-between rounded-xl bg-white/20 dark:bg-neutral-800/40 backdrop-blur-[8px] shadow-glass-lg border border-white/10 dark:border-neutral-800/60 overflow-visible relative">
                    <TabsTrigger value="overview" className="flex-1 px-5 whitespace-nowrap">Overview</TabsTrigger>
                    <TabsTrigger value="economy" className="flex-1 px-5 whitespace-nowrap">Economy</TabsTrigger>
                    <TabsTrigger value="labor" className="flex-1 px-5 whitespace-nowrap">Labor</TabsTrigger>
                    <TabsTrigger value="government" className="flex-1 px-5 whitespace-nowrap">Government</TabsTrigger>
                    <TabsTrigger value="income" className="flex-1 px-5 whitespace-nowrap">Income</TabsTrigger>
                    <TabsTrigger value="demographics" className="flex-1 px-5 whitespace-nowrap">Demographics</TabsTrigger>
                    {/* Intelligence and Executive tabs removed */}
                    <TabsTrigger value="historical-data" className="flex-1 px-5 whitespace-nowrap">History</TabsTrigger>
                    {isOwnCountry && (
                      <TabsTrigger
                        value="modeling"
                        className="flex-1 px-5 whitespace-nowrap"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          router.push(createUrl(`/countries/${country.id}/modeling`));
                        }}
                      >
                        Advanced Modeling
                      </TabsTrigger>
                    )}
                  </TabsList>

                  {/* Edit/Save/Cancel controls for owner */}
                  {isOwnCountry && (
                    <div className="flex items-center gap-2 mb-4">
                      {hasUnsavedChanges && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Unsaved Changes</span>
                      )}
                      {editMode ? (
                        <>
                          <button className="btn btn-primary" onClick={handleSave} disabled={!hasUnsavedChanges}>Save</button>
                          <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                        </>
                      ) : (
                        <button className="btn btn-outline" onClick={() => setEditMode(true)}>Edit</button>
                      )}
                    </div>
                  )}

                  <TabsContent value="overview" className="mt-4">
                    <GlowingEffect blur={16} spread={32} glow={true} disabled={false} className="z-0" />
                    <div className="space-y-6 relative z-10">
                      {/* Crisis Status Banner */}
                      <CrisisStatusBanner countryId={country.id} />
                      
                      {country && (
                        <CountryAtGlance 
                          country={{
                            ...country,
                            lastCalculated: typeof country.lastCalculated === 'number' ? country.lastCalculated : (country.lastCalculated instanceof Date ? country.lastCalculated.getTime() : 0),
                            baselineDate: typeof country.baselineDate === 'number' ? country.baselineDate : (country.baselineDate instanceof Date ? country.baselineDate.getTime() : 0)
                          }} 
                          currentIxTime={currentIxTime ?? 0} 
                          isLoading={isLoading} 
                        />
                      )}
                      {/* ECI Analytics & Projections Dashboard */}
                      {country && country.analytics && (
                        <Card className="mt-4">
                          <CardHeader>
                            <CardTitle>Executive Command Analytics</CardTitle>
                            <CardDescription>Key trends, risks, and projections for this nation</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h4 className="font-semibold mb-2">Growth Trends</h4>
                                <ul className="text-sm space-y-1">
                                  <li>Avg Population Growth: <span className="font-mono">{(country.analytics.growthTrends.avgPopGrowth * 100).toFixed(2)}%</span></li>
                                  <li>Avg GDP per Capita Growth: <span className="font-mono">{(country.analytics.growthTrends.avgGdpGrowth * 100).toFixed(2)}%</span></li>
                                </ul>
                                <h4 className="font-semibold mt-4 mb-2">Volatility</h4>
                                <ul className="text-sm space-y-1">
                                  <li>Population Volatility: <span className="font-mono">{(country.analytics.volatility.popVolatility * 100).toFixed(2)}%</span></li>
                                  <li>GDP per Capita Volatility: <span className="font-mono">{(country.analytics.volatility.gdpVolatility * 100).toFixed(2)}%</span></li>
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2">Risks & Vulnerabilities</h4>
                                <ul className="text-sm space-y-1">
                                  {country.analytics.riskFlags.length === 0 && <li>No major risk flags detected.</li>}
                                  {country.analytics.riskFlags.map((flag: string, i: number) => (
                                    <li key={i} className="text-red-600">{flag.replace(/_/g, ' ')}</li>
                                  ))}
                                  {country.analytics.vulnerabilities.length > 0 && (
                                    <>
                                      <li className="mt-2 font-semibold">Vulnerabilities:</li>
                                      {country.analytics.vulnerabilities.map((v: string, i: number) => (
                                        <li key={i} className="text-yellow-700">{v.replace(/_/g, ' ')}</li>
                                      ))}
                                    </>
                                  )}
                                </ul>
                                {country.analytics.tierChangeProjection && (
                                  <div className="mt-4">
                                    <h4 className="font-semibold mb-2">Tier Change Projection</h4>
                                    <p className="text-sm">Expected to reach next economic tier ({country.analytics.tierChangeProjection.newTier}) in <span className="font-mono">{country.analytics.tierChangeProjection.year}</span> year(s).</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Projections Table */}
                            <div className="mt-6">
                              <h4 className="font-semibold mb-2">5-Year Projections</h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs border">
                                  <thead>
                                    <tr className="bg-muted">
                                      <th className="px-2 py-1 border">Year</th>
                                      <th className="px-2 py-1 border">Population</th>
                                      <th className="px-2 py-1 border">GDP p.c.</th>
                                      <th className="px-2 py-1 border">Total GDP</th>
                                      <th className="px-2 py-1 border">Tier</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {country.projections && country.projections.map((proj: any, i: number) => (
                                      <tr key={i} className="border-t">
                                        <td className="px-2 py-1 border">+{proj.yearOffset}</td>
                                        <td className="px-2 py-1 border">{proj.stats.currentPopulation?.toLocaleString()}</td>
                                        <td className="px-2 py-1 border">${proj.stats.currentGdpPerCapita?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className="px-2 py-1 border">${proj.stats.currentTotalGdp?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className="px-2 py-1 border">{proj.stats.economicTier}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            {/* DM Inputs */}
                            <div className="mt-6">
                              <h4 className="font-semibold mb-2">Active DM Inputs</h4>
                              {country.dmInputs && country.dmInputs.length > 0 ? (
                                <ul className="text-sm space-y-1">
                                  {country.dmInputs.map((dm: any, i: number) => (
                                    <li key={i}>
                                      <span className="font-mono">[{dm.inputType}]</span> {dm.description} <span className="text-muted-foreground">({dm.value}, {dm.duration ? `${dm.duration}y` : 'permanent'})</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-muted-foreground">No active DM inputs.</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="economy" className="mt-4">
                    <GlowingEffect blur={16} spread={32} glow={true} disabled={false} className="z-0" />
                    <div className="space-y-6 relative z-10">
                      {/* Economic Summary Widget */}
                      {country && <EconomicSummaryWidget countryName={country.name} data={{
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
                      }} />}
                      
                      <CoreEconomicIndicators
                        indicators={economyData?.core ?? { totalPopulation: 0, nominalGDP: 0, gdpPerCapita: 0, realGDPGrowthRate: 0, inflationRate: 0, currencyExchangeRate: 0 }}
                        onIndicatorsChangeAction={() => {}}
                        isReadOnly={true}
                        showComparison={false}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="labor" className="mt-4">
                    <GlowingEffect blur={16} spread={32} glow={true} disabled={false} className="z-0" />
                    <div className="relative z-10">
                      <LaborEmployment
                        laborData={editedEconomyData?.labor ?? { laborForceParticipationRate: 0, employmentRate: 0, unemploymentRate: 0, totalWorkforce: 0, averageWorkweekHours: 0, minimumWage: 0, averageAnnualIncome: 0, employmentBySector: { agriculture: 0, industry: 0, services: 0 }, employmentByType: { fullTime: 0, partTime: 0, temporary: 0, selfEmployed: 0, informal: 0 }, skillsAndProductivity: { averageEducationYears: 0, tertiaryEducationRate: 0, vocationalTrainingRate: 0, skillsGapIndex: 0, laborProductivityIndex: 0, productivityGrowthRate: 0 }, demographicsAndConditions: { youthUnemploymentRate: 0, femaleParticipationRate: 0, genderPayGap: 0, unionizationRate: 0, workplaceSafetyIndex: 0, averageCommutingTime: 0 }, regionalEmployment: { urban: { participationRate: 0, unemploymentRate: 0, averageIncome: 0 }, rural: { participationRate: 0, unemploymentRate: 0, averageIncome: 0 } }, socialProtection: { unemploymentBenefitCoverage: 0, pensionCoverage: 0, healthInsuranceCoverage: 0, paidSickLeaveDays: 0, paidVacationDays: 0, parentalLeaveWeeks: 0 } }}
                        totalPopulation={editedEconomyData?.core?.totalPopulation ?? 0}
                        onLaborDataChangeAction={editMode ? (data) => handleSectionChange('labor', data) : () => {}}
                        isReadOnly={!editMode}
                        showComparison={false}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="government" className="mt-4">
                    <GlowingEffect blur={16} spread={32} glow={true} disabled={false} className="z-0" />
                    <div className="space-y-6 relative z-10">
                      <FiscalSystemComponent
                        fiscalData={
                          editedEconomyData?.fiscal ?? {
                            taxRevenueGDPPercent: 0,
                            governmentRevenueTotal: 0,
                            taxRevenuePerCapita: 0,
                            governmentBudgetGDPPercent: 0,
                            budgetDeficitSurplus: 0,
                            internalDebtGDPPercent: 0,
                            externalDebtGDPPercent: 0,
                            totalDebtGDPRatio: 0,
                            debtPerCapita: 0,
                            interestRates: 0,
                            debtServiceCosts: 0,
                            taxRates: {
                              personalIncomeTaxRates: [],
                              corporateTaxRates: [],
                              salesTaxRate: 0,
                              propertyTaxRate: 0,
                              payrollTaxRate: 0,
                              exciseTaxRates: [],
                              wealthTaxRate: 0,
                            },
                            governmentSpendingByCategory: [],
                          }
                        }
                        nominalGDP={editedEconomyData?.core?.nominalGDP ?? 0}
                        totalPopulation={editedEconomyData?.core?.totalPopulation ?? 0}
                        onFiscalDataChange={editMode ? (data) => handleSectionChange('fiscal', data) : () => {}}
                      />
                      <GovernmentSpending
                        {...(editedEconomyData?.spending ?? { totalSpending: 0, spendingGDPPercent: 0, spendingPerCapita: 0, spendingCategories: [], deficitSurplus: 0 })}
                        nominalGDP={editedEconomyData?.core?.nominalGDP ?? 0}
                        totalPopulation={editedEconomyData?.core?.totalPopulation ?? 0}
                        onSpendingDataChangeAction={editMode ? (data) => handleSectionChange('spending', data) : () => {}}
                        isReadOnly={!editMode}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="income" className="mt-4">
                    <GlowingEffect blur={16} spread={32} glow={true} disabled={false} className="z-0" />
                    <div className="relative z-10">
                      <IncomeWealthDistribution
                        incomeData={economyData?.income ?? { economicClasses: [], povertyRate: 0, incomeInequalityGini: 0, socialMobilityIndex: 0 }}
                        totalPopulation={economyData?.core.totalPopulation ?? 0}
                        gdpPerCapita={economyData?.core.gdpPerCapita ?? 0}
                        onIncomeDataChangeAction={() => {}}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="demographics" className="mt-4">
                    <GlowingEffect blur={16} spread={32} glow={true} disabled={false} className="z-0" />
                    <div className="relative z-10">
                      <Demographics
                        demographicData={{
                          ...economyData?.demographics,
                          ageDistribution: economyData?.demographics?.ageDistribution ?? [],
                        } as any}
                        totalPopulation={economyData?.core.totalPopulation ?? 0}
                        onDemographicDataChangeAction={() => {}}
                      />
                    </div>
                  </TabsContent>

                  {/* Remove Intelligence and Executive TabsContent */}
                  {/* <TabsContent value="intelligence" className="mt-4">
                    <CountryIntelligenceSection countryId={country.id} />
                  </TabsContent>
                  {isOwnCountry && (
                    <TabsContent value="executive" className="mt-4">
                      <CountryExecutiveSection countryId={country.id} userId={user?.id} />
                    </TabsContent>
                  )} */}

                  <TabsContent value="historical-data" className="mt-4">
                    <GlowingEffect blur={16} spread={32} glow={true} disabled={false} className="z-0" />
                    <div className="relative z-10">
                      {/* Hydration-safe milestone/history rendering */}
                      {country && country.historical?.length > 0 ? (
                        <HistoryMilestonesList
                          historicalData={country.historical}
                        />
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="text-sm">No historical data or milestones available yet.</p>
                          <p className="text-xs">Updates and milestones will appear here as the country is updated.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
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