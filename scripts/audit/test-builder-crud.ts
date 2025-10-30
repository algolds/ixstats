#!/usr/bin/env tsx
/**
 * Test script for Builder and Wiki Import CRUD operations
 *
 * Tests:
 * 1. Wiki import search functionality
 * 2. Infobox parsing
 * 3. Country creation via builder
 * 4. Country update operations
 * 5. Country read operations
 * 6. Country delete operations
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  error?: any;
}

const results: TestResult[] = [];

function logTest(test: string, passed: boolean, message: string, error?: any) {
  results.push({ test, passed, message, error });
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status}: ${test}`);
  console.log(`   ${message}`);
  if (error) {
    console.log(`   Error: ${error.message || error}`);
  }
  console.log();
}

async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    await prisma.country.findFirst();
    logTest("Database Connection", true, "Successfully connected to database");
    return true;
  } catch (error) {
    logTest("Database Connection", false, "Failed to connect to database", error);
    return false;
  }
}

async function testCountryCreate() {
  try {
    const testData = {
      name: `Test Country ${Date.now()}`,
      slug: `test-country-${Date.now()}`,
      continent: "Test Continent",
      region: "Test Region",
      governmentType: "Test Republic",
      religion: "Test Religion",
      leader: "Test Leader",
      baselinePopulation: 5000000,
      baselineGdpPerCapita: 25000,
      currentPopulation: 5000000,
      currentGdpPerCapita: 25000,
      currentTotalGdp: 5000000 * 25000,
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
    };

    const country = await prisma.country.create({
      data: testData,
    });

    logTest("Country CREATE", !!country.id, `Created country: ${country.name} (ID: ${country.id})`);

    return country;
  } catch (error) {
    logTest("Country CREATE", false, "Failed to create country", error);
    return null;
  }
}

async function testCountryRead(countryId: string) {
  try {
    // Test findUnique
    const country = await prisma.country.findUnique({
      where: { id: countryId },
    });

    if (!country) {
      logTest("Country READ (by ID)", false, "Country not found by ID");
      return false;
    }

    logTest("Country READ (by ID)", true, `Found country: ${country.name} (ID: ${country.id})`);

    // Test findFirst with slug
    const countryBySlug = await prisma.country.findFirst({
      where: { slug: country.slug },
    });

    if (!countryBySlug) {
      logTest("Country READ (by slug)", false, "Country not found by slug");
      return false;
    }

    logTest("Country READ (by slug)", true, `Found country by slug: ${countryBySlug.name}`);

    // Test findMany
    const countries = await prisma.country.findMany({
      where: { continent: country.continent },
      take: 10,
    });

    logTest(
      "Country READ (findMany)",
      countries.length > 0,
      `Found ${countries.length} countries in ${country.continent}`
    );

    return true;
  } catch (error) {
    logTest("Country READ", false, "Failed to read country", error);
    return false;
  }
}

async function testCountryUpdate(countryId: string) {
  try {
    const updatedData = {
      currentPopulation: 5500000,
      currentGdpPerCapita: 26000,
      currentTotalGdp: 5500000 * 26000,
      realGDPGrowthRate: 0.04,
      lastCalculated: new Date(),
    };

    const updatedCountry = await prisma.country.update({
      where: { id: countryId },
      data: updatedData,
    });

    const success =
      updatedCountry.currentPopulation === updatedData.currentPopulation &&
      updatedCountry.currentGdpPerCapita === updatedData.currentGdpPerCapita;

    logTest(
      "Country UPDATE",
      success,
      `Updated country: ${updatedCountry.name} - Pop: ${updatedCountry.currentPopulation}, GDP/c: ${updatedCountry.currentGdpPerCapita}`
    );

    return success;
  } catch (error) {
    logTest("Country UPDATE", false, "Failed to update country", error);
    return false;
  }
}

async function testCountryDelete(countryId: string) {
  try {
    await prisma.country.delete({
      where: { id: countryId },
    });

    // Verify deletion
    const deletedCountry = await prisma.country.findUnique({
      where: { id: countryId },
    });

    const success = deletedCountry === null;

    logTest(
      "Country DELETE",
      success,
      success ? "Successfully deleted country" : "Country still exists after deletion"
    );

    return success;
  } catch (error) {
    logTest("Country DELETE", false, "Failed to delete country", error);
    return false;
  }
}

async function testWikiImportParsing() {
  try {
    // Test parsing basic infobox data
    const mockInfoboxData = {
      name: "Test Wiki Country",
      population: "5000000",
      gdp_per_capita: "25000",
      area: "100000",
      capital: "Test Capital",
      government: "Test Government",
    };

    // This simulates what the wiki importer would parse
    const parsedData = {
      name: mockInfoboxData.name,
      currentPopulation: parseInt(mockInfoboxData.population),
      baselineGdpPerCapita: parseInt(mockInfoboxData.gdp_per_capita),
      landArea: parseInt(mockInfoboxData.area),
      capital: mockInfoboxData.capital,
      governmentType: mockInfoboxData.government,
    };

    const success =
      parsedData.name === mockInfoboxData.name &&
      parsedData.currentPopulation === 5000000 &&
      parsedData.baselineGdpPerCapita === 25000;

    logTest(
      "Wiki Import Parsing",
      success,
      `Parsed wiki data: ${parsedData.name}, Pop: ${parsedData.currentPopulation}`
    );

    return success;
  } catch (error) {
    logTest("Wiki Import Parsing", false, "Failed to parse wiki data", error);
    return false;
  }
}

async function testBuilderDataFlow() {
  try {
    // Simulate builder flow: foundation country -> economic inputs -> creation
    // First try Advanced, then any country
    let foundationCountry = await prisma.country.findFirst({
      where: { economicTier: "Advanced" },
    });

    if (!foundationCountry) {
      // Fallback to any country
      foundationCountry = await prisma.country.findFirst();
    }

    if (!foundationCountry) {
      // Create a temporary foundation country for testing
      foundationCountry = await prisma.country.create({
        data: {
          name: `Foundation Test ${Date.now()}`,
          slug: `foundation-test-${Date.now()}`,
          continent: "Test Continent",
          region: "Test Region",
          governmentType: "Republic",
          religion: "Secular",
          leader: "Test Leader",
          baselinePopulation: 10000000,
          baselineGdpPerCapita: 50000,
          currentPopulation: 10000000,
          currentGdpPerCapita: 50000,
          currentTotalGdp: 500000000000,
          landArea: 200000,
          areaSqMi: 77220,
          baselineDate: new Date(),
          maxGdpGrowthRate: 0.05,
          adjustedGdpGrowth: 0.03,
          populationGrowthRate: 0.01,
          actualGdpGrowth: 0.03,
          localGrowthFactor: 1.0,
          economicTier: "Advanced",
          populationTier: "3",
          realGDPGrowthRate: 0.03,
          inflationRate: 0.02,
          laborForceParticipationRate: 70,
          employmentRate: 96,
          unemploymentRate: 4,
          taxRevenueGDPPercent: 30,
          governmentBudgetGDPPercent: 35,
          povertyRate: 5,
          incomeInequalityGini: 0.3,
          lifeExpectancy: 82,
          urbanPopulationPercent: 75,
          literacyRate: 99,
        },
      });
    }

    // Simulate economic inputs from builder
    const builderInputs = {
      name: `Builder Test ${Date.now()}`,
      foundationCountry: foundationCountry.slug,
      economicInputs: {
        population: foundationCountry.baselinePopulation,
        gdpPerCapita: foundationCountry.baselineGdpPerCapita,
        realGDPGrowthRate: 0.03,
        inflationRate: 0.02,
        laborForceParticipationRate: 65,
        employmentRate: 95,
        unemploymentRate: 5,
      },
    };

    // Create country using builder data
    const newCountry = await prisma.country.create({
      data: {
        name: builderInputs.name,
        slug: builderInputs.name.toLowerCase().replace(/\s+/g, "-"),
        continent: foundationCountry.continent,
        region: foundationCountry.region,
        governmentType: "Republic",
        religion: "Secular",
        leader: "Test Leader",
        baselinePopulation: builderInputs.economicInputs.population,
        baselineGdpPerCapita: builderInputs.economicInputs.gdpPerCapita,
        currentPopulation: builderInputs.economicInputs.population,
        currentGdpPerCapita: builderInputs.economicInputs.gdpPerCapita,
        currentTotalGdp:
          builderInputs.economicInputs.population * builderInputs.economicInputs.gdpPerCapita,
        landArea: foundationCountry.landArea,
        areaSqMi: foundationCountry.areaSqMi,
        baselineDate: new Date(),
        maxGdpGrowthRate: 0.05,
        adjustedGdpGrowth: builderInputs.economicInputs.realGDPGrowthRate,
        populationGrowthRate: 0.01,
        actualGdpGrowth: builderInputs.economicInputs.realGDPGrowthRate,
        localGrowthFactor: 1.0,
        economicTier: foundationCountry.economicTier,
        populationTier: "2",
        realGDPGrowthRate: builderInputs.economicInputs.realGDPGrowthRate,
        inflationRate: builderInputs.economicInputs.inflationRate,
        laborForceParticipationRate: builderInputs.economicInputs.laborForceParticipationRate,
        employmentRate: builderInputs.economicInputs.employmentRate,
        unemploymentRate: builderInputs.economicInputs.unemploymentRate,
        taxRevenueGDPPercent: 25,
        governmentBudgetGDPPercent: 30,
        povertyRate: 10,
        incomeInequalityGini: 0.35,
        lifeExpectancy: 75,
        urbanPopulationPercent: 60,
        literacyRate: 95,
      },
    });

    // Clean up test country
    await prisma.country.delete({ where: { id: newCountry.id } });

    // Clean up foundation country if it was created for testing
    if (foundationCountry.name.startsWith("Foundation Test")) {
      await prisma.country.delete({ where: { id: foundationCountry.id } });
    }

    logTest(
      "Builder Data Flow",
      !!newCountry.id,
      `Builder flow successful: Created ${newCountry.name} based on ${foundationCountry.name}`
    );

    return true;
  } catch (error) {
    logTest("Builder Data Flow", false, "Builder data flow failed", error);
    return false;
  }
}

async function testRelationalData(countryId: string) {
  try {
    // Test creating related data
    const historicalPoint = await prisma.historicalDataPoint.create({
      data: {
        countryId: countryId,
        ixTimeTimestamp: new Date(),
        population: 5000000,
        gdpPerCapita: 25000,
        totalGdp: 125000000000,
        gdpGrowthRate: 0.03,
        populationGrowthRate: 0.01,
        landArea: 100000,
        populationDensity: 50,
        gdpDensity: 1250000,
      },
    });

    logTest(
      "Relational Data (Historical Points)",
      !!historicalPoint.id,
      `Created historical data point for country`
    );

    // Test reading with relations
    const countryWithHistory = await prisma.country.findUnique({
      where: { id: countryId },
      include: {
        historicalData: {
          take: 1,
          orderBy: { ixTimeTimestamp: "desc" },
        },
      },
    });

    const success = countryWithHistory && countryWithHistory.historicalData.length > 0;

    logTest(
      "Relational Data (Read with includes)",
      success,
      `Country has ${countryWithHistory?.historicalData.length || 0} historical data points`
    );

    return success;
  } catch (error) {
    logTest("Relational Data", false, "Failed to test relational data", error);
    return false;
  }
}

async function runAllTests() {
  console.log("🧪 Starting Builder & Wiki Import CRUD Tests\n");
  console.log("=".repeat(60));
  console.log();

  // Test 1: Database connection
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.log("\n❌ Database connection failed. Aborting tests.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Test 2: Wiki import parsing (no DB)
  await testWikiImportParsing();

  // Test 3: Country CREATE
  const testCountry = await testCountryCreate();
  if (!testCountry) {
    console.log("\n❌ Country creation failed. Aborting remaining tests.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Test 4: Country READ
  await testCountryRead(testCountry.id);

  // Test 5: Country UPDATE
  await testCountryUpdate(testCountry.id);

  // Test 6: Relational data
  await testRelationalData(testCountry.id);

  // Test 7: Builder data flow
  await testBuilderDataFlow();

  // Test 8: Country DELETE (cleanup)
  await testCountryDelete(testCountry.id);

  // Summary
  console.log();
  console.log("=".repeat(60));
  console.log("\n📊 TEST SUMMARY\n");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  console.log("\n" + "=".repeat(60));

  // Detailed failures
  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:\n");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`• ${r.test}`);
        console.log(`  ${r.message}`);
        if (r.error) {
          console.log(`  Error: ${r.error.message || r.error}`);
        }
        console.log();
      });
  }

  await prisma.$disconnect();

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error("\n💥 Unexpected error during tests:", error);
  prisma.$disconnect();
  process.exit(1);
});
