// Intelligence Center Components - Central Export Hub

// Main Intelligence Components
export { SecureCommunications } from "./SecureCommunications";
export { DiplomaticOperationsHub } from "./DiplomaticOperationsHub";
export { AnalyticsDashboard } from "./AnalyticsDashboard";

// Supporting Components
export { IntelligenceHeader } from "./IntelligenceHeader";

// Types and Configuration
export type {
  FocusMetric,
  FocusAction,
  FocusCard,
  IntelligenceBriefing,
  IntelligenceCenterContentProps,
} from "../_config/types";

export {
  severityConfig,
  areaConfig,
  briefingTypeConfig,
  type AreaType,
  type BriefingType,
  type SeverityType,
} from "../_config/intelligence-config";
