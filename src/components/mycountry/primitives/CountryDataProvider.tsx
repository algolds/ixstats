"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { api } from "~/trpc/react";
import { mapCountryToEconomyData } from "~/lib/economy-data-mapper";
import { AlertTriangle, Crown } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { useDevCountryView } from "~/context/DevCountryViewContext";
import { useDemoMode } from "~/context/DemoModeContext";

interface CountryDataContextValue {
  userProfile: any;
  country: any;
  economyData: any;
  systemStatus: any;
  activityRingsData: any;
  currentIxTime: number;
  isLoading: boolean;
  error: string | null;
  /** True when viewing another country in dev mode */
  isViewingOtherCountry: boolean;
}

const CountryDataContext = createContext<CountryDataContextValue | undefined>(undefined);

interface CountryDataProviderProps {
  children: ReactNode;
  userId: string;
}

export function CountryDataProvider({ children, userId }: CountryDataProviderProps) {
  // Dev mode: allow viewing any country
  const { viewCountryId, isViewingOtherCountry } = useDevCountryView();
  // Demo mode: override with demo country for system owners
  const { isDemoActive, demoCountryId } = useDemoMode();

  const {
    data: userProfile,
    isLoading: profileLoading,
    error: profileError,
  } = api.users.getProfile.useQuery(undefined, { enabled: !!userId });

  // Demo mode takes priority, then dev view, then user's actual country
  const effectiveCountryId =
    isDemoActive && demoCountryId ? demoCountryId : (viewCountryId ?? userProfile?.countryId ?? "");

  const {
    data: country,
    isLoading: countryLoading,
    error: countryError,
  } = api.countries.getByIdWithEconomicData.useQuery(
    { id: effectiveCountryId },
    { enabled: !!effectiveCountryId }
  );

  // Get public system information (IxTime)
  const { data: ixTimeData, isLoading: ixTimeLoading } = api.system.getCurrentIxTime.useQuery();

  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId: effectiveCountryId },
    { enabled: !!effectiveCountryId }
  );

  const currentIxTime =
    typeof ixTimeData?.currentIxTimeNumber === "number" ? ixTimeData.currentIxTimeNumber : 0;

  const economyData = mapCountryToEconomyData(country);

  // Construct system status from available data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const systemStatus = {
    ixTime: currentIxTime,
    serverStatus: "operational",
    lastUpdate: new Date().toISOString(),
  };

  const isLoading = profileLoading || countryLoading || ixTimeLoading;

  const value = useMemo<CountryDataContextValue>(
    () => ({
      userProfile,
      country,
      economyData,
      systemStatus,
      activityRingsData,
      currentIxTime,
      isLoading: false,
      error: profileError?.message || countryError?.message || null,
      isViewingOtherCountry,
    }),
    [
      userProfile,
      country,
      economyData,
      systemStatus,
      activityRingsData,
      currentIxTime,
      profileError?.message,
      countryError?.message,
      isViewingOtherCountry,
    ]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="bg-muted h-12 w-12 animate-pulse rounded-full"></div>
            <div className="space-y-2">
              <div className="bg-muted h-8 w-64 animate-pulse rounded"></div>
              <div className="bg-muted h-4 w-48 animate-pulse rounded"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted h-24 animate-pulse rounded"></div>
            ))}
          </div>

          <div className="bg-muted h-96 animate-pulse rounded"></div>
        </div>
      </div>
    );
  }

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

  if (!isLoading && userProfile && !userProfile.countryId && !viewCountryId) {
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

  if (!isLoading && effectiveCountryId && !country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert className="mx-auto max-w-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {viewCountryId
              ? "Country not found. The country ID in your dev view may be invalid."
              : "Country not found or access denied. Please contact an administrator."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <CountryDataContext.Provider value={value}>{children}</CountryDataContext.Provider>;
}

export function useCountryData(): CountryDataContextValue {
  const context = useContext(CountryDataContext);
  if (context === undefined) {
    throw new Error("useCountryData must be used within a CountryDataProvider");
  }
  return context;
}
