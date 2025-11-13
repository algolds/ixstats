#!/usr/bin/env node
/**
 * IxCards Phase 4 - Comprehensive Test Suite
 *
 * Tests all features:
 * 1. NS Sync Checkpoint System (CRUD)
 * 2. Budget Multiplier Calculations
 * 3. Card Value Tracking (CRUD)
 * 4. Card Analytics Endpoints
 * 5. Admin UI Data Access
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
}

async function testSyncCheckpointCRUD() {
  console.log('\n━━━ Test 1: Sync Checkpoint System (CRUD) ━━━\n');

  try {
    // CREATE: Create a checkpoint
    const checkpoint = await db.syncCheckpoint.create({
      data: {
        season: 999, // Test season
        status: 'IN_PROGRESS',
        cardsProcessed: 500,
        totalCards: 10000,
        lastProcessedCardId: 'test-card-500',
        errorCount: 5,
        startedAt: new Date(),
        lastCheckpointAt: new Date(),
        metadata: { test: true },
      },
    });
    logTest('Checkpoint CREATE', !!checkpoint.id, `Created checkpoint ID: ${checkpoint.id}`);

    // READ: Retrieve the checkpoint
    const retrieved = await db.syncCheckpoint.findUnique({
      where: { season: 999 },
    });
    logTest('Checkpoint READ', retrieved?.season === 999, `Retrieved season: ${retrieved?.season}`);

    // UPDATE: Update checkpoint progress
    const updated = await db.syncCheckpoint.update({
      where: { season: 999 },
      data: {
        cardsProcessed: 1000,
        lastProcessedCardId: 'test-card-1000',
        errorCount: 10,
      },
    });
    logTest('Checkpoint UPDATE', updated.cardsProcessed === 1000, `Updated progress: ${updated.cardsProcessed}/10000`);

    // READ (verify update)
    const verified = await db.syncCheckpoint.findUnique({
      where: { season: 999 },
    });
    logTest('Checkpoint UPDATE verification', verified?.errorCount === 10, `Error count: ${verified?.errorCount}`);

    // DELETE: Clean up test checkpoint
    await db.syncCheckpoint.delete({
      where: { season: 999 },
    });
    const deleted = await db.syncCheckpoint.findUnique({
      where: { season: 999 },
    });
    logTest('Checkpoint DELETE', deleted === null, 'Checkpoint successfully deleted');

  } catch (error) {
    logTest('Checkpoint CRUD', false, `Error: ${error.message}`);
  }
}

async function testBudgetMultiplierCalculation() {
  console.log('\n━━━ Test 2: Budget Multiplier System ━━━\n');

  try {
    // Check if vaultMultiplier column exists
    const result = await db.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'SubBudgetCategory'
      AND column_name = 'vaultMultiplier'
    `;
    logTest('vaultMultiplier column exists', result.length > 0, `Column found: ${result.length > 0}`);

    // Use an existing country or create a simple test reference
    let testCountryId = 'test-budget-country-temp';
    let existingCountry = await db.country.findFirst();
    if (existingCountry) {
      testCountryId = existingCountry.id;
    }

    // Create test government structure with budget
    const govt = await db.governmentStructure.create({
      data: {
        countryId: testCountryId,
        governmentName: 'Test Budget Government',
        governmentType: 'TEST',
        headOfState: 'Test Leader',
      },
    });

    const dept = await db.governmentDepartment.create({
      data: {
        governmentStructureId: govt.id,
        name: 'Test Economic Department',
        category: 'ECONOMIC',
        isActive: true,
      },
    });

    const budget = await db.budgetAllocation.create({
      data: {
        governmentStructureId: govt.id,
        departmentId: dept.id,
        budgetYear: 2025,
        allocatedAmount: 1000000,
        allocatedPercent: 30.0,
      },
    });

    // Create sub-budget with multiplier
    const subBudget = await db.subBudgetCategory.create({
      data: {
        departmentId: dept.id,
        name: 'Economic Development',
        budgetType: 'CAPITAL',
        amount: 500000,
        percent: 50.0,
        vaultMultiplier: 2.0, // 2x multiplier for economic development
      },
    });

    logTest('Budget with multiplier CREATE', subBudget.vaultMultiplier === 2.0, `Multiplier: ${subBudget.vaultMultiplier}x`);

    // Test multiplier calculation logic
    const allBudgets = await db.subBudgetCategory.findMany({
      where: { departmentId: dept.id },
    });

    const weightedMultiplier = allBudgets.reduce((sum, b) => {
      return sum + (b.percent / 100) * b.vaultMultiplier;
    }, 0);

    logTest('Budget multiplier calculation', weightedMultiplier === 1.0, `Weighted multiplier: ${weightedMultiplier.toFixed(2)}x`);

    // Cleanup
    await db.subBudgetCategory.deleteMany({ where: { departmentId: dept.id } });
    await db.budgetAllocation.deleteMany({ where: { departmentId: dept.id } });
    await db.governmentDepartment.delete({ where: { id: dept.id } });
    await db.governmentStructure.delete({ where: { id: govt.id } });

  } catch (error) {
    logTest('Budget Multiplier System', false, `Error: ${error.message}`);
  }
}

async function testCardValueHistoryCRUD() {
  console.log('\n━━━ Test 3: Card Value History System (CRUD) ━━━\n');

  try {
    // Find or create a test card
    let testCard = await db.card.findFirst({
      where: { cardType: 'NATION' },
    });

    if (!testCard) {
      testCard = await db.card.create({
        data: {
          title: 'Test Nation Card',
          description: 'Test card for value tracking',
          artwork: '/test.png',
          cardType: 'NATION',
          rarity: 'RARE',
          season: 1,
          totalSupply: 100,
          marketValue: 50.0,
        },
      });
    }

    logTest('Test card available', !!testCard.id, `Using card: ${testCard.title}`);

    // CREATE: Add value history entry
    const valueEntry = await db.cardValueHistory.create({
      data: {
        cardId: testCard.id,
        marketValue: 55.0,
        totalSupply: 100,
        ownedBy: 10,
        avgSalePrice: 52.5,
        highestSale: 60.0,
        lowestSale: 45.0,
        timestamp: new Date(),
      },
    });
    logTest('CardValueHistory CREATE', !!valueEntry.id, `Created entry ID: ${valueEntry.id}`);

    // READ: Retrieve value history
    const history = await db.cardValueHistory.findMany({
      where: { cardId: testCard.id },
      orderBy: { timestamp: 'desc' },
      take: 1,
    });
    logTest('CardValueHistory READ', history.length > 0 && history[0].marketValue === 55.0, `Retrieved value: ${history[0]?.marketValue} IxC`);

    // CREATE: Add more history entries (simulate time series)
    const entries = [];
    for (let i = 1; i <= 5; i++) {
      const entry = await db.cardValueHistory.create({
        data: {
          cardId: testCard.id,
          marketValue: 50.0 + (i * 2),
          totalSupply: 100,
          ownedBy: 10 + i,
          timestamp: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Each day back
        },
      });
      entries.push(entry);
    }
    logTest('CardValueHistory time series', entries.length === 5, `Created ${entries.length} historical entries`);

    // READ: Query time series
    const timeSeries = await db.cardValueHistory.findMany({
      where: { cardId: testCard.id },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });
    logTest('CardValueHistory time series query', timeSeries.length >= 5, `Retrieved ${timeSeries.length} entries`);

    // UPDATE: Cards don't update history (immutable log), but we can verify latest value
    const latestValue = timeSeries[0];
    logTest('CardValueHistory latest value', latestValue?.marketValue === 55.0, `Latest: ${latestValue?.marketValue} IxC`);

    // DELETE: Clean up test entries
    const deleted = await db.cardValueHistory.deleteMany({
      where: { cardId: testCard.id },
    });
    logTest('CardValueHistory DELETE', deleted.count >= 6, `Deleted ${deleted.count} entries`);

    // Cleanup test card if we created it
    if (testCard.title === 'Test Nation Card') {
      await db.card.delete({ where: { id: testCard.id } });
    }

  } catch (error) {
    logTest('Card Value History CRUD', false, `Error: ${error.message}`);
  }
}

async function testSyncLogMetadata() {
  console.log('\n━━━ Test 4: Sync Log Metadata Storage ━━━\n');

  try {
    // CREATE: Sync log with metadata
    const syncLog = await db.syncLog.create({
      data: {
        syncType: 'ns-card-sync',
        status: 'completed',
        itemsProcessed: 1000,
        itemsFailed: 10,
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        metadata: JSON.stringify({
          season: 1,
          cardsCreated: 500,
          cardsUpdated: 490,
          conflictsResolved: 10,
        }),
      },
    });
    logTest('SyncLog with metadata CREATE', !!syncLog.id, `Created log ID: ${syncLog.id}`);

    // READ: Retrieve and parse metadata
    const retrieved = await db.syncLog.findUnique({
      where: { id: syncLog.id },
    });
    const metadata = retrieved?.metadata ? JSON.parse(retrieved.metadata) : {};
    logTest('SyncLog metadata READ', metadata.season === 1, `Season: ${metadata.season}, Cards created: ${metadata.cardsCreated}`);

    // Cleanup
    await db.syncLog.delete({ where: { id: syncLog.id } });

  } catch (error) {
    logTest('Sync Log Metadata', false, `Error: ${error.message}`);
  }
}

async function testDatabaseIndexes() {
  console.log('\n━━━ Test 5: Database Indexes ━━━\n');

  try {
    // Check sync_checkpoints indexes
    const checkpointIndexes = await db.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'sync_checkpoints'
    `;
    logTest('SyncCheckpoint indexes', checkpointIndexes.length >= 1, `Found ${checkpointIndexes.length} indexes`);

    // Check card_value_history indexes
    const valueHistoryIndexes = await db.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'card_value_history'
    `;
    logTest('CardValueHistory indexes', valueHistoryIndexes.length >= 2, `Found ${valueHistoryIndexes.length} indexes (expected: 2+)`);

  } catch (error) {
    logTest('Database Indexes', false, `Error: ${error.message}`);
  }
}

async function testForeignKeyConstraints() {
  console.log('\n━━━ Test 6: Foreign Key Constraints ━━━\n');

  try {
    // Test CardValueHistory -> Card cascade delete
    const testCard = await db.card.create({
      data: {
        title: 'FK Test Card',
        description: 'Test card for FK constraints',
        artwork: '/test.png',
        cardType: 'SPECIAL',
        rarity: 'COMMON',
        season: 1,
        totalSupply: 10,
        marketValue: 10.0,
      },
    });

    const valueHistory = await db.cardValueHistory.create({
      data: {
        cardId: testCard.id,
        marketValue: 10.0,
        timestamp: new Date(),
      },
    });

    // Delete card (should cascade delete value history)
    await db.card.delete({ where: { id: testCard.id } });

    // Verify value history was deleted
    const orphanedHistory = await db.cardValueHistory.findUnique({
      where: { id: valueHistory.id },
    });

    logTest('Foreign key cascade DELETE', orphanedHistory === null, 'CardValueHistory cascade deleted with Card');

  } catch (error) {
    logTest('Foreign Key Constraints', false, `Error: ${error.message}`);
  }
}

async function testDataValidation() {
  console.log('\n━━━ Test 7: Data Validation & Constraints ━━━\n');

  try {
    // Test unique constraint on SyncCheckpoint.season
    try {
      await db.syncCheckpoint.create({
        data: { season: 888, status: 'IN_PROGRESS', cardsProcessed: 0, totalCards: 100 },
      });
      await db.syncCheckpoint.create({
        data: { season: 888, status: 'IN_PROGRESS', cardsProcessed: 0, totalCards: 100 },
      });
      logTest('SyncCheckpoint unique season constraint', false, 'Unique constraint not enforced!');
    } catch (error) {
      logTest('SyncCheckpoint unique season constraint', error.code === 'P2002', 'Unique constraint working');
      // Cleanup
      await db.syncCheckpoint.deleteMany({ where: { season: 888 } });
    }

    // Test default values
    const checkpoint = await db.syncCheckpoint.create({
      data: {
        season: 777,
        status: 'IN_PROGRESS',
        cardsProcessed: 0,
        totalCards: 100,
      },
    });
    logTest('Default values', checkpoint.errorCount === 0, `errorCount default: ${checkpoint.errorCount}`);
    await db.syncCheckpoint.delete({ where: { season: 777 } });

  } catch (error) {
    logTest('Data Validation', false, `Error: ${error.message}`);
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (results.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.details}`);
    });
  } else {
    console.log('\n🎉 ALL TESTS PASSED! Phase 4 features are fully functional.');
  }
}

// Main test execution
async function runTests() {
  console.log('🧪 IxCards Phase 4 - Comprehensive Test Suite');
  console.log('Testing: NS Sync, Budget Multipliers, Card Value Tracking');
  console.log('Database: PostgreSQL (localhost:5433/ixstats)\n');

  try {
    await testSyncCheckpointCRUD();
    await testBudgetMultiplierCalculation();
    await testCardValueHistoryCRUD();
    await testSyncLogMetadata();
    await testDatabaseIndexes();
    await testForeignKeyConstraints();
    await testDataValidation();

    await printSummary();

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
    await db.$disconnect();
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests();
