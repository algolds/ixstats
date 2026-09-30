"use client";

import { useState, useEffect, useCallback } from "react";
import { unsplashService } from "~/lib/media";
import type { BannerMode, BaseCountryData } from "../_types";

export type { BannerMode };

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
  showCountryActions: boolean;
  setShowCountryActions: React.Dispatch<React.SetStateAction<boolean>>;
  /** The contextual landscape photo (Unsplash), once loaded. */
  unsplashImageUrl: string | undefined;
  bannerMode: BannerMode;
  customBannerUrl: string | undefined;
  /** The image for the current banner mode, or null (no cover). */
  resolvedBannerUrl: string | null;
  setBannerMode: (mode: BannerMode, customUrl?: string) => void;
}

/**
 * Profile shell state: the Country Actions sheet and the cover banner (mode saved per country
 * on this device; `dynamic` loads a contextual landscape photo).
 */
export function useCountryPageState(
  country:
    | (Partial<BaseCountryData> &
        Pick<BaseCountryData, "id" | "name" | "economicTier" | "populationTier"> & {
          flag?: string | null;
        })
    | null
    | undefined,
  flagUrl?: string | null
): UseCountryPageStateReturn {
  const [showCountryActions, setShowCountryActions] = useState(false);
  const [unsplashImageUrl, setUnsplashImageUrl] = useState<string | undefined>();

  const [bannerMode, setBannerModeState] = useState<BannerMode>(
    () => getBannerPref(country?.id).mode
  );
  const [customBannerUrl, setCustomBannerUrl] = useState<string | undefined>(
    () => getBannerPref(country?.id).customUrl
  );

  // Sync the saved preference when the country changes.
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

  // The contextual landscape photo, only when the dynamic cover is shown.
  useEffect(() => {
    if (bannerMode !== "dynamic" || !country || unsplashImageUrl) return;
    let cancelled = false;
    unsplashService
      .getCountryHeaderImage(
        country.economicTier,
        country.populationTier,
        country.name,
        country.continent || undefined
      )
      .then((imageData) => {
        if (cancelled || !imageData?.url) return;
        setUnsplashImageUrl(imageData.url);
        if (imageData.downloadUrl) void unsplashService.trackDownload(imageData.downloadUrl);
      })
      .catch(() => {
        if (!cancelled) setUnsplashImageUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [bannerMode, country, unsplashImageUrl]);

  const resolvedBannerUrl =
    bannerMode === "dynamic"
      ? (unsplashImageUrl ?? null)
      : bannerMode === "flag"
        ? (flagUrl ?? null)
        : bannerMode === "custom"
          ? (customBannerUrl ?? null)
          : null;

  return {
    showCountryActions,
    setShowCountryActions,
    unsplashImageUrl,
    bannerMode,
    customBannerUrl,
    resolvedBannerUrl,
    setBannerMode,
  };
}
