#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const files = [
  join(__dirname, '../src/lib/military-equipment.ts'),
  join(__dirname, '../src/lib/military-equipment-extended.ts'),
];

async function checkUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function validateImages() {
  const invalidUrls = [];

  for (const file of files) {
    console.log(`\nChecking: ${file}`);
    const content = readFileSync(file, 'utf-8');

    // Extract all imageUrl lines
    const imageUrlRegex = /imageUrl:\s*"([^"]+)"/g;
    let match;
    const urls = [];

    while ((match = imageUrlRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }

    console.log(`Found ${urls.length} image URLs`);

    // Check each URL
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      process.stdout.write(`  [${i+1}/${urls.length}] Checking... `);

      const isValid = await checkUrl(url);

      if (isValid) {
        console.log('✓ OK');
      } else {
        console.log(`✗ BROKEN: ${url}`);
        invalidUrls.push({ file, url });
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  if (invalidUrls.length > 0) {
    console.log('\n\n❌ INVALID URLS FOUND:');
    invalidUrls.forEach(({ file, url }) => {
      console.log(`  ${file.split('/').pop()}: ${url}`);
    });
    process.exit(1);
  } else {
    console.log('\n\n✅ All image URLs are valid!');
  }
}

validateImages();
