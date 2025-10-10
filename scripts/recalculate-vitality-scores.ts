/**
 * Script to recalculate and store vitality scores for all countries
 * Run with: npx tsx scripts/recalculate-vitality-scores.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateAllVitalityScores } from '../src/lib/vitality-calculator';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting vitality scores recalculation...\n');

  const countries = await prisma.country.findMany({
    select: {
      id: true,
      name: true,
      currentGdpPerCapita: true,
      currentPopulation: true,
      currentTotalGdp: true,
      realGDPGrowthRate: true,
      adjustedGdpGrowth: true,
      populationGrowthRate: true,
      economicTier: true,
      populationTier: true,
      employmentRate: true,
      unemploymentRate: true,
      inflationRate: true,
      tradeBalance: true,
      lifeExpectancy: true,
      literacyRate: true,
      incomeInequalityGini: true,
      povertyRate: true,
      socialMobilityIndex: true,
      activeAlliances: true,
      activeTreaties: true,
      diplomaticReputation: true,
      publicApproval: true,
      governmentEfficiency: true,
      politicalStability: true,
      infrastructureRating: true,
      budgetDeficitSurplus: true,
    }
  });

  console.log(`Found ${countries.length} countries to process\n`);

  let updated = 0;
  let errors = 0;

  for (const country of countries) {
    try {
      const scores = calculateAllVitalityScores(country);

      await prisma.country.update({
        where: { id: country.id },
        data: {
          economicVitality: scores.economicVitality,
          populationWellbeing: scores.populationWellbeing,
          diplomaticStanding: scores.diplomaticStanding,
          governmentalEfficiency: scores.governmentalEfficiency,
          overallNationalHealth: scores.overallNationalHealth,
        }
      });

      console.log(`✓ ${country.name.padEnd(30)} | Economic: ${scores.economicVitality.toFixed(1)}% | Population: ${scores.populationWellbeing.toFixed(1)}% | Diplomatic: ${scores.diplomaticStanding.toFixed(1)}% | Government: ${scores.governmentalEfficiency.toFixed(1)}% | Overall: ${scores.overallNationalHealth.toFixed(1)}%`);
      updated++;
    } catch (error) {
      console.error(`✗ ${country.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errors++;
    }
  }

  console.log(`\n✅ Successfully updated ${updated} countries`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} countries had errors`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Fatal error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
