// src/app/economy/lib/economy-data-service.ts
import * as XLSX from 'xlsx'; // Make sure xlsx is installed
import type { EnhancedEconomicInputs, CountryComparison as EnhancedCountryComparisonType, EconomicHint } from "./enhanced-economic-types";
import { EconomicTier } from "~/types/ixstats";

// Define and Export RealCountryData
export interface RealCountryData {
  name: string;
  countryCode: string;
  population: number;
  gdpPerCapita: number;
  taxRevenuePercent: number;
  unemploymentRate: number;
  landArea?: number; // Made optional as it might not always be present
}

// Define and Export EconomicInputs (base version for the simpler form)
export interface EconomicInputs {
  countryName: string;
  population: number;
  gdpPerCapita: number;
  taxRevenuePercent: number;
  unemploymentRate: number;
  governmentBudgetPercent: number;
  internalDebtPercent: number;
  externalDebtPercent: number;
}

// Define EconomicComparison to match EnhancedCountryComparisonType structure
export interface EconomicComparison extends EnhancedCountryComparisonType {}


// Define and Export getEconomicTier
export function getEconomicTier(gdpPerCapita: number): EconomicTier {
  if (gdpPerCapita >= 50000) return EconomicTier.ADVANCED;
  if (gdpPerCapita >= 35000) return EconomicTier.DEVELOPED;
  if (gdpPerCapita >= 15000) return EconomicTier.EMERGING;
  return EconomicTier.DEVELOPING;
}

// Function to parse CSV data (from string content)
function parseCsvData(csvString: string): RealCountryData[] {
  const rows = csvString.trim().split('\n');
  if (rows.length < 2) {
    console.warn("CSV has insufficient data (less than 2 rows).");
    return [];
  }

  const headers = rows[0]?.split(',').map(h => h.trim().toLowerCase()) ?? [];
  const dataRows = rows.slice(1);

  const findHeaderIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = headers.indexOf(name.toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  };

  const headerMap = {
    countryName: findHeaderIndex(['country name', 'country']),
    cc: findHeaderIndex(['cc', 'country code']),
    gdpCurrentUSD: findHeaderIndex(['gdp (current us$)']),
    gdpPerCapCurrentUSD: findHeaderIndex(['gdppercap (current us$)', 'gdp per capita (current us$)']),
    taxRevenuePercentGDP: findHeaderIndex(['tax revenue (% of gdp)']),
    unemploymentPercent: findHeaderIndex(['unemployment', 'unemployment rate', 'unemployment rate (%)']),
    // Add other potential headers as needed, e.g., land area
    landArea: findHeaderIndex(['land area (sq. km)', 'land area', 'area (sq km)']),
  };

  if (headerMap.countryName === -1 || headerMap.gdpPerCapCurrentUSD === -1) {
    throw new Error("Required CSV headers (Country Name, GDPperCap (current US$)) not found.");
  }

  const realCountries: RealCountryData[] = [];
  dataRows.forEach(rowStr => {
    const row = rowStr.split(',').map(val => val.trim());
    if (row.length < headers.length) return; // Skip malformed rows

    const name = row[headerMap.countryName];
    const gdpPerCapitaStr = row[headerMap.gdpPerCapCurrentUSD];
    
    if (!name || !gdpPerCapitaStr) return; // Skip rows with missing essential data

    try {
      const countryData: RealCountryData = {
        name: name,
        countryCode: headerMap.cc !== -1 ? row[headerMap.cc] ?? '' : '',
        // Population and Tax Revenue are not directly in RLData.csv based on the provided snippet.
        // We'll need to decide how to handle these. For now, using placeholders or defaults.
        population: 0, // Placeholder - This should ideally come from PlayerInputs.csv or another source
        gdpPerCapita: parseFloat(gdpPerCapitaStr) || 0,
        taxRevenuePercent: headerMap.taxRevenuePercentGDP !== -1 ? parseFloat(row[headerMap.taxRevenuePercentGDP] ?? '10') || 10 : 10, // Default 10%
        unemploymentRate: headerMap.unemploymentPercent !== -1 ? parseFloat(row[headerMap.unemploymentPercent] ?? '5') || 5 : 5, // Default 5%
        landArea: headerMap.landArea !== -1 ? parseFloat(row[headerMap.landArea] ?? '') || undefined : undefined,
      };
      if (countryData.gdpPerCapita > 0) { // Basic validation
          realCountries.push(countryData);
      }
    } catch (e) {
      console.warn(`Skipping row due to parsing error: ${rowStr}`, e);
    }
  });
  return realCountries;
}


