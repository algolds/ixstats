"use client";

import { Skeleton } from "~/components/ui/skeleton";
import type { CountryWithEconomicData } from "~/components/mycountry/shared/primitives/CountryDataProvider";
import { useCountryProfileLayer } from "../../_hooks/useCountryProfileLayer";

/** What the profile layout hands each prototype. */
export interface PrototypeViewProps {
  country: CountryWithEconomicData;
  flagUrl: string | null;
  isOwner: boolean;
  isSignedIn: boolean;
  currentIxTime: number;
  /** Switch to the Factbook deep-dive (layout-owned). */
  onOpenFactbook: () => void;
}

export function useProfilePrototypeLayer({
  country,
  flagUrl,
  isOwner,
  isSignedIn,
  currentIxTime,
}: PrototypeViewProps) {
  return useCountryProfileLayer({ country, flagUrl, isOwner, isSignedIn, currentIxTime });
}

export function ProfileLayerLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading profile">
      <Skeleton className="rounded-card h-48 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="rounded-card h-80 lg:col-span-2" />
        <Skeleton className="rounded-card h-80" />
      </div>
    </div>
  );
}
