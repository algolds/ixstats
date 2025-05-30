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
  if (cachedCountryData) {
    return cachedCountryData;
  }

  try {
    // Fetch the Excel file from the public directory
    const response = await fetch('/IxEconomy.xlsx'); // Corrected to fetch the .xlsx file
    if (!response.ok) {
      throw new Error(`Failed to fetch Excel file: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer(); // Process as ArrayBuffer for XLSX
    
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });

    // Parse the RLData sheet
    const rlDataSheetName = 'RLData'; // Target the specific sheet
    const rlDataSheet = workbook.Sheets[rlDataSheetName];
    if (!rlDataSheet) {
      throw new Error(`Sheet "${rlDataSheetName}" not found in the Excel file`);
    }
    
    // Convert sheet to JSON, using header: 1 to get array of arrays
    const sheetJson = XLSX.utils.sheet_to_json(rlDataSheet, { header: 1 }) as any[][];

    if (sheetJson.length < 2) { // At least one header row and one data row
        console.warn("RLData sheet has insufficient data.");
        return [];
    }

    const headers = sheetJson[0].map(h => String(h).trim());
    const rawData = sheetJson.slice(1); // Data rows

    const countries: RealCountryData[] = rawData.map((rowArray: any[]) => {
      // Create an object from the row array and headers
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
         // Allow zero GDP/GDPPC if population exists, but skip if name is also "0" or empty
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
  const comparisons: EconomicComparison[] = [];

  const metricsToCompare: Array<{
    name: string;
    userValue: number;
    getValue: (country: RealCountryData) => number | undefined; // Allow undefined for getValue
    formatValue: (value: number) => string;
    getTier: (value: number) => string;
  }> = [
    {
      name: 'GDP per Capita',
      userValue: inputs.gdpPerCapita,
      getValue: (c) => c.gdpPerCapita,
      formatValue: (v) => `$${v.toLocaleString()}`,
      getTier: (v) => getEconomicTier(v)
    },
    {
      name: 'Population',
      userValue: inputs.population,
      getValue: (c) => c.population,
      formatValue: (v) => formatPopulationDisplay(v),
      getTier: (v) => v >= 100000000 ? 'Very Large' : v >= 25000000 ? 'Large' : v >= 5000000 ? 'Medium' : 'Small'
    },
    {
      name: 'Tax Revenue (% of GDP)',
      userValue: inputs.taxRevenuePercent,
      getValue: (c) => c.taxRevenuePercent,
      formatValue: (v) => `${v.toFixed(1)}%`,
      getTier: (v) => v >= 25 ? 'High Tax' : v >= 15 ? 'Moderate Tax' : 'Low Tax'
    },
    {
      name: 'Unemployment Rate',
      userValue: inputs.unemploymentRate,
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
    .map(country => ({ country, value: getValue(country) })) // Get value first
    .filter(({ country, value }) => 
      typeof value === 'number' && 
      !isNaN(value) && 
      value >= minValue && 
      value <= maxValue && 
      country.name !== "World"
    )
    .slice(0, 5)
    .map(({ country, value }) => ({ // value is now guaranteed to be a number
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
      .filter(item => typeof item.value === 'number' && !isNaN(item.value)) // Ensure value is valid for sorting
      .sort((a, b) => a.difference - b.difference)
      .slice(0, 3)
      .map(({ country, value }) => ({ // value is now guaranteed to be a number
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
    tier: userTier as any // Cast because getTier returns specific strings
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
  
  const comparisonValue = topSimilar.value; // Already a number from mapping
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

  if (metricName === 'GDP per Capita') {
    if (tier === 'Advanced') analysis += ' This suggests a highly productive economy with a high standard of living.';
    else if (tier === 'Developed') analysis += ' This indicates a well-established economy with good quality of life.';
    else if (tier === 'Emerging') analysis += ' Your nation shows strong potential for growth and development.';
    else analysis += ' There is considerable room for economic development and improving living standards.';
  } else if (metricName === 'Unemployment Rate') {
    if (tier === 'Low Unemployment') analysis += ' This suggests a healthy labor market, but watch for potential labor shortages.';
    else if (tier === 'Moderate Unemployment') analysis += ' This indicates a relatively stable labor market with some room for job creation.';
    else analysis += ' This points to significant challenges in the labor market that may require policy attention.';
  }

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