#!/usr/bin/env tsx
/**
 * Migrate Social Platform Data from SQLite to PostgreSQL
 *
 * Migrates ThinkPages, ActivityFeed, and related social data
 */

import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";
import { join } from "path";

// Paths
const sqlitePath = join(process.cwd(), "prisma/backups/sqlite-legacy/prod.db.legacy-20251027");

// Create database connections
const sqlite = new Database(sqlitePath, { readonly: true });
const postgres = new PrismaClient({
  datasourceUrl: "postgresql://postgres:postgres@localhost:5433/ixstats",
});

// Known DateTime fields
const DATETIME_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "deletedAt",
  "publishedAt",
  "scheduledAt",
  "completedAt",
  "startedAt",
  "endedAt",
  "expiresAt",
  "lastSeenAt",
  "lastLoginAt",
  "lastActiveAt",
  "timestamp",
  "date",
  "dateTime",
  "ixTimeTimestamp",
  "joinedAt",
  "lastActivity",
  "lastReadAt",
  "sentAt",
]);

// Helper to convert SQLite data to PostgreSQL format
const prepareBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (Array.isArray(obj)) return obj.map(prepareBigInt);
  if (typeof obj === "object") {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert boolean fields (0/1 to true/false) - comprehensive check
      if (
        (value === 0 || value === 1) &&
        (key.startsWith("is") ||
          key.startsWith("has") ||
          key.startsWith("allow") ||
          key.startsWith("require") ||
          key.startsWith("can") ||
          key.startsWith("should") ||
          [
            "active",
            "published",
            "deleted",
            "verified",
            "trending",
            "pinned",
            "closed",
            "resolved",
            "urgent",
            "public",
            "private",
            "hidden",
            "approved",
            "featured",
            "sticky",
            "archived",
            "enabled",
            "disabled",
          ].includes(key))
      ) {
        newObj[key] = Boolean(value);
      }
      // Convert DateTime fields
      else if (DATETIME_FIELDS.has(key) && typeof value === "number" && value > 0) {
        newObj[key] = new Date(value);
      } else {
        newObj[key] = prepareBigInt(value);
      }
    }
    return newObj;
  }
  return obj;
};

async function migrateTable(tableName: string, createFn: (data: any) => Promise<any>) {
  console.log(`\n📦 Migrating ${tableName}...`);

  try {
    // Get data from SQLite
    const stmt = sqlite.prepare(`SELECT * FROM "${tableName}"`);
    const items = stmt.all();

    console.log(`  Found ${items.length} records in SQLite`);

    if (items.length === 0) {
      console.log(`  ⏭️  No records to migrate`);
      return 0;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of items) {
      try {
        const preparedItem = prepareBigInt(item);
        await createFn(preparedItem);
        migrated++;
      } catch (error: any) {
        if (error.code === "P2002" || error.message?.includes("Unique constraint")) {
          skipped++;
        } else {
          console.error(`    ❌ Error:`, error.message);
          errors++;
        }
      }
    }

    console.log(`  ✅ Completed: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
    return migrated;
  } catch (error: any) {
    console.error(`  ❌ Error migrating ${tableName}:`, error.message);
    return 0;
  }
}

async function main() {
  console.log("🚀 Migrating Social Platform Data\n");
  console.log(`Source: ${sqlitePath}`);
  console.log("Target: PostgreSQL (localhost:5433/ixstats)\n");

  try {
    // Test connections
    console.log("🔌 Testing connections...");
    sqlite.prepare("SELECT 1").get();
    console.log("  ✅ SQLite connected");
    await postgres.$queryRaw`SELECT 1`;
    console.log("  ✅ PostgreSQL connected\n");

    // Migrate social platform tables
    console.log("═══════════════════════════════════════════════════════");
    console.log("Social Platform Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable("ThinkpagesAccount", (data) => postgres.thinkpagesAccount.create({ data }));
    await migrateTable("ThinkpagesPost", (data) => postgres.thinkpagesPost.create({ data }));
    await migrateTable("ThinkshareConversation", (data) =>
      postgres.thinkshareConversation.create({ data })
    );
    await migrateTable("ConversationParticipant", (data) =>
      postgres.conversationParticipant.create({ data })
    );
    await migrateTable("ThinkshareMessage", (data) => postgres.thinkshareMessage.create({ data }));
    await migrateTable("MessageReadReceipt", (data) =>
      postgres.messageReadReceipt.create({ data })
    );
    await migrateTable("ThinktankGroup", (data) => postgres.thinktankGroup.create({ data }));
    await migrateTable("ThinktankMember", (data) => postgres.thinktankMember.create({ data }));
    await migrateTable("ThinktankMessage", (data) => postgres.thinktankMessage.create({ data }));
    await migrateTable("CollaborativeDoc", (data) => postgres.collaborativeDoc.create({ data }));
    await migrateTable("ActivityFeed", (data) => postgres.activityFeed.create({ data }));
    await migrateTable("ActivitySchedule", (data) => postgres.activitySchedule.create({ data }));
    await migrateTable("Post", (data) => postgres.post.create({ data }));
    await migrateTable("PostReaction", (data) => postgres.postReaction.create({ data }));
    await migrateTable("PostBookmark", (data) => postgres.postBookmark.create({ data }));
    await migrateTable("PostMention", (data) => postgres.postMention.create({ data }));

    console.log("\n✅ Migration completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    sqlite.close();
    await postgres.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
