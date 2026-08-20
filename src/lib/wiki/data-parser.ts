/**
 * Roster & Country Data Parser
 *
 * Parses uploaded spreadsheet files (Excel / CSV) for admin country imports.
 */

import * as XLSX from "xlsx";
import type { BaseCountryData } from "~/types/ixstats";

function parseNumberRequired(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "number") return isNaN(value) ? defaultValue : value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,%$"]/g, "").trim();
    if (cleaned === "" || cleaned.toLowerCase() === "#div/0!") return defaultValue;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

function parseNumberOptional(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return isNaN(value) ? undefined : value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,%$"]/g, "").trim();
    if (cleaned === "" || cleaned.toLowerCase() === "#div/0!") return undefined;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parsePercentageRequired(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue;
  const asString = String(value).trim();
  if (asString === "" || asString.toLowerCase() === "#div/0!") return defaultValue;

  const isPercentString = asString.includes("%");
  const cleaned = asString.replace(/[,%$"]/g, "").trim();
  let num: number;
  if (isPercentString) {
    num = parseFloat(cleaned.replace(/%/g, "")) / 100;
  } else {
    num = parseFloat(cleaned);
    if (num > 1 && num <= 100) {
      num = num / 100;
    }
  }
  return isNaN(num) ? defaultValue : num;
}

function parseString(value: unknown, defaultValue = ""): string {
  if (value === null || value === undefined) return defaultValue;
  return String(value).trim();
}

/**
 * Parse an uploaded roster file (Buffer / ArrayBuffer) into BaseCountryData array.
 */
export async function parseRosterFile(
  fileBuffer: ArrayBuffer | Buffer,
  _fileName?: string
): Promise<BaseCountryData[]> {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

  const countries: BaseCountryData[] = [];

  for (const row of rawRows) {
    const countryName =
      parseString(row["Country"]) ||
      parseString(row["country"]) ||
      parseString(row["Nation"]) ||
      parseString(row["nation"]) ||
      parseString(row["Name"]) ||
      parseString(row["name"]);

    if (!countryName) continue;

    const population =
      parseNumberRequired(row["Population"]) ||
      parseNumberRequired(row["population"]) ||
      parseNumberRequired(row["Pop"]) ||
      1000000;

    const gdpPerCapita =
      parseNumberRequired(row["GDP per Capita"]) ||
      parseNumberRequired(row["gdpPerCapita"]) ||
      parseNumberRequired(row["GDP/Capita"]) ||
      parseNumberRequired(row["gdp_per_capita"]) ||
      25000;

    const continent =
      parseString(row["Continent"]) ||
      parseString(row["continent"]) ||
      parseString(row["Region"]) ||
      parseString(row["region"]) ||
      "Unknown";

    const governmentType =
      parseString(row["Government"]) ||
      parseString(row["government"]) ||
      parseString(row["Government Type"]) ||
      parseString(row["governmentType"]) ||
      "Democracy";

    const landArea =
      parseNumberOptional(row["Land Area"]) ||
      parseNumberOptional(row["Area"]) ||
      parseNumberOptional(row["area"]) ||
      parseNumberOptional(row["landArea"]);

    const maxGdpGrowthRate = parsePercentageRequired(
      row["Max GDPPC Grow Rt"] ?? row["maxGdpGrowthRate"],
      0.03
    );
    const adjustedGdpGrowth = parsePercentageRequired(
      row["Adj GDPPC Growth"] ?? row["adjustedGdpGrowth"],
      0.02
    );
    const populationGrowthRate = parsePercentageRequired(
      row["Pop Growth Rate"] ?? row["populationGrowthRate"],
      0.01
    );
    const actualGdpGrowth = parsePercentageRequired(
      row["Actual GDP Growth"] ?? row["actualGdpGrowth"],
      0.025
    );

    const projected2040Population =
      parseNumberOptional(row["2040 Population"] ?? row["projected2040Population"]) ??
      Math.round(population * Math.pow(1 + populationGrowthRate, 16));

    const projected2040GdpPerCapita =
      parseNumberOptional(row["2040 GDP PC"] ?? row["projected2040GdpPerCapita"]) ??
      Math.round(gdpPerCapita * Math.pow(1 + actualGdpGrowth, 16));

    const projected2040Gdp =
      parseNumberOptional(row["2040 GDP"] ?? row["projected2040Gdp"]) ??
      Math.round(projected2040Population * projected2040GdpPerCapita);

    countries.push({
      country: countryName,
      continent,
      region: parseString(row["Region"] ?? row["region"]) || null,
      governmentType,
      religion: parseString(row["Religion"] ?? row["religion"]) || null,
      leader: parseString(row["Leader"] ?? row["leader"]) || null,
      population,
      gdpPerCapita,
      landArea: landArea ?? null,
      areaSqMi: parseNumberOptional(row["Area (sq mi)"] ?? row["areaSqMi"]) ?? null,
      maxGdpGrowthRate,
      adjustedGdpGrowth,
      populationGrowthRate,
      actualGdpGrowth,
      projected2040Population,
      projected2040Gdp,
      projected2040GdpPerCapita,
      localGrowthFactor: parseNumberRequired(row["Local Growth Factor"] ?? row["localGrowthFactor"], 1),
      unemploymentRate: parseNumberOptional(row["Unemployment"] ?? row["unemploymentRate"]),
      inflationRate: parseNumberOptional(row["Inflation"] ?? row["inflationRate"]),
    });
  }

  return countries;
}
