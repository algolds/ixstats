/**
 * Intelligence Template Seed Data
 *
 * Migrated from hardcoded templates in diplomatic.ts (lines 2026-2068)
 *
 * Three report types:
 * - Economic (Level 1+): PUBLIC classification
 * - Political (Level 2+): RESTRICTED classification
 * - Security (Level 3+): RESTRICTED classification
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const intelligenceTemplates = [
  {
    reportType: 'economic',
    classification: 'PUBLIC',
    summaryTemplate: 'Economic outlook and trade opportunities analysis',
    findingsTemplate: JSON.stringify([
      'Growing market demand in technology sector',
      'Favorable investment climate for foreign businesses',
      'Strategic infrastructure development underway'
    ]),
    minimumLevel: 1,
    confidenceBase: 70, // Base confidence, gets +5 per embassy level
    isActive: true
  },
  {
    reportType: 'political',
    classification: 'RESTRICTED',
    summaryTemplate: 'Political stability and diplomatic relations assessment',
    findingsTemplate: JSON.stringify([
      'Stable political environment with strong institutions',
      'Active participation in regional cooperation',
      'Commitment to international agreements'
    ]),
    minimumLevel: 2,
    confidenceBase: 75, // Base confidence, gets +4 per embassy level
    isActive: true
  },
  {
    reportType: 'security',
    classification: 'RESTRICTED',
    summaryTemplate: 'Security situation and regional threat assessment',
    findingsTemplate: JSON.stringify([
      'Low regional security risks',
      'Effective counter-terrorism cooperation',
      'Strong border security measures'
    ]),
    minimumLevel: 3,
    confidenceBase: 80, // Base confidence, gets +3 per embassy level
    isActive: true
  }
];

export async function seedIntelligenceTemplates() {
  console.log('🔒 Seeding intelligence templates...');

  try {
    // Clear existing templates
    await prisma.intelligenceTemplate.deleteMany({});
    console.log('   Cleared existing templates');

    // Insert new templates (one by one for SQLite compatibility)
    let createdCount = 0;
    for (const template of intelligenceTemplates) {
      await prisma.intelligenceTemplate.create({
        data: template
      });
      createdCount++;
    }

    console.log(`   ✓ Created ${createdCount} intelligence templates`);
    console.log('   - Economic (Level 1+, PUBLIC)');
    console.log('   - Political (Level 2+, RESTRICTED)');
    console.log('   - Security (Level 3+, RESTRICTED)');

    return createdCount;
  } catch (error) {
    console.error('   ✗ Error seeding intelligence templates:', error);
    throw error;
  }
}

// Run directly if executed as script (ESM version)
const runSeed = async () => {
  try {
    const count = await seedIntelligenceTemplates();
    console.log(`\n✓ Successfully seeded ${count} intelligence templates`);
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

// Execute if this is the main module
runSeed();
