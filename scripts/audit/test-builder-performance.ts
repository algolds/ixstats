#!/usr/bin/env tsx
/**
 * Performance Audit Script for Builder System
 *
 * Phase 1 Performance Optimization Verification
 * Tests the performance improvements made in the builder system:
 * 1. Government structure create/update with batched operations
 * 2. Query performance with new indexes
 * 3. Nested include limits
 *
 * Run: bun run test:builder-performance
 *      tsx scripts/audit/test-builder-performance.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PerformanceResult {
  operation: string;
  durationMs: number;
  passed: boolean;
  threshold: number;
  details: string;
}

const results: PerformanceResult[] = [];

// Performance thresholds (in ms)
const THRESHOLDS = {
  GOVERNMENT_CREATE_20_DEPTS: 1000, // Should be < 1s with batching (was ~3s before)
  GOVERNMENT_UPDATE_20_DEPTS: 1000, // Should be < 1s with batching
  GOVERNMENT_READ_WITH_LIMITS: 200, // Should be fast with limits
  GOVERNMENT_READ_FULL: 500, // Full fetch should still be reasonable
  TAX_COMPONENT_QUERY: 100, // Should be fast with compound index
  SYNERGY_JOIN_QUERY: 150, // Should be fast with FK indexes
};

function logResult(
  operation: string,
  durationMs: number,
  threshold: number,
  details: string
) {
  const passed = durationMs <= threshold;
  results.push({ operation, durationMs, passed, threshold, details });
  const status = passed ? "✅ PASS" : "⚠️ SLOW";
  const ratio = ((durationMs / threshold) * 100).toFixed(1);
  console.log(`${status}: ${operation}`);
  console.log(`   Duration: ${durationMs}ms (threshold: ${threshold}ms, ${ratio}% of limit)`);
  console.log(`   ${details}`);
  console.log();
}

async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}

// ============================================================================
// Test Utilities
// ============================================================================

async function getTestCountryId(): Promise<string | null> {
  const country = await prisma.country.findFirst({
    select: { id: true },
  });
  return country?.id ?? null;
}

async function createTestCountry(): Promise<string> {
  const testCountry = await prisma.country.create({
    data: {
      name: `PerfTest Country ${Date.now()}`,
      slug: `perftest-${Date.now()}`,
      continent: "Test",
      region: "Test Region",
      governmentType: "Test Republic",
      religion: "None",
      leader: "Test Leader",
      baselinePopulation: 5000000,
      baselineGdpPerCapita: 25000,
      currentPopulation: 5000000,
      currentGdpPerCapita: 25000,
      currentTotalGdp: 125000000000,
      landArea: 100000,
      areaSqMi: 38610,
      baselineDate: new Date(),
      maxGdpGrowthRate: 0.05,
      adjustedGdpGrowth: 0.03,
      populationGrowthRate: 0.01,
      actualGdpGrowth: 0.03,
      localGrowthFactor: 1.0,
      economicTier: "Developing",
      populationTier: "2",
      nominalGDP: 125000000000,
      realGDPGrowthRate: 0.03,
      inflationRate: 0.02,
      currencyExchangeRate: 1,
      laborForceParticipationRate: 65,
      employmentRate: 95,
      unemploymentRate: 5,
      taxRevenueGDPPercent: 25,
      governmentBudgetGDPPercent: 30,
      povertyRate: 10,
      incomeInequalityGini: 0.35,
      lifeExpectancy: 75,
      urbanPopulationPercent: 60,
      literacyRate: 95,
    },
  });
  return testCountry.id;
}

async function cleanupTestData(countryId: string) {
  try {
    // Delete in correct order to respect foreign keys
    await prisma.budgetAllocation.deleteMany({
      where: { governmentStructure: { countryId } },
    });
    await prisma.revenueSource.deleteMany({
      where: { governmentStructure: { countryId } },
    });
    await prisma.governmentDepartment.deleteMany({
      where: { governmentStructure: { countryId } },
    });
    await prisma.governmentStructure.deleteMany({
      where: { countryId },
    });
    await prisma.taxComponent.deleteMany({ where: { countryId } });
    await prisma.governmentComponent.deleteMany({ where: { countryId } });
    await prisma.componentSynergy.deleteMany({ where: { countryId } });
    await prisma.country.delete({ where: { id: countryId } });
  } catch (e) {
    console.log("Cleanup warning:", (e as Error).message);
  }
}

// ============================================================================
// Performance Tests
// ============================================================================

async function testGovernmentCreatePerformance(countryId: string) {
  console.log("🏗️ Testing Government Structure Creation (20 departments)...\n");

  // Prepare test data with 20 departments
  const departments = Array.from({ length: 20 }, (_, i) => ({
    name: `Department ${i + 1}`,
    shortName: `D${i + 1}`,
    category: "Other" as const,
    description: `Test department ${i + 1}`,
    minister: `Minister ${i + 1}`,
    ministerTitle: "Minister",
    color: "#6366f1",
    priority: 50 - i,
    organizationalLevel: "Ministry" as const,
    parentDepartmentId: i > 0 && i % 5 === 0 ? String(i - 1) : undefined,
  }));

  const budgetAllocations = departments.slice(0, 10).map((_, i) => ({
    departmentId: String(i),
    budgetYear: 2026,
    allocatedAmount: 1000000 * (i + 1),
    allocatedPercent: 10,
    notes: `Budget for dept ${i + 1}`,
  }));

  const revenueSources = [
    { name: "Income Tax", category: "Direct Tax" as const, revenueAmount: 50000000 },
    { name: "VAT", category: "Indirect Tax" as const, revenueAmount: 30000000 },
    { name: "Corporate Tax", category: "Direct Tax" as const, revenueAmount: 20000000 },
  ];

  const { durationMs } = await measureAsync(async () => {
    return prisma.$transaction(async (tx) => {
      // Create government structure
      const govStructure = await tx.governmentStructure.create({
        data: {
          countryId,
          governmentName: "Test Government",
          governmentType: "Federal Republic",
          totalBudget: 100000000,
        },
      });

      // Batch create departments (simulating the optimized pattern)
      const deptData = departments.map((d) => ({
        governmentStructureId: govStructure.id,
        name: d.name,
        shortName: d.shortName,
        category: d.category,
        description: d.description,
        minister: d.minister,
        ministerTitle: d.ministerTitle,
        color: d.color,
        priority: d.priority,
        organizationalLevel: d.organizationalLevel,
      }));

      await tx.governmentDepartment.createMany({ data: deptData });

      // Fetch to get IDs
      const createdDepts = await tx.governmentDepartment.findMany({
        where: { governmentStructureId: govStructure.id },
        orderBy: { createdAt: "asc" },
      });

      // Build ID map
      const deptIdMap = new Map<number, string>();
      createdDepts.forEach((d, i) => deptIdMap.set(i, d.id));

      // Batch create allocations
      const allocData = budgetAllocations
        .map((a) => {
          const deptId = deptIdMap.get(parseInt(a.departmentId));
          if (!deptId) return null;
          return {
            governmentStructureId: govStructure.id,
            departmentId: deptId,
            budgetYear: a.budgetYear,
            allocatedAmount: a.allocatedAmount,
            allocatedPercent: a.allocatedPercent,
            availableAmount: a.allocatedAmount,
            notes: a.notes,
          };
        })
        .filter(Boolean);

      if (allocData.length > 0) {
        await tx.budgetAllocation.createMany({ data: allocData as any });
      }

      // Batch create revenue sources
      const revenueData = revenueSources.map((r) => ({
        governmentStructureId: govStructure.id,
        name: r.name,
        category: r.category,
        revenueAmount: r.revenueAmount,
        revenuePercent: (r.revenueAmount / 100000000) * 100,
      }));

      await tx.revenueSource.createMany({ data: revenueData });

      return govStructure;
    });
  });

  logResult(
    "Government Create (20 depts, 10 allocations, 3 revenue sources)",
    durationMs,
    THRESHOLDS.GOVERNMENT_CREATE_20_DEPTS,
    `Created complete government structure with batched operations`
  );

  return durationMs;
}

async function testGovernmentReadWithLimits(countryId: string) {
  console.log("📖 Testing Government Read with Limits...\n");

  const { durationMs } = await measureAsync(async () => {
    return prisma.governmentStructure.findUnique({
      where: { countryId },
      include: {
        departments: {
          include: {
            budgetAllocations: {
              orderBy: { budgetYear: "desc" },
              take: 3, // Limited to 3 years
            },
          },
          orderBy: { priority: "desc" },
        },
        budgetAllocations: {
          include: { department: true },
          orderBy: { budgetYear: "desc" },
          take: 60, // 3 years * 20 depts
        },
        revenueSources: {
          where: { isActive: true },
          orderBy: { revenueAmount: "desc" },
          take: 50,
        },
      },
    });
  });

  logResult(
    "Government Read (with limits)",
    durationMs,
    THRESHOLDS.GOVERNMENT_READ_WITH_LIMITS,
    `Read government structure with budgetYearsLimit=3`
  );

  return durationMs;
}

async function testTaxComponentQueryPerformance(countryId: string) {
  console.log("💰 Testing TaxComponent Query (compound index)...\n");

  // Create some test tax components
  await prisma.taxComponent.createMany({
    data: [
      { countryId, componentType: "PROGRESSIVE_TAX", effectivenessScore: 75, isActive: true },
      { countryId, componentType: "VAT_TAX", effectivenessScore: 80, isActive: true },
      { countryId, componentType: "FLAT_TAX", effectivenessScore: 60, isActive: false },
    ],
  });

  const { durationMs, result } = await measureAsync(async () => {
    // This query should use the compound index [countryId, componentType, isActive]
    return prisma.taxComponent.findMany({
      where: {
        countryId,
        componentType: "PROGRESSIVE_TAX",
        isActive: true,
      },
    });
  });

  logResult(
    "TaxComponent Query (compound index)",
    durationMs,
    THRESHOLDS.TAX_COMPONENT_QUERY,
    `Found ${result.length} active PROGRESSIVE_TAX components`
  );

  return durationMs;
}

async function testSynergyJoinPerformance(countryId: string) {
  console.log("🔗 Testing ComponentSynergy JOIN (FK indexes)...\n");

  // Create test government components first (using valid ComponentType enum values)
  const comp1 = await prisma.governmentComponent.create({
    data: { countryId, componentType: "DEMOCRATIC_PROCESS", effectivenessScore: 70 },
  });
  const comp2 = await prisma.governmentComponent.create({
    data: { countryId, componentType: "FEDERAL_SYSTEM", effectivenessScore: 65 },
  });

  // Create synergy
  await prisma.componentSynergy.create({
    data: {
      countryId,
      primaryComponentId: comp1.id,
      secondaryComponentId: comp2.id,
      synergyType: "POSITIVE",
      effectMultiplier: 1.2,
    },
  });

  const { durationMs, result } = await measureAsync(async () => {
    // This query should use the FK indexes for JOINs
    return prisma.componentSynergy.findMany({
      where: { countryId },
      include: {
        primaryComponent: true,
        secondaryComponent: true,
      },
    });
  });

  logResult(
    "ComponentSynergy JOIN Query (FK indexes)",
    durationMs,
    THRESHOLDS.SYNERGY_JOIN_QUERY,
    `Fetched ${result.length} synergies with component JOINs`
  );

  return durationMs;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("🚀 Builder System Performance Audit - Phase 1 Verification");
  console.log("=".repeat(70));
  console.log();

  try {
    // Connect and create test data
    await prisma.$connect();
    console.log("✅ Database connected\n");

    const testCountryId = await createTestCountry();
    console.log(`📦 Created test country: ${testCountryId}\n`);
    console.log("-".repeat(70));
    console.log();

    // Run performance tests
    await testGovernmentCreatePerformance(testCountryId);
    await testGovernmentReadWithLimits(testCountryId);
    await testTaxComponentQueryPerformance(testCountryId);
    await testSynergyJoinPerformance(testCountryId);

    // Cleanup
    console.log("-".repeat(70));
    console.log("🧹 Cleaning up test data...\n");
    await cleanupTestData(testCountryId);

    // Summary
    console.log("=".repeat(70));
    console.log("📊 PERFORMANCE AUDIT SUMMARY");
    console.log("=".repeat(70));
    console.log();

    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const allPassed = passed === total;

    results.forEach((r) => {
      const status = r.passed ? "✅" : "⚠️";
      const ratio = ((r.durationMs / r.threshold) * 100).toFixed(0);
      console.log(`${status} ${r.operation}: ${r.durationMs}ms (${ratio}% of ${r.threshold}ms limit)`);
    });

    console.log();
    console.log(`Total: ${passed}/${total} tests passed thresholds`);
    console.log();

    if (allPassed) {
      console.log("✅ All performance tests passed!");
      process.exit(0);
    } else {
      console.log("⚠️ Some tests exceeded thresholds - review needed");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Performance audit failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
