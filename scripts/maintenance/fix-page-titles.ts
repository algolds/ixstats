#!/usr/bin/env tsx
/**
 * Fix page titles - remove metadata from client components
 * Client components cannot export metadata in Next.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function isClientComponent(content: string): boolean {
  const firstLine = content.split('\n')[0];
  return firstLine?.trim() === '"use client";' || firstLine?.trim() === "'use client';";
}

function removeMetadata(content: string): string {
  // Remove metadata export block
  const lines = content.split('\n');
  const result: string[] = [];
  let inMetadataBlock = false;
  let bracketCount = 0;

  for (const line of lines) {
    if (line.includes('export const metadata')) {
      inMetadataBlock = true;
      bracketCount = 0;
      continue;
    }

    if (inMetadataBlock) {
      bracketCount += (line.match(/{/g) || []).length;
      bracketCount -= (line.match(/}/g) || []).length;

      if (bracketCount <= 0 && line.includes('}')) {
        inMetadataBlock = false;
        continue;
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

function fixAllPages() {
  const rootDir = join(__dirname, '..', 'src', 'app');
  let fixed = 0;
  let kept = 0;

  function scanDirectory(dir: string) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry === 'page.tsx') {
        const content = readFileSync(fullPath, 'utf-8');

        if (content.includes('export const metadata')) {
          if (isClientComponent(content)) {
            const fixedContent = removeMetadata(content);
            writeFileSync(fullPath, fixedContent, 'utf-8');
            console.log(`✅ Removed metadata from client component: ${fullPath.replace(rootDir, '')}`);
            fixed++;
          } else {
            console.log(`⏭️  Kept metadata in server component: ${fullPath.replace(rootDir, '')}`);
            kept++;
          }
        }
      }
    }
  }

  scanDirectory(rootDir);

  console.log(`\n=== Summary ===`);
  console.log(`Fixed (removed from client): ${fixed} pages`);
  console.log(`Kept (server components): ${kept} pages`);
}

// Run fix
console.log('=== Fixing Page Titles ===\n');
fixAllPages();
