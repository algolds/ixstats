/**
 * Unified Builder Domain Type Definitions
 *
 * Consolidates country reference data, economic inputs, tax builder contracts,
 * and builder suggestions into a unified type surface.
 */

import type { GovernmentSpendingData } from "~/types/economics";
import type {
  TaxSystemInput,
  TaxCategoryInput,
  TaxBracketInput,
  TaxExemptionInput,
  TaxDeductionInput,
} from "~/types/tax-system";

// ─── 1. Country Reference & Core Indicators ─────────────────────────────────

export interface RealCountryData {
  name: string;
  countryCode: string;
  gdp: number;
  gdpPerCapita: number;
  taxRevenuePercent?: number;
  unemploymentRate: number;
  inflationRate?: number;
  population: number;
  growthRate?: number;
  governmentSpending?: number;
  continent?: string;
  region?: string;
  governmentType?: string;
  religion?: string;
  taxesLessSubsidies?: number;
  taxRevenueLcu?: string | number;
  womenBeatWifeDinnerPercent?: number | string;
  foundationCountryName?: string;
  lifeExpectancy?: number;
  literacyRate?: number;
  urbanizationRate?: number;
  economicTier?: "Developing" | "Emerging" | "Developed" | "Advanced";
  baselinePopulation?: number;
  baselineGdpPerCapita?: number;
  flag?: string;
  flagUrl?: string;
  coatOfArms?: string;
  coatOfArmsUrl?: string;
}

export interface CoreEconomicIndicators {
  totalPopulation: number;
  nominalGDP: number;
  gdpPerCapita: number;
  realGDPGrowthRate: number;
  inflationRate: number;
  currencyExchangeRate: number;
  giniCoefficient?: number;
}

export type CoreIndicatorsData = CoreEconomicIndicators;

export interface NationalIdentityData {
  countryName: string;
  officialName: string;
  governmentType: string;
  motto: string;
  mottoNative: string;
  capitalCity: string;
  largestCity: string;
  demonym: string;
  currency: string;
  officialLanguages: string;
  nationalLanguage: string;
  nationalAnthem: string;
  nationalReligion?: string;
  nationalDay: string;
  callingCode: string;
  internetTLD: string;
  drivingSide: "left" | "right";
  currencySymbol?: string;
  isoCode?: string;
  timeZone?: string;
  emergencyNumber?: string;
  postalCodeFormat?: string;
  weekStartDay?: string;
  nationalSport?: string;
  coordinatesLatitude?: string;
  coordinatesLongitude?: string;
}

// ─── 2. Economic Inputs & Demographic Contracts ─────────────────────────────

export interface LaborEmploymentData {
  laborForceParticipationRate: number;
  employmentRate: number;
  unemploymentRate: number;
  totalWorkforce: number;
  averageWorkweekHours: number;
  minimumWage: number;
  averageAnnualIncome: number;
  laborProtections: boolean;
  youthUnemploymentRate?: number;
  informalEmploymentRate?: number;
  femaleParticipationRate?: number;
  medianWage?: number;
  wageGrowthRate?: number;
}

export interface TaxRates {
  personalIncomeTaxRates: { bracket: number; rate: number }[];
  corporateTaxRates: { size: string; rate: number }[];
  salesTaxRate: number;
  propertyTaxRate: number;
  payrollTaxRate: number;
  exciseTaxRates: { type: string; rate: number }[];
  wealthTaxRate: number;
  income: { bracket: number; rate: number }[];
  corporate: { size: string; rate: number }[];
  sales: number;
}

export interface FiscalSystemData {
  taxRevenueGDPPercent: number;
  governmentRevenueTotal: number;
  taxRevenuePerCapita: number;
  taxRates: TaxRates;
  governmentBudgetGDPPercent: number;
  budgetDeficitSurplus: number;
  governmentSpendingByCategory: { category: string; amount: number; percent: number }[];
  internalDebtGDPPercent: number;
  externalDebtGDPPercent: number;
  totalDebtGDPRatio: number;
  debtPerCapita: number;
  interestRates: number;
  debtServiceCosts: number;
  incomeTaxRate: number;
  corporateTaxRate: number;
  salesTaxRate: number;
  progressiveTaxation: boolean;
  balancedBudgetRule: boolean;
  debtCeiling: number;
  antiAvoidance: boolean;
}

export interface EconomicClass {
  name: string;
  populationPercent: number;
  wealthPercent: number;
  averageIncome: number;
  color: string;
}

export interface IncomeWealthData {
  economicClasses: EconomicClass[];
  povertyRate: number;
  incomeInequalityGini: number;
  socialMobilityIndex: number;
}

export interface AgeGroup {
  group: string;
  percent: number;
  color: string;
}

export interface Region {
  name: string;
  population: number;
  urbanPercent: number;
  color: string;
}

export interface EducationLevel {
  level: string;
  percent: number;
  color: string;
}

export interface CitizenshipStatus {
  status: string;
  percent: number;
  color: string;
}

export interface DemographicData {
  ageDistribution: AgeGroup[];
  lifeExpectancy: number;
  urbanRuralSplit: { urban: number; rural: number };
  regions: Region[];
  educationLevels: EducationLevel[];
  literacyRate: number;
  citizenshipStatuses: CitizenshipStatus[];
  education: number;
  populationGrowthRate: number;
}

export interface GeographyData {
  continent?: string;
  region?: string;
}

export interface EconomicInputs {
  countryName: string;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  flagExtractedColors?: string[];
  nationalIdentity?: NationalIdentityData;
  geography?: GeographyData;
  coreIndicators: CoreEconomicIndicators;
  laborEmployment: LaborEmploymentData;
  fiscalSystem: FiscalSystemData;
  incomeWealth: IncomeWealthData;
  governmentSpending: GovernmentSpendingData;
  demographics: DemographicData;
}

// ─── 3. Tax Builder State ───────────────────────────────────────────────────

export interface TaxBuilderState {
  taxSystem: TaxSystemInput;
  categories: TaxCategoryInput[];
  brackets: Record<string, TaxBracketInput[]>;
  exemptions: TaxExemptionInput[];
  deductions: Record<string, TaxDeductionInput[]>;
  selectedAtomicTaxComponents?: string[];
  isValid: boolean;
  errors: Record<string, any>;
}

export type {
  TaxSystemInput,
  TaxCategoryInput,
  TaxBracketInput,
  TaxExemptionInput,
  TaxDeductionInput,
};

// ─── 4. Builder Suggestions ─────────────────────────────────────────────────

export interface SuggestionItem<T = any> {
  id: string;
  title: string;
  description?: string;
  severity: "info" | "warning" | "critical";
  diff?: string;
  payload?: T;
  action?: () => void;
}
