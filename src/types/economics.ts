// src/types/economics.ts
// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORT HUB — All economy types derived from Zod schemas.
// ❌ Do NOT define interfaces or types here.
// ✅ Only re-export from ~/schemas/economics.schema
// ═══════════════════════════════════════════════════════════════════════════

export type {
  // Root types
  EconomyData,
  Economy,
  // Section data types (extended, for UI/mapper)
  CoreEconomicIndicatorsData,
  LaborEmploymentData,
  FiscalSystemData,
  IncomeWealthDistributionData,
  GovernmentSpendingData,
  DemographicsData,
  // Strict section types (for templates/factory)
  CoreEconomicIndicators,
  LaborEmployment,
  FiscalSystem,
  IncomeWealth,
  GovernmentSpending,
  Demographics,
  // Sub-object types
  EmploymentBySector,
  EmploymentByType,
  SkillsAndProductivity,
  DemographicsAndConditions,
  RegionalEmployment,
  SocialProtection,
  SpendingCategory,
} from "~/schemas/economics.schema";

// Re-export schemas for runtime validation
export {
  EconomyDataSchema,
  EconomySchema,
  CoreEconomicIndicatorsDataSchema,
  LaborEmploymentDataSchema,
  FiscalSystemDataSchema,
  IncomeWealthDataSchema,
  GovernmentSpendingDataSchema,
  DemographicsDataSchema,
  EconomicTierSchema,
  EconomicClassSchema,
  SpendingCategorySchema,
  TaxBracketSchema,
  CorporateSizeSchema,
  RegionTypeSchema,
  parseEconomy,
  parseEconomyData,
  safeParseEconomy,
  safeParseEconomyData,
} from "~/schemas/economics.schema";
