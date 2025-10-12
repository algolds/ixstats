#!/usr/bin/env tsx
/**
 * Detailed check for duplicate countries
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/prod.db'
    }
  }
});

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate countries in production database...\n');

  try {
    // Get all countries with full details
    const allCountries = await prisma.country.findMany({
      orderBy: [
        { name: 'asc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        name: true,
        createdAt: true,
      }
    });

    console.log(`📊 Total countries: ${allCountries.length}\n`);

    // Group by name (case-insensitive)
    const grouped = new Map<string, typeof allCountries>();

    for (const country of allCountries) {
      const key = country.name.toLowerCase().trim();
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(country);
    }

    // Find duplicates
    const duplicateGroups = Array.from(grouped.entries())
      .filter(([_, countries]) => countries.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found!\n');
      console.log('Showing first 20 countries:');
      allCountries.slice(0, 20).forEach(c => {
        console.log(`  - ${c.name} (${c.id.slice(0, 8)}...)`);
      });
      return;
    }

    console.log(`⚠️  Found ${duplicateGroups.length} duplicate country names:\n`);

    for (const [name, countries] of duplicateGroups) {
      console.log(`\n📍 "${countries[0].name}" (${countries.length} entries):`);
      countries.forEach((c, i) => {
        console.log(`   ${i + 1}. ID: ${c.id.slice(0, 12)}... | Created: ${c.createdAt.toISOString().split('T')[0]} | Updated: ${c.updatedAt.toISOString().split('T')[0]}`);
      });
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Unique country names: ${grouped.size}`);
    console.log(`   Total entries: ${allCountries.length}`);
    console.log(`   Duplicate groups: ${duplicateGroups.length}`);
    console.log(`   Total duplicates to remove: ${allCountries.length - grouped.size}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
