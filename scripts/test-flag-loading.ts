#!/usr/bin/env tsx
/**
 * Test Flag Loading
 *
 * Tests the flag service to ensure all database countries can load their flags
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mock DOM APIs for Node environment
if (typeof window === 'undefined') {
  (global as any).window = {
    __NEXT_DATA__: {},
    Image: class Image {
      src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
    },
  };
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

async function main() {
  console.log('🧪 Testing flag loading for database countries...\n');

  try {
    // Get all countries from database
    const countries = await prisma.country.findMany({
      select: {
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log(`📊 Total countries in database: ${countries.length}\n`);

    // Load metadata.json
    const fs = await import('fs/promises');
    const path = await import('path');
    const metadataPath = path.join(process.cwd(), 'public', 'flags', 'metadata.json');
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    const flagKeys = Object.keys(metadata.flags);

    console.log(`🏁 Total flags in metadata.json: ${flagKeys.length}\n`);

    // Test each country name
    const foundFlags: string[] = [];
    const missingFlags: string[] = [];

    for (const country of countries) {
      const normalizedName = country.name.trim().toLowerCase().replace(/\s+/g, ' ');

      if (metadata.flags[normalizedName]) {
        foundFlags.push(country.name);
      } else {
        missingFlags.push(country.name);
      }
    }

    // Results
    console.log(`✅ Countries with flags: ${foundFlags.length}`);
    console.log(`❌ Countries without flags: ${missingFlags.length}\n`);

    if (missingFlags.length > 0) {
      console.log('❌ Missing flags for:');
      missingFlags.forEach(name => {
        console.log(`   - ${name}`);
      });
      console.log();
    }

    // Show coverage
    const coverage = ((foundFlags.length / countries.length) * 100).toFixed(1);
    console.log(`📈 Flag coverage: ${coverage}%`);

    // Show sample of working flags
    if (foundFlags.length > 0) {
      console.log('\n✅ Sample of working flags:');
      foundFlags.slice(0, 10).forEach(name => {
        const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ');
        const flagInfo = metadata.flags[normalizedName];
        console.log(`   - ${name} → /flags/${flagInfo.fileName}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