export async function parseEconomyData(): Promise<RealCountryData[]> {
  try {
    const response = await fetch('/IxEconomy.xlsx - RLData.csv'); // Path relative to public directory
    if (!response.ok) {
      throw new Error(`Failed to fetch RLData.csv: ${response.statusText}`);
    }
    const csvString = await response.text();
    return parseCsvData(csvString);
  } catch (error) {
    console.error("Failed to parse economy data:", error);
    // Fallback to empty or previously cached data if needed
    return [];
  }
}


export function saveBaselineToStorage(inputs: EconomicInputs | EnhancedEconomicInputs): void {
  try {
    if (typeof window !== 'undefined') {
      // Check if it's EnhancedEconomicInputs
      if ('realGDPGrowthRate' in inputs) { // A field unique to EnhancedEconomicInputs
        localStorage.setItem('ixeconomy_enhanced_baseline', JSON.stringify(inputs));
      } else {
        localStorage.setItem('ixeconomy_baseline', JSON.stringify(inputs));
      }
    }
  } catch (e) {
    console.error("Failed to save baseline to storage", e);
  }
}

export function loadBaselineFromStorage(): EnhancedEconomicInputs | null {
  try {
    if (typeof window !== 'undefined') {
      // Prioritize loading enhanced baseline
      const enhancedStored = localStorage.getItem('ixeconomy_enhanced_baseline');
      if (enhancedStored) {
        const parsed = JSON.parse(enhancedStored);
        // Basic check to ensure it's somewhat valid
        if (parsed && typeof parsed.countryName === 'string') {
          return parsed as EnhancedEconomicInputs;
        }
      }
      // Fallback to legacy baseline if enhanced is not found or invalid
      const legacyStored = localStorage.getItem('ixeconomy_baseline');
      if (legacyStored) {
         const parsedLegacy = JSON.parse(legacyStored);
         if(parsedLegacy && typeof parsedLegacy.countryName === 'string') {
            // Convert legacy to enhanced structure if needed
            return {
                ...parsedLegacy,
                // Add default values for new fields in EnhancedEconomicInputs
                realGDPGrowthRate: 0.025,
                inflationRate: 0.02,
                currencyExchangeRate: 1.0,
                baseCurrency: 'USD',
                laborForceParticipationRate: 65,
                employmentRate: 100 - (parsedLegacy.unemploymentRate || 5),
                totalWorkforce: Math.round((parsedLegacy.population || 0) * 0.65 * ((100 - (parsedLegacy.unemploymentRate || 5)) / 100)),
                averageWorkweekHours: 40,
                minimumWage: 7.25,
                averageAnnualIncome: (parsedLegacy.gdpPerCapita || 0) * 0.8,
                governmentRevenueTotal: 0, // Will be calculated
                taxRevenuePerCapita: 0, // Will be calculated
                personalIncomeTaxRates: [
                  { minIncome: 0, maxIncome: 10000, rate: 0.10 },
                  { minIncome: 10000, maxIncome: 40000, rate: 0.22 },
                  { minIncome: 40000, maxIncome: 85000, rate: 0.24 },
                  { minIncome: 85000, maxIncome: null, rate: 0.32 }
                ],
                corporateTaxRates: [
                  { revenueThreshold: 0, rate: 0.15, description: 'Small Business' },
                  { revenueThreshold: 50000, rate: 0.21, description: 'Standard Rate' },
                  { revenueThreshold: 10000000, rate: 0.25, description: 'Large Corporation' }
                ],
                salesTaxRate: 8.5,
                propertyTaxRate: 1.2,
                payrollTaxRate: 15.3,
                exciseTaxRates: { alcohol: 2.5, tobacco: 15.0, fuel: 0.5, luxuryGoods: 10.0, environmentalTax: 5.0 },
                wealthTaxRate: 0.5,
                budgetDeficitSurplus: 0, // Will be calculated
                governmentSpendingBreakdown: {
                  defense: 15, education: 20, healthcare: 18, infrastructure: 12,
                  socialServices: 15, administration: 8, diplomatic: 3, justice: 5
                }
            } as EnhancedEconomicInputs;
         }
      }
      return null;
    }
    return null;
  } catch (e) {
    console.error("Failed to load baseline from storage", e);
    return null;
  }
}

