/**
 * Economy Data Service - Type Definitions
 *
 * Data transformation and parsing utilities for economic data.
 * Handles real-world country data, economic inputs, and data persistence.
 *
 * @module economy-data-service
 */

// src/app/economy/lib/economy-data-service.ts
import type { GovernmentSpendingData } from "~/types/economics";
import economyData from "./economy-data.json";

export type { GovernmentSpendingData };

/**
 * RealCountryData - Real-world country economic data
 *
 * Contains economic and demographic data parsed from real-world datasets
 * (Excel/CSV files). Used as reference data for country builder and
 * economic comparisons. Data sourced from World Bank and other international
 * economic databases.
 *
 * @interface RealCountryData
 * @property {string} name - Country name
 * @property {string} countryCode - ISO 3166-1 alpha-2 country code (e.g., 'us', 'gb')
 * @property {number} gdp - Gross Domestic Product in USD
 * @property {number} gdpPerCapita - GDP per capita in USD
 * @property {number} [taxRevenuePercent] - Tax revenue as percentage of GDP (0-100)
 * @property {number} unemploymentRate - Unemployment rate percentage (0-100)
 * @property {number} [inflationRate] - Annual inflation rate percentage
 * @property {number} population - Total population count
 * @property {number} [growthRate] - Annual GDP growth rate percentage
 * @property {number} [governmentSpending] - Government spending in USD
 * @property {string} [continent] - Continent name
 * @property {string} [region] - Geographic region
 * @property {string} [governmentType] - Type of government system
 * @property {string} [religion] - Predominant religion
 * @property {number} [taxesLessSubsidies] - Net taxes less subsidies
 * @property {string|number} [taxRevenueLcu] - Tax revenue in local currency units
 * @property {number|string} [womenBeatWifeDinnerPercent] - Social indicator (legacy field)
 * @property {string} [foundationCountryName] - Original country name for Wiki Commons API
 * @property {number} [lifeExpectancy] - Life expectancy in years
 * @property {number} [literacyRate] - Literacy rate percentage (0-100)
 * @property {number} [urbanizationRate] - Urbanization percentage (0-100)
 * @property {'Developing'|'Emerging'|'Developed'|'Advanced'} [economicTier] - Economic development tier
 * @property {number} [baselinePopulation] - Baseline population for calculations
 * @property {number} [baselineGdpPerCapita] - Baseline GDP per capita for calculations
 * @property {number} [maxGdpGrowthRate] - Maximum sustainable growth rate
 * @property {string} [flag] - Flag image URL
 *
 * @example
 * ```ts
 * const countryData: RealCountryData = {
 *   name: 'United States',
 *   countryCode: 'us',
 *   gdp: 25000000000000,
 *   gdpPerCapita: 75000,
 *   taxRevenuePercent: 25,
 *   unemploymentRate: 3.8,
 *   inflationRate: 2.5,
 *   population: 333000000,
 *   economicTier: 'Advanced',
 *   flag: 'https://flagcdn.com/w320/us.png'
 * };
 * ```
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
  governmentType?: string; // Added governmentType
  religion?: string; // Added religion
  taxesLessSubsidies?: number;
  taxRevenueLcu?: string | number;
  womenBeatWifeDinnerPercent?: number | string;
  foundationCountryName?: string; // Original foundation country name for Wiki Commons API calls
  lifeExpectancy?: number;
  literacyRate?: number;
  urbanizationRate?: number;
  // Additional fields for country builder
  economicTier?: "Developing" | "Emerging" | "Developed" | "Advanced";
  baselinePopulation?: number;
  baselineGdpPerCapita?: number;
  flag?: string;
  flagUrl?: string;
  coatOfArms?: string;
  coatOfArmsUrl?: string;
}

/**
 * CoreEconomicIndicators - Fundamental economic metrics
 *
 * Core economic data points used throughout the economy builder.
 * These are the primary metrics for economic calculations and comparisons.
 *
 * @interface CoreEconomicIndicators
 * @property {number} totalPopulation - Total population count
 * @property {number} nominalGDP - Nominal GDP in base currency (not adjusted for inflation)
 * @property {number} gdpPerCapita - GDP divided by population
 * @property {number} realGDPGrowthRate - Inflation-adjusted GDP growth percentage
 * @property {number} inflationRate - Annual inflation rate percentage
 * @property {number} currencyExchangeRate - Exchange rate to USD (1 USD = X local currency)
 * @property {number} [giniCoefficient] - Income inequality measure (0-1, lower is more equal)
 *
 * @example
 * ```ts
 * const indicators: CoreEconomicIndicators = {
 *   totalPopulation: 50000000,
 *   nominalGDP: 1000000000000,
 *   gdpPerCapita: 20000,
 *   realGDPGrowthRate: 3.5,
 *   inflationRate: 2.0,
 *   currencyExchangeRate: 1.0,
 *   giniCoefficient: 0.35
 * };
 * ```
 */
