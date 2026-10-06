"use client";

import React from "react";
import { useFactbookMetrics } from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import {
  EconomyTab,
  LaborTab,
  GovernmentTab,
  GeographyTab,
} from "~/components/mycountry/shared/tabs";
import type { FactbookSection } from "~/lib/country/factbook-routes";

/**
 * FactbookSectionContent: renders the tab content for a single factbook section route, consuming
 * the shared `useFactbookMetrics` context (which lives in the factbook layout). Shared by the
 * four `/factbook/<section>` route pages. The overview is the country's own URL, rendered by
 * `CommandProfileView`, so it has no case here.
 */
export function FactbookSectionContent({
  section,
}: {
  section: Exclude<FactbookSection, "overview">;
}) {
  const {
    country,
    economyData,
    countryImageData,
    governmentStructure,
    metricView,
    setMetricView,
    setImageUploadModal,
    openMetricModal,
  } = useFactbookMetrics();

  if (!country) return null;

  switch (section) {
    case "economy":
      return (
        <EconomyTab
          country={country}
          economyData={economyData}
          countryImageData={countryImageData}
          setImageUploadModalAction={setImageUploadModal}
          openMetricModalAction={openMetricModal}
          metricView={metricView}
          setMetricViewAction={setMetricView}
        />
      );
    case "labor":
      return (
        <LaborTab
          country={country}
          economyData={economyData}
          countryImageData={countryImageData}
          setImageUploadModalAction={setImageUploadModal}
          openMetricModalAction={openMetricModal}
          metricView={metricView}
          setMetricViewAction={setMetricView}
        />
      );
    case "government":
      return (
        <GovernmentTab
          country={country}
          economyData={economyData}
          countryImageData={countryImageData}
          governmentStructure={governmentStructure ?? null}
          setImageUploadModalAction={setImageUploadModal}
          openMetricModalAction={openMetricModal}
          metricView={metricView}
          setMetricViewAction={setMetricView}
        />
      );
    case "geography":
      return <GeographyTab />;
    default:
      return null;
  }
}
