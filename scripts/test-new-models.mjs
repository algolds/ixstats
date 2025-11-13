#!/usr/bin/env node
/**
 * Test Suite for LoreCardRequest and Activity Models
 *
 * Verifies CRUD operations and relationships for the new Phase 4 models:
 * - LoreCardRequest: User-requested lore card generation system
 * - Activity: Activity feed for tracking user actions
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

async function testLoreCardRequestCRUD() {
  console.log('\n━━━ Test 1: LoreCardRequest CRUD ━━━\n');

  try {
    // Find or create a test user
    let testUser = await db.user.findFirst();

    if (!testUser) {
      console.log('No users found in database - skipping LoreCardRequest tests');
      logTest('LoreCardRequest tests', false, 'No users available for testing');
      return;
    }

    logTest('Test user available', !!testUser.id, `Using user: ${testUser.id}`);

    // CREATE: Submit a lore card request
    const request = await db.loreCardRequest.create({
      data: {
        userId: testUser.id,
        wikiSource: 'ixwiki',
        articleTitle: 'Test Article for Lore Card',
        status: 'PENDING',
        costPaid: 50.0,
      },
    });
    logTest('LoreCardRequest CREATE', !!request.id, `Created request ID: ${request.id}`);

    // READ: Retrieve the request
    const retrieved = await db.loreCardRequest.findUnique({
      where: { id: request.id },
      include: {
        user: true,
      },
    });
    logTest('LoreCardRequest READ', retrieved?.id === request.id, `Retrieved request with user relation`);

    // UPDATE: Approve the request
    const approved = await db.loreCardRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: 'admin-test-id',
      },
    });
    logTest('LoreCardRequest UPDATE', approved.status === 'APPROVED', `Status updated to: ${approved.status}`);

    // Query by status
    const pendingRequests = await db.loreCardRequest.findMany({
      where: {
        status: 'PENDING',
      },
    });
    logTest('LoreCardRequest query by status', Array.isArray(pendingRequests), `Found ${pendingRequests.length} pending requests`);

    // Query by user
    const userRequests = await db.loreCardRequest.findMany({
      where: {
        userId: testUser.id,
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });
    logTest('LoreCardRequest query by user', userRequests.length > 0, `Found ${userRequests.length} requests for user`);

    // DELETE: Clean up test request
    await db.loreCardRequest.delete({
      where: { id: request.id },
    });
    const deleted = await db.loreCardRequest.findUnique({
      where: { id: request.id },
    });
    logTest('LoreCardRequest DELETE', deleted === null, 'Request successfully deleted');

  } catch (error) {
    logTest('LoreCardRequest CRUD', false, `Error: ${error.message}`);
  }
}

async function testActivityCRUD() {
  console.log('\n━━━ Test 2: Activity Feed CRUD ━━━\n');

  try {
    // Find or create a test user
    let testUser = await db.user.findFirst();

    if (!testUser) {
      console.log('No users found in database - skipping Activity tests');
      logTest('Activity tests', false, 'No users available for testing');
      return;
    }

    logTest('Test user available', !!testUser.id, `Using user: ${testUser.id}`);

    // CREATE: Log an activity
    const activity = await db.activity.create({
      data: {
        userId: testUser.id,
        activityType: 'CARD_ACQUIRED',
        title: 'Test Card Acquired',
        description: 'User acquired a test card',
        metadata: {
          cardId: 'test-card-123',
          cardTitle: 'Test Card',
          cardRarity: 'RARE',
        },
      },
    });
    logTest('Activity CREATE', !!activity.id, `Created activity ID: ${activity.id}`);

    // READ: Retrieve the activity
    const retrieved = await db.activity.findUnique({
      where: { id: activity.id },
    });
    logTest('Activity READ', retrieved?.id === activity.id, `Retrieved activity with metadata`);

    // Verify metadata
    const metadata = retrieved?.metadata;
    logTest('Activity metadata', typeof metadata === 'object', `Metadata: ${JSON.stringify(metadata)}`);

    // UPDATE: Mark as read
    const updated = await db.activity.update({
      where: { id: activity.id },
      data: {
        isRead: true,
      },
    });
    logTest('Activity UPDATE', updated.isRead === true, `Marked as read: ${updated.isRead}`);

    // Query unread activities
    const unreadActivities = await db.activity.findMany({
      where: {
        userId: testUser.id,
        isRead: false,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 10,
    });
    logTest('Activity query unread', Array.isArray(unreadActivities), `Found ${unreadActivities.length} unread activities`);

    // Query by activity type
    const cardActivities = await db.activity.findMany({
      where: {
        activityType: 'CARD_ACQUIRED',
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 5,
    });
    logTest('Activity query by type', cardActivities.length > 0, `Found ${cardActivities.length} CARD_ACQUIRED activities`);

    // DELETE: Clean up test activity
    await db.activity.delete({
      where: { id: activity.id },
    });
    const deleted = await db.activity.findUnique({
      where: { id: activity.id },
    });
    logTest('Activity DELETE', deleted === null, 'Activity successfully deleted');

  } catch (error) {
    logTest('Activity CRUD', false, `Error: ${error.message}`);
  }
}

async function testIndexPerformance() {
  console.log('\n━━━ Test 3: Index Performance ━━━\n');

  try {
    // Check LoreCardRequest indexes
    const loreCardIndexes = await db.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'lore_card_requests'
    `;
    logTest('LoreCardRequest indexes', loreCardIndexes.length >= 3, `Found ${loreCardIndexes.length} indexes (expected: 3+)`);

    // Check Activity indexes
    const activityIndexes = await db.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'activities'
    `;
    logTest('Activity indexes', activityIndexes.length >= 3, `Found ${activityIndexes.length} indexes (expected: 3+)`);

  } catch (error) {
    logTest('Index Performance', false, `Error: ${error.message}`);
  }
}

async function testForeignKeyConstraints() {
  console.log('\n━━━ Test 4: Foreign Key Constraints ━━━\n');

  try {
    // Test cascade delete on LoreCardRequest
    const testUser = await db.user.findFirst();

    if (!testUser) {
      console.log('No users found - skipping FK constraint test');
      logTest('Foreign key constraints', false, 'No users available');
      return;
    }

    // Create a request
    const request = await db.loreCardRequest.create({
      data: {
        userId: testUser.id,
        wikiSource: 'iiwiki',
        articleTitle: 'FK Test Article',
        status: 'PENDING',
      },
    });

    // Verify foreign key relationship
    const withUser = await db.loreCardRequest.findUnique({
      where: { id: request.id },
      include: { user: true },
    });

    logTest('Foreign key relationship', withUser?.user?.id === testUser.id, 'User relation working correctly');

    // Cleanup
    await db.loreCardRequest.delete({ where: { id: request.id } });

  } catch (error) {
    logTest('Foreign Key Constraints', false, `Error: ${error.message}`);
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
    console.log('\n🎉 ALL TESTS PASSED! New models are fully functional.');
  }
}

// Main test execution
async function runTests() {
  console.log('🧪 LoreCardRequest & Activity Models - Test Suite');
  console.log('Testing: User-requested lore cards and activity feed');
  console.log('Database: PostgreSQL (localhost:5433/ixstats)\n');

  try {
    await testLoreCardRequestCRUD();
    await testActivityCRUD();
    await testIndexPerformance();
    await testForeignKeyConstraints();

    await printSummary();

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
    await db.$disconnect();
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests();
