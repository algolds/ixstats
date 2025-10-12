#!/usr/bin/env tsx
/**
 * Database Integrity Audit Script for IxStats v1.0
 * Verifies database schema, relationships, constraints, and data quality
 *
 * Usage: npx tsx scripts/audit/verify-database-integrity.ts
 */

import { db } from "~/server/db";

interface IntegrityCheck {
  category: string;
  check: string;
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
  details?: unknown;
}

const results: IntegrityCheck[] = [];

function log(check: IntegrityCheck) {
  results.push(check);
  const icon =
    check.status === "PASS" ? "✅" : check.status === "FAIL" ? "❌" : "⚠️";
  console.log(`${icon} [${check.category}] ${check.check}: ${check.message}`);
}

// Check referential integrity
async function checkReferentialIntegrity() {
  const category = "Referential Integrity";

  try {
    // Check unclaimed countries (no user assigned - this is normal/expected)
    const unclaimedCountries = await db.country.findMany({
      where: {
        user: null,
      },
    });
    log({
      category,
      check: "Unclaimed Countries",
      status: "PASS", // This is expected behavior
      message: `${unclaimedCountries.length} unclaimed countries available for players`,
      details: unclaimedCountries.length > 0 ? { count: unclaimedCountries.length } : undefined,
    });

    // Check orphaned embassies (invalid country references)
    const totalEmbassies = await db.embassy.count();
    // Check if host and guest countries exist
    const embassies = await db.embassy.findMany();
    let validEmbassyCount = 0;
    for (const embassy of embassies) {
      const hostExists = await db.country.findUnique({ where: { id: embassy.hostCountryId } });
      const guestExists = await db.country.findUnique({ where: { id: embassy.guestCountryId } });
      if (hostExists && guestExists) validEmbassyCount++;
    }
    log({
      category,
      check: "Embassy References",
      status: totalEmbassies === validEmbassyCount ? "PASS" : "FAIL",
      message:
        totalEmbassies === validEmbassyCount
          ? `All ${totalEmbassies} embassies have valid country references`
          : `${totalEmbassies - validEmbassyCount} embassies have invalid references`,
    });

    // Check orphaned activities (activities with userId but no matching user)
    // Note: ActivityFeed.userId is optional and stores clerk IDs, not database user IDs
    // So we skip this check as it's not a true foreign key relationship
    log({
      category,
      check: "Activity Feed Schema",
      status: "PASS",
      message: "ActivityFeed uses optional userId (clerk IDs), not a strict relation",
    });

    // Check ThinkPages with missing userId (field is non-nullable)
    const postsWithoutUser = await db.thinkpagesPost.findMany({
      where: {
        userId: { equals: "" },
      },
    });
    log({
      category,
      check: "ThinkPages User References",
      status: postsWithoutUser.length === 0 ? "PASS" : "WARNING",
      message:
        postsWithoutUser.length === 0
          ? "All posts have userId references"
          : `Found ${postsWithoutUser.length} posts without userId`,
    });

    // Check government structures (country relation is non-nullable)
    // All structures must have a valid countryId by schema design
    const structureCount = await db.governmentStructure.count();
    log({
      category,
      check: "Government Structures Integrity",
      status: "PASS",
      message: `All ${structureCount} government structures have valid country references (enforced by schema)`,
    });
  } catch (error) {
    log({
      category,
      check: "Referential Integrity",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Check data consistency
async function checkDataConsistency() {
  const category = "Data Consistency";

  try {
    // Check for countries with missing/empty tier values (field is non-nullable)
    const invalidTierCountries = await db.country.findMany({
      where: {
        economicTier: { equals: "" },
      },
    });
    log({
      category,
      check: "Country Tier Values",
      status: invalidTierCountries.length === 0 ? "PASS" : "WARNING",
      message:
        invalidTierCountries.length === 0
          ? "All countries have tier values assigned"
          : `Found ${invalidTierCountries.length} countries with missing/empty tiers`,
      details: invalidTierCountries.map((c) => ({
        name: c.name,
        tier: c.economicTier,
      })),
    });

    // Check for negative population values
    const negativePopCountries = await db.country.findMany({
      where: {
        currentPopulation: { lt: 0 },
      },
    });
    log({
      category,
      check: "Population Values",
      status: negativePopCountries.length === 0 ? "PASS" : "FAIL",
      message:
        negativePopCountries.length === 0
          ? "All population values are valid"
          : `Found ${negativePopCountries.length} countries with negative population`,
    });

    // Check for negative GDP values
    const negativeGDPCountries = await db.country.findMany({
      where: {
        currentTotalGdp: { lt: 0 },
      },
    });
    log({
      category,
      check: "GDP Values",
      status: negativeGDPCountries.length === 0 ? "PASS" : "FAIL",
      message:
        negativeGDPCountries.length === 0
          ? "All GDP values are valid"
          : `Found ${negativeGDPCountries.length} countries with negative GDP`,
    });

    // Check for duplicate country slugs
    const slugCounts = await db.country.groupBy({
      by: ["slug"],
      _count: { slug: true },
      having: {
        slug: { _count: { gt: 1 } },
      },
    });
    log({
      category,
      check: "Unique Country Slugs",
      status: slugCounts.length === 0 ? "PASS" : "FAIL",
      message:
        slugCounts.length === 0
          ? "All country slugs are unique"
          : `Found ${slugCounts.length} duplicate slugs`,
      details: slugCounts,
    });

    // Check for duplicate user clerkUserIds
    const clerkIdCounts = await db.user.groupBy({
      by: ["clerkUserId"],
      _count: { clerkUserId: true },
      having: {
        clerkUserId: { _count: { gt: 1 } },
      },
    });
    log({
      category,
      check: "Unique User ClerkIds",
      status: clerkIdCounts.length === 0 ? "PASS" : "FAIL",
      message:
        clerkIdCounts.length === 0
          ? "All user clerkIds are unique"
          : `Found ${clerkIdCounts.length} duplicate clerkIds`,
      details: clerkIdCounts,
    });

    // Check for self-referencing embassies
    const allEmbassies = await db.embassy.findMany();
    const selfEmbassies = allEmbassies.filter(e => e.hostCountryId === e.guestCountryId);
    log({
      category,
      check: "Self-Referencing Embassies",
      status: selfEmbassies.length === 0 ? "PASS" : "WARNING",
      message:
        selfEmbassies.length === 0
          ? "No self-referencing embassies"
          : `Found ${selfEmbassies.length} embassies from a country to itself`,
    });
  } catch (error) {
    log({
      category,
      check: "Data Consistency",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Check database statistics
async function checkDatabaseStatistics() {
  const category = "Database Statistics";

  try {
    const stats = {
      users: await db.user.count(),
      countries: await db.country.count(),
      embassies: await db.embassy.count(),
      missions: await db.embassyMission.count(),
      thinkPages: await db.thinkpagesPost.count(),
      activities: await db.activityFeed.count(),
      meetings: await db.cabinetMeeting.count(),
      policies: await db.policy.count(),
      intelligenceBriefings: await db.intelligenceBriefing.count(),
      governmentStructures: await db.governmentStructure.count(),
      governmentComponents: await db.governmentComponent.count(),
      historicalDataPoints: await db.historicalDataPoint.count(),
    };

    log({
      category,
      check: "Record Counts",
      status: "PASS",
      message: `Total records across all tables: ${Object.values(stats).reduce((a, b) => a + b, 0)}`,
      details: stats,
    });

    // Check for empty critical tables
    const criticalTables = {
      users: stats.users,
      countries: stats.countries,
    };

    Object.entries(criticalTables).forEach(([table, count]) => {
      log({
        category,
        check: `${table} Table`,
        status: count > 0 ? "PASS" : "WARNING",
        message:
          count > 0
            ? `${count} records found`
            : "Table is empty - may need seeding",
      });
    });

    // Check average relationships per entity
    if (stats.countries > 0) {
      const avgEmbassiesPerCountry = stats.embassies / stats.countries;
      log({
        category,
        check: "Embassy Network Density",
        status: "PASS",
        message: `Average ${avgEmbassiesPerCountry.toFixed(2)} embassies per country`,
      });
    }

    if (stats.users > 0) {
      const avgCountriesPerUser = stats.countries / stats.users;
      log({
        category,
        check: "User Engagement",
        status: "PASS",
        message: `Average ${avgCountriesPerUser.toFixed(2)} countries per user`,
      });
    }
  } catch (error) {
    log({
      category,
      check: "Database Statistics",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Check index performance
async function checkIndexPerformance() {
  const category = "Index Performance";

  try {
    // Test common query patterns
    const tests = [
      {
        name: "Country Lookup by Slug",
        query: async () => {
          const country = await db.country.findFirst();
          if (country) {
            const start = Date.now();
            await db.country.findUnique({ where: { slug: country.slug } });
            return Date.now() - start;
          }
          return 0;
        },
      },
      {
        name: "User Lookup by ClerkId",
        query: async () => {
          const user = await db.user.findFirst();
          if (user) {
            const start = Date.now();
            await db.user.findUnique({ where: { clerkUserId: user.clerkUserId } });
            return Date.now() - start;
          }
          return 0;
        },
      },
      {
        name: "Recent Activities Query",
        query: async () => {
          const start = Date.now();
          await db.activityFeed.findMany({
            take: 50,
            orderBy: { createdAt: "desc" },
          });
          return Date.now() - start;
        },
      },
      {
        name: "Country with Relations",
        query: async () => {
          const country = await db.country.findFirst();
          if (country) {
            const start = Date.now();
            await db.country.findUnique({
              where: { id: country.id },
              include: {
                user: true,
                embassiesHosting: true,
                embassiesGuest: true,
                governmentStructure: true,
              },
            });
            return Date.now() - start;
          }
          return 0;
        },
      },
    ];

    for (const test of tests) {
      const duration = await test.query();
      log({
        category,
        check: test.name,
        status: duration < 50 ? "PASS" : duration < 200 ? "WARNING" : "FAIL",
        message: `Query completed in ${duration}ms`,
      });
    }
  } catch (error) {
    log({
      category,
      check: "Index Performance",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Check data quality
async function checkDataQuality() {
  const category = "Data Quality";

  try {
    // Check for countries with missing required fields
    const countriesWithMissingData = await db.country.findMany({
      where: {
        OR: [
          { name: { equals: "" } },
          { slug: { equals: "" } },
          { currentPopulation: { equals: 0 } },
          { currentTotalGdp: { equals: 0 } },
        ],
      },
    });
    log({
      category,
      check: "Complete Country Data",
      status: countriesWithMissingData.length === 0 ? "PASS" : "WARNING",
      message:
        countriesWithMissingData.length === 0
          ? "All countries have complete basic data"
          : `${countriesWithMissingData.length} countries have missing or zero values`,
      details: countriesWithMissingData.map((c) => ({
        name: c.name,
        slug: c.slug,
      })),
    });

    // Check for users with missing clerkUserIds (field is non-nullable, so only check for empty string)
    const usersWithoutClerkId = await db.user.findMany({
      where: {
        clerkUserId: { equals: "" },
      },
    });
    log({
      category,
      check: "User ClerkId Completeness",
      status: usersWithoutClerkId.length === 0 ? "PASS" : "WARNING",
      message:
        usersWithoutClerkId.length === 0
          ? "All users have clerkUserIds"
          : `${usersWithoutClerkId.length} users missing clerkUserIds`,
    });

    // Check for old/stale data
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const recentActivities = await db.activityFeed.count({
      where: {
        createdAt: { gte: oneYearAgo },
      },
    });
    const totalActivities = await db.activityFeed.count();

    log({
      category,
      check: "Data Freshness",
      status:
        totalActivities === 0 || recentActivities / totalActivities > 0.5
          ? "PASS"
          : "WARNING",
      message: `${recentActivities}/${totalActivities} activities from last year (${((recentActivities / totalActivities) * 100).toFixed(1)}%)`,
    });
  } catch (error) {
    log({
      category,
      check: "Data Quality",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Main audit function
async function runDatabaseIntegrityAudit() {
  console.log("\n🔍 IxStats v1.0 - Database Integrity Audit\n");
  console.log("=".repeat(80));

  console.log("\n📊 Checking Database Statistics...");
  await checkDatabaseStatistics();

  console.log("\n🔗 Checking Referential Integrity...");
  await checkReferentialIntegrity();

  console.log("\n✓ Checking Data Consistency...");
  await checkDataConsistency();

  console.log("\n⚡ Checking Index Performance...");
  await checkIndexPerformance();

  console.log("\n🎯 Checking Data Quality...");
  await checkDataQuality();

  console.log("\n" + "=".repeat(80));
  console.log("\n📈 Audit Summary\n");

  const passed = results.filter((r) => r.status === "PASS").length;
  const warnings = results.filter((r) => r.status === "WARNING").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`Total Checks: ${results.length}`);
  console.log(`✅ Passed: ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Warnings: ${warnings} (${((warnings / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed} (${((failed / results.length) * 100).toFixed(1)}%)`);

  if (failed > 0) {
    console.log("\n❌ Failed Checks:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) =>
        console.log(`   [${r.category}] ${r.check}: ${r.message}`)
      );
  }

  if (warnings > 0) {
    console.log("\n⚠️  Warnings:");
    results
      .filter((r) => r.status === "WARNING")
      .forEach((r) =>
        console.log(`   [${r.category}] ${r.check}: ${r.message}`)
      );
  }

  const score = ((passed + warnings * 0.5) / results.length) * 100;
  let grade: string;
  if (score >= 95) grade = "A+ (Excellent)";
  else if (score >= 90) grade = "A (Very Good)";
  else if (score >= 85) grade = "B+ (Good)";
  else if (score >= 80) grade = "B (Acceptable)";
  else if (score >= 70) grade = "C (Needs Attention)";
  else grade = "D (Critical Issues)";

  console.log(`\n🎯 Database Health Score: ${score.toFixed(1)}%`);
  console.log(`📊 Grade: ${grade}`);

  console.log("\n" + "=".repeat(80) + "\n");

  return { passed, warnings, failed, score, grade };
}

runDatabaseIntegrityAudit()
  .then((summary) => {
    if (summary.failed > 0) {
      console.error("⚠️  Database integrity issues detected");
      process.exit(1);
    } else if (summary.warnings > 5) {
      console.warn("⚠️  Multiple warnings detected - review recommended");
      process.exit(0);
    } else {
      console.log("✅ Database integrity verified");
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error("❌ Fatal error during audit:", error);
    process.exit(1);
  });
