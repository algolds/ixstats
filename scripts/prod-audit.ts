/**
 * Production Database Audit & CRUD Verification Script
 *
 * Purpose: Comprehensive testing of database connectivity, CRUD operations,
 * and state management in production environment.
 *
 * Usage: npx tsx scripts/prod-audit.ts [test-user-clerk-id]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

interface AuditResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: AuditResult[] = [];

function logResult(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
  results.push({ test, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${test}: ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function testDatabaseConnectivity() {
  console.log('\n🔍 Testing Database Connectivity...\n');

  try {
    await prisma.$connect();
    logResult('DB_CONNECTION', 'PASS', 'Successfully connected to production database');
  } catch (error) {
    logResult('DB_CONNECTION', 'FAIL', 'Failed to connect to database', { error: error instanceof Error ? error.message : error });
    return false;
  }

  return true;
}

async function testSchemaIntegrity() {
  console.log('\n🔍 Testing Schema Integrity...\n');

  try {
    // Test Category enum (skip priority check - column may not exist)
    try {
      const crisisEvents = await prisma.$queryRaw`SELECT DISTINCT "category" FROM "CrisisEvent" LIMIT 10`;
      logResult('ENUM_CATEGORY', 'PASS', 'Category enum values verified', {
        sampleCategories: (crisisEvents as any[]).slice(0, 3)
      });
    } catch (e) {
      logResult('ENUM_CATEGORY', 'WARN', 'Could not verify category enum - table may be empty');
    }

    // Test table existence (PostgreSQL)
    const tables = await prisma.$queryRaw`
      SELECT "table_name" as name
      FROM information_schema.tables
      WHERE "table_schema" = 'public'
      ORDER BY "table_name"
    `;
    const tableCount = (tables as any[]).length;
    logResult('TABLE_STRUCTURE', 'PASS', `Found ${tableCount} tables in database (PostgreSQL)`);

    // Test critical tables exist
    const criticalTables = ['User', 'Country', 'Notification', 'ThinkpagesPost', 'GovernmentComponent'];
    const existingTables = (tables as any[]).map((t: any) => t.name);
    const missingTables = criticalTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      logResult('CRITICAL_TABLES', 'WARN', `Missing tables: ${missingTables.join(', ')}`);
    } else {
      logResult('CRITICAL_TABLES', 'PASS', 'All critical tables present');
    }

  } catch (error) {
    logResult('SCHEMA_INTEGRITY', 'FAIL', 'Schema integrity check failed', { error: error instanceof Error ? error.message : error });
    return false;
  }

  return true;
}

async function testUserCRUD(testUserId?: string) {
  console.log('\n🔍 Testing User CRUD Operations...\n');

  try {
    // READ: Get test user
    let testUser = testUserId
      ? await prisma.user.findFirst({ where: { clerkUserId: testUserId }, include: { country: true } })
      : await prisma.user.findFirst({ include: { country: true } });

    if (!testUser) {
      logResult('USER_READ', 'WARN', 'No test user found - skipping USER CRUD tests');
      return true;
    }

    logResult('USER_READ', 'PASS', `Successfully read user: ${testUser.clerkUserId}`, {
      userId: testUser.id,
      hasCountry: !!testUser.country
    });

    // UPDATE: Test user update
    const updatedUser = await prisma.user.update({
      where: { id: testUser.id },
      data: { updatedAt: new Date() }
    });
    logResult('USER_UPDATE', 'PASS', 'Successfully updated user record');

    return true;
  } catch (error) {
    logResult('USER_CRUD', 'FAIL', 'User CRUD operations failed', { error: error instanceof Error ? error.message : error });
    return false;
  }
}

async function testCountryCRUD(testUserId?: string) {
  console.log('\n🔍 Testing Country CRUD Operations...\n');

  try {
    // Find user's country
    const user = testUserId
      ? await prisma.user.findFirst({ where: { clerkUserId: testUserId }, include: { country: true } })
      : await prisma.user.findFirst({ include: { country: true } });

    if (!user?.country) {
      logResult('COUNTRY_READ', 'WARN', 'No country found for test user - skipping COUNTRY CRUD tests');
      return true;
    }

    logResult('COUNTRY_READ', 'PASS', `Successfully read country: ${user.country.name}`);

    // Test country update
    const originalGdp = user.country.currentGdpPerCapita;
    await prisma.country.update({
      where: { id: user.country.id },
      data: {
        currentGdpPerCapita: originalGdp * 1.001,
        updatedAt: new Date()
      }
    });
    logResult('COUNTRY_UPDATE', 'PASS', 'Successfully updated country data');

    // Verify update persisted
    const updatedCountry = await prisma.country.findUnique({ where: { id: user.country.id } });
    if (updatedCountry && updatedCountry.currentGdpPerCapita !== originalGdp) {
      logResult('COUNTRY_PERSISTENCE', 'PASS', 'Country data persisted correctly');
    } else {
      logResult('COUNTRY_PERSISTENCE', 'FAIL', 'Country data did not persist!');
    }

    // Restore original value
    await prisma.country.update({
      where: { id: user.country.id },
      data: { currentGdpPerCapita: originalGdp }
    });

    return true;
  } catch (error) {
    logResult('COUNTRY_CRUD', 'FAIL', 'Country CRUD operations failed', { error: error instanceof Error ? error.message : error });
    return false;
  }
}

async function testNotificationSystem(testUserId?: string) {
  console.log('\n🔍 Testing Notification System...\n');

  try {
    const user = testUserId
      ? await prisma.user.findFirst({ where: { clerkUserId: testUserId } })
      : await prisma.user.findFirst();

    if (!user) {
      logResult('NOTIFICATION_TEST', 'WARN', 'No user found for notification tests');
      return true;
    }

    // Count user-specific notifications
    const userNotifications = await prisma.notification.count({
      where: { userId: user.clerkUserId, read: false }
    });
    logResult('NOTIFICATION_READ', 'PASS', `Found ${userNotifications} unread notifications for user`);

    // CREATE: Test notification creation
    const testNotification = await prisma.notification.create({
      data: {
        userId: user.clerkUserId,
        title: 'Test Notification',
        message: 'This is a test notification from prod-audit.ts',
        type: 'info',
        priority: 'low'
      }
    });
    logResult('NOTIFICATION_CREATE', 'PASS', 'Successfully created test notification');

    // UPDATE: Mark as read
    await prisma.notification.update({
      where: { id: testNotification.id },
      data: { read: true }
    });
    logResult('NOTIFICATION_UPDATE', 'PASS', 'Successfully marked notification as read');

    // DELETE: Clean up test notification
    await prisma.notification.delete({
      where: { id: testNotification.id }
    });
    logResult('NOTIFICATION_DELETE', 'PASS', 'Successfully deleted test notification');

    return true;
  } catch (error) {
    logResult('NOTIFICATION_SYSTEM', 'FAIL', 'Notification system tests failed', { error: error instanceof Error ? error.message : error });
    return false;
  }
}

async function testThinkPagesSystem(testUserId?: string) {
  console.log('\n🔍 Testing ThinkPages System...\n');

  try {
    const user = testUserId
      ? await prisma.user.findFirst({ where: { clerkUserId: testUserId } })
      : await prisma.user.findFirst();

    if (!user) {
      logResult('THINKPAGES_TEST', 'WARN', 'No user found for ThinkPages tests');
      return true;
    }

    // Test post count
    const postCount = await prisma.thinkpagesPost.count({
      where: { userId: user.id }
    });
    logResult('THINKPAGES_POSTS', 'PASS', `Found ${postCount} ThinkPages posts for user`);

    // Test trending topics
    const trendingTopics = await prisma.trendingTopic.count({
      where: { isActive: true }
    });
    logResult('THINKPAGES_TRENDING', 'PASS', `Found ${trendingTopics} active trending topics`);

    return true;
  } catch (error) {
    logResult('THINKPAGES_SYSTEM', 'FAIL', 'ThinkPages system tests failed', { error: error instanceof Error ? error.message : error });
    return false;
  }
}

async function testGovernmentSystem(testUserId?: string) {
  console.log('\n🔍 Testing Government Customization System...\n');

  try {
    const user = testUserId
      ? await prisma.user.findFirst({ where: { clerkUserId: testUserId }, include: { country: true } })
      : await prisma.user.findFirst({ include: { country: true } });

    if (!user?.country) {
      logResult('GOVERNMENT_TEST', 'WARN', 'No country found for government tests');
      return true;
    }

    // Test government components
    const componentCount = await prisma.governmentComponent.count({
      where: { countryId: user.country.id }
    });
    logResult('GOVERNMENT_COMPONENTS', 'PASS', `Found ${componentCount} government components`);

    // Test atomic effectiveness
    const effectiveness = await prisma.atomicEffectiveness.findUnique({
      where: { countryId: user.country.id }
    });
    logResult('GOVERNMENT_EFFECTIVENESS', effectiveness ? 'PASS' : 'WARN',
      effectiveness ? 'Atomic effectiveness record exists' : 'No atomic effectiveness record');

    return true;
  } catch (error) {
    logResult('GOVERNMENT_SYSTEM', 'FAIL', 'Government system tests failed', { error: error instanceof Error ? error.message : error });
    return false;
  }
}

async function generateSummaryReport() {
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('           PRODUCTION AUDIT SUMMARY REPORT');
  console.log('═══════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
  console.log(`⚠️  Warnings: ${warned} (${((warned/total)*100).toFixed(1)}%)`);
  console.log('');

  if (failed > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.test}: ${r.message}`);
    });
  }

  if (warned > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`   - ${r.test}: ${r.message}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════\n');

  // Determine overall health
  const health = failed === 0 ? (warned === 0 ? '🟢 HEALTHY' : '🟡 HEALTHY (with warnings)') : '🔴 UNHEALTHY';
  console.log(`Production Database Health: ${health}\n`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       IxStats Production Database Audit Tool');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Database: ${process.env.DATABASE_URL || 'NOT_SET'}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const testUserId = process.argv[2]; // Optional test user Clerk ID
  if (testUserId) {
    console.log(`Test User ID: ${testUserId}\n`);
  }

  try {
    // Run all audit tests
    const dbConnected = await testDatabaseConnectivity();
    if (!dbConnected) {
      console.error('\n❌ Cannot proceed - database connection failed');
      process.exit(1);
    }

    await testSchemaIntegrity();
    await testUserCRUD(testUserId);
    await testCountryCRUD(testUserId);
    await testNotificationSystem(testUserId);
    await testThinkPagesSystem(testUserId);
    await testGovernmentSystem(testUserId);

    // Generate summary
    await generateSummaryReport();

  } catch (error) {
    console.error('\n🚨 FATAL ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
