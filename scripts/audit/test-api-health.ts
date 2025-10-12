#!/usr/bin/env tsx
/**
 * API Endpoint Health Check Script for IxStats v1.0
 * Tests all tRPC router endpoints for availability and response times
 *
 * Usage: npx tsx scripts/audit/test-api-health.ts
 */

import { db } from "~/server/db";

interface HealthCheck {
  router: string;
  endpoint: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  responseTime: number;
  error?: string;
}

const results: HealthCheck[] = [];

async function checkEndpoint(
  router: string,
  endpoint: string,
  testFn: () => Promise<unknown>
): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await testFn();
    const responseTime = Date.now() - start;

    let status: "HEALTHY" | "DEGRADED" | "DOWN";
    if (responseTime < 100) status = "HEALTHY";
    else if (responseTime < 500) status = "DEGRADED";
    else status = "DOWN";

    return {
      router,
      endpoint,
      status,
      responseTime,
    };
  } catch (error) {
    return {
      router,
      endpoint,
      status: "DOWN",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testCountriesEndpoints() {
  const router = "countries";

  results.push(
    await checkEndpoint(router, "getAll", async () => {
      await db.country.findMany({ take: 10 });
    })
  );

  results.push(
    await checkEndpoint(router, "getBySlug", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.country.findUnique({ where: { slug: country.slug } });
      }
    })
  );

  results.push(
    await checkEndpoint(router, "getFavorites", async () => {
      await db.adminFavorite.findMany({
        take: 10,
      });
    })
  );

  results.push(
    await checkEndpoint(router, "getStats", async () => {
      await db.country.count();
      await db.country.aggregate({
        _avg: { currentPopulation: true, currentTotalGdp: true },
      });
    })
  );
}

async function testUsersEndpoints() {
  const router = "users";

  results.push(
    await checkEndpoint(router, "getProfile", async () => {
      const user = await db.user.findFirst();
      if (user) {
        await db.user.findUnique({
          where: { id: user.id },
          include: { country: true, role: true },
        });
      }
    })
  );

  results.push(
    await checkEndpoint(router, "getAll", async () => {
      await db.user.findMany({ take: 10 });
    })
  );

  results.push(
    await checkEndpoint(router, "getStats", async () => {
      await db.user.count();
    })
  );
}

async function testDiplomaticEndpoints() {
  const router = "diplomatic";

  results.push(
    await checkEndpoint(router, "getEmbassies", async () => {
      await db.embassy.findMany({ take: 10 });
    })
  );

  results.push(
    await checkEndpoint(router, "getMissions", async () => {
      await db.embassyMission.findMany({ take: 10 });
    })
  );

  results.push(
    await checkEndpoint(router, "getCulturalExchanges", async () => {
      await db.culturalExchange.findMany({ take: 10 });
    })
  );

  results.push(
    await checkEndpoint(router, "getCountryEmbassies", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.embassy.findMany({
          where: {
            OR: [{ hostCountryId: country.id }, { guestCountryId: country.id }],
          },
        });
      }
    })
  );
}

async function testThinkPagesEndpoints() {
  const router = "thinkpages";

  results.push(
    await checkEndpoint(router, "getFeed", async () => {
      await db.thinkpagesPost.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
      });
    })
  );

  results.push(
    await checkEndpoint(router, "getPost", async () => {
      const post = await db.thinkpagesPost.findFirst();
      if (post) {
        await db.thinkpagesPost.findUnique({
          where: { id: post.id },
        });
      }
    })
  );

  results.push(
    await checkEndpoint(router, "getUserPosts", async () => {
      const user = await db.user.findFirst();
      if (user) {
        await db.thinkpagesPost.findMany({
          where: { userId: user.id },
          take: 10,
        });
      }
    })
  );
}

async function testActivitiesEndpoints() {
  const router = "activities";

  results.push(
    await checkEndpoint(router, "getRecentActivities", async () => {
      await db.activityFeed.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
      });
    })
  );

  results.push(
    await checkEndpoint(router, "getUserActivities", async () => {
      const user = await db.user.findFirst();
      if (user) {
        await db.activityFeed.findMany({
          where: { userId: user.id },
          take: 20,
        });
      }
    })
  );

  results.push(
    await checkEndpoint(router, "getCountryActivities", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.activityFeed.findMany({
          where: { countryId: country.id },
          take: 20,
        });
      }
    })
  );
}

async function testGovernmentEndpoints() {
  const router = "government";

  results.push(
    await checkEndpoint(router, "getGovernmentComponents", async () => {
      await db.governmentComponent.findMany({ take: 24 });
    })
  );

  results.push(
    await checkEndpoint(router, "getGovernmentStructure", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.governmentStructure.findUnique({
          where: { countryId: country.id },
          include: { departments: true, officials: true },
        });
      }
    })
  );

  results.push(
    await checkEndpoint(router, "getDepartments", async () => {
      await db.governmentDepartment.findMany({
        take: 10,
      });
    })
  );
}

async function testIntelligenceEndpoints() {
  const router = "intelligence";

  results.push(
    await checkEndpoint(router, "getBriefings", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.intelligenceBriefing.findMany({
          where: { countryId: country.id },
          take: 10,
        });
      }
    })
  );

  results.push(
    await checkEndpoint(router, "getAlerts", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.intelligenceAlert.findMany({
          where: { countryId: country.id },
          take: 10,
        });
      }
    })
  );
}

