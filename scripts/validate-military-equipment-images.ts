#!/usr/bin/env tsx
/**
 * Military Equipment Image Validation Script
 *
 * Validates image URLs for all military equipment in the catalog.
 * Tests HTTP availability, detects broken links, and identifies missing images.
 *
 * Usage:
 *   npx tsx scripts/validate-military-equipment-images.ts
 *   npx tsx scripts/validate-military-equipment-images.ts --fix
 */

import { PrismaClient } from "@prisma/client";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";

const prisma = new PrismaClient();

interface ValidationIssue {
  type: "error" | "warning" | "info";
  category: string;
  equipment: string;
  equipmentId: string;
  message: string;
  details?: string;
  suggestedFix?: string;
}

interface ValidationStats {
  total: number;
  withImages: number;
  missingImages: number;
  validUrls: number;
  brokenUrls: number;
  untested: number;
}

interface CategoryStats {
  category: string;
  total: number;
  withImages: number;
  missingImages: number;
  brokenUrls: number;
}

const issues: ValidationIssue[] = [];
const stats: ValidationStats = {
  total: 0,
  withImages: 0,
  missingImages: 0,
  validUrls: 0,
  brokenUrls: 0,
  untested: 0,
};

/**
 * Test if an image URL is accessible
 * Uses browser-like User-Agent to avoid 403 errors from Wikimedia
 */
async function testImageUrl(url: string): Promise<{
  success: boolean;
  status?: number;
  contentType?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const lib = urlObj.protocol === "https:" ? https : http;

      const req = lib.request(
        url,
        {
          method: "HEAD",
          timeout: 10000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "image/*",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
          },
        },
        (res) => {
          // Follow redirects (301, 302, 307, 308)
          if (
            res.statusCode &&
            [301, 302, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            // Recursively test the redirect location
            testImageUrl(res.headers.location).then(resolve);
            return;
          }

          resolve({
            success: res.statusCode === 200,
            status: res.statusCode,
            contentType: res.headers["content-type"],
          });
        }
      );

      req.on("error", (error) => {
        resolve({
          success: false,
          error: error.message,
        });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({
          success: false,
          error: "Request timeout (10s)",
        });
      });

      req.end();
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : "Invalid URL",
      });
    }
  });
}

/**
 * Validate Wikimedia Commons URL format
 */
function validateWikimediaUrl(url: string): { valid: boolean; issues: string[] } {
  const urlIssues: string[] = [];

  // Check if it's a Wikimedia URL
  if (!url.includes("wikimedia.org") && !url.includes("wikipedia.org")) {
    urlIssues.push("Not a Wikimedia URL");
  }

  // Check for common issues
  if (url.includes(" ")) {
    urlIssues.push("Contains spaces (should be URL-encoded)");
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    urlIssues.push("Missing protocol (http/https)");
  }

  // Check for proper image file extension
  const validExtensions = [".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif"];
  const hasValidExtension = validExtensions.some((ext) => url.toLowerCase().includes(ext));

  if (!hasValidExtension) {
    urlIssues.push("No valid image extension found");
  }

  return {
    valid: urlIssues.length === 0,
    issues: urlIssues,
  };
}

/**
 * Generate Wikimedia search URL for equipment
 */
function generateWikimediaSearchUrl(equipmentName: string, category: string): string {
  const searchTerm = encodeURIComponent(`${equipmentName} military ${category}`);
  return `https://commons.wikimedia.org/w/index.php?search=${searchTerm}&title=Special:MediaSearch&type=image`;
}

/**
 * Validate all equipment images
 */
