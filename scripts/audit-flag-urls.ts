#!/usr/bin/env tsx
/**
 * Flag URL Production Audit Script
 *
 * Validates that flag URLs work correctly in production with BASE_PATH
 * Tests flag service URLs, metadata loading, and path resolution
 *
 * Usage:
 *   npx tsx scripts/audit-flag-urls.ts
 *   BASE_PATH=/projects/ixstats npx tsx scripts/audit-flag-urls.ts
 */

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";
const PUBLIC_DIR = path.join(process.cwd(), "public");
const FLAGS_DIR = path.join(PUBLIC_DIR, "flags");

interface FlagAuditIssue {
  type: "error" | "warning" | "info";
  category: string;
  message: string;
  details?: string;
}

const issues: FlagAuditIssue[] = [];

// Expected production URLs
const EXPECTED_FLAG_PATHS = {
  metadata: `${BASE_PATH}/flags/metadata.json`,
  apiDownload: `${BASE_PATH}/api/flags/download`,
  apiSave: `${BASE_PATH}/api/flags/save-metadata`,
  publicFlags: `${BASE_PATH}/flags/`,
  placeholder: `${BASE_PATH}/placeholder-flag.svg`,
};

async function checkFlagDirectory(): Promise<void> {
  console.log("\n🔍 Checking flag directory structure...\n");

  // Check if flags directory exists
  if (!fs.existsSync(FLAGS_DIR)) {
    issues.push({
      type: "error",
      category: "directory",
      message: "Flags directory does not exist",
      details: `Expected: ${FLAGS_DIR}`,
    });
    return;
  }

  console.log(`✅ Flags directory exists: ${FLAGS_DIR}`);

  // Check metadata.json
  const metadataPath = path.join(FLAGS_DIR, "metadata.json");
  if (!fs.existsSync(metadataPath)) {
    issues.push({
      type: "warning",
      category: "metadata",
      message: "metadata.json not found",
      details: "Flag metadata file is missing - flags will be fetched on-demand",
    });
  } else {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
      const flagCount = Object.keys(metadata.flags || {}).length;
      console.log(`✅ metadata.json loaded: ${flagCount} flags cached`);

      if (flagCount === 0) {
        issues.push({
          type: "warning",
          category: "metadata",
          message: "metadata.json is empty",
          details: "No flags are cached locally",
        });
      }

      // Validate metadata structure
      if (!metadata.flags || typeof metadata.flags !== "object") {
        issues.push({
          type: "error",
          category: "metadata",
          message: "Invalid metadata.json structure",
          details: 'Missing or invalid "flags" object',
        });
      }
    } catch (error) {
      issues.push({
        type: "error",
        category: "metadata",
        message: "Failed to parse metadata.json",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Check for flag files
  const flagFiles = fs
    .readdirSync(FLAGS_DIR)
    .filter(
      (f) => f.endsWith(".svg") || f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".webp")
    );

  console.log(`✅ Found ${flagFiles.length} flag files in directory`);

  if (flagFiles.length === 0) {
    issues.push({
      type: "info",
      category: "files",
      message: "No local flag files found",
      details: "Flags will be fetched from external sources on-demand",
    });
  }

  // Check placeholder flag
  const placeholderPath = path.join(PUBLIC_DIR, "placeholder-flag.svg");
  if (!fs.existsSync(placeholderPath)) {
    issues.push({
      type: "warning",
      category: "placeholder",
      message: "Placeholder flag not found",
      details: `Expected: ${placeholderPath}`,
    });
  } else {
    console.log(`✅ Placeholder flag exists`);
  }
}

async function checkFlagServiceCode(): Promise<void> {
  console.log("\n🔍 Checking flag service code...\n");

  const servicePath = path.join(process.cwd(), "src/lib/unified-flag-service.ts");

  if (!fs.existsSync(servicePath)) {
    issues.push({
      type: "error",
      category: "service",
      message: "unified-flag-service.ts not found",
    });
    return;
  }

  const serviceContent = fs.readFileSync(servicePath, "utf-8");

  // Check for getBasePath usage
  if (!serviceContent.includes("getBasePath")) {
    issues.push({
      type: "error",
      category: "service",
      message: "Flag service does not use getBasePath()",
      details: "BASE_PATH may not be applied to flag URLs",
    });
  } else {
    console.log(`✅ Flag service uses getBasePath()`);
  }

  // Check for proper BASE_PATH initialization
  const basePathPatterns = [
    /this\.PLACEHOLDER_FLAG\s*=\s*`\${basePath}\/placeholder-flag\.svg`/,
    /this\.FLAGS_BASE_URL\s*=\s*`\${basePath}\/flags`/,
  ];

  let basePathInitialized = false;
  basePathPatterns.forEach((pattern) => {
    if (pattern.test(serviceContent)) {
      basePathInitialized = true;
    }
  });

  if (!basePathInitialized) {
    issues.push({
      type: "error",
      category: "service",
      message: "Flag service URLs may not include BASE_PATH",
      details: "Check PLACEHOLDER_FLAG and FLAGS_BASE_URL initialization",
    });
  } else {
    console.log(`✅ Flag service URLs initialized with basePath`);
  }

  // Check for API endpoint paths with basePath
  const apiEndpointPatterns = [
    /`\${basePath}\/api\/flags\/save-metadata`/,
    /`\${basePath}\/api\/flags\/download`/,
  ];

  apiEndpointPatterns.forEach((pattern, idx) => {
    if (!pattern.test(serviceContent)) {
      const endpoint = idx === 0 ? "save-metadata" : "download";
      issues.push({
        type: "warning",
        category: "service",
        message: `API endpoint /${endpoint} may not include basePath`,
        details: "Verify fetch calls use basePath prefix",
      });
    }
  });

  // Check for proper metadata loading
  if (!serviceContent.includes("loadLocalMetadata")) {
    issues.push({
      type: "error",
      category: "service",
      message: "Flag service missing loadLocalMetadata method",
    });
  } else {
    console.log(`✅ Flag service has metadata loading`);
  }

  // Check for metadata path with basePath
  if (
    !serviceContent.includes("${basePath}/flags/metadata.json") &&
    !serviceContent.includes("`${basePath}/flags/metadata.json`")
  ) {
    issues.push({
      type: "warning",
      category: "service",
      message: "Metadata path may not include basePath",
      details: "Client-side metadata loading may fail in production",
    });
  } else {
    console.log(`✅ Metadata path uses basePath`);
  }
}

async function checkFlagAPIRoutes(): Promise<void> {
  console.log("\n🔍 Checking flag API routes...\n");

  const apiRoutesPath = path.join(process.cwd(), "src/app/api/flags");

  if (!fs.existsSync(apiRoutesPath)) {
    issues.push({
      type: "error",
      category: "api",
      message: "Flag API routes directory not found",
      details: `Expected: ${apiRoutesPath}`,
    });
    return;
  }

  // Check for required API endpoints
  const requiredEndpoints = ["save-metadata/route.ts", "download/route.ts"];

  requiredEndpoints.forEach((endpoint) => {
    const endpointPath = path.join(apiRoutesPath, endpoint);
    if (!fs.existsSync(endpointPath)) {
      issues.push({
        type: "warning",
        category: "api",
        message: `API endpoint missing: ${endpoint}`,
        details: "Flag caching may not work properly",
      });
    } else {
      console.log(`✅ API endpoint exists: ${endpoint}`);
    }
  });

  // Check [countryName]/route.ts for dynamic flag fetching
  const dynamicRoutePath = path.join(apiRoutesPath, "[countryName]/route.ts");
  if (fs.existsSync(dynamicRoutePath)) {
    console.log(`✅ Dynamic flag route exists`);
  } else {
    issues.push({
      type: "info",
      category: "api",
      message: "Dynamic flag route not found",
      details: "[countryName]/route.ts - optional for direct flag access",
    });
  }
}

async function checkFlagUsageInComponents(): Promise<void> {
  console.log("\n🔍 Checking flag usage in components...\n");

  const files = await glob("src/**/*.{ts,tsx}", { cwd: process.cwd() });

  let componentsUsingFlags = 0;
  let hardcodedFlagPaths = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");

    // Check for flag service usage
    if (
      content.includes("unifiedFlagService") ||
      content.includes("useFlag") ||
      content.includes("UnifiedCountryFlag")
    ) {
      componentsUsingFlags++;
    }

    // Check for hardcoded /flags/ paths
    if (content.match(/['"]\/flags\/[^'"]+['"]/) && !content.includes("withBasePath")) {
      // Ignore if using basePath or getBasePath
      if (
        !content.includes("basePath") &&
        !content.includes("getBasePath") &&
        !content.includes("FLAGS_BASE_URL")
      ) {
        hardcodedFlagPaths++;
        issues.push({
          type: "warning",
          category: "usage",
          message: `Hardcoded /flags/ path in ${file}`,
          details: "May not work in production with BASE_PATH",
        });
      }
    }
  }

  console.log(`✅ Found ${componentsUsingFlags} components using flag service`);

  if (hardcodedFlagPaths > 0) {
    issues.push({
      type: "warning",
      category: "usage",
      message: `Found ${hardcodedFlagPaths} hardcoded flag paths`,
      details: "These may break in production",
    });
  }
}

async function checkProductionURLs(): Promise<void> {
  console.log("\n🔍 Validating production URL patterns...\n");

  if (!BASE_PATH) {
    console.log("ℹ️  BASE_PATH not set (development mode)");
    console.log("   Production URLs:");
  } else {
    console.log(`✅ BASE_PATH configured: "${BASE_PATH}"`);
    console.log("\n   Expected production URLs:");
  }

  Object.entries(EXPECTED_FLAG_PATHS).forEach(([name, url]) => {
    console.log(`   - ${name}: ${url || "/" + name}`);
  });
}

async function generateReport(): Promise<void> {
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║          FLAG URL PRODUCTION AUDIT REPORT                    ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  // Count by severity
  const errors = issues.filter((i) => i.type === "error").length;
  const warnings = issues.filter((i) => i.type === "warning").length;
  const info = issues.filter((i) => i.type === "info").length;

  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Total Issues: ${issues.length}`);
  console.log(`  Errors:   ${errors} ❌`);
  console.log(`  Warnings: ${warnings} ⚠️`);
  console.log(`  Info:     ${info} ℹ️`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (issues.length === 0) {
    console.log("✅ No flag URL issues found! Flag service is production-ready.\n");
    return;
  }

  // Group by category
  const byCategory: Record<string, FlagAuditIssue[]> = {};
  issues.forEach((issue) => {
    if (!byCategory[issue.category]) {
      byCategory[issue.category] = [];
    }
    byCategory[issue.category]!.push(issue);
  });

  // Print issues by category
  Object.entries(byCategory).forEach(([category, categoryIssues]) => {
    console.log(`\n📁 ${category.toUpperCase()} (${categoryIssues.length} issues)`);
    console.log("─".repeat(65));

    categoryIssues.forEach((issue, idx) => {
      const icon = issue.type === "error" ? "❌" : issue.type === "warning" ? "⚠️" : "ℹ️";
      console.log(`\n${icon} ${idx + 1}. ${issue.message}`);
      if (issue.details) {
        console.log(`   Details: ${issue.details}`);
      }
    });

    console.log("");
  });

  // Production readiness checklist
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("FLAG SERVICE PRODUCTION READINESS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const checks = [
    {
      name: "Flags directory exists",
      status: fs.existsSync(FLAGS_DIR),
    },
    {
      name: "Placeholder flag exists",
      status: fs.existsSync(path.join(PUBLIC_DIR, "placeholder-flag.svg")),
    },
    {
      name: "unified-flag-service.ts uses getBasePath()",
      status:
        fs.existsSync("src/lib/unified-flag-service.ts") &&
        fs.readFileSync("src/lib/unified-flag-service.ts", "utf-8").includes("getBasePath"),
    },
    {
      name: "Flag API routes exist",
      status: fs.existsSync("src/app/api/flags"),
    },
    {
      name: "No hardcoded /flags/ paths",
      status: issues.filter((i) => i.category === "usage").length === 0,
    },
    {
      name: "BASE_PATH configured for production",
      status: !!BASE_PATH,
    },
  ];

  checks.forEach((check) => {
    const icon = check.status ? "✅" : "❌";
    console.log(`${icon} ${check.name}`);
  });

  const allPassed = checks.every((c) => c.status);

  console.log("\n═══════════════════════════════════════════════════════════════");
  if (allPassed && errors === 0) {
    console.log("✅ FLAG SERVICE PRODUCTION READY");
  } else if (errors === 0) {
    console.log("⚠️  FLAG SERVICE NEEDS ATTENTION - Review warnings");
  } else {
    console.log("❌ FLAG SERVICE NOT PRODUCTION READY - Fix errors");
  }
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Exit code based on errors
  if (errors > 0) {
    process.exit(1);
  }
}

async function main() {
  console.log("🏴 Starting Flag URL Production Audit...\n");
  console.log(`Working Directory: ${process.cwd()}`);
  console.log(`BASE_PATH: ${BASE_PATH || "(not set - development mode)"}\n`);

  await checkFlagDirectory();
  await checkFlagServiceCode();
  await checkFlagAPIRoutes();
  await checkFlagUsageInComponents();
  await checkProductionURLs();
  await generateReport();
}

main().catch((error) => {
  console.error("Audit failed:", error);
  process.exit(1);
});
