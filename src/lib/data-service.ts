// lib/data-service.ts
// Data service for parsing Excel files and managing country data

import * as XLSX from 'xlsx';
import {
  BaseCountryData,
  CountryStats,
  EconomicConfig,
  EconomicTier,
  PopulationTier,
  IxStatsConfig
} from '../types/ixstats';
import { IxStatsCalculator } from './calculations';

export class IxStatsDataService {
  private calculator: IxStatsCalculator;
  private config: IxStatsConfig;

  constructor(config: IxStatsConfig) {
    this.config = config;
    this.calculator = new IxStatsCalculator(config.economic);
  }

  /**
   * Parse Excel file and extract country data
   */
  async parseRosterFile(fileBuffer: ArrayBuffer): Promise<BaseCountryData[]> {
    const workbook = XLSX.read(fileBuffer, {
      cellStyles: true,
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });

    // Assume the first sheet contains the roster data
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with headers
    const rawData = XLSX.utils.sheet_to_json(worksheet) as any[];

    return this.processRawData(rawData);
  }

  /**
   * Process raw spreadsheet data into structured BaseCountryData
   */
  private processRawData(rawData: any[]): BaseCountryData[] {
    const countries: BaseCountryData[] = [];

    for (const row of rawData) {
      // Skip rows without country data
      if (!row.Country || typeof row.Country !== 'string') {
        continue;
      }

      try {
        const countryData: BaseCountryData = {
          country: row.Country.trim(),
          population: this.parseNumber(row.Population),
          gdpPerCapita: this.parseNumber(row['GDP PC']),
          maxGdpGrowthRate: this.parseNumber(row['Max GDPPC Grow Rt']),
          adjustedGdpGrowth: this.parseNumber(row['Adj GDPPC Growth']),
          populationGrowthRate: this.parseNumber(row['Pop Growth Rate']),
          projected2040Population: this.parseNumber(row['2040 Population']),
          projected2040Gdp: this.parseNumber(row['2040 GDP']),
          projected2040GdpPerCapita: this.parseNumber(row['2040 GDP PC']),
          actualGdpGrowth: this.parseNumber(row['Actual GDP Growth'])
        };

        // Validate the data
        if (this.validateCountryData(countryData)) {
          countries.push(countryData);
        } else {
          console.warn(`Invalid data for country: ${countryData.country}`);
        }
      } catch (error) {
        console.error(`Error processing row for ${row.Country}:`, error);
      }
    }

    return countries;
  }

  /**
   * Parse number from various formats
   */
  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,%$]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Validate country data completeness
   */
  private validateCountryData(data: BaseCountryData): boolean {
    return (
      data.country.length > 0 &&
      data.population > 0 &&
      data.gdpPerCapita > 0 &&
      data.maxGdpGrowthRate >= 0 &&
      data.populationGrowthRate >= -0.1 && // Allow some negative growth
      data.populationGrowthRate <= 0.1 // Reasonable upper bound
    );
  }

  /**
   * Convert BaseCountryData to initialized CountryStats
   */
  initializeCountries(baseData: BaseCountryData[]): CountryStats[] {
    return baseData.map(data => this.calculator.initializeCountryStats(data));
  }

  /**
   * Get default economic configuration
   */
  static getDefaultEconomicConfig(): EconomicConfig {
    return {
      globalGrowthFactor: 1.0321, // 3.21% as shown in spreadsheet
      baseInflationRate: 0.02,
      
      economicTierThresholds: {
        developing: 0,
        emerging: 15000,
        developed: 35000,
        advanced: 50000
      },
      
      populationTierThresholds: {
        micro: 1000000,
        small: 10000000,
        medium: 50000000,
        large: 200000000
      },
      
      tierGrowthModifiers: {
        [EconomicTier.DEVELOPING]: 1.2, // Higher growth potential
        [EconomicTier.EMERGING]: 1.1,
        [EconomicTier.DEVELOPED]: 1.0,
        [EconomicTier.ADVANCED]: 0.9 // Slower growth for mature economies
      },
      
      calculationIntervalMs: 60000, // Update every minute
      ixTimeUpdateFrequency: 4 // 4x faster than real time
    };
  }

  /**
   * Get default IxStats configuration
   */
  static getDefaultConfig(): IxStatsConfig {
    return {
      economic: this.getDefaultEconomicConfig(),
      timeSettings: {
        baselineYear: 2025,
        currentIxTimeMultiplier: 4,
        updateIntervalSeconds: 60
      },
      displaySettings: {
        defaultCurrency: "USD",
        numberFormat: "compact",
        showHistoricalData: true,
        chartTimeRange: 5 // 5 years
      }
    };
  }

  /**
   * Export countries data to Excel format
   */
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
      'Last Updated (IxTime)': new Date(country.lastCalculated).toISOString(),
      'Baseline Population': country.population,
      'Baseline GDP per Capita': country.gdpPerCapita
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IxStats Export');

    return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  }

  /**
   * Add new country to the system
   */
  addNewCountry(countryData: Omit<BaseCountryData, 'projected2040Population' | 'projected2040Gdp' | 'projected2040GdpPerCapita' | 'actualGdpGrowth'>): BaseCountryData {
    // Calculate missing projections based on growth rates
    const years = 2040 - this.config.timeSettings.baselineYear;
    const projected2040Population = countryData.population * Math.pow(1 + countryData.populationGrowthRate, years);
    const projected2040GdpPerCapita = countryData.gdpPerCapita * Math.pow(1 + countryData.adjustedGdpGrowth, years);
    const projected2040Gdp = projected2040Population * projected2040GdpPerCapita;
    
    // Calculate actual GDP growth (simplified)
    const actualGdpGrowth = countryData.populationGrowthRate + countryData.adjustedGdpGrowth;

    return {
      ...countryData,
      projected2040Population,
      projected2040Gdp,
      projected2040GdpPerCapita,
      actualGdpGrowth
    };
  }

  /**
   * Update economic configuration
   */
  updateEconomicConfig(newConfig: Partial<EconomicConfig>): void {
    this.config.economic = { ...this.config.economic, ...newConfig };
    this.calculator.updateConfig(this.config.economic);
  }

  /**
   * Get calculator instance
   */
  getCalculator(): IxStatsCalculator {
    return this.calculator;
  }

  /**
   * Get current configuration
   */
  getConfig(): IxStatsConfig {
    return this.config;
  }
}