// src/hooks/index.ts
// Custom hooks exports for clean imports

export { useFlagPreloader, useGlobalFlagPreloader } from "./useFlagPreloader";

// Phase 2: Shared builder hooks with standardized caching
export { useCountryGovernment, STALE_TIME as GOVERNMENT_STALE_TIME } from "./useCountryGovernment";
export { useCountryTaxSystem, STALE_TIME as TAX_STALE_TIME } from "./useCountryTaxSystem";

// Re-export types
export type {} from "./useFlagPreloader";
