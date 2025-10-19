#!/usr/bin/env tsx
/**
 * Live Data Wiring Verification Script for IxStats v1.0
 * Verifies that all components are connected to live data sources
 *
 * Usage: npx tsx scripts/audit/verify-live-data-wiring.ts
 */

import * as fs from "fs";
import * as path from "path";

type WiringStatus = "LIVE" | "MIXED" | "MOCK" | "PASSIVE";

interface WiringCheck {
  component: string;
  path: string;
  status: WiringStatus;
  details: string[];
  score: number;
}

const results: WiringCheck[] = [];

// Patterns that indicate live data usage
const liveDataPatterns = [
  /api\.(countries|users|diplomatic|thinkpages|intelligence|government|activities)\./,
  /trpc\./,
  /useQuery\(/,
  /useMutation\(/,
  /api\.useContext\(/,
  /prisma\./,
  /db\./,
];

// Patterns that indicate mock data usage
const mockDataPatterns = [
  /\bmock[A-Z_][\w\d_]*/i,
  /\bmockData\b/i,
  /\bdemoData\b/i,
  /\bsampleData\b/i,
  /\bplaceholderData\b/i,
  /\bpreviewMode\b/i,
  /\busePreviewData\b/, 
  /\bPreviewPayload\b/,
];

// Key directories to check
const componentsToCheck = [
  "src/app/mycountry",
  "src/app/countries",
  "src/app/dashboard",
  "src/app/eci",
  "src/app/sdi",
  "src/app/thinkpages",
  "src/components/countries",
  "src/components/diplomatic",
  "src/components/defense",
  "src/components/intelligence",
  "src/components/government",
  "src/components/thinkpages",
  "src/components/eci",
  "src/components/sdi",
  "src/components/tax-system",
  "src/app/mycountry/new",
];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function analyzeFile(filePath: string): WiringCheck {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const content = stripComments(rawContent);
  const relativePath = filePath.replace(process.cwd(), "");

  const details: string[] = [];
  let liveCount = 0;
  let mockCount = 0;

  // Check for live data patterns
  liveDataPatterns.forEach((pattern) => {
    const matches = content.match(new RegExp(pattern, "g"));
    if (matches) {
      liveCount += matches.length;
      details.push(`✅ Found ${matches.length} live data call(s)`);
    }
  });

  // Check for mock data patterns
  mockDataPatterns.forEach((pattern) => {
    const matches = content.match(new RegExp(pattern, "g"));
    if (matches) {
      mockCount += matches.length;
      details.push(`⚠️  Found ${matches.length} mock data indicator(s)`);
    }
  });

  // Check for specific tRPC router usage
  const trpcRouters = [
    "countries",
    "users",
    "diplomatic",
    "thinkpages",
    "intelligence",
    "government",
    "activities",
    "enhancedEconomics",
    "atomicGovernment",
    "quickActions",
  ];

  trpcRouters.forEach((router) => {
    const routerPattern = new RegExp(`api\\.${router}\\.`, "g");
    const matches = content.match(routerPattern);
    if (matches) {
      details.push(`🔌 Uses ${router} router (${matches.length} calls)`);
    }
  });

  // Determine status
  let status: WiringStatus;
  let score = 0;

  if (liveCount > 0 && mockCount === 0) {
    status = "LIVE";
    score = 100;
  } else if (liveCount > 0 && mockCount > 0) {
    status = "MIXED";
    score = Math.round((liveCount / (liveCount + mockCount)) * 100);
  } else if (mockCount > 0) {
    status = "MOCK";
    score = 0;
  } else {
    status = "PASSIVE";
    score = 100; // UI-only components don't block live wiring coverage
  }

  return {
    component: path.basename(filePath),
    path: relativePath,
    status,
    details,
    score,
  };
}

function scanDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    console.log(`⏭️  Skipping ${dirPath} (not found)`);
    return;
  }

  const files = fs.readdirSync(dirPath, { recursive: true }) as string[];

  files
    .filter(
      (file) =>
        (file.endsWith(".tsx") || file.endsWith(".ts")) &&
        !file.includes("node_modules") &&
        !file.endsWith(".d.ts")
    )
    .forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isFile()) {
        const result = analyzeFile(fullPath);
        results.push(result);
      }
    });
}

