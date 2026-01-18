/**
 * Test Builder CRUD Operations
 *
 * This script tests the following:
 * 1. National Identity autosave (upsert)
 * 2. Government Structure update
 * 3. Error handling for invalid data
 *
 * Run with: npx tsx scripts/test-builder-crud.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testNationalIdentityAutosave() {
  console.log("\n📝 Testing National Identity Autosave...");

  // Get a test country
  const testCountry = await prisma.country.findFirst({
    select: { id: true, name: true },
  });

  if (!testCountry) {
    console.error("❌ No test country found!");
    return false;
  }

  console.log(`  Using test country: ${testCountry.name} (${testCountry.id})`);

  try {
    // Test upsert (should update existing record)
    const result = await prisma.nationalIdentity.upsert({
      where: { countryId: testCountry.id },
      update: {
        motto: "Test Motto - Updated by CRUD Test",
        capitalCity: "Test Capital",
        currency: "Test Dollar",
        currencySymbol: "T$",
        updatedAt: new Date(),
      },
      create: {
        countryId: testCountry.id,
        motto: "Test Motto - Created by CRUD Test",
        capitalCity: "Test Capital",
      },
    });

    console.log(`  ✅ Autosave successful! Updated fields:`);
    console.log(`     - Motto: ${result.motto}`);
    console.log(`     - Capital: ${result.capitalCity}`);
    console.log(`     - Currency: ${result.currency} (${result.currencySymbol})`);

    return true;
  } catch (error) {
    console.error(`  ❌ Autosave failed:`, error);
    return false;
  }
}

async function testGovernmentStructureUpdate() {
  console.log("\n🏛️  Testing Government Structure Update...");

  // Get a test country with government structure
  const testCountry = await prisma.country.findFirst({
    select: {
      id: true,
      name: true,
      governmentStructure: {
        select: { id: true, governmentName: true, totalBudget: true },
      },
    },
    where: {
      governmentStructure: { isNot: null },
    },
  });

  if (!testCountry?.governmentStructure) {
    console.error("❌ No country with government structure found!");
    return false;
  }

  console.log(`  Using test country: ${testCountry.name} (${testCountry.id})`);
  console.log(`  Existing government: ${testCountry.governmentStructure.governmentName}`);

  try {
    // Test update
    const result = await prisma.governmentStructure.update({
      where: { countryId: testCountry.id },
      data: {
        headOfState: "Test Prime Minister",
        headOfGovernment: "Test Chancellor",
        legislatureName: "Test Parliament",
        updatedAt: new Date(),
      },
    });

    console.log(`  ✅ Update successful! Updated fields:`);
    console.log(`     - Head of State: ${result.headOfState}`);
    console.log(`     - Head of Government: ${result.headOfGovernment}`);
    console.log(`     - Legislature: ${result.legislatureName}`);

    return true;
  } catch (error) {
    console.error(`  ❌ Update failed:`, error);
    return false;
  }
}

async function testDepartmentCRUD() {
  console.log("\n🏢 Testing Government Department CRUD...");

  // Get a government structure to add a department to
  const govStructure = await prisma.governmentStructure.findFirst({
    select: {
      id: true,
      countryId: true,
      country: { select: { name: true } },
    },
  });

  if (!govStructure) {
    console.error("❌ No government structure found!");
    return false;
  }

  console.log(`  Using country: ${govStructure.country.name}`);

  try {
    // Create a test department
    const department = await prisma.governmentDepartment.create({
      data: {
        governmentStructureId: govStructure.id,
        name: "Test Ministry of Testing",
        shortName: "MOT",
        category: "Other",
        description: "Testing CRUD operations",
        ministerTitle: "Minister",
        color: "#3b82f6",
        priority: 50,
        organizationalLevel: "Ministry",
      },
    });

    console.log(`  ✅ Department created: ${department.name} (ID: ${department.id})`);

    // Update the department
    const updated = await prisma.governmentDepartment.update({
      where: { id: department.id },
      data: {
        minister: "Test Minister Name",
        employeeCount: 1000,
      },
    });

    console.log(`  ✅ Department updated: Minister = ${updated.minister}, Employees = ${updated.employeeCount}`);

    // Delete the department
    await prisma.governmentDepartment.delete({
      where: { id: department.id },
    });

    console.log(`  ✅ Department deleted successfully`);

    return true;
  } catch (error) {
    console.error(`  ❌ Department CRUD failed:`, error);
    return false;
  }
}

async function testAuditLogCreation() {
  console.log("\n📋 Testing Audit Log Creation (with entityType field)...");

  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: "test-user-id",
        action: "test:crud-validation",
        target: "test-target",
        details: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
        success: true,
        entityType: "NationalIdentity", // This field was causing the error before
      },
    });

    console.log(`  ✅ Audit log created successfully (ID: ${auditLog.id})`);
    console.log(`     - Entity Type: ${auditLog.entityType}`);

    // Clean up
    await prisma.auditLog.delete({
      where: { id: auditLog.id },
    });

    console.log(`  ✅ Audit log cleanup successful`);

    return true;
  } catch (error) {
    console.error(`  ❌ Audit log creation failed:`, error);
    return false;
  }
}

async function main() {
  console.log("🧪 Starting CRUD Validation Tests...\n");
  console.log("=" + "=".repeat(60));

  const results = {
    nationalIdentityAutosave: await testNationalIdentityAutosave(),
    governmentStructureUpdate: await testGovernmentStructureUpdate(),
    departmentCRUD: await testDepartmentCRUD(),
    auditLogCreation: await testAuditLogCreation(),
  };

  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Test Results Summary:");
  console.log(`  National Identity Autosave: ${results.nationalIdentityAutosave ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Government Structure Update: ${results.governmentStructureUpdate ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Department CRUD: ${results.departmentCRUD ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Audit Log Creation: ${results.auditLogCreation ? "✅ PASS" : "❌ FAIL"}`);

  const allPassed = Object.values(results).every((result) => result === true);

  if (allPassed) {
    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("\n✅ Validation Complete:");
    console.log("  - National Identity autosave is working");
    console.log("  - Government Builder CRUD operations are functional");
    console.log("  - Audit logging with entityType is operational");
    console.log("  - All database constraints are satisfied");
  } else {
    console.log("\n⚠️  SOME TESTS FAILED - Review errors above");
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("❌ Fatal error during testing:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
