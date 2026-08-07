"use client";

import React from "react";
import { useFactbookMetrics } from "./FactbookMetricsProvider";
import { CardImageUploadModal, useCountryData } from "./primitives";
import { GdpDetailsModal } from "~/components/modals/GdpDetailsModal";
import { PopulationDetailsModal } from "~/components/modals/PopulationDetailsModal";
import {
  LaborDetailsModal,
  GovernmentSpendingModal,
  DebtAnalysisModal,
  DemographicsHealthModal,
} from "~/components/modals/metric-details";

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

      {/* Metric Detail Modals */}
      {(metricType === "gdp" || metricType === "gdp-per-capita" || metricType === "total-gdp") && (
        <GdpDetailsModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {(metricType === "population" || metricType === "population-density") && (
        <PopulationDetailsModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {(metricType === "labor-force" ||
        metricType === "employment" ||
        metricType === "unemployment") && (
        <LaborDetailsModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {metricType === "government-spending" && (
        <GovernmentSpendingModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {metricType === "debt" && (
        <DebtAnalysisModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {(metricType === "demographics-health" || metricType === "life-expectancy") && (
        <DemographicsHealthModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}
    </>
  );
}
