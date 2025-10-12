#!/usr/bin/env tsx
/**
 * Remove old roster entries (countries without ✔ checkmark)
 * Keeps only the new roster with checkmarks
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/prod.db'
    }
  }
});

async function removeOldRoster() {
  console.log('🔍 Finding old roster entries (without ✔)...\n');

  try {
    // Get all countries
    const allCountries = await prisma.country.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
      }
    });

    console.log(`📊 Total countries: ${allCountries.length}\n`);

    // Separate old (no checkmark) and new (with checkmark)
    const oldCountries = allCountries.filter(c => !c.name.includes('✔'));
    const newCountries = allCountries.filter(c => c.name.includes('✔'));

    console.log(`📋 Roster breakdown:`);
    console.log(`   Old roster (no ✔): ${oldCountries.length}`);
    console.log(`   New roster (with ✔): ${newCountries.length}\n`);

    if (oldCountries.length === 0) {
      console.log('✅ No old roster entries found!\n');
      return;
    }

    console.log('🗑️  Countries to be deleted:');
    oldCountries.slice(0, 10).forEach(c => {
      console.log(`   - ${c.name} (${c.id.slice(0, 8)}...)`);
    });
    if (oldCountries.length > 10) {
      console.log(`   ... and ${oldCountries.length - 10} more\n`);
    } else {
      console.log();
    }

    console.log(`⚠️  This will DELETE ${oldCountries.length} old roster entries!\n`);

    // Delete old roster
    const idsToDelete = oldCountries.map(c => c.id);

    console.log('🗑️  Deleting old roster entries...\n');

    const result = await prisma.country.deleteMany({
      where: {
        id: {
          in: idsToDelete
        }
      }
    });

    console.log(`✅ Deleted ${result.count} old roster entries\n`);

    // Verify final count
    const finalCount = await prisma.country.count();
    console.log(`📊 Final country count: ${finalCount}`);
    console.log(`   (Should be ${newCountries.length} - new roster only)\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

removeOldRoster().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
