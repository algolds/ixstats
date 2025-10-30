/**
 * Economic Components Seed Script
 *
 * Migrates all 27 atomic economic components from TypeScript data files to the database.
 * This script is idempotent - it uses upsert pattern based on the `componentType` field.
 *
 * Run with: npx tsx prisma/seeds/economic-components.ts
 */

import { PrismaClient } from '@prisma/client';
import { ATOMIC_ECONOMIC_COMPONENTS } from '../../src/lib/atomic-economic-data';

const prisma = new PrismaClient();

/**
 * Extract icon name from React component
 * Icons are from lucide-react, extract the component name
 */
function getIconName(iconComponent: React.ComponentType<{ className?: string }>): string {
  // Try to get the display name or function name
  if ('displayName' in iconComponent && iconComponent.displayName) {
    return iconComponent.displayName as string;
  }
  if ('name' in iconComponent && iconComponent.name) {
    return iconComponent.name as string;
  }
  // Fallback to parsing the function string
  const iconString = iconComponent.toString();
  const match = iconString.match(/function\s+(\w+)/);
  return match ? match[1] : 'DollarSign';
}

async function main() {
  console.log('\n💰 Starting Economic Components seed...\n');

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  // Track components by category for summary
  const categoryStats: Record<string, number> = {};

  const components = Object.values(ATOMIC_ECONOMIC_COMPONENTS).filter(c => c !== undefined);
  console.log(`📊 Found ${components.length} economic components to process\n`);

  for (const component of components) {
    if (!component) continue;

    try {
      const iconName = getIconName(component.icon);

      // Track category stats
      categoryStats[component.category] = (categoryStats[component.category] || 0) + 1;

      const result = await prisma.economicComponentData.upsert({
        where: { componentType: component.type },
        update: {
          name: component.name,
          description: component.description,
          category: component.category,
          effectiveness: component.effectiveness,
          implementationCost: component.implementationCost,
          maintenanceCost: component.maintenanceCost,
          requiredCapacity: component.requiredCapacity,
          synergies: JSON.stringify(component.synergies),
          conflicts: JSON.stringify(component.conflicts),
          governmentSynergies: JSON.stringify(component.governmentSynergies),
          governmentConflicts: JSON.stringify(component.governmentConflicts),
          taxImpact: JSON.stringify(component.taxImpact),
          sectorImpact: JSON.stringify(component.sectorImpact),
          employmentImpact: JSON.stringify(component.employmentImpact),
          metadata: JSON.stringify(component.metadata),
          color: component.color,
          iconName,
          updatedAt: new Date(),
        },
        create: {
          componentType: component.type,
          name: component.name,
          description: component.description,
          category: component.category,
          effectiveness: component.effectiveness,
          implementationCost: component.implementationCost,
          maintenanceCost: component.maintenanceCost,
          requiredCapacity: component.requiredCapacity,
          synergies: JSON.stringify(component.synergies),
          conflicts: JSON.stringify(component.conflicts),
          governmentSynergies: JSON.stringify(component.governmentSynergies),
          governmentConflicts: JSON.stringify(component.governmentConflicts),
          taxImpact: JSON.stringify(component.taxImpact),
          sectorImpact: JSON.stringify(component.sectorImpact),
          employmentImpact: JSON.stringify(component.employmentImpact),
          metadata: JSON.stringify(component.metadata),
          color: component.color,
          iconName,
          isActive: true,
          usageCount: 0,
        },
      });

      // Check if it was created or updated by checking if createdAt and updatedAt are different
      const wasCreated = result.createdAt.getTime() === result.updatedAt.getTime();

      if (wasCreated) {
        console.log(`✅ Created component: ${component.name} (${component.type})`);
        createdCount++;
      } else {
        console.log(`🔄 Updated component: ${component.name} (${component.type})`);
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing component ${component.type}:`, error);
      errorCount++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Economic Components Seed Summary\n');
  console.log(`✅ Created: ${createdCount}`);
  console.log(`🔄 Updated: ${updatedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📦 Total Processed: ${createdCount + updatedCount}`);

  console.log('\n📂 Components by Category:');
  for (const [category, count] of Object.entries(categoryStats)) {
    console.log(`   ${category}: ${count}`);
  }

  console.log('='.repeat(60) + '\n');

  // Fetch and display sample records
  console.log('📋 Sample Economic Components:\n');
  const sampleComponents = await prisma.economicComponentData.findMany({
    take: 5,
    orderBy: { effectiveness: 'desc' },
    select: {
      componentType: true,
      name: true,
      category: true,
      effectiveness: true,
      implementationCost: true,
    },
  });

  sampleComponents.forEach((comp, idx) => {
    console.log(`${idx + 1}. ${comp.name}`);
    console.log(`   Type: ${comp.componentType}`);
    console.log(`   Category: ${comp.category}`);
    console.log(`   Effectiveness: ${comp.effectiveness}`);
    console.log(`   Cost: $${comp.implementationCost.toLocaleString()}`);
    console.log('');
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
