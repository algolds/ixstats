#!/usr/bin/env npx tsx

/**
 * National Identity Data Validation Script
 *
 * This script validates the consistency of national identity data between
 * the Country table and NationalIdentity table.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CountryWithIdentity {
  id: string;
  name: string;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
  nationalIdentity?: {
    countryName?: string | null;
    officialName?: string | null;
    governmentType?: string | null;
    capitalCity?: string | null;
    currency?: string | null;
    officialLanguages?: string | null;
  } | null;
}

interface ValidationResult {
  countryId: string;
  countryName: string;
  issues: string[];
  status: "valid" | "warning" | "error";
}

async function validateNationalIdentity() {
  console.log("🔍 Starting national identity validation...");

  try {
    // Get all countries with their national identity data
    const countries = await prisma.country.findMany({
      select: {
        id: true,
        name: true,
        governmentType: true,
        religion: true,
        leader: true,
        nationalIdentity: {
          select: {
            countryName: true,
            officialName: true,
            governmentType: true,
            capitalCity: true,
            currency: true,
            officialLanguages: true,
            motto: true,
            demonym: true,
            isoCode: true,
            callingCode: true,
            internetTLD: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log(`📊 Found ${countries.length} countries to validate`);

    const results: ValidationResult[] = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (const country of countries) {
      const issues: string[] = [];
      let status: "valid" | "warning" | "error" = "valid";

      // Check if country has national identity record
      if (!country.nationalIdentity) {
        issues.push("Missing NationalIdentity record");
        status = "error";
      } else {
        const ni = country.nationalIdentity;

        // Check for data inconsistencies
        if (
          country.governmentType &&
          ni.governmentType &&
          country.governmentType !== ni.governmentType
        ) {
          issues.push(
            `Government type mismatch: Country="${country.governmentType}" vs NationalIdentity="${ni.governmentType}"`
          );
          status = "warning";
        }

        // Check for missing critical data
        const criticalFields = ["officialName", "capitalCity", "currency"];
        const missingCritical = criticalFields.filter((field) => !ni[field as keyof typeof ni]);
        if (missingCritical.length > 0) {
          issues.push(`Missing critical data: ${missingCritical.join(", ")}`);
          status = status === "error" ? "error" : "warning";
        }

        // Check for data quality issues
        if (ni.officialName && ni.officialName.length < 3) {
          issues.push("Official name too short (less than 3 characters)");
          status = status === "error" ? "error" : "warning";
        }

        if (ni.capitalCity && ni.capitalCity.length < 2) {
          issues.push("Capital city name too short (less than 2 characters)");
          status = status === "error" ? "error" : "warning";
        }

        if (ni.currency && ni.currency.length < 2) {
          issues.push("Currency name too short (less than 2 characters)");
          status = status === "error" ? "error" : "warning";
        }

        // Check for potential duplicates in official names
        const duplicateNames = countries.filter(
          (c) =>
            c.nationalIdentity?.officialName &&
            c.nationalIdentity.officialName === ni.officialName &&
            c.id !== country.id
        );
        if (duplicateNames.length > 0) {
          issues.push(
            `Duplicate official name with: ${duplicateNames.map((c) => c.name).join(", ")}`
          );
          status = "error";
        }
      }

      results.push({
        countryId: country.id,
        countryName: country.name,
        issues,
        status,
      });

      if (status === "valid") validCount++;
      else if (status === "warning") warningCount++;
      else errorCount++;
    }

    // Display results
    console.log("\n📋 Validation Results:");
    console.log(`  ✅ Valid: ${validCount}`);
    console.log(`  ⚠️  Warnings: ${warningCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📊 Total: ${results.length}`);

    // Show detailed results
    if (warningCount > 0 || errorCount > 0) {
      console.log("\n📝 Detailed Issues:");

      const errorResults = results.filter((r) => r.status === "error");
      const warningResults = results.filter((r) => r.status === "warning");

      if (errorResults.length > 0) {
        console.log("\n❌ Errors:");
        errorResults.forEach((result) => {
          console.log(`  ${result.countryName} (${result.countryId}):`);
          result.issues.forEach((issue) => {
            console.log(`    - ${issue}`);
          });
        });
      }

      if (warningResults.length > 0) {
        console.log("\n⚠️  Warnings:");
        warningResults.forEach((result) => {
          console.log(`  ${result.countryName} (${result.countryId}):`);
          result.issues.forEach((issue) => {
            console.log(`    - ${issue}`);
          });
        });
      }
    }

    // Check for orphaned NationalIdentity records
    console.log("\n🔍 Checking for orphaned NationalIdentity records...");
    const allNationalIdentities = await prisma.nationalIdentity.findMany({
      select: {
        id: true,
        countryId: true,
        countryName: true,
      },
    });

    const countryIds = countries.map((c) => c.id);
    const orphanedIdentities = allNationalIdentities.filter(
      (ni) => !countryIds.includes(ni.countryId)
    );

    if (orphanedIdentities.length > 0) {
      console.log(`⚠️  Found ${orphanedIdentities.length} orphaned NationalIdentity records:`);
      orphanedIdentities.forEach((identity) => {
        console.log(`  - ${identity.countryName} (${identity.countryId})`);
      });
    } else {
      console.log("✅ No orphaned NationalIdentity records found");
    }

    // Summary recommendations
    console.log("\n💡 Recommendations:");
    if (errorCount > 0) {
      console.log("  - Fix data inconsistencies between Country and NationalIdentity tables");
      console.log("  - Create missing NationalIdentity records for countries without them");
    }
    if (warningCount > 0) {
      console.log("  - Review and improve data quality for flagged fields");
      console.log("  - Consider standardizing government type values");
    }
    if (orphanedIdentities.length > 0) {
      console.log("  - Clean up orphaned NationalIdentity records");
    }
    if (validCount === results.length) {
      console.log("  - All data looks good! No action needed.");
    }

    // Return exit code based on results
    if (errorCount > 0) {
      console.log("\n❌ Validation failed with errors");
      process.exit(1);
    } else if (warningCount > 0) {
      console.log("\n⚠️  Validation completed with warnings");
      process.exit(0);
    } else {
      console.log("\n✅ All validations passed");
      process.exit(0);
    }
  } catch (error) {
    console.error("💥 Validation failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Additional function to check for countries without NationalIdentity records
async function checkMissingNationalIdentities() {
  console.log("\n🔍 Checking for countries without NationalIdentity records...");

  try {
    const countriesWithoutIdentity = await prisma.country.findMany({
      where: {
        nationalIdentity: null,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    if (countriesWithoutIdentity.length === 0) {
      console.log("✅ All countries have NationalIdentity records");
    } else {
      console.log(
        `⚠️  Found ${countriesWithoutIdentity.length} countries without NationalIdentity records:`
      );
      countriesWithoutIdentity.forEach((country) => {
        console.log(
          `  - ${country.name} (${country.id}) - Created: ${country.createdAt.toISOString()}`
        );
      });
    }

    return countriesWithoutIdentity;
  } catch (error) {
    console.error("💥 Failed to check missing NationalIdentity records:", error);
    return [];
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--check-missing")) {
    await checkMissingNationalIdentities();
  } else {
    await validateNationalIdentity();
  }
}

// Run the script
main().catch((error) => {
  console.error("💥 Script failed:", error);
  process.exit(1);
});
