/**
 * Parse World Roster Excel file and extract canonical country data
 * This is the source of truth for all country information in IxStats
 */

import XLSX from 'xlsx';
import fs from 'fs';

const WORLD_ROSTER_PATH = '/ixwiki/public/projects/ixstats/public/World-Roster.xlsx';

interface WorldRosterCountry {
  name: string;
  area_sq_mi?: number;
  area_sq_km?: number;
  population?: number;
  gdp?: number;
  capital?: string;
  government_type?: string;
  currency?: string;
  [key: string]: any; // For other fields we discover
}

async function parseWorldRoster() {
  console.log('📊 Parsing World Roster...\n');

  // Read Excel file
  const workbook = XLSX.readFile(WORLD_ROSTER_PATH);

  console.log('📋 Sheets found:', workbook.SheetNames);
  console.log('');

  // Parse the first sheet (or find the main roster sheet)
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`📄 Sheet: "${sheetName}"`);
  console.log(`   Rows: ${data.length}`);
  console.log('');

  if (data.length > 0) {
    console.log('🔍 Column headers found:');
    const firstRow = data[0] as any;
    const columns = Object.keys(firstRow);
    columns.forEach((col, idx) => {
      const sampleValue = firstRow[col];
      const valuePreview = sampleValue
        ? String(sampleValue).substring(0, 50) + (String(sampleValue).length > 50 ? '...' : '')
        : '(empty)';
      console.log(`   ${idx + 1}. "${col}" - Example: ${valuePreview}`);
    });
    console.log('');

    console.log('📊 Sample rows:');
    data.slice(0, 5).forEach((row: any, idx) => {
      console.log(`\n   Row ${idx + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        if (value) {
          console.log(`      ${key}: ${value}`);
        }
      });
    });
  }

  // Output to JSON for easier inspection
  const outputPath = '/ixwiki/public/projects/ixstats/scripts/world-roster-data.json';
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`\n✅ Full data exported to: ${outputPath}`);
  console.log(`   Total countries: ${data.length}`);

  return data;
}

parseWorldRoster().catch((error) => {
  console.error('❌ Error parsing World Roster:', error);
  process.exit(1);
});
