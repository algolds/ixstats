/**
 * Roster File Parser — CSV & JSON support via PapaParse for Admin country roster import.
 */

import Papa from "papaparse";
import type { BaseCountryData } from "~/types/ixstats";

export async function parseRosterFile(
  fileBuffer: ArrayBuffer | Uint8Array,
  fileName: string
): Promise<BaseCountryData[]> {
  const decoder = new TextDecoder("utf-8");
  const text = decoder.decode(fileBuffer);

  if (fileName.endsWith(".json")) {
    const raw = JSON.parse(text);
    return Array.isArray(raw) ? (raw as BaseCountryData[]) : [];
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  return parsed.data
    .filter((row) => row.Country || row.country || row.Name || row.name)
    .map((row) => {
      const countryName = row.Country || row.country || row.Name || row.name || "Unknown";
      const population =
        parseFloat(String(row.Population || row.population || "0").replace(/,/g, "")) || 0;
      const gdpPerCapita =
        parseFloat(
          String(row["GDP PC"] || row.gdpPerCapita || row.gdp_pc || "0").replace(/[$,]/g, "")
        ) || 0;
      const maxGdpGrowth =
        parseFloat(
          String(row["Max GDPPC Grow Rt"] || row.maxGdpGrowthRate || "0").replace(/%/g, "")
        ) / 100 || 0.05;
      const popGrowth =
        parseFloat(
          String(row["Pop Growth Rate"] || row.populationGrowthRate || "0").replace(/%/g, "")
        ) / 100 || 0.01;
      const adjGdpGrowth =
        parseFloat(
          String(row["Adj GDPPC Growth"] || row.adjustedGdpGrowth || "0").replace(/%/g, "")
        ) / 100 || maxGdpGrowth;
      const localGrowth =
        parseFloat(String(row["Local Growth Factor"] || row.localGrowthFactor || "1.0")) || 1.0;

      return {
        country: countryName.trim(),
        continent: row.Continent || row.continent || null,
        region: row.Region || row.region || null,
        governmentType: row["Government Type"] || row.governmentType || null,
        religion: row.Religion || row.religion || null,
        leader: row.Leader || row.leader || null,
        population,
        gdpPerCapita,
        landArea:
          parseFloat(String(row["Area (km²)"] || row.landArea || "0").replace(/,/g, "")) || null,
        areaSqMi:
          parseFloat(String(row["Area (sq mi)"] || row.areaSqMi || "0").replace(/,/g, "")) || null,
        maxGdpGrowthRate: maxGdpGrowth,
        adjustedGdpGrowth: adjGdpGrowth,
        populationGrowthRate: popGrowth,
        actualGdpGrowth: adjGdpGrowth,
        localGrowthFactor: localGrowth,
        projected2040Population: Math.round(population * Math.pow(1 + popGrowth, 15)),
        projected2040Gdp: Math.round(population * gdpPerCapita * Math.pow(1 + adjGdpGrowth, 15)),
        projected2040GdpPerCapita: Math.round(gdpPerCapita * Math.pow(1 + adjGdpGrowth, 15)),
      } satisfies BaseCountryData;
    });
}
