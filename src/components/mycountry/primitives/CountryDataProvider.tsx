"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { api } from "~/trpc/react";
import { generateCountryEconomicData, type CountryProfile } from "~/lib/economic-data-templates";
import { AlertTriangle, Crown } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createAbsoluteUrl } from "~/lib/url-utils";

interface CountryDataContextValue {
  userProfile: any;
  country: any;
  economyData: any;
  systemStatus: any;
  activityRingsData: any;
  currentIxTime: number;
  isLoading: boolean;
  error: string | null;
}

const CountryDataContext = createContext<CountryDataContextValue | undefined>(undefined);

interface CountryDataProviderProps {
  children: ReactNode;
  userId: string;
}

// Helper function to generate economic data
function generateEconomicDataForCountry(country: any) {
  if (!country) return undefined;

  const profile: CountryProfile = {
    population: country.currentPopulation || country.baselinePopulation || 0,
    gdpPerCapita: country.currentGdpPerCapita || country.baselineGdpPerCapita || 0,
    totalGdp: country.nominalGDP || country.currentPopulation * country.currentGdpPerCapita || 0,
    economicTier: country.economicTier || "Developing",
    landArea: country.landArea,
    continent: country.continent,
    region: country.region,
  };

  const economicData = generateCountryEconomicData(profile);

  // Economic data mapping (debug logs removed for production)

  // CRITICAL FIX: DO NOT use template data! Only use real database values.
  // If database value is null/undefined, SET IT TO null so UI can show "N/A"
  // Template data should NEVER be shown as if it's real data!

  // Core economic indicators - use DB value or null
  economicData.core.realGDPGrowthRate = country.realGDPGrowthRate ?? null;
  economicData.core.inflationRate = country.inflationRate ?? null;
  economicData.core.nominalGDP = country.nominalGDP ?? null;

  // Labor market data - use DB value or null (NO TEMPLATE DATA)
  economicData.labor.unemploymentRate = country.unemploymentRate ?? null;
  economicData.labor.employmentRate =
    country.employmentRate ??
    (country.unemploymentRate !== null && country.unemploymentRate !== undefined
      ? 100 - country.unemploymentRate
      : null);
  economicData.labor.laborForceParticipationRate = country.laborForceParticipationRate ?? null;
  economicData.labor.totalWorkforce = country.totalWorkforce ?? null;
  economicData.labor.averageWorkweekHours = country.averageWorkweekHours ?? null;
  economicData.labor.minimumWage = country.minimumWage ?? null;
  economicData.labor.averageAnnualIncome = country.averageAnnualIncome ?? null;

  // Fiscal system data - use DB value or null
  economicData.fiscal.taxRevenueGDPPercent = country.taxRevenueGDPPercent ?? null;
  economicData.fiscal.governmentRevenueTotal = country.governmentRevenueTotal ?? null;
  economicData.fiscal.governmentBudgetGDPPercent = country.governmentBudgetGDPPercent ?? null;
  economicData.fiscal.budgetDeficitSurplus = country.budgetDeficitSurplus ?? null;
  economicData.fiscal.totalDebtGDPRatio = country.totalDebtGDPRatio ?? null;
  economicData.fiscal.internalDebtGDPPercent = country.internalDebtGDPPercent ?? null;
  economicData.fiscal.externalDebtGDPPercent = country.externalDebtGDPPercent ?? null;
  economicData.fiscal.interestRates = country.interestRates ?? null;
  economicData.fiscal.debtServiceCosts = country.debtServiceCosts ?? null;

  // Government spending data - use DB value or null
  economicData.spending.totalSpending = country.totalGovernmentSpending ?? null;
  economicData.spending.spendingGDPPercent = country.spendingGDPPercent ?? null;

  // Demographics data - use DB value or defaults
  economicData.demographics.lifeExpectancy = country.lifeExpectancy ?? null;
  economicData.demographics.literacyRate = country.literacyRate ?? null;
  economicData.demographics.urbanRuralSplit =
    country.urbanPopulationPercent !== null &&
    country.urbanPopulationPercent !== undefined &&
    country.ruralPopulationPercent !== null &&
    country.ruralPopulationPercent !== undefined
      ? {
          urban: country.urbanPopulationPercent,
          rural: country.ruralPopulationPercent,
        }
      : { urban: 60, rural: 40 }; // Default split if not available

  // Economic data mapping complete

  return economicData;
}

export function CountryDataProvider({ children, userId }: CountryDataProviderProps) {
  const {
    data: userProfile,
    isLoading: profileLoading,
    error: profileError,
  } = api.users.getProfile.useQuery(undefined, { enabled: !!userId });

  const {
    data: country,
    isLoading: countryLoading,
    error: countryError,
  } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  );

  const { data: systemStatus, isLoading: systemStatusLoading } =
    api.admin.getSystemStatus.useQuery();

  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );

  const currentIxTime =
    typeof systemStatus?.ixTime?.currentIxTime === "number" ? systemStatus.ixTime.currentIxTime : 0;

  const economyData = generateEconomicDataForCountry(country);

  const isLoading = profileLoading || countryLoading || systemStatusLoading;

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200"></div>
            <div className="space-y-2">
              <div className="h-8 w-64 animate-pulse rounded bg-gray-200"></div>
              <div className="h-4 w-48 animate-pulse rounded bg-gray-200"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded bg-gray-200"></div>
            ))}
          </div>

          <div className="h-96 animate-pulse rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  // No user profile found
  if (!profileLoading && !userProfile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert className="mx-auto max-w-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Unable to load user profile. Please try refreshing the page or contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No country assigned to user
  if (!isLoading && userProfile && !userProfile.countryId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-2xl">
          <CardHeader className="text-center">
            <Crown className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <CardTitle className="text-2xl font-bold">No Country Assigned</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              You don't have a country assigned to your account yet. Contact an administrator to
              claim a country or browse available countries to request ownership.
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => (window.location.href = createAbsoluteUrl("/countries"))}>
                Browse Countries
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = createAbsoluteUrl("/admin"))}
              >
                Contact Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Country not found - this could be a permissions issue
  if (!isLoading && userProfile?.countryId && !country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert className="mx-auto max-w-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Country not found or access denied. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const value: CountryDataContextValue = {
    userProfile,
    country,
    economyData,
    systemStatus,
    activityRingsData,
    currentIxTime,
    isLoading: false,
    error: profileError?.message || countryError?.message || null,
  };

  return <CountryDataContext.Provider value={value}>{children}</CountryDataContext.Provider>;
}

export function useCountryData(): CountryDataContextValue {
  const context = useContext(CountryDataContext);
  if (context === undefined) {
    throw new Error("useCountryData must be used within a CountryDataProvider");
  }
  return context;
}
