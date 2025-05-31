// src/lib/data-parser.ts
import * as XLSX from 'xlsx';
import type { BaseCountryData } from '../types/ixstats';

// Helper parsing functions (these are mostly internal to the parser)
function parseNumberRequired(value: any, defaultValue = 0): number {
  if (value === null || value === undefined || String(value).trim() === "" || String(value).trim().toLowerCase() === '#div/0!') {
    return defaultValue;
  }
  if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,%$"]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

function parseNumberOptional(value: any): number | undefined {
    if (value === null || value === undefined || String(value).trim() === "" || String(value).trim().toLowerCase() === '#div/0!') {
        return undefined;
    }
    if (typeof value === 'number') return isNaN(value) ? undefined : value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,%$"]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

function parsePercentageRequired(value: any, defaultValue = 0): number {
    if (value === null || value === undefined || String(value).trim() === "") {
        return defaultValue;
    }
    const asString = String(value);
    const isPercentString = asString.includes('%');
    const cleaned = asString.replace(/[,"$]/g, '').trim();
    let num;
    if (isPercentString) {
        num = parseFloat(cleaned.replace(/%/g, '')) / 100;
    } else {
        num = parseFloat(cleaned);
    }
    return isNaN(num) ? defaultValue : num; // Ensure it returns the decimal form if it's already a decimal
}


function validateCountryData(data: BaseCountryData): boolean {
  return (
    data.country.length > 0 &&
    data.population > 0 &&
    data.gdpPerCapita > 0
  );
}

function inferHeadersFromData(rawData: any[][]): string[] {
    if (rawData.length >= 1) {
        const firstRow = rawData[0];
        const inferredHeaders: string[] = [];
        if (firstRow) {
            for (let i = 0; i < firstRow.length; i++) {
                const value = String(firstRow[i]).trim();
                if (i === 0 && !value.match(/^\d/)) {
                    inferredHeaders.push("Country");
                } else if (value.match(/^\d{1,3}(,\d{3})*(\.\d+)?$/) || value.match(/^\d+$/)) {
                    if (!inferredHeaders.includes("Population")) {
                        inferredHeaders.push("Population");
                    } else {
                        inferredHeaders.push(`Column${i}`);
                    }
                } else if (value.match(/^\$\d{1,3}(,\d{3})*(\.\d+)?$/) || value.match(/^\d+\.\d+$/)) {
                    if (!inferredHeaders.includes("GDP per Capita")) {
                        inferredHeaders.push("GDP per Capita");
                    } else {
                        inferredHeaders.push(`Column${i}`);
                    }
                } else if (value.match(/^\d+(\.\d+)?%$/)) {
                    if (!inferredHeaders.includes("Population Growth Rate")) {
                        inferredHeaders.push("Population Growth Rate");
                    } else if (!inferredHeaders.includes("GDP Growth")) {
                        inferredHeaders.push("GDP Growth");
                    } else {
                        inferredHeaders.push(`Column${i}`);
                    }
                } else {
                    inferredHeaders.push(`Column${i}`);
                }
            }
            console.log("Inferred headers:", inferredHeaders.join(", "));
            return inferredHeaders;
        }
    }
    return [];
}

function processRawDataWithHeaderRecognition(rawData: any[][], isExcel: boolean): BaseCountryData[] {
  const countries: BaseCountryData[] = [];
  if (rawData.length < 2) {
      console.warn(`Spreadsheet (${isExcel ? 'Excel' : 'CSV'}) has insufficient data (less than 2 rows).`);
      return countries;
  }

  const headers = rawData[0]?.map(h => {
      const header = String(h).trim();
      return header.replace(/^["'](.*)["']$/, '$1').toLowerCase();
  });

  if (!headers) {
      throw new Error(`Could not parse headers from the ${isExcel ? 'Excel' : 'CSV'} file.`);
  }

  console.log("Detected headers:", headers.join(", "));

  const findHeaderIndex = (possibleNames: string[]): number => {
      for (const name of possibleNames) {
          const index = headers.findIndex(h =>
              h.toLowerCase() === name.toLowerCase() ||
              h.toLowerCase().includes(name.toLowerCase())
          );
          if (index !== -1) return index;
      }
      return -1;
  };

  const headerMap = {
      country: findHeaderIndex(['Country', 'Nation Name', 'Nation', 'Country Name']),
      continent: findHeaderIndex(['Continent']),
      region: findHeaderIndex(['Region']),
      governmentType: findHeaderIndex(['Government Type', 'Govt Type', 'Government']),
      religion: findHeaderIndex(['Religion']),
      leader: findHeaderIndex(['Leader']),
      population: findHeaderIndex(['Population', 'Current Population', 'Pop', 'Population (current)']),
      gdpPerCapita: findHeaderIndex(['GDP PC', 'GDP per Capita', 'GDPPC', 'GDPperCap', 'GDP/Capita']),
      maxGdpGrowthRate: findHeaderIndex(['Max GDPPC Grow Rt', 'Max Growth Rate', 'Max GDP Growth']),
      adjustedGdpGrowth: findHeaderIndex(['Adj GDPPC Growth', 'GDP Growth', 'Adjusted GDP Growth']),
      populationGrowthRate: findHeaderIndex(['Pop Growth Rate', 'Population Growth']),
      projected2040Population: findHeaderIndex(['2040 Population']),
      projected2040Gdp: findHeaderIndex(['2040 GDP']),
      projected2040GdpPerCapita: findHeaderIndex(['2040 GDP PC']),
      actualGdpGrowth: findHeaderIndex(['Actual GDP Growth']),
      landAreaKm: findHeaderIndex(['Area (km²)', 'Area (SqKm)', 'Land Area (km²)', 'Area km²', 'Area']),
      landAreaMi: findHeaderIndex(['Area (sq mi)', 'Area (SqMi)', 'Land Area (sq mi)', 'Area sq mi']),
  };

  console.log("Header mapping:", Object.entries(headerMap)
      .map(([key, value]) => `${key}: ${value} (${value >= 0 && headers[value] ? headers[value] : 'not found'})`)
      .join(", "));

  if (headerMap.country === -1 || headerMap.population === -1 || headerMap.gdpPerCapita === -1) {
    if (headerMap.country === -1 && headers.some(h => h.includes('name'))) {
        headerMap.country = headers.findIndex(h => h.includes('name'));
    }
    if (headerMap.population === -1 && headers.some(h => h.match(/pop/i))) {
        headerMap.population = headers.findIndex(h => h.match(/pop/i));
    }
    if (headerMap.gdpPerCapita === -1) {
        const gdpIndex = headers.findIndex(h => h.includes('gdp'));
        if (gdpIndex !== -1) {
            headerMap.gdpPerCapita = gdpIndex;
        }
    }
    if (headerMap.country === -1 || headerMap.population === -1 || headerMap.gdpPerCapita === -1) {
        throw new Error(`Required headers (Country, Population, GDP per Capita) not found. Found: ${headers.join(', ')}`);
    }
  }

  const gameEpochYear = 2028;
  const targetYear = 2040;
  const yearsToTarget = targetYear - gameEpochYear;

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || !row[headerMap.country] || String(row[headerMap.country]).trim() === "" || String(row[headerMap.country]).trim() === "0") {
      continue;
    }
    try {
      let landAreaKm: number | undefined = parseNumberOptional(row[headerMap.landAreaKm]);
      const landAreaMi = parseNumberOptional(row[headerMap.landAreaMi]);
      if (landAreaKm === undefined && landAreaMi !== undefined) {
          landAreaKm = landAreaMi * 2.58999;
      }

      const countryData: BaseCountryData = {
        country: String(row[headerMap.country]).trim(),
        continent: headerMap.continent !== -1 ? (String(row[headerMap.continent]).trim() || null) : null,
        region: headerMap.region !== -1 ? (String(row[headerMap.region]).trim() || null) : null,
        governmentType: headerMap.governmentType !== -1 ? (String(row[headerMap.governmentType]).trim() || null) : null,
        religion: headerMap.religion !== -1 ? (String(row[headerMap.religion]).trim() || null) : null,
        leader: headerMap.leader !== -1 ? (String(row[headerMap.leader]).trim() || null) : null,
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
      };

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
        countryData.actualGdpGrowth = (1 + countryData.populationGrowthRate) * (1 + countryData.adjustedGdpGrowth) -1;
      }

      if (countryData.population <= 0) countryData.population = 1000;
      if (countryData.gdpPerCapita <= 0) countryData.gdpPerCapita = 500;
      if (countryData.maxGdpGrowthRate <= 0) countryData.maxGdpGrowthRate = 0.05;
      if (countryData.adjustedGdpGrowth <= 0) countryData.adjustedGdpGrowth = 0.03; // Default to 0 if it results in negative.
      if (countryData.populationGrowthRate === 0) countryData.populationGrowthRate = 0.01;


      if (validateCountryData(countryData)) {
        countries.push(countryData);
      } else {
        console.warn(`Invalid or incomplete data for country: ${countryData.country}. Skipping.`);
      }
    } catch (error) {
      console.error(`Error processing row for ${row[headerMap.country]}:`, error);
    }
  }
  console.log(`[DataParser] Processed ${countries.length} countries from ${isExcel ? 'Excel' : 'CSV'} file`);
  return countries;
}


function parseCsvData(csvString: string, headerSkipLines = 0): BaseCountryData[] {
  const lines = csvString.split(/\r\n|\n/);
  const dataLines = lines.slice(headerSkipLines);
  if (dataLines.length < 2) {
      console.warn(`CSV has insufficient data (less than 2 effective rows after skipping ${headerSkipLines} lines).`);
      return [];
  }

  const rawDataArrays: any[][] = [];
  for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i] ?? '';
      if (line.trim() === "") continue;
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
      const cleanedValues = values.map(val => {
          if (val.startsWith('"') && val.endsWith('"')) {
              return val.substring(1, val.length - 1).trim();
          }
          return val.trim();
      });
      rawDataArrays.push(cleanedValues);
  }

  if (rawDataArrays.length > 0) {
      const firstRow = rawDataArrays[0] ?? [];
      const looksLikeData = firstRow.some(val => {
          const strVal = String(val).trim();
          return strVal.match(/^\d/) || strVal.match(/^\$/) || strVal.match(/%$/);
      });
      if (looksLikeData) {
          console.log("First row looks like data, inferring headers...");
          const inferredHeaders = inferHeadersFromData(rawDataArrays);
          rawDataArrays.unshift(inferredHeaders);
      }
  }
  return processRawDataWithHeaderRecognition(rawDataArrays, false);
}

export async function parseRosterFile(fileBuffer: ArrayBuffer, fileName?: string): Promise<BaseCountryData[]> {
  if (fileName && fileName.toLowerCase().endsWith('.csv')) {
    const csvString = new TextDecoder("utf-8").decode(fileBuffer);
    const headerSkip = fileName.toLowerCase().includes('world-roster') ? 6 : 0;
    return parseCsvData(csvString, headerSkip);
  } else {
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
    return processRawDataWithHeaderRecognition(rawData, true);
  }
}