// Generate economic comparisons function
export function generateEconomicComparisons(inputs: EconomicInputs, allCountries: RealCountryData[]): EconomicComparison[] {
  const comparisons: EconomicComparison[] = [];

  // Population comparison
   const populationComparisonMetric = `Population: ${inputs.population.toLocaleString()}`;
  const populationComparison: EconomicComparison = {
    countryName: inputs.countryName, // Added to satisfy the corrected interface
    similarity: 0, // Placeholder, actual similarity calculation needed
    matchingFields: [], // Placeholder
    keyDifferences: [], // Placeholder
    metric: populationComparisonMetric,
    tier: getEconomicTier(inputs.gdpPerCapita).toString(),
    analysis: `Your nation's population of ${inputs.population.toLocaleString()} places it among ${
      inputs.population > 100000000 ? 'large' : inputs.population > 50000000 ? 'medium-large' : inputs.population > 10000000 ? 'medium' : 'smaller'
    } nations globally.`,
    comparableCountries: allCountries
      .filter(c => Math.abs(c.population - inputs.population) / Math.max(c.population, inputs.population) < 0.5)
      .sort((a, b) => Math.abs(a.population - inputs.population) - Math.abs(b.population - inputs.population))
      .slice(0, 5)
      .map(c => ({ name: c.name, value: c.population }))
  };

  // GDP per capita comparison
  const gdpComparisonMetric = `GDP per Capita: $${inputs.gdpPerCapita.toLocaleString()}`;
  const gdpComparison: EconomicComparison = {
    countryName: inputs.countryName,
    similarity: 0,
    matchingFields: [],
    keyDifferences: [],
    metric: gdpComparisonMetric,
    tier: getEconomicTier(inputs.gdpPerCapita).toString(),
    analysis: `With a GDP per capita of $${inputs.gdpPerCapita.toLocaleString()}, your nation is classified as ${getEconomicTier(inputs.gdpPerCapita).toLowerCase()}.`,
    comparableCountries: allCountries
      .filter(c => Math.abs(c.gdpPerCapita - inputs.gdpPerCapita) / Math.max(c.gdpPerCapita, inputs.gdpPerCapita) < 0.3)
      .sort((a, b) => Math.abs(a.gdpPerCapita - inputs.gdpPerCapita) - Math.abs(b.gdpPerCapita - inputs.gdpPerCapita))
      .slice(0, 5)
      .map(c => ({ name: c.name, value: c.gdpPerCapita }))
  };
  
  const taxComparisonMetric = `Tax Revenue: ${inputs.taxRevenuePercent.toFixed(1)}% GDP`;
  const taxComparison: EconomicComparison = {
    countryName: inputs.countryName,
    similarity: 0,
    matchingFields: [],
    keyDifferences: [],
    metric: taxComparisonMetric,
    tier: getEconomicTier(inputs.gdpPerCapita).toString(),
    analysis: `Your tax revenue of ${inputs.taxRevenuePercent.toFixed(1)}% of GDP is ${
      inputs.taxRevenuePercent > 35 ? 'high' : inputs.taxRevenuePercent > 25 ? 'moderate' : inputs.taxRevenuePercent > 15 ? 'low' : 'very low'
    } compared to global standards.`,
    comparableCountries: allCountries
      .filter(c => Math.abs(c.taxRevenuePercent - inputs.taxRevenuePercent) < 5)
      .sort((a, b) => Math.abs(a.taxRevenuePercent - inputs.taxRevenuePercent) - Math.abs(b.taxRevenuePercent - inputs.taxRevenuePercent))
      .slice(0, 5)
      .map(c => ({ name: c.name, value: c.taxRevenuePercent }))
  };

  const unemploymentComparisonMetric = `Unemployment: ${inputs.unemploymentRate.toFixed(1)}%`;
  const unemploymentComparison: EconomicComparison = {
    countryName: inputs.countryName,
    similarity: 0,
    matchingFields: [],
    keyDifferences: [],
    metric: unemploymentComparisonMetric,
    tier: getEconomicTier(inputs.gdpPerCapita).toString(),
    analysis: `Your unemployment rate of ${inputs.unemploymentRate.toFixed(1)}% is ${
      inputs.unemploymentRate > 15 ? 'very high' : inputs.unemploymentRate > 10 ? 'high' : inputs.unemploymentRate > 6 ? 'moderate' : inputs.unemploymentRate > 3 ? 'low' : 'very low'
    } by international standards.`,
    comparableCountries: allCountries
      .filter(c => Math.abs(c.unemploymentRate - inputs.unemploymentRate) < 3)
      .sort((a, b) => Math.abs(a.unemploymentRate - inputs.unemploymentRate) - Math.abs(b.unemploymentRate - inputs.unemploymentRate))
      .slice(0, 5)
      .map(c => ({ name: c.name, value: c.unemploymentRate }))
  };


  comparisons.push(populationComparison, gdpComparison, taxComparison, unemploymentComparison);
  return comparisons;
}


