/**
 * Sum all country areas from World Roster
 */
import XLSX from 'xlsx';

const WORLD_ROSTER_PATH = '/ixwiki/public/projects/ixstats/public/World-Roster.xlsx';

interface WorldRosterCountry {
  Country: string;
  'Area (sq mi)': number;
  'Area (km²)': number;
  Population: number;
}

const workbook = XLSX.readFile(WORLD_ROSTER_PATH);
const worksheet = workbook.Sheets[workbook.SheetNames[0]!];
const data = XLSX.utils.sheet_to_json<WorldRosterCountry>(worksheet);

let totalAreaSqMi = 0;
let totalAreaKm2 = 0;
let totalPopulation = 0;
let count = 0;

console.log('\n📊 WORLD ROSTER TOTALS\n');
console.log('='.repeat(80));
console.log('\n');

for (const row of data) {
  if (row.Country && row['Area (sq mi)'] && row['Area (sq mi)'] > 0) {
    totalAreaSqMi += Number(row['Area (sq mi)']);
    totalAreaKm2 += Number(row['Area (km²)']);
    totalPopulation += Number(row.Population);
    count++;
  }
}

console.log(`Countries: ${count}`);
console.log(`Total Land Area: ${totalAreaSqMi.toLocaleString()} sq mi`);
console.log(`Total Land Area: ${totalAreaKm2.toLocaleString()} km²`);
console.log(`Total Population: ${totalPopulation.toLocaleString()}`);
console.log('\n');
console.log('Comparison to Earth:');
console.log(`  Earth Land Area: 57,510,000 sq mi`);
console.log(`  IxEarth Ratio: ${(totalAreaSqMi / 57510000).toFixed(2)}x`);
console.log('\n');
console.log('Comparison to Screenshot Approximation:');
console.log(`  Screenshot: 126,985,380 sq mi (rough estimate)`);
console.log(`  Actual: ${totalAreaSqMi.toLocaleString()} sq mi`);
console.log(`  Difference: ${Math.abs(totalAreaSqMi - 126985380).toLocaleString()} sq mi`);
console.log('\n');
console.log('='.repeat(80));
console.log('\n');
