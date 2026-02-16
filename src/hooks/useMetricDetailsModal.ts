"use client";

import { useState, useCallback } from "react";

/**
 * MetricType - Types of metrics that can be displayed in detail modals
 */
export type MetricType =
  | "gdp"
  | "gdp-per-capita"
  | "total-gdp"
  | "population"
  | "population-density"
  | "labor-force"
  | "employment"
  | "unemployment"
  | "government-spending"
  | "fiscal-revenue"
  | "debt"
  | "demographics-health"
  | "life-expectancy"
  | "sector-breakdown";

/**
 * MetricDetailsModalState - State for managing which metric modal is open
 */
export interface MetricDetailsModalState {
  isOpen: boolean;
  metricType: MetricType | null;
  metricId: string | null;
  countryId: string | null;
}

/**
 * useMetricDetailsModal - Hook for managing metric details modal state
 *
 * Provides a centralized way to open/close metric detail modals
 * and track which metric is currently being viewed.
 *
 * @example
 * ```tsx
 * const { isOpen, metricType, openModal, closeModal } = useMetricDetailsModal();
 *
 * // Open GDP modal for a country
 * openModal('gdp-per-capita', countryId);
 *
 * // Render the appropriate modal
 * {metricType === 'gdp-per-capita' && (
 *   <GdpDetailsModal isOpen={isOpen} onClose={closeModal} countryId={countryId} />
 * )}
 * ```
 */
export function useMetricDetailsModal() {
  const [state, setState] = useState<MetricDetailsModalState>({
    isOpen: false,
    metricType: null,
    metricId: null,
    countryId: null,
  });

  /**
   * Open a metric details modal
   * @param metricType - The type of metric to display
   * @param countryId - The country ID to fetch data for
   * @param metricId - Optional specific metric identifier
   */
  const openModal = useCallback(
    (metricType: MetricType, countryId: string, metricId?: string) => {
      setState({
        isOpen: true,
        metricType,
        metricId: metricId || null,
        countryId,
      });
    },
    []
  );

  /**
   * Close the currently open modal
   */
  const closeModal = useCallback(() => {
    setState({
      isOpen: false,
      metricType: null,
      metricId: null,
      countryId: null,
    });
  }, []);

  /**
   * Check if a specific metric type modal is open
   * @param type - The metric type to check
   */
  const isModalOpen = useCallback(
    (type: MetricType) => {
      return state.isOpen && state.metricType === type;
    },
    [state.isOpen, state.metricType]
  );

  return {
    ...state,
    openModal,
    closeModal,
    isModalOpen,
  };
}

/**
 * Helper to determine which modal component to render based on metric type
 */
export function getModalTypeForMetric(metricType: MetricType): "gdp" | "population" | "labor" | "government" | "demographics" {
  switch (metricType) {
    case "gdp":
    case "gdp-per-capita":
    case "total-gdp":
      return "gdp";
    case "population":
    case "population-density":
      return "population";
    case "labor-force":
    case "employment":
    case "unemployment":
      return "labor";
    case "government-spending":
    case "fiscal-revenue":
    case "debt":
      return "government";
    case "demographics-health":
    case "life-expectancy":
    case "sector-breakdown":
      return "demographics";
    default:
      return "gdp";
  }
}
