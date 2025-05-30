// src/app/economy/lib/economy-data-service.ts
import * as XLSX from 'xlsx';

export interface RealCountryData {
  name: string;
  countryCode: string;
  gdp: number;
  gdpPerCapita: number;
  taxRevenuePercent: number;
  unemploymentRate: number;
  population: number;
  taxesLessSubsidies?: number;
  taxRevenueLcu?: string | number;
  womenBeatWifeDinnerPercent?: number | string;
}

export interface CoreEconomicIndicators {
  totalPopulation: number;
  nominalGDP: number;
  gdpPerCapita: number;
  realGDPGrowthRate: number;
  inflationRate: number;
  currencyExchangeRate: number;
}

export interface LaborEmploymentData {
  laborForceParticipationRate: number;
  employmentRate: number;
  unemploymentRate: number;
  totalWorkforce: number;
  averageWorkweekHours: number;
  minimumWage: number;
  averageAnnualIncome: number;
}

export interface TaxRates {
  personalIncomeTaxRates: { bracket: number; rate: number }[];
  corporateTaxRates: { size: string; rate: number }[];
  salesTaxRate: number;
  propertyTaxRate: number;
  payrollTaxRate: number;
  exciseTaxRates: { type: string; rate: number }[];
  wealthTaxRate: number;
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
}

export interface EconomicInputs {
  countryName: string;
  coreIndicators: CoreEconomicIndicators;
  laborEmployment: LaborEmploymentData;
  fiscalSystem: FiscalSystemData;
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
  
  return {
    countryName: referenceCountry ? `New ${referenceCountry.name}` : "New Nation",
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
    },
  };
}

// Keep existing functions but update signatures
let cachedCountryData: RealCountryData[] | null = null;

export async function parseEconomyData(): Promise<RealCountryData[]> {
  // ... existing implementation
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
    
    const sheetJson = XLSX.utils.sheet_to_json(rlDataSheet, { header: 1 }) as any[][];

    if (sheetJson.length < 2) {
        console.warn("RLData sheet has insufficient data.");
        return [];
    }

    if (!sheetJson[0]) {
      console.warn("RLData sheet has no headers.");
      return [];
    }

    const headers = sheetJson[0].map(h => String(h).trim());
    const rawData = sheetJson.slice(1);

    const countries: RealCountryData[] = rawData.map((rowArray: any[]) => {
      const row: any = {};
      headers.forEach((header, index) => {
          row[header] = rowArray[index];
      });

      const gdpString = String(row['GDP (current US$)'] || '0').trim();
      const gdpPerCapitaString = String(row['GDPperCap (current US$)'] || '0').trim();
      
      const gdp = parseFloat(gdpString) || 0;
      const gdpPerCapita = parseFloat(gdpPerCapitaString) || 0;
      
      let taxRevenuePercentString = String(row['Tax revenue (% of GDP)'] || '10').trim();
      let taxRevenuePercent = parseFloat(taxRevenuePercentString);
      if (taxRevenuePercentString === '..' || isNaN(taxRevenuePercent)) {
        taxRevenuePercent = 10; 
      }

      let unemploymentRateString = String(row['Unemployment (%)'] || '5').trim();
      let unemploymentRate = parseFloat(unemploymentRateString);
      if (unemploymentRateString === '..' || unemploymentRateString === '' || isNaN(unemploymentRate)) {
        unemploymentRate = 5; 
      }

      const population = gdpPerCapita > 0 ? Math.round(gdp / gdpPerCapita) : 0;
      const countryName = String(row['Country Name'] || '').trim();
      
      if (!countryName || (gdp === 0 && gdpPerCapita === 0 && population === 0 && countryName !== "0") ) {
        if (countryName === "0" || countryName === "") return null;
      }

      return {
        name: countryName,
        countryCode: String(row['CC'] || '').trim(),
        gdp,
        gdpPerCapita,
        taxRevenuePercent,
        unemploymentRate,
        population,
        taxesLessSubsidies: parseFloat(String(row['Taxes less subsidies']).trim()) || undefined,
        taxRevenueLcu: String(row['Tax revenue (LCU)']).trim() === '..' ? undefined : parseFloat(String(row['Tax revenue (LCU)']).trim()) || undefined,
        womenBeatWifeDinnerPercent: String(row['Women who believe a husband is justified in beating his wife is she burns dinner (%)']).trim() === '..' ? undefined : parseFloat(String(row['Women who believe a husband is justified in beating his wife is she burns dinner (%)']).trim()) || undefined,
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
  // ... existing implementation adapted for new structure
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

  let similarCountries = allCountries
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
