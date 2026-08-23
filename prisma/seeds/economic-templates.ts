/**
 * Economic Templates Seed Script
 *
 * Migrates all economic template presets from TypeScript data files to the database.
 * Templates provide pre-configured combinations of economic components for common
 * economic models (e.g., Tech Innovation Hub, Manufacturing Powerhouse, etc.).
 *
 * This script is idempotent - it uses upsert pattern based on the `key` field.
 *
 * Run with: npx tsx prisma/seeds/economic-templates.ts
 */

import { PrismaClient } from "@prisma/client";
import { ECONOMIC_TEMPLATES } from "../../src/lib/economy/atomic-data";

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
  return match ? match[1] : "Briefcase";
}

async function main() {
  console.log("\n📋 Starting Economic Templates seed...\n");

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  console.log(`📊 Found ${ECONOMIC_TEMPLATES.length} templates to process\n`);

  for (const template of ECONOMIC_TEMPLATES) {
    try {
      const iconName = getIconName(template.icon);

      const result = await prisma.economicTemplate.upsert({
        where: { key: template.id },
        update: {
          name: template.name,
          description: template.description,
          components: JSON.stringify(template.components),
          iconName,
          updatedAt: new Date(),
        },
        create: {
          key: template.id,
          name: template.name,
          description: template.description,
          components: JSON.stringify(template.components),
          iconName,
          isActive: true,
          usageCount: 0,
        },
      });

      // Check if it was created or updated
      const wasCreated = result.createdAt.getTime() === result.updatedAt.getTime();

      if (wasCreated) {
        console.log(
          `✅ Created template: ${template.name} (${template.components.length} components)`
        );
        console.log(`   Key: ${template.id}`);
        console.log(`   Icon: ${iconName}`);
        console.log(
          `   Components: ${template.components.slice(0, 3).join(", ")}${template.components.length > 3 ? "..." : ""}\n`
        );
        createdCount++;
      } else {
        console.log(
          `🔄 Updated template: ${template.name} (${template.components.length} components)`
        );
        console.log(`   Key: ${template.id}\n`);
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing template ${template.id}:`, error);
      errorCount++;
    }
  }

  // Print summary
  console.log("=".repeat(60));
  console.log("📊 Economic Templates Seed Summary\n");
  console.log(`✅ Created: ${createdCount}`);
  console.log(`🔄 Updated: ${updatedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📦 Total Processed: ${createdCount + updatedCount}`);
  console.log("=".repeat(60) + "\n");

  // Fetch and display all templates with component counts
  console.log("📋 All Economic Templates:\n");
  const allTemplates = await prisma.economicTemplate.findMany({
    orderBy: { name: "asc" },
  });

  allTemplates.forEach((template, idx) => {
    const components = JSON.parse(template.components);
    console.log(`${idx + 1}. ${template.name}`);
    console.log(`   Key: ${template.key}`);
    console.log(`   Icon: ${template.iconName}`);
    console.log(`   Description: ${template.description}`);
    console.log(`   Components: ${components.length}`);
    console.log(`   ${components.slice(0, 3).join(", ")}${components.length > 3 ? "..." : ""}\n`);
  });
}

main()
  .catch((e) => {
    console.error("❌ Seed script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
