// src/lib/data-parser.ts
// Excel-only data parser for IxStats with reduced field set

import * as XLSX from 'xlsx';
import type { BaseCountryData } from '../types/ixstats';

// Helper parsing functions
function parseNumberRequired(value: any, defaultValue = 0): number {
  if (value === null || value === undefined || String(value).trim() === "" || 
      String(value).trim().toLowerCase() === '#div/0!' || String(value).trim() === '0') {
    return defaultValue;
  }
  if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,%$"]/g, '').trim();
    if (cleaned === '' || cleaned.toLowerCase() === '#div/0!') return defaultValue;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

function parseNumberOptional(value: any): number | undefined {
  if (value === null || value === undefined || String(value).trim() === "" || 
      String(value).trim().toLowerCase() === '#div/0!') {
    return undefined;
  }
  if (typeof value === 'number') return isNaN(value) ? undefined : value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,%$"]/g, '').trim();
    if (cleaned === '' || cleaned.toLowerCase() === '#div/0!') return undefined;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parsePercentageRequired(value: any, defaultValue = 0): number {
  if (value === null || value === undefined || String(value).trim() === "" || 
      String(value).trim().toLowerCase() === '#div/0!') {
    return defaultValue;
  }
  const asString = String(value).trim();
  if (asString === '' || asString.toLowerCase() === '#div/0!') return defaultValue;
  
  const isPercentString = asString.includes('%');
  const cleaned = asString.replace(/[,%$"]/g, '').trim();
  let num;
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

function parseStringOptional(value: any): string | null {
  if (value === null || value === undefined || String(value).trim() === "" || 
      String(value).trim().toLowerCase() === '#div/0!') {
    return null;
  }
  const str = String(value).trim();
  return str === '' || str.toLowerCase() === '#div/0!' ? null : str;
}

function validateCountryData(data: BaseCountryData): boolean {
  return (
    data.country.length > 0 &&
    data.population > 0 &&
    data.gdpPerCapita > 0 &&
    data.country.toLowerCase() !== '#div/0!' &&
    !data.country.includes('DIV')
  );
}

function isEmptyRow(row: any[]): boolean {
  if (!row || row.length === 0) return true;
  return row.every(cell => {
    if (cell === null || cell === undefined) return true;
    const str = String(cell).trim();
    return str === '' || str === '0' || str.toLowerCase() === '#div/0!';
  });
}

function processExcelData(rawData: any[][]): BaseCountryData[] {
  const countries: BaseCountryData[] = [];
  
  console.log(`[DataParser] Processing Excel file with ${rawData.length} total rows`);
  
  // Debug: log first few rows to see what we're working with
  for (let i = 0; i < Math.min(rawData.length, 3); i++) {
    console.log(`[DataParser] Row ${i}:`, rawData[i]?.slice(0, 8));
  }
  
  if (rawData.length < 2) {
    console.warn(`Excel file has insufficient data (less than 2 rows).`);
    return countries;
  }

  // Use row 0 as headers
  const headerRowIndex = 0;
  const headerRow = rawData[headerRowIndex];
  
  if (!headerRow) {
    throw new Error(`Could not find header row in the Excel file.`);
  }

  const headers = headerRow.map(h => {
    const header = String(h || '').trim();
    return header.replace(/^["'](.*)["']$/, '$1').toLowerCase();
  });

  console.log(`[DataParser] Raw headers from row ${headerRowIndex}:`, headerRow.slice(0, 13));
  console.log(`[DataParser] Processed headers:`, headers.slice(0, 13));

  const findHeaderIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => {
        const headerLower = h.toLowerCase();
        const nameLower = name.toLowerCase();
        return headerLower === nameLower ||
               headerLower.includes(nameLower) ||
               headerLower.replace(/\s+/g, '').includes(nameLower.replace(/\s+/g, ''));
      });
      if (index !== -1) {
        console.log(`[DataParser] Found '${name}' at index ${index} (header: '${headers[index]}')`);
        return index;
      }
    }
    return -1;
  };

  // Only map the 13 core fields (no projected or actual GDP growth fields)
  const headerMap = {
    country: findHeaderIndex(['Country', 'Nation Name', 'Nation', 'Country Name', 'name']),
    continent: findHeaderIndex(['Continent']),
    region: findHeaderIndex(['Region']),
    governmentType: findHeaderIndex(['Government Type', 'Govt Type', 'Government', 'Gov Type']),
    religion: findHeaderIndex(['Religion']),
    leader: findHeaderIndex(['Leader']),
    population: findHeaderIndex(['Population', 'Current Population', 'Pop', 'Population (current)']),
    gdpPerCapita: findHeaderIndex(['GDP PC', 'GDP per Capita', 'GDPPC', 'GDPperCap', 'GDP/Capita', 'gdppercapita']),
    maxGdpGrowthRate: findHeaderIndex(['Max GDPPC Grow Rt', 'Max Growth Rate', 'Max GDP Growth']),
    adjustedGdpGrowth: findHeaderIndex(['Adj GDPPC Growth', 'GDP Growth', 'Adjusted GDP Growth']),
    populationGrowthRate: findHeaderIndex(['Pop Growth Rate', 'Population Growth', 'popgrowthrate']),
    landAreaKm: findHeaderIndex(['Area (km²)', 'Area (SqKm)', 'Land Area (km²)', 'Area km²', 'Area', 'landarea']),
    landAreaMi: findHeaderIndex(['Area (sq mi)', 'Area (SqMi)', 'Land Area (sq mi)', 'Area sq mi']),
  };

  console.log("[DataParser] Header mapping results:");
  Object.entries(headerMap).forEach(([key, value]) => {
    const headerName = value >= 0 && headers[value] ? headers[value] : 'not found';
    console.log(`  ${key}: ${value} (${headerName})`);
  });

  if (headerMap.country === -1 || headerMap.population === -1 || headerMap.gdpPerCapita === -1) {
    // More aggressive fallback detection
    if (headerMap.country === -1) {
      // Look for any header that might be a country identifier
      headerMap.country = headers.findIndex(h => 
        h.includes('country') || h.includes('nation') || h.includes('name') || 
        (h.length > 0 && !h.includes('gdp') && !h.includes('pop') && !h.includes('area'))
      );
      if (headerMap.country === -1) headerMap.country = 0; // Use first column as fallback
    }
    if (headerMap.population === -1) {
      headerMap.population = headers.findIndex(h => h.includes('pop'));
      if (headerMap.population === -1) {
        // Look for numeric-looking headers that might be population
        headerMap.population = headers.findIndex(h => h.match(/pop|population/i));
      }
    }
    if (headerMap.gdpPerCapita === -1) {
      headerMap.gdpPerCapita = headers.findIndex(h => h.includes('gdp'));
      if (headerMap.gdpPerCapita === -1) {
        // Look for patterns like "pc" or "per capita"
        headerMap.gdpPerCapita = headers.findIndex(h => h.includes('pc') || h.includes('capita'));
      }
    }
    
    console.log("[DataParser] After fallback detection:");
    console.log(`  country: ${headerMap.country} (${headers[headerMap.country] || 'none'})`);
    console.log(`  population: ${headerMap.population} (${headers[headerMap.population] || 'none'})`);
    console.log(`  gdpPerCapita: ${headerMap.gdpPerCapita} (${headers[headerMap.gdpPerCapita] || 'none'})`);
    
    if (headerMap.country === -1 || headerMap.population === -1 || headerMap.gdpPerCapita === -1) {
      throw new Error(`Required headers (Country, Population, GDP per Capita) not found. Found headers: ${headers.join(', ')}`);
    }
  }

  // Start processing from the row after headers
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    
    // Skip empty rows or rows with errors
    if (!row || isEmptyRow(row)) {
      continue;
    }
    
    const countryName = row[headerMap.country];
    if (!countryName || String(countryName).trim() === "" || 
        String(countryName).trim() === "0" || 
        String(countryName).toLowerCase().includes('#div/0!')) {
      continue;
    }
    
    try {
      // Parse land area with better error handling
      let landAreaKm: number | undefined = parseNumberOptional(row[headerMap.landAreaKm]);
      const landAreaMi = parseNumberOptional(row[headerMap.landAreaMi]);
      if (landAreaKm === undefined && landAreaMi !== undefined) {
        landAreaKm = landAreaMi * 2.58999;
      }

      const countryData: BaseCountryData = {
        country: String(countryName).trim(),
        continent: headerMap.continent !== -1 ? parseStringOptional(row[headerMap.continent]) : null,
        region: headerMap.region !== -1 ? parseStringOptional(row[headerMap.region]) : null,
        governmentType: headerMap.governmentType !== -1 ? parseStringOptional(row[headerMap.governmentType]) : null,
        religion: headerMap.religion !== -1 ? parseStringOptional(row[headerMap.religion]) : null,
        leader: headerMap.leader !== -1 ? parseStringOptional(row[headerMap.leader]) : null,
        population: parseNumberRequired(row[headerMap.population], 0),
        gdpPerCapita: parseNumberRequired(row[headerMap.gdpPerCapita], 0),
        maxGdpGrowthRate: parsePercentageRequired(row[headerMap.maxGdpGrowthRate], 0.05),
        adjustedGdpGrowth: parsePercentageRequired(row[headerMap.adjustedGdpGrowth], 0.03),
        populationGrowthRate: parsePercentageRequired(row[headerMap.populationGrowthRate], 0.01),
        landArea: landAreaKm,
        areaSqMi: landAreaMi,
      };

      // Apply minimums
      if (countryData.population <= 0) countryData.population = 1000;
      if (countryData.gdpPerCapita <= 0) countryData.gdpPerCapita = 500;
      if (countryData.maxGdpGrowthRate <= 0) countryData.maxGdpGrowthRate = 0.05;
      if (countryData.adjustedGdpGrowth <= 0) countryData.adjustedGdpGrowth = 0.03;
      if (countryData.populationGrowthRate === 0) countryData.populationGrowthRate = 0.01;

      if (validateCountryData(countryData)) {
        countries.push(countryData);
        console.log(`[DataParser] Successfully parsed: ${countryData.country}`);
      } else {
        console.warn(`[DataParser] Invalid or incomplete data for country: ${countryData.country}. Skipping.`);
      }
    } catch (error) {
      console.error(`[DataParser] Error processing row for ${countryName}:`, error);
    }
  }
  
  console.log(`[DataParser] Processed ${countries.length} valid countries from Excel file`);
  return countries;
}

export async function parseRosterFile(fileBuffer: ArrayBuffer, fileName?: string): Promise<BaseCountryData[]> {
  console.log(`[DataParser] Parsing file: ${fileName}`);
  
  // Only support Excel files now
  if (fileName && !fileName.toLowerCase().match(/\.(xlsx|xls)$/)) {
    throw new Error('Only Excel files (.xlsx, .xls) are supported. CSV import has been removed.');
  }
  
  // Excel file processing
  const workbook = XLSX.read(fileBuffer, { 
    type: 'buffer',
    cellDates: true,
    cellNF: false,
    cellText: false
  });
  
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('No worksheets found in the Excel file');
  }
  
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Worksheet not found in the Excel file');
  }
  
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  console.log(`[DataParser] Processing Excel file with ${rawData.length} rows`);
  return processExcelData(rawData);
}