export interface CoreEconomicIndicators {
  totalPopulation: number;
  nominalGDP: number;
  gdpPerCapita: number;
  realGDPGrowthRate: number;
  inflationRate: number;
  currencyExchangeRate: number;
  giniCoefficient?: number;
}

/**
 * CoreIndicatorsData - Type alias for compatibility
 *
 * @typedef {CoreEconomicIndicators} CoreIndicatorsData
 */
export type CoreIndicatorsData = CoreEconomicIndicators;

/**
 * NationalIdentityData - National identity and symbols
 *
 * Contains cultural, political, and administrative information about a nation.
 * Used for country profile displays and identity configuration.
 *
 * @interface NationalIdentityData
 * @property {string} countryName - Common country name
 * @property {string} officialName - Official long-form name
 * @property {string} governmentType - Type of government (e.g., 'Republic', 'Monarchy')
 * @property {string} motto - National motto in English
 * @property {string} mottoNative - National motto in native language
 * @property {string} capitalCity - Capital city name
 * @property {string} largestCity - Most populous city
 * @property {string} demonym - Term for citizens (e.g., 'American', 'French')
 * @property {string} currency - Currency name
 * @property {string} officialLanguages - Official language(s)
 * @property {string} nationalLanguage - Most widely spoken language
 * @property {string} nationalAnthem - National anthem title
 * @property {string} [nationalReligion] - Official or predominant religion
 * @property {string} nationalDay - National day/independence day
 * @property {string} callingCode - International calling code (e.g., '+1', '+44')
 * @property {string} internetTLD - Top-level domain (e.g., '.us', '.uk')
 * @property {'left'|'right'} drivingSide - Side of road for driving
 * @property {string} [currencySymbol] - Currency symbol (e.g., '$', '€')
 * @property {string} [isoCode] - ISO 3166-1 alpha-3 code
 * @property {string} [timeZone] - Primary time zone
 * @property {string} [emergencyNumber] - Emergency services number
 * @property {string} [postalCodeFormat] - Postal/ZIP code format
 * @property {string} [weekStartDay] - First day of week (e.g., 'Monday', 'Sunday')
 * @property {string} [nationalSport] - National sport
 * @property {string} [coordinatesLatitude] - Capital latitude coordinates
 * @property {string} [coordinatesLongitude] - Capital longitude coordinates
 *
 * @example
 * ```ts
 * const identity: NationalIdentityData = {
 *   countryName: 'United States',
 *   officialName: 'United States of America',
 *   governmentType: 'Federal Republic',
 *   motto: 'In God We Trust',
 *   mottoNative: 'In God We Trust',
 *   capitalCity: 'Washington, D.C.',
 *   largestCity: 'New York City',
 *   demonym: 'American',
 *   currency: 'United States Dollar',
 *   officialLanguages: 'English',
 *   nationalLanguage: 'English',
 *   nationalAnthem: 'The Star-Spangled Banner',
 *   nationalDay: 'July 4',
 *   callingCode: '+1',
 *   internetTLD: '.us',
 *   drivingSide: 'right'
 * };
 * ```
 */
export interface NationalIdentityData {
  countryName: string;
  officialName: string;
  governmentType: string;
  motto: string;
  mottoNative: string;
  capitalCity: string;
  largestCity: string;
  capitalCityId?: string;
  largestCityId?: string;
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
  nationalAnimal?: string;
  nationalBird?: string;
  nationalFish?: string;
  founders?: string;
  nationalFlower?: string;
  nationalDish?: string;
  nationalFruit?: string;
  nationalDrink?: string;
  nationalInstrument?: string;
  nationalSymbol?: string;
  nationalAnimalImage?: string;
  nationalBirdImage?: string;
  nationalFishImage?: string;
  foundersImage?: string;
  nationalFlowerImage?: string;
  nationalDishImage?: string;
  nationalFruitImage?: string;
  nationalDrinkImage?: string;
  nationalInstrumentImage?: string;
  nationalSymbolImage?: string;
  coordinatesLatitude?: string;
  coordinatesLongitude?: string;
}

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
  // Additional properties for compatibility
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

