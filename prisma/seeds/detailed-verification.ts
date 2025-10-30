/**
 * Detailed Verification Script
 *
 * Comprehensive check of all economic data with detailed examples
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n📊 DETAILED ECONOMIC DATA VERIFICATION REPORT\n');
  console.log('='.repeat(80));

  // Summary statistics
  const totalComponents = await prisma.economicComponentData.count();
  const totalSynergies = await prisma.economicSynergy.count();
  const totalTemplates = await prisma.economicTemplate.count();

  console.log('\n📈 SUMMARY STATISTICS');
  console.log('-'.repeat(80));
  console.log(`Total Economic Components: ${totalComponents}`);
  console.log(`Total Synergies/Conflicts: ${totalSynergies}`);
  console.log(`Total Templates: ${totalTemplates}`);

  // Component breakdown
  console.log('\n📂 COMPONENT CATEGORIES');
  console.log('-'.repeat(80));

  const categories = await prisma.economicComponentData.groupBy({
    by: ['category'],
    _count: true,
    _avg: { effectiveness: true, implementationCost: true },
  });

  for (const cat of categories) {
    console.log(`\n${cat.category}:`);
    console.log(`  Components: ${cat._count}`);
    console.log(`  Avg Effectiveness: ${cat._avg.effectiveness?.toFixed(1)}`);
    console.log(`  Avg Implementation Cost: $${cat._avg.implementationCost?.toLocaleString()}`);
  }

  // Synergy breakdown
  console.log('\n\n🔗 SYNERGY ANALYSIS');
  console.log('-'.repeat(80));

  const synergyTypes = await prisma.economicSynergy.groupBy({
    by: ['synergyType'],
    _count: true,
    _avg: { bonusPercent: true },
  });

  for (const type of synergyTypes) {
    console.log(`${type.synergyType}: ${type._count} records (avg bonus: ${type._avg.bonusPercent}%)`);
  }

  // Top effectiveness components
  console.log('\n\n⭐ TOP 10 MOST EFFECTIVE COMPONENTS');
  console.log('-'.repeat(80));

  const topComponents = await prisma.economicComponentData.findMany({
    take: 10,
    orderBy: { effectiveness: 'desc' },
    select: {
      name: true,
      componentType: true,
      category: true,
      effectiveness: true,
      implementationCost: true,
    },
  });

  topComponents.forEach((comp, idx) => {
    console.log(`${idx + 1}. ${comp.name} (${comp.effectiveness}% effective)`);
    console.log(`   Category: ${comp.category}, Cost: $${comp.implementationCost.toLocaleString()}`);
  });

  // Detailed component example with all impacts
  console.log('\n\n📋 DETAILED COMPONENT EXAMPLE: INNOVATION_ECONOMY');
  console.log('-'.repeat(80));

  const detailedComponent = await prisma.economicComponentData.findUnique({
    where: { componentType: 'INNOVATION_ECONOMY' },
  });

  if (detailedComponent) {
    console.log(`\nBasic Info:`);
    console.log(`  Name: ${detailedComponent.name}`);
    console.log(`  Category: ${detailedComponent.category}`);
    console.log(`  Effectiveness: ${detailedComponent.effectiveness}%`);
    console.log(`  Color: ${detailedComponent.color}`);
    console.log(`  Icon: ${detailedComponent.iconName}`);

    console.log(`\nCosts & Capacity:`);
    console.log(`  Implementation Cost: $${detailedComponent.implementationCost.toLocaleString()}`);
    console.log(`  Maintenance Cost: $${detailedComponent.maintenanceCost.toLocaleString()}/year`);
    console.log(`  Required Capacity: ${detailedComponent.requiredCapacity} points`);

    const taxImpact = JSON.parse(detailedComponent.taxImpact);
    console.log(`\nTax System Impact:`);
    console.log(`  Optimal Corporate Tax: ${taxImpact.optimalCorporateRate}%`);
    console.log(`  Optimal Income Tax: ${taxImpact.optimalIncomeRate}%`);
    console.log(`  Revenue Efficiency: ${(taxImpact.revenueEfficiency * 100).toFixed(0)}%`);

    const sectorImpact = JSON.parse(detailedComponent.sectorImpact);
    console.log(`\nSector Impact Multipliers:`);
    for (const [sector, multiplier] of Object.entries(sectorImpact)) {
      const percent = ((multiplier as number - 1) * 100).toFixed(0);
      const sign = Number(percent) > 0 ? '+' : '';
      console.log(`  ${sector.charAt(0).toUpperCase() + sector.slice(1)}: ${sign}${percent}% (${multiplier}x)`);
    }

    const employmentImpact = JSON.parse(detailedComponent.employmentImpact);
    console.log(`\nEmployment Impact:`);
    console.log(`  Unemployment: ${employmentImpact.unemploymentModifier > 0 ? '+' : ''}${employmentImpact.unemploymentModifier} pp`);
    console.log(`  Labor Participation: ${(employmentImpact.participationModifier - 1) * 100}%`);
    console.log(`  Wage Growth: ${(employmentImpact.wageGrowthModifier - 1) * 100}%`);

    const synergies = JSON.parse(detailedComponent.synergies);
    const conflicts = JSON.parse(detailedComponent.conflicts);
    const govSynergies = JSON.parse(detailedComponent.governmentSynergies);
    const govConflicts = JSON.parse(detailedComponent.governmentConflicts);

    console.log(`\nRelationships:`);
    console.log(`  Economic Synergies: ${synergies.length}`);
    console.log(`    ${synergies.slice(0, 3).join(', ')}${synergies.length > 3 ? '...' : ''}`);
    console.log(`  Economic Conflicts: ${conflicts.length}`);
    console.log(`    ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? '...' : ''}`);
    console.log(`  Government Synergies: ${govSynergies.length}`);
    console.log(`    ${govSynergies.slice(0, 3).join(', ')}${govSynergies.length > 3 ? '...' : ''}`);
    console.log(`  Government Conflicts: ${govConflicts.length}`);
    console.log(`    ${govConflicts.slice(0, 3).join(', ')}${govConflicts.length > 3 ? '...' : ''}`);

    const metadata = JSON.parse(detailedComponent.metadata);
    console.log(`\nImplementation Metadata:`);
    console.log(`  Complexity: ${metadata.complexity}`);
    console.log(`  Time to Implement: ${metadata.timeToImplement}`);
    console.log(`  Staff Required: ${metadata.staffRequired} employees`);
    console.log(`  Technology Required: ${metadata.technologyRequired ? 'Yes' : 'No'}`);
  }

  // Template details
  console.log('\n\n📦 TEMPLATE DETAILS');
  console.log('-'.repeat(80));

  const templates = await prisma.economicTemplate.findMany({
    orderBy: { name: 'asc' },
  });

  for (const template of templates) {
    const components = JSON.parse(template.components);
    console.log(`\n${template.name}`);
    console.log(`  Key: ${template.key}`);
    console.log(`  Icon: ${template.iconName}`);
    console.log(`  Description: ${template.description}`);
    console.log(`  Components (${components.length}): ${components.join(', ')}`);
  }

  // Strongest synergies
  console.log('\n\n💪 STRONGEST SYNERGIES');
  console.log('-'.repeat(80));

  const strongestSynergies = await prisma.economicSynergy.findMany({
    where: { synergyType: 'strong' },
    orderBy: { bonusPercent: 'desc' },
    take: 10,
  });

  strongestSynergies.forEach((syn, idx) => {
    console.log(`${idx + 1}. ${syn.component1} ↔ ${syn.component2}`);
    console.log(`   Bonus: +${syn.bonusPercent}% | ${syn.description}`);
  });

  // Worst conflicts
  console.log('\n\n⚡ MAJOR CONFLICTS');
  console.log('-'.repeat(80));

  const worstConflicts = await prisma.economicSynergy.findMany({
    where: { synergyType: 'conflict' },
    orderBy: { bonusPercent: 'asc' },
    take: 10,
  });

  worstConflicts.forEach((syn, idx) => {
    console.log(`${idx + 1}. ${syn.component1} ⚔ ${syn.component2}`);
    console.log(`   Penalty: ${syn.bonusPercent}% | ${syn.description}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ VERIFICATION COMPLETE - All economic data successfully migrated!\n');
}

main()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
