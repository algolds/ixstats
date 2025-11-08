/**
 * Data Migration Script: Diplomatic Channels → ThinkShare
 *
 * This script migrates all diplomatic messaging data to the unified ThinkShare system:
 * - DiplomaticChannel → ThinkshareConversation (with diplomatic metadata)
 * - DiplomaticChannelParticipant → ConversationParticipant
 * - DiplomaticMessage → ThinkshareMessage (with classification/encryption)
 *
 * Run with: npx tsx scripts/migrate-diplomatic-to-thinkshare.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface MigrationStats {
  conversationsMigrated: number;
  participantsMigrated: number;
  messagesMigrated: number;
  errors: string[];
}

/**
 * Main migration function
 */
async function migrateDiplomaticToThinkShare(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    conversationsMigrated: 0,
    participantsMigrated: 0,
    messagesMigrated: 0,
    errors: [],
  };

  console.log("🚀 Starting diplomatic channels migration to ThinkShare...\n");

  try {
    // Step 1: Check if diplomatic data exists
    const channelCount = await db.diplomaticChannel.count();
    const messageCount = await db.diplomaticMessage.count();

    console.log(`📊 Found ${channelCount} diplomatic channels and ${messageCount} messages to migrate\n`);

    if (channelCount === 0) {
      console.log("✅ No diplomatic channels found. Migration not needed.");
      return stats;
    }

    // Step 2: Fetch all diplomatic channels
    const diplomaticChannels = await db.diplomaticChannel.findMany({
      include: {
        participants: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    console.log(`🔄 Migrating ${diplomaticChannels.length} channels...\n`);

    // Step 3: Migrate each channel
    for (const channel of diplomaticChannels) {
      try {
        console.log(`  📨 Channel: ${channel.name} (${channel.type})`);

        // Create ThinkshareConversation with diplomatic metadata
        const conversation = await db.thinkshareConversation.create({
          data: {
            id: channel.id, // Preserve ID for reference integrity
            type: channel.type.toLowerCase(), // BILATERAL → bilateral, etc.
            name: channel.name,
            isActive: true,
            lastActivity: channel.lastActivity,
            createdAt: channel.createdAt,
            updatedAt: channel.updatedAt,
            // Diplomatic extensions
            conversationType: "diplomatic",
            diplomaticClassification: channel.classification,
            encrypted: channel.encrypted,
            channelType: channel.type, // BILATERAL, MULTILATERAL, EMERGENCY
            priority: "NORMAL", // Default priority
          },
        });

        stats.conversationsMigrated++;

        // Migrate participants
        for (const participant of channel.participants) {
          try {
            await db.conversationParticipant.create({
              data: {
                conversationId: conversation.id,
                userId: participant.countryId, // Use countryId as userId
                joinedAt: participant.joinedAt,
                isActive: true,
                role: participant.role.toLowerCase(), // MEMBER → member, etc.
                lastReadAt: new Date(), // Default to now
              },
            });
            stats.participantsMigrated++;
          } catch (error: any) {
            if (error.code !== "P2002") {
              // Ignore unique constraint violations (participant already exists)
              stats.errors.push(
                `Failed to migrate participant ${participant.countryId} for channel ${channel.name}: ${error.message}`
              );
              console.error(`    ⚠️  Error migrating participant: ${error.message}`);
            }
          }
        }

        console.log(`    ✓ Migrated ${channel.participants.length} participants`);

        // Migrate messages
        for (const message of channel.messages) {
          try {
            await db.thinkshareMessage.create({
              data: {
                id: message.id, // Preserve ID
                conversationId: conversation.id,
                userId: message.fromCountryId, // Use fromCountryId as userId
                content: message.content,
                messageType: "text",
                ixTimeTimestamp: new Date(message.ixTimeTimestamp),
                // Diplomatic extensions
                classification: message.classification,
                priority: message.priority,
                subject: message.subject || undefined,
                signature: message.signature || undefined,
                encryptedContent: message.encryptedContent || undefined,
                status: message.status,
              },
            });
            stats.messagesMigrated++;
          } catch (error: any) {
            if (error.code !== "P2002") {
              // Ignore unique constraint violations (message already exists)
              stats.errors.push(
                `Failed to migrate message ${message.id} in channel ${channel.name}: ${error.message}`
              );
              console.error(`    ⚠️  Error migrating message: ${error.message}`);
            }
          }
        }

        console.log(`    ✓ Migrated ${channel.messages.length} messages`);
        console.log(`    ✅ Channel migration complete\n`);
      } catch (error: any) {
        stats.errors.push(`Failed to migrate channel ${channel.name}: ${error.message}`);
        console.error(`  ❌ Error migrating channel: ${error.message}\n`);
      }
    }

    // Step 4: Print final statistics
    console.log("\n" + "=".repeat(60));
    console.log("📈 MIGRATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Conversations migrated: ${stats.conversationsMigrated}`);
    console.log(`✅ Participants migrated: ${stats.participantsMigrated}`);
    console.log(`✅ Messages migrated: ${stats.messagesMigrated}`);
    console.log(`⚠️  Errors encountered: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log("\n🚨 ERRORS:");
      stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error: any) {
    console.error("\n❌ MIGRATION FAILED:", error.message);
    throw error;
  } finally {
    await db.$disconnect();
  }

  return stats;
}

/**
 * Verify migration integrity
 */
async function verifyMigration(): Promise<boolean> {
  console.log("\n🔍 Verifying migration integrity...\n");

  try {
    // Check conversation counts
    const oldChannelCount = await db.diplomaticChannel.count();
    const diplomaticConversations = await db.thinkshareConversation.count({
      where: { conversationType: "diplomatic" },
    });

    console.log(`  Original channels: ${oldChannelCount}`);
    console.log(`  Migrated conversations: ${diplomaticConversations}`);

    // Check message counts
    const oldMessageCount = await db.diplomaticMessage.count();
    const diplomaticMessages = await db.thinkshareMessage.count({
      where: { classification: { not: null } },
    });

    console.log(`  Original messages: ${oldMessageCount}`);
    console.log(`  Migrated messages: ${diplomaticMessages}`);

    const isValid = diplomaticConversations === oldChannelCount && diplomaticMessages === oldMessageCount;

    if (isValid) {
      console.log("\n✅ Verification passed! Data integrity confirmed.");
    } else {
      console.log("\n⚠️  Verification warning: Counts don't match. Please investigate.");
    }

    return isValid;
  } catch (error: any) {
    console.error("\n❌ Verification failed:", error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("=" + "=".repeat(60));
  console.log(" DIPLOMATIC CHANNELS → THINKSHARE MIGRATION");
  console.log("=" + "=".repeat(60) + "\n");

  try {
    // Run migration
    const stats = await migrateDiplomaticToThinkShare();

    // Verify migration
    const isValid = await verifyMigration();

    if (stats.conversationsMigrated > 0 && isValid) {
      console.log("\n🎉 Migration complete! ThinkShare is now the unified messaging backbone.");
      console.log("\n⚠️  NEXT STEPS:");
      console.log("  1. Test diplomatic messaging UI with ThinkShare API");
      console.log("  2. Update diplomatic components to use unified system");
      console.log("  3. Deprecate old diplomatic endpoints");
      console.log("  4. Remove old DiplomaticChannel tables (Phase 5)");
    }

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
main();
