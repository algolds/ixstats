/**
 * Calculate IxEarth Global Metrics
 *
 * This script analyzes all countries in the database to calculate:
 * - Total IxEarth land area (sum of all countries)
 * - IxEarth vs Earth size comparison
 * - Coverage statistics (countries with/without geographic boundaries)
 * - Scale factor verification
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Earth's actual metrics for comparison
const EARTH_TOTAL_SURFACE_AREA = 196900000; // sq mi (including oceans)
const EARTH_LAND_AREA = 57500000; // sq mi (land only)
const EARTH_WATER_AREA = 139400000; // sq mi (oceans, lakes, etc.)

async function calculateIxEarthMetrics() {
  console.log('🌍 Calculating IxEarth Global Metrics\n');
  console.log('='.repeat(80));
  console.log('\n');

  try {
    // Get all countries from database
    const allCountries = await db.country.findMany({
      select: {
        name: true,
        areaSqMi: true,
        geometry: true,
        currentPopulation: true,
        currentTotalGdp: true,
      },
    });

    // Calculate totals
    let totalLandArea = 0;
    let countriesWithGeography = 0;
    let countriesWithoutGeography = 0;
    let totalPopulation = 0;
    let totalGdp = 0;

    for (const country of allCountries) {
      if (country.areaSqMi) {
        totalLandArea += country.areaSqMi;
      }

      if (country.geometry) {
        countriesWithGeography++;
      } else {
        countriesWithoutGeography++;
      }

      if (country.currentPopulation) {
        totalPopulation += country.currentPopulation;
      }

      if (country.currentTotalGdp) {
        totalGdp += country.currentTotalGdp;
      }
    }

    // Calculate scale factors and comparisons
    const landAreaScaleFactor = totalLandArea / EARTH_LAND_AREA;

    // Estimate total surface area (assuming similar land:water ratio as Earth)
    // Earth is ~29.2% land, ~70.8% water
    const estimatedTotalSurfaceArea = totalLandArea / 0.292;
    const estimatedWaterArea = estimatedTotalSurfaceArea - totalLandArea;
    const totalSurfaceAreaScaleFactor = estimatedTotalSurfaceArea / EARTH_TOTAL_SURFACE_AREA;

    console.log('📊 IxEarth Statistics\n');
    console.log('-'.repeat(80));
    console.log(`   Total Countries: ${allCountries.length}`);
    console.log(`   With Geographic Boundaries: ${countriesWithGeography} (${((countriesWithGeography / allCountries.length) * 100).toFixed(1)}%)`);
    console.log(`   Without Geographic Boundaries: ${countriesWithoutGeography} (${((countriesWithoutGeography / allCountries.length) * 100).toFixed(1)}%)`);
    console.log('');

    console.log('🗺️  IxEarth Land Area\n');
    console.log('-'.repeat(80));
    console.log(`   Total Land Area: ${totalLandArea.toLocaleString()} sq mi`);
    console.log(`   Earth Land Area: ${EARTH_LAND_AREA.toLocaleString()} sq mi`);
    console.log(`   IxEarth/Earth Ratio: ${landAreaScaleFactor.toFixed(4)}x`);
    console.log(`   Percentage Difference: ${((landAreaScaleFactor - 1) * 100).toFixed(1)}% ${landAreaScaleFactor > 1 ? 'larger' : 'smaller'}`);
    console.log('');

    console.log('🌊 IxEarth Estimated Total Surface Area\n');
    console.log('-'.repeat(80));
    console.log(`   Estimated Total Surface: ${estimatedTotalSurfaceArea.toLocaleString()} sq mi`);
    console.log(`   Estimated Water Area: ${estimatedWaterArea.toLocaleString()} sq mi`);
    console.log(`   Land Percentage: ${((totalLandArea / estimatedTotalSurfaceArea) * 100).toFixed(1)}%`);
    console.log(`   Water Percentage: ${((estimatedWaterArea / estimatedTotalSurfaceArea) * 100).toFixed(1)}%`);
    console.log('');
    console.log(`   Earth Total Surface: ${EARTH_TOTAL_SURFACE_AREA.toLocaleString()} sq mi`);
    console.log(`   IxEarth/Earth Ratio: ${totalSurfaceAreaScaleFactor.toFixed(4)}x`);
    console.log(`   Percentage Difference: ${((totalSurfaceAreaScaleFactor - 1) * 100).toFixed(1)}% ${totalSurfaceAreaScaleFactor > 1 ? 'larger' : 'smaller'}`);
    console.log('');

    console.log('👥 Population and Economy\n');
    console.log('-'.repeat(80));
    console.log(`   Total Population: ${totalPopulation.toLocaleString()}`);
    console.log(`   Total GDP: $${(totalGdp / 1000000000000).toFixed(2)} trillion`);
    console.log(`   Average GDP per capita: $${(totalGdp / totalPopulation).toLocaleString()}`);
    console.log(`   Population Density: ${(totalPopulation / totalLandArea).toFixed(2)} people/sq mi`);
    console.log('');

    console.log('📈 Top 10 Largest Countries\n');
    console.log('-'.repeat(80));

    const sortedByArea = allCountries
      .filter(c => c.areaSqMi > 0)
      .sort((a, b) => b.areaSqMi - a.areaSqMi)
      .slice(0, 10);

    sortedByArea.forEach((country, index) => {
      const hasMap = country.geometry ? '🗺️ ' : '   ';
      console.log(`   ${(index + 1).toString().padStart(2)}. ${hasMap}${country.name.padEnd(30)} ${country.areaSqMi.toLocaleString().padStart(15)} sq mi`);
    });
    console.log('');

    console.log('🏙️  Top 10 Most Populous Countries\n');
    console.log('-'.repeat(80));

    const sortedByPopulation = allCountries
      .filter(c => c.currentPopulation > 0)
      .sort((a, b) => b.currentPopulation - a.currentPopulation)
      .slice(0, 10);

    sortedByPopulation.forEach((country, index) => {
      const hasMap = country.geometry ? '🗺️ ' : '   ';
      console.log(`   ${(index + 1).toString().padStart(2)}. ${hasMap}${country.name.padEnd(30)} ${country.currentPopulation.toLocaleString().padStart(15)}`);
    });
    console.log('');

    console.log('💰 Top 10 Largest Economies\n');
    console.log('-'.repeat(80));

    const sortedByGdp = allCountries
      .filter(c => c.currentTotalGdp > 0)
      .sort((a, b) => b.currentTotalGdp - a.currentTotalGdp)
      .slice(0, 10);

    sortedByGdp.forEach((country, index) => {
      const hasMap = country.geometry ? '🗺️ ' : '   ';
      const gdpTrillions = country.currentTotalGdp / 1000000000000;
      console.log(`   ${(index + 1).toString().padStart(2)}. ${hasMap}${country.name.padEnd(30)} $${gdpTrillions.toFixed(2).padStart(8)} trillion`);
    });
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ IxEarth Metrics Calculation Complete!\n');

    console.log('📝 Summary\n');
    console.log(`   IxEarth has ${totalLandArea.toLocaleString()} sq mi of land area,`);
    console.log(`   making it approximately ${landAreaScaleFactor.toFixed(2)}x the size of Earth's land area.`);
    console.log('');
    console.log(`   If IxEarth has a similar land-to-water ratio as Earth (~29% land),`);
    console.log(`   its total surface area would be approximately ${estimatedTotalSurfaceArea.toLocaleString()} sq mi,`);
    console.log(`   making it ${totalSurfaceAreaScaleFactor.toFixed(2)}x the total size of Earth.`);
    console.log('');

  } catch (error) {
    console.error('❌ Error calculating metrics:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

calculateIxEarthMetrics();
