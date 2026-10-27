/**
 * Government Components Seed Script
 *
 * Migrates all 72 atomic government components from TypeScript data files to the database.
 * This script is idempotent - it uses upsert pattern based on the `componentType` field.
 *
 * Run with: npx tsx prisma/seeds/government-components.ts
 */

import { PrismaClient } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "../../src/lib/government/atomic-data";

const prisma = new PrismaClient();

/**
 * Extract icon name from React component
 * Icons are from iconoir-react, extract the component name
 */
function getIconName(iconComponent: React.ComponentType<{ className?: string }>): string {
  // Try to get the display name or function name
  if ("displayName" in iconComponent && iconComponent.displayName) {
    return iconComponent.displayName as string;
  }
  if ("name" in iconComponent && iconComponent.name) {
    return iconComponent.name as string;
  }
  // Fallback to parsing the function string
  const iconString = iconComponent.toString();
  const match = iconString.match(/function\s+(\w+)/);
  return match ? match[1] : "Settings";
}

async function main() {
  console.log("\n🏛️  Starting Government Components seed...\n");

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  const components = Object.values(ATOMIC_COMPONENTS).filter((c) => c !== undefined);
  console.log(`📊 Found ${components.length} components to process\n`);

  for (const component of components) {
    if (!component) continue;

    try {
      const iconName = getIconName(component.icon);

      const result = await prisma.governmentComponentData.upsert({
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
          prerequisites: JSON.stringify(component.prerequisites),
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
          prerequisites: JSON.stringify(component.prerequisites),
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

  console.log("\n📈 Seed Summary:");
  console.log(`  ✅ Created: ${createdCount}`);
  console.log(`  🔄 Updated: ${updatedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📊 Total processed: ${components.length}`);

  // Verify database count
  const totalCount = await prisma.governmentComponentData.count();
  console.log(`\n🗄️  Total components in database: ${totalCount}`);

  // Show category breakdown
  const categories = await prisma.governmentComponentData.groupBy({
    by: ["category"],
    _count: true,
  });

  console.log("\n📂 Components by category:");
  for (const cat of categories) {
    console.log(`  ${cat.category}: ${cat._count}`);
  }

  console.log("\n✨ Government Components seed completed!\n");
}

main()
  .catch((e) => {
    console.error("💥 Fatal error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
