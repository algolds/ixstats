// src/lib/excel-handler.ts
// Excel-only handler for IxStats world roster data with standardized headers

import * as XLSX from 'xlsx';
import type { BaseCountryData } from '../types/ixstats';

export interface ExcelParseResult {
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

export interface ExcelFieldMapping {
  excelHeader: string;
  dbField: keyof BaseCountryData;
  required: boolean;
  type: 'string' | 'number' | 'percentage';
  aliases: string[];
}

// Field mappings for the standardized Excel headers
const FIELD_MAPPINGS: ExcelFieldMapping[] = [
  // Standard headers - exact matches
  {
    excelHeader: 'Country',
    dbField: 'country',
    required: true,
    type: 'string',
    aliases: ['Nation Name', 'Nation', 'Country Name', 'name']
  },
  {
    excelHeader: 'Continent',
    dbField: 'continent',
    required: false,
    type: 'string',
    aliases: []
  },
  {
    excelHeader: 'Region',
    dbField: 'region',
    required: false,
    type: 'string',
    aliases: []
  },
  {
    excelHeader: 'Government Type',
    dbField: 'governmentType',
    required: false,
    type: 'string',
    aliases: ['Govt Type', 'Government', 'Gov Type']
  },
  {
    excelHeader: 'Religion',
    dbField: 'religion',
    required: false,
    type: 'string',
    aliases: []
  },
  {
    excelHeader: 'Leader',
    dbField: 'leader',
    required: false,
    type: 'string',
    aliases: []
  },
  {
    excelHeader: 'Population',
    dbField: 'population',
    required: true,
    type: 'number',
    aliases: ['Current Population', 'Pop', 'Population (current)']
  },
  {
    excelHeader: 'GDP PC',
    dbField: 'gdpPerCapita',
    required: true,
    type: 'number',
    aliases: ['GDP per Capita', 'GDPPC', 'GDPperCap', 'GDP/Capita', 'gdppercapita']
  },
  {
    excelHeader: 'Area (km²)',
    dbField: 'landArea',
    required: false,
    type: 'number',
    aliases: ['Area (SqKm)', 'Land Area (km²)', 'Area km²', 'Area', 'landarea']
  },
  {
    excelHeader: 'Area (sq mi)',
    dbField: 'areaSqMi',
    required: false,
    type: 'number',
    aliases: ['Area (SqMi)', 'Land Area (sq mi)', 'Area sq mi']
  },
  {
    excelHeader: 'Max GDPPC Grow Rt',
    dbField: 'maxGdpGrowthRate',
    required: true,
    type: 'percentage',
    aliases: ['Max Growth Rate', 'Max GDP Growth']
  },
  {
    excelHeader: 'Adj GDPPC Growth',
    dbField: 'adjustedGdpGrowth',
    required: true,
    type: 'percentage',
    aliases: ['GDP Growth', 'Adjusted GDP Growth']
  },
  {
    excelHeader: 'Pop Growth Rate',
    dbField: 'populationGrowthRate',
    required: true,
    type: 'percentage',
    aliases: ['Population Growth', 'popgrowthrate']
  },
  
  // Required fields that aren't in standard headers - will use defaults
  {
    excelHeader: '2040 Population',
    dbField: 'projected2040Population',
    required: false, // Not in standardized headers, will calculate defaults
    type: 'number',
    aliases: ['2040 Pop', 'Projected Population']
  },
  {
    excelHeader: '2040 GDP',
    dbField: 'projected2040Gdp',
    required: false, // Not in standardized headers, will calculate defaults
    type: 'number',
    aliases: ['Projected GDP']
  },
  {
    excelHeader: '2040 GDP PC',
    dbField: 'projected2040GdpPerCapita',
    required: false, // Not in standardized headers, will calculate defaults
    type: 'number',
    aliases: ['2040 GDPPC', 'Projected GDPPC']
  },
  {
    excelHeader: 'Actual GDP Growth',
    dbField: 'actualGdpGrowth',
    required: false, // Not in standardized headers, will calculate defaults
    type: 'percentage',
    aliases: ['Actual Growth']
  },
  {
    excelHeader: 'Local Growth Factor',
    dbField: 'localGrowthFactor',
    required: false, // Not in standardized headers, will use default 1.0
    type: 'number',
    aliases: ['Growth Factor', 'Local Factor']
  }
];

export class IxStatsExcelHandler {
  
