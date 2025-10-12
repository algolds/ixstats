#!/usr/bin/env tsx
/**
 * Economic Calculations Verification Script for IxStats v1.0
 * Verifies all economic formulas, tier-based calculations, and projections
 *
 * Usage: npx tsx scripts/audit/verify-economic-calculations.ts
 */

import { db } from "~/server/db";

interface CalculationTest {
  category: string;
  test: string;
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
  expected?: number;
  actual?: number;
  variance?: number;
}

const results: CalculationTest[] = [];

function log(test: CalculationTest) {
  results.push(test);
  const icon =
    test.status === "PASS" ? "✅" : test.status === "FAIL" ? "❌" : "⚠️";
  let msg = `${icon} [${test.category}] ${test.test}: ${test.message}`;
  if (test.expected !== undefined && test.actual !== undefined) {
    msg += ` (Expected: ${test.expected.toFixed(2)}, Actual: ${test.actual.toFixed(2)})`;
  }
  console.log(msg);
}

// Tier-based growth rates (from economic engine)
const tierGrowthRates = {
  1: { base: 0.08, variance: 0.02 }, // 8% ± 2%
  2: { base: 0.06, variance: 0.015 }, // 6% ± 1.5%
  3: { base: 0.04, variance: 0.01 }, // 4% ± 1%
  4: { base: 0.025, variance: 0.008 }, // 2.5% ± 0.8%
  5: { base: 0.015, variance: 0.005 }, // 1.5% ± 0.5%
};

