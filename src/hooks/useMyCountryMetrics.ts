"use client";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useCountryData, type CardImageType } from "~/components/mycountry/primitives";
import { extractCountryImageData } from "~/lib/country-image-engine";
import { useMetricDetailsModal } from "~/hooks/useMetricDetailsModal";

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
    { enabled: !!country?.id }
  );

  // Toggle state for At a Glance metrics (overview tab)
  const [metricView, setMetricView] = useState({
    gdp: "perCapita" as "perCapita" | "total",
    population: "total" as "total" | "density",
    area: "km" as "km" | "mi",
  });

  // Wiki sections collapse state (overview tab)
  const [wikiSectionsOpen, setWikiSectionsOpen] = useState(false);

  // Wiki data for overview tab (fetched by country name, no wikiPageTitle gate)
  const { data: wikiIntro, isLoading: wikiLoading } = api.countries.getWikiRichIntro.useQuery(
    { countryName: country?.name || "" },
    { staleTime: 24 * 60 * 60_000, enabled: !!country?.name }
  );
  const { data: wikiImages } = api.countries.getWikiPageImages.useQuery(
    { countryName: country?.name || "" },
    { staleTime: 24 * 60 * 60_000, enabled: !!country?.name }
  );
  const { data: wikiSections, isLoading: sectionsLoading } = api.countries.getWikiSections.useQuery(
    { countryName: country?.name || "" },
    { staleTime: 60 * 60_000, enabled: !!country?.name && activeTab === "overview" }
  );

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
    // Wiki sections collapse
    wikiSectionsOpen,
    setWikiSectionsOpen,
    // Wiki queries
    wikiIntro,
    wikiLoading,
    wikiImages,
    wikiSections,
    sectionsLoading,
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
