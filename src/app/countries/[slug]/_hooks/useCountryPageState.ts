"use client";

import { useState, useEffect, useCallback } from "react";
import { unsplashService } from "~/lib/media";
import type { CountryInfobox } from "~/types/dossier";
import type { BannerMode, ProfileTabType, BaseCountryData } from "../_types";

export type { BannerMode, ProfileTabType as TabType };

function getBannerPref(countryId: string): { mode: BannerMode; customUrl?: string } {
  if (typeof window === "undefined") return { mode: "dynamic" };
  try {
    const raw = localStorage.getItem(`banner-pref-${countryId}`);
    if (raw) return JSON.parse(raw) as { mode: BannerMode; customUrl?: string };
  } catch {
    /* ignore */
  }
  return { mode: "dynamic" };
}

function saveBannerPref(countryId: string, pref: { mode: BannerMode; customUrl?: string }): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`banner-pref-${countryId}`, JSON.stringify(pref));
  } catch {
    /* ignore */
  }
}

export interface UseCountryPageStateReturn {
  activeTab: ProfileTabType;
  setActiveTab: (tab: ProfileTabType) => void;
  isMounted: boolean;
  showGdpPerCapita: boolean;
  showFullPopulation: boolean;
  showCountryActions: boolean;
  setShowCountryActions: React.Dispatch<React.SetStateAction<boolean>>;
  toggleGdpDisplay: () => void;
  togglePopulationDisplay: () => void;
  wikiInfobox: CountryInfobox | null;
  wikiIntro: string[];
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
  const [isMounted, setIsMounted] = useState(false);

  // Display toggles
  const [showGdpPerCapita, setShowGdpPerCapita] = useState(true);
  const [showFullPopulation, setShowFullPopulation] = useState(true);
  const [showCountryActions, setShowCountryActions] = useState(false);

  // Wiki data — managed directly by useMyCountryMetrics via api.wikiCache.getCountryProfile
  const wikiInfobox: CountryInfobox | null = null;
  const wikiIntro: string[] = [];

  // Image data
  const [unsplashImageUrl, setUnsplashImageUrl] = useState<string | undefined>();

  // Banner mode
  const [bannerMode, setBannerModeState] = useState<BannerMode>("dynamic");
  const [customBannerUrl, setCustomBannerUrl] = useState<string | undefined>();

  // Prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load banner preference from localStorage
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

  // Load Unsplash header image
  useEffect(() => {
    if (country && !unsplashImageUrl) {
      unsplashService
        .getCountryHeaderImage(
          country.economicTier,
          country.populationTier,
          country.name,
          country.continent || undefined
        )
        .then((imageData) => {
          setUnsplashImageUrl(imageData.url);
          if (imageData.downloadUrl) {
            void unsplashService.trackDownload(imageData.downloadUrl);
          }
        })
        .catch((error) => {
          console.warn("Failed to load Unsplash image:", error);
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
    isMounted,

    // Display toggles
    showGdpPerCapita,
    showFullPopulation,
    showCountryActions,
    setShowCountryActions,
    toggleGdpDisplay,
    togglePopulationDisplay,

    // Wiki data
    wikiInfobox,
    wikiIntro,

    // Image data
    unsplashImageUrl,

    // Banner
    bannerMode,
    customBannerUrl,
    setBannerMode,
  };
}
