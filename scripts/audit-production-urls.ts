#!/usr/bin/env tsx
/**
 * Production URL Audit Script
 *
 * Validates all URLs and navigation paths work correctly in production with BASE_PATH
 *
 * Usage:
 *   npx tsx scripts/audit-production-urls.ts
 *   BASE_PATH=/projects/ixstats npx tsx scripts/audit-production-urls.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface AuditIssue {
  file: string;
  line: number;
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  code: string;
}

const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '';
const issues: AuditIssue[] = [];

// Patterns to check
const patterns = {
  // BAD: Hardcoded window.location.href without createAbsoluteUrl
  windowLocationHardcoded: /window\.location\.href\s*=\s*[`"']\/(?!http|\/)/g,

  // BAD: Direct /countries/ or /dashboard/ in window.location
  windowLocationCountries: /window\.location\.href\s*=\s*[`"']\/countries\//g,
  windowLocationDashboard: /window\.location\.href\s*=\s*[`"']\/dashboard/g,

  // BAD: router.push with hardcoded paths (should use createUrl)
  routerPushHardcoded: /router\.push\([`"']\/(?!http)/g,

  // BAD: href in Link without createUrl (Next.js Link auto-handles, but check anyway)
  linkHrefPattern: /<Link\s+href=\{?[`"']\/countries\/(?!\$)/g,

  // GOOD: Using createUrl or createAbsoluteUrl
  usingCreateUrl: /createUrl\(/g,
  usingCreateAbsoluteUrl: /createAbsoluteUrl\(/g,

  // Flag service URLs
  flagApiUrl: /\/api\/flags\//g,
  flagPublicUrl: /\/flags\//g,
  publicFlagsPath: /public\/flags\//g,

  // Asset paths
  publicAssetPath: /[`"']\/(?:images|fonts|icons|videos)\//g,

  // API routes
  apiRoutePath: /[`"']\/api\//g,
};

// Files to check
const filesToCheck = [
  'src/**/*.ts',
  'src/**/*.tsx',
  '!src/**/*.test.ts',
  '!src/**/*.test.tsx',
  '!node_modules/**',
];

async function auditFile(filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Check if file imports createUrl or createAbsoluteUrl
  const hasCreateUrl = /import.*createUrl.*from.*url-utils/.test(content);
  const hasCreateAbsoluteUrl = /import.*createAbsoluteUrl.*from.*url-utils/.test(content);

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for window.location.href with hardcoded paths
    if (patterns.windowLocationHardcoded.test(line)) {
      // Check if it's using createAbsoluteUrl
      if (!line.includes('createAbsoluteUrl(') && !line.includes('createUrl(')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'error',
          category: 'hardcoded-window-location',
          message: 'window.location.href with hardcoded path - should use createAbsoluteUrl()',
          code: line.trim(),
        });
      }
    }

    // Check for router.push with hardcoded paths
    if (patterns.routerPushHardcoded.test(line) && !line.includes('createUrl(')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'warning',
        category: 'router-push-hardcoded',
        message: 'router.push with hardcoded path - should use createUrl()',
        code: line.trim(),
      });
    }

    // Check for Link href with hardcoded /countries/ paths
    if (patterns.linkHrefPattern.test(line)) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'info',
        category: 'link-href-hardcoded',
        message: 'Link href with hardcoded path - Next.js auto-handles basePath but verify template literals',
        code: line.trim(),
      });
    }

    // Check flag service usage
    if (line.includes('/api/flags/') && !line.includes('basePath') && !line.includes('BASE_PATH')) {
      if (!line.includes('${basePath}') && !line.includes('getBasePath()')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'warning',
          category: 'flag-api-path',
          message: 'Flag API path may not include BASE_PATH - verify getBasePath() is used',
          code: line.trim(),
        });
      }
    }

    // Check public asset paths
    if (patterns.publicAssetPath.test(line) && !line.includes('createAssetUrl')) {
      if (line.includes('src=') || line.includes('href=')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'warning',
          category: 'asset-path',
          message: 'Public asset path may need createAssetUrl() for production',
          code: line.trim(),
        });
      }
    }
  });
}

async function generateReport(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          PRODUCTION URL AUDIT REPORT                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (BASE_PATH) {
    console.log(`✓ BASE_PATH configured: "${BASE_PATH}"\n`);
  } else {
    console.log(`⚠ BASE_PATH not configured (development mode)\n`);
  }

  // Group issues by category
  const byCategory: Record<string, AuditIssue[]> = {};
  issues.forEach(issue => {
    if (!byCategory[issue.category]) {
      byCategory[issue.category] = [];
    }
    byCategory[issue.category]!.push(issue);
  });

  // Count by severity
  const errors = issues.filter(i => i.type === 'error').length;
  const warnings = issues.filter(i => i.type === 'warning').length;
  const info = issues.filter(i => i.type === 'info').length;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Issues: ${issues.length}`);
  console.log(`  Errors:   ${errors} ❌`);
  console.log(`  Warnings: ${warnings} ⚠️`);
  console.log(`  Info:     ${info} ℹ️`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (issues.length === 0) {
    console.log('✅ No URL issues found! All paths are production-ready.\n');
    return;
  }

  // Print issues by category
  Object.entries(byCategory).forEach(([category, categoryIssues]) => {
    console.log(`\n📁 ${category.toUpperCase().replace(/-/g, ' ')} (${categoryIssues.length} issues)`);
    console.log('─'.repeat(65));

    categoryIssues.forEach((issue, idx) => {
      const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`\n${icon} ${idx + 1}. ${issue.message}`);
      console.log(`   File: ${issue.file}:${issue.line}`);
      console.log(`   Code: ${issue.code}`);
    });

    console.log('');
  });

  // Production readiness summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('PRODUCTION READINESS CHECKLIST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const checks = [
    {
      name: 'next.config.js basePath configured',
      status: fs.existsSync('next.config.js') &&
              fs.readFileSync('next.config.js', 'utf-8').includes('basePath:'),
    },
    {
      name: 'url-utils.ts has createAbsoluteUrl',
      status: fs.existsSync('src/lib/url-utils.ts') &&
              fs.readFileSync('src/lib/url-utils.ts', 'utf-8').includes('createAbsoluteUrl'),
    },
    {
      name: 'No hardcoded window.location.href paths',
      status: errors === 0,
    },
    {
      name: 'Flag service uses getBasePath()',
      status: fs.existsSync('src/lib/unified-flag-service.ts') &&
              fs.readFileSync('src/lib/unified-flag-service.ts', 'utf-8').includes('getBasePath()'),
    },
    {
      name: 'BASE_PATH environment variable set',
      status: !!BASE_PATH,
    },
  ];

  checks.forEach(check => {
    const icon = check.status ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
  });

  const allPassed = checks.every(c => c.status);

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (allPassed && errors === 0) {
    console.log('✅ PRODUCTION READY - All URL checks passed!');
  } else if (errors === 0) {
    console.log('⚠️  NEEDS ATTENTION - Fix warnings before production deployment');
  } else {
    console.log('❌ NOT PRODUCTION READY - Fix errors before deployment');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Exit code based on errors
  if (errors > 0) {
    process.exit(1);
  }
}

async function main() {
  console.log('🔍 Scanning codebase for URL issues...\n');

  const files = await glob(filesToCheck, { cwd: process.cwd() });

  console.log(`📂 Checking ${files.length} files...\n`);

  for (const file of files) {
    await auditFile(file);
  }

  await generateReport();
}

main().catch(error => {
  console.error('Audit failed:', error);
  process.exit(1);
});