/**
 * EconomicInputs - Complete economic data structure for country builder
 *
 * Central data structure that aggregates all economic, demographic, and fiscal
 * information for a country. This is the primary interface used throughout the
 * economy builder and serves as the data contract between UI and backend.
 *
 * @interface EconomicInputs
 * @property {string} countryName - Name of the country
 * @property {string} [flagUrl] - URL to flag image
 * @property {string} [coatOfArmsUrl] - URL to coat of arms image
 * @property {string[]} [flagExtractedColors] - Color palette extracted from flag
 * @property {NationalIdentityData} [nationalIdentity] - National symbols and identity
 * @property {GeographyData} [geography] - Geographic information
 * @property {CoreEconomicIndicators} coreIndicators - Primary economic metrics
 * @property {LaborEmploymentData} laborEmployment - Labor market data
 * @property {FiscalSystemData} fiscalSystem - Tax and fiscal policy data
 * @property {IncomeWealthData} incomeWealth - Income distribution and wealth data
 * @property {GovernmentSpendingData} governmentSpending - Government budget allocation
 * @property {DemographicData} demographics - Population and demographic data
 *
 * @example
 * ```ts
 * const economicInputs: EconomicInputs = {
 *   countryName: 'Example Nation',
 *   flagUrl: 'https://example.com/flag.png',
 *   coreIndicators: {
 *     totalPopulation: 10000000,
 *     nominalGDP: 500000000000,
 *     gdpPerCapita: 50000,
 *     realGDPGrowthRate: 3.5,
 *     inflationRate: 2.0,
 *     currencyExchangeRate: 1.0
 *   },
 *   laborEmployment: {
 *     laborForceParticipationRate: 65,
 *     employmentRate: 95,
 *     unemploymentRate: 5,
 *     // ... additional fields
 *   },
 *   // ... other required fields
 * };
 * ```
 */
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

/**
 * EconomicComparison - Country comparison analysis result
 *
 * Provides comparative analysis of economic metrics against similar countries.
 * Used to help users understand their country's relative position and tier.
 *
 * @interface EconomicComparison
 * @property {string} metric - Name of the metric being compared
 * @property {number} userValue - User's country value for this metric
 * @property {Array} comparableCountries - List of similar countries
 * @property {string} comparableCountries[].name - Country name
 * @property {number} comparableCountries[].value - Country's value for this metric
 * @property {string} comparableCountries[].tier - Economic tier classification
 * @property {string} analysis - Generated analysis text explaining the comparison
 * @property {'Developing'|'Emerging'|'Developed'|'Advanced'} tier - User's country tier
 *
 * @example
 * ```ts
 * const comparison: EconomicComparison = {
 *   metric: 'GDP per Capita',
 *   userValue: 45000,
 *   comparableCountries: [
 *     { name: 'Spain', value: 43000, tier: 'Developed' },
 *     { name: 'Italy', value: 42000, tier: 'Developed' }
 *   ],
 *   analysis: 'Your GDP per capita is similar to Spain and Italy...',
 *   tier: 'Developed'
 * };
 * ```
 */
export interface EconomicComparison {
  metric: string;
  userValue: number;
  comparableCountries: Array<{
    name: string;
    value: number;
    tier: string;
  }>;
  analysis: string;
  tier: "Developing" | "Emerging" | "Developed" | "Advanced";
}

