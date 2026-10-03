"use client";

import { Skeleton } from "~/components/ui/skeleton";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { api } from "~/trpc/react";
import { mapCountryToEconomyData } from "~/lib/economy/data-mapper";
import { WarningTriangle as AlertTriangle, Crown } from "iconoir-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createAbsoluteUrl } from "~/lib/utils";
import { useDevCountryView } from "~/context/DevCountryViewContext";
import { useDemoMode } from "~/context/DemoModeContext";

import type { RouterOutputs } from "~/trpc/react";

export type CountryWithEconomicData = RouterOutputs["countries"]["getByIdWithEconomicData"];
type UserProfileOutput = RouterOutputs["users"]["getProfile"];
type ActivityRingsOutput = RouterOutputs["countries"]["getActivityRingsData"];
export type MappedEconomyData = ReturnType<typeof mapCountryToEconomyData>;

interface SystemStatusData {
  ixTime: number;
  serverStatus: string;
  lastUpdate: string;
}

interface CountryDataContextValue {
  userProfile: UserProfileOutput | null | undefined;
  country: CountryWithEconomicData | null | undefined;
  economyData: MappedEconomyData;
  systemStatus: SystemStatusData;
  activityRingsData: ActivityRingsOutput | null | undefined;
  currentIxTime: number;
  isLoading: boolean;
  error: string | null;
  /** True when viewing another country in dev mode */
  isViewingOtherCountry: boolean;
  isPublicReadOnly?: boolean;
}

const CountryDataContext = createContext<CountryDataContextValue | undefined>(undefined);

interface CountryDataProviderProps {
  children: ReactNode;
  userId: string;
  countryId?: string;
  isPublicReadOnly?: boolean;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <Alert className="mx-auto max-w-2xl">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{children}</AlertDescription>
      </Alert>
    </div>
  );
}

function CountryLoadingSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8" role="status" aria-label="Loading country">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="rounded-card h-24" />
          ))}
        </div>

        <Skeleton className="rounded-card h-96" />
      </div>
    </div>
  );
}

function NoCountryAssigned() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
        <CardHeader className="text-center">
          <Crown className="text-label-secondary mx-auto mb-4 h-12 w-12" />
          <CardTitle className="text-title-1">No country assigned</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-label-secondary mb-6">
            You don't have a country assigned to your account yet. Contact an administrator to claim
            a country or browse available countries to request ownership.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => (window.location.href = createAbsoluteUrl("/countries"))}>
              Browse countries
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = createAbsoluteUrl("/admin"))}
            >
              Contact admin
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** The loading, error or onboarding view that replaces the page, or null when the data is ready. */
function blockingView({
  isLoading,
  isPublicReadOnly,
  userProfile,
  viewCountryId,
  effectiveCountryId,
  hasCountry,
}: {
  isLoading: boolean;
  isPublicReadOnly: boolean;
  userProfile: UserProfileOutput | null | undefined;
  viewCountryId: string | null | undefined;
  effectiveCountryId: string;
  hasCountry: boolean;
}): ReactNode {
  if (isLoading) return <CountryLoadingSkeleton />;

  if (!isPublicReadOnly && !userProfile) {
    return (
      <Notice>
        Unable to load user profile. Please try refreshing the page or contact an administrator.
      </Notice>
    );
  }

  if (!isPublicReadOnly && userProfile && !userProfile.countryId && !viewCountryId) {
    return <NoCountryAssigned />;
  }

  if (effectiveCountryId && !hasCountry) {
    return (
      <Notice>
        {viewCountryId
          ? "Country not found. The country ID in your dev view may be invalid."
          : "Country not found or access denied. Please contact an administrator."}
      </Notice>
    );
  }

  return null;
}

function useCountryQueries({
  userId,
  countryId,
  isPublicReadOnly,
}: Pick<CountryDataProviderProps, "userId" | "countryId"> & { isPublicReadOnly: boolean }) {
  // Dev mode: allow viewing any country
  const { viewCountryId } = useDevCountryView();
  // Demo mode: override with demo country for system owners
  const { isDemoActive, demoCountryId } = useDemoMode();

  const profile = api.users.getProfile.useQuery(undefined, {
    enabled: !isPublicReadOnly && !!userId,
  });

  // Demo mode takes priority, then dev view, then user's actual country
  const effectiveCountryId =
    countryId ||
    (isDemoActive && demoCountryId
      ? demoCountryId
      : (viewCountryId ?? profile.data?.countryId ?? ""));

  const enabled = !!effectiveCountryId;
  const country = api.countries.getByIdWithEconomicData.useQuery(
    { id: effectiveCountryId },
    { enabled }
  );
  const ixTime = api.system.getCurrentIxTime.useQuery();
  const activityRings = api.countries.getActivityRingsData.useQuery(
    { countryId: effectiveCountryId },
    { enabled }
  );

  return { profile, country, ixTime, activityRings, effectiveCountryId, viewCountryId };
}

export function CountryDataProvider({
  children,
  userId,
  countryId,
  isPublicReadOnly = false,
}: CountryDataProviderProps) {
  const { isViewingOtherCountry } = useDevCountryView();
  const { profile, country, ixTime, activityRings, effectiveCountryId, viewCountryId } =
    useCountryQueries({ userId, countryId, isPublicReadOnly });
  const userProfile = profile.data;

  const currentIxTime =
    typeof ixTime.data?.currentIxTimeNumber === "number" ? ixTime.data.currentIxTimeNumber : 0;
  const isLoading =
    (!isPublicReadOnly && profile.isLoading) || country.isLoading || ixTime.isLoading;

  const blocker = blockingView({
    isLoading,
    isPublicReadOnly,
    userProfile,
    viewCountryId,
    effectiveCountryId,
    hasCountry: !!country.data,
  });
  if (blocker) return blocker;

  const value: CountryDataContextValue = {
    userProfile: userProfile ?? null,
    country: country.data ?? null,
    economyData: mapCountryToEconomyData(country.data),
    systemStatus: {
      ixTime: currentIxTime,
      serverStatus: "operational",
      lastUpdate: new Date().toISOString(),
    },
    activityRingsData: activityRings.data ?? null,
    currentIxTime,
    isLoading: false,
    error: (!isPublicReadOnly && profile.error?.message) || country.error?.message || null,
    isViewingOtherCountry: isPublicReadOnly ? false : isViewingOtherCountry,
    isPublicReadOnly,
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
