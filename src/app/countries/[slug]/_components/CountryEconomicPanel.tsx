"use client";

// Refactored from main CountryPage - displays economic data tabs (overview, economy, government, labor, demographics)
import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TrendingUp, BarChart3, Building, Users, Globe, Activity, Crown, MapPin, Heart } from "lucide-react";
import { createUrl } from "~/lib/url-utils";
import type {
  CoreEconomicIndicatorsData,
  DemographicsData,
  LaborEmploymentData,
  FiscalSystemData,
  GovernmentSpendingData,
} from "~/types/economics";
import type { CountryInfobox } from "~/lib/mediawiki-service";

// Dynamic imports for chart-heavy components
const LaborEmployment = dynamic(
  () => import("~/app/countries/_components/economy").then((mod) => ({ default: mod.LaborEmployment })),
  {
    ssr: false,
    loading: () => <div className="text-center py-8 text-muted-foreground">Loading labor data...</div>,
  }
);
const Demographics = dynamic(
  () => import("~/app/countries/_components/economy").then((mod) => ({ default: mod.Demographics })),
  {
    ssr: false,
    loading: () => <div className="text-center py-8 text-muted-foreground">Loading demographics...</div>,
  }
);
const GovernmentSpending = dynamic(
  () => import("~/app/countries/_components/economy").then((mod) => ({ default: mod.GovernmentSpending })),
  {
    ssr: false,
    loading: () => <div className="text-center py-8 text-muted-foreground">Loading spending data...</div>,
  }
);
const FiscalSystemComponent = dynamic(
  () => import("~/app/countries/_components/economy").then((mod) => ({ default: mod.FiscalSystemComponent })),
  {
    ssr: false,
    loading: () => <div className="text-center py-8 text-muted-foreground">Loading fiscal data...</div>,
  }
);
const CountryAtGlance = dynamic(
  () => import("~/app/countries/_components/detail").then((mod) => ({ default: mod.CountryAtGlance })),
  {
    ssr: false,
    loading: () => <div className="text-center py-8 text-muted-foreground">Loading economic indicators...</div>,
  }
);

interface CountryEconomicPanelProps {
  country: {
    id: string;
    name: string;
    continent?: string | null | undefined;
    region?: string | null | undefined;
    governmentType?: string | null | undefined;
    religion?: string | null | undefined;
    leader?: string | null | undefined;
    landArea?: number | null | undefined;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    populationGrowthRate?: number | null | undefined;
    adjustedGdpGrowth?: number | null | undefined;
    populationDensity?: number | null | undefined;
    gdpDensity?: number | null | undefined;
    economicTier: string;
    populationTier: string;
    lastCalculated?: Date | number;
    baselineDate?: Date | number;
    nationalIdentity?: {
      officialName?: string | null;
      governmentType?: string | null;
      capitalCity?: string | null;
      currency?: string | null;
      currencySymbol?: string | null;
      motto?: string | null;
    } | null;
  };
  economicsData: {
    core: CoreEconomicIndicatorsData;
    demographics: DemographicsData;
    labor: LaborEmploymentData;
    fiscal: FiscalSystemData;
    spending: GovernmentSpendingData;
  };
  governmentStructure?: {
    governmentName?: string | null;
    governmentType?: string | null;
    headOfState?: string | null;
    headOfGovernment?: string | null;
    legislatureName?: string | null;
    executiveName?: string | null;
    judicialName?: string | null;
  } | null;
  wikiInfobox: CountryInfobox | null;
  currentIxTime: number;
  isOwnCountry: boolean;
  isMounted: boolean;
}

