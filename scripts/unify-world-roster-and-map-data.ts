/**
 * Unified Import: World Roster + Geographic Boundaries
 *
 * This script is the master data import for IxStats:
 * 1. Reads canonical country data from World-Roster.xlsx (298 countries)
 * 2. Reads geographic boundaries from PostGIS map_layer_political (185 features)
 * 3. Matches countries to their geographic boundaries
 * 4. Creates/updates Country records with complete unified data
 * 5. Calculates IxEarth scale factor from actual data
 */

import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';

const db = new PrismaClient();

const WORLD_ROSTER_PATH = '/ixwiki/public/projects/ixstats/public/World-Roster.xlsx';

interface WorldRosterCountry {
  Country: string;
  Continent?: string;
  Region?: string;
  'Government Type'?: string;
  Religion?: string;
  Leader?: string;
  Population: number;
  'GDP PC': number;
  'Area (km²)': number;
  'Area (sq mi)': number;
  'Max GDPPC Grow Rt': number;
  'Adj GDPPC Growth': number;
  'Pop Growth Rate': number;
  '2041 Population': number;
  '2041 GDP': number;
  '2041 GDP PC': number;
  'Actual GDP Growth': number;
}

interface GeographicBoundary {
  ogc_fid: number;
  country_id: string;
  fill: string;
  geojson: any;
  area_sq_mi_calculated: number;
  centroid: any;
  bbox: any[];
  coastline_km: number;
}

