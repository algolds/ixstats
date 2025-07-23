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

function processRawDataWithHeaderRecognition(rawData: any[][], isExcel: boolean): BaseCountryData[] {
  const countries: BaseCountryData[] = [];
  
  console.log(`[DataParser] Processing ${rawData.length} total rows`);
  
  // Debug: log first few rows to see what we're working with
  for (let i = 0; i < Math.min(rawData.length, 3); i++) {
    console.log(`[DataParser] Row ${i}:`, rawData[i]?.slice(0, 5));
  }
  
  if (rawData.length < 2) {
    console.warn(`Spreadsheet (${isExcel ? 'Excel' : 'CSV'}) has insufficient data (less than 2 rows).`);
    return countries;
  }

  // For CSV, always use row 0 as headers since we know the format
  const headerRowIndex = 0;
  const headerRow = rawData[headerRowIndex];
  
  if (!headerRow) {
    throw new Error(`Could not find header row in the ${isExcel ? 'Excel' : 'CSV'} file.`);
  }

  const headers = headerRow.map(h => {
    const header = String(h || '').trim();
    return header.replace(/^["'](.*)["']$/, '$1').toLowerCase();
  });

  console.log(`[DataParser] Raw headers from row ${headerRowIndex}:`, headerRow.slice(0, 10));
  console.log(`[DataParser] Processed headers:`, headers.slice(0, 10));

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
    projected2040Population: findHeaderIndex(['2040 Population']),
    projected2040Gdp: findHeaderIndex(['2040 GDP']),
    projected2040GdpPerCapita: findHeaderIndex(['2040 GDP PC']),
    actualGdpGrowth: findHeaderIndex(['Actual GDP Growth']),
    landAreaKm: findHeaderIndex(['Area (km²)', 'Area (SqKm)', 'Land Area (km²)', 'Area km²', 'Area', 'landarea']),
    landAreaMi: findHeaderIndex(['Area (sq mi)', 'Area (SqMi)', 'Land Area (sq mi)', 'Area sq mi']),
    localGrowthFactor: findHeaderIndex(['Local Growth Factor', 'Growth Factor', 'Local Factor']),
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
        headerMap.population = headers.findIndex(h => /pop|population/i.exec(h));
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

  const gameEpochYear = 2028;
  const targetYear = 2040;
  const yearsToTarget = targetYear - gameEpochYear;

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
        projected2040Population: parseNumberRequired(row[headerMap.projected2040Population], 0),
        projected2040Gdp: parseNumberRequired(row[headerMap.projected2040Gdp], 0),
        projected2040GdpPerCapita: parseNumberRequired(row[headerMap.projected2040GdpPerCapita], 0),
        actualGdpGrowth: parsePercentageRequired(row[headerMap.actualGdpGrowth], 0),
        landArea: landAreaKm,
        areaSqMi: landAreaMi,
        localGrowthFactor: parseNumberRequired(row[headerMap.localGrowthFactor] || 1.0, 1.0),
      };

      // Calculate missing projections
      if (countryData.projected2040Population === 0 && yearsToTarget > 0 && countryData.population > 0) {
        countryData.projected2040Population = countryData.population * Math.pow(1 + countryData.populationGrowthRate, yearsToTarget);
      }
      if (countryData.projected2040GdpPerCapita === 0 && yearsToTarget > 0 && countryData.gdpPerCapita > 0) {
        countryData.projected2040GdpPerCapita = countryData.gdpPerCapita * Math.pow(1 + countryData.adjustedGdpGrowth, yearsToTarget);
      }
      if (countryData.projected2040Gdp === 0 && countryData.projected2040Population > 0 && countryData.projected2040GdpPerCapita > 0) {
        countryData.projected2040Gdp = countryData.projected2040Population * countryData.projected2040GdpPerCapita;
      }
      if (countryData.actualGdpGrowth === 0) {
        countryData.actualGdpGrowth = (1 + countryData.populationGrowthRate) * (1 + countryData.adjustedGdpGrowth) - 1;
      }

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
  
  console.log(`[DataParser] Processed ${countries.length} valid countries from ${isExcel ? 'Excel' : 'CSV'} file`);
  return countries;
}

function parseCsvData(csvString: string, headerSkipLines = 0): BaseCountryData[] {
  console.log(`[DataParser] Parsing CSV with ${headerSkipLines} header skip lines`);
  
  // Handle different line endings and remove BOM if present
  let cleanedCsv = csvString;
  if (cleanedCsv.charCodeAt(0) === 0xFEFF) {
    cleanedCsv = cleanedCsv.substring(1); // Remove BOM
    console.log("[DataParser] Removed BOM from CSV");
  }
  
  const lines = cleanedCsv.split(/\r\n|\n|\r/);
  console.log(`[DataParser] Found ${lines.length} lines in CSV`);
  
  const dataLines = lines.slice(headerSkipLines);
  
  if (dataLines.length < 2) {
    console.warn(`CSV has insufficient data (less than 2 effective rows after skipping ${headerSkipLines} lines).`);
    return [];
  }

  const rawDataArrays: any[][] = [];
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i] ?? '';
    if (line.trim() === "") continue;
    
    // Simple CSV parsing - split by comma but handle quoted fields
    const values: string[] = [];
    let inQuote = false;
    let currentValue = "";
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(currentValue.trim());
        currentValue = "";
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
    
    rawDataArrays.push(cleanedValues);
    
    // Debug first few rows
    if (i < 3) {
      console.log(`[DataParser] Parsed line ${i}:`, cleanedValues.slice(0, 5));
    }
  }

  return processRawDataWithHeaderRecognition(rawDataArrays, false);
}

export async function parseRosterFile(fileBuffer: ArrayBuffer, fileName?: string): Promise<BaseCountryData[]> {
  console.log(`[DataParser] Parsing file: ${fileName}`);
  
  if (fileName?.toLowerCase().endsWith('.csv')) {
    const csvString = new TextDecoder("utf-8").decode(fileBuffer);
    console.log(`[DataParser] Processing CSV file with ${csvString.split('\n').length} lines`);
    
    // For your specific CSV format, don't skip any lines since headers are on line 1
    const headerSkip = 0;
    return parseCsvData(csvString, headerSkip);
  } else {
    // Excel file processing
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No worksheets found in the Excel file');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error('Worksheet not found in the Excel file');
    }
    
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`[DataParser] Processing Excel file with ${rawData.length} rows`);
    return processRawDataWithHeaderRecognition(rawData as any[][], true);
  }
}
