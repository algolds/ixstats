"use client";

import React from "react";
import { useFactbookMetrics } from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import {
  OverviewTab,
  EconomyTab,
  LaborTab,
  GovernmentTab,
  GeographyTab,
} from "~/components/mycountry/shared/tabs";
import type { FactbookSection } from "~/lib/wiki/factbook-routes";

/**
 * FactbookSectionContent — renders the tab content for a single factbook
 * section, consuming the shared `useFactbookMetrics` context (which lives in
 * the factbook layout). Shared by the five factbook route pages.
 */
export function FactbookSectionContent({ section }: { section: FactbookSection }) {
  const {
    country,
    economyData,
    countryImageData,
    governmentStructure,
    metricView,
    setMetricView,
    wikiIntro,
    wikiLoading,
    wikiImages,
    setImageUploadModal,
    openMetricModal,
  } = useFactbookMetrics();

  if (!country) return null;

  switch (section) {
    case "overview":
      return (
        <OverviewTab
          country={country}
          wikiIntro={wikiIntro}
          wikiImages={wikiImages}
          wikiLoading={wikiLoading}
          metricView={metricView}
          setMetricViewAction={setMetricView}
        />
      );
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
          governmentStructure={governmentStructure}
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
