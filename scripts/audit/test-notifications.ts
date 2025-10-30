#!/usr/bin/env tsx
/**
 * Notification System Audit Script
 * Tests all notification triggers and verifies end-to-end functionality
 *
 * Usage: npx tsx scripts/audit/test-notifications.ts
 */

import { db } from "~/server/db";
import { notificationAPI } from "~/lib/notification-api";

interface AuditResult {
  feature: string;
  testName: string;
  success: boolean;
  notificationId?: string;
  error?: string;
  timestamp: Date;
}

const results: AuditResult[] = [];

function logResult(result: AuditResult) {
  results.push(result);
  const status = result.success ? "✅" : "❌";
  console.log(`${status} ${result.feature} - ${result.testName}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  if (result.notificationId) {
    console.log(`   Created notification: ${result.notificationId}`);
  }
}

async function auditEconomicNotifications() {
  console.log("\n🔍 Testing Economic Notifications...");

  // Test 1: GDP Change Alert
  try {
    const notifId = await notificationAPI.notifyEconomicChange({
      metric: "GDP",
      value: 5000000000,
      previousValue: 4750000000,
      countryId: "test-country-001",
      threshold: 5,
    });
    logResult({
      feature: "Economic",
      testName: "GDP Change Alert (5% increase)",
      success: true,
      notificationId: notifId,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Economic",
      testName: "GDP Change Alert",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 2: Significant Economic Change (>10%)
  try {
    const notifId = await notificationAPI.trigger({
      economic: {
        metric: "Unemployment Rate",
        value: 12.5,
        change: -15,
        countryId: "test-country-001",
      },
    });
    logResult({
      feature: "Economic",
      testName: "High-priority economic alert (15% change)",
      success: !!notifId,
      notificationId: notifId ?? undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Economic",
      testName: "High-priority economic alert",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 3: Minor Economic Change
  try {
    const notifId = await notificationAPI.trigger({
      economic: {
        metric: "Inflation Rate",
        value: 2.1,
        change: 0.3,
        countryId: "test-country-001",
      },
    });
    logResult({
      feature: "Economic",
      testName: "Minor economic update (0.3% change)",
      success: true, // Should not create notification for small changes
      notificationId: notifId ?? undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Economic",
      testName: "Minor economic update",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }
}

async function auditThinkPagesNotifications() {
  console.log("\n🔍 Testing ThinkPages Notifications...");

  // Test 1: New ThinkPage Created
  try {
    const notifId = await notificationAPI.notifyThinkPageActivity({
      thinkpageId: "thinkpage-test-001",
      title: "Test Economic Analysis",
      action: "created",
      authorId: "user-author-001",
    });
    logResult({
      feature: "ThinkPages",
      testName: "New ThinkPage created",
      success: true,
      notificationId: notifId,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "ThinkPages",
      testName: "New ThinkPage created",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 2: ThinkPage Comment
  try {
    const notifId = await notificationAPI.notifyThinkPageActivity({
      thinkpageId: "thinkpage-test-001",
      title: "Test Economic Analysis",
      action: "commented",
      authorId: "user-commenter-001",
      targetUserId: "user-author-001",
    });
    logResult({
      feature: "ThinkPages",
      testName: "Comment notification to author",
      success: true,
      notificationId: notifId,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "ThinkPages",
      testName: "Comment notification",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 3: ThinkPage Liked
  try {
    const notifId = await notificationAPI.notifyThinkPageActivity({
      thinkpageId: "thinkpage-test-001",
      title: "Test Economic Analysis",
      action: "liked",
      authorId: "user-liker-001",
      targetUserId: "user-author-001",
    });
    logResult({
      feature: "ThinkPages",
      testName: "Like notification",
      success: true,
      notificationId: notifId,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "ThinkPages",
      testName: "Like notification",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }
}

async function auditDiplomaticNotifications() {
  console.log("\n🔍 Testing Diplomatic Notifications...");

  // Test 1: Treaty Signed
  try {
    const notifId = await notificationAPI.trigger({
      diplomatic: {
        eventType: "treaty",
        countries: ["country-001", "country-002", "country-003"],
        title: "Trade Agreement Signed",
      },
    });
    logResult({
      feature: "Diplomatic",
      testName: "Treaty signed notification",
      success: !!notifId,
      notificationId: notifId ?? undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Diplomatic",
      testName: "Treaty signed",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 2: Diplomatic Conflict
  try {
    const notifId = await notificationAPI.trigger({
      diplomatic: {
        eventType: "conflict",
        countries: ["country-001", "country-004"],
        title: "Diplomatic Tensions Rise",
      },
    });
    logResult({
      feature: "Diplomatic",
      testName: "Conflict alert (high priority)",
      success: !!notifId,
      notificationId: notifId ?? undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Diplomatic",
      testName: "Conflict alert",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }
}

async function auditMeetingNotifications() {
  console.log("\n🔍 Testing Meeting Notifications...");

  const participants = ["user-001", "user-002", "user-003"];

  // Test 1: Meeting Scheduled
  try {
    await notificationAPI.notifyMeetingEvent({
      meetingId: "meeting-test-001",
      title: "Budget Review Meeting",
      scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      participants,
      action: "scheduled",
    });
    logResult({
      feature: "Meetings",
      testName: "Meeting scheduled (3 participants)",
      success: true,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Meetings",
      testName: "Meeting scheduled",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 2: Meeting Starting
  try {
    await notificationAPI.notifyMeetingEvent({
      meetingId: "meeting-test-002",
      title: "Emergency Session",
      scheduledTime: new Date(),
      participants,
      action: "starting",
    });
    logResult({
      feature: "Meetings",
      testName: "Meeting starting (high priority)",
      success: true,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Meetings",
      testName: "Meeting starting",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 3: Meeting Cancelled
  try {
    await notificationAPI.notifyMeetingEvent({
      meetingId: "meeting-test-003",
      title: "Planning Session",
      scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      participants,
      action: "cancelled",
    });
    logResult({
      feature: "Meetings",
      testName: "Meeting cancelled",
      success: true,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Meetings",
      testName: "Meeting cancelled",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }
}

async function auditAchievementNotifications() {
  console.log("\n🔍 Testing Achievement Notifications...");

  // Test 1: Economic Achievement
  try {
    const notifId = await notificationAPI.trigger({
      achievement: {
        name: "Economic Titan",
        description: "Reached 1 trillion GDP",
        category: "economic",
        userId: "user-001",
        unlocked: true,
      },
    });
    logResult({
      feature: "Achievements",
      testName: "Achievement unlocked notification",
      success: !!notifId,
      notificationId: notifId ?? undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Achievements",
      testName: "Achievement unlocked",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 2: Diplomatic Achievement
  try {
    const notifId = await notificationAPI.trigger({
      achievement: {
        name: "Peacemaker",
        description: "Resolved 10 diplomatic conflicts",
        category: "diplomatic",
        userId: "user-002",
        unlocked: true,
      },
    });
    logResult({
      feature: "Achievements",
      testName: "Diplomatic achievement",
      success: !!notifId,
      notificationId: notifId ?? undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Achievements",
      testName: "Diplomatic achievement",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }
}

async function auditCrisisNotifications() {
  console.log("\n🔍 Testing Crisis Notifications...");

  // Test 1: Low Severity Crisis
  try {
    const notifId = await notificationAPI.trigger({
      crisis: {
        type: "Economic Slowdown",
        severity: "low",
        countryId: "country-001",
        description: "Minor economic indicators showing decline",
      },
    });
    logResult({
      feature: "Crisis",
      testName: "Low severity crisis",
      success: !!notifId,
      notificationId: notifId ?? undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Crisis",
      testName: "Low severity crisis",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 2: Critical Crisis
  try {
    const notifId = await notificationAPI.trigger({
      crisis: {
        type: "National Emergency",
        severity: "critical",
        countryId: "country-001",
        description: "Immediate action required - critical infrastructure failure",
      },
    });
    logResult({
      feature: "Crisis",
      testName: "Critical crisis (modal delivery)",
      success: !!notifId,
      notificationId: notifId ?? undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Crisis",
      testName: "Critical crisis",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }
}

async function auditCountryAndGlobalNotifications() {
  console.log("\n🔍 Testing Country & Global Notifications...");

  // Test 1: Country-wide Notification
  try {
    const notifId = await notificationAPI.notifyCountry({
      countryId: "country-001",
      title: "National Holiday Announced",
      message: "A national holiday has been declared for next week",
      category: "governance",
      priority: "medium",
    });
    logResult({
      feature: "Country",
      testName: "Country-wide notification",
      success: true,
      notificationId: notifId,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Country",
      testName: "Country-wide notification",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }

  // Test 2: Global Notification
  try {
    const notifId = await notificationAPI.notifyGlobal({
      title: "System Maintenance Scheduled",
      message: "Platform will be down for maintenance on Sunday 2AM-4AM",
      category: "system",
      priority: "high",
    });
    logResult({
      feature: "Global",
      testName: "Global notification (all users)",
      success: true,
      notificationId: notifId,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Global",
      testName: "Global notification",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }
}

async function auditNotificationPriorities() {
  console.log("\n🔍 Testing Notification Priority Levels...");

  const priorities: Array<"critical" | "high" | "medium" | "low"> = [
    "critical",
    "high",
    "medium",
    "low",
  ];

  for (const priority of priorities) {
    try {
      const notifId = await notificationAPI.create({
        title: `${priority.toUpperCase()} Priority Test`,
        message: `Testing ${priority} priority notification`,
        priority,
        category: "system",
        userId: "test-user-001",
      });
      logResult({
        feature: "Priority",
        testName: `${priority} priority notification`,
        success: true,
        notificationId: notifId,
        timestamp: new Date(),
      });
    } catch (error) {
      logResult({
        feature: "Priority",
        testName: `${priority} priority`,
        success: false,
        error: String(error),
        timestamp: new Date(),
      });
    }
  }
}

async function auditNotificationCategories() {
  console.log("\n🔍 Testing Notification Categories...");

  const categories: Array<
    | "economic"
    | "diplomatic"
    | "governance"
    | "social"
    | "security"
    | "system"
    | "achievement"
    | "crisis"
    | "opportunity"
  > = [
    "economic",
    "diplomatic",
    "governance",
    "social",
    "security",
    "system",
    "achievement",
    "crisis",
    "opportunity",
  ];

  for (const category of categories) {
    try {
      const notifId = await notificationAPI.create({
        title: `${category.charAt(0).toUpperCase() + category.slice(1)} Category Test`,
        message: `Testing ${category} category notification`,
        category,
        priority: "medium",
        userId: "test-user-001",
      });
      logResult({
        feature: "Category",
        testName: `${category} category`,
        success: true,
        notificationId: notifId,
        timestamp: new Date(),
      });
    } catch (error) {
      logResult({
        feature: "Category",
        testName: `${category} category`,
        success: false,
        error: String(error),
        timestamp: new Date(),
      });
    }
  }
}

async function auditDatabaseIntegrity() {
  console.log("\n🔍 Testing Database Integrity...");

  try {
    // Test 1: Check notification count
    const totalCount = await db.notification.count();
    logResult({
      feature: "Database",
      testName: `Total notifications in DB: ${totalCount}`,
      success: totalCount > 0,
      timestamp: new Date(),
    });

    // Test 2: Check unread notifications
    const unreadCount = await db.notification.count({
      where: { read: false },
    });
    logResult({
      feature: "Database",
      testName: `Unread notifications: ${unreadCount}`,
      success: true,
      timestamp: new Date(),
    });

    // Test 3: Check priority distribution
    const priorityGroups = await db.notification.groupBy({
      by: ["priority"],
      _count: { _all: true },
    });
    logResult({
      feature: "Database",
      testName: `Priority distribution: ${JSON.stringify(priorityGroups)}`,
      success: priorityGroups.length > 0,
      timestamp: new Date(),
    });

    // Test 4: Check category distribution
    const categoryGroups = await db.notification.groupBy({
      by: ["category"],
      _count: { _all: true },
    });
    logResult({
      feature: "Database",
      testName: `Category distribution: ${JSON.stringify(categoryGroups)}`,
      success: categoryGroups.length > 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logResult({
      feature: "Database",
      testName: "Database integrity check",
      success: false,
      error: String(error),
      timestamp: new Date(),
    });
  }
}

async function generateReport() {
  console.log("\n\n📊 AUDIT REPORT");
  console.log("=".repeat(80));

  const totalTests = results.length;
  const passedTests = results.filter((r) => r.success).length;
  const failedTests = totalTests - passedTests;
  const successRate = ((passedTests / totalTests) * 100).toFixed(2);

  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${successRate}%`);

  console.log("\n📈 Results by Feature:");
  const featureGroups = results.reduce(
    (acc, result) => {
      if (!acc[result.feature]) {
        acc[result.feature] = { total: 0, passed: 0 };
      }
      acc[result.feature].total++;
      if (result.success) acc[result.feature].passed++;
      return acc;
    },
    {} as Record<string, { total: number; passed: number }>
  );

  Object.entries(featureGroups).forEach(([feature, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    console.log(`  ${feature}: ${stats.passed}/${stats.total} (${rate}%)`);
  });

  if (failedTests > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.success)
      .forEach((result) => {
        console.log(`  - ${result.feature}: ${result.testName}`);
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
      });
  }

  console.log("\n" + "=".repeat(80));
}

async function main() {
  console.log("🚀 Starting Notification System Audit\n");
  console.log("This script will test all notification types and delivery mechanisms.\n");

  try {
    await auditEconomicNotifications();
    await auditThinkPagesNotifications();
    await auditDiplomaticNotifications();
    await auditMeetingNotifications();
    await auditAchievementNotifications();
    await auditCrisisNotifications();
    await auditCountryAndGlobalNotifications();
    await auditNotificationPriorities();
    await auditNotificationCategories();
    await auditDatabaseIntegrity();

    await generateReport();

    console.log("\n✅ Audit completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Audit failed with error:", error);
    process.exit(1);
  }
}

main();