// Helper function to create default economic inputs
export function createDefaultEconomicInputs(referenceCountry?: RealCountryData): EconomicInputs {
  const basePopulation = referenceCountry?.population || 10000000;
  const baseGDPPerCapita = referenceCountry?.gdpPerCapita || 25000;
  const baseNominalGDP = basePopulation * baseGDPPerCapita;
  const baseTaxRevenuePercent = referenceCountry?.taxRevenuePercent || 20;
  const baseUnemploymentRate = referenceCountry?.unemploymentRate || 5;

  // Calculate default government spending
  const totalSpending = (baseNominalGDP * Math.min(baseTaxRevenuePercent + 2, 25)) / 100;

  return {
    countryName: referenceCountry ? `New ${referenceCountry.name}` : "New Nation",
    flagUrl: referenceCountry?.flag || referenceCountry?.flagUrl || "", // Initialize flagUrl
    coatOfArmsUrl: referenceCountry?.coatOfArms || referenceCountry?.coatOfArmsUrl || "", // Initialize coatOfArmsUrl
    coreIndicators: {
      totalPopulation: basePopulation,
      nominalGDP: baseNominalGDP,
      gdpPerCapita: baseGDPPerCapita,
      realGDPGrowthRate: 3.0,
      inflationRate: 2.0,
      currencyExchangeRate: 1.0,
    },
    laborEmployment: {
      laborForceParticipationRate: 65,
      employmentRate: 100 - baseUnemploymentRate,
      unemploymentRate: baseUnemploymentRate,
      totalWorkforce: Math.round(basePopulation * 0.65),
      averageWorkweekHours: 40,
      minimumWage: Math.round(baseGDPPerCapita * 0.02),
      averageAnnualIncome: Math.round(baseGDPPerCapita * 0.8),
      laborProtections: true,
    },
    fiscalSystem: {
      taxRevenueGDPPercent: baseTaxRevenuePercent,
      governmentRevenueTotal: (baseNominalGDP * baseTaxRevenuePercent) / 100,
      taxRevenuePerCapita: (baseNominalGDP * baseTaxRevenuePercent) / (100 * basePopulation),
      taxRates: {
        personalIncomeTaxRates: [
          { bracket: 0, rate: 0 },
          { bracket: 20000, rate: 10 },
          { bracket: 50000, rate: 22 },
          { bracket: 100000, rate: 32 },
          { bracket: 200000, rate: 37 },
        ],
        corporateTaxRates: [
          { size: "Small (< $1M revenue)", rate: 15 },
          { size: "Medium ($1M - $10M)", rate: 21 },
          { size: "Large (> $10M)", rate: 25 },
        ],
        salesTaxRate: 8.5,
        propertyTaxRate: 1.2,
        payrollTaxRate: 15.3,
        exciseTaxRates: [
          { type: "Fuel", rate: 25 },
          { type: "Alcohol", rate: 35 },
          { type: "Tobacco", rate: 50 },
          { type: "Luxury Goods", rate: 15 },
        ],
        wealthTaxRate: 0.5,
        // Compatibility aliases
        income: [
          { bracket: 0, rate: 0 },
          { bracket: 20000, rate: 10 },
          { bracket: 50000, rate: 22 },
          { bracket: 100000, rate: 32 },
          { bracket: 200000, rate: 37 },
        ],
        corporate: [
          { size: "Small (< $1M revenue)", rate: 15 },
          { size: "Medium ($1M - $10M)", rate: 21 },
          { size: "Large (> $10M)", rate: 25 },
        ],
        sales: 8.5,
      },
      governmentBudgetGDPPercent: Math.min(baseTaxRevenuePercent + 2, 25),
      budgetDeficitSurplus:
        (baseNominalGDP * baseTaxRevenuePercent) / 100 -
        (baseNominalGDP * Math.min(baseTaxRevenuePercent + 2, 25)) / 100,
      governmentSpendingByCategory: [
        { category: "Defense", amount: 0, percent: 15 },
        { category: "Education", amount: 0, percent: 18 },
        { category: "Healthcare", amount: 0, percent: 22 },
        { category: "Infrastructure", amount: 0, percent: 12 },
        { category: "Social Security", amount: 0, percent: 20 },
        { category: "Other", amount: 0, percent: 13 },
      ],
      internalDebtGDPPercent: 45,
      externalDebtGDPPercent: 25,
      totalDebtGDPRatio: 70,
      debtPerCapita: (baseNominalGDP * 0.7) / basePopulation,
      interestRates: 3.5,
      debtServiceCosts: baseNominalGDP * 0.7 * 0.035,
      incomeTaxRate: 22,
      corporateTaxRate: 25,
      salesTaxRate: 10,
      progressiveTaxation: true,
      balancedBudgetRule: false,
      debtCeiling: 80,
      antiAvoidance: true,
    },
    incomeWealth: {
      economicClasses: [
        {
          name: "Upper Class",
          populationPercent: 5,
          wealthPercent: 40,
          averageIncome: baseGDPPerCapita * 5,
          color: "#4C51BF",
        },
        {
          name: "Upper Middle Class",
          populationPercent: 15,
          wealthPercent: 30,
          averageIncome: baseGDPPerCapita * 2,
          color: "#4299E1",
        },
        {
          name: "Middle Class",
          populationPercent: 30,
          wealthPercent: 20,
          averageIncome: baseGDPPerCapita,
          color: "#48BB78",
        },
        {
          name: "Lower Middle Class",
          populationPercent: 30,
          wealthPercent: 8,
          averageIncome: baseGDPPerCapita * 0.5,
          color: "#ECC94B",
        },
        {
          name: "Lower Class",
          populationPercent: 20,
          wealthPercent: 2,
          averageIncome: baseGDPPerCapita * 0.2,
          color: "#F56565",
        },
      ],
      povertyRate: 15,
      incomeInequalityGini: 0.38,
      socialMobilityIndex: 60,
    },
    governmentSpending: {
      totalSpending,
      spendingGDPPercent: Math.min(baseTaxRevenuePercent + 2, 25),
      spendingPerCapita: totalSpending / basePopulation,
      spendingCategories: [
        {
          category: "Defense",
          amount: totalSpending * 0.15,
          percent: 15,
          icon: "Shield",
          color: "#4C51BF",
          description: "Military, security, and defense infrastructure",
        },
        {
          category: "Education",
          amount: totalSpending * 0.18,
          percent: 18,
          icon: "GraduationCap",
          color: "#4299E1",
          description: "Schools, universities, and education programs",
        },
        {
          category: "Healthcare",
          amount: totalSpending * 0.22,
          percent: 22,
          icon: "Heart",
          color: "#F56565",
          description: "Public health services and medical care",
        },
        {
          category: "Infrastructure",
          amount: totalSpending * 0.12,
          percent: 12,
          icon: "Truck",
          color: "#48BB78",
          description: "Roads, utilities, and public works",
        },
        {
          category: "Social Security",
          amount: totalSpending * 0.2,
          percent: 20,
          icon: "Users2",
          color: "#ECC94B",
          description: "Welfare, pensions, and social benefits",
        },
        {
          category: "Other",
          amount: totalSpending * 0.13,
          percent: 13,
          icon: "MoreHorizontal",
          color: "#A0AEC0",
          description: "Administration, debt service, and miscellaneous",
        },
      ],
      deficitSurplus: (baseNominalGDP * baseTaxRevenuePercent) / 100 - totalSpending,
      education: totalSpending * 0.18,
      healthcare: totalSpending * 0.22,
      socialSafety: totalSpending * 0.2,
      // Policy flags - all default to false for clean slate
      performanceBasedBudgeting: true,
      universalBasicServices: false,
      greenInvestmentPriority: true,
      digitalGovernmentInitiative: true,
      zeroBasedBudgeting: false,
      publicPrivatePartnerships: false,
      participatoryBudgeting: false,
      emergencyReserveFund: false,
      socialImpactBonds: false,
      childWelfareFirstPolicy: false,
      preventiveCareEmphasis: false,
      infrastructureBankFund: false,
      universalBasicIncome: false,
      progressiveTaxation: false,
      carbonTax: false,
      wealthTax: false,
      financialTransactionTax: false,
      universalHealthcare: false,
      freeEducation: false,
      affordableHousing: false,
      elderlyCare: false,
      disabilitySupport: false,
      mentalHealthServices: false,
      stemEducationFocus: false,
      vocationalTraining: false,
      adultEducation: false,
      earlyChildhoodEducation: false,
      smartCityInitiative: false,
      publicTransportExpansion: false,
      renewableEnergyTransition: false,
      highSpeedInternet: false,
      waterInfrastructure: false,
      researchDevelopmentFund: false,
      startupIncubators: false,
      patentReform: false,
      openDataInitiative: false,
      cybersecurityInitiative: false,
      borderSecurity: false,
      disasterPreparedness: false,
      crimePrevention: false,
      carbonNeutrality: false,
      biodiversityProtection: false,
      wasteReduction: false,
      greenBuildingStandards: false,
      sustainableAgriculture: false,
      criminalJusticeReform: false,
      legalAidExpansion: false,
      restorativeJustice: false,
      courtSystemModernization: false,
      artsCultureFunding: false,
      heritagePreservation: false,
      multiculturalPrograms: false,
      languagePreservation: false,
      ruralDevelopment: false,
      ruralHealthcare: false,
      ruralBroadband: false,
      agriculturalSupport: false,
      foreignAidProgram: false,
      refugeeSupport: false,
      diplomaticEngagement: false,
      tradePromotion: false,
      transparencyInitiative: false,
      citizenEngagement: false,
      antiCorruption: false,
      publicServiceReform: false,
    },
    demographics: {
      ageDistribution: [
        { group: "0-15", percent: 20, color: "#4299E1" },
        { group: "16-64", percent: 65, color: "#48BB78" },
        { group: "65+", percent: 15, color: "#F56565" },
      ],
      lifeExpectancy: 78.5,
      urbanRuralSplit: { urban: 65, rural: 35 },
      regions: [
        { name: "North", population: basePopulation * 0.25, urbanPercent: 70, color: "#4C51BF" },
        { name: "South", population: basePopulation * 0.3, urbanPercent: 60, color: "#4299E1" },
        { name: "East", population: basePopulation * 0.2, urbanPercent: 75, color: "#48BB78" },
        { name: "West", population: basePopulation * 0.15, urbanPercent: 55, color: "#ECC94B" },
        { name: "Central", population: basePopulation * 0.1, urbanPercent: 50, color: "#F56565" },
      ],
      educationLevels: [
        { level: "No Formal Education", percent: 5, color: "#F56565" },
        { level: "Primary Education", percent: 15, color: "#ECC94B" },
        { level: "Secondary Education", percent: 55, color: "#48BB78" },
        { level: "Higher Education", percent: 25, color: "#4299E1" },
        { level: "Postgraduate Education", percent: 5, color: "#A0AEC0" }, // Added postgraduate
      ],
      literacyRate: 95,
      citizenshipStatuses: [
        { status: "Citizens", percent: 92, color: "#4C51BF" },
        { status: "Permanent Residents", percent: 5, color: "#48BB78" },
        { status: "Temporary Residents", percent: 2, color: "#ECC94B" },
        { status: "Other", percent: 1, color: "#F56565" },
      ],
      education: 85,
      populationGrowthRate: 0.5,
    },
  };
}