export interface EnhancedCountryProfile {
  basic: EnhancedEconomicInputs;
  calculated: {
    totalGDP: number;
    realTotalGDP: number;
    taxRevenue: number;
    governmentBudget: number;
    budgetBalance: number;
    budgetBalancePercent: number;
    totalDebt: number;
    debtToGDPRatio: number;
    laborForce: number;
    employedPopulation: number;
    unemployedPopulation: number;
    economicHealthScore: number;
    productivityPerWorker: number;
    taxBurdenPerCapita: number;
    governmentEfficiencyRatio: number;
  };
  comparisons: EnhancedCountryComparisonType[];
  hints: EconomicHint[];
  ixTimeData: {
    baselineDate: number;
    lastUpdated: number;
    projectedGrowth: {
      oneYear: { gdp: number; population: number };
      fiveYear: { gdp: number; population: number };
      tenYear: { gdp: number; population: number };
    };
  };
}

export class EnhancedEconomyDataService {
  
  static calculateMetrics(inputs: EnhancedEconomicInputs): EnhancedCountryProfile['calculated'] {
    const totalGDP = (inputs.population ?? 0) * (inputs.gdpPerCapita ?? 0);
    const realTotalGDP = totalGDP * (1 + (inputs.realGDPGrowthRate ?? 0));
    const taxRevenue = totalGDP * ((inputs.taxRevenuePercent ?? 0) / 100);
    const governmentBudget = totalGDP * ((inputs.governmentBudgetPercent ?? 0) / 100);
    const budgetBalance = taxRevenue - governmentBudget;
    const budgetBalancePercent = totalGDP === 0 ? 0 : (budgetBalance / totalGDP) * 100;
    const totalDebtAmount = totalGDP * (((inputs.internalDebtPercent ?? 0) + (inputs.externalDebtPercent ?? 0)) / 100);
    const debtToGDPRatio = (inputs.internalDebtPercent ?? 0) + (inputs.externalDebtPercent ?? 0);

    const workingAgePopulation = (inputs.population ?? 0) * 0.65; // Standard assumption
    const laborForce = workingAgePopulation * ((inputs.laborForceParticipationRate ?? 65) / 100);
    const employedPopulation = laborForce * (1 - ((inputs.unemploymentRate ?? 5) / 100));
    const unemployedPopulation = laborForce - employedPopulation;

    const productivityPerWorker = employedPopulation === 0 ? 0 : totalGDP / employedPopulation;
    const taxBurdenPerCapita = (inputs.population ?? 1) === 0 ? 0 : taxRevenue / (inputs.population || 1); // Avoid division by zero
    const governmentEfficiencyRatio = (inputs.population ?? 1) === 0 ? 0 : governmentBudget / (inputs.population || 1);


    const economicHealthScore = this.calculateEconomicHealthScore(inputs);

    return {
      totalGDP,
      realTotalGDP,
      taxRevenue,
      governmentBudget,
      budgetBalance,
      budgetBalancePercent,
      totalDebt: totalDebtAmount, // Ensure this is `totalDebtAmount`
      debtToGDPRatio,
      laborForce,
      employedPopulation,
      unemployedPopulation,
      economicHealthScore,
      productivityPerWorker,
      taxBurdenPerCapita,
      governmentEfficiencyRatio
    };
  }

