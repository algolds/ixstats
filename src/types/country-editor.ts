import type { Country } from "@prisma/client";

// The editor query omits the heavy geo columns (countries/economy.ts HEAVY_COUNTRY_GEO_OMIT).
export type CountryWithEditorFields = Omit<Country, "geometry" | "centroid" | "boundingBox"> & {
  nationalIdentity?: any;
  calculatedStats?: {
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
  };
  baselinePopulation?: number;
  baselineGdpPerCapita?: number;
  realGDPGrowthRate?: number;
  inflationRate?: number;
  currencyExchangeRate?: number;
  unemploymentRate?: number;
  laborForceParticipationRate?: number;
  employmentRate?: number;
  totalWorkforce?: number;
  averageWorkweekHours?: number;
  minimumWage?: number;
  averageAnnualIncome?: number;
  taxRevenueGDPPercent?: number;
  governmentRevenueTotal?: number;
  totalDebtGDPRatio?: number;
  budgetDeficitSurplus?: number;
  governmentBudgetGDPPercent?: number;
  totalGovernmentSpending?: number;
  spendingGDPPercent?: number;
  spendingPerCapita?: number;
  debtServiceCosts?: number;
  internalDebtGDPPercent?: number;
  externalDebtGDPPercent?: number;
  incomeInequalityGini?: number;
  povertyRate?: number;
  lifeExpectancy?: number;
  literacyRate?: number;
  socialMobilityIndex?: number;
  urbanPopulationPercent?: number;
  religion?: string;
  countryCode?: string;
  currencyName?: string;
  currencySymbol?: string;
  interestRates?: number;
};
