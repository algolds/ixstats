/**
 * Phase 2 Data Migration: Unify messaging tables into ThinkShare
 *
 * Migrates:
 *   DiplomaticChannel + DiplomaticMessage → ThinkshareConversation + ThinkshareMessage
 *   ThinktankGroup messages → ThinkshareConversation + ThinkshareMessage
 *
 * Safe: keeps old tables intact, uses transactions, logs counts.
 * Run: npx tsx scripts/migrate-messages-to-thinkshare.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateDiplomaticChannels() {
  console.log("\n=== Migrating Diplomatic Channels → ThinkshareConversation ===");

  const channels = await prisma.diplomaticChannel.findMany({
    include: {
      participants: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  console.log(`Found ${channels.length} diplomatic channels to migrate`);

  let conversationsCreated = 0;
  let participantsCreated = 0;
  let messagesCreated = 0;

  for (const channel of channels) {
    // Check if already migrated
    const existing = await prisma.thinkshareConversation.findFirst({
      where: { source: "diplomatic", sourceId: channel.id },
    });
    if (existing) {
      console.log(`  Skipping channel "${channel.name}" (already migrated)`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // Create conversation
      const conversation = await tx.thinkshareConversation.create({
        data: {
          type: "group",
          name: channel.name,
          source: "diplomatic",
          sourceId: channel.id,
          conversationType: "diplomatic",
          diplomaticClassification: channel.classification,
          encrypted: channel.encrypted,
          channelType: channel.type === "bilateral" ? "BILATERAL" : "MULTILATERAL",
          lastActivity: channel.lastActivity,
          isActive: true,
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
        },
      });
      conversationsCreated++;

      // Create participants
      for (const participant of channel.participants) {
        await tx.conversationParticipant.create({
          data: {
            conversationId: conversation.id,
            userId: participant.countryId,
            role: participant.role.toLowerCase(),
            joinedAt: participant.joinedAt,
          },
        });
        participantsCreated++;
      }

      // Migrate messages
      for (const message of channel.messages) {
        await tx.thinkshareMessage.create({
          data: {
            conversationId: conversation.id,
            userId: message.fromCountryId,
            content: message.content,
            messageType: "text",
            source: "diplomatic",
            sourceMessageId: message.id,
            classification: message.classification,
            priority: message.priority,
            subject: message.subject ?? undefined,
            signature: message.signature ?? undefined,
            encryptedContent: message.encryptedContent ?? undefined,
            status: message.status,
            isSystem: false,
            // DiplomaticMessage.ixTimeTimestamp is a Float (epoch seconds)
            ixTimeTimestamp: new Date(
              typeof message.ixTimeTimestamp === "number"
                ? message.ixTimeTimestamp * 1000
                : message.ixTimeTimestamp
            ),
            createdAt: message.createdAt,
          },
        });
        messagesCreated++;
      }
    });

    console.log(
      `  Migrated channel "${channel.name}": ${channel.participants.length} participants, ${channel.messages.length} messages`
    );
  }

  console.log(
    `Diplomatic migration complete: ${conversationsCreated} conversations, ${participantsCreated} participants, ${messagesCreated} messages`
  );
}

async function migrateThinktankGroups() {
  console.log("\n=== Migrating ThinktankGroup messages → ThinkshareConversation ===");

  const groups = await prisma.thinktankGroup.findMany({
    include: {
      members: { where: { isActive: true } },
      messages: { orderBy: { ixTimeTimestamp: "asc" } },
    },
  });

  console.log(`Found ${groups.length} thinktank groups to migrate`);

  let conversationsCreated = 0;
  let participantsCreated = 0;
  let messagesCreated = 0;
  // Map old ThinktankMessage IDs → new ThinkshareMessage IDs for reply threading
  const messageIdMap = new Map<string, string>();

  for (const group of groups) {
    // Check if already migrated (has conversationId)
    if (group.conversationId) {
      console.log(`  Skipping group "${group.name}" (already linked)`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // Create conversation
      const conversation = await tx.thinkshareConversation.create({
        data: {
          type: "group",
          name: group.name,
          avatar: group.avatar,
          source: "thinktank",
          sourceId: group.id,
          isActive: group.isActive,
          lastActivity: group.updatedAt,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        },
      });
      conversationsCreated++;

      // Link group back to conversation
      await tx.thinktankGroup.update({
        where: { id: group.id },
        data: { conversationId: conversation.id },
      });

      // Create participants from active members
      for (const member of group.members) {
        await tx.conversationParticipant.create({
          data: {
            conversationId: conversation.id,
            userId: member.userId,
            role: member.role,
            joinedAt: member.joinedAt,
          },
        });
        participantsCreated++;
      }

      // First pass: create messages without replyToId
      for (const message of group.messages) {
        const newMsg = await tx.thinkshareMessage.create({
          data: {
            conversationId: conversation.id,
            userId: message.userId,
            content: message.content,
            messageType: message.messageType,
            source: "thinktank",
            sourceMessageId: message.id,
            reactions: message.reactions ?? undefined,
            mentions: message.mentions ?? undefined,
            attachments: message.attachments ?? undefined,
            editedAt: message.editedAt,
            deletedAt: message.deletedAt,
            isSystem: false,
            ixTimeTimestamp: message.ixTimeTimestamp,
          },
        });
        messageIdMap.set(message.id, newMsg.id);
        messagesCreated++;
      }

      // Second pass: wire up reply threads
      for (const message of group.messages) {
        if (message.replyToId) {
          const newReplyToId = messageIdMap.get(message.replyToId);
          const newMsgId = messageIdMap.get(message.id);
          if (newReplyToId && newMsgId) {
            await tx.thinkshareMessage.update({
              where: { id: newMsgId },
              data: { replyToId: newReplyToId },
            });
          }
        }
      }
    });

    console.log(
      `  Migrated group "${group.name}": ${group.members.length} members, ${group.messages.length} messages`
    );
  }

  console.log(
    `Thinktank migration complete: ${conversationsCreated} conversations, ${participantsCreated} participants, ${messagesCreated} messages`
  );
}

async function main() {
  console.log("ThinkShare Unified Messaging — Data Migration");
  console.log("=".repeat(50));

  // Pre-migration counts
  const preCounts = {
    diplomaticChannels: await prisma.diplomaticChannel.count(),
    diplomaticMessages: await prisma.diplomaticMessage.count(),
    thinktankGroups: await prisma.thinktankGroup.count(),
    thinktankMessages: await prisma.thinktankMessage.count(),
    thinkshareConversations: await prisma.thinkshareConversation.count(),
    thinkshareMessages: await prisma.thinkshareMessage.count(),
  };
  console.log("\nPre-migration counts:", preCounts);

  await migrateDiplomaticChannels();
  await migrateThinktankGroups();

  // Post-migration counts
  const postCounts = {
    thinkshareConversations: await prisma.thinkshareConversation.count(),
    thinkshareMessages: await prisma.thinkshareMessage.count(),
    bySource: {
      thinkshare: await prisma.thinkshareConversation.count({
        where: { source: "thinkshare" },
      }),
      diplomatic: await prisma.thinkshareConversation.count({
        where: { source: "diplomatic" },
      }),
      thinktank: await prisma.thinkshareConversation.count({
        where: { source: "thinktank" },
      }),
    },
  };
  console.log("\nPost-migration counts:", postCounts);
  console.log("\nMigration complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
