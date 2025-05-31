// src/lib/csv-handler.ts
// Enhanced CSV handler for IxStats world roster data with all required fields

import * as XLSX from 'xlsx';
import type { BaseCountryData } from '../types/ixstats';

export interface CsvParseResult {
  success: boolean;
  data: BaseCountryData[];
  errors: string[];
  warnings: string[];
  metadata: {
    totalRows: number;
    validRows: number;
    skippedRows: number;
    fileName?: string;
  };
}

export interface CsvFieldMapping {
  csvHeader: string;
  dbField: keyof BaseCountryData;
  required: boolean;
  type: 'string' | 'number' | 'percentage';
  aliases: string[];
}

// Updated field mappings to match the exact headers from the user's CSV
const FIELD_MAPPINGS: CsvFieldMapping[] = [
  {
    csvHeader: 'Country',
    dbField: 'country',
    required: true,
    type: 'string',
    aliases: ['Nation Name', 'Nation', 'Country Name', 'name']
  },
  {
    csvHeader: 'Continent',
    dbField: 'continent',
    required: false,
    type: 'string',
    aliases: []
  },
  {
    csvHeader: 'Region',
    dbField: 'region',
    required: false,
    type: 'string',
    aliases: []
  },
  {
    csvHeader: 'Government Type',
    dbField: 'governmentType',
    required: false,
    type: 'string',
    aliases: ['Govt Type', 'Government', 'Gov Type']
  },
  {
    csvHeader: 'Religion',
    dbField: 'religion',
    required: false,
    type: 'string',
    aliases: []
  },
  {
    csvHeader: 'Leader',
    dbField: 'leader',
    required: false,
    type: 'string',
    aliases: []
  },
  {
    csvHeader: 'Population',
    dbField: 'population',
    required: true,
    type: 'number',
    aliases: ['Current Population', 'Pop', 'Population (current)']
  },
  {
    csvHeader: 'GDP PC',
    dbField: 'gdpPerCapita',
    required: true,
    type: 'number',
    aliases: ['GDP per Capita', 'GDPPC', 'GDPperCap', 'GDP/Capita', 'gdppercapita']
  },
  {
    csvHeader: 'Area (km²)',
    dbField: 'landArea',
    required: false,
    type: 'number',
    aliases: ['Area (SqKm)', 'Land Area (km²)', 'Area km²', 'Area', 'landarea']
  },
  {
    csvHeader: 'Area (sq mi)',
    dbField: 'areaSqMi',
    required: false,
    type: 'number',
    aliases: ['Area (SqMi)', 'Land Area (sq mi)', 'Area sq mi']
  },
  {
    csvHeader: 'Max GDPPC Grow Rt',
    dbField: 'maxGdpGrowthRate',
    required: false,
    type: 'percentage',
    aliases: ['Max Growth Rate', 'Max GDP Growth']
  },
  {
    csvHeader: 'Adj GDPPC Growth',
    dbField: 'adjustedGdpGrowth',
    required: false,
    type: 'percentage',
    aliases: ['GDP Growth', 'Adjusted GDP Growth']
  },
  {
    csvHeader: 'Pop Growth Rate',
    dbField: 'populationGrowthRate',
    required: false,
    type: 'percentage',
    aliases: ['Population Growth', 'popgrowthrate']
  },
  {
    csvHeader: '2040 Population',
    dbField: 'projected2040Population',
    required: false,
    type: 'number',
    aliases: []
  },
  {
    csvHeader: '2040 GDP',
    dbField: 'projected2040Gdp',
    required: false,
    type: 'number',
    aliases: []
  },
  {
    csvHeader: '2040 GDP PC',
    dbField: 'projected2040GdpPerCapita',
    required: false,
    type: 'number',
    aliases: []
  },
  {
    csvHeader: 'Actual GDP Growth',
    dbField: 'actualGdpGrowth',
    required: false,
    type: 'percentage',
    aliases: []
  }
];

export class IxStatsCsvHandler {
  
