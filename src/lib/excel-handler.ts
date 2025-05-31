// src/lib/excel-handler.ts
// Excel-only handler for IxStats world roster data with reduced field set

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

// Field mappings for the exact Excel structure (only 13 core fields)
const FIELD_MAPPINGS: ExcelFieldMapping[] = [
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
    required: false,
    type: 'percentage',
    aliases: ['Max Growth Rate', 'Max GDP Growth']
  },
  {
    excelHeader: 'Adj GDPPC Growth',
    dbField: 'adjustedGdpGrowth',
    required: false,
    type: 'percentage',
    aliases: ['GDP Growth', 'Adjusted GDP Growth']
  },
  {
    excelHeader: 'Pop Growth Rate',
    dbField: 'populationGrowthRate',
    required: false,
    type: 'percentage',
    aliases: ['Population Growth', 'popgrowthrate']
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
        console.log(`[Excel Handler] Mapped ${mapping.dbField} to column ${headerIndex} (${headers[headerIndex]})`);
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
        populationGrowthRate: this.parsePercentage(row[fieldMap.get('populationGrowthRate') ?? -1], 0.01)
      };

      // Calculate missing areaSqMi from landArea if needed
      if (!countryData.areaSqMi && countryData.landArea) {
        countryData.areaSqMi = countryData.landArea / 2.58999;
      }

      // Calculate missing landArea from areaSqMi if needed
      if (!countryData.landArea && countryData.areaSqMi) {
        countryData.landArea = countryData.areaSqMi * 2.58999;
      }

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
      mapped
    };
  }
}

// Export a singleton instance
export const excelHandler = new IxStatsExcelHandler();