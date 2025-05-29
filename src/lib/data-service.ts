// src/lib/data-service.ts
// Enhanced data service with proper epoch handling

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
    
    // Use the in-game epoch (January 1, 2028) as the baseline for calculations
    // This is when the roster data represents - the "in-game year zero"
    const gameEpoch = IxTime.getInGameEpoch();
    this.calculator = new IxStatsCalculator(config.economic, gameEpoch);
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

    // Calculate projections relative to the in-game epoch (January 1, 2028)
    const gameEpochYear = 2028; // This is year zero in the game
    const targetYear = 2040; // Target year for projections
    const yearsToTarget = targetYear - gameEpochYear; // 12 years from game start to 2040

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
          landArea: landAreaKm,
        };
        
        // Calculate missing projections based on growth rates and time to 2040
        if (countryData.projected2040Population === 0 && yearsToTarget > 0) {
          countryData.projected2040Population = countryData.population * Math.pow(1 + countryData.populationGrowthRate, yearsToTarget);
        }
        if (countryData.projected2040GdpPerCapita === 0 && yearsToTarget > 0) {
          countryData.projected2040GdpPerCapita = countryData.gdpPerCapita * Math.pow(1 + countryData.adjustedGdpGrowth, yearsToTarget);
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
    
    console.log(`[DataService] Processed ${countries.length} countries from roster file`);
    console.log(`[DataService] Roster data represents game epoch: ${IxTime.formatIxTime(IxTime.getInGameEpoch())}`);
    console.log(`[DataService] Current game time: ${IxTime.formatIxTime(IxTime.getCurrentIxTime())}`);
    console.log(`[DataService] Years since game start: ${IxTime.getYearsSinceGameEpoch().toFixed(2)}`);
    
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

  /**
   * Initialize countries from roster data
   * The roster data represents the baseline state at January 1, 2028
   */
  initializeCountries(baseData: BaseCountryData[]): CountryStats[] {
    console.log(`[DataService] Initializing ${baseData.length} countries with epoch baseline`);
    
    const initialized = baseData.map(data => {
      const stats = this.calculator.initializeCountryStats(data);
      
      // Ensure baseline dates are set to the game epoch
      stats.baselineDate = new Date(IxTime.getInGameEpoch());
      stats.lastCalculated = new Date(IxTime.getInGameEpoch());
      
      return stats;
    });
    
    console.log(`[DataService] Countries initialized with baseline: ${IxTime.formatIxTime(IxTime.getInGameEpoch())}`);
    return initialized;
  }

  /**
   * Update a country's stats to the current time
   */
  updateCountryToCurrentTime(countryStats: CountryStats, dmInputs: any[] = []): CountryStats {
    const currentTime = IxTime.getCurrentIxTime();
    const result = this.calculator.calculateTimeProgression(countryStats, currentTime, dmInputs);
    return result.newStats;
  }

  /**
   * Calculate country stats for a specific point in time
   */
  calculateCountryAtTime(countryStats: CountryStats, targetTime: number, dmInputs: any[] = []): CountryStats {
    const result = this.calculator.calculateTimeProgression(countryStats, targetTime, dmInputs);
    return result.newStats;
  }

  /**
   * Create a forecast projection for a country
   */
  createForecast(countryStats: CountryStats, years: number, dmInputs: any[] = []): CountryStats {
    const targetTime = IxTime.addYears(IxTime.getCurrentIxTime(), years);
    return this.calculateCountryAtTime(countryStats, targetTime, dmInputs);
  }

  /**
   * Generate time series data for a country
   */
  generateTimeSeries(
    countryStats: CountryStats, 
    startTime: number, 
    endTime: number, 
    steps: number = 10,
    dmInputs: any[] = []
  ): Array<{
    time: number;
    formattedTime: string;
    gameYear: number;
    stats: CountryStats;
    description: string;
  }> {
    const timeStep = (endTime - startTime) / (steps - 1);
    const series = [];

    for (let i = 0; i < steps; i++) {
      const targetTime = startTime + (timeStep * i);
      const stats = this.calculateCountryAtTime(countryStats, targetTime, dmInputs);
      
      series.push({
        time: targetTime,
        formattedTime: IxTime.formatIxTime(targetTime),
        gameYear: IxTime.getCurrentGameYear(targetTime),
        stats,
        description: this.calculator.getTimeDescription(targetTime),
      });
    }

    return series;
  }

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
      } as Record<"Developing" | "Emerging" | "Developed" | "Advanced", number>,
      calculationIntervalMs: 60000,
      ixTimeUpdateFrequency: 4
    };
  }

  static getDefaultConfig(): IxStatsConfig {
    return {
      economic: this.getDefaultEconomicConfig(),
      timeSettings: { 
        baselineYear: 2028, // Game epoch year
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

  exportToExcel(countries: CountryStats[]): ArrayBuffer {
    const currentTime = IxTime.getCurrentIxTime();
    const gameYear = IxTime.getCurrentGameYear();
    const yearsSinceStart = IxTime.getYearsSinceGameEpoch();

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
      'Game Year': gameYear,
      'Years Since Game Start': yearsSinceStart.toFixed(2),
      'Current IxTime': IxTime.formatIxTime(currentTime, true),
      'Last Updated (IxTime)': IxTime.formatIxTime(
        country.lastCalculated instanceof Date ? country.lastCalculated.getTime() : country.lastCalculated, 
        true
      ),
      'Baseline Population (2028)': country.population,
      'Baseline GDP per Capita (2028)': country.gdpPerCapita,
      'Baseline Date': IxTime.formatIxTime(IxTime.getInGameEpoch(), true),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `IxStats Export - Year ${gameYear}`);
    
    // Add metadata sheet
    const metadataSheet = XLSX.utils.json_to_sheet([
      {
        'Property': 'Export Date',
        'Value': new Date().toISOString(),
      },
      {
        'Property': 'Game Epoch (Roster Baseline)',
        'Value': IxTime.formatIxTime(IxTime.getInGameEpoch(), true),
      },
      {
        'Property': 'Current Game Time',
        'Value': IxTime.formatIxTime(currentTime, true),
      },
      {
        'Property': 'Current Game Year',
        'Value': gameYear.toString(),
      },
      {
        'Property': 'Years Since Game Start',
        'Value': yearsSinceStart.toFixed(2),
      },
      {
        'Property': 'Time Multiplier',
        'Value': IxTime.getTimeMultiplier().toString(),
      },
      {
        'Property': 'Countries Exported',
        'Value': countries.length.toString(),
      }
    ]);
    
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Export Metadata');
    
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  }

  getCalculator(): IxStatsCalculator { 
    return this.calculator; 
  }
  
  getConfig(): IxStatsConfig { 
    return this.config; 
  }

  /**
   * Get information about the current time context
   */
  getTimeContext() {
    const currentTime = IxTime.getCurrentIxTime();
    const gameEpoch = IxTime.getInGameEpoch();
    
    return {
      currentTime,
      gameEpoch,
      currentGameYear: IxTime.getCurrentGameYear(),
      yearsSinceGameStart: IxTime.getYearsSinceGameEpoch(),
      gameTimeDescription: IxTime.getGameTimeDescription(),
      formattedCurrentTime: IxTime.formatIxTime(currentTime, true),
      formattedGameEpoch: IxTime.formatIxTime(gameEpoch, true),
      timeMultiplier: IxTime.getTimeMultiplier(),
      isPaused: IxTime.isPaused(),
    };
  }

  /**
   * Validate that roster data aligns with expected epoch
   */
  validateEpochAlignment(countries: BaseCountryData[]): {
    isValid: boolean;
    warnings: string[];
    info: {
      rosterBaseline: string;
      gameEpoch: string;
      currentGameTime: string;
      yearsElapsed: number;
    };
  } {
    const warnings: string[] = [];
    const gameEpoch = IxTime.getInGameEpoch();
    const currentTime = IxTime.getCurrentIxTime();
    const yearsElapsed = IxTime.getYearsSinceGameEpoch();

    // Check if any countries have suspicious data that might indicate wrong epoch
    const avgPopulation = countries.reduce((sum, c) => sum + c.population, 0) / countries.length;
    const avgGdpPerCapita = countries.reduce((sum, c) => sum + c.gdpPerCapita, 0) / countries.length;

    if (avgPopulation > 500000000) {
      warnings.push("Average population seems very high - check if data is from correct time period");
    }

    if (avgGdpPerCapita > 100000) {
      warnings.push("Average GDP per capita seems very high - verify data represents 2028 baseline");
    }

    // Check for countries with land area but no population density calculated
    const countriesWithAreaButNoDensity = countries.filter(c => c.landArea && c.landArea > 0).length;
    if (countriesWithAreaButNoDensity > 0) {
      console.log(`[DataService] ${countriesWithAreaButNoDensity} countries have land area data for density calculations`);
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      info: {
        rosterBaseline: IxTime.formatIxTime(gameEpoch, true),
        gameEpoch: "January 1, 2028 (In-Game Year Zero)",
        currentGameTime: IxTime.formatIxTime(currentTime, true),
        yearsElapsed: parseFloat(yearsElapsed.toFixed(2)),
      }
    };
  }
}