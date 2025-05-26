// lib/data-service.ts
// Data service for parsing Excel files and managing country data

import * as XLSX from 'xlsx';
import { IxStatsCalculator } from './calculations';
import { IxTime }
from './ixtime'; // Assuming IxTime is also in this lib folder or path is adjusted
// Assuming types are correctly defined in this path
import type { 
  BaseCountryData, 
  CountryStats, 
  EconomicConfig, 
  IxStatsConfig 
} from '../types/ixstats';


export class IxStatsDataService {
  private calculator: IxStatsCalculator;
  private config: IxStatsConfig;

  constructor(config: IxStatsConfig) {
    this.config = config;
    // Pass baselineDate from config if available, otherwise IxTime.getCurrentIxTime() will be used by calculator
    const baselineDateForCalc = config.timeSettings.baselineYear 
        ? IxTime.createIxTime(config.timeSettings.baselineYear, 1, 1) // Jan 1st of baselineYear
        : undefined;
    this.calculator = new IxStatsCalculator(config.economic, baselineDateForCalc);
  }

  async parseRosterFile(fileBuffer: ArrayBuffer): Promise<BaseCountryData[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' }); // Use type 'buffer' for ArrayBuffer

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No worksheets found in the file');
    }
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error('Worksheet not found in the file');
    }

    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]; // Get raw rows
    return this.processRawDataWithHeaderRecognition(rawData);
  }

  // More robust data processing that tries to find headers
  private processRawDataWithHeaderRecognition(rawData: any[][]): BaseCountryData[] {
    const countries: BaseCountryData[] = [];
    if (rawData.length < 2) { // Need at least one header row and one data row
        console.warn("Spreadsheet has insufficient data (less than 2 rows).");
        return countries;
    }

    const headers = rawData[0]?.map(h => String(h).trim().toLowerCase());
    if (!headers) {
        throw new Error("Could not parse headers from the spreadsheet.");
    }

    const findHeaderIndex = (possibleNames: string[]): number => {
        for (const name of possibleNames) {
            const index = headers.indexOf(name.toLowerCase());
            if (index !== -1) return index;
        }
        return -1;
    };
    
    // Map column names to their indices
    const headerMap = {
        country: findHeaderIndex(['Country', 'Nation Name']),
        population: findHeaderIndex(['Population', 'Current Population', 'Pop']),
        gdpPerCapita: findHeaderIndex(['GDP PC', 'GDP per Capita', 'GDPPC']),
        maxGdpGrowthRate: findHeaderIndex(['Max GDPPC Grow Rt', 'Max Growth Rate', 'Max GDP Growth']),
        adjustedGdpGrowth: findHeaderIndex(['Adj GDPPC Growth', 'GDP Growth', 'Adjusted GDP Growth']),
        populationGrowthRate: findHeaderIndex(['Pop Growth Rate', 'Population Growth']),
        projected2040Population: findHeaderIndex(['2040 Population']),
        projected2040Gdp: findHeaderIndex(['2040 GDP']),
        projected2040GdpPerCapita: findHeaderIndex(['2040 GDP PC']),
        actualGdpGrowth: findHeaderIndex(['Actual GDP Growth'])
    };

    if (headerMap.country === -1 || headerMap.population === -1 || headerMap.gdpPerCapita === -1) {
        throw new Error("Required headers (Country, Population, GDP per Capita) not found in the spreadsheet.");
    }

    for (let i = 1; i < rawData.length; i++) { // Start from row 1 (after headers)
      const row = rawData[i];
      if (!row || !row[headerMap.country] || typeof row[headerMap.country] !== 'string') {
        continue; // Skip empty or invalid rows
      }

      try {
        const countryData: BaseCountryData = {
          country: String(row[headerMap.country]).trim(),
          population: this.parseNumber(row[headerMap.population]),
          gdpPerCapita: this.parseNumber(row[headerMap.gdpPerCapita]),
          maxGdpGrowthRate: this.parseNumber(row[headerMap.maxGdpGrowthRate], 0.05), // Default 5%
          adjustedGdpGrowth: this.parseNumber(row[headerMap.adjustedGdpGrowth], 0.03), // Default 3%
          populationGrowthRate: this.parseNumber(row[headerMap.populationGrowthRate], 0.01), // Default 1%
          projected2040Population: this.parseNumber(row[headerMap.projected2040Population], 0),
          projected2040Gdp: this.parseNumber(row[headerMap.projected2040Gdp], 0),
          projected2040GdpPerCapita: this.parseNumber(row[headerMap.projected2040GdpPerCapita], 0),
          actualGdpGrowth: this.parseNumber(row[headerMap.actualGdpGrowth], 0)
        };
        
        const baselineYear = this.config.timeSettings.baselineYear;
        const yearsTo2040 = 2040 - baselineYear;

        if (countryData.projected2040Population === 0 && yearsTo2040 > 0) {
          countryData.projected2040Population = countryData.population * Math.pow(1 + countryData.populationGrowthRate, yearsTo2040);
        }
        if (countryData.projected2040GdpPerCapita === 0 && yearsTo2040 > 0) {
          countryData.projected2040GdpPerCapita = countryData.gdpPerCapita * Math.pow(1 + countryData.adjustedGdpGrowth, yearsTo2040);
        }
        if (countryData.projected2040Gdp === 0) {
          countryData.projected2040Gdp = countryData.projected2040Population * countryData.projected2040GdpPerCapita;
        }
        if (countryData.actualGdpGrowth === 0) {
          countryData.actualGdpGrowth = countryData.populationGrowthRate + countryData.adjustedGdpGrowth;
        }

        if (this.validateCountryData(countryData)) {
          countries.push(countryData);
        } else {
          console.warn(`Invalid or incomplete data for country: ${countryData.country}. Skipping.`);
        }
      } catch (error) {
        console.error(`Error processing row for ${row[headerMap.country]}:`, error);
      }
    }
    return countries;
  }

  private parseNumber(value: any, defaultValue = 0): number {
    if (value === null || value === undefined || String(value).trim() === "") return defaultValue;
    if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,%$]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  private validateCountryData(data: BaseCountryData): boolean {
    return (
      data.country.length > 0 &&
      data.population > 0 &&
      data.gdpPerCapita > 0 // Basic validation, can be expanded
    );
  }

  initializeCountries(baseData: BaseCountryData[]): CountryStats[] {
    return baseData.map(data => this.calculator.initializeCountryStats(data));
  }

  static getDefaultEconomicConfig(): EconomicConfig {
    // This should align with the type `EconomicConfig` from `src/types/ixstats.ts`
    return {
      globalGrowthFactor: 1.0321,
      baseInflationRate: 0.02,
      economicTierThresholds: { developing: 0, emerging: 15000, developed: 35000, advanced: 50000 },
      populationTierThresholds: { micro: 1000000, small: 10000000, medium: 50000000, large: 200000000 },
      tierGrowthModifiers: {
        "Developing": 1.2, "Emerging": 1.1, "Developed": 1.0, "Advanced": 0.9
      } as Record<"Developing" | "Emerging" | "Developed" | "Advanced", number>, // Type assertion for safety
      calculationIntervalMs: 60000, // 1 minute
      ixTimeUpdateFrequency: 4 // Placeholder, meaning not clearly defined here
    };
  }

  static getDefaultConfig(): IxStatsConfig {
    return {
      economic: this.getDefaultEconomicConfig(),
      timeSettings: { baselineYear: 2025, currentIxTimeMultiplier: 4, updateIntervalSeconds: 60 },
      displaySettings: { defaultCurrency: "USD", numberFormat: "compact", showHistoricalData: true, chartTimeRange: 5 }
    };
  }

  exportToExcel(countries: CountryStats[]): ArrayBuffer {
    const exportData = countries.map(country => ({
      'Country': country.country,
      'Current Population': country.currentPopulation,
      'Current GDP per Capita': country.currentGdpPerCapita,
      'Current Total GDP': country.currentTotalGdp,
      'Economic Tier': country.economicTier,
      'Population Tier': country.populationTier,
      'Population Growth Rate': country.populationGrowthRate,
      'GDP Growth Rate': country.adjustedGdpGrowth,
      'Last Updated (IxTime)': IxTime.formatIxTime(country.lastCalculated, true), // Format IxTime
      'Baseline Population': country.population,
      'Baseline GDP per Capita': country.gdpPerCapita
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IxStats Export');
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  }

  getCalculator(): IxStatsCalculator { return this.calculator; }
  getConfig(): IxStatsConfig { return this.config; }
}