function generateReport() {
  console.log("\n🔍 IxStats v1.0 - Live Data Wiring Verification\n");
  console.log("=".repeat(80));

  const liveComponents = results.filter((r) => r.status === "LIVE");
  const mockComponents = results.filter((r) => r.status === "MOCK");
  const mixedComponents = results.filter((r) => r.status === "MIXED");
  const passiveComponents = results.filter((r) => r.status === "PASSIVE");

  console.log(`\n✅ LIVE Components: ${liveComponents.length}`);
  liveComponents.slice(0, 10).forEach((c) => {
    console.log(`   ${c.component} (${c.path})`);
    c.details.forEach((d) => console.log(`      ${d}`));
  });
  if (liveComponents.length > 10) {
    console.log(`   ... and ${liveComponents.length - 10} more`);
  }

  console.log(`\n⚠️  MIXED Components: ${mixedComponents.length}`);
  mixedComponents.slice(0, 10).forEach((c) => {
    console.log(`   ${c.component} (${c.score}% live) - ${c.path}`);
    c.details.forEach((d) => console.log(`      ${d}`));
  });
  if (mixedComponents.length > 10) {
    console.log(`   ... and ${mixedComponents.length - 10} more`);
  }

  console.log(`\n❌ MOCK Components: ${mockComponents.length}`);
  mockComponents.forEach((c) => {
    console.log(`   ${c.component} - ${c.path}`);
    c.details.forEach((d) => console.log(`      ${d}`));
  });

  console.log(`\nℹ️  PASSIVE Components (UI-only or data provided via props): ${passiveComponents.length}`);
  if (passiveComponents.length > 0 && passiveComponents.length <= 10) {
    passiveComponents.forEach((c) => {
      console.log(`   ${c.component} - ${c.path}`);
    });
  } else if (passiveComponents.length > 10) {
    console.log(`   Showing first 10 of ${passiveComponents.length}`);
    passiveComponents.slice(0, 10).forEach((c) => {
      console.log(`   ${c.component} - ${c.path}`);
    });
  }

  const totalComponents = results.length;
  const avgScore =
    results.reduce((acc, r) => acc + r.score, 0) / totalComponents;
  const fullyCovered = liveComponents.length + passiveComponents.length;

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 Overall Statistics\n");
  console.log(`Total Components Analyzed: ${totalComponents}`);
  console.log(
    `Live Wiring Coverage: ${avgScore.toFixed(1)}%`
  );
  console.log(
    `Fully Live: ${((liveComponents.length / totalComponents) * 100).toFixed(1)}%`
  );
  console.log(
    `Mixed (Needs Attention): ${((mixedComponents.length / totalComponents) * 100).toFixed(1)}%`
  );
  console.log(
    `Mock Only: ${((mockComponents.length / totalComponents) * 100).toFixed(1)}%`
  );
  console.log(
    `Passive/Prop-Driven: ${((passiveComponents.length / totalComponents) * 100).toFixed(1)}%`
  );

  // Grade the system
  let grade: string;
  if (avgScore >= 95) grade = "A+ (Excellent)";
  else if (avgScore >= 90) grade = "A (Excellent)";
  else if (avgScore >= 85) grade = "B+ (Very Good)";
  else if (avgScore >= 80) grade = "B (Good)";
  else if (avgScore >= 75) grade = "C+ (Acceptable)";
  else if (avgScore >= 70) grade = "C (Needs Improvement)";
  else grade = "D (Significant Issues)";

  console.log(`\n🎯 Overall Grade: ${grade}`);

  console.log("\n" + "=".repeat(80) + "\n");

  // Generate detailed JSON report
  const jsonReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalComponents,
      liveComponents: liveComponents.length,
      mockComponents: mockComponents.length,
      mixedComponents: mixedComponents.length,
      passiveComponents: passiveComponents.length,
      fullyCovered,
      avgScore,
      grade,
    },
    details: results,
  };

  const reportPath = path.join(
    process.cwd(),
    "scripts/audit/reports",
    `live-wiring-report-${Date.now()}.json`
  );

  // Ensure reports directory exists
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);
}

// Run the verification
console.log("Starting live data wiring verification...\n");

componentsToCheck.forEach((dir) => {
  const fullPath = path.join(process.cwd(), dir);
  console.log(`Scanning ${dir}...`);
  scanDirectory(fullPath);
});

generateReport();
