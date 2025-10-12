#!/usr/bin/env tsx
/**
 * Add document.title updates to client components using useEffect
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TITLE_MAPPINGS: Record<string, string> = {
  'achievements': 'Achievements - IxStats',
  'admin/membership': 'Membership Management - Admin',
  'builder/import': 'Import from IxWiki - Country Builder',
  'countries/[slug]': 'Country Profile - IxStats',
  'countries/new': 'Create Country - IxStats',
  'countries': 'Countries - IxStats',
  'dashboard/new': 'New Dashboard - IxStats',
  'explore': 'Explore - IxStats',
  'hashtags/[tag]': 'Tag - ThinkPages',
  'help/defense/overview': 'Defense Overview - Help Center',
  'help/economy/tiers': 'Economic Tiers - Help Center',
  'help/getting-started/ixtime': 'IxTime System - Help Center',
  'help/getting-started/welcome': 'Welcome - Help Center',
  'help': 'Help Center - IxStats',
  'leaderboards': 'Leaderboards - IxStats',
  'mycountry/defense': 'Defense & Security - MyCountry',
  'mycountry/editor': 'Country Editor - MyCountry',
  'mycountry/intelligence': 'Intelligence Briefing - MyCountry',
  'mycountry': 'MyCountry - Executive Dashboard',
  'profile': 'User Profile - IxStats',
  'sdi': 'Strategic Defense Interface - IxStats',
  'test-favorites': 'Test Favorites - Dev',
  'test-user-creation': 'Test User Creation - Dev',
  'thinkpages/feed': 'Feed - ThinkPages',
  'thinkpages': 'ThinkPages - Social Platform',
  'thinkpages/thinkshare': 'ThinkShare - Messaging',
  'thinkpages/thinktanks': 'ThinkTanks - Collaboration',
};

function isClientComponent(content: string): boolean {
  const firstLine = content.split('\n')[0];
  return firstLine?.trim() === '"use client";' || firstLine?.trim() === "'use client';";
}

function hasDocumentTitleSet(content: string): boolean {
  return content.includes('document.title =');
}

function hasUseEffectImport(content: string): boolean {
  return /from\s+['"]react['"]/.test(content) && content.includes('useEffect');
}

function addUseEffectImport(content: string): string {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('from') && line.includes('react') && !line.includes('useEffect')) {
      // Add useEffect to existing React import
      lines[i] = line.replace(/\{([^}]+)\}/, (match, imports) => {
        const importList = imports.split(',').map((s: string) => s.trim());
        if (!importList.includes('useEffect')) {
          importList.push('useEffect');
        }
        return `{ ${importList.join(', ')} }`;
      });
      return lines.join('\n');
    }
  }

  // If no React import found, add one after 'use client'
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('use client')) {
      lines.splice(i + 1, 0, '', "import { useEffect } from 'react';");
      return lines.join('\n');
    }
  }

  return content;
}

function addDocumentTitle(content: string, title: string): string {
  let updatedContent = content;

  // Add useEffect import if needed
  if (!hasUseEffectImport(content)) {
    updatedContent = addUseEffectImport(updatedContent);
  }

  const lines = updatedContent.split('\n');

  // Find the component function
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export default function ')) {
      // Find the opening brace
      let braceIndex = i;
      while (braceIndex < lines.length && !lines[braceIndex].includes('{')) {
        braceIndex++;
      }

      // Add useEffect after opening brace
      const titleEffect = `  useEffect(() => {\n    document.title = "${title}";\n  }, []);\n`;
      lines.splice(braceIndex + 1, 0, titleEffect);
      return lines.join('\n');
    }
  }

  return updatedContent;
}

function updateClientPages() {
  const rootDir = join(__dirname, '..', 'src', 'app');
  let updatedCount = 0;
  let skipped = 0;

  function scanDirectory(dir: string) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry === 'page.tsx') {
        const relativePath = relative(join(__dirname, '..', 'src', 'app'), dirname(fullPath)).replace(/\\/g, '/');
        const title = TITLE_MAPPINGS[relativePath];

        if (title) {
          const content = readFileSync(fullPath, 'utf-8');

          if (isClientComponent(content)) {
            if (!hasDocumentTitleSet(content)) {
              const updatedContent = addDocumentTitle(content, title);
              writeFileSync(fullPath, updatedContent, 'utf-8');
              console.log(`✅ Added title to: ${relativePath} -> "${title}"`);
              updatedCount++;
            } else {
              console.log(`⏭️  Already has title: ${relativePath}`);
              skipped++;
            }
          }
        }
      }
    }
  }

  scanDirectory(rootDir);

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updatedCount} pages`);
  console.log(`Skipped: ${skipped} pages`);
}

// Run update
console.log('=== Adding Client Component Titles ===\n');
updateClientPages();
