#!/usr/bin/env tsx
/**
 * Regenerate flag metadata from existing flag files
 * This script scans the public/flags directory and creates metadata.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface LocalFlagMetadata {
  fileName: string;
  originalUrl: string;
  downloadedAt: number;
  fileSize: number;
  source: {
    name: string;
    baseUrl: string;
    priority: number;
  };
}

const flagsDir = path.join(process.cwd(), 'public', 'flags');
const metadataPath = path.join(flagsDir, 'metadata.json');

async function regenerateMetadata() {
  console.log('🔍 Scanning flags directory:', flagsDir);

  // Read all files in flags directory
  const files = fs.readdirSync(flagsDir);

  const flagFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.svg', '.png', '.jpg', '.jpeg', '.gif'].includes(ext) && file !== 'placeholder-flag.svg';
  });

  console.log(`📁 Found ${flagFiles.length} flag files`);

  // Build metadata object
  const metadata: Record<string, LocalFlagMetadata> = {};

  for (const fileName of flagFiles) {
    const filePath = path.join(flagsDir, fileName);
    const stats = fs.statSync(filePath);

    // Extract country name from filename (remove extension and convert underscores to spaces)
    const countryName = path.basename(fileName, path.extname(fileName))
      .replace(/_/g, ' ')
      .toLowerCase();

    metadata[countryName] = {
      fileName: fileName,
      originalUrl: '', // Unknown for existing files
      downloadedAt: stats.mtimeMs,
      fileSize: stats.size,
      source: {
        name: 'Local',
        baseUrl: '',
        priority: 0
      }
    };

    console.log(`  ✓ ${countryName} -> ${fileName} (${(stats.size / 1024).toFixed(2)} KB)`);
  }

  // Write metadata file
  const metadataContent = {
    lastUpdateTime: Date.now(),
    flags: metadata,
    updatedAt: Date.now()
  };

  fs.writeFileSync(metadataPath, JSON.stringify(metadataContent, null, 2));

  console.log(`\n✅ Metadata generated successfully!`);
  console.log(`📝 Written to: ${metadataPath}`);
  console.log(`🎌 Total flags: ${Object.keys(metadata).length}`);
  console.log(`\nSample entries:`);

  // Show first 5 entries as sample
  const entries = Object.entries(metadata).slice(0, 5);
  entries.forEach(([country, meta]) => {
    console.log(`  - ${country}: ${meta.fileName}`);
  });
}

regenerateMetadata().catch(error => {
  console.error('❌ Error regenerating metadata:', error);
  process.exit(1);
});
