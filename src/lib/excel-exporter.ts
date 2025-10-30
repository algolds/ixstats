// src/lib/excel-exporter.ts
// Excel exporter with reduced field set (13 core fields only)

import * as XLSX from "xlsx";
import { IxTime } from "./ixtime";
import type { CountryStats } from "../types/ixstats";

export function exportCountriesToExcel(countries: CountryStats[]): ArrayBuffer {
  const currentTime = IxTime.getCurrentIxTime();
  const gameYear = IxTime.getCurrentGameYear();
  const yearsSinceStart = IxTime.getYearsSinceGameEpoch();

  // Export data with only the 13 core fields tracked in the system
  const exportData = countries.map((country) => ({
    Country: country.country,
    Continent: country.continent || "",
    Region: country.region || "",
    "Government Type": country.governmentType || "",
    Religion: country.religion || "",
    Leader: country.leader || "",
    Population: Math.round(country.currentPopulation),
    "GDP PC": parseFloat(country.currentGdpPerCapita.toFixed(2)),
    "Area (km²)": country.landArea ? parseFloat(country.landArea.toFixed(2)) : "",
    "Area (sq mi)": country.areaSqMi ? parseFloat(country.areaSqMi.toFixed(2)) : "",
    "Max GDPPC Grow Rt": parseFloat((country.maxGdpGrowthRate * 100).toFixed(4)) / 100, // Keep as decimal
    "Adj GDPPC Growth": parseFloat((country.adjustedGdpGrowth * 100).toFixed(4)) / 100, // Keep as decimal
    "Pop Growth Rate": parseFloat((country.populationGrowthRate * 100).toFixed(4)) / 100, // Keep as decimal

    // Additional calculated fields for reference
    "Current Total GDP": Math.round(country.currentTotalGdp),
    "Population Density (per km²)": country.populationDensity
      ? parseFloat(country.populationDensity.toFixed(2))
      : "",
    "GDP Density (per km²)": country.gdpDensity ? parseFloat(country.gdpDensity.toFixed(2)) : "",
    "Economic Tier": country.economicTier,
    "Population Tier": country.populationTier,

    // Time context
    "Game Year": gameYear,
    "Years Since Game Start": parseFloat(yearsSinceStart.toFixed(2)),
    "Current IxTime": IxTime.formatIxTime(currentTime, true),
    "Last Updated (IxTime)": IxTime.formatIxTime(
      country.lastCalculated instanceof Date
        ? country.lastCalculated.getTime()
        : country.lastCalculated,
      true
    ),

    // Baseline reference
    "Baseline Population (2028)": Math.round(country.population),
    "Baseline GDP per Capita (2028)": parseFloat(country.gdpPerCapita.toFixed(2)),
    "Baseline Date": IxTime.formatIxTime(IxTime.getInGameEpoch(), true),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set column widths for better readability
  const colWidths = [
    { wch: 20 }, // Country
    { wch: 12 }, // Continent
    { wch: 15 }, // Region
    { wch: 25 }, // Government Type
    { wch: 20 }, // Religion
    { wch: 25 }, // Leader
    { wch: 15 }, // Population
    { wch: 12 }, // GDP PC
    { wch: 12 }, // Area (km²)
    { wch: 12 }, // Area (sq mi)
    { wch: 15 }, // Max GDPPC Grow Rt
    { wch: 15 }, // Adj GDPPC Growth
    { wch: 15 }, // Pop Growth Rate
    { wch: 18 }, // Current Total GDP
    { wch: 15 }, // Population Density
    { wch: 15 }, // GDP Density
    { wch: 12 }, // Economic Tier
    { wch: 12 }, // Population Tier
    { wch: 10 }, // Game Year
    { wch: 15 }, // Years Since Game Start
    { wch: 30 }, // Current IxTime
    { wch: 30 }, // Last Updated
    { wch: 18 }, // Baseline Population
    { wch: 18 }, // Baseline GDP PC
    { wch: 30 }, // Baseline Date
  ];
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `IxStats Export - Year ${gameYear}`);

  // Create metadata sheet
  const metadataSheet = XLSX.utils.json_to_sheet([
    { Property: "Export Date", Value: new Date().toISOString() },
    { Property: "Export Type", Value: "Excel-only (13 core fields)" },
    {
      Property: "Game Epoch (Roster Baseline)",
      Value: IxTime.formatIxTime(IxTime.getInGameEpoch(), true),
    },
    { Property: "Current Game Time", Value: IxTime.formatIxTime(currentTime, true) },
    { Property: "Current Game Year", Value: gameYear.toString() },
    { Property: "Years Since Game Start", Value: yearsSinceStart.toFixed(2) },
    { Property: "Time Multiplier", Value: IxTime.getTimeMultiplier().toString() },
    { Property: "Countries Exported", Value: countries.length.toString() },
    {
      Property: "Core Fields Tracked",
      Value:
        "13 (Country, Continent, Region, Government Type, Religion, Leader, Population, GDP PC, Area (km²), Area (sq mi), Max GDPPC Grow Rt, Adj GDPPC Growth, Pop Growth Rate)",
    },
    {
      Property: "Note",
      Value: "CSV import support has been removed. Only Excel (.xlsx, .xls) files are supported.",
    },
  ]);

  // Set column widths for metadata
  metadataSheet["!cols"] = [{ wch: 30 }, { wch: 50 }];

  XLSX.utils.book_append_sheet(workbook, metadataSheet, "Export Metadata");

  // Create field reference sheet
  const fieldReferenceSheet = XLSX.utils.json_to_sheet([
    {
      "Field Name": "Country",
      Description: "Country name (required)",
      Type: "Text",
      Source: "Excel Column A",
    },
    {
      "Field Name": "Continent",
      Description: "Continental location",
      Type: "Text",
      Source: "Excel Column B",
    },
    {
      "Field Name": "Region",
      Description: "Regional subdivision",
      Type: "Text",
      Source: "Excel Column C",
    },
    {
      "Field Name": "Government Type",
      Description: "Form of government",
      Type: "Text",
      Source: "Excel Column D",
    },
    {
      "Field Name": "Religion",
      Description: "Primary religion",
      Type: "Text",
      Source: "Excel Column E",
    },
    {
      "Field Name": "Leader",
      Description: "Current leader",
      Type: "Text",
      Source: "Excel Column F",
    },
    {
      "Field Name": "Population",
      Description: "Total population (required)",
      Type: "Number",
      Source: "Excel Column G",
    },
    {
      "Field Name": "GDP PC",
      Description: "GDP per capita in USD (required)",
      Type: "Number",
      Source: "Excel Column H",
    },
    {
      "Field Name": "Area (km²)",
      Description: "Land area in square kilometers",
      Type: "Number",
      Source: "Excel Column I",
    },
    {
      "Field Name": "Area (sq mi)",
      Description: "Land area in square miles",
      Type: "Number",
      Source: "Excel Column J",
    },
    {
      "Field Name": "Max GDPPC Grow Rt",
      Description: "Maximum GDP per capita growth rate (decimal)",
      Type: "Percentage",
      Source: "Excel Column K",
    },
    {
      "Field Name": "Adj GDPPC Growth",
      Description: "Adjusted GDP per capita growth rate (decimal)",
      Type: "Percentage",
      Source: "Excel Column L",
    },
    {
      "Field Name": "Pop Growth Rate",
      Description: "Population growth rate (decimal)",
      Type: "Percentage",
      Source: "Excel Column M",
    },
  ]);

  // Set column widths for field reference
  fieldReferenceSheet["!cols"] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(workbook, fieldReferenceSheet, "Field Reference");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
