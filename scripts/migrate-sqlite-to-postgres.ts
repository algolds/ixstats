#!/usr/bin/env tsx
/**
 * SQLite to PostgreSQL Migration Script
 *
 * Migrates all data from SQLite (prod.db) to PostgreSQL
 * Handles foreign key dependencies, batching, and duplicate prevention
 */

import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create SQLite connection using better-sqlite3
const sqlitePath = join(__dirname, "../prisma/prod.db");
const sqlite = new Database(sqlitePath, { readonly: true });

// Create PostgreSQL client
const postgres = new PrismaClient({
  datasourceUrl: "postgresql://postgres:postgres@localhost:5433/ixstats",
});

// Migration statistics
const stats: Record<string, number> = {};

// List of known boolean fields across all models
// We use a simple heuristic: any field starting with 'is', 'has', 'allow', 'require', 'notify', 'enable', 'disable',
// or common boolean names like 'active', 'deleted', 'public', etc.
const isBooleanField = (key: string, value: any): boolean => {
  if (value !== 0 && value !== 1) return false;

  const booleanPrefixes = [
    "is",
    "has",
    "allow",
    "require",
    "notify",
    "enable",
    "disable",
    "can",
    "should",
    "must",
    "uses",
    "hide",
  ];
  const booleanWords = [
    "active",
    "deleted",
    "published",
    "draft",
    "featured",
    "sticky",
    "closed",
    "resolved",
    "urgent",
    "critical",
    "public",
    "private",
    "hidden",
    "verified",
    "approved",
    "rejected",
    "pending",
  ];

  const lowerKey = key.toLowerCase();
  return (
    booleanPrefixes.some((prefix) => lowerKey.startsWith(prefix)) || booleanWords.includes(lowerKey)
  );
};

// List of known DateTime fields that are stored as integer timestamps in SQLite
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
  "verifiedAt",
  "approvedAt",
  "rejectedAt",
  "canceledAt",
  "closedAt",
  "resolvedAt",
  "archivedAt",
  "lastCalculated",
  "baselineDate",
  "timestamp",
  "date",
  "dateTime",
  "sentAt",
  "receivedAt",
  "readAt",
  "deliveredAt",
  "processedAt",
  "executedAt",
  "installedAt",
]);

