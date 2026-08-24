"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import type { RouterOutputs } from "~/trpc/react";

export type UnifiedProfileData = RouterOutputs["ixnayid"]["getUnifiedProfile"];

export interface DelegateData {
  username?: string | null;
  roleName?: string | null;
  forumAvatarUrl?: string | null;
  isStaff?: boolean;
  membershipTier?: string | null;
}

interface CountryProfileContextValue {
  slug: string;
  isOwnCountry: boolean;
  unifiedProfile: UnifiedProfileData | null | undefined;
  delegate: DelegateData | null;
  isLoading: boolean;
}

const CountryProfileContext = createContext<CountryProfileContextValue>({
  slug: "",
  isOwnCountry: false,
  unifiedProfile: null,
  delegate: null,
  isLoading: false,
});

export function CountryProfileProvider({
  slug,
  isOwnCountry,
  unifiedProfile,
  delegate,
  isLoading = false,
  children,
}: {
  slug: string;
  isOwnCountry: boolean;
  unifiedProfile: UnifiedProfileData | null | undefined;
  delegate: DelegateData | null;
  isLoading?: boolean;
  children: ReactNode;
}) {
  return (
    <CountryProfileContext.Provider
      value={{
        slug,
        isOwnCountry,
        unifiedProfile,
        delegate,
        isLoading,
      }}
    >
      {children}
    </CountryProfileContext.Provider>
  );
}

export function useCountryProfile(): CountryProfileContextValue {
  return useContext(CountryProfileContext);
}
