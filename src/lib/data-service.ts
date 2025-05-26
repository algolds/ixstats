// lib/data-service.ts
// Data service for parsing Excel files and managing country data

import * as XLSX from 'xlsx';
import { IxStatsCalculator } from './calculations';

// Define types locally to avoid import issues
export interface BaseCountryData {
  country: string;
  population: number;
  gdpPerCapita: number;
  maxGdpGrowthRate: number;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  projected2040Population: number;
  projected2040Gdp: number;
  projected2040GdpPerCapita: number;
  actualGdpGrowth: number;
}

export interface CountryStats extends BaseCountryData {
  totalGdp: number;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  lastCalculated: number;
  baselineDate: number;
  economicTier: string;
  populationTier: string;
  localGrowthFactor: number;
  globalGrowthFactor: number;
}

export interface EconomicConfig {
  globalGrowthFactor: number;
  baseInflationRate: number;
  economicTierThresholds: {
    developing: number;
    emerging: number;
    developed: number;
    advanced: number;
  };
  populationTierThresholds: {
    micro: number;
    small: number;
    medium: number;
    large: number;
  };
  tierGrowthModifiers: Record<string, number>;
  calculationIntervalMs: number;
  ixTimeUpdateFrequency: number;
}

export interface IxStatsConfig {
  economic: EconomicConfig;
  timeSettings: {
    baselineYear: number;
    currentIxTimeMultiplier: number;
    updateIntervalSeconds: number;
  };
  displaySettings: {
    defaultCurrency: string;
    numberFormat: "standard" | "scientific" | "compact";
    showHistoricalData: boolean;
    chartTimeRange: number;
  };
}

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
      cellFormula: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No worksheets found in the file');
    }
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error('Worksheet not found in the file');
    }

    const rawData = XLSX.utils.sheet_to_json(worksheet) as any[];
    return this.processRawData(rawData);
  }

  /**
   * Process raw spreadsheet data into structured BaseCountryData
   */
  private processRawData(rawData: any[]): BaseCountryData[] {
    const countries: BaseCountryData[] = [];

    for (const row of rawData) {
      if (!row.Country || typeof row.Country !== 'string') {
        continue;
      }

      try {
        const countryData: BaseCountryData = {
          country: row.Country.trim(),
          population: this.parseNumber(row.Population || row['Current Population'] || row.Pop),
          gdpPerCapita: this.parseNumber(row['GDP PC'] || row['GDP per Capita'] || row.GDPPC),
          maxGdpGrowthRate: this.parseNumber(row['Max GDPPC Grow Rt'] || row['Max Growth Rate'] || 0.05),
          adjustedGdpGrowth: this.parseNumber(row['Adj GDPPC Growth'] || row['GDP Growth'] || 0.03),
          populationGrowthRate: this.parseNumber(row['Pop Growth Rate'] || row['Population Growth'] || 0.01),
          projected2040Population: this.parseNumber(row['2040 Population'] || 0),
          projected2040Gdp: this.parseNumber(row['2040 GDP'] || 0),
          projected2040GdpPerCapita: this.parseNumber(row['2040 GDP PC'] || 0),
          actualGdpGrowth: this.parseNumber(row['Actual GDP Growth'] || 0)
        };

        // Auto-calculate missing projections if not provided
        if (countryData.projected2040Population === 0) {
          const years = 2040 - this.config.timeSettings.baselineYear;
          countryData.projected2040Population = countryData.population * Math.pow(1 + countryData.populationGrowthRate, years);
        }
        
        if (countryData.projected2040GdpPerCapita === 0) {
          const years = 2040 - this.config.timeSettings.baselineYear;
          countryData.projected2040GdpPerCapita = countryData.gdpPerCapita * Math.pow(1 + countryData.adjustedGdpGrowth, years);
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
      data.populationGrowthRate >= -0.1 &&
      data.populationGrowthRate <= 0.2
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
      globalGrowthFactor: 1.0321,
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
        "Developing": 1.2,
        "Emerging": 1.1,
        "Developed": 1.0,
        "Advanced": 0.9
      },
      
      calculationIntervalMs: 60000,
      ixTimeUpdateFrequency: 4
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
        chartTimeRange: 5
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