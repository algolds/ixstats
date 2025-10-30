/**
 * Economic Synergies Seed Script
 *
 * Extracts synergies and conflicts from all economic components and creates
 * bi-directional synergy records in the database. Avoids duplicates by ensuring
 * A↔B is treated the same as B↔A.
 *
 * Run with: npx tsx prisma/seeds/economic-synergies.ts
 */

import { PrismaClient, EconomicComponentType } from '@prisma/client';
import { ATOMIC_ECONOMIC_COMPONENTS } from '../../src/lib/atomic-economic-data';

const prisma = new PrismaClient();

interface SynergyRecord {
  component1: EconomicComponentType;
  component2: EconomicComponentType;
  synergyType: 'strong' | 'moderate' | 'weak' | 'conflict';
  bonusPercent: number;
  description: string;
}

/**
 * Calculate bonus percentage based on synergy type
 */
function calculateBonus(synergyType: 'strong' | 'moderate' | 'weak' | 'conflict'): number {
  switch (synergyType) {
    case 'strong':
      return 15;
    case 'moderate':
      return 10;
    case 'weak':
      return 5;
    case 'conflict':
      return -10;
  }
}

/**
 * Create a unique key for synergy pair to avoid duplicates
 * Always put the lexicographically smaller component first
 */
function createSynergyKey(comp1: EconomicComponentType, comp2: EconomicComponentType): string {
  return [comp1, comp2].sort().join('|||');
}

async function main() {
  console.log('\n🔗 Starting Economic Synergies seed...\n');

  const synergyMap = new Map<string, SynergyRecord>();
  let totalSynergies = 0;
  let totalConflicts = 0;

  const components = Object.values(ATOMIC_ECONOMIC_COMPONENTS).filter(c => c !== undefined);
  console.log(`📊 Processing synergies from ${components.length} components\n`);

  // Extract all synergies and conflicts
  for (const component of components) {
    if (!component) continue;

    // Process synergies (assume moderate by default, strong if explicitly defined)
    if (component.synergies && component.synergies.length > 0) {
      for (const synergyTarget of component.synergies) {
        const key = createSynergyKey(component.type, synergyTarget);

        if (!synergyMap.has(key)) {
          // Determine synergy strength based on effectiveness and component type
          const synergyType = component.effectiveness >= 85 ? 'strong' : 'moderate';

          synergyMap.set(key, {
            component1: component.type,
            component2: synergyTarget,
            synergyType,
            bonusPercent: calculateBonus(synergyType),
            description: `${component.name} works well with ${synergyTarget.toLowerCase().replace(/_/g, ' ')}`,
          });
          totalSynergies++;
        }
      }
    }

    // Process conflicts
    if (component.conflicts && component.conflicts.length > 0) {
      for (const conflictTarget of component.conflicts) {
        const key = createSynergyKey(component.type, conflictTarget);

        if (!synergyMap.has(key)) {
          synergyMap.set(key, {
            component1: component.type,
            component2: conflictTarget,
            synergyType: 'conflict',
            bonusPercent: calculateBonus('conflict'),
            description: `${component.name} conflicts with ${conflictTarget.toLowerCase().replace(/_/g, ' ')}`,
          });
          totalConflicts++;
        }
      }
    }
  }

  console.log(`Found ${totalSynergies} synergies and ${totalConflicts} conflicts\n`);

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  // Insert all synergies into database
  for (const [, synergy] of synergyMap) {
    try {
      // Ensure alphabetical order for uniqueness constraint
      const [comp1, comp2] = [synergy.component1, synergy.component2].sort();

      const result = await prisma.economicSynergy.upsert({
        where: {
          component1_component2: {
            component1: comp1,
            component2: comp2,
          },
        },
        update: {
          synergyType: synergy.synergyType,
          bonusPercent: synergy.bonusPercent,
          description: synergy.description,
          isActive: true,
        },
        create: {
          component1: comp1,
          component2: comp2,
          synergyType: synergy.synergyType,
          bonusPercent: synergy.bonusPercent,
          description: synergy.description,
          isActive: true,
        },
      });

      // Check if it was created or updated
      const wasCreated = !result.id.startsWith('existing_');

      if (wasCreated) {
        console.log(`✅ Created ${synergy.synergyType}: ${comp1} ↔ ${comp2} (${synergy.bonusPercent > 0 ? '+' : ''}${synergy.bonusPercent}%)`);
        createdCount++;
      } else {
        console.log(`🔄 Updated ${synergy.synergyType}: ${comp1} ↔ ${comp2} (${synergy.bonusPercent > 0 ? '+' : ''}${synergy.bonusPercent}%)`);
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing synergy ${synergy.component1} ↔ ${synergy.component2}:`, error);
      errorCount++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Economic Synergies Seed Summary\n');
  console.log(`✅ Created: ${createdCount}`);
  console.log(`🔄 Updated: ${updatedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📦 Total Processed: ${createdCount + updatedCount}`);
  console.log(`🔗 Synergies: ${totalSynergies}`);
  console.log(`⚡ Conflicts: ${totalConflicts}`);
  console.log('='.repeat(60) + '\n');

  // Fetch and display sample synergies
  console.log('📋 Sample Economic Synergies:\n');

  const strongSynergies = await prisma.economicSynergy.findMany({
    where: { synergyType: 'strong' },
    take: 3,
    orderBy: { bonusPercent: 'desc' },
  });

  console.log('💪 Strong Synergies:');
  strongSynergies.forEach((syn, idx) => {
    console.log(`${idx + 1}. ${syn.component1} ↔ ${syn.component2} (+${syn.bonusPercent}%)`);
    console.log(`   ${syn.description}\n`);
  });

  const conflicts = await prisma.economicSynergy.findMany({
    where: { synergyType: 'conflict' },
    take: 3,
    orderBy: { bonusPercent: 'asc' },
  });

  console.log('⚡ Conflicts:');
  conflicts.forEach((syn, idx) => {
    console.log(`${idx + 1}. ${syn.component1} ↔ ${syn.component2} (${syn.bonusPercent}%)`);
    console.log(`   ${syn.description}\n`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
