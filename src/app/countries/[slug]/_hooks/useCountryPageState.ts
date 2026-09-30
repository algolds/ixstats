"use client";

import { useState, useEffect, useCallback } from "react";
import { unsplashService } from "~/lib/media";
import type { BannerMode, ProfileTabType, BaseCountryData } from "../_types";

export type { BannerMode, ProfileTabType as TabType };

function getBannerPref(countryId?: string): { mode: BannerMode; customUrl?: string } {
  if (typeof window === "undefined" || !countryId) return { mode: "dynamic" };
  try {
    const raw = localStorage.getItem(`banner-pref-${countryId}`);
    if (raw) return JSON.parse(raw) as { mode: BannerMode; customUrl?: string };
  } catch {
    /* ignore */
  }
  return { mode: "dynamic" };
}

function saveBannerPref(countryId: string, pref: { mode: BannerMode; customUrl?: string }): void {
  if (typeof window === "undefined" || !countryId) return;
  try {
    localStorage.setItem(`banner-pref-${countryId}`, JSON.stringify(pref));
  } catch {
    /* ignore */
  }
}

export interface UseCountryPageStateReturn {
  activeTab: ProfileTabType;
  setActiveTab: (tab: ProfileTabType) => void;
  showGdpPerCapita: boolean;
  showFullPopulation: boolean;
  showCountryActions: boolean;
  setShowCountryActions: React.Dispatch<React.SetStateAction<boolean>>;
  toggleGdpDisplay: () => void;
  togglePopulationDisplay: () => void;
  unsplashImageUrl: string | undefined;
  bannerMode: BannerMode;
  customBannerUrl: string | undefined;
  setBannerMode: (mode: BannerMode, customUrl?: string) => void;
}

export function useCountryPageState(
  country:
    | (Partial<BaseCountryData> &
        Pick<BaseCountryData, "id" | "name" | "economicTier" | "populationTier">)
    | undefined
): UseCountryPageStateReturn {
  // Tab management
  const [activeTab, setActiveTab] = useState<ProfileTabType>("overview");

  // Display toggles
  const [showGdpPerCapita, setShowGdpPerCapita] = useState(true);
  const [showFullPopulation, setShowFullPopulation] = useState(true);
  const [showCountryActions, setShowCountryActions] = useState(false);

  // Image data
  const [unsplashImageUrl, setUnsplashImageUrl] = useState<string | undefined>();

  // Banner mode with lazy init
  const [bannerMode, setBannerModeState] = useState<BannerMode>(() => getBannerPref(country?.id).mode);
  const [customBannerUrl, setCustomBannerUrl] = useState<string | undefined>(
    () => getBannerPref(country?.id).customUrl
  );

  // Sync preference if country changes
  useEffect(() => {
    if (country?.id) {
      const pref = getBannerPref(country.id);
      setBannerModeState(pref.mode);
      setCustomBannerUrl(pref.customUrl);
    }
  }, [country?.id]);

  const setBannerMode = useCallback(
    (mode: BannerMode, customUrl?: string) => {
      if (!country?.id) return;
      setBannerModeState(mode);
      setCustomBannerUrl(customUrl);
      saveBannerPref(country.id, { mode, customUrl });
    },
    [country?.id]
  );

  // Optional contextual header image loading with graceful fallback
  useEffect(() => {
    if (country && !unsplashImageUrl && typeof window !== "undefined") {
      unsplashService
        .getCountryHeaderImage(
          country.economicTier,
          country.populationTier,
          country.name,
          country.continent || undefined
        )
        .then((imageData) => {
          if (imageData?.url) {
            setUnsplashImageUrl(imageData.url);
            if (imageData.downloadUrl) {
              void unsplashService.trackDownload(imageData.downloadUrl);
            }
          }
        })
        .catch(() => {
          setUnsplashImageUrl(undefined);
        });
    }
  }, [country, unsplashImageUrl]);

  const toggleGdpDisplay = useCallback(() => {
    setShowGdpPerCapita((prev) => !prev);
  }, []);

  const togglePopulationDisplay = useCallback(() => {
    setShowFullPopulation((prev) => !prev);
  }, []);

  return {
    // Tab state
    activeTab,
    setActiveTab,

    // Display toggles
    showGdpPerCapita,
    showFullPopulation,
    showCountryActions,
    setShowCountryActions,
    toggleGdpDisplay,
    togglePopulationDisplay,

    // Image data
    unsplashImageUrl,

    // Banner
    bannerMode,
    customBannerUrl,
    setBannerMode,
  };
}
