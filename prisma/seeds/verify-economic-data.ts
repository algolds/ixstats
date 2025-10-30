/**
 * Verification Script for Economic Data
 *
 * Queries the database to verify all economic data was seeded correctly
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🔍 Verifying Economic Data Migration...\n");
  console.log("=".repeat(60));

  // Count records in each table
  const componentCount = await prisma.economicComponentData.count();
  const synergyCount = await prisma.economicSynergy.count();
  const templateCount = await prisma.economicTemplate.count();

  console.log("\n📊 Record Counts:");
  console.log(`   EconomicComponentData: ${componentCount} records`);
  console.log(`   EconomicSynergy: ${synergyCount} records`);
  console.log(`   EconomicTemplate: ${templateCount} records`);

  // Get components by category
  console.log("\n📂 Components by Category:");
  const componentsByCategory = await prisma.economicComponentData.groupBy({
    by: ["category"],
    _count: true,
  });

  for (const cat of componentsByCategory) {
    console.log(`   ${cat.category}: ${cat._count} components`);
  }

  // Get synergies by type
  console.log("\n🔗 Synergies by Type:");
  const synergiesByType = await prisma.economicSynergy.groupBy({
    by: ["synergyType"],
    _count: true,
  });

  for (const type of synergiesByType) {
    console.log(`   ${type.synergyType}: ${type._count} records`);
  }

  // Sample component with all data
  console.log("\n📋 Sample Component (FREE_MARKET_SYSTEM):");
  const sampleComponent = await prisma.economicComponentData.findUnique({
    where: { componentType: "FREE_MARKET_SYSTEM" },
  });

  if (sampleComponent) {
    console.log(`   Name: ${sampleComponent.name}`);
    console.log(`   Category: ${sampleComponent.category}`);
    console.log(`   Effectiveness: ${sampleComponent.effectiveness}`);
    console.log(`   Implementation Cost: $${sampleComponent.implementationCost.toLocaleString()}`);
    console.log(`   Maintenance Cost: $${sampleComponent.maintenanceCost.toLocaleString()}`);
    console.log(`   Required Capacity: ${sampleComponent.requiredCapacity}`);

    const taxImpact = JSON.parse(sampleComponent.taxImpact);
    console.log("\n   Tax Impact:");
    console.log(`      Optimal Corporate Rate: ${taxImpact.optimalCorporateRate}%`);
    console.log(`      Optimal Income Rate: ${taxImpact.optimalIncomeRate}%`);
    console.log(`      Revenue Efficiency: ${taxImpact.revenueEfficiency}`);

    const sectorImpact = JSON.parse(sampleComponent.sectorImpact);
    console.log("\n   Sector Impact:");
    for (const [sector, impact] of Object.entries(sectorImpact)) {
      console.log(`      ${sector}: ${impact}x`);
    }

    const employmentImpact = JSON.parse(sampleComponent.employmentImpact);
    console.log("\n   Employment Impact:");
    console.log(`      Unemployment Modifier: ${employmentImpact.unemploymentModifier}`);
    console.log(`      Participation Modifier: ${employmentImpact.participationModifier}`);
    console.log(`      Wage Growth Modifier: ${employmentImpact.wageGrowthModifier}`);

    const synergies = JSON.parse(sampleComponent.synergies);
    const conflicts = JSON.parse(sampleComponent.conflicts);
    console.log(`\n   Synergies: ${synergies.length} components`);
    console.log(`   Conflicts: ${conflicts.length} components`);
  }

  // Sample synergies
  console.log("\n🔗 Sample Strong Synergies:");
  const strongSynergies = await prisma.economicSynergy.findMany({
    where: { synergyType: "strong" },
    take: 5,
  });

  strongSynergies.forEach((syn, idx) => {
    console.log(`   ${idx + 1}. ${syn.component1} ↔ ${syn.component2} (+${syn.bonusPercent}%)`);
  });

  // Sample templates
  console.log("\n📋 Economic Templates:");
  const templates = await prisma.economicTemplate.findMany();

  templates.forEach((template, idx) => {
    const components = JSON.parse(template.components);
    console.log(`   ${idx + 1}. ${template.name}`);
    console.log(`      Key: ${template.key}`);
    console.log(`      Components: ${components.length}`);
    console.log(`      Icon: ${template.iconName}`);
  });

  console.log("\n" + "=".repeat(60));
  console.log("✅ Verification Complete!\n");
}

main()
  .catch((e) => {
    console.error("❌ Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
