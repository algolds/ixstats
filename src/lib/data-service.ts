// src/lib/data-service.ts
// Enhanced data service with proper epoch handling and CSV support

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
    const gameEpoch = IxTime.getInGameEpoch();
    this.calculator = new IxStatsCalculator(config.economic, gameEpoch);
  }

  async parseRosterFile(fileBuffer: ArrayBuffer, fileName?: string): Promise<BaseCountryData[]> {
    if (fileName && fileName.toLowerCase().endsWith('.csv')) {
      const csvString = new TextDecoder("utf-8").decode(fileBuffer);
      // Determine header skip based on known roster filename
      const headerSkip = fileName.toLowerCase().includes('world-roster') ? 6 : 0;
      return this.parseCsvData(csvString, headerSkip);
    } else { // Assume Excel
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('No worksheets found in the Excel file');
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error('Worksheet not found in the Excel file');
      }
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      return this.processRawDataWithHeaderRecognition(rawData, true); // isExcel = true
    }
  }

  private parseCsvData(csvString: string, headerSkipLines = 0): BaseCountryData[] {
    const lines = csvString.split(/\r\n|\n/);
    // Skip specified metadata lines
    const dataLines = lines.slice(headerSkipLines);
    if (dataLines.length < 2) { // Need headers + at least one data row
        console.warn(`CSV has insufficient data (less than 2 effective rows after skipping ${headerSkipLines} lines).`);
        return [];
    }

    const headerLine = dataLines[0];
    const records = dataLines.slice(1);

    const rawDataArrays: any[][] = [];
    if (headerLine) {
        // A more robust CSV parsing could be implemented here if needed, e.g., handling quoted commas
        rawDataArrays.push(headerLine.split(',').map(h => h.trim())); // Headers
    }
    records.forEach(line => {
        if (line.trim() !== "") { // Skip empty lines
            rawDataArrays.push(line.split(',').map(val => val.trim()));
        }
    });
    return this.processRawDataWithHeaderRecognition(rawDataArrays, false); // isExcel = false
  }


  private processRawDataWithHeaderRecognition(rawData: any[][], isExcel: boolean): BaseCountryData[] {
    const countries: BaseCountryData[] = [];
    if (rawData.length < 2) {
        console.warn(`Spreadsheet (${isExcel ? 'Excel' : 'CSV'}) has insufficient data (less than 2 rows).`);
        return countries;
    }

    const headers = rawData[0]?.map(h => String(h).trim().toLowerCase());
    if (!headers) {
        throw new Error(`Could not parse headers from the ${isExcel ? 'Excel' : 'CSV'} file.`);
    }

    const findHeaderIndex = (possibleNames: string[]): number => {
        for (const name of possibleNames) {
            const index = headers.indexOf(name.toLowerCase());
            if (index !== -1) return index;
        }
        return -1;
    };

    // Consistent header mapping
    const headerMap = {
        country: findHeaderIndex(['Country', 'Nation Name']),
        continent: findHeaderIndex(['Continent']),
        region: findHeaderIndex(['Region']),
        governmentType: findHeaderIndex(['Government Type', 'Govt Type']),
        religion: findHeaderIndex(['Religion']),
        leader: findHeaderIndex(['Leader']),
        population: findHeaderIndex(['Population', 'Current Population', 'Pop']),
        gdpPerCapita: findHeaderIndex(['GDP PC', 'GDP per Capita', 'GDPPC', 'GDPperCap (current US$)']),
        maxGdpGrowthRate: findHeaderIndex(['Max GDPPC Grow Rt', 'Max Growth Rate', 'Max GDP Growth']),
        adjustedGdpGrowth: findHeaderIndex(['Adj GDPPC Growth', 'GDP Growth', 'Adjusted GDP Growth']),
        populationGrowthRate: findHeaderIndex(['Pop Growth Rate', 'Population Growth']),
        projected2040Population: findHeaderIndex(['2040 Population']),
        projected2040Gdp: findHeaderIndex(['2040 GDP']),
        projected2040GdpPerCapita: findHeaderIndex(['2040 GDP PC']),
        actualGdpGrowth: findHeaderIndex(['Actual GDP Growth']),
        landAreaKm: findHeaderIndex(['Area (km²)', 'Area (SqKm)', 'Land Area (km²)', 'Area km²']),
        landAreaMi: findHeaderIndex(['Area (sq mi)', 'Area (SqMi)', 'Land Area (sq mi)', 'Area sq mi']),
    };

    if (headerMap.country === -1 || headerMap.population === -1 || headerMap.gdpPerCapita === -1) {
        throw new Error(`Required headers (Country, Population, GDP per Capita) not found in the ${isExcel ? 'Excel' : 'CSV'} file. Found headers: ${headers.join(', ')}`);
    }

    const gameEpochYear = 2028; // Roster baseline year
    const targetYear = 2040;
    const yearsToTarget = targetYear - gameEpochYear;

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row[headerMap.country] || String(row[headerMap.country]).trim() === "" || String(row[headerMap.country]).trim() === "0") { // Skip empty or placeholder country names
        continue;
      }

      try {
        let landAreaKm: number | undefined = this.parseNumberOptional(row[headerMap.landAreaKm]);
        const landAreaMi = this.parseNumberOptional(row[headerMap.landAreaMi]);
        if (landAreaKm === undefined && landAreaMi !== undefined) {
            landAreaKm = landAreaMi * 2.58999; // Convert sq mi to sq km
        }

        const countryData: BaseCountryData = {
          country: String(row[headerMap.country]).trim(),
          continent: headerMap.continent !== -1 ? (String(row[headerMap.continent]).trim() || null) : null,
          region: headerMap.region !== -1 ? (String(row[headerMap.region]).trim() || null) : null,
          governmentType: headerMap.governmentType !== -1 ? (String(row[headerMap.governmentType]).trim() || null) : null,
          religion: headerMap.religion !== -1 ? (String(row[headerMap.religion]).trim() || null) : null,
          leader: headerMap.leader !== -1 ? (String(row[headerMap.leader]).trim() || null) : null,
          population: this.parseNumberRequired(row[headerMap.population], 0),
          gdpPerCapita: this.parseNumberRequired(row[headerMap.gdpPerCapita], 0),
          maxGdpGrowthRate: this.parsePercentageRequired(row[headerMap.maxGdpGrowthRate], 0.05),
          adjustedGdpGrowth: this.parsePercentageRequired(row[headerMap.adjustedGdpGrowth], 0.03),
          populationGrowthRate: this.parsePercentageRequired(row[headerMap.populationGrowthRate], 0.01),
          projected2040Population: this.parseNumberRequired(row[headerMap.projected2040Population], 0),
          projected2040Gdp: this.parseNumberRequired(row[headerMap.projected2040Gdp], 0),
          projected2040GdpPerCapita: this.parseNumberRequired(row[headerMap.projected2040GdpPerCapita], 0),
          actualGdpGrowth: this.parsePercentageRequired(row[headerMap.actualGdpGrowth], 0),
          landArea: landAreaKm,
          areaSqMi: landAreaMi,
        };
        
        // Default projections if not provided or zero
        if (countryData.projected2040Population === 0 && yearsToTarget > 0 && countryData.population > 0 && countryData.populationGrowthRate !== undefined) {
          countryData.projected2040Population = countryData.population * Math.pow(1 + countryData.populationGrowthRate, yearsToTarget);
        }
        if (countryData.projected2040GdpPerCapita === 0 && yearsToTarget > 0 && countryData.gdpPerCapita > 0 && countryData.adjustedGdpGrowth !== undefined) {
          countryData.projected2040GdpPerCapita = countryData.gdpPerCapita * Math.pow(1 + countryData.adjustedGdpGrowth, yearsToTarget);
        }
        if (countryData.projected2040Gdp === 0 && countryData.projected2040Population > 0 && countryData.projected2040GdpPerCapita > 0) {
          countryData.projected2040Gdp = countryData.projected2040Population * countryData.projected2040GdpPerCapita;
        }
        if (countryData.actualGdpGrowth === 0 && countryData.populationGrowthRate !== undefined && countryData.adjustedGdpGrowth !== undefined) {
          // This is a simple sum; more complex models might differ.
          countryData.actualGdpGrowth = (1 + countryData.populationGrowthRate) * (1 + countryData.adjustedGdpGrowth) -1;
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
    console.log(`[DataService] Processed ${countries.length} countries from ${isExcel ? 'Excel' : 'CSV'} file`);
    return countries;
  }

  private parseNumberRequired(value: any, defaultValue: number = 0): number {
    if (value === null || value === undefined || String(value).trim() === "" || String(value).trim().toLowerCase() === '#div/0!') {
        return defaultValue;
    }
    if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,%$]/g, '').trim(); // Remove commas, percentage, and dollar signs
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  private parseNumberOptional(value: any): number | undefined {
    if (value === null || value === undefined || String(value).trim() === "" || String(value).trim().toLowerCase() === '#div/0!') {
        return undefined;
    }
    if (typeof value === 'number') return isNaN(value) ? undefined : value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,%$]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private parsePercentageRequired(value: any, defaultValue: number = 0): number {
      const asString = String(value);
      const isPercentString = asString.includes('%');
      const num = this.parseNumberRequired(value, defaultValue * (isPercentString ? 100 : 1));
      
      return isPercentString ? num / 100 : num;
  }


  private validateCountryData(data: BaseCountryData): boolean {
    return (
      data.country.length > 0 &&
      data.population >= 0 && 
      data.gdpPerCapita >= 0 
    );
  }

  initializeCountries(baseData: BaseCountryData[]): CountryStats[] {
    console.log(`[DataService] Initializing ${baseData.length} countries with epoch baseline`);
    const initialized = baseData.map(data => {
      const stats = this.calculator.initializeCountryStats(data);
      stats.baselineDate = new Date(IxTime.getInGameEpoch());
      stats.lastCalculated = new Date(IxTime.getInGameEpoch());
      // Carry over all fields from BaseCountryData
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
        baselineYear: 2028,
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
      'Continent': country.continent,
      'Region': country.region,
      'Government Type': country.governmentType,
      'Religion': country.religion,
      'Leader': country.leader,
      'Land Area (km²)': country.landArea?.toFixed(2),
      'Land Area (sq mi)': country.areaSqMi?.toFixed(2),
      'Current Population': country.currentPopulation,
      'Population Density (per km²)': country.populationDensity?.toFixed(2),
      'Current GDP per Capita': country.currentGdpPerCapita,
      'Current Total GDP': country.currentTotalGdp,
      'GDP Density (per km²)': country.gdpDensity?.toFixed(2),
      'Economic Tier': country.economicTier,
      'Population Tier': country.populationTier,
      'Population Growth Rate': country.populationGrowthRate,
      'Adjusted GDP Growth Rate': country.adjustedGdpGrowth,
      'Max GDP Growth Rate': country.maxGdpGrowthRate,
      'Actual GDP Growth': country.actualGdpGrowth,
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
    
    const metadataSheet = XLSX.utils.json_to_sheet([
      { 'Property': 'Export Date', 'Value': new Date().toISOString() },
      { 'Property': 'Game Epoch (Roster Baseline)', 'Value': IxTime.formatIxTime(IxTime.getInGameEpoch(), true) },
      { 'Property': 'Current Game Time', 'Value': IxTime.formatIxTime(currentTime, true) },
      { 'Property': 'Current Game Year', 'Value': gameYear.toString() },
      { 'Property': 'Years Since Game Start', 'Value': yearsSinceStart.toFixed(2) },
      { 'Property': 'Time Multiplier', 'Value': IxTime.getTimeMultiplier().toString() },
      { 'Property': 'Countries Exported', 'Value': countries.length.toString() }
    ]);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Export Metadata');
    
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
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
    const avgPopulation = countries.reduce((sum, c) => sum + c.population, 0) / countries.length;
    const avgGdpPerCapita = countries.reduce((sum, c) => sum + c.gdpPerCapita, 0) / countries.length;
    if (avgPopulation > 500000000) warnings.push("Average population seems very high - check if data is from correct time period");
    if (avgGdpPerCapita > 100000) warnings.push("Average GDP per capita seems very high - verify data represents 2028 baseline");
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
