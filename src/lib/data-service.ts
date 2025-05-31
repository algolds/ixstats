// src/lib/data-service.ts
// Excel-only data service for IxStats with reduced field set

import { IxStatsCalculator } from './calculations';
import { IxTime } from './ixtime';
import type {
  BaseCountryData,
  CountryStats,
  EconomicConfig,
  IxStatsConfig,
  HistoricalDataPoint
} from '../types/ixstats';
import { parseRosterFile as parseRosterFileFromParser } from './data-parser';
import { getDefaultEconomicConfig, getDefaultIxStatsConfig } from './config-service';
import { exportCountriesToExcel as exportToExcelUtil } from './excel-exporter';

export class IxStatsDataService {
  private calculator: IxStatsCalculator;
  private config: IxStatsConfig;

  constructor(config: IxStatsConfig) {
    this.config = config;
    const gameEpoch = IxTime.getInGameEpoch();
    this.calculator = new IxStatsCalculator(config.economic, gameEpoch);
  }

  async parseRosterFile(fileBuffer: ArrayBuffer, fileName?: string): Promise<BaseCountryData[]> {
    // Only support Excel files
    if (fileName && !fileName.toLowerCase().match(/\.(xlsx|xls)$/)) {
      throw new Error('Only Excel files (.xlsx, .xls) are supported. CSV import has been removed.');
    }
    return parseRosterFileFromParser(fileBuffer, fileName);
  }

  initializeCountries(baseData: BaseCountryData[]): CountryStats[] {
    console.log(`[DataService] Initializing ${baseData.length} countries with epoch baseline`);
    const initialized = baseData.map(data => {
      const stats = this.calculator.initializeCountryStats(data);
      stats.baselineDate = new Date(IxTime.getInGameEpoch());
      stats.lastCalculated = new Date(IxTime.getInGameEpoch());
      
      // Ensure all the descriptive fields are properly carried over
      stats.continent = data.continent;
      stats.region = data.region;
      stats.governmentType = data.governmentType;
      stats.religion = data.religion;
      stats.leader = data.leader;
      stats.areaSqMi = data.areaSqMi;
      
      return stats;
    });
    console.log(`[DataService] Countries initialized with baseline: ${IxTime.formatIxTime(IxTime.getInGameEpoch())}`);
    return initialized;
  }

  updateCountryToCurrentTime(countryStats: CountryStats, dmInputs: any[] = []): CountryStats {
    const currentTime = IxTime.getCurrentIxTime();
    const result = this.calculator.calculateTimeProgression(countryStats, currentTime, dmInputs);
    return result.newStats;
  }

  calculateCountryAtTime(countryStats: CountryStats, targetTime: number, dmInputs: any[] = []): CountryStats {
    const result = this.calculator.calculateTimeProgression(countryStats, targetTime, dmInputs);
    return result.newStats;
  }

  createForecast(countryStats: CountryStats, years: number, dmInputs: any[] = []): CountryStats {
    const targetTime = IxTime.addYears(IxTime.getCurrentIxTime(), years);
    return this.calculateCountryAtTime(countryStats, targetTime, dmInputs);
  }

  generateTimeSeries(
    countryStats: CountryStats,
    startTime: number,
    endTime: number,
    steps = 10,
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

  static getDefaultEconomicConfig = getDefaultEconomicConfig;
  static getDefaultConfig = getDefaultIxStatsConfig;

  // Use the imported export utility
  exportToExcel(countries: CountryStats[]): ArrayBuffer {
    return exportToExcelUtil(countries);
  }

  getCalculator(): IxStatsCalculator { return this.calculator; }
  getConfig(): IxStatsConfig { return this.config; }

  getTimeContext() {
    const currentTime = IxTime.getCurrentIxTime();
    const gameEpoch = IxTime.getInGameEpoch();
    return {
      currentTime, gameEpoch,
      currentGameYear: IxTime.getCurrentGameYear(),
      yearsSinceGameStart: IxTime.getYearsSinceGameEpoch(),
      gameTimeDescription: IxTime.getGameTimeDescription(),
      formattedCurrentTime: IxTime.formatIxTime(currentTime, true),
      formattedGameEpoch: IxTime.formatIxTime(gameEpoch, true),
      timeMultiplier: IxTime.getTimeMultiplier(),
      isPaused: IxTime.isPaused(),
    };
  }

  validateEpochAlignment(countries: BaseCountryData[]): {
    isValid: boolean; warnings: string[]; info: {
      rosterBaseline: string; gameEpoch: string; currentGameTime: string; yearsElapsed: number;
    };
  } {
    const warnings: string[] = [];
    const gameEpoch = IxTime.getInGameEpoch();
    const currentTime = IxTime.getCurrentIxTime();
    const yearsElapsed = IxTime.getYearsSinceGameEpoch();
    
    // Validate data quality
    const avgPopulation = countries.length > 0 ? countries.reduce((sum, c) => sum + c.population, 0) / countries.length : 0;
    const avgGdpPerCapita = countries.length > 0 ? countries.reduce((sum, c) => sum + c.gdpPerCapita, 0) / countries.length : 0;
    
    if (avgPopulation > 500000000) {
      warnings.push("Average population seems very high - check if data is from correct time period");
    }
    if (avgGdpPerCapita > 100000) {
      warnings.push("Average GDP per capita seems very high - verify data represents 2028 baseline");
    }
    
    const countriesWithAreaButNoDensity = countries.filter(c => c.landArea && c.landArea > 0).length;
    if (countriesWithAreaButNoDensity > 0) {
      console.log(`[DataService] ${countriesWithAreaButNoDensity} countries have land area data for density calculations`);
    }
    
    return {
      isValid: warnings.length === 0, warnings, info: {
        rosterBaseline: IxTime.formatIxTime(gameEpoch, true),
        gameEpoch: "January 1, 2028 (In-Game Year Zero)",
        currentGameTime: IxTime.formatIxTime(currentTime, true),
        yearsElapsed: parseFloat(yearsElapsed.toFixed(2)),
      }
    };
  }
}