// src/app/admin/countries/inspector/inspector-types.ts
// Shared types and constants for Country Inspector

export enum EconomicTier {
  IMPOVERISHED = "Impoverished",
  DEVELOPING = "Developing",
  DEVELOPED = "Developed",
  HEALTHY = "Healthy",
  STRONG = "Strong",
  VERY_STRONG = "Very Strong",
  EXTRAVAGANT = "Extravagant",
}

export enum PopulationTier {
  TIER_1 = "1",
  TIER_2 = "2",
  TIER_3 = "3",
  TIER_4 = "4",
  TIER_5 = "5",
  TIER_6 = "6",
  TIER_7 = "7",
  TIER_X = "X",
}

export interface MockEffect {
  id: string;
  type: string;
  value: number;
  description: string;
  duration: number;
}

export const TIER_MAX_GROWTH: Record<EconomicTier, number> = {
  [EconomicTier.IMPOVERISHED]: 0.1,
  [EconomicTier.DEVELOPING]: 0.075,
  [EconomicTier.DEVELOPED]: 0.05,
  [EconomicTier.HEALTHY]: 0.035,
  [EconomicTier.STRONG]: 0.0275,
  [EconomicTier.VERY_STRONG]: 0.015,
  [EconomicTier.EXTRAVAGANT]: 0.005,
};
