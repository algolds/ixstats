// lib/data-service.ts
// Enhanced data service for parsing Excel files with area data

import * as XLSX from 'xlsx';
import { IxStatsCalculator } from './calculations';
import { IxTime } from './ixtime';
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
    const baselineDateForCalc = config.timeSettings.baselineYear 
        ? IxTime.createIxTime(config.timeSettings.baselineYear, 1, 1)
        : undefined;
    this.calculator = new IxStatsCalculator(config.economic, baselineDateForCalc);
  }

  async parseRosterFile(fileBuffer: ArrayBuffer): Promise<BaseCountryData[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No worksheets found in the file');
    }
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error('Worksheet not found in the file');
    }

    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    return this.processRawDataWithHeaderRecognition(rawData);
  }

  private processRawDataWithHeaderRecognition(rawData: any[][]): BaseCountryData[] {
    const countries: BaseCountryData[] = [];
    if (rawData.length < 2) {
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
        actualGdpGrowth: findHeaderIndex(['Actual GDP Growth']),
        // Enhanced area parsing - support both km² and sq mi
        landAreaKm: findHeaderIndex(['Area (km²)', 'Area (SqKm)', 'Land Area (km²)', 'Area km²', 'SqKm']),
        landAreaMi: findHeaderIndex(['Area (sq mi)', 'Area (SqMi)', 'Land Area (sq mi)', 'Area sq mi', 'SqMi']),
        // Fallback for generic area column
        landArea: findHeaderIndex(['Land Area', 'Area', 'SqKm', 'Area (SqKm)'])
    };

    if (headerMap.country === -1 || headerMap.population === -1 || headerMap.gdpPerCapita === -1) {
        throw new Error("Required headers (Country, Population, GDP per Capita) not found in the spreadsheet.");
    }

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row[headerMap.country] || typeof row[headerMap.country] !== 'string') {
        continue;
      }

      try {
        // Parse area data with priority: km² > sq mi > generic area
        let landAreaKm: number | undefined = undefined;
        
        if (headerMap.landAreaKm !== -1) {
          // Direct km² data available
          landAreaKm = this.parseNumberOptional(row[headerMap.landAreaKm]);
        } else if (headerMap.landAreaMi !== -1) {
          // Convert from sq mi to km²
          const landAreaMi = this.parseNumberOptional(row[headerMap.landAreaMi]);
          if (landAreaMi !== undefined) {
            landAreaKm = landAreaMi * 2.58999; // 1 sq mi = 2.58999 km²
          }
        } else if (headerMap.landArea !== -1) {
          // Generic area column (assume km²)
          landAreaKm = this.parseNumberOptional(row[headerMap.landArea]);
        }

        const countryData: BaseCountryData = {
          country: String(row[headerMap.country]).trim(),
          population: this.parseNumberRequired(row[headerMap.population]),
          gdpPerCapita: this.parseNumberRequired(row[headerMap.gdpPerCapita]),
          maxGdpGrowthRate: this.parseNumberRequired(row[headerMap.maxGdpGrowthRate], 0.05),
          adjustedGdpGrowth: this.parseNumberRequired(row[headerMap.adjustedGdpGrowth], 0.03),
          populationGrowthRate: this.parseNumberRequired(row[headerMap.populationGrowthRate], 0.01),
          projected2040Population: this.parseNumberRequired(row[headerMap.projected2040Population], 0),
          projected2040Gdp: this.parseNumberRequired(row[headerMap.projected2040Gdp], 0),
          projected2040GdpPerCapita: this.parseNumberRequired(row[headerMap.projected2040GdpPerCapita], 0),
          actualGdpGrowth: this.parseNumberRequired(row[headerMap.actualGdpGrowth], 0),
          landArea: landAreaKm, // Store in km² for consistency
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

  private parseNumberRequired(value: any, defaultValue: number = 0): number {
    if (value === null || value === undefined || String(value).trim() === "") {
        return defaultValue;
    }
    if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,%$]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  private parseNumberOptional(value: any): number | undefined {
    if (value === null || value === undefined || String(value).trim() === "") {
        return undefined;
    }
    if (typeof value === 'number') return isNaN(value) ? undefined : value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,%$]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private validateCountryData(data: BaseCountryData): boolean {
    return (
      data.country.length > 0 &&
      data.population > 0 &&
      data.gdpPerCapita > 0
    );
  }

  initializeCountries(baseData: BaseCountryData[]): CountryStats[] {
    return baseData.map(data => this.calculator.initializeCountryStats(data));
  }

  static getDefaultEconomicConfig(): EconomicConfig {
    return {
      globalGrowthFactor: 1.0321,
      baseInflationRate: 0.02,
      economicTierThresholds: { developing: 0, emerging: 15000, developed: 35000, advanced: 50000 },
      populationTierThresholds: { micro: 1000000, small: 10000000, medium: 50000000, large: 200000000 },
      tierGrowthModifiers: {
        "Developing": 1.2, "Emerging": 1.1, "Developed": 1.0, "Advanced": 0.9
      } as Record<"Developing" | "Emerging" | "Developed" | "Advanced", number>,
      calculationIntervalMs: 60000,
      ixTimeUpdateFrequency: 4
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
      'Land Area (km²)': country.landArea?.toFixed(2),
      'Land Area (sq mi)': country.landArea ? (country.landArea / 2.58999).toFixed(2) : undefined,
      'Current Population': country.currentPopulation,
      'Population Density (per km²)': country.populationDensity?.toFixed(2),
      'Current GDP per Capita': country.currentGdpPerCapita,
      'Current Total GDP': country.currentTotalGdp,
      'GDP Density (per km²)': country.gdpDensity?.toFixed(2),
      'Economic Tier': country.economicTier,
      'Population Tier': country.populationTier,
      'Population Growth Rate': country.populationGrowthRate,
      'GDP Growth Rate': country.adjustedGdpGrowth,
      'Last Updated (IxTime)': IxTime.formatIxTime(
        country.lastCalculated instanceof Date ? country.lastCalculated.getTime() : country.lastCalculated, 
        true
      ),
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