export async function parseEconomyData(): Promise<RealCountryData[]> {
  return economyData as RealCountryData[];
}

export function getEconomicTier(
  gdpPerCapita: number
): "Developing" | "Emerging" | "Developed" | "Advanced" {
  if (gdpPerCapita >= 50000) return "Advanced";
  if (gdpPerCapita >= 25000) return "Developed";
  if (gdpPerCapita >= 10000) return "Emerging";
  return "Developing";
}

export function generateEconomicComparisons(
  inputs: EconomicInputs,
  allCountries: RealCountryData[]
): EconomicComparison[] {
  const comparisons: EconomicComparison[] = [];

  const metricsToCompare: Array<{
    name: string;
    userValue: number;
    getValue: (country: RealCountryData) => number | undefined;
    formatValue: (value: number) => string;
    getTier: (value: number) => string;
  }> = [
    {
      name: "GDP per Capita",
      userValue: inputs.coreIndicators.gdpPerCapita,
      getValue: (c) => c.gdpPerCapita,
      formatValue: (v) => `$${v.toLocaleString()}`,
      getTier: (v) => getEconomicTier(v),
    },
    {
      name: "Population",
      userValue: inputs.coreIndicators.totalPopulation,
      getValue: (c) => c.population,
      formatValue: (v) => formatPopulationDisplay(v),
      getTier: (v) =>
        v >= 100000000 ? "Very Large" : v >= 25000000 ? "Large" : v >= 5000000 ? "Medium" : "Small",
    },
    {
      name: "Tax Revenue (% of GDP)",
      userValue: inputs.fiscalSystem.taxRevenueGDPPercent,
      getValue: (c) => c.taxRevenuePercent,
      formatValue: (v) => `${v.toFixed(1)}%`,
      getTier: (v) => (v >= 25 ? "High Tax" : v >= 15 ? "Moderate Tax" : "Low Tax"),
    },
    {
      name: "Unemployment Rate",
      userValue: inputs.laborEmployment.unemploymentRate,
      getValue: (c) => c.unemploymentRate,
      formatValue: (v) => `${v.toFixed(1)}%`,
      getTier: (v) =>
        v >= 15 ? "High Unemployment" : v >= 8 ? "Moderate Unemployment" : "Low Unemployment",
    },
  ];

  metricsToCompare.forEach((metric) => {
    const comparison = generateMetricComparison(
      metric.name,
      metric.userValue,
      allCountries,
      metric.getValue,
      metric.formatValue,
      metric.getTier
    );
    comparisons.push(comparison);
  });

  return comparisons;
}

