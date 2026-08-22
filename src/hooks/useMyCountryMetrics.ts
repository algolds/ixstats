"use client";

import { useMemo, useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useCountryData } from "~/components/mycountry/primitives";
import type { CardImageType } from "~/lib/cards/image-presets";
import { extractCountryImageData } from "~/lib/media";
import { useMetricDetailsModal } from "~/hooks/useMetricDetailsModal";
import { getWikiCache, setWikiCache } from "~/lib/wiki-os/editor/local-cache";
import { resolveImageUrl } from "~/lib/wiki-os/adapters/ixstates/unified-parser";

/**
 * Aggregates all data, query, and local UI state for the MyCountry tab system:
 * country/economy data, government structure, wiki queries, the "At a Glance"
 * metric-view toggles, wiki-sections collapse state, the card-image upload
 * modal state, and the metric-details modal.
 *
 * Extracted from MyCountryTabSystem during modular decomposition.
 * Behavior preserved exactly.
 *
 * @param activeTab The currently active top-level tab — used to gate the
 *                  `getWikiSections` query (only fetched on the overview tab).
 */
export function useMyCountryMetrics(activeTab: string) {
  const { user } = useUser();
  const { country, economyData, currentIxTime } = useCountryData();
  const countryImageData = useMemo(() => extractCountryImageData(country), [country]);

  // Fetch government structure for dynamic spending data
  const { data: governmentStructure } = api.government.getByCountryId.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id, staleTime: 5 * 60_000 }
  );

  // Toggle state for all MyCountry tabs (persisted at parent level)
  const [metricView, setMetricView] = useState({
    // At a Glance
    gdp: "perCapita" as "perCapita" | "total",
    population: "total" as "total" | "density",
    area: "km" as "km" | "mi",

    // Economy
    economyGdp: "total" as "total" | "perCapita",
    fiscal: "revenue" as "revenue" | "balance",
    trade: "exports" as "exports" | "imports",

    // Labor
    workforce: "count" as "count" | "participation",
    employment: "unemployed" as "unemployed" | "employed",
    compensation: "average" as "average" | "minimum",

    // Government
    structure: "state" as "state" | "government",
    budget: "spending" as "spending" | "percentage",
    debt: "total" as "total" | "ratio",
  });

  // Wiki intelligence data for overview tab (same 3-layer Redis/DB cached engine as Dossier)
  const wikiTargetName = country?.wikiPageTitle || country?.name?.replace(/_/g, " ") || "";
  const profileCacheKey = wikiTargetName ? `wiki-profile:${wikiTargetName}` : null;

  const { data: profileData, isLoading: wikiLoading } = api.wikiCache.getCountryProfile.useQuery(
    { countryName: wikiTargetName, includePageVariants: false, maxSections: 1 },
    {
      enabled: !!wikiTargetName,
      staleTime: 24 * 60 * 60_000,
      gcTime: 48 * 60 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      placeholderData: profileCacheKey ? (getWikiCache(profileCacheKey) ?? undefined) : undefined,
    }
  );

  useEffect(() => {
    if (profileData && profileCacheKey) setWikiCache(profileCacheKey, profileData);
  }, [profileData, profileCacheKey]);

  // Extract clean intro and coat of arms image from cached profile
  const wikiIntro = useMemo(() => {
    if (!profileData?.sections?.length) return null;
    return profileData.sections[0]?.content || null;
  }, [profileData]);

  const wikiImages = useMemo(() => {
    const infobox = profileData?.infobox as any;
    const coatFile =
      infobox?.image_coat ||
      infobox?.coat_of_arms ||
      infobox?.coatOfArms ||
      infobox?.emblem ||
      infobox?.symbol;

    if (coatFile && typeof coatFile === "string") {
      const resolved = resolveImageUrl(coatFile, (profileData?.wikiSource as any) || "ixwiki");
      if (resolved) {
        return [{ title: "Coat of Arms", url: resolved }];
      }
    }
    return null;
  }, [profileData]);

  // Card image upload modal state
  const [imageUploadModal, setImageUploadModal] = useState<{
    isOpen: boolean;
    cardType: CardImageType;
  }>({ isOpen: false, cardType: "national_identity" });

  // Metric details modal state for clickable cards
  const {
    isOpen: isMetricModalOpen,
    metricType,
    countryId: modalCountryId,
    openModal: openMetricModal,
    closeModal: closeMetricModal,
  } = useMetricDetailsModal();

  return {
    // Auth + core data
    user,
    country,
    economyData,
    currentIxTime,
    countryImageData,
    governmentStructure,
    // At a Glance metric view toggles
    metricView,
    setMetricView,
    // Wiki queries
    wikiIntro,
    wikiLoading,
    wikiImages,
    // Card image upload modal
    imageUploadModal,
    setImageUploadModal,
    // Metric details modal
    isMetricModalOpen,
    metricType,
    modalCountryId,
    openMetricModal,
    closeMetricModal,
  };
}