  /**
   * Parse CSV or Excel file containing world roster data
   */
  async parseFile(fileBuffer: ArrayBuffer, fileName?: string): Promise<CsvParseResult> {
    const result: CsvParseResult = {
      success: false,
      data: [],
      errors: [],
      warnings: [],
      metadata: {
        totalRows: 0,
        validRows: 0,
        skippedRows: 0,
        fileName
      }
    };

    try {
      let rawData: any[][];
      
      if (fileName?.toLowerCase().endsWith('.csv')) {
        rawData = this.parseCsvBuffer(fileBuffer);
      } else {
        rawData = this.parseExcelBuffer(fileBuffer);
      }

      if (!rawData || rawData.length < 2) {
        result.errors.push('File must contain at least a header row and one data row');
        return result;
      }

      result.metadata.totalRows = rawData.length - 1; // Exclude header

      // Parse headers and create field mapping
      const headers = rawData[0]?.map(h => String(h || '').trim()) || [];
      const fieldIndexMap = this.createFieldIndexMap(headers);

      console.log('[CSV Handler] Headers found:', headers);
      console.log('[CSV Handler] Field mapping:', Array.from(fieldIndexMap.entries()));

      // Validate required fields are present
      const missingRequired = this.validateRequiredFields(fieldIndexMap);
      if (missingRequired.length > 0) {
        result.errors.push(`Missing required fields: ${missingRequired.join(', ')}`);
        result.errors.push(`Available headers: ${headers.join(', ')}`);
        return result;
      }

      // Process data rows
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || this.isEmptyRow(row)) {
          result.metadata.skippedRows++;
          continue;
        }

        try {
          const countryData = this.parseRow(row, fieldIndexMap);
          if (countryData) {
            result.data.push(countryData);
            result.metadata.validRows++;
          } else {
            result.metadata.skippedRows++;
            result.warnings.push(`Row ${i + 1}: Skipped due to invalid or missing data`);
          }
        } catch (error) {
          result.metadata.skippedRows++;
          result.warnings.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
        }
      }

      if (result.data.length === 0) {
        result.errors.push('No valid countries found in file');
        return result;
      }