export function CountryEconomicPanel({
  country,
  economicsData,
  governmentStructure,
  wikiInfobox,
  currentIxTime,
  isOwnCountry,
  isMounted,
}: CountryEconomicPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Economic & Government Profile</h2>
          <p className="text-muted-foreground">
            {isOwnCountry
              ? "Public data visible to all countries"
              : "Public information about this country"}
          </p>
        </div>
        {isOwnCountry && (
          <Link href={createUrl("/mycountry")}>
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              Manage in Dashboard
            </Button>
          </Link>
        )}
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5 min-w-fit bg-muted/50">
            <TabsTrigger
              value="overview"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Over</span>
            </TabsTrigger>
            <TabsTrigger
              value="economy"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Economy</span>
              <span className="sm:hidden">Econ</span>
            </TabsTrigger>
            <TabsTrigger
              value="government"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Government</span>
              <span className="sm:hidden">Gov</span>
            </TabsTrigger>
            <TabsTrigger
              value="labor"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Labor</span>
              <span className="sm:hidden">Lab</span>
            </TabsTrigger>
            <TabsTrigger
              value="demographics"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Demographics</span>
              <span className="sm:hidden">Demo</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <CountryAtGlance
            country={{
              id: country.id,
              name: country.name,
              continent: country.continent ?? null,
              region: country.region ?? null,
              governmentType: country.governmentType ?? null,
              religion: country.religion ?? null,
              leader: country.leader ?? null,
              landArea: country.landArea ?? null,
              currentPopulation: country.currentPopulation,
              currentGdpPerCapita: country.currentGdpPerCapita,
              currentTotalGdp: country.currentTotalGdp,
              populationGrowthRate: country.populationGrowthRate ?? 0,
              adjustedGdpGrowth: country.adjustedGdpGrowth ?? 0,
              maxGdpGrowthRate: 0.05,
              populationDensity: country.populationDensity ?? null,
              gdpDensity: country.gdpDensity ?? null,
              economicTier: country.economicTier,
              populationTier: country.populationTier,
              lastCalculated:
                (country as any).lastCalculated instanceof Date
                  ? (country as any).lastCalculated.getTime()
                  : ((country as any).lastCalculated ?? Date.now()),
              baselineDate:
                (country as any).baselineDate instanceof Date
                  ? (country as any).baselineDate.getTime()
                  : ((country as any).baselineDate ?? Date.now()),
              localGrowthFactor: 1.0,
              nationalIdentity: (country as any).nationalIdentity || null,
            }}
            currentIxTime={currentIxTime}
            isLoading={false}
          />
        </TabsContent>

        {/* Economy Tab */}
        <TabsContent value="economy" className="space-y-4 mt-6">
          {!isMounted ? (
            <Card className="backdrop-blur-sm bg-card/50">
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">Loading fiscal data...</div>
              </CardContent>
            </Card>
          ) : economicsData?.fiscal ? (
            <Suspense
              fallback={
                <div className="text-center py-8 text-muted-foreground">Loading fiscal data...</div>
              }
            >
              <FiscalSystemComponent
                fiscalData={economicsData.fiscal}
                nominalGDP={country.currentTotalGdp}
                totalPopulation={country.currentPopulation}
                countryId={country.id}
                onFiscalDataChange={() => {}}
                isReadOnly={true}
              />
            </Suspense>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No fiscal data available</div>
          )}
        </TabsContent>

        {/* Government Tab */}
        <TabsContent value="government" className="space-y-4 mt-6">
          <Card className="backdrop-blur-sm bg-card/50">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(governmentStructure?.governmentName || country?.nationalIdentity?.officialName) && (
                  <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Government</p>
                      <p className="font-semibold">
                        {governmentStructure?.governmentName || country?.nationalIdentity?.officialName}
                      </p>
                    </div>
                  </div>
                )}

                {(governmentStructure?.governmentType ||
                  country?.governmentType ||
                  country?.nationalIdentity?.governmentType) && (
                  <div className="flex items-start gap-3">
                    <Crown className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Government Type</p>
                      <p className="font-semibold">
                        {governmentStructure?.governmentType ||
                          country?.governmentType ||
                          country?.nationalIdentity?.governmentType}
                      </p>
                    </div>
                  </div>
                )}

                {(governmentStructure?.headOfState || country?.leader) && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Head of State</p>
                      <p className="font-semibold">
                        {governmentStructure?.headOfState || country?.leader}
                      </p>
                    </div>
                  </div>
                )}

                {governmentStructure?.headOfGovernment && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Head of Government</p>
                      <p className="font-semibold">{governmentStructure.headOfGovernment}</p>
                    </div>
                  </div>
                )}

                {(country?.nationalIdentity?.capitalCity || wikiInfobox?.capital) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Capital</p>
                      <p className="font-semibold">
                        {country?.nationalIdentity?.capitalCity || wikiInfobox?.capital}
                      </p>
                    </div>
                  </div>
                )}

                {country?.religion && (
                  <div className="flex items-start gap-3">
                    <Heart className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Religion</p>
                      <p className="font-semibold">{country.religion}</p>
                    </div>
                  </div>
                )}

                {(country?.nationalIdentity?.currency || wikiInfobox?.currency) && (
                  <div className="flex items-start gap-3">
                    <Globe className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Currency</p>
                      <p className="font-semibold">
                        {country?.nationalIdentity?.currency || wikiInfobox?.currency}
                        {country?.nationalIdentity?.currencySymbol
                          ? ` (${country.nationalIdentity.currencySymbol})`
                          : ""}
                      </p>
                    </div>
                  </div>
                )}

                {governmentStructure?.legislatureName && (
                  <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Legislature</p>
                      <p className="font-semibold">{governmentStructure.legislatureName}</p>
                    </div>
                  </div>
                )}

                {governmentStructure?.executiveName && (
                  <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Executive</p>
                      <p className="font-semibold">{governmentStructure.executiveName}</p>
                    </div>
                  </div>
                )}

                {governmentStructure?.judicialName && (
                  <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Judiciary</p>
                      <p className="font-semibold">{governmentStructure.judicialName}</p>
                    </div>
                  </div>
                )}
              </div>

              {(country?.nationalIdentity?.motto || wikiInfobox?.motto) && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    National Motto
                  </p>
                  <p className="text-base italic text-muted-foreground border-l-4 border-primary/30 pl-4">
                    &ldquo;{country?.nationalIdentity?.motto || wikiInfobox?.motto}&rdquo;
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Government Spending */}
          {!isMounted ? (
            <Card className="backdrop-blur-sm bg-card/50">
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">Loading spending data...</div>
              </CardContent>
            </Card>
          ) : economicsData?.spending ? (
            <Suspense
              fallback={
                <div className="text-center py-8 text-muted-foreground">Loading spending data...</div>
              }
            >
              <GovernmentSpending
                {...economicsData.spending}
                nominalGDP={country.currentTotalGdp}
                totalPopulation={country.currentPopulation}
                onSpendingDataChangeAction={() => {}}
                isReadOnly={true}
              />
            </Suspense>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No spending data available</div>
          )}
        </TabsContent>

        {/* Labor Tab */}
        <TabsContent value="labor" className="space-y-4 mt-6">
          {!isMounted ? (
            <Card className="backdrop-blur-sm bg-card/50">
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">Loading labor data...</div>
              </CardContent>
            </Card>
          ) : economicsData?.labor ? (
            <Suspense
              fallback={
                <div className="text-center py-8 text-muted-foreground">Loading labor data...</div>
              }
            >
              <LaborEmployment
                laborData={economicsData.labor}
                totalPopulation={country.currentPopulation}
                onLaborDataChangeAction={() => {}}
                isReadOnly={true}
                showComparison={false}
              />
            </Suspense>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No labor data available</div>
          )}
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-4 mt-6">
          {!isMounted ? (
            <Card className="backdrop-blur-sm bg-card/50">
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">Loading demographic data...</div>
              </CardContent>
            </Card>
          ) : economicsData?.demographics ? (
            <Suspense
              fallback={
                <div className="text-center py-8 text-muted-foreground">Loading demographic data...</div>
              }
            >
              <Demographics
                demographicData={economicsData.demographics}
                totalPopulation={country.currentPopulation}
                onDemographicDataChangeAction={() => {}}
                isReadOnly={true}
                showComparison={false}
              />
            </Suspense>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No demographic data available</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Owner Call to Action */}
      {isOwnCountry && (
        <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/30 mt-6">
          <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm">
                This tab shows read-only public economic data. To manage your country and access
                private features, use the full MyCountry dashboard.
              </span>
              <Link href={createUrl("/mycountry")}>
                <Button size="sm" variant="default" className="whitespace-nowrap">
                  Open Full Dashboard
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
