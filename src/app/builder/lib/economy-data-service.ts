// src/app/economy/lib/economy-data-service.ts
import * as XLSX from 'xlsx';
import type { SpendingCategory, GovernmentSpendingData } from '~/types/economics';

export type { GovernmentSpendingData };

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
  economicTier?: 'Developing' | 'Emerging' | 'Developed' | 'Advanced';
  baselinePopulation?: number;
  baselineGdpPerCapita?: number;
  maxGdpGrowthRate?: number;
  flag?: string;
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

// Type alias for compatibility
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
  drivingSide: 'left' | 'right';
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

export interface LaborEmploymentData {
  laborForceParticipationRate: number;
  employmentRate: number;
  unemploymentRate: number;
  totalWorkforce: number;
  averageWorkweekHours: number;
  minimumWage: number;
  averageAnnualIncome: number;
  laborProtections: boolean;
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

export interface EconomicComparison {
  metric: string;
  userValue: number;
  comparableCountries: Array<{
    name: string;
    value: number;
    tier: string;
  }>;
  analysis: string;
  tier: 'Developing' | 'Emerging' | 'Developed' | 'Advanced';
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
    flagUrl: "", // Initialize flagUrl
    coatOfArmsUrl: "", // Initialize coatOfArmsUrl
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
      budgetDeficitSurplus: ((baseNominalGDP * baseTaxRevenuePercent) / 100) - ((baseNominalGDP * Math.min(baseTaxRevenuePercent + 2, 25)) / 100),
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
      debtServiceCosts: (baseNominalGDP * 0.7 * 0.035),
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
        { name: "Upper Class", populationPercent: 5, wealthPercent: 40, averageIncome: baseGDPPerCapita * 5, color: "#4C51BF" },
        { name: "Upper Middle Class", populationPercent: 15, wealthPercent: 30, averageIncome: baseGDPPerCapita * 2, color: "#4299E1" },
        { name: "Middle Class", populationPercent: 30, wealthPercent: 20, averageIncome: baseGDPPerCapita, color: "#48BB78" },
        { name: "Lower Middle Class", populationPercent: 30, wealthPercent: 8, averageIncome: baseGDPPerCapita * 0.5, color: "#ECC94B" },
        { name: "Lower Class", populationPercent: 20, wealthPercent: 2, averageIncome: baseGDPPerCapita * 0.2, color: "#F56565" }
      ],
      povertyRate: 15,
      incomeInequalityGini: 0.38,
      socialMobilityIndex: 60
    },
    governmentSpending: {
      totalSpending,
      spendingGDPPercent: Math.min(baseTaxRevenuePercent + 2, 25),
      spendingPerCapita: totalSpending / basePopulation,
      spendingCategories: [
        { category: "Defense", amount: totalSpending * 0.15, percent: 15, icon: "Shield", color: "#4C51BF", description: "Military, security, and defense infrastructure" },
        { category: "Education", amount: totalSpending * 0.18, percent: 18, icon: "GraduationCap", color: "#4299E1", description: "Schools, universities, and education programs" },
        { category: "Healthcare", amount: totalSpending * 0.22, percent: 22, icon: "Heart", color: "#F56565", description: "Public health services and medical care" },
        { category: "Infrastructure", amount: totalSpending * 0.12, percent: 12, icon: "Truck", color: "#48BB78", description: "Roads, utilities, and public works" },
        { category: "Social Security", amount: totalSpending * 0.20, percent: 20, icon: "Users2", color: "#ECC94B", description: "Welfare, pensions, and social benefits" },
        { category: "Other", amount: totalSpending * 0.13, percent: 13, icon: "MoreHorizontal", color: "#A0AEC0", description: "Administration, debt service, and miscellaneous" }
      ],
      deficitSurplus: ((baseNominalGDP * baseTaxRevenuePercent) / 100) - totalSpending,
      education: totalSpending * 0.18,
      healthcare: totalSpending * 0.22,
      socialSafety: totalSpending * 0.20,
      performanceBasedBudgeting: true,
      universalBasicServices: false,
      greenInvestmentPriority: true,
      digitalGovernmentInitiative: true,
    },
    demographics: {
      ageDistribution: [
        { group: "0-15", percent: 20, color: "#4299E1" },
        { group: "16-64", percent: 65, color: "#48BB78" },
        { group: "65+", percent: 15, color: "#F56565" }
      ],
      lifeExpectancy: 78.5,
      urbanRuralSplit: { urban: 65, rural: 35 },
      regions: [
        { name: "North", population: basePopulation * 0.25, urbanPercent: 70, color: "#4C51BF" },
        { name: "South", population: basePopulation * 0.30, urbanPercent: 60, color: "#4299E1" },
        { name: "East", population: basePopulation * 0.20, urbanPercent: 75, color: "#48BB78" },
        { name: "West", population: basePopulation * 0.15, urbanPercent: 55, color: "#ECC94B" },
        { name: "Central", population: basePopulation * 0.10, urbanPercent: 50, color: "#F56565" }
      ],
      educationLevels: [
        { level: "No Formal Education", percent: 5, color: "#F56565" },
        { level: "Primary Education", percent: 15, color: "#ECC94B" },
        { level: "Secondary Education", percent: 55, color: "#48BB78" },
        { level: "Higher Education", percent: 25, color: "#4299E1" },
        { level: "Postgraduate Education", percent: 5, color: "#A0AEC0" } // Added postgraduate
      ],
      literacyRate: 95,
      citizenshipStatuses: [
        { status: "Citizens", percent: 92, color: "#4C51BF" },
        { status: "Permanent Residents", percent: 5, color: "#48BB78" },
        { status: "Temporary Residents", percent: 2, color: "#ECC94B" },
        { status: "Other", percent: 1, color: "#F56565" }
      ],
      education: 85,
      populationGrowthRate: 0.5,
    }
  };
}

