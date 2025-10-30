/**
 * Government Synergies Seed Script
 *
 * Generates synergy and conflict relationships between government components.
 * This script parses the synergies and conflicts arrays from each component
 * and creates GovernmentSynergy records in the database.
 *
 * Run with: npx tsx prisma/seeds/government-synergies.ts
 */

import { PrismaClient, ComponentType } from '@prisma/client';
import { ATOMIC_COMPONENTS } from '../../src/lib/atomic-government-data';

const prisma = new PrismaClient();

interface SynergyRelationship {
  component1: ComponentType;
  component2: ComponentType;
  synergyType: 'strong' | 'moderate' | 'weak' | 'conflict';
  bonusPercent: number;
  description: string;
}

/**
 * Determine synergy strength based on effectiveness values
 * Higher effectiveness components create stronger synergies
 */
function determineSynergyStrength(
  comp1Effectiveness: number,
  comp2Effectiveness: number
): 'strong' | 'moderate' | 'weak' {
  const avgEffectiveness = (comp1Effectiveness + comp2Effectiveness) / 2;

  if (avgEffectiveness >= 80) return 'strong';
  if (avgEffectiveness >= 70) return 'moderate';
  return 'weak';
}

/**
 * Calculate bonus percentage based on synergy type
 */
function calculateBonusPercent(synergyType: 'strong' | 'moderate' | 'weak' | 'conflict'): number {
  switch (synergyType) {
    case 'strong': return 15;
    case 'moderate': return 10;
    case 'weak': return 5;
    case 'conflict': return -10;
  }
}

/**
 * Generate a descriptive message for the synergy
 */
function generateDescription(
  comp1Name: string,
  comp2Name: string,
  synergyType: 'strong' | 'moderate' | 'weak' | 'conflict'
): string {
  if (synergyType === 'conflict') {
    return `${comp1Name} conflicts with ${comp2Name}, reducing overall effectiveness`;
  }

  const strengthWord = synergyType === 'strong' ? 'powerful' : synergyType === 'moderate' ? 'beneficial' : 'minor';
  return `${strengthWord.charAt(0).toUpperCase() + strengthWord.slice(1)} synergy between ${comp1Name} and ${comp2Name}`;
}

async function main() {
  console.log('\n🔗 Starting Government Synergies seed...\n');

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const components = Object.values(ATOMIC_COMPONENTS).filter(c => c !== undefined);
  const relationships = new Map<string, SynergyRelationship>();

  console.log(`📊 Processing synergies from ${components.length} components\n`);

  // First pass: collect all unique synergy relationships
  for (const component of components) {
    if (!component) continue;

    const comp1Type = component.type;
    const comp1Name = component.name;
    const comp1Effectiveness = component.effectiveness;

    // Process synergies
    for (const comp2Type of component.synergies) {
      const comp2 = ATOMIC_COMPONENTS[comp2Type];
      if (!comp2) continue;

      // Create a unique key (always use alphabetically sorted order to avoid duplicates)
      const key = [comp1Type, comp2Type].sort().join('|');

      // Skip if we already have this relationship
      if (relationships.has(key)) continue;

      const synergyStrength = determineSynergyStrength(comp1Effectiveness, comp2.effectiveness);
      const bonusPercent = calculateBonusPercent(synergyStrength);
      const description = generateDescription(comp1Name, comp2.name, synergyStrength);

      relationships.set(key, {
        component1: comp1Type,
        component2: comp2Type,
        synergyType: synergyStrength,
        bonusPercent,
        description,
      });
    }

    // Process conflicts
    for (const comp2Type of component.conflicts) {
      const comp2 = ATOMIC_COMPONENTS[comp2Type];
      if (!comp2) continue;

      // Create a unique key (always use alphabetically sorted order to avoid duplicates)
      const key = [comp1Type, comp2Type].sort().join('|');

      // Skip if we already have this relationship
      if (relationships.has(key)) continue;

      const bonusPercent = calculateBonusPercent('conflict');
      const description = generateDescription(comp1Name, comp2.name, 'conflict');

      relationships.set(key, {
        component1: comp1Type,
        component2: comp2Type,
        synergyType: 'conflict',
        bonusPercent,
        description,
      });
    }
  }

  console.log(`🔍 Found ${relationships.size} unique synergy relationships\n`);

  // Second pass: upsert all relationships to database
  for (const [key, relationship] of relationships) {
    try {
      // Ensure component1 is always alphabetically before component2 for consistency
      const [comp1, comp2] = [relationship.component1, relationship.component2].sort();

      // Check if it already exists
      const existing = await prisma.governmentSynergy.findUnique({
        where: {
          component1_component2: {
            component1: comp1,
            component2: comp2,
          },
        },
      });

      await prisma.governmentSynergy.upsert({
        where: {
          component1_component2: {
            component1: comp1,
            component2: comp2,
          },
        },
        update: {
          synergyType: relationship.synergyType,
          bonusPercent: relationship.bonusPercent,
          description: relationship.description,
          isActive: true,
        },
        create: {
          component1: comp1,
          component2: comp2,
          synergyType: relationship.synergyType,
          bonusPercent: relationship.bonusPercent,
          description: relationship.description,
          isActive: true,
        },
      });

      if (existing) {
        console.log(`🔄 Updated ${relationship.synergyType} synergy: ${comp1} ↔ ${comp2}`);
        updatedCount++;
      } else {
        console.log(`✅ Created ${relationship.synergyType} synergy: ${comp1} ↔ ${comp2}`);
        createdCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing synergy ${key}:`, error);
      errorCount++;
    }
  }

  console.log('\n📈 Seed Summary:');
  console.log(`  ✅ Created: ${createdCount}`);
  console.log(`  🔄 Updated: ${updatedCount}`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📊 Total unique relationships: ${relationships.size}`);

  // Verify database count
  const totalCount = await prisma.governmentSynergy.count();
  console.log(`\n🗄️  Total synergies in database: ${totalCount}`);

  // Show synergy type breakdown
  const synergyTypes = await prisma.governmentSynergy.groupBy({
    by: ['synergyType'],
    _count: true,
  });

  console.log('\n📊 Synergies by type:');
  for (const type of synergyTypes) {
    console.log(`  ${type.synergyType}: ${type._count}`);
  }

  console.log('\n✨ Government Synergies seed completed!\n');
}

main()
  .catch((e) => {
    console.error('💥 Fatal error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
