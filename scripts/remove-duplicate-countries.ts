#!/usr/bin/env tsx
/**
 * Remove duplicate countries from production database
 * Keeps the newest entry for each country name
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/prod.db'
    }
  }
});

async function removeDuplicates() {
  console.log('🔍 Scanning for duplicate countries...\n');

  try {
    // Get all countries
    const allCountries = await prisma.country.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
      }
    });

    console.log(`📊 Total countries in database: ${allCountries.length}\n`);

    // Find duplicates
    const countryMap = new Map<string, typeof allCountries>();
    const duplicates: typeof allCountries = [];

    for (const country of allCountries) {
      const key = country.name.toLowerCase();

      if (!countryMap.has(key)) {
        countryMap.set(key, [country]);
      } else {
        const existing = countryMap.get(key)!;
        existing.push(country);
        countryMap.set(key, existing);
      }
    }

    // Identify duplicates (keep newest, remove older)
    for (const [name, countries] of countryMap.entries()) {
      if (countries.length > 1) {
        // Sort by createdAt desc (newest first)
        countries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        console.log(`\n🔄 Found ${countries.length} entries for "${countries[0].name}":`);
        countries.forEach((c, i) => {
          console.log(`   ${i === 0 ? '✓ KEEP' : '✗ DELETE'}: ${c.id.slice(0, 8)}... (${c.createdAt.toISOString()})`);
        });

        // Add all but the first (newest) to duplicates list
        duplicates.push(...countries.slice(1));
      }
    }

    if (duplicates.length === 0) {
      console.log('\n✅ No duplicates found! Database is clean.\n');
      return;
    }

    console.log(`\n\n📋 Summary:`);
    console.log(`   Unique countries: ${countryMap.size}`);
    console.log(`   Duplicate entries to remove: ${duplicates.length}`);
    console.log(`\n⚠️  This will DELETE ${duplicates.length} country records!\n`);

    // Delete duplicates
    const idsToDelete = duplicates.map(c => c.id);

    console.log('🗑️  Deleting duplicate entries...\n');

    const result = await prisma.country.deleteMany({
      where: {
        id: {
          in: idsToDelete
        }
      }
    });

    console.log(`✅ Deleted ${result.count} duplicate countries\n`);

    // Verify
    const finalCount = await prisma.country.count();
    console.log(`📊 Final country count: ${finalCount}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

removeDuplicates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