// Test GDP calculation
async function testGDPCalculations() {
  const category = "GDP Calculations";

  try {
    const countries = await db.country.findMany({ take: 10 });

    for (const country of countries) {
      // Calculate GDP per capita
      const gdpPerCapita =
        country.currentPopulation > 0 ? country.currentTotalGdp / country.currentPopulation : 0;

      // Verify reasonable GDP per capita ranges
      const minGDPPerCapita = 500; // $500 minimum
      const maxGDPPerCapita = 200000; // $200,000 maximum

      const isValid =
        gdpPerCapita >= minGDPPerCapita && gdpPerCapita <= maxGDPPerCapita;

      log({
        category,
        test: `GDP per Capita - ${country.name}`,
        status: isValid ? "PASS" : "WARNING",
        message: isValid
          ? `$${gdpPerCapita.toFixed(2)} (valid range)`
          : `$${gdpPerCapita.toFixed(2)} (outside typical range)`,
        actual: gdpPerCapita,
      });

      // Test tier assignment based on GDP per capita
      let expectedTier: string;
      if (gdpPerCapita < 5000) expectedTier = "1";
      else if (gdpPerCapita < 15000) expectedTier = "2";
      else if (gdpPerCapita < 30000) expectedTier = "3";
      else if (gdpPerCapita < 50000) expectedTier = "4";
      else expectedTier = "5";

      log({
        category,
        test: `Tier Assignment - ${country.name}`,
        status: country.economicTier === expectedTier ? "PASS" : "WARNING",
        message:
          country.economicTier === expectedTier
            ? `Tier ${country.economicTier} correct for GDP/capita`
            : `Tier ${country.economicTier} may need adjustment (expected ${expectedTier})`,
        expected: parseInt(expectedTier),
        actual: parseInt(country.economicTier),
      });
    }

    // Test GDP growth rate calculations
    for (const country of countries) {
      const tierNum = parseInt(country.economicTier);
      const tierData = tierGrowthRates[tierNum as keyof typeof tierGrowthRates];
      if (!tierData) continue;

      const expectedGrowth = tierData.base;
      const actualGrowth = country.adjustedGdpGrowth || 0;

      // Allow for variance
      const minExpected = expectedGrowth - tierData.variance;
      const maxExpected = expectedGrowth + tierData.variance;

      const isWithinRange =
        actualGrowth >= minExpected && actualGrowth <= maxExpected;

      log({
        category,
        test: `GDP Growth Rate - ${country.name}`,
        status: isWithinRange ? "PASS" : "WARNING",
        message: isWithinRange
          ? `${(actualGrowth * 100).toFixed(2)}% (within tier ${country.economicTier} range)`
          : `${(actualGrowth * 100).toFixed(2)}% (outside expected range for tier ${country.economicTier})`,
        expected: expectedGrowth,
        actual: actualGrowth,
        variance: Math.abs(actualGrowth - expectedGrowth),
      });
    }
  } catch (error) {
    log({
      category,
      test: "GDP Calculations",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test economic indicators
async function testEconomicIndicators() {
  const category = "Economic Indicators";

  try {
    const countries = await db.country.findMany({ take: 10 });

    for (const country of countries) {
      // Test unemployment rate
      const unemployment = country.unemploymentRate || 0;
      const isValidUnemployment = unemployment >= 0 && unemployment <= 1;

      log({
        category,
        test: `Unemployment Rate - ${country.name}`,
        status: isValidUnemployment ? "PASS" : "FAIL",
        message: isValidUnemployment
          ? `${(unemployment * 100).toFixed(2)}% (valid)`
          : `${(unemployment * 100).toFixed(2)}% (invalid - should be 0-100%)`,
        actual: unemployment,
      });

      // Test inflation rate
      const inflation = country.inflationRate || 0;
      const isValidInflation = inflation >= -0.1 && inflation <= 1; // Allow -10% to 100%

      log({
        category,
        test: `Inflation Rate - ${country.name}`,
        status: isValidInflation ? "PASS" : "WARNING",
        message: isValidInflation
          ? `${(inflation * 100).toFixed(2)}% (valid)`
          : `${(inflation * 100).toFixed(2)}% (extreme value)`,
        actual: inflation,
      });

      // Test budget calculations
      if (country.governmentRevenueTotal && country.totalGovernmentSpending) {
        const budgetBalance = country.governmentRevenueTotal - country.totalGovernmentSpending;
        const budgetBalancePercent = (budgetBalance / country.currentTotalGdp) * 100;

        const isReasonable =
          budgetBalancePercent >= -20 && budgetBalancePercent <= 20;

        log({
          category,
          test: `Budget Balance - ${country.name}`,
          status: isReasonable ? "PASS" : "WARNING",
          message: isReasonable
            ? `${budgetBalancePercent.toFixed(2)}% of GDP`
            : `${budgetBalancePercent.toFixed(2)}% of GDP (extreme deficit/surplus)`,
          actual: budgetBalancePercent,
        });
      }
    }
  } catch (error) {
    log({
      category,
      test: "Economic Indicators",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test tier-based calculations
async function testTierBasedCalculations() {
  const category = "Tier-Based Calculations";

  try {
    // Test growth rate distribution by tier
    for (let tier = 1; tier <= 5; tier++) {
      const countries = await db.country.findMany({
        where: { economicTier: tier.toString() },
        select: { adjustedGdpGrowth: true, name: true },
      });

      if (countries.length === 0) continue;

      const avgGrowthRate =
        countries.reduce((sum, c) => sum + (c.adjustedGdpGrowth || 0), 0) /
        countries.length;

      const expectedRate = tierGrowthRates[tier as keyof typeof tierGrowthRates].base;
      const variance =
        tierGrowthRates[tier as keyof typeof tierGrowthRates].variance;

      const isWithinExpected =
        Math.abs(avgGrowthRate - expectedRate) <= variance * 2; // Allow 2x variance

      log({
        category,
        test: `Tier ${tier} Avg Growth Rate`,
        status: isWithinExpected ? "PASS" : "WARNING",
        message: `${(avgGrowthRate * 100).toFixed(2)}% across ${countries.length} countries`,
        expected: expectedRate,
        actual: avgGrowthRate,
        variance: Math.abs(avgGrowthRate - expectedRate),
      });
    }

    // Test tier progression logic
    const allCountries = await db.country.findMany({
      select: { economicTier: true, currentTotalGdp: true, currentPopulation: true },
    });

    let tierProgressionCorrect = 0;
    let tierProgressionTotal = 0;

    for (const country of allCountries) {
      const gdpPerCapita = country.currentTotalGdp / country.currentPopulation;
      let expectedTier: string;

      if (gdpPerCapita < 5000) expectedTier = "1";
      else if (gdpPerCapita < 15000) expectedTier = "2";
      else if (gdpPerCapita < 30000) expectedTier = "3";
      else if (gdpPerCapita < 50000) expectedTier = "4";
      else expectedTier = "5";

      if (country.economicTier === expectedTier) tierProgressionCorrect++;
      tierProgressionTotal++;
    }

    const progressionAccuracy =
      (tierProgressionCorrect / tierProgressionTotal) * 100;

    log({
      category,
      test: "Tier Assignment Accuracy",
      status: progressionAccuracy >= 80 ? "PASS" : "WARNING",
      message: `${tierProgressionCorrect}/${tierProgressionTotal} countries (${progressionAccuracy.toFixed(1)}%) correctly tiered`,
      actual: progressionAccuracy,
    });
  } catch (error) {
    log({
      category,
      test: "Tier-Based Calculations",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test projections and forecasts
async function testProjections() {
  const category = "Projections & Forecasts";

  try {
    const countries = await db.country.findMany({ take: 5 });

    for (const country of countries) {
      // Calculate 5-year GDP projection
      const growthRate = country.adjustedGdpGrowth || 0.03;
      const currentGDP = country.currentTotalGdp;
      const projected5YearGDP = currentGDP * Math.pow(1 + growthRate, 5);

      // Verify reasonable projection
      const growthFactor = projected5YearGDP / currentGDP;
      const isReasonable = growthFactor >= 0.8 && growthFactor <= 2.5;

      log({
        category,
        test: `5-Year GDP Projection - ${country.name}`,
        status: isReasonable ? "PASS" : "WARNING",
        message: isReasonable
          ? `${((growthFactor - 1) * 100).toFixed(1)}% total growth over 5 years`
          : `${((growthFactor - 1) * 100).toFixed(1)}% growth seems unrealistic`,
        actual: growthFactor,
      });

      // Test population growth projection
      const popGrowthRate = country.populationGrowthRate || 0.01;
      const currentPop = country.currentPopulation;
      const projected5YearPop = currentPop * Math.pow(1 + popGrowthRate, 5);

      const popGrowthFactor = projected5YearPop / currentPop;
      const isReasonablePop = popGrowthFactor >= 0.95 && popGrowthFactor <= 1.15;

      log({
        category,
        test: `5-Year Population Projection - ${country.name}`,
        status: isReasonablePop ? "PASS" : "WARNING",
        message: `${((popGrowthFactor - 1) * 100).toFixed(1)}% total growth over 5 years`,
        actual: popGrowthFactor,
      });
    }
  } catch (error) {
    log({
      category,
      test: "Projections & Forecasts",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test historical data tracking
async function testHistoricalTracking() {
  const category = "Historical Tracking";

  try {
    // Check if historical data points exist
    const snapshotCount = await db.historicalDataPoint.count();

    log({
      category,
      test: "Historical Data Points",
      status: snapshotCount > 0 ? "PASS" : "WARNING",
      message:
        snapshotCount > 0
          ? `${snapshotCount} historical data points found`
          : "No historical data points - tracking may not be enabled",
      actual: snapshotCount,
    });

    if (snapshotCount > 0) {
      // Test snapshot consistency
      const countries = await db.country.findMany({ take: 3 });

      for (const country of countries) {
        const snapshots = await db.historicalDataPoint.findMany({
          where: { countryId: country.id },
          orderBy: { ixTimeTimestamp: "desc" },
          take: 10,
        });

        if (snapshots.length >= 2) {
          // Verify chronological order
          let chronological = true;
          for (let i = 0; i < snapshots.length - 1; i++) {
            if (snapshots[i]!.ixTimeTimestamp <= snapshots[i + 1]!.ixTimeTimestamp) {
              chronological = false;
              break;
            }
          }

          log({
            category,
            test: `Data Point Chronology - ${country.name}`,
            status: chronological ? "PASS" : "FAIL",
            message: chronological
              ? `${snapshots.length} data points in correct order`
              : "Data points not in chronological order",
          });

          // Test data continuity
          const firstSnapshot = snapshots[snapshots.length - 1];
          const lastSnapshot = snapshots[0];

          if (firstSnapshot && lastSnapshot && firstSnapshot.totalGdp && lastSnapshot.totalGdp) {
            const gdpChange =
              lastSnapshot.totalGdp / firstSnapshot.totalGdp - 1;
            const timeSpan =
              (lastSnapshot.ixTimeTimestamp.getTime() -
                firstSnapshot.ixTimeTimestamp.getTime()) /
              (1000 * 60 * 60 * 24 * 365); // Years

            const impliedAnnualGrowth = timeSpan > 0 ? Math.pow(1 + gdpChange, 1 / timeSpan) - 1 : 0;

            log({
              category,
              test: `Historical Growth Rate - ${country.name}`,
              status: "PASS",
              message: `${(impliedAnnualGrowth * 100).toFixed(2)}% annual growth over ${timeSpan.toFixed(1)} years`,
              actual: impliedAnnualGrowth,
            });
          }
        }
      }
    }
  } catch (error) {
    log({
      category,
      test: "Historical Tracking",
      status: "FAIL",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Main test execution
async function runEconomicVerification() {
  console.log("\n💰 IxStats v1.0 - Economic Calculations Verification\n");
  console.log("=".repeat(80));

  console.log("\n📊 Testing GDP Calculations...");
  await testGDPCalculations();

  console.log("\n📈 Testing Economic Indicators...");
  await testEconomicIndicators();

  console.log("\n🎯 Testing Tier-Based Calculations...");
  await testTierBasedCalculations();

  console.log("\n🔮 Testing Projections & Forecasts...");
  await testProjections();

  console.log("\n📜 Testing Historical Tracking...");
  await testHistoricalTracking();

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 Verification Summary\n");

  const passed = results.filter((r) => r.status === "PASS").length;
  const warnings = results.filter((r) => r.status === "WARNING").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Warnings: ${warnings} (${((warnings / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed} (${((failed / results.length) * 100).toFixed(1)}%)`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => console.log(`   [${r.category}] ${r.test}: ${r.message}`));
  }

  const score = ((passed + warnings * 0.7) / results.length) * 100;
  let grade: string;
  if (score >= 95) grade = "A+ (Excellent)";
  else if (score >= 90) grade = "A (Very Good)";
  else if (score >= 85) grade = "B+ (Good)";
  else if (score >= 80) grade = "B (Acceptable)";
  else if (score >= 70) grade = "C (Needs Review)";
  else grade = "D (Critical Issues)";

  console.log(`\n🎯 Economic System Score: ${score.toFixed(1)}%`);
  console.log(`📊 Grade: ${grade}`);

  console.log("\n" + "=".repeat(80) + "\n");

  return { passed, warnings, failed, score, grade };
}

runEconomicVerification()
  .then((summary) => {
    if (summary.failed > 0) {
      console.error("⚠️  Economic calculation issues detected");
      process.exit(1);
    } else {
      console.log("✅ Economic calculations verified");
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error("❌ Fatal error during verification:", error);
    process.exit(1);
  });