      result.success = true;
      console.log(`[CsvHandler] Successfully parsed ${result.data.length} countries from ${fileName || 'file'}`);
      
    } catch (error) {
      result.errors.push(`File parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('[CsvHandler] Parse error:', error);
    }

    return result;
  }

  /**
   * Parse CSV buffer to raw data array
   */
  private parseCsvBuffer(buffer: ArrayBuffer): any[][] {
    const csvString = new TextDecoder('utf-8').decode(buffer);
    
    // Remove BOM if present
    const cleanCsv = csvString.charCodeAt(0) === 0xFEFF ? csvString.substring(1) : csvString;
    
    const lines = cleanCsv.split(/\r\n|\n|\r/);
    const data: any[][] = [];

    for (const line of lines) {
      if (line.trim() === '') continue;
      
      // Simple CSV parsing with quoted field support
      const values: string[] = [];
      let inQuote = false;
      let currentValue = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());
      
      // Clean quoted values
      const cleanedValues = values.map(val => {
        if (val.startsWith('"') && val.endsWith('"')) {
          return val.substring(1, val.length - 1).trim();
        }
        return val.trim();
      });
      
      data.push(cleanedValues);
    }

    return data;
  }

  /**
   * Parse Excel buffer to raw data array
   */
  private parseExcelBuffer(buffer: ArrayBuffer): any[][] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      throw new Error('No worksheets found in Excel file');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error('Worksheet not found in Excel file');
    }
    
    return XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  }

  /**
   * Create mapping of field names to column indices
   */
  private createFieldIndexMap(headers: string[]): Map<keyof BaseCountryData, number> {
    const fieldMap = new Map<keyof BaseCountryData, number>();
    
    for (const mapping of FIELD_MAPPINGS) {
      const headerIndex = this.findHeaderIndex(headers, mapping);
      if (headerIndex !== -1) {
        fieldMap.set(mapping.dbField, headerIndex);
        console.log(`[CSV Handler] Mapped ${mapping.dbField} to column ${headerIndex} (${headers[headerIndex]})`);
      }
    }
    
    return fieldMap;
  }

  /**
   * Find the index of a header that matches the field mapping
   */
  private findHeaderIndex(headers: string[], mapping: CsvFieldMapping): number {
    const searchTerms = [mapping.csvHeader, ...mapping.aliases];
    
    for (const term of searchTerms) {
      const index = headers.findIndex(header => {
        const headerLower = header.toLowerCase().trim();
        const termLower = term.toLowerCase().trim();
        
        // Exact match first
        if (headerLower === termLower) return true;
        
        // Contains match
        if (headerLower.includes(termLower) || termLower.includes(headerLower)) return true;
        
        // Match without spaces/special chars
        const headerClean = headerLower.replace(/[\s\(\)²]/g, '');
        const termClean = termLower.replace(/[\s\(\)²]/g, '');
        
        return headerClean === termClean || 
               headerClean.includes(termClean) || 
               termClean.includes(headerClean);
      });
      
      if (index !== -1) {
        return index;
      }
    }
    
    return -1;
  }

  /**
   * Validate that all required fields are present
   */
  private validateRequiredFields(fieldMap: Map<keyof BaseCountryData, number>): string[] {
    const missing: string[] = [];
    
    for (const mapping of FIELD_MAPPINGS) {
      if (mapping.required && !fieldMap.has(mapping.dbField)) {
        missing.push(mapping.csvHeader);
      }
    }
    
    return missing;
  }

  /**
   * Check if a row is empty or contains only whitespace/zeros
   */
  private isEmptyRow(row: any[]): boolean {
    if (!row || row.length === 0) return true;
    
    return row.every(cell => {
      if (cell === null || cell === undefined) return true;
      const str = String(cell).trim();
      return str === '' || str === '0' || str.toLowerCase() === '#div/0!';
    });
  }

  /**
   * Parse a single data row into BaseCountryData
   */
  private parseRow(row: any[], fieldMap: Map<keyof BaseCountryData, number>): BaseCountryData | null {
    try {
      // Get country name first - it's required
      const countryIndex = fieldMap.get('country');
      if (countryIndex === undefined) {
        throw new Error('Country field not mapped');
      }
      
      const countryName = this.parseString(row[countryIndex]);
      if (!countryName || countryName.toLowerCase().includes('#div/0!')) {
        return null; // Skip invalid country names
      }

      // Parse all fields with safe fallbacks
      const countryData: BaseCountryData = {
        country: countryName,
        continent: this.parseOptionalString(row[fieldMap.get('continent') ?? -1]),
        region: this.parseOptionalString(row[fieldMap.get('region') ?? -1]),
        governmentType: this.parseOptionalString(row[fieldMap.get('governmentType') ?? -1]),
        religion: this.parseOptionalString(row[fieldMap.get('religion') ?? -1]),
        leader: this.parseOptionalString(row[fieldMap.get('leader') ?? -1]),
        population: this.parseNumber(row[fieldMap.get('population') ?? -1], 1000),
        gdpPerCapita: this.parseNumber(row[fieldMap.get('gdpPerCapita') ?? -1], 500),
        landArea: this.parseOptionalNumber(row[fieldMap.get('landArea') ?? -1]),
        areaSqMi: this.parseOptionalNumber(row[fieldMap.get('areaSqMi') ?? -1]),
        maxGdpGrowthRate: this.parsePercentage(row[fieldMap.get('maxGdpGrowthRate') ?? -1], 0.05),
        adjustedGdpGrowth: this.parsePercentage(row[fieldMap.get('adjustedGdpGrowth') ?? -1], 0.03),
        populationGrowthRate: this.parsePercentage(row[fieldMap.get('populationGrowthRate') ?? -1], 0.01),
        projected2040Population: this.parseNumber(row[fieldMap.get('projected2040Population') ?? -1], 0),
        projected2040Gdp: this.parseNumber(row[fieldMap.get('projected2040Gdp') ?? -1], 0),
        projected2040GdpPerCapita: this.parseNumber(row[fieldMap.get('projected2040GdpPerCapita') ?? -1], 0),
        actualGdpGrowth: this.parsePercentage(row[fieldMap.get('actualGdpGrowth') ?? -1], 0)
      };

      // Calculate missing areaSqMi from landArea if needed
      if (!countryData.areaSqMi && countryData.landArea) {
        countryData.areaSqMi = countryData.landArea / 2.58999;
      }

      // Calculate missing landArea from areaSqMi if needed
      if (!countryData.landArea && countryData.areaSqMi) {
        countryData.landArea = countryData.areaSqMi * 2.58999;
      }

      // Calculate missing projections if needed
      this.calculateMissingProjections(countryData);

      // Validate the parsed data
      if (!this.validateCountryData(countryData)) {
        return null;
      }

      return countryData;

    } catch (error) {
      throw new Error(`Failed to parse row: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse a required string field
   */
  private parseString(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value).trim();
    return str === '#DIV/0!' || str.toLowerCase() === '#div/0!' ? '' : str;
  }

  /**
   * Parse an optional string field
   */
  private parseOptionalString(value: any): string | null {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (str === '' || str === '#DIV/0!' || str.toLowerCase() === '#div/0!') return null;
    return str;
  }

  /**
   * Parse a required number field with default fallback
   */
  private parseNumber(value: any, defaultValue: number): number {
    if (value === null || value === undefined) return defaultValue;
    
    if (typeof value === 'number') {
      return isNaN(value) ? defaultValue : value;
    }
    
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,%$"]/g, '').trim();
      if (cleaned === '' || cleaned.toLowerCase() === '#div/0!') return defaultValue;
      
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    
    return defaultValue;
  }

  /**
   * Parse an optional number field
   */
  private parseOptionalNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,%$"]/g, '').trim();
      if (cleaned === '' || cleaned.toLowerCase() === '#div/0!') return null;
      
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }

  /**
   * Parse a percentage field (converts percentage strings to decimals)
   */
  private parsePercentage(value: any, defaultValue: number): number {
    if (value === null || value === undefined) return defaultValue;
    
    const asString = String(value).trim();
    if (asString === '' || asString.toLowerCase() === '#div/0!') return defaultValue;
    
    const isPercentString = asString.includes('%');
    const cleaned = asString.replace(/[,%$"]/g, '').trim();
    
    let num: number;
    if (isPercentString) {
      num = parseFloat(cleaned.replace(/%/g, '')) / 100;
    } else {
      num = parseFloat(cleaned);
      // If the number is greater than 1 and doesn't have %, assume it's already a percentage that needs converting
      if (num > 1) {
        num = num / 100;
      }
    }
    
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Calculate missing projection values
   */
  private calculateMissingProjections(countryData: BaseCountryData): void {
    const gameEpochYear = 2028;
    const targetYear = 2040;
    const yearsToTarget = targetYear - gameEpochYear;

    // Calculate missing 2040 projections
    if (countryData.projected2040Population === 0 && yearsToTarget > 0 && countryData.population > 0) {
      countryData.projected2040Population = countryData.population * Math.pow(1 + countryData.populationGrowthRate, yearsToTarget);
    }

    if (countryData.projected2040GdpPerCapita === 0 && yearsToTarget > 0 && countryData.gdpPerCapita > 0) {
      countryData.projected2040GdpPerCapita = countryData.gdpPerCapita * Math.pow(1 + countryData.adjustedGdpGrowth, yearsToTarget);
    }

    if (countryData.projected2040Gdp === 0 && countryData.projected2040Population > 0 && countryData.projected2040GdpPerCapita > 0) {
      countryData.projected2040Gdp = countryData.projected2040Population * countryData.projected2040GdpPerCapita;
    }

    // Calculate actual GDP growth if missing
    if (countryData.actualGdpGrowth === 0) {
      countryData.actualGdpGrowth = (1 + countryData.populationGrowthRate) * (1 + countryData.adjustedGdpGrowth) - 1;
    }
  }

  /**
   * Validate that country data meets minimum requirements
   */
  private validateCountryData(data: BaseCountryData): boolean {
    return (
      data.country.length > 0 &&
      data.population > 0 &&
      data.gdpPerCapita > 0 &&
      !data.country.toLowerCase().includes('#div/0!') &&
      !data.country.includes('DIV')
    );
  }

  /**
   * Get field mappings for debugging/info purposes
   */
  getFieldMappings(): CsvFieldMapping[] {
    return [...FIELD_MAPPINGS];
  }

  /**
   * Validate CSV headers against expected fields
   */
  validateHeaders(headers: string[]): { valid: boolean; missing: string[]; mapped: string[] } {
    const fieldMap = this.createFieldIndexMap(headers);
    const missing = this.validateRequiredFields(fieldMap);
    const mapped = Array.from(fieldMap.keys());
    
    return {
      valid: missing.length === 0,
      missing,
      mapped
    };
  }
}

// Export a singleton instance
export const csvHandler = new IxStatsCsvHandler();