  private static calculateEconomicHealthScore(inputs: EnhancedEconomicInputs): number {
    let score = 50; 

    const gdpPC = inputs.gdpPerCapita ?? 0;
    const unemployment = inputs.unemploymentRate ?? 5;
    const taxRevPerc = inputs.taxRevenuePercent ?? 10;
    const internalDebt = inputs.internalDebtPercent ?? 0;
    const externalDebt = inputs.externalDebtPercent ?? 0;
    const realGDPGrowth = inputs.realGDPGrowthRate ?? 0.025;
    const inflation = inputs.inflationRate ?? 0.02;
    const laborForceParticipation = inputs.laborForceParticipationRate ?? 65;

    if (gdpPC >= 50000) score += 20;
    else if (gdpPC >= 35000) score += 15;
    else if (gdpPC >= 25000) score += 10;
    else if (gdpPC >= 15000) score += 5;
    else if (gdpPC < 5000) score -= 10;

    if (unemployment <= 3) score += 15;
    else if (unemployment <= 5) score += 12;
    else if (unemployment <= 8) score += 8;
    else if (unemployment <= 12) score += 4;
    else if (unemployment >= 20) score -= 15;
    else if (unemployment >= 15) score -= 10;

    const budgetBalance = taxRevPerc - (inputs.governmentBudgetPercent ?? 20);
    if (budgetBalance >= 2) score += 15;
    else if (budgetBalance >= 0) score += 10;
    else if (budgetBalance >= -3) score += 5;
    else if (budgetBalance >= -6) score -= 5;
    else score -= 15;

    const totalDebtPerc = internalDebt + externalDebt;
    if (totalDebtPerc <= 40) score += 10;
    else if (totalDebtPerc <= 60) score += 8;
    else if (totalDebtPerc <= 90) score += 5;
    else if (totalDebtPerc <= 120) score -= 5;
    else score -= 15;

    if (realGDPGrowth >= 0.02 && realGDPGrowth <= 0.06) score += 5;
    else if (realGDPGrowth < 0) score -= 10;
    else if (realGDPGrowth > 0.10) score -= 5;

    if (inflation >= 0.015 && inflation <= 0.035) score += 5;
    else if (inflation < 0) score -= 10;
    else if (inflation > 0.08) score -= 10;

    if (laborForceParticipation >= 70) score += 5;
    else if (laborForceParticipation >= 60) score += 3;
    else if (laborForceParticipation < 50) score -= 5;

    if (taxRevPerc >= 18 && taxRevPerc <= 35) score += 5;
    else if (taxRevPerc < 12 || taxRevPerc > 45) score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  static findSimilarCountries(
    inputs: EnhancedEconomicInputs,
    allCountries: RealCountryData[]
  ): EnhancedCountryComparisonType[] { // Corrected return type
    return allCountries
      .filter(country => country.name !== "World")
      .map(country => {
        const gdpSimilarity = this.calculateSimilarity(inputs.gdpPerCapita ?? 0, country.gdpPerCapita, 'logarithmic');
        const populationSimilarity = this.calculateSimilarity(inputs.population ?? 0, country.population, 'logarithmic');
        const taxSimilarity = this.calculateSimilarity(inputs.taxRevenuePercent ?? 0, country.taxRevenuePercent, 'linear');
        const unemploymentSimilarity = this.calculateSimilarity(inputs.unemploymentRate ?? 0, country.unemploymentRate, 'linear');

        const overallSimilarity = (
          gdpSimilarity * 0.4 +
          populationSimilarity * 0.2 +
          taxSimilarity * 0.25 +
          unemploymentSimilarity * 0.15
        ) * 100; 

        const keyDifferences = [
          {
            field: 'GDP per Capita',
            userValue: inputs.gdpPerCapita ?? 0,
            countryValue: country.gdpPerCapita,
            difference: country.gdpPerCapita === 0 ? Infinity : (((inputs.gdpPerCapita ?? 0) - country.gdpPerCapita) / country.gdpPerCapita) * 100
          },
          {
            field: 'Population',
            userValue: inputs.population ?? 0,
            countryValue: country.population,
            difference: country.population === 0 ? Infinity : (((inputs.population ?? 0) - country.population) / country.population) * 100
          },
          {
            field: 'Tax Revenue %',
            userValue: inputs.taxRevenuePercent ?? 0,
            countryValue: country.taxRevenuePercent,
            difference: (inputs.taxRevenuePercent ?? 0) - country.taxRevenuePercent
          },
          {
            field: 'Unemployment %',
            userValue: inputs.unemploymentRate ?? 0,
            countryValue: country.unemploymentRate,
            difference: (inputs.unemploymentRate ?? 0) - country.unemploymentRate
          }
        ].filter(diff => Math.abs(diff.difference) > 10); 

        // Constructing the object to match EnhancedCountryComparisonType
        return {
          countryName: country.name,
          similarity: overallSimilarity,
          matchingFields: this.getMatchingFields(inputs, country),
          keyDifferences,
          // These fields are part of the type but not directly calculated here,
          // they would be set if this function was generating a full comparison object like generateEconomicComparisons
          metric: `Comparison for ${country.name}`, // Example metric
          tier: getEconomicTier(country.gdpPerCapita).toString(), // Example tier
          analysis: `Overall similarity of ${overallSimilarity.toFixed(1)}% with ${inputs.countryName || 'your nation'}.`, // Example analysis
          comparableCountries: [{name: country.name, value: overallSimilarity}] // Example
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  }

  private static calculateSimilarity(
    value1: number, 
    value2: number, 
    method: 'linear' | 'logarithmic' = 'linear'
  ): number {
    if (value1 === 0 && value2 === 0) return 1;
    if (value1 === 0 || value2 === 0) return 0;

    if (method === 'logarithmic') {
      const logDiff = Math.abs(Math.log(value1) - Math.log(value2)); 
      return Math.max(0, 1 - logDiff / Math.log(Math.max(value1, value2)));
    } else {
      const maxValue = Math.max(value1, value2);
      if (maxValue === 0) return 1; // Should be caught by earlier checks
      const diff = Math.abs(value1 - value2) / maxValue;
      return Math.max(0, 1 - diff);
    }
  }

  private static getMatchingFields(inputs: EnhancedEconomicInputs, country: RealCountryData): string[] {
    const matches: string[] = [];
    const threshold = 0.9; 

    if (this.calculateSimilarity(inputs.gdpPerCapita ?? 0, country.gdpPerCapita, 'logarithmic') > threshold) {
      matches.push('GDP per Capita');
    }
    if (this.calculateSimilarity(inputs.population ?? 0, country.population, 'logarithmic') > threshold) {
      matches.push('Population');
    }
    if (this.calculateSimilarity(inputs.taxRevenuePercent ?? 0, country.taxRevenuePercent) > threshold) {
      matches.push('Tax Revenue %');
    }
    if (this.calculateSimilarity(inputs.unemploymentRate ?? 0, country.unemploymentRate) > threshold) {
      matches.push('Unemployment Rate');
    }

    return matches;
  }

  static generateEconomicHints(inputs: EnhancedEconomicInputs): EconomicHint[] {
    const hints: EconomicHint[] = [];
    const gdpPC = inputs.gdpPerCapita ?? 0;
    const unemployment = inputs.unemploymentRate ?? 5;
    const taxRevPerc = inputs.taxRevenuePercent ?? 10;
    const budgetPerc = inputs.governmentBudgetPercent ?? 20;
    const internalDebt = inputs.internalDebtPercent ?? 0;
    const externalDebt = inputs.externalDebtPercent ?? 0;
    const realGDPGrowth = inputs.realGDPGrowthRate ?? 0.025;
    const inflation = inputs.inflationRate ?? 0.02;
    const laborForcePart = inputs.laborForceParticipationRate ?? 65;


    if (gdpPC > 80000) {
      hints.push({
        type: 'info',
        title: 'Very High GDP per Capita',
        message: 'This places your nation among the wealthiest in the world, comparable to Luxembourg or Monaco.',
        relatedCountries: ['Luxembourg', 'Monaco', 'Switzerland'],
        impact: 'low'
      });
    } else if (gdpPC < 1000) {
      hints.push({
        type: 'warning',
        title: 'Very Low GDP per Capita',
        message: 'This indicates significant economic development challenges.',
        relatedCountries: ['Central African Republic', 'Madagascar'],
        impact: 'high'
      });
    }

    if (unemployment > 25) {
      hints.push({
        type: 'warning',
        title: 'Extremely High Unemployment',
        message: 'Unemployment above 25% indicates severe economic crisis requiring immediate intervention.',
        relatedCountries: ['South Africa', 'Spain (2012)'],
        impact: 'high'
      });
    } else if (unemployment < 2) {
      hints.push({
        type: 'suggestion',
        title: 'Very Low Unemployment',
        message: 'Such low unemployment may indicate labor shortages and potential wage inflation.',
        relatedCountries: ['Japan', 'Czech Republic'],
        impact: 'medium'
      });
    }

    const budgetBalance = taxRevPerc - budgetPerc;
    if (budgetBalance < -10) {
      hints.push({
        type: 'warning',
        title: 'Large Budget Deficit',
        message: 'Budget deficits exceeding 10% of GDP are unsustainable and may lead to debt crisis.',
        relatedCountries: ['Greece (2010)', 'Argentina'],
        impact: 'high'
      });
    } else if (budgetBalance > 8) {
      hints.push({
        type: 'info',
        title: 'Large Budget Surplus',
        message: 'Consider whether excess surplus could be better utilized for growth or debt reduction.',
        relatedCountries: ['Norway', 'Singapore'],
        impact: 'medium'
      });
    }

    const totalDebt = internalDebt + externalDebt;
    if (totalDebt > 200) {
      hints.push({
        type: 'warning',
        title: 'Extremely High Debt',
        message: 'Debt levels above 200% of GDP indicate potential debt sustainability issues.',
        relatedCountries: ['Japan', 'Greece'],
        impact: 'high'
      });
    } else if (totalDebt < 20) {
      hints.push({
        type: 'info',
        title: 'Very Low Debt',
        message: 'Low debt levels provide fiscal flexibility but may indicate underinvestment.',
        relatedCountries: ['Estonia', 'Luxembourg'],
        impact: 'low'
      });
    }

    if (realGDPGrowth > 0.08) {
      hints.push({
        type: 'warning',
        title: 'Very High Growth Rate',
        message: 'Growth rates above 8% are rare and may indicate economic overheating.',
        relatedCountries: ['China (historical)', 'Ireland (1990s)'],
        impact: 'medium'
      });
    }

    if (inflation > 0.15) {
      hints.push({
        type: 'warning',
        title: 'High Inflation',
        message: 'Inflation above 15% can severely damage economic stability and living standards.',
        relatedCountries: ['Turkey', 'Argentina'],
        impact: 'high'
      });
    } else if (inflation < -0.02) {
      hints.push({
        type: 'warning',
        title: 'Deflation Risk',
        message: 'Persistent deflation can lead to economic stagnation and debt deflation spirals.',
        relatedCountries: ['Japan (lost decades)'],
        impact: 'high'
      });
    }

    if (taxRevPerc > 45) {
      hints.push({
        type: 'suggestion',
        title: 'Very High Tax Burden',
        message: 'Tax rates above 45% of GDP may impact competitiveness but enable strong public services.',
        relatedCountries: ['Denmark', 'France'],
        impact: 'medium'
      });
    } else if (taxRevPerc < 10) {
      hints.push({
        type: 'suggestion',
        title: 'Very Low Tax Burden',
        message: 'Low tax collection may limit government ability to provide essential services.',
        relatedCountries: ['Afghanistan', 'Chad'],
        impact: 'medium'
      });
    }

    if (laborForcePart > 80) {
      hints.push({
        type: 'info',
        title: 'Very High Labor Participation',
        message: 'Exceptional labor force participation indicates strong economic opportunity.',
        relatedCountries: ['Iceland', 'Switzerland'],
        impact: 'low'
      });
    } else if (laborForcePart < 45) {
      hints.push({
        type: 'warning',
        title: 'Low Labor Participation',
        message: 'Low participation may indicate barriers to employment or cultural factors.',
        relatedCountries: ['Iraq', 'Yemen'],
        impact: 'high'
      });
    }

    const spendingTotal = inputs.governmentSpendingBreakdown ? Object.values(inputs.governmentSpendingBreakdown).reduce((a, b) => a + (b || 0), 0) : 0;
    if (spendingTotal > 100) {
      hints.push({
        type: 'warning',
        title: 'Over-allocated Budget',
        message: 'Government spending categories exceed 100% - budget rebalancing needed.',
        relatedCountries: [],
        impact: 'high'
      });
    } else if (spendingTotal < 85 && spendingTotal > 0) { 
      hints.push({
        type: 'info',
        title: 'Unallocated Budget',
        message: 'Consider allocating remaining budget to priority areas or debt reduction.',
        relatedCountries: [],
        impact: 'low'
      });
    }

    return hints;
  }

  static createCountryProfile(
    inputs: EnhancedEconomicInputs,
    allCountries: RealCountryData[],
    ixTimeData?: {
      baselineDate: number;
      currentTime: number;
    }
  ): EnhancedCountryProfile {
    const calculated = this.calculateMetrics(inputs);
    const comparisons = this.findSimilarCountries(inputs, allCountries);
    const hints = this.generateEconomicHints(inputs);

    const currentTime = ixTimeData?.currentTime || Date.now();
    const baselineDate = ixTimeData?.baselineDate || currentTime;
    
    const projectedGrowth = {
      oneYear: {
        gdp: (inputs.gdpPerCapita ?? 0) * Math.pow(1 + (inputs.realGDPGrowthRate ?? 0), 1),
        population: (inputs.population ?? 0) * Math.pow(1.01, 1) 
      },
      fiveYear: {
        gdp: (inputs.gdpPerCapita ?? 0) * Math.pow(1 + (inputs.realGDPGrowthRate ?? 0), 5),
        population: (inputs.population ?? 0) * Math.pow(1.01, 5)
      },
      tenYear: {
        gdp: (inputs.gdpPerCapita ?? 0) * Math.pow(1 + (inputs.realGDPGrowthRate ?? 0), 10),
        population: (inputs.population ?? 0) * Math.pow(1.01, 10)
      }
    };

    return {
      basic: inputs,
      calculated,
      comparisons,
      hints,
      ixTimeData: {
        baselineDate,
        lastUpdated: currentTime,
        projectedGrowth
      }
    };
  }

  static exportToIxStatsFormat(profile: EnhancedCountryProfile) {
    return {
      country: profile.basic.countryName,
      population: profile.basic.population,
      gdpPerCapita: profile.basic.gdpPerCapita,
      
      realGDPGrowthRate: profile.basic.realGDPGrowthRate,
      inflationRate: profile.basic.inflationRate,
      
      laborForceParticipationRate: profile.basic.laborForceParticipationRate,
      unemploymentRate: profile.basic.unemploymentRate,
      totalWorkforce: profile.calculated.employedPopulation,
      
      taxRevenuePercent: profile.basic.taxRevenuePercent,
      governmentBudgetPercent: profile.basic.governmentBudgetPercent,
      internalDebtPercent: profile.basic.internalDebtPercent,
      externalDebtPercent: profile.basic.externalDebtPercent,
      
      totalGDP: profile.calculated.totalGDP,
      economicHealthScore: profile.calculated.economicHealthScore,
      productivityPerWorker: profile.calculated.productivityPerWorker,
      
      baselineDate: profile.ixTimeData.baselineDate,
      lastUpdated: profile.ixTimeData.lastUpdated,
      
      economicTier: getEconomicTier(profile.basic.gdpPerCapita ?? 0),
      
      projections: profile.ixTimeData.projectedGrowth
    };
  }

  static saveEnhancedBaseline(profile: EnhancedCountryProfile): void {
    try {
      if (typeof window !== 'undefined') {
        const saveData = {
          profile,
          exportedData: this.exportToIxStatsFormat(profile),
          timestamp: Date.now(),
          version: '1.0.0'
        };
        
        localStorage.setItem('ixeconomy_enhanced_baseline', JSON.stringify(saveData));
        localStorage.setItem('ixeconomy_last_update', Date.now().toString());
      }
    } catch (error) {
      console.error('Failed to save enhanced baseline:', error);
      throw new Error('Could not save economic model');
    }
  }

  static loadEnhancedBaseline(): EnhancedCountryProfile | null {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('ixeconomy_enhanced_baseline');
        if (!stored) return null;
        
        const parsed = JSON.parse(stored);
        return parsed.profile || null;
      }
      return null;
    } catch (error) {
      console.error('Failed to load enhanced baseline:', error);
      return null;
    }
  }
}