function generateMetricComparison(
  metricName: string,
  userValue: number,
  allCountries: RealCountryData[],
  getValue: (country: RealCountryData) => number | undefined,
  formatValue: (value: number) => string,
  getTier: (value: number) => string
): EconomicComparison {
  const tolerance = 0.2;
  const minValue = userValue * (1 - tolerance);
  const maxValue = userValue * (1 + tolerance);

  const similarCountries = allCountries
    .map((country) => ({ country, value: getValue(country) }))
    .filter(
      ({ country, value }) =>
        typeof value === "number" &&
        !isNaN(value) &&
        value >= minValue &&
        value <= maxValue &&
        country.name !== "World"
    )
    .slice(0, 5)
    .map(({ country, value }) => ({
      name: country.name,
      value: value!,
      tier: getTier(value!),
    }));

  if (similarCountries.length === 0) {
    const sortedByCloseness = allCountries
      .filter((country) => country.name !== "World")
      .map((country) => {
        const val = getValue(country);
        return {
          country,
          value: val,
          difference: typeof val === "number" && !isNaN(val) ? Math.abs(val - userValue) : Infinity,
        };
      })
      .filter((item) => typeof item.value === "number" && !isNaN(item.value))
      .sort((a, b) => a.difference - b.difference)
      .slice(0, 3)
      .map(({ country, value }) => ({
        name: country.name,
        value: value!,
        tier: getTier(value!),
      }));
    similarCountries.push(...sortedByCloseness);
  }

  const userTier = getTier(userValue);
  const analysis = generateAnalysisText(
    metricName,
    userValue,
    formatValue(userValue),
    userTier,
    similarCountries
  );

  return {
    metric: metricName,
    userValue,
    comparableCountries: similarCountries,
    analysis,
    tier: userTier as any,
  };
}

