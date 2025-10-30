"use client";

import React, { useMemo } from "react";
import { DollarSign, Users, Zap, CheckCircle, AlertTriangle } from "lucide-react";
import { MetricCard } from "../../../primitives/enhanced";
import type { EconomyBuilderState, EconomicHealthMetrics } from "~/types/economy-builder";
import type { EconomicInputs } from "../../../lib/economy-data-service";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";

// Sub-components
import { ConfigurationSummary } from "./preview/ConfigurationSummary";
import { EffectivenessPanel } from "./preview/EffectivenessPanel";
import { ValidationResults } from "./preview/ValidationResults";
import { SectorSummaryCards } from "./preview/SectorSummaryCards";
import { LaborDemographicsSummary } from "./preview/LaborDemographicsSummary";

// Utilities
import {
  calculateComponentEffectiveness,
  calculateSectorSummary,
  calculateLaborSummary,
  calculateDemographicsSummary,
  validateConfiguration,
} from "./utils/previewCalculations";

/**
 * Props for the EconomyPreviewTab component
 *
 * @interface EconomyPreviewTabProps
 * @property {EconomyBuilderState} economyBuilder - Complete economy builder state with all configurations
 * @property {EconomicHealthMetrics} economicHealthMetrics - Calculated economic health and performance metrics
 * @property {EconomicComponentType[]} selectedComponents - Array of selected atomic economic components
 * @property {EconomicInputs} economicInputs - Base economic inputs including GDP, population, and core indicators
 */
interface EconomyPreviewTabProps {
  economyBuilder: EconomyBuilderState;
  economicHealthMetrics: EconomicHealthMetrics;
  selectedComponents: EconomicComponentType[];
  economicInputs: EconomicInputs;
}

/**
 * EconomyPreviewTab - Comprehensive preview and validation interface for economy configuration
 *
 * This component provides a read-only preview of the complete economy configuration with calculated
 * summaries, validation results, effectiveness scores, and visualizations. It aggregates data from
 * all economy builder tabs (sectors, labor, demographics) and displays comprehensive metrics, warnings,
 * and recommendations before final submission.
 *
 * Key features:
 * - Configuration summary with all economic inputs and builder settings
 * - Real-time validation with error and warning messages
 * - Component effectiveness calculation showing synergies and conflicts
 * - Economic health metrics (sustainability, resilience, competitiveness)
 * - Sector distribution summaries and visualizations
 * - Labor market and demographics aggregated data
 * - GDP per capita, population, and key economic indicators
 *
 * The preview tab uses utility functions to calculate derived metrics and validate that all
 * configuration values are within acceptable ranges (e.g., percentages sum to 100%).
 *
 * @component
 * @param {EconomyPreviewTabProps} props - Component props
 * @param {EconomyBuilderState} props.economyBuilder - The complete economy builder state to preview
 * @param {EconomicHealthMetrics} props.economicHealthMetrics - Health and performance metrics for the economy
 * @param {EconomicComponentType[]} props.selectedComponents - Atomic economic components selected by the user
 * @param {EconomicInputs} props.economicInputs - Core economic inputs (GDP, population, currency, etc.)
 *
 * @returns {JSX.Element} Rendered preview interface with summaries, metrics, and validation results
 *
 * @example
 * ```tsx
 * <EconomyPreviewTab
 *   economyBuilder={economyBuilderState}
 *   economicHealthMetrics={calculatedHealthMetrics}
 *   selectedComponents={['FREE_MARKET', 'EXPORT_ORIENTED']}
 *   economicInputs={economicInputsData}
 * />
 * ```
 */
export function EconomyPreviewTab({
  economyBuilder,
  economicHealthMetrics,
  selectedComponents,
  economicInputs,
}: EconomyPreviewTabProps) {
  // Calculate summaries using utility functions
  const componentEffectiveness = useMemo(
    () => calculateComponentEffectiveness(selectedComponents),
    [selectedComponents]
  );

  const sectorSummary = useMemo(
    () => calculateSectorSummary(economyBuilder.sectors),
    [economyBuilder.sectors]
  );

  const laborSummary = useMemo(
    () => calculateLaborSummary(economyBuilder.laborMarket),
    [economyBuilder.laborMarket]
  );

  const demographicsSummary = useMemo(
    () => calculateDemographicsSummary(economyBuilder.demographics),
    [economyBuilder.demographics]
  );

  const validationStatus = useMemo(
    () => validateConfiguration(economyBuilder, sectorSummary, laborSummary),
    [economyBuilder, sectorSummary, laborSummary]
  );

  return (
    <div className="space-y-6">
      {/* Configuration Summary with Header */}
      <ConfigurationSummary economyBuilder={economyBuilder} economicInputs={economicInputs} />

      {/* Validation Status */}
      <ValidationResults validationStatus={validationStatus} />

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="Economic Health"
          value={`${(economicHealthMetrics?.economicHealthScore ?? 0).toFixed(0)}/100`}
          icon={
            (economicHealthMetrics?.economicHealthScore ?? 0) >= 80 ? CheckCircle : AlertTriangle
          }
          sectionId="preview"
          trend={(economicHealthMetrics?.economicHealthScore ?? 0) >= 80 ? "up" : "neutral"}
        />
        <MetricCard
          label="Component Effectiveness"
          value={`${componentEffectiveness.toFixed(0)}%`}
          icon={Zap}
          sectionId="preview"
          trend={componentEffectiveness >= 80 ? "up" : "neutral"}
        />
        <MetricCard
          label="GDP Per Capita"
          value={`$${Math.round(economicInputs.coreIndicators.gdpPerCapita).toLocaleString()}`}
          icon={DollarSign}
          sectionId="preview"
          trend="neutral"
        />
        <MetricCard
          label="Population"
          value={`${demographicsSummary.totalPopulation.toLocaleString()}`}
          icon={Users}
          sectionId="preview"
          trend="neutral"
        />
      </div>

      {/* Labor and Demographics */}
      <LaborDemographicsSummary
        laborSummary={laborSummary}
        demographicsSummary={demographicsSummary}
      />

      {/* Effectiveness Panel */}
      <EffectivenessPanel
        componentEffectiveness={componentEffectiveness}
        selectedComponents={selectedComponents}
        economicHealthMetrics={economicHealthMetrics}
      />

      {/* Visualizations */}
      <SectorSummaryCards economyBuilder={economyBuilder} />
    </div>
  );
}
