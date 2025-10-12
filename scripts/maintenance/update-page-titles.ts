#!/usr/bin/env tsx
/**
 * Update page titles across the application with proper Next.js metadata
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TITLE_MAPPINGS: Record<string, string> = {
  '': 'IxStats - Global Economic Simulation Platform',
  'dashboard': 'Dashboard - IxStats',
  'dashboard/new': 'New Dashboard - IxStats',
  'mycountry': 'MyCountry - Executive Dashboard',
  'mycountry/editor': 'Country Editor - MyCountry',
  'mycountry/intelligence': 'Intelligence Briefing - MyCountry',
  'mycountry/defense': 'Defense & Security - MyCountry',
  'countries': 'Countries - IxStats',
  'countries/new': 'Create Country - IxStats',
  'countries/[slug]': 'Country Profile - IxStats',
  'countries/[slug]/profile': 'Country Profile - IxStats',
  'countries/[slug]/modeling': 'Economic Modeling - IxStats',
  'builder': 'Country Builder - IxStats',
  'builder/import': 'Import from IxWiki - Country Builder',
  'eci': 'Executive Command Interface - IxStats',
  'eci/focus': 'Focus Areas - ECI',
  'sdi': 'Strategic Defense Interface - IxStats',
  'sdi/intelligence': 'Intelligence - SDI',
  'sdi/economic': 'Economic Intelligence - SDI',
  'sdi/diplomatic': 'Diplomatic Intelligence - SDI',
  'sdi/crisis': 'Crisis Management - SDI',
  'sdi/communications': 'Communications - SDI',
  'thinkpages': 'ThinkPages - Social Platform',
  'thinkpages/feed': 'Feed - ThinkPages',
  'thinkpages/thinkshare': 'ThinkShare - Messaging',
  'thinkpages/thinktanks': 'ThinkTanks - Collaboration',
  'explore': 'Explore - IxStats',
  'profile': 'User Profile - IxStats',
  'achievements': 'Achievements - IxStats',
  'leaderboards': 'Leaderboards - IxStats',
  'admin': 'Admin Dashboard - IxStats',
  'admin/membership': 'Membership Management - Admin',
  'dm-dashboard': 'DM Dashboard - IxStats',
  'setup': 'Setup - IxStats',
  'sign-in/[[...rest]]': 'Sign In - IxStats',
  'sign-up/[[...rest]]': 'Sign Up - IxStats',
  'wiki': 'Wiki Integration - IxStats',
  'help': 'Help Center - IxStats',
  'help/getting-started/welcome': 'Welcome - Help Center',
  'help/getting-started/ixtime': 'IxTime System - Help Center',
  'help/defense/overview': 'Defense Overview - Help Center',
  'help/economy/tiers': 'Economic Tiers - Help Center',
  'hashtags/[tag]': 'Tag - ThinkPages',
  'test-user-creation': 'Test User Creation - Dev',
  'test-favorites': 'Test Favorites - Dev',
};

function addMetadataToFile(filePath: string, title: string): boolean {
  const content = readFileSync(filePath, 'utf-8');

  // Skip if already has metadata
  if (content.includes('export const metadata') || content.includes('export async function generateMetadata')) {
    return false;
  }

  // Find the first import or the component export
  const lines = content.split('\n');
  let insertIndex = 0;

  // Find last import statement
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      insertIndex = i + 1;
    } else if (lines[i].trim().startsWith('export ') || lines[i].trim().startsWith('function ') || lines[i].trim().startsWith('const ')) {
      break;
    }
  }

  // Skip empty lines after imports
  while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
    insertIndex++;
  }

  // Add metadata
  const metadataBlock = `
export const metadata = {
  title: "${title}",
};
`;

  lines.splice(insertIndex, 0, metadataBlock);
  const newContent = lines.join('\n');

  writeFileSync(filePath, newContent, 'utf-8');
  return true;
}

function updateAllPages() {
  const rootDir = join(__dirname, '..', 'src', 'app');
  let updated = 0;
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
          const wasUpdated = addMetadataToFile(fullPath, title);
          if (wasUpdated) {
            console.log(`✅ Updated: ${relativePath || '/'} -> "${title}"`);
            updated++;
          } else {
            console.log(`⏭️  Skipped: ${relativePath || '/'} (already has metadata)`);
            skipped++;
          }
        } else {
          console.log(`⚠️  No mapping: ${relativePath}`);
        }
      }
    }
  }

  scanDirectory(rootDir);

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated} pages`);
  console.log(`Skipped: ${skipped} pages`);
}

// Run update
console.log('=== Updating Page Titles ===\n');
updateAllPages();
