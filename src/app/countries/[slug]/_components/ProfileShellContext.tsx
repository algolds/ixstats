"use client";

import { createContext, useContext } from "react";
import type { CountryWithEconomicData } from "~/components/mycountry/shared/primitives/CountryDataProvider";
import type { HeroCover } from "~/components/country-profile/CountryHero";

/** What the `(profile)` layout resolves once and shares with the profile and its sub-routes. */
export interface ProfileShellValue {
  slug: string;
  country: CountryWithEconomicData;
  /** `country.flag`, else the flag service. */
  flagUrl: string | null;
  /** The signed-in viewer owns this country. */
  isOwner: boolean;
  currentIxTime: number;
  /** The cover banner; `onChange` is set for the owner only. */
  cover: HeroCover;
}

const ProfileShellContext = createContext<ProfileShellValue | null>(null);

export const ProfileShellProvider = ProfileShellContext.Provider;

/** The profile shell; only valid under `(profile)/layout.tsx` once the country has loaded. */
export function useProfileShell(): ProfileShellValue {
  const value = useContext(ProfileShellContext);
  if (!value) throw new Error("useProfileShell must be used inside the (profile) layout");
  return value;
}