function generateAnalysisText(
  metricName: string,
  userValue: number,
  formattedValue: string,
  tier: string,
  similarCountries: Array<{ name: string; value: number; tier: string }>
): string {
  const topSimilar = similarCountries.length > 0 ? similarCountries[0] : null;

  if (!topSimilar) {
    return `Your ${metricName.toLowerCase()} of ${formattedValue} places you in the '${tier}' category. No closely comparable countries found in the dataset.`;
  }

  const comparisonValue = topSimilar.value;
  const comparison =
    userValue > comparisonValue
      ? "higher than"
      : userValue < comparisonValue
        ? "lower than"
        : "similar to";

  const percentDiff =
    comparisonValue !== 0 ? Math.abs(((userValue - comparisonValue) / comparisonValue) * 100) : 0;

  let analysis = `Your ${metricName.toLowerCase()} of ${formattedValue} is ${comparison} ${topSimilar.name}`;

  if (percentDiff > 1 && userValue !== comparisonValue) {
    analysis += ` (by ${percentDiff.toFixed(0)}%)`;
  }

  analysis += `. This places your nation in the '${tier}' category for this metric`;

  if (similarCountries.length > 1) {
    const otherNames = similarCountries.slice(1, 3).map((c) => c.name);
    if (otherNames.length > 0) {
      analysis += `, comparable to nations like ${otherNames.join(" and ")}`;
    }
  }
  analysis += ".";

  return analysis;
}

function formatPopulationDisplay(population: number): string {
  if (isNaN(population)) return "N/A";
  if (population >= 1000000000) return `${Math.round(population / 1000000000)}B`;
  if (population >= 1000000) return `${Math.round(population / 1000000)}M`;
  if (population >= 1000) return `${(population / 1000).toFixed(0)}K`;
  return population.toString();
}

export function saveBaselineToStorage(inputs: EconomicInputs): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "ixeconomy_baseline",
        JSON.stringify({
          ...inputs,
          timestamp: Date.now(),
        })
      );
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (error) {
    // Failed to save baseline to localStorage
  }
}

export function loadBaselineFromStorage(): EconomicInputs | null {
  try {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ixeconomy_baseline");
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      // eslint-disable-next-line unused-imports/no-unused-vars
      const { timestamp, ...inputs } = parsed;
      return inputs;
    }
    return null;
    // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (error) {
    return null;
  }
}