async function validateEquipmentImages() {
  console.log("\n🔍 Fetching equipment from database...\n");

  const equipment = await prisma.militaryEquipmentCatalog.findMany({
    orderBy: [{ category: "asc" }, { subcategory: "asc" }, { name: "asc" }],
  });

  stats.total = equipment.length;
  console.log(`✅ Found ${equipment.length} equipment items\n`);

  console.log("🔍 Validating images...\n");

  const categoryStatsMap = new Map<string, CategoryStats>();

  for (const item of equipment) {
    // Initialize category stats
    if (!categoryStatsMap.has(item.category)) {
      categoryStatsMap.set(item.category, {
        category: item.category,
        total: 0,
        withImages: 0,
        missingImages: 0,
        brokenUrls: 0,
      });
    }

    const categoryStats = categoryStatsMap.get(item.category)!;
    categoryStats.total++;

    // Check if image exists
    if (!item.imageUrl || item.imageUrl.trim() === "") {
      stats.missingImages++;
      stats.untested++;
      categoryStats.missingImages++;

      issues.push({
        type: "warning",
        category: "missing_image",
        equipment: item.name,
        equipmentId: item.id,
        message: `No image URL`,
        details: `Category: ${item.category} / ${item.subcategory || "general"}`,
        suggestedFix: generateWikimediaSearchUrl(item.name, item.category),
      });

      process.stdout.write("⚠️ ");
      continue;
    }

    stats.withImages++;
    categoryStats.withImages++;

    // Validate URL format
    const formatValidation = validateWikimediaUrl(item.imageUrl);
    if (!formatValidation.valid) {
      issues.push({
        type: "error",
        category: "invalid_url_format",
        equipment: item.name,
        equipmentId: item.id,
        message: `Invalid URL format`,
        details: formatValidation.issues.join(", "),
      });
      process.stdout.write("❌ ");
      stats.brokenUrls++;
      categoryStats.brokenUrls++;
      continue;
    }

    // Test URL accessibility
    const testResult = await testImageUrl(item.imageUrl);

    if (testResult.success) {
      stats.validUrls++;
      process.stdout.write("✅ ");

      // Check content type
      if (testResult.contentType && !testResult.contentType.startsWith("image/")) {
        issues.push({
          type: "warning",
          category: "invalid_content_type",
          equipment: item.name,
          equipmentId: item.id,
          message: `URL does not return an image`,
          details: `Content-Type: ${testResult.contentType}`,
        });
      }
    } else {
      stats.brokenUrls++;
      categoryStats.brokenUrls++;

      issues.push({
        type: "error",
        category: "broken_url",
        equipment: item.name,
        equipmentId: item.id,
        message: `Image URL not accessible`,
        details: testResult.error || `HTTP ${testResult.status}`,
        suggestedFix: generateWikimediaSearchUrl(item.name, item.category),
      });

      process.stdout.write("❌ ");
    }
  }

  console.log("\n");

  return Array.from(categoryStatsMap.values());
}

/**
 * Generate detailed report
 */
