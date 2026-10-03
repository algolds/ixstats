"use client";

import React from "react";
import { useFactbookMetrics } from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import { CardImageUploadModal, useCountryData } from "~/components/mycountry/shared/primitives";
import {
  GdpDetailsModal,
  PopulationDetailsModal,
  LaborDetailsModal,
  GovernmentSpendingModal,
  DebtAnalysisModal,
  DemographicsHealthModal,
} from "~/components/mycountry/shared/modals/metric-details";

type MetricModalComponent = React.ComponentType<{
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName?: string;
}>;

/** The detail modal each metric type opens. */
const METRIC_MODALS: Record<string, MetricModalComponent> = {
  gdp: GdpDetailsModal,
  "gdp-per-capita": GdpDetailsModal,
  "total-gdp": GdpDetailsModal,
  population: PopulationDetailsModal,
  "population-density": PopulationDetailsModal,
  "labor-force": LaborDetailsModal,
  employment: LaborDetailsModal,
  unemployment: LaborDetailsModal,
  "government-spending": GovernmentSpendingModal,
  debt: DebtAnalysisModal,
  "demographics-health": DemographicsHealthModal,
  "life-expectancy": DemographicsHealthModal,
};

/**
 * FactbookModals — shared metric-details + card-image-upload modal renderer.
 *
 * Reads all modal state from `useFactbookMetrics()` context so the modals are
 * rendered once per provider tree (both the /mycountry tab system and the
 * public factbook route shell).
 */
export function FactbookModals() {
  const {
    country,
    imageUploadModal,
    setImageUploadModal,
    isMetricModalOpen,
    metricType,
    modalCountryId,
    closeMetricModal,
  } = useFactbookMetrics();
  const { isPublicReadOnly } = useCountryData();
  const ActiveMetricModal = metricType ? METRIC_MODALS[metricType] : undefined;

  return (
    <>
      {/* Card Image Upload Modal */}
      {!isPublicReadOnly && (
        <CardImageUploadModal
          isOpen={imageUploadModal.isOpen}
          onClose={() => setImageUploadModal({ ...imageUploadModal, isOpen: false })}
          countryId={country?.id || ""}
          cardType={imageUploadModal.cardType}
        />
      )}

      {/* Metric detail modal for the open metric */}
      {ActiveMetricModal && (
        <ActiveMetricModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}
    </>
  );
}
