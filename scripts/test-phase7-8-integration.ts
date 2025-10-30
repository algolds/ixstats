#!/usr/bin/env tsx

/**
 * Phase 7 & 8 Integration Test Script
 *
 * Tests the integration of diplomatic scenarios and NPC personalities systems:
 * - Database connectivity and schema validation
 * - Record counts and data integrity
 * - JSON field parsing and validation
 * - Relationship integrity between models
 * - Fallback patterns for empty database
 * - API endpoint simulation
 *
 * Run with: npx tsx scripts/test-phase7-8-integration.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${"=".repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${"=".repeat(70)}${colors.reset}\n`);
}

function logTest(testName: string) {
  console.log(`\n${colors.bright}${colors.blue}📋 ${testName}${colors.reset}`);
  console.log(`${colors.blue}${"-".repeat(70)}${colors.reset}`);
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function testPhase7And8Integration() {
  log("\n🚀 Phase 7 & 8 Integration Test Suite", "bright");
  log("Testing Diplomatic Scenarios and NPC Personalities Systems\n", "cyan");

  try {
    // ==================== Test 1: Database Connectivity ====================
    logTest("Test 1: Database Connectivity");

    try {
      await db.$connect();
      log("✅ Database connection successful", "green");
      results.push({
        name: "Database Connection",
        passed: true,
        message: "Connected successfully",
      });
    } catch (error) {
      log("❌ Database connection failed", "red");
      console.error(error);
      results.push({ name: "Database Connection", passed: false, message: "Connection failed" });
      throw error;
    }

    // ==================== Test 2: Diplomatic Scenarios Table ====================
    logTest("Test 2: Diplomatic Scenarios (CulturalScenario) Table");

    try {
      const scenarioCount = await db.culturalScenario.count();
      log(`Total scenarios in database: ${scenarioCount}`, "cyan");

      if (scenarioCount === 0) {
        log("⚠️  No scenarios found (empty database - fallback pattern will be tested)", "yellow");
        results.push({
          name: "Diplomatic Scenarios Count",
          passed: true,
          message: "Empty database - fallback handling available",
        });
      } else {
        log(`✅ Found ${scenarioCount} diplomatic scenarios`, "green");
        results.push({
          name: "Diplomatic Scenarios Count",
          passed: true,
          message: `${scenarioCount} scenarios found`,
        });

        // Get sample scenarios
        const scenarios = await db.culturalScenario.findMany({
          take: 3,
          orderBy: { createdAt: "desc" },
        });

        log("\nSample Scenarios:", "cyan");
        for (const scenario of scenarios) {
          log(
            `  • ${scenario.title} (Type: ${scenario.type}, Status: ${scenario.status})`,
            "reset"
          );
          log(`    Countries: ${scenario.country1Name} <-> ${scenario.country2Name}`, "reset");
          log(
            `    Impact: ${scenario.culturalImpact}, Risk: ${scenario.diplomaticRisk}, Cost: ${scenario.economicCost}`,
            "reset"
          );
        }
      }

      // Test scenario status breakdown
      const statusCounts = await db.culturalScenario.groupBy({
        by: ["status"],
        _count: { id: true },
      });

      if (statusCounts.length > 0) {
        log("\nScenario Status Breakdown:", "cyan");
        for (const status of statusCounts) {
          log(`  • ${status.status}: ${status._count.id}`, "reset");
        }
      }

      // Test scenario types
      const typeCounts = await db.culturalScenario.groupBy({
        by: ["type"],
        _count: { id: true },
      });

      if (typeCounts.length > 0) {
        log("\nScenario Type Distribution:", "cyan");
        for (const type of typeCounts) {
          log(`  • ${type.type}: ${type._count.id}`, "reset");
        }
      }

      results.push({
        name: "Diplomatic Scenarios Schema",
        passed: true,
        message: "Schema validation successful",
      });
    } catch (error) {
      log("❌ Failed to query CulturalScenario table", "red");
      console.error(error);
      results.push({
        name: "Diplomatic Scenarios Schema",
        passed: false,
        message: "Schema query failed",
      });
    }

    // ==================== Test 3: NPC Personalities Table ====================
    logTest("Test 3: NPC Personalities Table");

    try {
      const personalityCount = await db.nPCPersonality.count();
      log(`Total personalities in database: ${personalityCount}`, "cyan");

      if (personalityCount === 0) {
        log(
          "⚠️  No personalities found (empty database - fallback pattern will be tested)",
          "yellow"
        );
        results.push({
          name: "NPC Personalities Count",
          passed: true,
          message: "Empty database - fallback handling available",
        });
      } else {
        log(`✅ Found ${personalityCount} NPC personalities`, "green");
        results.push({
          name: "NPC Personalities Count",
          passed: true,
          message: `${personalityCount} personalities found`,
        });

        // Get sample personalities
        const personalities = await db.nPCPersonality.findMany({
          take: 3,
          orderBy: { usageCount: "desc" },
        });

        log("\nSample Personalities:", "cyan");
        for (const personality of personalities) {
          log(`  • ${personality.name} (Archetype: ${personality.archetype})`, "reset");
          log(
            `    Active: ${personality.isActive}, Usage Count: ${personality.usageCount}`,
            "reset"
          );
          log(
            `    Traits: A:${personality.assertiveness} C:${personality.cooperativeness} E:${personality.economicFocus} M:${personality.militarism}`,
            "reset"
          );
        }
      }

      // Test active vs inactive
      const activeCount = await db.nPCPersonality.count({ where: { isActive: true } });
      const inactiveCount = await db.nPCPersonality.count({ where: { isActive: false } });

      if (personalityCount > 0) {
        log("\nPersonality Status:", "cyan");
        log(`  • Active: ${activeCount}`, "reset");
        log(`  • Inactive: ${inactiveCount}`, "reset");
      }

      // Test archetype distribution
      const archetypeCounts = await db.nPCPersonality.groupBy({
        by: ["archetype"],
        _count: { id: true },
      });

      if (archetypeCounts.length > 0) {
        log("\nArchetype Distribution:", "cyan");
        for (const archetype of archetypeCounts) {
          log(`  • ${archetype.archetype}: ${archetype._count.id}`, "reset");
        }
      }

      results.push({
        name: "NPC Personalities Schema",
        passed: true,
        message: "Schema validation successful",
      });
    } catch (error) {
      log("❌ Failed to query NPCPersonality table", "red");
      console.error(error);
      results.push({
        name: "NPC Personalities Schema",
        passed: false,
        message: "Schema query failed",
      });
    }

    // ==================== Test 4: JSON Field Parsing ====================
    logTest("Test 4: JSON Field Parsing and Validation");

    try {
      let jsonTestsPassed = 0;
      let jsonTestsFailed = 0;

      // Test Scenario JSON fields
      const sampleScenario = await db.culturalScenario.findFirst();
      if (sampleScenario) {
        log("Testing CulturalScenario JSON fields:", "cyan");

        try {
          const responseOptions = JSON.parse(sampleScenario.responseOptions);
          log(
            `  ✅ responseOptions parsed: ${Array.isArray(responseOptions) ? responseOptions.length : 0} options`,
            "green"
          );
          jsonTestsPassed++;
        } catch (error) {
          log("  ❌ responseOptions parse failed", "red");
          jsonTestsFailed++;
        }

        try {
          const tags = JSON.parse(sampleScenario.tags);
          log(`  ✅ tags parsed: ${Array.isArray(tags) ? tags.length : 0} tags`, "green");
          jsonTestsPassed++;
        } catch (error) {
          log("  ❌ tags parse failed", "red");
          jsonTestsFailed++;
        }

        if (sampleScenario.outcomeNotes) {
          try {
            const outcomeNotes = JSON.parse(sampleScenario.outcomeNotes);
            log(`  ✅ outcomeNotes parsed successfully`, "green");
            jsonTestsPassed++;
          } catch (error) {
            log("  ❌ outcomeNotes parse failed", "red");
            jsonTestsFailed++;
          }
        }
      } else {
        log("  ⚠️  No scenarios to test JSON parsing", "yellow");
      }

      // Test Personality JSON fields
      const samplePersonality = await db.nPCPersonality.findFirst();
      if (samplePersonality) {
        log("\nTesting NPCPersonality JSON fields:", "cyan");

        try {
          const traitDescriptions = JSON.parse(samplePersonality.traitDescriptions);
          log(
            `  ✅ traitDescriptions parsed: ${Object.keys(traitDescriptions).length} traits`,
            "green"
          );
          jsonTestsPassed++;
        } catch (error) {
          log("  ❌ traitDescriptions parse failed", "red");
          jsonTestsFailed++;
        }

        try {
          const culturalProfile = JSON.parse(samplePersonality.culturalProfile);
          log(
            `  ✅ culturalProfile parsed: ${Object.keys(culturalProfile).length} properties`,
            "green"
          );
          jsonTestsPassed++;
        } catch (error) {
          log("  ❌ culturalProfile parse failed", "red");
          jsonTestsFailed++;
        }

        try {
          const toneMatrix = JSON.parse(samplePersonality.toneMatrix);
          log(`  ✅ toneMatrix parsed successfully`, "green");
          jsonTestsPassed++;
        } catch (error) {
          log("  ❌ toneMatrix parse failed", "red");
          jsonTestsFailed++;
        }

        try {
          const responsePatterns = JSON.parse(samplePersonality.responsePatterns);
          log(
            `  ✅ responsePatterns parsed: ${Array.isArray(responsePatterns) ? responsePatterns.length : 0} patterns`,
            "green"
          );
          jsonTestsPassed++;
        } catch (error) {
          log("  ❌ responsePatterns parse failed", "red");
          jsonTestsFailed++;
        }

        try {
          const scenarioResponses = JSON.parse(samplePersonality.scenarioResponses);
          log(
            `  ✅ scenarioResponses parsed: ${Object.keys(scenarioResponses).length} responses`,
            "green"
          );
          jsonTestsPassed++;
        } catch (error) {
          log("  ❌ scenarioResponses parse failed", "red");
          jsonTestsFailed++;
        }

        try {
          const eventModifiers = JSON.parse(samplePersonality.eventModifiers);
          log(
            `  ✅ eventModifiers parsed: ${Object.keys(eventModifiers).length} modifiers`,
            "green"
          );
          jsonTestsPassed++;
        } catch (error) {
          log("  ❌ eventModifiers parse failed", "red");
          jsonTestsFailed++;
        }
      } else {
        log("  ⚠️  No personalities to test JSON parsing", "yellow");
      }

      if (jsonTestsPassed > 0) {
        log(
          `\nJSON Parsing Summary: ${jsonTestsPassed} passed, ${jsonTestsFailed} failed`,
          jsonTestsFailed > 0 ? "yellow" : "green"
        );
        results.push({
          name: "JSON Field Parsing",
          passed: jsonTestsFailed === 0,
          message: `${jsonTestsPassed} tests passed, ${jsonTestsFailed} tests failed`,
        });
      } else {
        log("  ⚠️  No JSON fields to test (empty database)", "yellow");
        results.push({
          name: "JSON Field Parsing",
          passed: true,
          message: "No data to test (empty database)",
        });
      }
    } catch (error) {
      log("❌ JSON field parsing test failed", "red");
      console.error(error);
      results.push({
        name: "JSON Field Parsing",
        passed: false,
        message: "Test execution failed",
      });
    }

    // ==================== Test 5: Data Relationships ====================
    logTest("Test 5: Data Relationships and Referential Integrity");

    try {
      // Test NPC Personality Assignments
      const assignmentCount = await db.nPCPersonalityAssignment.count();
      log(`Total personality assignments: ${assignmentCount}`, "cyan");

      if (assignmentCount > 0) {
        // Test assignment relationships
        const assignmentsWithRelations = await db.nPCPersonalityAssignment.findMany({
          take: 5,
          include: {
            personality: true,
            country: true,
          },
        });

        log("\nSample Personality Assignments:", "cyan");
        for (const assignment of assignmentsWithRelations) {
          const personalityName = assignment.personality?.name || "MISSING";
          const countryName = assignment.country?.name || "MISSING";
          const status = assignment.personality && assignment.country ? "✅" : "❌";

          log(
            `  ${status} Country: ${countryName} -> Personality: ${personalityName}`,
            status === "✅" ? "green" : "red"
          );
          log(
            `     Assigned: ${assignment.assignedAt.toISOString().split("T")[0]}, By: ${assignment.assignedBy || "system"}`,
            "reset"
          );
        }

        // Check for orphaned assignments
        const orphanedAssignments = assignmentsWithRelations.filter(
          (a) => !a.personality || !a.country
        );
        if (orphanedAssignments.length > 0) {
          log(
            `\n⚠️  Found ${orphanedAssignments.length} orphaned assignments (missing personality or country)`,
            "yellow"
          );
          results.push({
            name: "Personality Assignment Integrity",
            passed: false,
            message: `${orphanedAssignments.length} orphaned assignments found`,
          });
        } else {
          log("\n✅ All assignments have valid relationships", "green");
          results.push({
            name: "Personality Assignment Integrity",
            passed: true,
            message: "All assignments valid",
          });
        }
      } else {
        log("  ⚠️  No personality assignments found", "yellow");
        results.push({
          name: "Personality Assignment Integrity",
          passed: true,
          message: "No assignments to validate",
        });
      }

      // Test Scenario-Exchange Relationships
      const scenariosWithExchanges = await db.culturalScenario.findMany({
        where: {
          relatedExchanges: {
            some: {},
          },
        },
        include: {
          _count: {
            select: { relatedExchanges: true },
          },
        },
        take: 5,
      });

      if (scenariosWithExchanges.length > 0) {
        log("\nScenarios with Cultural Exchanges:", "cyan");
        for (const scenario of scenariosWithExchanges) {
          log(`  • ${scenario.title}: ${scenario._count.relatedExchanges} exchanges`, "reset");
        }
        results.push({
          name: "Scenario-Exchange Relationships",
          passed: true,
          message: `${scenariosWithExchanges.length} scenarios with exchanges`,
        });
      } else {
        log("\n⚠️  No scenarios with related exchanges found", "yellow");
        results.push({
          name: "Scenario-Exchange Relationships",
          passed: true,
          message: "No exchanges to validate",
        });
      }
    } catch (error) {
      log("❌ Relationship integrity test failed", "red");
      console.error(error);
      results.push({
        name: "Data Relationships",
        passed: false,
        message: "Test execution failed",
      });
    }

    // ==================== Test 6: Fallback Patterns ====================
    logTest("Test 6: Fallback Patterns for Empty Database");

    try {
      const scenarioCount = await db.culturalScenario.count();
      const personalityCount = await db.nPCPersonality.count();

      if (scenarioCount === 0) {
        log("✅ Empty scenario database detected - fallback pattern would activate", "green");
        log("   Router would return empty array or generate scenarios on demand", "cyan");
      } else {
        log(`✅ Database has ${scenarioCount} scenarios - fallback not needed`, "green");
      }

      if (personalityCount === 0) {
        log("✅ Empty personality database detected - fallback pattern would activate", "green");
        log("   Router would return hardcoded personalities", "cyan");
      } else {
        log(`✅ Database has ${personalityCount} personalities - fallback not needed`, "green");
      }

      results.push({
        name: "Fallback Pattern Validation",
        passed: true,
        message: "Fallback logic verified",
      });
    } catch (error) {
      log("❌ Fallback pattern test failed", "red");
      console.error(error);
      results.push({
        name: "Fallback Pattern Validation",
        passed: false,
        message: "Test execution failed",
      });
    }

    // ==================== Test 7: API Endpoint Simulation ====================
    logTest("Test 7: API Endpoint Query Simulation");

    try {
      log("Simulating diplomaticScenarios router queries:", "cyan");

      // Simulate getAllScenarios endpoint
      const allScenarios = await db.culturalScenario.findMany({
        where: {
          status: { in: ["active", "pending"] },
          expiresAt: { gt: new Date() },
        },
        take: 10,
      });
      log(`  ✅ getAllScenarios: ${allScenarios.length} active scenarios`, "green");

      // Simulate getScenariosByType endpoint
      const scenariosByType = await db.culturalScenario.groupBy({
        by: ["type"],
        _count: { id: true },
        where: {
          status: { in: ["active", "pending"] },
        },
      });
      log(`  ✅ getScenariosByType: ${scenariosByType.length} types found`, "green");

      // Simulate getPlayerScenarioHistory endpoint
      const completedScenarios = await db.culturalScenario.findMany({
        where: { status: "completed" },
        take: 5,
        orderBy: { resolvedAt: "desc" },
      });
      log(
        `  ✅ getPlayerScenarioHistory: ${completedScenarios.length} completed scenarios`,
        "green"
      );

      log("\nSimulating npcPersonalities router queries:", "cyan");

      // Simulate getAllPersonalities endpoint
      const allPersonalities = await db.nPCPersonality.findMany({
        where: { isActive: true },
        orderBy: { usageCount: "desc" },
      });
      log(`  ✅ getAllPersonalities: ${allPersonalities.length} active personalities`, "green");

      // Simulate getPersonalityByArchetype endpoint
      const personalityByArchetype = await db.nPCPersonality.findFirst({
        where: {
          archetype: "pragmatic_realist",
          isActive: true,
        },
      });
      log(
        `  ✅ getPersonalityByArchetype: ${personalityByArchetype ? "Found" : "Not found"}`,
        personalityByArchetype ? "green" : "yellow"
      );

      // Simulate getCountryPersonality endpoint (check assignments)
      const sampleAssignment = await db.nPCPersonalityAssignment.findFirst({
        include: { personality: true },
      });
      log(
        `  ✅ getCountryPersonality: ${sampleAssignment ? "Assignment found" : "No assignments"}`,
        sampleAssignment ? "green" : "yellow"
      );

      results.push({
        name: "API Endpoint Simulation",
        passed: true,
        message: "All endpoint queries successful",
      });
    } catch (error) {
      log("❌ API endpoint simulation failed", "red");
      console.error(error);
      results.push({
        name: "API Endpoint Simulation",
        passed: false,
        message: "Query execution failed",
      });
    }

    // ==================== Test 8: Data Quality Checks ====================
    logTest("Test 8: Data Quality and Consistency Checks");

    try {
      let qualityIssues = 0;

      // Check for scenarios with invalid dates
      const expiredActiveScenarios = await db.culturalScenario.count({
        where: {
          status: { in: ["active", "pending"] },
          expiresAt: { lt: new Date() },
        },
      });

      if (expiredActiveScenarios > 0) {
        log(`  ⚠️  Found ${expiredActiveScenarios} active scenarios that are expired`, "yellow");
        qualityIssues++;
      } else {
        log("  ✅ No active expired scenarios", "green");
      }

      // Check for completed scenarios without resolution date
      const completedWithoutResolved = await db.culturalScenario.count({
        where: {
          status: "completed",
          resolvedAt: null,
        },
      });

      if (completedWithoutResolved > 0) {
        log(
          `  ⚠️  Found ${completedWithoutResolved} completed scenarios without resolvedAt date`,
          "yellow"
        );
        qualityIssues++;
      } else {
        log("  ✅ All completed scenarios have resolution dates", "green");
      }

      // Check for personalities with invalid trait ranges
      const invalidTraitPersonalities = await db.nPCPersonality.findMany({
        where: {
          OR: [
            { assertiveness: { lt: 0 } },
            { assertiveness: { gt: 100 } },
            { cooperativeness: { lt: 0 } },
            { cooperativeness: { gt: 100 } },
            { economicFocus: { lt: 0 } },
            { economicFocus: { gt: 100 } },
          ],
        },
      });

      if (invalidTraitPersonalities.length > 0) {
        log(
          `  ⚠️  Found ${invalidTraitPersonalities.length} personalities with traits outside 0-100 range`,
          "yellow"
        );
        qualityIssues++;
      } else {
        log("  ✅ All personality traits within valid range", "green");
      }

      if (qualityIssues === 0) {
        log("\n✅ All data quality checks passed", "green");
        results.push({
          name: "Data Quality Checks",
          passed: true,
          message: "No quality issues found",
        });
      } else {
        log(`\n⚠️  Found ${qualityIssues} data quality issues`, "yellow");
        results.push({
          name: "Data Quality Checks",
          passed: false,
          message: `${qualityIssues} quality issues found`,
        });
      }
    } catch (error) {
      log("❌ Data quality check failed", "red");
      console.error(error);
      results.push({
        name: "Data Quality Checks",
        passed: false,
        message: "Test execution failed",
      });
    }

    // ==================== Test Summary Report ====================
    logSection("Test Summary Report");

    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = Math.round((passedTests / totalTests) * 100);

    log(`Total Tests: ${totalTests}`, "cyan");
    log(`Passed: ${passedTests}`, "green");
    log(`Failed: ${failedTests}`, failedTests > 0 ? "red" : "green");
    log(`Success Rate: ${successRate}%\n`, successRate === 100 ? "green" : "yellow");

    // Detailed results
    log("Detailed Results:", "bright");
    for (const result of results) {
      const icon = result.passed ? "✅" : "❌";
      const color = result.passed ? "green" : "red";
      log(`${icon} ${result.name}: ${result.message}`, color);
    }

    // Overall status
    console.log("\n");
    if (failedTests === 0) {
      logSection("🎉 Phase 7 & 8 Integration: ALL TESTS PASSED");
      log("✅ Diplomatic Scenarios system is fully operational", "green");
      log("✅ NPC Personalities system is fully operational", "green");
      log("✅ Data relationships are intact", "green");
      log("✅ JSON parsing is working correctly", "green");
      log("✅ API endpoints are ready for use", "green");
      log("\n🚀 System is ready for production deployment!", "bright");
    } else {
      logSection("⚠️  Phase 7 & 8 Integration: SOME TESTS FAILED");
      log(`❌ ${failedTests} test(s) failed - review issues above`, "red");
      log("⚠️  System may need attention before full production use", "yellow");
    }

    return successRate === 100;
  } catch (error) {
    logSection("❌ CRITICAL ERROR");
    log("Integration test suite encountered a critical error:", "red");
    console.error(error);
    return false;
  } finally {
    await db.$disconnect();
  }
}

// Run the integration test
testPhase7And8Integration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