async function generateReport(categoryStats: CategoryStats[]) {
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║     MILITARY EQUIPMENT IMAGE VALIDATION REPORT               ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  // Overall statistics
  console.log("📊 OVERALL STATISTICS");
  console.log("═".repeat(65));
  console.log(`Total Equipment:        ${stats.total}`);
  console.log(`With Images:            ${stats.withImages} (${((stats.withImages / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Images:         ${stats.missingImages} (${((stats.missingImages / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Valid URLs:             ${stats.validUrls} (${stats.withImages > 0 ? ((stats.validUrls / stats.withImages) * 100).toFixed(1) : 0}%)`);
  console.log(`Broken URLs:            ${stats.brokenUrls} (${stats.withImages > 0 ? ((stats.brokenUrls / stats.withImages) * 100).toFixed(1) : 0}%)`);
  console.log(`Untested (no URL):      ${stats.untested}`);

  // Category breakdown
  console.log("\n📂 CATEGORY BREAKDOWN");
  console.log("═".repeat(65));
  console.log(
    `${"Category".padEnd(15)} ${"Total".padEnd(8)} ${"With Img".padEnd(10)} ${"Missing".padEnd(10)} ${"Broken".padEnd(8)}`
  );
  console.log("─".repeat(65));

  categoryStats.forEach((cat) => {
    const coverage = cat.total > 0 ? ((cat.withImages / cat.total) * 100).toFixed(0) : "0";
    console.log(
      `${cat.category.padEnd(15)} ${cat.total.toString().padEnd(8)} ${cat.withImages.toString().padEnd(3)} (${coverage}%)  ${cat.missingImages.toString().padEnd(10)} ${cat.brokenUrls.toString().padEnd(8)}`
    );
  });

  // Issues summary
  const errors = issues.filter((i) => i.type === "error").length;
  const warnings = issues.filter((i) => i.type === "warning").length;
  const info = issues.filter((i) => i.type === "info").length;

  console.log("\n🔍 ISSUES SUMMARY");
  console.log("═".repeat(65));
  console.log(`Total Issues:           ${issues.length}`);
  console.log(`  Errors:               ${errors} ❌`);
  console.log(`  Warnings:             ${warnings} ⚠️`);
  console.log(`  Info:                 ${info} ℹ️`);

  if (issues.length === 0) {
    console.log("\n✅ No image issues found! All equipment images are valid.\n");
    return;
  }

  // Detailed issues
  console.log("\n❌ DETAILED ISSUES");
  console.log("═".repeat(65));

  // Group by category
  const byCategory: Record<string, ValidationIssue[]> = {};
  issues.forEach((issue) => {
    if (!byCategory[issue.category]) {
      byCategory[issue.category] = [];
    }
    byCategory[issue.category]!.push(issue);
  });

  Object.entries(byCategory).forEach(([category, categoryIssues]) => {
    console.log(`\n📁 ${category.toUpperCase().replace(/_/g, " ")} (${categoryIssues.length} issues)`);
    console.log("─".repeat(65));

    categoryIssues.slice(0, 10).forEach((issue, idx) => {
      const icon = issue.type === "error" ? "❌" : issue.type === "warning" ? "⚠️" : "ℹ️";
      console.log(`\n${icon} ${idx + 1}. ${issue.equipment}`);
      console.log(`   Issue: ${issue.message}`);
      if (issue.details) {
        console.log(`   Details: ${issue.details}`);
      }
      if (issue.suggestedFix) {
        console.log(`   🔧 Search: ${issue.suggestedFix}`);
      }
    });

    if (categoryIssues.length > 10) {
      console.log(`\n   ... and ${categoryIssues.length - 10} more issues in this category`);
    }

    console.log("");
  });

  // Production readiness
  console.log("\n═".repeat(65));
  console.log("IMAGE VALIDATION STATUS");
  console.log("═".repeat(65));

  const imageQualityScore = stats.total > 0 ? ((stats.validUrls / stats.total) * 100).toFixed(1) : "0";
  const coverageScore = stats.total > 0 ? ((stats.withImages / stats.total) * 100).toFixed(1) : "0";

  console.log(`Image Coverage:         ${coverageScore}%`);
  console.log(`Image Quality:          ${imageQualityScore}%`);
  console.log(`Broken Images:          ${stats.brokenUrls}`);
  console.log(`Missing Images:         ${stats.missingImages}`);

  console.log("\n" + "═".repeat(65));

  if (errors === 0 && warnings === 0) {
    console.log("✅ VALIDATION PASSED - All images are valid");
  } else if (errors === 0) {
    console.log("⚠️  VALIDATION WARNINGS - Review missing images");
  } else {
    console.log("❌ VALIDATION FAILED - Fix broken URLs");
  }

  console.log("═".repeat(65) + "\n");

  // Recommendations
  if (stats.brokenUrls > 0 || stats.missingImages > 0) {
    console.log("\n💡 RECOMMENDATIONS");
    console.log("═".repeat(65));

    if (stats.brokenUrls > 0) {
      console.log(`\n1. Fix ${stats.brokenUrls} broken image URL(s)`);
      console.log("   - Check the detailed issues above for search links");
      console.log("   - Update imageUrl in database");
    }

    if (stats.missingImages > 0) {
      console.log(`\n2. Add images for ${stats.missingImages} equipment item(s)`);
      console.log("   - Use Wikimedia Commons search links provided above");
      console.log("   - Update via admin panel at /admin/military-equipment");
    }

    console.log("\n3. Run this script regularly to monitor image health");
    console.log("   - Add to CI/CD pipeline");
    console.log("   - Schedule weekly validation");

    console.log("\n═".repeat(65) + "\n");
  }
}

/**
 * Export machine-readable report
 */
async function exportJsonReport(categoryStats: CategoryStats[]) {
  const report = {
    timestamp: new Date().toISOString(),
    stats,
    categoryStats,
    issues: issues.map((issue) => ({
      type: issue.type,
      category: issue.category,
      equipment: issue.equipment,
      equipmentId: issue.equipmentId,
      message: issue.message,
      details: issue.details,
      suggestedFix: issue.suggestedFix,
    })),
    summary: {
      passed: stats.brokenUrls === 0 && stats.missingImages === 0,
      qualityScore: stats.total > 0 ? ((stats.validUrls / stats.total) * 100).toFixed(1) : "0",
      coverageScore: stats.total > 0 ? ((stats.withImages / stats.total) * 100).toFixed(1) : "0",
    },
  };

  try {
    fs.writeFileSync("validation-report.json", JSON.stringify(report, null, 2));
    console.log("\n📄 JSON report exported: validation-report.json\n");
  } catch (error) {
    console.error("Failed to export JSON report:", error);
  }
}

/**
 * Main validation function
 */
async function main() {
  console.log("🖼️  Starting Military Equipment Image Validation...\n");
  console.log(`Working Directory: ${process.cwd()}\n`);

  try {
    const categoryStats = await validateEquipmentImages();
    await generateReport(categoryStats);
    await exportJsonReport(categoryStats);
  } catch (error) {
    console.error("\n❌ Validation failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  // Exit with error code if there are broken URLs
  if (stats.brokenUrls > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