async function parseWorldRoster(): Promise<WorldRosterCountry[]> {
  console.log('📊 Reading World Roster...\n');

  const workbook = XLSX.readFile(WORLD_ROSTER_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<WorldRosterCountry>(worksheet);

  console.log(`   ✓ Loaded ${data.length} countries from World Roster\n`);

  return data;
}

async function loadGeographicBoundaries(): Promise<Map<string, GeographicBoundary>> {
  console.log('🗺️  Loading geographic boundaries from PostGIS...\n');

  const boundaries = await db.$queryRawUnsafe<GeographicBoundary[]>(`
    SELECT
      ogc_fid,
      country_id,
      fill,
      ST_AsGeoJSON(geometry)::json as geojson,
      ROUND((ST_Area(geometry::geography) / 2589988.11)::numeric, 2) as area_sq_mi_calculated,
      ST_AsGeoJSON(ST_Centroid(geometry))::json as centroid,
      ARRAY[
        ST_XMin(geometry),
        ST_YMin(geometry),
        ST_XMax(geometry),
        ST_YMax(geometry)
      ] as bbox,
      ROUND((ST_Length(ST_Boundary(geometry)::geography) / 1000)::numeric, 2) as coastline_km
    FROM map_layer_political
    WHERE geometry IS NOT NULL
  `);

  const boundaryMap = new Map<string, GeographicBoundary>();
  boundaries.forEach(b => {
    boundaryMap.set(b.country_id.toLowerCase().trim(), b);
  });

  console.log(`   ✓ Loaded ${boundaries.length} geographic boundaries\n`);

  return boundaryMap;
}

function fuzzyMatchCountry(rosterName: string, boundaryNames: string[]): string | null {
  const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const rosterNorm = normalize(rosterName);

  if (!rosterNorm) return null;

  // Exact match
  for (const name of boundaryNames) {
    if (normalize(name) === rosterNorm) {
      return name;
    }
  }

  // Partial match
  for (const name of boundaryNames) {
    const nameNorm = normalize(name);
    if (nameNorm.includes(rosterNorm) || rosterNorm.includes(nameNorm)) {
      return name;
    }
  }

  return null;
}

function calculateEconomicTier(gdpPerCapita: number): string {
  if (gdpPerCapita >= 45000) return 'HIGH';
  if (gdpPerCapita >= 25000) return 'UPPER_MIDDLE';
  if (gdpPerCapita >= 10000) return 'LOWER_MIDDLE';
  return 'LOW';
}

function calculatePopulationTier(population: number): string {
  if (population >= 500000000) return 'MEGA';
  if (population >= 100000000) return 'VERY_LARGE';
  if (population >= 50000000) return 'LARGE';
  if (population >= 10000000) return 'MEDIUM';
  return 'SMALL';
}

function createSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function unifyData() {
  console.log('🌍 Starting Unified Data Import\n');
  console.log('='.repeat(80));
  console.log('\n');

  // Load both data sources
  const rosterCountries = await parseWorldRoster();
  const boundaryMap = await loadGeographicBoundaries();

  // Calculate IxEarth scale factor from actual data
  console.log('📐 Calculating IxEarth Scale Factor\n');

  let totalRosterArea = 0;
  let totalCalculatedArea = 0;
  let matchedForScale = 0;

  const boundaryNames = Array.from(boundaryMap.keys());

  for (const country of rosterCountries) {
    const matchedName = fuzzyMatchCountry(country.Country, boundaryNames);
    if (matchedName && country['Area (sq mi)']) {
      const boundary = boundaryMap.get(matchedName.toLowerCase().trim())!;
      totalRosterArea += Number(country['Area (sq mi)']);
      totalCalculatedArea += Number(boundary.area_sq_mi_calculated);
      matchedForScale++;
    }
  }

  const IXEARTH_SCALE_FACTOR = totalRosterArea / totalCalculatedArea;

  console.log(`   Matched countries: ${matchedForScale}`);
  console.log(`   Total canonical area: ${totalRosterArea.toLocaleString()} sq mi`);
  console.log(`   Total calculated area (Earth scale): ${totalCalculatedArea.toLocaleString()} sq mi`);
  console.log(`   IxEarth Scale Factor: ${IXEARTH_SCALE_FACTOR.toFixed(4)}x`);
  console.log('');

  // Import/update countries
  console.log('💾 Importing Countries\n');
  console.log('='.repeat(80));
  console.log('');

  let created = 0;
  let updated = 0;
  let withGeography = 0;
  let withoutGeography = 0;

  for (const country of rosterCountries) {
    try {
      const matchedName = fuzzyMatchCountry(country.Country, boundaryNames);
      const boundary = matchedName ? boundaryMap.get(matchedName.toLowerCase().trim()) : null;

      const slug = createSlug(country.Country);
      const economicTier = calculateEconomicTier(country['GDP PC']);
      const populationTier = calculatePopulationTier(country.Population);

      // Validate GeoJSON geometry before using it
      let validGeometry = null;
      let validCentroid = null;
      let validBbox = null;
      let validCoastline = null;

      if (boundary) {
        try {
          // Check if GeoJSON is valid (has type and coordinates)
          if (boundary.geojson?.type && boundary.geojson?.coordinates) {
            validGeometry = boundary.geojson;
            validCentroid = boundary.centroid;
            validBbox = boundary.bbox;
            validCoastline = boundary.coastline_km * Math.sqrt(IXEARTH_SCALE_FACTOR);
          }
        } catch (err) {
          console.warn(`   ⚠️  Invalid geometry for ${country.Country}, skipping geographic data`);
        }
      }

      const countryData = {
        name: country.Country,
        slug,
        continent: country.Continent || null,
        region: country.Region || null,
        governmentType: country['Government Type'] || null,
        religion: country.Religion || null,
        leader: country.Leader || null,

        // Canonical area from World Roster
        areaSqMi: country['Area (sq mi)'],
        landArea: country['Area (sq mi)'],

        // Population and economic data
        baselinePopulation: country.Population,
        currentPopulation: country.Population,
        baselineGdpPerCapita: country['GDP PC'],
        currentGdpPerCapita: country['GDP PC'],
        currentTotalGdp: country.Population * country['GDP PC'],

        // Growth rates
        maxGdpGrowthRate: country['Max GDPPC Grow Rt'],
        adjustedGdpGrowth: country['Adj GDPPC Growth'],
        populationGrowthRate: country['Pop Growth Rate'],
        actualGdpGrowth: country['Actual GDP Growth'] || 0,

        // 2041 Projections
        projected2040Population: country['2041 Population'] || 0,
        projected2040Gdp: country['2041 GDP'] || 0,
        projected2040GdpPerCapita: country['2041 GDP PC'] || 0,

        // Tiers
        economicTier,
        populationTier,

        // Density calculations (using canonical area)
        populationDensity: country.Population / country['Area (sq mi)'],
        gdpDensity: (country.Population * country['GDP PC']) / country['Area (sq mi)'],

        // Geographic boundaries (if available and valid)
        geometry: validGeometry,
        centroid: validCentroid,
        boundingBox: validBbox,
        coastlineKm: validCoastline,
      };

      // Look up by both name and slug to avoid duplicates
      const existing = await db.country.findFirst({
        where: {
          OR: [
            { name: country.Country },
            { slug: slug },
          ]
        }
      });

      if (existing) {
        await db.country.update({
          where: { id: existing.id },
          data: countryData,
        });
        updated++;
      } else {
        await db.country.create({
          data: countryData,
        });
        created++;
      }

      if (validGeometry) {
        withGeography++;
        console.log(`✓ ${country.Country.padEnd(30)} → ${country['Area (sq mi)'].toLocaleString().padStart(12)} sq mi (with map)`);
      } else {
        withoutGeography++;
        console.log(`○ ${country.Country.padEnd(30)} → ${country['Area (sq mi)'].toLocaleString().padStart(12)} sq mi (no map)`);
      }

    } catch (error) {
      console.error(`❌ Error importing ${country.Country}:`, error);
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('');
  console.log('✅ Import Complete!\n');
  console.log(`   Created: ${created} countries`);
  console.log(`   Updated: ${updated} countries`);
  console.log(`   With geographic boundaries: ${withGeography}`);
  console.log(`   Without geographic boundaries: ${withoutGeography}`);
  console.log('');
  console.log(`   IxEarth Scale Factor: ${IXEARTH_SCALE_FACTOR.toFixed(4)}x`);
  console.log('');
}

unifyData()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
