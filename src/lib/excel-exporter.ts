// src/lib/excel-exporter.ts
import * as XLSX from 'xlsx';
import { IxTime } from './ixtime';
import type { CountryStats } from '../types/ixstats';

export function exportCountriesToExcel(countries: CountryStats[]): ArrayBuffer {
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