  /**
   * Parse Excel file containing world roster data
   */
  async parseFile(fileBuffer: ArrayBuffer, fileName?: string): Promise<ExcelParseResult> {
    const result: ExcelParseResult = {
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
      // Only support Excel files
      if (fileName && !this.isExcelFile(fileName)) {
        result.errors.push('Only Excel files (.xlsx, .xls) are supported. CSV import has been removed.');
        return result;
      }

      const rawData = this.parseExcelBuffer(fileBuffer);

      if (!rawData || rawData.length < 2) {
        result.errors.push('Excel file must contain at least a header row and one data row');
        return result;
      }

      result.metadata.totalRows = rawData.length - 1; // Exclude header

      // Parse headers and create field mapping
      const headers = rawData[0]?.map(h => String(h || '').trim()) || [];
      const fieldIndexMap = this.createFieldIndexMap(headers);

      console.log('[Excel Handler] Headers found:', headers);
      console.log('[Excel Handler] Field mapping:', Array.from(fieldIndexMap.entries()));

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
        result.errors.push('No valid countries found in Excel file');
        return result;
      }

      result.success = true;
      console.log(`[Excel Handler] Successfully parsed ${result.data.length} countries from ${fileName || 'Excel file'}`);
      
    } catch (error) {
      result.errors.push(`Excel file parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('[Excel Handler] Parse error:', error);
    }

    return result;
  }

  /**
   * Check if file is an Excel file
   */
  private isExcelFile(fileName: string): boolean {
    const extension = fileName.toLowerCase().split('.').pop();
    return extension === 'xlsx' || extension === 'xls';
  }

  /**
   * Parse Excel buffer to raw data array
   */
  private parseExcelBuffer(buffer: ArrayBuffer): any[][] {
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
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
        // console.log(`[Excel Handler] Mapped ${mapping.dbField} to column ${headerIndex} (${headers[headerIndex]})`);
      } else if (mapping.required) {
        console.warn(`[Excel Handler] Required field "${mapping.excelHeader}" (or aliases) not found in headers.`);
      }
    }
    
    return fieldMap;
  }

  /**
   * Find the index of a header that matches the field mapping
   */
  private findHeaderIndex(headers: string[], mapping: ExcelFieldMapping): number {
    const searchTerms = [mapping.excelHeader, ...mapping.aliases];
    
    for (const term of searchTerms) {
      const index = headers.findIndex(header => {
        if (!header) return false; // handle undefined headers
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
        missing.push(mapping.excelHeader);
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
      if (countryIndex === undefined || row[countryIndex] === undefined) {
        console.warn("Skipping row due to missing country name or mapping");
        return null;
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
        population: this.parseNumber(row[fieldMap.get('population') ?? -1], 0), // Default 0, validation will catch
        gdpPerCapita: this.parseNumber(row[fieldMap.get('gdpPerCapita') ?? -1], 0), // Default 0, validation will catch
        landArea: this.parseOptionalNumber(row[fieldMap.get('landArea') ?? -1]),
        areaSqMi: this.parseOptionalNumber(row[fieldMap.get('areaSqMi') ?? -1]),
        maxGdpGrowthRate: this.parsePercentage(row[fieldMap.get('maxGdpGrowthRate') ?? -1], 0.05), // Default to 5% if required and missing
        adjustedGdpGrowth: this.parsePercentage(row[fieldMap.get('adjustedGdpGrowth') ?? -1], 0.03), // Default to 3%
        populationGrowthRate: this.parsePercentage(row[fieldMap.get('populationGrowthRate') ?? -1], 0.01), // Default to 1%
        projected2040Population: this.parseOptionalNumber(row[fieldMap.get('projected2040Population') ?? -1]) ?? 0,
        projected2040Gdp: this.parseOptionalNumber(row[fieldMap.get('projected2040Gdp') ?? -1]) ?? 0,
        projected2040GdpPerCapita: this.parseOptionalNumber(row[fieldMap.get('projected2040GdpPerCapita') ?? -1]) ?? 0,
        actualGdpGrowth: this.parseOptionalNumber(row[fieldMap.get('actualGdpGrowth') ?? -1]) ?? 0,
        localGrowthFactor: this.parseNumber(row[fieldMap.get('localGrowthFactor') ?? -1], 1.0), // Default to 1.0
      };

      // Calculate missing areaSqMi from landArea if needed
      if (countryData.areaSqMi === null && countryData.landArea !== null && countryData.landArea !== undefined) {
        countryData.areaSqMi = countryData.landArea / 2.58999;
      }

      // Calculate missing landArea from areaSqMi if needed
      if (countryData.landArea === null && countryData.areaSqMi !== null && countryData.areaSqMi !== undefined) {
        countryData.landArea = countryData.areaSqMi * 2.58999;
      }
      
      // Calculate default values for missing required fields (that aren't in standard headers)
      // These are required in the database schema but not in the standardized Excel headers
      
      // Calculate 2040 Population (12 years from baseline 2028)
      if (countryData.projected2040Population === null || countryData.projected2040Population === undefined) {
        // Project population 12 years into the future (2028 to 2040)
        countryData.projected2040Population = countryData.population * Math.pow(1 + countryData.populationGrowthRate, 12);
      }
      
      // Calculate 2040 GDP per Capita
      if (countryData.projected2040GdpPerCapita === null || countryData.projected2040GdpPerCapita === undefined) {
        // Project GDP per capita 12 years into the future
        countryData.projected2040GdpPerCapita = countryData.gdpPerCapita * Math.pow(1 + countryData.adjustedGdpGrowth, 12);
      }
      
      // Calculate 2040 total GDP
      if (countryData.projected2040Gdp === null || countryData.projected2040Gdp === undefined) {
        // Calculate projected GDP based on population and GDP per capita
        countryData.projected2040Gdp = countryData.projected2040Population * countryData.projected2040GdpPerCapita;
      }
      
      // Set actual GDP growth if missing
      if (countryData.actualGdpGrowth === null || countryData.actualGdpGrowth === undefined) {
        // Default to the adjusted GDP growth rate
        countryData.actualGdpGrowth = countryData.adjustedGdpGrowth;
      }
      
      // Validate the parsed data
      if (!this.validateCountryData(countryData)) {
        console.warn(`[Excel Handler] Invalid data for country: ${countryName}. Pop: ${countryData.population}, GDPPC: ${countryData.gdpPerCapita}`);
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
      // Exception: if it's a very small decimal already, it might be correct (e.g. 0.05 for 5%)
      if (num > 1 && num <= 100) { // if 5 is given for 5%, convert
          num = num / 100;
      } else if (num > 100) { // if 500 is given for 5%, this is likely an error or different format.
          // Potentially handle as 5.00 if it was meant to be 5%
          // For now, assume direct value if not a typical percentage string.
      }
    }
    
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Validate that country data meets minimum requirements
   */
  private validateCountryData(data: BaseCountryData): boolean {
    const isValid = 
      data.country.length > 0 &&
      data.population > 0 &&
      data.gdpPerCapita > 0 &&
      data.projected2040Population > 0 && // Now we calculate these if missing
      data.projected2040Gdp > 0 &&
      data.projected2040GdpPerCapita > 0 &&
      // actualGdpGrowth can be negative
      !data.country.toLowerCase().includes('#div/0!') &&
      !data.country.includes('DIV');

    if (!isValid) {
      console.warn(`[ExcelHandler] Validation failed for ${data.country}: Pop=${data.population}, GDPPC=${data.gdpPerCapita}, ProjPop=${data.projected2040Population}, ProjGDP=${data.projected2040Gdp}, ProjGDPPC=${data.projected2040GdpPerCapita}`);
    }
    return isValid;
  }

  /**
   * Get field mappings for debugging/info purposes
   */
  getFieldMappings(): ExcelFieldMapping[] {
    return [...FIELD_MAPPINGS];
  }

  /**
   * Validate Excel headers against expected fields
   */
  validateHeaders(headers: string[]): { valid: boolean; missing: string[]; mapped: string[] } {
    const fieldMap = this.createFieldIndexMap(headers);
    const missing = this.validateRequiredFields(fieldMap);
    const mapped = Array.from(fieldMap.keys());
    
    return {
      valid: missing.length === 0,
      missing,
      mapped: mapped as string[] // Cast for simplicity, assuming keys are strings
    };
  }
}

// Export a singleton instance
export const excelHandler = new IxStatsExcelHandler();