// Helper to handle BigInt serialization, SQLite boolean and DateTime conversion
const prepareBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (Array.isArray(obj)) return obj.map(prepareBigInt);
  if (typeof obj === "object") {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert boolean fields from SQLite integers (0/1) to real booleans using heuristic
      if (isBooleanField(key, value)) {
        newObj[key] = Boolean(value);
      }
      // Convert DateTime fields from SQLite integers (timestamps) to Date objects
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

// Batch size for migrations
const BATCH_SIZE = 100;

/**
 * Generic migration function using raw SQL for reading
 */
async function migrateTable(
  tableName: string,
  targetCreate: (data: any) => Promise<any>,
  options: {
    skipIfExists?: boolean;
    batchSize?: number;
    transform?: (item: any) => any;
  } = {}
): Promise<number> {
  const { skipIfExists = true, batchSize = BATCH_SIZE, transform } = options;

  console.log(`\n📦 Migrating ${tableName}...`);

  try {
    // Fetch data from SQLite using better-sqlite3
    const stmt = sqlite.prepare(`SELECT * FROM "${tableName}"`);
    const items = stmt.all();

    console.log(`  Found ${items.length} records in SQLite`);

    if (items.length === 0) {
      console.log(`  ⏭️  No records to migrate`);
      stats[tableName] = 0;
      return 0;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      for (const item of batch) {
        try {
          const processedItem = transform ? transform(item) : item;
          const preparedItem = prepareBigInt(processedItem);

          await targetCreate(preparedItem);
          migrated++;
        } catch (error: any) {
          if (
            skipIfExists &&
            (error.code === "P2002" || error.message?.includes("Unique constraint"))
          ) {
            skipped++;
          } else {
            console.error(`    ❌ Error migrating record:`, error.message);
            errors++;
          }
        }
      }

      // Progress update
      const progress = Math.min(i + batchSize, items.length);
      console.log(
        `  Progress: ${progress}/${items.length} (${migrated} migrated, ${skipped} skipped, ${errors} errors)`
      );
    }

    console.log(`  ✅ Completed: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
    stats[tableName] = migrated;
    return migrated;
  } catch (error: any) {
    console.error(`  ❌ Error migrating ${tableName}:`, error.message);
    stats[tableName] = 0;
    return 0;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log("🚀 Starting SQLite to PostgreSQL Migration\n");
  console.log("Source: SQLite (file:./prisma/prod.db)");
  console.log("Target: PostgreSQL (postgresql://postgres:postgres@localhost:5433/ixstats)\n");

  const startTime = Date.now();

  try {
    // Test connections
    console.log("🔌 Testing database connections...");
    try {
      sqlite.prepare("SELECT 1").get();
      console.log("  ✅ SQLite connected");
    } catch (err) {
      console.error("  ❌ SQLite connection failed:", err);
      throw err;
    }
    await postgres.$queryRaw`SELECT 1`;
    console.log("  ✅ PostgreSQL connected\n");

    // PHASE 1: Core tables (no dependencies)
    console.log("═══════════════════════════════════════════════════════");
    console.log("PHASE 1: Core Tables (No Dependencies)");
    console.log("═══════════════════════════════════════════════════════");

    // Migrate Countries (no dependencies)
    await migrateTable("Country", (data) => postgres.country.create({ data }));

    // Migrate Users (no dependencies)
    await migrateTable("User", (data) => postgres.user.create({ data }));

    // Migrate Roles
    await migrateTable("Role", (data) => postgres.role.create({ data }));

    // Migrate Permissions
    await migrateTable("Permission", (data) => postgres.permission.create({ data }));

    // PHASE 2: User-related tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 2: User-Related Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable("UserRole", (data) => postgres.userRole.create({ data }));
    await migrateTable("RolePermission", (data) => postgres.rolePermission.create({ data }));
    await migrateTable("UserPreferences", (data) => postgres.userPreferences.create({ data }));
    await migrateTable("UserSession", (data) => postgres.userSession.create({ data }));
    await migrateTable("UserPresence", (data) => postgres.userPresence.create({ data }));
    await migrateTable("UserConnection", (data) => postgres.userConnection.create({ data }));
    await migrateTable("UserAchievement", (data) => postgres.userAchievement.create({ data }));

    // PHASE 3: Country-related tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 3: Country-Related Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "EconomicProfile",
      () => sqlite.economicProfile.findMany(),
      (data) => postgres.economicProfile.create({ data })
    );

    await migrateTable(
      "Demographics",
      () => sqlite.demographics.findMany(),
      (data) => postgres.demographics.create({ data })
    );

    await migrateTable(
      "CountryFollow",
      () => sqlite.countryFollow.findMany(),
      (data) => postgres.countryFollow.create({ data })
    );

    await migrateTable(
      "CountryActivity",
      () => sqlite.countryActivity.findMany(),
      (data) => postgres.countryActivity.create({ data })
    );

    await migrateTable(
      "CountryMoodMetric",
      () => sqlite.countryMoodMetric.findMany(),
      (data) => postgres.countryMoodMetric.create({ data })
    );

    await migrateTable(
      "NationalIdentity",
      () => sqlite.nationalIdentity.findMany(),
      (data) => postgres.nationalIdentity.create({ data })
    );

    // PHASE 4: Economic tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 4: Economic System Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "EconomicModel",
      () => sqlite.economicModel.findMany(),
      (data) => postgres.economicModel.create({ data })
    );

    await migrateTable(
      "EconomicComponent",
      () => sqlite.economicComponent.findMany(),
      (data) => postgres.economicComponent.create({ data })
    );

    await migrateTable(
      "EconomicIndicator",
      () => sqlite.economicIndicator.findMany(),
      (data) => postgres.economicIndicator.create({ data })
    );

    await migrateTable(
      "SectoralOutput",
      () => sqlite.sectoralOutput.findMany(),
      (data) => postgres.sectoralOutput.create({ data })
    );

    await migrateTable(
      "LaborMarket",
      () => sqlite.laborMarket.findMany(),
      (data) => postgres.laborMarket.create({ data })
    );

    await migrateTable(
      "IncomeDistribution",
      () => sqlite.incomeDistribution.findMany(),
      (data) => postgres.incomeDistribution.create({ data })
    );

    await migrateTable(
      "HistoricalDataPoint",
      () => sqlite.historicalDataPoint.findMany(),
      (data) => postgres.historicalDataPoint.create({ data })
    );

    await migrateTable(
      "VitalitySnapshot",
      () => sqlite.vitalitySnapshot.findMany(),
      (data) => postgres.vitalitySnapshot.create({ data })
    );

    // PHASE 5: Government tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 5: Government System Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "GovernmentStructure",
      () => sqlite.governmentStructure.findMany(),
      (data) => postgres.governmentStructure.create({ data })
    );

    await migrateTable(
      "GovernmentComponent",
      () => sqlite.governmentComponent.findMany(),
      (data) => postgres.governmentComponent.create({ data })
    );

    await migrateTable(
      "GovernmentDepartment",
      () => sqlite.governmentDepartment.findMany(),
      (data) => postgres.governmentDepartment.create({ data })
    );

    await migrateTable(
      "GovernmentOfficial",
      () => sqlite.governmentOfficial.findMany(),
      (data) => postgres.governmentOfficial.create({ data })
    );

    await migrateTable(
      "ComponentSynergy",
      () => sqlite.componentSynergy.findMany(),
      (data) => postgres.componentSynergy.create({ data })
    );

    await migrateTable(
      "ComponentChangeLog",
      () => sqlite.componentChangeLog.findMany(),
      (data) => postgres.componentChangeLog.create({ data })
    );

    await migrateTable(
      "CrossBuilderSynergy",
      () => sqlite.crossBuilderSynergy.findMany(),
      (data) => postgres.crossBuilderSynergy.create({ data })
    );

    await migrateTable(
      "AtomicEconomicImpact",
      () => sqlite.atomicEconomicImpact.findMany(),
      (data) => postgres.atomicEconomicImpact.create({ data })
    );

    await migrateTable(
      "AtomicEffectiveness",
      () => sqlite.atomicEffectiveness.findMany(),
      (data) => postgres.atomicEffectiveness.create({ data })
    );

    // PHASE 6: Budget & Tax tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 6: Budget & Tax System Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "GovernmentBudget",
      () => sqlite.governmentBudget.findMany(),
      (data) => postgres.governmentBudget.create({ data })
    );

    await migrateTable(
      "BudgetAllocation",
      () => sqlite.budgetAllocation.findMany(),
      (data) => postgres.budgetAllocation.create({ data })
    );

    await migrateTable(
      "BudgetScenario",
      () => sqlite.budgetScenario.findMany(),
      (data) => postgres.budgetScenario.create({ data })
    );

    await migrateTable(
      "SubBudgetCategory",
      () => sqlite.subBudgetCategory.findMany(),
      (data) => postgres.subBudgetCategory.create({ data })
    );

    await migrateTable(
      "TaxSystem",
      () => sqlite.taxSystem.findMany(),
      (data) => postgres.taxSystem.create({ data })
    );

    await migrateTable(
      "TaxPolicy",
      () => sqlite.taxPolicy.findMany(),
      (data) => postgres.taxPolicy.create({ data })
    );

    await migrateTable(
      "TaxComponent",
      () => sqlite.taxComponent.findMany(),
      (data) => postgres.taxComponent.create({ data })
    );

    await migrateTable(
      "TaxBracket",
      () => sqlite.taxBracket.findMany(),
      (data) => postgres.taxBracket.create({ data })
    );

    await migrateTable(
      "TaxDeduction",
      () => sqlite.taxDeduction.findMany(),
      (data) => postgres.taxDeduction.create({ data })
    );

    await migrateTable(
      "TaxExemption",
      () => sqlite.taxExemption.findMany(),
      (data) => postgres.taxExemption.create({ data })
    );

    await migrateTable(
      "TaxCalculation",
      () => sqlite.taxCalculation.findMany(),
      (data) => postgres.taxCalculation.create({ data })
    );

    await migrateTable(
      "FiscalSystem",
      () => sqlite.fiscalSystem.findMany(),
      (data) => postgres.fiscalSystem.create({ data })
    );

    await migrateTable(
      "FiscalPolicy",
      () => sqlite.fiscalPolicy.findMany(),
      (data) => postgres.fiscalPolicy.create({ data })
    );

    await migrateTable(
      "RevenueSource",
      () => sqlite.revenueSource.findMany(),
      (data) => postgres.revenueSource.create({ data })
    );

    // PHASE 7: Diplomatic tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 7: Diplomatic System Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "DiplomaticRelation",
      () => sqlite.diplomaticRelation.findMany(),
      (data) => postgres.diplomaticRelation.create({ data })
    );

    await migrateTable(
      "Embassy",
      () => sqlite.embassy.findMany(),
      (data) => postgres.embassy.create({ data })
    );

    await migrateTable(
      "EmbassyMission",
      () => sqlite.embassyMission.findMany(),
      (data) => postgres.embassyMission.create({ data })
    );

    await migrateTable(
      "EmbassyUpgrade",
      () => sqlite.embassyUpgrade.findMany(),
      (data) => postgres.embassyUpgrade.create({ data })
    );

    await migrateTable(
      "Treaty",
      () => sqlite.treaty.findMany(),
      (data) => postgres.treaty.create({ data })
    );

    await migrateTable(
      "DiplomaticAction",
      () => sqlite.diplomaticAction.findMany(),
      (data) => postgres.diplomaticAction.create({ data })
    );

    await migrateTable(
      "DiplomaticEvent",
      () => sqlite.diplomaticEvent.findMany(),
      (data) => postgres.diplomaticEvent.create({ data })
    );

    await migrateTable(
      "DiplomaticChannel",
      () => sqlite.diplomaticChannel.findMany(),
      (data) => postgres.diplomaticChannel.create({ data })
    );

    await migrateTable(
      "DiplomaticChannelParticipant",
      () => sqlite.diplomaticChannelParticipant.findMany(),
      (data) => postgres.diplomaticChannelParticipant.create({ data })
    );

    await migrateTable(
      "DiplomaticMessage",
      () => sqlite.diplomaticMessage.findMany(),
      (data) => postgres.diplomaticMessage.create({ data })
    );

    await migrateTable(
      "CulturalExchange",
      () => sqlite.culturalExchange.findMany(),
      (data) => postgres.culturalExchange.create({ data })
    );

    await migrateTable(
      "CulturalExchangeParticipant",
      () => sqlite.culturalExchangeParticipant.findMany(),
      (data) => postgres.culturalExchangeParticipant.create({ data })
    );

    await migrateTable(
      "CulturalArtifact",
      () => sqlite.culturalArtifact.findMany(),
      (data) => postgres.culturalArtifact.create({ data })
    );

    // PHASE 8: Security & Intelligence tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 8: Security & Intelligence Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "SecurityAssessment",
      () => sqlite.securityAssessment.findMany(),
      (data) => postgres.securityAssessment.create({ data })
    );

    await migrateTable(
      "SecurityThreat",
      () => sqlite.securityThreat.findMany(),
      (data) => postgres.securityThreat.create({ data })
    );

    await migrateTable(
      "SecurityEvent",
      () => sqlite.securityEvent.findMany(),
      (data) => postgres.securityEvent.create({ data })
    );

    await migrateTable(
      "BorderSecurity",
      () => sqlite.borderSecurity.findMany(),
      (data) => postgres.borderSecurity.create({ data })
    );

    await migrateTable(
      "IntelligenceItem",
      () => sqlite.intelligenceItem.findMany(),
      (data) => postgres.intelligenceItem.create({ data })
    );

    await migrateTable(
      "IntelligenceBriefing",
      () => sqlite.intelligenceBriefing.findMany(),
      (data) => postgres.intelligenceBriefing.create({ data })
    );

    await migrateTable(
      "IntelligenceAlert",
      () => sqlite.intelligenceAlert.findMany(),
      (data) => postgres.intelligenceAlert.create({ data })
    );

    await migrateTable(
      "IntelligenceRecommendation",
      () => sqlite.intelligenceRecommendation.findMany(),
      (data) => postgres.intelligenceRecommendation.create({ data })
    );

    // PHASE 9: Military tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 9: Military System Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "DefenseBudget",
      () => sqlite.defenseBudget.findMany(),
      (data) => postgres.defenseBudget.create({ data })
    );

    await migrateTable(
      "MilitaryBranch",
      () => sqlite.militaryBranch.findMany(),
      (data) => postgres.militaryBranch.create({ data })
    );

    await migrateTable(
      "MilitaryUnit",
      () => sqlite.militaryUnit.findMany(),
      (data) => postgres.militaryUnit.create({ data })
    );

    await migrateTable(
      "MilitaryAsset",
      () => sqlite.militaryAsset.findMany(),
      (data) => postgres.militaryAsset.create({ data })
    );

    // PHASE 10: Social platform tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 10: Social Platform Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "Post",
      () => sqlite.post.findMany(),
      (data) => postgres.post.create({ data })
    );

    await migrateTable(
      "PostReaction",
      () => sqlite.postReaction.findMany(),
      (data) => postgres.postReaction.create({ data })
    );

    await migrateTable(
      "PostBookmark",
      () => sqlite.postBookmark.findMany(),
      (data) => postgres.postBookmark.create({ data })
    );

    await migrateTable(
      "PostMention",
      () => sqlite.postMention.findMany(),
      (data) => postgres.postMention.create({ data })
    );

    await migrateTable(
      "ThinkpagesAccount",
      () => sqlite.thinkpagesAccount.findMany(),
      (data) => postgres.thinkpagesAccount.create({ data })
    );

    await migrateTable(
      "ThinkpagesPost",
      () => sqlite.thinkpagesPost.findMany(),
      (data) => postgres.thinkpagesPost.create({ data })
    );

    await migrateTable(
      "ThinkshareConversation",
      () => sqlite.thinkshareConversation.findMany(),
      (data) => postgres.thinkshareConversation.create({ data })
    );

    await migrateTable(
      "ConversationParticipant",
      () => sqlite.conversationParticipant.findMany(),
      (data) => postgres.conversationParticipant.create({ data })
    );

    await migrateTable(
      "ThinkshareMessage",
      () => sqlite.thinkshareMessage.findMany(),
      (data) => postgres.thinkshareMessage.create({ data })
    );

    await migrateTable(
      "MessageReadReceipt",
      () => sqlite.messageReadReceipt.findMany(),
      (data) => postgres.messageReadReceipt.create({ data })
    );

    await migrateTable(
      "ThinktankGroup",
      () => sqlite.thinktankGroup.findMany(),
      (data) => postgres.thinktankGroup.create({ data })
    );

    await migrateTable(
      "ThinktankMember",
      () => sqlite.thinktankMember.findMany(),
      (data) => postgres.thinktankMember.create({ data })
    );

    await migrateTable(
      "ThinktankMessage",
      () => sqlite.thinktankMessage.findMany(),
      (data) => postgres.thinktankMessage.create({ data })
    );

    await migrateTable(
      "CollaborativeDoc",
      () => sqlite.collaborativeDoc.findMany(),
      (data) => postgres.collaborativeDoc.create({ data })
    );

    // PHASE 11: Activity & Notification tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 11: Activity & Notification Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "ActivityFeed",
      () => sqlite.activityFeed.findMany(),
      (data) => postgres.activityFeed.create({ data })
    );

    await migrateTable(
      "ActivitySchedule",
      () => sqlite.activitySchedule.findMany(),
      (data) => postgres.activitySchedule.create({ data })
    );

    await migrateTable(
      "Notification",
      () => sqlite.notification.findMany(),
      (data) => postgres.notification.create({ data })
    );

    // PHASE 12: Audit & System tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 12: Audit & System Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "AuditLog",
      () => sqlite.auditLog.findMany(),
      (data) => postgres.auditLog.create({ data })
    );

    await migrateTable(
      "AdminAuditLog",
      () => sqlite.adminAuditLog.findMany(),
      (data) => postgres.adminAuditLog.create({ data })
    );

    await migrateTable(
      "SystemLog",
      () => sqlite.systemLog.findMany(),
      (data) => postgres.systemLog.create({ data })
    );

    await migrateTable(
      "SystemConfig",
      () => sqlite.systemConfig.findMany(),
      (data) => postgres.systemConfig.create({ data })
    );

    await migrateTable(
      "CalculationLog",
      () => sqlite.calculationLog.findMany(),
      (data) => postgres.calculationLog.create({ data })
    );

    await migrateTable(
      "WikiCache",
      () => sqlite.wikiCache.findMany(),
      (data) => postgres.wikiCache.create({ data })
    );

    // PHASE 13: Remaining tables
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("PHASE 13: Remaining Tables");
    console.log("═══════════════════════════════════════════════════════");

    await migrateTable(
      "Policy",
      () => sqlite.policy.findMany(),
      (data) => postgres.policy.create({ data })
    );

    await migrateTable(
      "PolicyEffect",
      () => sqlite.policyEffect.findMany(),
      (data) => postgres.policyEffect.create({ data })
    );

    await migrateTable(
      "Archetype",
      () => sqlite.archetype.findMany(),
      (data) => postgres.archetype.create({ data })
    );

    await migrateTable(
      "ArchetypeCategory",
      () => sqlite.archetypeCategory.findMany(),
      (data) => postgres.archetypeCategory.create({ data })
    );

    await migrateTable(
      "CountryArchetypeMatch",
      () => sqlite.countryArchetypeMatch.findMany(),
      (data) => postgres.countryArchetypeMatch.create({ data })
    );

    await migrateTable(
      "UserArchetypeSelection",
      () => sqlite.userArchetypeSelection.findMany(),
      (data) => postgres.userArchetypeSelection.create({ data })
    );

    // Summary
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("MIGRATION SUMMARY");
    console.log("═══════════════════════════════════════════════════════\n");

    const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
    const tablesProcessed = Object.keys(stats).length;

    console.log(`Total tables processed: ${tablesProcessed}`);
    console.log(`Total records migrated: ${totalRecords}\n`);

    console.log("Records by table:");
    Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([table, count]) => {
        if (count > 0) {
          console.log(`  ${table.padEnd(40)} ${count.toString().padStart(6)} records`);
        }
      });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Migration completed in ${duration} seconds`);
    console.log("✅ Migration successful!\n");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    sqlite.close();
    await postgres.$disconnect();
  }
}

// Run migration
main()
  .then(() => {
    console.log("✅ All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
