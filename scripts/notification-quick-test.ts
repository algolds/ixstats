#!/usr/bin/env tsx
/**
 * Quick Notification Test
 * Rapid testing of notification creation and delivery
 *
 * Usage: npx tsx scripts/notification-quick-test.ts
 */

import { notificationAPI } from "~/lib/notification-api";
import { notificationHooks } from "~/lib/notification-hooks";
import { db } from "~/server/db";

async function quickTest() {
  console.log("🚀 Quick Notification Test\n");

  // Test 1: Simple notification
  console.log("1️⃣  Creating simple notification...");
  const id1 = await notificationAPI.create({
    title: "Test Notification",
    message: "This is a test notification from quick test script",
    category: "system",
    priority: "medium",
    userId: "test-user",
  });
  console.log(`   ✅ Created: ${id1}\n`);

  // Test 2: Economic alert
  console.log("2️⃣  Creating economic alert...");
  const id2 = await notificationAPI.notifyEconomicChange({
    metric: "GDP",
    value: 5500000000,
    previousValue: 5000000000,
    countryId: "test-country",
    threshold: 5,
  });
  console.log(`   ✅ Created: ${id2}\n`);

  // Test 3: ThinkPage notification
  console.log("3️⃣  Creating ThinkPage notification...");
  const id3 = await notificationAPI.notifyThinkPageActivity({
    thinkpageId: "test-page",
    title: "Economic Analysis Q4 2025",
    action: "commented",
    authorId: "user-commenter",
    targetUserId: "user-author",
  });
  console.log(`   ✅ Created: ${id3}\n`);

  // Test 4: Critical crisis
  console.log("4️⃣  Creating critical crisis alert...");
  const id4 = await notificationAPI.trigger({
    crisis: {
      type: "Economic Emergency",
      severity: "critical",
      countryId: "test-country",
      description: "GDP collapsed by 30% - immediate action required",
    },
  });
  console.log(`   ✅ Created: ${id4}\n`);

  // Test 5: Achievement unlock
  console.log("5️⃣  Creating achievement notification...");
  await notificationHooks.onAchievementUnlock({
    userId: "test-user",
    achievementId: "economic-titan",
    name: "Economic Titan",
    description: "Reached 1 trillion GDP",
    category: "economic",
    rarity: "legendary",
  });
  console.log(`   ✅ Created\n`);

  // Query results
  console.log("📊 Querying created notifications...");
  const notifications = await db.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log(`   Found ${notifications.length} recent notifications:\n`);
  notifications.forEach((n, i) => {
    console.log(`   ${i + 1}. [${n.priority.toUpperCase()}] ${n.title}`);
    console.log(`      Category: ${n.category || "none"} | Read: ${n.read}`);
    console.log(`      Created: ${n.createdAt.toISOString()}\n`);
  });

  // Check unread count
  const unreadCount = await db.notification.count({
    where: { read: false, dismissed: false },
  });
  console.log(`🔔 Total unread notifications: ${unreadCount}`);

  console.log("\n✅ Quick test completed!");
  console.log("\n💡 Tips:");
  console.log("   - Check notification center UI to see these notifications");
  console.log("   - Page title should show badge: (N) IxStats");
  console.log("   - Run full audit: npx tsx scripts/audit/test-notifications.ts");
}

quickTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
