/**
 * Reference country and core indicator types for builder systems.
 */

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
