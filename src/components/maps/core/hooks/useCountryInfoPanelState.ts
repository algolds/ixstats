"use client";

import { useState, useCallback, useMemo } from "react";
import { useCountryPanelData } from "~/hooks/useCountryPanelData";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "../IxWorldMap";

import {
  formatNumber,
  formatPopulation,
  formatCurrency,
} from "~/lib/utils/format-utils";

export { formatNumber, formatPopulation };

export function formatGdpPerCapita(n: number | null | undefined): string {
  if (n == null) return "—";
  return formatCurrency(n, "USD", false);
}

export function formatArea(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} km²`;
}

interface UseCountryInfoPanelStateProps {
  country: SelectedCountry;
  onNeighborClick?: (neighbor: {
    featureId: string;
    countryId: string | null;
    displayName: string;
    centroidLng?: number;
    centroidLat?: number;
  }) => void;
}

export function useCountryInfoPanelState({
  country,
  onNeighborClick,
}: UseCountryInfoPanelStateProps) {
  const { summary, neighbors, sovereignty, wikiSections, wikiImages, isLoading } =
    useCountryPanelData(country.countryId, country.displayName);

  const displayName = summary?.name ?? country.displayName;
  const wikiName = country.displayName;
  const { flagUrl } = useFlag(displayName);

  const { data: wikiRichIntro } = api.countries.getWikiRichIntro.useQuery(
    { countryName: wikiName },
    {
      enabled: !!wikiName,
      staleTime: 24 * 60 * 60_000,
      gcTime: 48 * 60 * 60_000,
    }
  );

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const isOwner = useMemo(() => {
    return !!(
      userProfile?.countryId &&
      country.countryId &&
      userProfile.countryId === country.countryId
    );
  }, [userProfile?.countryId, country.countryId]);

  const [activeTab, setActiveTab] = useState<"overview" | "info" | "geography">("overview");
  const [activeModal, setActiveModal] = useState<"gdp" | "population" | null>(null);
  const [introExpanded, setIntroExpanded] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const hasGeoTab = !!country.countryId;
  const hasInfoTab = useMemo(() => {
    return !!(wikiRichIntro || wikiSections || wikiImages);
  }, [wikiRichIntro, wikiSections, wikiImages]);

  const handleNeighborClick = useCallback(
    (neighbor: {
      featureId: string;
      countryId: string | null;
      displayName: string;
      centroidLng?: number;
      centroidLat?: number;
    }) => {
      onNeighborClick?.(neighbor);
    },
    [onNeighborClick]
  );

  return {
    summary,
    neighbors,
    sovereignty,
    wikiSections,
    wikiImages,
    isLoading,
    displayName,
    wikiName,
    flagUrl,
    wikiRichIntro,
    isOwner,
    activeTab,
    setActiveTab,
    activeModal,
    setActiveModal,
    introExpanded,
    setIntroExpanded,
    sectionsExpanded,
    setSectionsExpanded,
    lightboxSrc,
    setLightboxSrc,
    hasGeoTab,
    hasInfoTab,
    handleNeighborClick,
  };
}
