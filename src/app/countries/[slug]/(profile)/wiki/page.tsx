"use client";

import React from "react";
import { useCountryData } from "~/components/mycountry/primitives";
import { useCountryProfile } from "../../_context/CountryProfileContext";
import { WikiTab } from "../../_components/tabs/WikiTab";
import { Skeleton } from "~/components/ui/skeleton";

export default function CountryWikiPage() {
  const { country } = useCountryData();
  const { unifiedProfile, isOwnCountry, isLoading } = useCountryProfile();

  if (isLoading && !unifiedProfile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!unifiedProfile?.wiki) {
    return (
      <WikiTab
        wiki={{
          linked: false,
          username: country?.name ?? null,
          registration: null,
          editCount: 0,
          groups: [],
          lorewards: null,
          recentEdits: [],
          awardHistory: [],
        }}
        countryName={country?.name}
        isOwnCountry={isOwnCountry}
      />
    );
  }

  return (
    <WikiTab
      wiki={unifiedProfile.wiki}
      countryName={unifiedProfile.country?.name || country?.name}
      isOwnCountry={isOwnCountry}
    />
  );
}