// Keep existing functions but update signatures
let cachedCountryData: RealCountryData[] | null = null;

export async function parseEconomyData(): Promise<RealCountryData[]> {
  if (cachedCountryData) {
    return cachedCountryData;
  }

  try {
    const response = await fetch('/IxEconomy.xlsx');
    if (!response.ok) {
      throw new Error(`Failed to fetch Excel file: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
    const rlDataSheetName = 'RLData';
    const rlDataSheet = workbook.Sheets[rlDataSheetName];
    
    if (!rlDataSheet) {
      throw new Error(`Sheet "${rlDataSheetName}" not found in the Excel file`);
    }
    
    const sheetJson = XLSX.utils.sheet_to_json(rlDataSheet, { header: 1 });

    if (sheetJson.length < 2) {
        console.warn("RLData sheet has insufficient data.");
        return [];
    }

    if (!sheetJson[0]) {
      console.warn("RLData sheet has no headers.");
      return [];
    }

    const headers = (sheetJson[0] as any[])
      .map((h: any) => String(h).trim())
      .filter(header => header !== null && header !== undefined && header !== ''); // Filter out invalid headers
    const rawData = sheetJson.slice(1);

    const countries: RealCountryData[] = rawData
      .filter((row): row is any[] => Array.isArray(row))
      .map((rowArray: any[]) => {
        const row: any = {};
        headers.forEach((header: string, index: number) => { // Explicitly type header as string
            row[header] = rowArray[index];
        });

      const gdpString = String(row['GDP (current US$)'] || '0').trim();
      const gdpPerCapitaString = String(row['GDPperCap (current US$)'] || '0').trim();
      
      const gdp = parseFloat(gdpString) || 0;
      const gdpPerCapita = parseFloat(gdpPerCapitaString) || 0;
      
      const taxRevenuePercentString = String(row['Tax revenue (% of GDP)'] || '10').trim();
      let taxRevenuePercent = parseFloat(taxRevenuePercentString);
      if (taxRevenuePercentString === '..' || isNaN(taxRevenuePercent)) {
        taxRevenuePercent = 10; 
      }

      const unemploymentRateString = String(row['Unemployment (%)'] || '5').trim();
      let unemploymentRate = parseFloat(unemploymentRateString);
      if (unemploymentRateString === '..' || unemploymentRateString === '' || isNaN(unemploymentRate)) {
        unemploymentRate = 5; 
      }

      const population = gdpPerCapita > 0 ? Math.round(gdp / gdpPerCapita) : 0;
      const countryName = String(row['Country Name'] || '').trim();
      let countryCode = String(row.CC || '').trim(); // Get original country code

      // ISO 3166-1 Alpha-3 to Alpha-2 mapping for common cases
      const alpha3ToAlpha2Map: Record<string, string> = {
        'AFG': 'af', 'ALB': 'al', 'DZA': 'dz', 'ASM': 'as', 'AND': 'ad', 'AGO': 'ao', 'AIA': 'ai', 'ATA': 'aq', 'ATG': 'ag', 'ARG': 'ar',
        'ARM': 'am', 'ABW': 'aw', 'AUS': 'au', 'AUT': 'at', 'AZE': 'az', 'BHS': 'bs', 'BHR': 'bh', 'BGD': 'bd', 'BRB': 'bb', 'BLR': 'by',
        'BEL': 'be', 'BLZ': 'bz', 'BEN': 'bj', 'BMU': 'bm', 'BTN': 'bt', 'BOL': 'bo', 'BIH': 'ba', 'BWA': 'bw', 'BVT': 'bv', 'BRA': 'br',
        'IOT': 'io', 'BRN': 'bn', 'BGR': 'bg', 'BFA': 'bf', 'BDI': 'bi', 'CPV': 'cv', 'KHM': 'kh', 'CMR': 'cm', 'CAN': 'ca', 'CYM': 'ky',
        'CAF': 'cf', 'TCD': 'td', 'CHL': 'cl', 'CHN': 'cn', 'CXR': 'cx', 'CCK': 'cc', 'COL': 'co', 'COM': 'km', 'COG': 'cg', 'COD': 'cd',
        'COK': 'ck', 'CRI': 'cr', 'CIV': 'ci', 'HRV': 'hr', 'CUB': 'cu', 'CYP': 'cy', 'CZE': 'cz', 'DNK': 'dk', 'DJI': 'dj', 'DMA': 'dm',
        'DOM': 'do', 'ECU': 'ec', 'EGY': 'eg', 'SLV': 'sv', 'GNQ': 'gq', 'ERI': 'er', 'EST': 'ee', 'ETH': 'et', 'FLK': 'fk', 'FRO': 'fo',
        'FJI': 'fj', 'FIN': 'fi', 'FRA': 'fr', 'GUF': 'gf', 'PYF': 'pf', 'ATF': 'tf', 'GAB': 'ga', 'GMB': 'gm', 'GEO': 'ge', 'DEU': 'de',
        'GHA': 'gh', 'GIB': 'gi', 'GRC': 'gr', 'GRL': 'gl', 'GRD': 'gd', 'GLP': 'gp', 'GUM': 'gu', 'GTM': 'gt', 'GGY': 'gg', 'GIN': 'gn',
        'GNB': 'gw', 'GUY': 'gy', 'HTI': 'ht', 'HMD': 'hm', 'VAT': 'va', 'HND': 'hn', 'HKG': 'hk', 'HUN': 'hu', 'ISL': 'is', 'IND': 'in',
        'IDN': 'id', 'IRN': 'ir', 'IRQ': 'iq', 'IRL': 'ie', 'IMN': 'im', 'ISR': 'il', 'ITA': 'it', 'JAM': 'jm', 'JPN': 'jp', 'JEY': 'je',
        'JOR': 'jo', 'KAZ': 'kz', 'KEN': 'ke', 'KIR': 'ki', 'PRK': 'kp', 'KOR': 'kr', 'KWT': 'kw', 'KGZ': 'kg', 'LAO': 'la', 'LVA': 'lv',
        'LBN': 'lb', 'LSO': 'ls', 'LBR': 'lr', 'LBY': 'ly', 'LIE': 'li', 'LTU': 'lt', 'LUX': 'lu', 'MAC': 'mo', 'MDG': 'mg', 'MWI': 'mw',
        'MYS': 'my', 'MDV': 'mv', 'MLI': 'ml', 'MLT': 'mt', 'MHL': 'mh', 'MTQ': 'mq', 'MRT': 'mr', 'MUS': 'mu', 'MYT': 'yt', 'MEX': 'mx',
        'FSM': 'fm', 'MDA': 'md', 'MCO': 'mc', 'MNG': 'mn', 'MNE': 'me', 'MSR': 'ms', 'MAR': 'ma', 'MOZ': 'mz', 'MMR': 'mm', 'NAM': 'na',
        'NRU': 'nr', 'NPL': 'np', 'NLD': 'nl', 'ANT': 'an', 'NCL': 'nc', 'NZL': 'nz', 'NIC': 'ni', 'NER': 'ne', 'NGA': 'ng', 'NIU': 'nu',
        'NFK': 'nf', 'MKD': 'mk', 'MNP': 'mp', 'NOR': 'no', 'OMN': 'om', 'PAK': 'pk', 'PLW': 'pw', 'PSE': 'ps', 'PAN': 'pa', 'PNG': 'pg',
        'PRY': 'py', 'PER': 'pe', 'PHL': 'ph', 'PCN': 'pn', 'POL': 'pl', 'PRT': 'pt', 'PRI': 'pr', 'QAT': 'qa', 'REU': 're', 'ROU': 'ro',
        'RUS': 'ru', 'RWA': 'rw', 'BLM': 'bl', 'SHN': 'sh', 'KNA': 'kn', 'LCA': 'lc', 'MAF': 'mf', 'SPM': 'pm', 'VCT': 'vc', 'WSM': 'ws',
        'SMR': 'sm', 'STP': 'st', 'SAU': 'sa', 'SEN': 'sn', 'SRB': 'rs', 'SYC': 'sc', 'SLE': 'sl', 'SGP': 'sg', 'SVK': 'sk', 'SVN': 'si',
        'SLB': 'sb', 'SOM': 'so', 'ZAF': 'za', 'SGS': 'gs', 'SSD': 'ss', 'ESP': 'es', 'LKA': 'lk', 'SDN': 'sd', 'SUR': 'sr', 'SJM': 'sj',
        'SWZ': 'sz', 'SWE': 'se', 'CHE': 'ch', 'SYR': 'sy', 'TWN': 'tw', 'TJK': 'tj', 'TZA': 'tz', 'THA': 'th', 'TLS': 'tl', 'TGO': 'tg',
        'TKL': 'tk', 'TON': 'to', 'TTO': 'tt', 'TUN': 'tn', 'TUR': 'tr', 'TKM': 'tm', 'TCA': 'tc', 'TUV': 'tv', 'UGA': 'ug', 'UKR': 'ua',
        'ARE': 'ae', 'GBR': 'gb', 'USA': 'us', 'UMI': 'um', 'URY': 'uy', 'UZB': 'uz', 'VUT': 'vu', 'VEN': 've', 'VNM': 'vn', 'VGB': 'vg',
        'VIR': 'vi', 'WLF': 'wf', 'ESH': 'eh', 'YEM': 'ye', 'ZMB': 'zm', 'ZWE': 'zw',
      };

      // Convert if an alpha-3 code is found in the map
      const alpha2Code = alpha3ToAlpha2Map[countryCode.toUpperCase()];
      if (alpha2Code) {
        countryCode = alpha2Code;
      } else {
        // Fallback: if it's 3 characters, try to convert to lowercase and use first two.
        // Otherwise, just lowercase it (assuming it's already alpha-2 or a custom code).
        if (countryCode.length === 3) {
          countryCode = countryCode.toLowerCase().substring(0, 2);
        } else {
          countryCode = countryCode.toLowerCase();
        }
      }
      
      if (!countryName || (gdp === 0 && gdpPerCapita === 0 && population === 0 && countryName !== "0") ) {
        if (countryName === "0" || countryName === "") return null;
      }

      const economicTier = getEconomicTier(gdpPerCapita);
      const maxGdpGrowthRate = Math.min(8, Math.max(2, 5 - (gdpPerCapita / 10000))); // Higher income = lower max growth potential
      
      return {
        name: countryName,
        countryCode: countryCode,
        gdp,
        gdpPerCapita,
        taxRevenuePercent,
        unemploymentRate,
        population,
        taxesLessSubsidies: parseFloat(String(row['Taxes less subsidies']).trim()) || undefined,
        taxRevenueLcu: String(row['Tax revenue (LCU)']).trim() === '..' ? undefined : parseFloat(String(row['Tax revenue (LCU)']).trim()) || undefined,
        womenBeatWifeDinnerPercent: String(row['Women who believe a husband is justified in beating his wife is she burns dinner (%)']).trim() === '..' ? undefined : parseFloat(String(row['Women who believe a husband is justified in beating his wife is she burns dinner (%)']).trim()) || undefined,
        // Additional computed fields for country builder
        economicTier,
        baselinePopulation: population,
        baselineGdpPerCapita: gdpPerCapita,
        maxGdpGrowthRate,
        flag: `https://flagcdn.com/w320/${countryCode}.png`,
      };
    }).filter(country => country !== null && country.name !== "0" && country.name !== "") as RealCountryData[];
    
    countries.sort((a, b) => b.gdpPerCapita - a.gdpPerCapita);
    cachedCountryData = countries;
    return countries;
  } catch (error) {
    console.error('Error parsing economy data from Excel sheet:', error);
    throw new Error(`Failed to load economic data from Excel sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function getEconomicTier(gdpPerCapita: number): 'Developing' | 'Emerging' | 'Developed' | 'Advanced' {
  if (gdpPerCapita >= 50000) return 'Advanced';
  if (gdpPerCapita >= 25000) return 'Developed';
  if (gdpPerCapita >= 10000) return 'Emerging';
  return 'Developing';
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
      name: 'GDP per Capita',
      userValue: inputs.coreIndicators.gdpPerCapita,
      getValue: (c) => c.gdpPerCapita,
      formatValue: (v) => `$${v.toLocaleString()}`,
      getTier: (v) => getEconomicTier(v)
    },
    {
      name: 'Population',
      userValue: inputs.coreIndicators.totalPopulation,
      getValue: (c) => c.population,
      formatValue: (v) => formatPopulationDisplay(v),
      getTier: (v) => v >= 100000000 ? 'Very Large' : v >= 25000000 ? 'Large' : v >= 5000000 ? 'Medium' : 'Small'
    },
    {
      name: 'Tax Revenue (% of GDP)',
      userValue: inputs.fiscalSystem.taxRevenueGDPPercent,
      getValue: (c) => c.taxRevenuePercent,
      formatValue: (v) => `${v.toFixed(1)}%`,
      getTier: (v) => v >= 25 ? 'High Tax' : v >= 15 ? 'Moderate Tax' : 'Low Tax'
    },
    {
      name: 'Unemployment Rate',
      userValue: inputs.laborEmployment.unemploymentRate,
      getValue: (c) => c.unemploymentRate,
      formatValue: (v) => `${v.toFixed(1)}%`,
      getTier: (v) => v >= 15 ? 'High Unemployment' : v >= 8 ? 'Moderate Unemployment' : 'Low Unemployment'
    }
  ];

  metricsToCompare.forEach(metric => {
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
    .map(country => ({ country, value: getValue(country) }))
    .filter(({ country, value }) => 
      typeof value === 'number' && 
      !isNaN(value) && 
      value >= minValue && 
      value <= maxValue && 
      country.name !== "World"
    )
    .slice(0, 5)
    .map(({ country, value }) => ({
      name: country.name,
      value: value!, 
      tier: getTier(value!)
    }));

  if (similarCountries.length === 0) {
    const sortedByCloseness = allCountries
      .filter(country => country.name !== "World")
      .map(country => {
        const val = getValue(country);
        return {
          country,
          value: val,
          difference: (typeof val === 'number' && !isNaN(val)) ? Math.abs(val - userValue) : Infinity
        };
      })
      .filter(item => typeof item.value === 'number' && !isNaN(item.value))
      .sort((a, b) => a.difference - b.difference)
      .slice(0, 3)
      .map(({ country, value }) => ({
        name: country.name,
        value: value!,
        tier: getTier(value!)
      }));
    similarCountries.push(...sortedByCloseness);
  }

  const userTier = getTier(userValue);
  const analysis = generateAnalysisText(metricName, userValue, formatValue(userValue), userTier, similarCountries);

  return {
    metric: metricName,
    userValue,
    comparableCountries: similarCountries,
    analysis,
    tier: userTier as any
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
  const comparison = userValue > comparisonValue ? 'higher than' :
    userValue < comparisonValue ? 'lower than' : 'similar to';

  const percentDiff = comparisonValue !== 0 ? Math.abs(((userValue - comparisonValue) / comparisonValue) * 100) : 0;

  let analysis = `Your ${metricName.toLowerCase()} of ${formattedValue} is ${comparison} ${topSimilar.name}`;

  if (percentDiff > 1 && userValue !== comparisonValue) {
    analysis += ` (by ${percentDiff.toFixed(0)}%)`;
  }

  analysis += `. This places your nation in the '${tier}' category for this metric`;

  if (similarCountries.length > 1) {
    const otherNames = similarCountries.slice(1, 3).map(c => c.name);
    if (otherNames.length > 0) {
        analysis += `, comparable to nations like ${otherNames.join(' and ')}`;
    }
  }
  analysis += '.';

  return analysis;
}

function formatPopulationDisplay(population: number): string {
  if (isNaN(population)) return 'N/A';
  if (population >= 1000000000) return `${(population / 1000000000).toFixed(1)}B`;
  if (population >= 1000000) return `${(population / 1000000).toFixed(1)}M`;
  if (population >= 1000) return `${(population / 1000).toFixed(0)}K`;
  return population.toString();
}

export function saveBaselineToStorage(inputs: EconomicInputs): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ixeconomy_baseline', JSON.stringify({
        ...inputs,
        timestamp: Date.now(),
      }));
    }
  } catch (error) {
    console.error('Failed to save baseline to localStorage:', error);
  }
}

export function loadBaselineFromStorage(): EconomicInputs | null {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ixeconomy_baseline');
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      const { timestamp, ...inputs } = parsed;
      return inputs;
    }
    return null;
  } catch (error) {
    console.error('Failed to load baseline from localStorage:', error);
    return null;
  }
}