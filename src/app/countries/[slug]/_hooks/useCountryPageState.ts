"use client";

// Refactored from main CountryPage - manages all client-side state for country page
import { useState, useEffect, useCallback } from "react";
import { unsplashService } from "~/lib/unsplash-service";
import type { CountryInfobox } from "~/lib/mediawiki-service";
import { api } from "~/trpc/react";
import { getWikiCache, setWikiCache } from "~/lib/wiki-local-cache";

type TabType = "overview" | "mycountry" | "lore" | "activity" | "diplomacy";
export type BannerMode = "dynamic" | "flag" | "gradient" | "custom";

function getBannerPref(countryId: string): { mode: BannerMode; customUrl?: string } {
  if (typeof window === "undefined") return { mode: "dynamic" };
  try {
    const raw = localStorage.getItem(`banner-pref-${countryId}`);
    if (raw) return JSON.parse(raw) as { mode: BannerMode; customUrl?: string };
  } catch { /* ignore */ }
  return { mode: "dynamic" };
}

function saveBannerPref(countryId: string, pref: { mode: BannerMode; customUrl?: string }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`banner-pref-${countryId}`, JSON.stringify(pref));
  } catch { /* ignore */ }
}

interface Country {
  id: string;
  name: string;
  economicTier: string;
  populationTier: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  continent?: string | null;
}

export function useCountryPageState(country: Country | undefined) {
  // Tab management
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isMounted, setIsMounted] = useState(false);

  // Display toggles
  const [showGdpPerCapita, setShowGdpPerCapita] = useState(true);
  const [showFullPopulation, setShowFullPopulation] = useState(false);
  const [showCountryActions, setShowCountryActions] = useState(false);

  // Wiki data — fetched via tRPC (server-side cached) with localStorage placeholder
  const richIntroCacheKey = country?.name ? `rich-intro:${country.name}` : null;
  const infoboxCacheKey = country?.name ? `infobox:${country.name}` : null;

  const { data: wikiRichIntro } = api.countries.getWikiRichIntro.useQuery(
    { countryName: country!.name },
    {
      enabled: !!country?.name,
      staleTime: 24 * 60 * 60_000,
      gcTime: 48 * 60 * 60_000,
      placeholderData: richIntroCacheKey ? getWikiCache(richIntroCacheKey) ?? undefined : undefined,
    }
  );

  const { data: wikiInfoboxData } = api.countries.getWikiInfoboxCached.useQuery(
    { countryName: country!.name },
    {
      enabled: !!country?.name,
      staleTime: 24 * 60 * 60_000,
      gcTime: 48 * 60 * 60_000,
      placeholderData: infoboxCacheKey ? getWikiCache(infoboxCacheKey) ?? undefined : undefined,
    }
  );

  // Persist tRPC results to localStorage for instant future loads
  useEffect(() => {
    if (wikiRichIntro && richIntroCacheKey) setWikiCache(richIntroCacheKey, wikiRichIntro);
  }, [wikiRichIntro, richIntroCacheKey]);

  useEffect(() => {
    if (wikiInfoboxData && infoboxCacheKey) setWikiCache(infoboxCacheKey, wikiInfoboxData);
  }, [wikiInfoboxData, infoboxCacheKey]);

  const wikiInfobox = (wikiInfoboxData as CountryInfobox | null) ?? null;
  const wikiIntro = wikiRichIntro?.paragraphs ?? [];

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

  const setBannerMode = useCallback((mode: BannerMode, customUrl?: string) => {
    if (!country?.id) return;
    setBannerModeState(mode);
    setCustomBannerUrl(customUrl);
    saveBannerPref(country.id, { mode, customUrl });
  }, [country?.id]);

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
