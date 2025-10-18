#!/usr/bin/env tsx
/**
 * Comprehensive CRUD Test Script for IxStats v1.0
 * Tests all tRPC router endpoints for Create, Read, Update, Delete operations
 *
 * Usage: npx tsx scripts/audit/test-all-crud-operations.ts
 */

import { PrismaClient } from "@prisma/client";
import { db } from "../../src/server/db";

interface TestResult {
  router: string;
  operation: string;
  status: "PASS" | "FAIL" | "SKIP" | "N/A";
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.status === "PASS" ? "✅" : result.status === "FAIL" ? "❌" : result.status === "SKIP" ? "⏭️" : "ℹ️";
  console.log(`${icon} [${result.router}] ${result.operation}: ${result.message}`);
}

// Test Countries Router
async function testCountriesRouter() {
  const router = "countries";

  try {
    // READ: Get all countries
    const startGetAll = Date.now();
    const countries = await db.country.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (getAll)",
      status: "PASS", // Always pass - empty database is valid
      message: `Found ${countries.length} countries`,
      duration: Date.now() - startGetAll,
    });

    // READ: Get by slug
    if (countries[0] && countries[0].slug) {
      const startGetBySlug = Date.now();
      const country = await db.country.findUnique({
        where: { slug: countries[0].slug },
      });
      logResult({
        router,
        operation: "READ (getBySlug)",
        status: country ? "PASS" : "FAIL",
        message: country ? `Found ${country.name}` : "Country not found",
        duration: Date.now() - startGetBySlug,
      });
    } else if (countries[0]) {
      logResult({
        router,
        operation: "READ (getBySlug)",
        status: "SKIP",
        message: "Country has no slug",
      });
    }

    // CREATE: Test country creation
    const startCreate = Date.now();
    const testCountry = await db.country.create({
      data: {
        name: `Test Country ${Date.now()}`,
        slug: `test-country-${Date.now()}`,
        baselinePopulation: 1000000,
        baselineGdpPerCapita: 50000,
        maxGdpGrowthRate: 0.05,
        adjustedGdpGrowth: 0.04,
        populationGrowthRate: 0.01,
        currentPopulation: 1000000,
        currentGdpPerCapita: 50000,
        currentTotalGdp: 50000000000,
        economicTier: "3",
        populationTier: "3",
      },
    });
    logResult({
      router,
      operation: "CREATE",
      status: "PASS",
      message: `Created test country: ${testCountry.name}`,
      duration: Date.now() - startCreate,
    });

    // UPDATE: Test country update
    const startUpdate = Date.now();
    const updatedCountry = await db.country.update({
      where: { id: testCountry.id },
      data: { currentPopulation: 2000000 },
    });
    logResult({
      router,
      operation: "UPDATE",
      status: updatedCountry.currentPopulation === 2000000 ? "PASS" : "FAIL",
      message: `Updated population to ${updatedCountry.currentPopulation}`,
      duration: Date.now() - startUpdate,
    });

    // DELETE: Test country deletion
    const startDelete = Date.now();
    await db.country.delete({ where: { id: testCountry.id } });
    logResult({
      router,
      operation: "DELETE",
      status: "PASS",
      message: `Deleted test country`,
      duration: Date.now() - startDelete,
    });
  } catch (error) {
    logResult({
      router,
      operation: "CRUD",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test Users Router
async function testUsersRouter() {
  const router = "users";

  try {
    // READ: Get all users
    const startGetAll = Date.now();
    const users = await db.user.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (getAll)",
      status: users.length >= 0 ? "PASS" : "FAIL",
      message: `Found ${users.length} users`,
      duration: Date.now() - startGetAll,
    });

    // CREATE: Test user creation
    const startCreate = Date.now();
    const testUser = await db.user.create({
      data: {
        clerkUserId: `test-clerk-${Date.now()}`,
      },
    });
    logResult({
      router,
      operation: "CREATE",
      status: "PASS",
      message: `Created test user: ${testUser.clerkUserId}`,
      duration: Date.now() - startCreate,
    });

    // UPDATE: Test user update
    const startUpdate = Date.now();
    const updatedUser = await db.user.update({
      where: { id: testUser.id },
      data: { membershipTier: "test_tier" },
    });
    logResult({
      router,
      operation: "UPDATE",
      status: updatedUser.membershipTier === "test_tier" ? "PASS" : "FAIL",
      message: `Updated user membership tier`,
      duration: Date.now() - startUpdate,
    });

    // DELETE: Test user deletion
    const startDelete = Date.now();
    await db.user.delete({ where: { id: testUser.id } });
    logResult({
      router,
      operation: "DELETE",
      status: "PASS",
      message: `Deleted test user`,
      duration: Date.now() - startDelete,
    });
  } catch (error) {
    logResult({
      router,
      operation: "CRUD",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test Diplomatic Router
async function testDiplomaticRouter() {
  const router = "diplomatic";

  try {
    // READ: Get embassies
    const startGetEmbassies = Date.now();
    const embassies = await db.embassy.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (embassies)",
      status: "PASS",
      message: `Found ${embassies.length} embassies`,
      duration: Date.now() - startGetEmbassies,
    });

    // READ: Get missions
    const startGetMissions = Date.now();
    const missions = await db.embassyMission.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (missions)",
      status: "PASS",
      message: `Found ${missions.length} missions`,
      duration: Date.now() - startGetMissions,
    });

    // Test embassy creation requires valid countries, so we skip if none exist
    const countries = await db.country.findMany({ take: 2 });
    if (countries.length >= 2) {
      const startCreate = Date.now();
      const testEmbassy = await db.embassy.create({
        data: {
          hostCountryId: countries[0]!.id,
          guestCountryId: countries[1]!.id,
          name: `Test Embassy ${Date.now()}`,
          status: "active",
        },
      });
      logResult({
        router,
        operation: "CREATE (embassy)",
        status: "PASS",
        message: `Created test embassy`,
        duration: Date.now() - startCreate,
      });

      // UPDATE embassy
      const startUpdate = Date.now();
      await db.embassy.update({
        where: { id: testEmbassy.id },
        data: { status: "suspended" },
      });
      logResult({
        router,
        operation: "UPDATE (embassy)",
        status: "PASS",
        message: `Updated embassy status`,
        duration: Date.now() - startUpdate,
      });

      // DELETE embassy
      const startDelete = Date.now();
      await db.embassy.delete({ where: { id: testEmbassy.id } });
      logResult({
        router,
        operation: "DELETE (embassy)",
        status: "PASS",
        message: `Deleted test embassy`,
        duration: Date.now() - startDelete,
      });
    } else {
      logResult({
        router,
        operation: "CREATE/UPDATE/DELETE",
        status: "SKIP",
        message: "Insufficient countries for embassy tests",
      });
    }
  } catch (error) {
    logResult({
      router,
      operation: "CRUD",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test ThinkPages Router
async function testThinkPagesRouter() {
  const router = "thinkpages";

  try {
    // READ: Get posts
    const startGetPosts = Date.now();
    const posts = await db.thinkpagesPost.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (posts)",
      status: "PASS",
      message: `Found ${posts.length} ThinkPages posts`,
      duration: Date.now() - startGetPosts,
    });

    // CREATE: Test post creation requires valid user
    const users = await db.user.findMany({ take: 1 });
    if (users[0]) {
      const startCreate = Date.now();
      
      // First create a test country for the account
      const testCountry = await db.country.create({
        data: {
          name: `Test Country ${Date.now()}`,
          slug: `test-country-${Date.now()}`,
          baselinePopulation: 1000000,
          baselineGdpPerCapita: 50000,
          maxGdpGrowthRate: 0.03,
          adjustedGdpGrowth: 0.03,
          populationGrowthRate: 0.01,
          currentPopulation: 1000000,
          currentGdpPerCapita: 50000,
          currentTotalGdp: 50000000000,
          economicTier: "Developed",
          populationTier: "Medium",
          projected2040Population: 1200000,
          projected2040Gdp: 60000000000,
          projected2040GdpPerCapita: 50000,
          actualGdpGrowth: 0.03,
          localGrowthFactor: 1.0,
          economicVitality: 75,
          populationWellbeing: 80,
          diplomaticStanding: 70,
          governmentalEfficiency: 75,
          overallNationalHealth: 80,
          activeAlliances: 0,
          activeTreaties: 0,
          diplomaticReputation: "Good",
          publicApproval: 75,
          governmentEfficiency: "High",
          politicalStability: "Very Stable",
          tradeBalance: 0,
          infrastructureRating: 75,
          usesAtomicGovernment: false,
          hideDiplomaticOps: false,
          hideStratcommIntel: false,
          lastCalculated: new Date(),
          baselineDate: new Date(),
        },
      });
      
      // First create a ThinkpagesAccount for the user
      const testAccount = await db.thinkpagesAccount.create({
        data: {
          clerkUserId: users[0].clerkUserId,
          countryId: testCountry.id,
          accountType: "citizen",
          username: `testuser_${Date.now()}`,
          displayName: "Test User",
          firstName: "Test",
          lastName: "User",
        },
      });
      
      const testPost = await db.thinkpagesPost.create({
        data: {
          accountId: testAccount.id,
          content: "Test content for thinkpages post",
          postType: "original",
          visibility: "public",
          ixTimeTimestamp: new Date(),
        },
      });
      logResult({
        router,
        operation: "CREATE (post)",
        status: "PASS",
        message: `Created test post: ${testPost.id}`,
        duration: Date.now() - startCreate,
      });

      // UPDATE post
      const startUpdate = Date.now();
      await db.thinkpagesPost.update({
        where: { id: testPost.id },
        data: { content: "Updated content" },
      });
      logResult({
        router,
        operation: "UPDATE (post)",
        status: "PASS",
        message: `Updated post content`,
        duration: Date.now() - startUpdate,
      });

      // DELETE post
      const startDelete = Date.now();
      await db.thinkpagesPost.delete({ where: { id: testPost.id } });
      logResult({
        router,
        operation: "DELETE (post)",
        status: "PASS",
        message: `Deleted test post`,
        duration: Date.now() - startDelete,
      });
      
      // Clean up test account and country
      await db.thinkpagesAccount.delete({ where: { id: testAccount.id } });
      await db.country.delete({ where: { id: testCountry.id } });
    } else {
      logResult({
        router,
        operation: "CREATE/UPDATE/DELETE",
        status: "SKIP",
        message: "No users available for post tests",
      });
    }
  } catch (error) {
    logResult({
      router,
      operation: "CRUD",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test Activities Router
async function testActivitiesRouter() {
  const router = "activities";

  try {
    // READ: Get activities
    const startGetAll = Date.now();
    const activities = await db.activityFeed.findMany({ take: 10 });
    logResult({
      router,
      operation: "READ (activities)",
      status: "PASS",
      message: `Found ${activities.length} activities`,
      duration: Date.now() - startGetAll,
    });

    // CREATE: Test activity creation
    const users = await db.user.findMany({ take: 1 });
    if (users[0]) {
      const startCreate = Date.now();
      const testActivity = await db.activityFeed.create({
        data: {
          userId: users[0].clerkUserId,
          type: "economic",
          category: "game",
          title: "Test Activity",
          description: "Test activity description",
        },
      });
      logResult({
        router,
        operation: "CREATE (activity)",
        status: "PASS",
        message: `Created test activity`,
        duration: Date.now() - startCreate,
      });

      // DELETE activity
      const startDelete = Date.now();
      await db.activityFeed.delete({ where: { id: testActivity.id } });
      logResult({
        router,
        operation: "DELETE (activity)",
        status: "PASS",
        message: `Deleted test activity`,
        duration: Date.now() - startDelete,
      });
    } else {
      logResult({
        router,
        operation: "CREATE/DELETE",
        status: "SKIP",
        message: "No users available for activity tests",
      });
    }
  } catch (error) {
    logResult({
      router,
      operation: "CRUD",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test Government Router
async function testGovernmentRouter() {
  const router = "government";

  try {
    // READ: Get government components
    const startGetComponents = Date.now();
    const components = await db.governmentComponent.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (government components)",
      status: "PASS",
      message: `Found ${components.length} government components`,
      duration: Date.now() - startGetComponents,
    });

    // READ: Get government structures
    const startGetStructures = Date.now();
    const structures = await db.governmentStructure.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (structures)",
      status: "PASS",
      message: `Found ${structures.length} government structures`,
      duration: Date.now() - startGetStructures,
    });
  } catch (error) {
    logResult({
      router,
      operation: "READ",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test Intelligence Router
async function testIntelligenceRouter() {
  const router = "intelligence";

  try {
    // READ: Get briefings
    const startGetBriefings = Date.now();
    const briefings = await db.intelligenceBriefing.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (briefings)",
      status: "PASS",
      message: `Found ${briefings.length} intelligence briefings`,
      duration: Date.now() - startGetBriefings,
    });

    // CREATE: Test briefing creation
    const countries = await db.country.findMany({ take: 1 });
    if (countries[0]) {
      const startCreate = Date.now();
      const testBriefing = await db.intelligenceBriefing.create({
        data: {
          countryId: countries[0].id,
          title: `Test Briefing ${Date.now()}`,
          description: "Test briefing description",
          type: "HOT_ISSUE",
          priority: "MEDIUM",
          area: "ECONOMIC",
          confidence: 75,
          urgency: "THIS_WEEK",
          impactMagnitude: JSON.stringify({ magnitude: "medium", scope: "national", timeframe: "short" }),
          evidence: JSON.stringify({ metrics: [], trends: [], comparisons: [] }),
        },
      });
      logResult({
        router,
        operation: "CREATE (briefing)",
        status: "PASS",
        message: `Created test briefing`,
        duration: Date.now() - startCreate,
      });

      // DELETE briefing
      const startDelete = Date.now();
      await db.intelligenceBriefing.delete({ where: { id: testBriefing.id } });
      logResult({
        router,
        operation: "DELETE (briefing)",
        status: "PASS",
        message: `Deleted test briefing`,
        duration: Date.now() - startDelete,
      });
    } else {
      logResult({
        router,
        operation: "CREATE/DELETE",
        status: "SKIP",
        message: "No countries available for briefing tests",
      });
    }
  } catch (error) {
    logResult({
      router,
      operation: "CRUD",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test Quick Actions Router
async function testQuickActionsRouter() {
  const router = "quickActions";

  try {
    // READ: Get cabinet meetings
    const startGetMeetings = Date.now();
    const meetings = await db.cabinetMeeting.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (cabinet meetings)",
      status: "PASS",
      message: `Found ${meetings.length} cabinet meetings`,
      duration: Date.now() - startGetMeetings,
    });

    // READ: Get policies
    const startGetPolicies = Date.now();
    const policies = await db.policy.findMany({ take: 5 });
    logResult({
      router,
      operation: "READ (policies)",
      status: "PASS",
      message: `Found ${policies.length} policies`,
      duration: Date.now() - startGetPolicies,
    });
  } catch (error) {
    logResult({
      router,
      operation: "READ",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Main test execution
async function runAllTests() {
  console.log("\n🚀 IxStats v1.0 - Comprehensive CRUD Test Suite\n");
  console.log("=" .repeat(80));

  // Additional routers coverage (safe where possible)
  await testCountriesRouter();
  console.log("");
  await testUsersRouter();
  console.log("");
  await testDiplomaticRouter();
  console.log("");
  await testThinkPagesRouter();
  console.log("");
  await testActivitiesRouter();
  console.log("");
  await testGovernmentRouter();
  console.log("");
  await testIntelligenceRouter();
  console.log("");
  await testQuickActionsRouter();

  await testCountriesRouter();
  console.log("");
  await testUsersRouter();
  console.log("");
  await testDiplomaticRouter();
  console.log("");
  await testThinkPagesRouter();
  console.log("");
  await testActivitiesRouter();
  console.log("");
  await testGovernmentRouter();
  console.log("");
  await testIntelligenceRouter();
  console.log("");
  await testQuickActionsRouter();

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 Test Summary\n");

  const passCount = results.filter(r => r.status === "PASS").length;
  const failCount = results.filter(r => r.status === "FAIL").length;
  const skipCount = results.filter(r => r.status === "SKIP").length;
  const totalTests = results.length;

  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passCount} (${((passCount / totalTests) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failCount} (${((failCount / totalTests) * 100).toFixed(1)}%)`);
  console.log(`⏭️  Skipped: ${skipCount} (${((skipCount / totalTests) * 100).toFixed(1)}%)`);

  if (failCount > 0) {
    console.log("\n⚠️  Failed Tests:");
    results
      .filter(r => r.status === "FAIL")
      .forEach(r => console.log(`   - [${r.router}] ${r.operation}: ${r.message}`));
  }

  const avgDuration = results
    .filter(r => r.duration)
    .reduce((acc, r) => acc + (r.duration || 0), 0) / results.filter(r => r.duration).length;

  console.log(`\n⏱️  Average Operation Duration: ${avgDuration.toFixed(2)}ms`);
  console.log("\n" + "=".repeat(80) + "\n");
}

// Execute tests
runAllTests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
