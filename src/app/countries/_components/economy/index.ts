// src/app/countries/_components/economy/index.ts

// Core economic components
export { CoreEconomicIndicators } from './CoreEconomicIndicators';
export type { CoreEconomicIndicators as CoreEconomicIndicatorsData, RealCountryData } from './CoreEconomicIndicators';

export { LaborEmployment } from './LaborEmployment';
export type { LaborEmploymentData, RealCountryData as LaborRealCountryData } from './LaborEmployment';

export { FiscalSystem } from './FiscalSystem';
export type { FiscalSystemData, RealCountryFiscalData } from './FiscalSystem';

// Display and summary components
export { EconomicDataDisplay } from './EconomicDataDisplay';
export { EconomicSummaryWidget } from './EconomicSummaryWidget';

// Analysis and comparison components
export { ComparativeAnalysis } from './ComparativeAnalysis';
export { HistoricalEconomicTracker } from './HistoricalEconomicTracker';

// Advanced components
export { EconomicModelingEngine } from './EconomicModelingEngine';

// Future components (placeholders for Phase 3-5)
// export { IncomeWealthDistribution } from './IncomeWealthDistribution';
// export { GovernmentSpending } from './GovernmentSpending';
// export { Demographics } from './Demographics';
// export { FiscalPolicy } from './FiscalPolicy';
// export { MonetaryPolicy } from './MonetaryPolicy';
// export { TradePolicy } from './TradePolicy';

// Re-export types for convenience
export type {
  EconomicSummaryData,
  HistoricalDataPoint,
  CountryComparison,
  RegionalData,
  MetricCardProps
} from './EconomicSummaryWidget';

export type {
  HistoricalEconomicTrackerProps,
  EconomicEvent as HistoricalEconomicEvent
} from './HistoricalEconomicTracker';

export type {
  ComparativeAnalysisProps,
  CountryComparison as ComparisonData
} from './ComparativeAnalysis';