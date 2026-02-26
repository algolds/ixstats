export { CountryHeader } from "./CountryHeader";
export { CountryMetricsGrid } from "./CountryMetricsGrid";
export { VitalityRings, type VitalityRingData, type RingConfig } from "./VitalityRings";
export { AuthenticationGuard } from "./AuthenticationGuard";
export { CountryDataProvider, useCountryData } from "./CountryDataProvider";
export { useMyCountryUnifiedData } from "./useMyCountryUnifiedData";

// Hero primitives
export { AmbientBackground, HeroMetrics, HeroMetricsCompact, HeroSection } from "./hero";

// Tab animation primitives
export {
  AnimatedTabContent,
  AnimatedTabTrigger,
  TabIndicator,
  tabVariants,
  tabFadeVariants,
  tabSpring,
  tabTween,
  staggerContainer,
  staggerItem,
  cardEntrance,
  // Metric card grid components
  MetricCardGrid,
  EconomyMetricGrid,
  LaborMetricGrid,
  GovernmentMetricGrid,
  DemographicsMetricGrid,
  AnalyticsMetricGrid,
  type MetricGridItem,
  type MetricCardGridProps,
  type MetricTheme,
  // Vitality rings components
  VitalityRingsDisplay,
  QuickVitalityRings,
  createVitalityRingsFromCountry,
  defaultVitalityRings,
  type VitalityRing,
  type VitalityRingsDisplayProps,
  // Sector breakdown components
  SectorBreakdownCard,
  QuickSectorGrid,
  type SectorData,
  type SectorBreakdownCardProps,
  // Policy badge components
  PolicyBadgeGrid,
  createPoliciesFromSpending,
  defaultPolicies,
  type PolicyBadge,
  type PolicyBadgeGridProps,
  // Stat gauge components
  StatGauge,
  StatGaugeGrid,
  DistributionBar,
  type StatGaugeProps,
  type StatGaugeGridProps,
  type DistributionSegment,
  type DistributionBarProps,
  // Interactive metric components
  InteractiveMetric,
  MetricTooltip,
  AnimatedValue,
  type InteractiveMetricProps,
} from "./tabs";

// Section header background
export { SectionHeaderBackground } from "./SectionHeaderBackground";

// Tab hero banner
export { TabHeroBanner } from "./TabHeroBanner";

// Card background image components
export {
  CardBackgroundImage,
  useCardImage,
  useAllCardImages,
} from "./CardBackgroundImage";

export { CardImageUploadModal } from "./CardImageUploadModal";

// Enhanced metric tooltip for clickable cards
export {
  EnhancedMetricTooltip,
  type EnhancedMetricTooltipProps,
} from "./EnhancedMetricTooltip";

// Re-export card image types for convenience
export type { CardImageType } from "~/lib/card-image-presets";
