#!/usr/bin/env tsx
/**
 * Automated URL Fix Script
 *
 * Automatically fixes hardcoded URLs to use createAbsoluteUrl() and createUrl()
 *
 * Usage:
 *   npx tsx scripts/fix-production-urls.ts
 */

import * as fs from "fs";

interface Fix {
  file: string;
  description: string;
}

const fixes: Fix[] = [];

function addImport(content: string, importName: string): string {
  // Check if already imported
  if (content.includes(`import.*${importName}.*from.*url-utils`)) {
    return content;
  }

  // Check if there's an existing url-utils import
  const urlUtilsImportMatch = content.match(
    /import\s*{([^}]*)}\s*from\s*["']~\/lib\/url-utils["'];?/
  );

  if (urlUtilsImportMatch) {
    // Add to existing import
    const existingImports = urlUtilsImportMatch[1]!.trim();
    const newImports = existingImports ? `${existingImports}, ${importName}` : importName;
    return content.replace(
      /import\s*{[^}]*}\s*from\s*["']~\/lib\/url-utils["'];?/,
      `import { ${newImports} } from "~/lib/url-utils";`
    );
  }

  // Add new import after the last import statement
  const lastImportMatch = content.match(/^import.*from.*;$/gm);
  if (lastImportMatch) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1]!;
    return content.replace(
      lastImport,
      `${lastImport}\nimport { ${importName} } from "~/lib/url-utils";`
    );
  }

  // Add at the beginning if no imports found
  return `import { ${importName} } from "~/lib/url-utils";\n\n${content}`;
}

function fixFile(
  filePath: string,
  pattern: RegExp,
  replacement: string | ((match: string) => string),
  needsImport?: string
): void {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, "utf-8");
  const originalContent = content;

  // Add import if needed
  if (needsImport && !content.includes(needsImport)) {
    content = addImport(content, needsImport);
  }

  // Apply fixes
  if (typeof replacement === "string") {
    content = content.replace(pattern, replacement);
  } else {
    content = content.replace(pattern, replacement);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, "utf-8");
    fixes.push({ file: filePath, description: "Fixed URLs" });
    console.log(`✅ Fixed: ${filePath}`);
  }
}

function main() {
  console.log("🔧 Fixing production URL issues...\n");

  // Fix window.location.href assignments
  console.log("\n📝 Fixing window.location.href assignments...\n");

  const windowLocationFiles = [
    "src/services/GlobalNotificationBridge.ts",
    "src/hooks/useUnifiedNotifications.tsx",
    "src/hooks/useOptimizedIntelligenceData.ts",
    "src/components/UserProfileMenu.tsx",
    "src/components/GlobalStatsIsland.tsx",
    "src/components/DynamicIsland/CompactView.tsx",
    "src/app/test-user-creation/page.tsx",
    "src/app/mycountry/components/MyCountryDataWrapper.tsx",
    "src/app/mycountry/components/ErrorBoundary.tsx",
  ];

  windowLocationFiles.forEach((file) => {
    fixFile(
      file,
      /window\.location\.href\s*=\s*['"](\/.+?)['"]/g,
      (match, path) => `window.location.href = createAbsoluteUrl('${path}')`,
      "createAbsoluteUrl"
    );
  });

  // Fix router.push calls
  console.log("\n📝 Fixing router.push calls...\n");

  const routerPushFiles = [
    "src/components/quickactions/DefenseModal.tsx",
    "src/app/_components/IxStatsSplashPage.tsx",
    "src/app/builder/components/enhanced/AtomicBuilderPageEnhanced.tsx",
  ];

  routerPushFiles.forEach((file) => {
    fixFile(
      file,
      /router\.push\(['"](\/.+?)['"]\)/g,
      (match, path) => `router.push(createUrl('${path}'))`,
      "createUrl"
    );
  });

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`✅ Fixed ${fixes.length} files\n`);

  if (fixes.length > 0) {
    console.log("Files modified:");
    fixes.forEach((fix) => {
      console.log(`  - ${fix.file}`);
    });
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("🔍 Run `npm run audit:urls:prod` to verify all fixes\n");
}

main();
