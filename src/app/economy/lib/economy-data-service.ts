// src/app/economy/lib/economy-data-service.ts
import * as XLSX from 'xlsx';

export interface RealCountryData {
  name: string;
  countryCode: string;
  gdp: number;
  gdpPerCapita: number;
  taxRevenuePercent: number;
  unemploymentRate: number;
  population: number; // Calculated from GDP / GDP per capita
}

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

let cachedCountryData: RealCountryData[] | null = null;

export async function parseEconomyData(): Promise<RealCountryData[]> {
  // Return cached data if available
  if (cachedCountryData) {
    return cachedCountryData;
  }

  try {
    // Fetch the Excel file from the public directory using the standard fetch API
    const response = await fetch('/IxEconomy.xlsx');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Excel file: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    const workbook = XLSX.read(arrayBuffer, {
      cellStyles: true,
      cellFormulas: true,
      cellDates: true,
    });

    // Parse the RLData sheet
    const rlDataSheet = workbook.Sheets["RLData"];
    if (!rlDataSheet) {
      throw new Error('RLData sheet not found in the Excel file');
    }
    
    const rawData = XLSX.utils.sheet_to_json(rlDataSheet, { header: 1 }) as any[][];

    // Skip header row and process data
    const countries: RealCountryData[] = [];
    
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row[0]) continue; // Skip empty rows

      const name = String(row[0]).trim();
      const countryCode = String(row[1] || '').trim();
      const gdp = parseFloat(row[2]) || 0;
      const gdpPerCapita = parseFloat(row[3]) || 0;
      const taxRevenuePercent = parseFloat(row[4]) || 10; // Default 10% if missing
      const unemploymentRate = parseFloat(row[7]) || 5; // Default 5% if missing

      // Skip countries with missing critical data
      if (gdp === 0 || gdpPerCapita === 0) continue;

      const population = Math.round(gdp / gdpPerCapita);

      countries.push({
        name,
        countryCode,
        gdp,
        gdpPerCapita,
        taxRevenuePercent,
        unemploymentRate,
        population,
      });
    }

    // Sort by GDP per capita for easier browsing
    countries.sort((a, b) => b.gdpPerCapita - a.gdpPerCapita);

    cachedCountryData = countries;
    return countries;
  } catch (error) {
    console.error('Error parsing economy data:', error);
    throw new Error(`Failed to load economic data from Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  
  // GDP per Capita comparison
  const gdpComparison = generateMetricComparison(
    'GDP per Capita',
    inputs.gdpPerCapita,
    allCountries,
    (country) => country.gdpPerCapita,
    (value) => `$${value.toLocaleString()}`,
    (value) => getEconomicTier(value)
  );
  comparisons.push(gdpComparison);

  // Tax Revenue comparison
  const taxComparison = generateMetricComparison(
    'Tax Revenue (% of GDP)',
    inputs.taxRevenuePercent,
    allCountries,
    (country) => country.taxRevenuePercent,
    (value) => `${value.toFixed(1)}%`,
    (value) => value >= 25 ? 'High Tax' : value >= 15 ? 'Moderate Tax' : 'Low Tax'
  );
  comparisons.push(taxComparison);

  // Unemployment comparison
  const unemploymentComparison = generateMetricComparison(
    'Unemployment Rate',
    inputs.unemploymentRate,
    allCountries,
    (country) => country.unemploymentRate,
    (value) => `${value.toFixed(1)}%`,
    (value) => value >= 15 ? 'High Unemployment' : value >= 8 ? 'Moderate Unemployment' : 'Low Unemployment'
  );
  comparisons.push(unemploymentComparison);

  // Population comparison
  const populationComparison = generateMetricComparison(
    'Population',
    inputs.population,
    allCountries,
    (country) => country.population,
    (value) => formatPopulation(value),
    (value) => value >= 100000000 ? 'Very Large' : value >= 25000000 ? 'Large' : value >= 5000000 ? 'Medium' : 'Small'
  );
  comparisons.push(populationComparison);

  return comparisons;
}

function generateMetricComparison(
  metricName: string,
  userValue: number,
  allCountries: RealCountryData[],
  getValue: (country: RealCountryData) => number,
  formatValue: (value: number) => string,
  getTier: (value: number) => string
): EconomicComparison {
  // Find countries with similar values (within 20% range)
  const tolerance = 0.2;
  const minValue = userValue * (1 - tolerance);
  const maxValue = userValue * (1 + tolerance);
  
  const similarCountries = allCountries
    .filter(country => {
      const value = getValue(country);
      return value >= minValue && value <= maxValue;
    })
    .slice(0, 5) // Top 5 similar countries
    .map(country => ({
      name: country.name,
      value: getValue(country),
      tier: getTier(getValue(country))
    }));

  // If no similar countries, find closest ones
  if (similarCountries.length === 0) {
    const sortedByCloseness = allCountries
      .map(country => ({
        country,
        difference: Math.abs(getValue(country) - userValue)
      }))
      .sort((a, b) => a.difference - b.difference)
      .slice(0, 3)
      .map(({ country }) => ({
        name: country.name,
        value: getValue(country),
        tier: getTier(getValue(country))
      }));
    
    similarCountries.push(...sortedByCloseness);
  }

  // Generate analysis text
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
  const topSimilar = similarCountries[0];
  
  if (!topSimilar) {
    return `Your ${metricName.toLowerCase()} of ${formattedValue} places you in the '${tier}' category.`;
  }

  const comparison = userValue > topSimilar.value ? 'higher than' : 
                    userValue < topSimilar.value ? 'lower than' : 'similar to';
  
  const percentDiff = Math.abs(((userValue - topSimilar.value) / topSimilar.value) * 100);
  
  let analysis = `Your ${metricName.toLowerCase()} of ${formattedValue} is ${comparison} ${topSimilar.name}`;
  
  if (percentDiff > 5) {
    analysis += ` by ${percentDiff.toFixed(0)}%`;
  }
  
  analysis += `. This places you in the '${tier}' category`;
  
  if (similarCountries.length > 1) {
    const otherCountries = similarCountries.slice(1, 3).map(c => c.name).join(' and ');
    analysis += `, alongside countries like ${otherCountries}`;
  }
  
  analysis += '.';
  
  // Add contextual insights
  if (metricName === 'GDP per Capita') {
    if (tier === 'Advanced') {
      analysis += ' Your citizens enjoy a high standard of living with access to advanced services and technology.';
    } else if (tier === 'Developed') {
      analysis += ' Your nation has a solid middle-class economy with good infrastructure and services.';
    } else if (tier === 'Emerging') {
      analysis += ' Your economy is growing and modernizing, with increasing opportunities for development.';
    } else {
      analysis += ' There are significant opportunities for economic growth and development.';
    }
  }
  
  return analysis;
}

function formatPopulation(population: number): string {
  if (population >= 1000000000) {
    return `${(population / 1000000000).toFixed(1)}B`;
  } else if (population >= 1000000) {
    return `${(population / 1000000).toFixed(1)}M`;
  } else if (population >= 1000) {
    return `${(population / 1000).toFixed(0)}K`;
  }
  return population.toString();
}

// Storage functions for localStorage
export function saveBaselineToStorage(inputs: EconomicInputs): void {
  try {
    localStorage.setItem('ixeconomy_baseline', JSON.stringify({
      ...inputs,
      timestamp: Date.now(),
    }));
  } catch (error) {
    console.error('Failed to save baseline to localStorage:', error);
  }
}

export function loadBaselineFromStorage(): EconomicInputs | null {
  try {
    const stored = localStorage.getItem('ixeconomy_baseline');
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    // Remove timestamp and return just the inputs
    const { timestamp, ...inputs } = parsed;
    return inputs;
  } catch (error) {
    console.error('Failed to load baseline from localStorage:', error);
    return null;
  }
}