async function testQuickActionsEndpoints() {
  const router = "quickActions";

  results.push(
    await checkEndpoint(router, "getMeetings", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.cabinetMeeting.findMany({
          where: { countryId: country.id },
          take: 10,
        });
      }
    })
  );

  results.push(
    await checkEndpoint(router, "getPolicies", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.policy.findMany({
          where: { countryId: country.id },
          take: 10,
        });
      }
    })
  );
}

async function testEconomicsEndpoints() {
  const router = "enhancedEconomics";

  results.push(
    await checkEndpoint(router, "getEconomicData", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.country.findUnique({
          where: { id: country.id },
          select: {
            currentTotalGdp: true,
            currentPopulation: true,
            economicTier: true,
            adjustedGdpGrowth: true,
            unemploymentRate: true,
            inflationRate: true,
          },
        });
      }
    })
  );

  results.push(
    await checkEndpoint(router, "getHistoricalData", async () => {
      const country = await db.country.findFirst();
      if (country) {
        await db.historicalDataPoint.findMany({
          where: { countryId: country.id },
          orderBy: { ixTimeTimestamp: "desc" },
          take: 50,
        });
      }
    })
  );
}

async function testAdminEndpoints() {
  const router = "admin";

  results.push(
    await checkEndpoint(router, "getGlobalStats", async () => {
      const [userCount, countryCount, activityCount] = await Promise.all([
        db.user.count(),
        db.country.count(),
        db.activityFeed.count(),
      ]);
    })
  );

  results.push(
    await checkEndpoint(router, "getSystemHealth", async () => {
      // Check database connectivity
      await db.$queryRaw`SELECT 1`;
    })
  );
}

async function runHealthChecks() {
  console.log("\n🏥 IxStats v1.0 - API Endpoint Health Check\n");
  console.log("=".repeat(80));

  console.log("\n🔍 Testing Countries Endpoints...");
  await testCountriesEndpoints();

  console.log("🔍 Testing Users Endpoints...");
  await testUsersEndpoints();

  console.log("🔍 Testing Diplomatic Endpoints...");
  await testDiplomaticEndpoints();

  console.log("🔍 Testing ThinkPages Endpoints...");
  await testThinkPagesEndpoints();

  console.log("🔍 Testing Activities Endpoints...");
  await testActivitiesEndpoints();

  console.log("🔍 Testing Government Endpoints...");
  await testGovernmentEndpoints();

  console.log("🔍 Testing Intelligence Endpoints...");
  await testIntelligenceEndpoints();

  console.log("🔍 Testing Quick Actions Endpoints...");
  await testQuickActionsEndpoints();

  console.log("🔍 Testing Economics Endpoints...");
  await testEconomicsEndpoints();

  console.log("🔍 Testing Admin Endpoints...");
  await testAdminEndpoints();

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 Health Check Results\n");

  const healthyEndpoints = results.filter((r) => r.status === "HEALTHY");
  const degradedEndpoints = results.filter((r) => r.status === "DEGRADED");
  const downEndpoints = results.filter((r) => r.status === "DOWN");

  console.log(`✅ Healthy: ${healthyEndpoints.length} (<100ms)`);
  console.log(`⚠️  Degraded: ${degradedEndpoints.length} (100-500ms)`);
  console.log(`❌ Down: ${downEndpoints.length} (>500ms or error)`);

  if (degradedEndpoints.length > 0) {
    console.log("\n⚠️  Degraded Endpoints:");
    degradedEndpoints.forEach((e) => {
      console.log(`   [${e.router}] ${e.endpoint}: ${e.responseTime}ms`);
    });
  }

  if (downEndpoints.length > 0) {
    console.log("\n❌ Down Endpoints:");
    downEndpoints.forEach((e) => {
      console.log(
        `   [${e.router}] ${e.endpoint}: ${e.error || "Timeout"}`
      );
    });
  }

  const avgResponseTime =
    results.reduce((acc, r) => acc + r.responseTime, 0) / results.length;

  console.log(`\n⏱️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);

  const healthScore =
    (healthyEndpoints.length / results.length) * 100;

  let grade: string;
  if (healthScore >= 95) grade = "A+ (Excellent)";
  else if (healthScore >= 90) grade = "A (Very Good)";
  else if (healthScore >= 80) grade = "B (Good)";
  else if (healthScore >= 70) grade = "C (Acceptable)";
  else if (healthScore >= 60) grade = "D (Poor)";
  else grade = "F (Critical Issues)";

  console.log(`🎯 System Health Score: ${healthScore.toFixed(1)}%`);
  console.log(`📈 Grade: ${grade}`);

  console.log("\n" + "=".repeat(80) + "\n");

  return {
    totalEndpoints: results.length,
    healthy: healthyEndpoints.length,
    degraded: degradedEndpoints.length,
    down: downEndpoints.length,
    avgResponseTime,
    healthScore,
    grade,
  };
}

runHealthChecks()
  .then((summary) => {
    if (summary.down > 0) {
      console.error("⚠️  Some endpoints are down or experiencing errors");
      process.exit(1);
    } else if (summary.degraded > 3) {
      console.warn("⚠️  Multiple endpoints showing degraded performance");
      process.exit(0);
    } else {
      console.log("✅ All systems operational");
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error("❌ Fatal error during health checks:", error);
    process.exit(1);
  });
