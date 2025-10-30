/**
 * Diplomatic Encryption Service - Integration Examples
 *
 * This file demonstrates how to integrate the DiplomaticEncryptionService
 * with various parts of the IxStats platform.
 */

import { DiplomaticEncryptionService } from "./diplomatic-encryption";
import type {
  ClassificationLevel,
  EncryptedMessage,
  DecryptedMessage,
  EncryptionKeyModel,
} from "./diplomatic-encryption";
import type { UserLogContext } from "./user-logger";
import { db } from "~/server/db";
import { notificationAPI } from "./notification-api";

// ============================================================================
// EXAMPLE 1: Country Setup - Generate Initial Keys
// ============================================================================

/**
 * Generate encryption keys when a country is first created
 */
export async function setupCountryEncryption(
  countryId: string,
  countryName: string,
  userId?: string
): Promise<void> {
  try {
    console.log(`Setting up encryption for country: ${countryName} (${countryId})`);

    const userContext: UserLogContext = {
      userId: userId || "system",
      clerkUserId: userId || "system",
      countryId,
    };

    // Generate initial key pair
    const keyPair = await DiplomaticEncryptionService.generateKeyPair(countryId, userContext);

    console.log(`✓ Generated encryption keys for ${countryName}`);
    console.log(`  Key ID: ${keyPair.keyId}`);
    console.log(`  Expires: ${keyPair.expiresAt.toLocaleDateString()}`);

    // Send notification to country owner
    await notificationAPI.create({
      title: "🔐 Encryption Keys Generated",
      message: `Secure encryption keys have been generated for ${countryName}. Your diplomatic communications are now protected.`,
      countryId,
      category: "diplomatic",
      priority: "medium",
      type: "success",
      href: "/diplomatic",
      source: "encryption-system",
      actionable: false,
      metadata: {
        keyId: keyPair.keyId,
        expiresAt: keyPair.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error(`Failed to setup encryption for ${countryName}:`, error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 2: Sending Encrypted Messages
// ============================================================================

/**
 * Send an encrypted diplomatic message
 */
export async function sendEncryptedDiplomaticMessage(params: {
  channelId: string;
  fromCountryId: string;
  fromCountryName: string;
  toCountryId: string;
  toCountryName: string;
  subject: string;
  content: string;
  classification: ClassificationLevel;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  userId: string;
}): Promise<{ messageId: string; encrypted: boolean }> {
  const {
    channelId,
    fromCountryId,
    fromCountryName,
    toCountryId,
    toCountryName,
    subject,
    content,
    classification,
    priority = "NORMAL",
    userId,
  } = params;

  const userContext: UserLogContext = {
    userId,
    clerkUserId: userId,
    countryId: fromCountryId,
  };

  // Determine if encryption is required
  const requiresEncryption = DiplomaticEncryptionService.requiresEncryption(classification);

  let messageData: any = {
    channelId,
    fromCountryId,
    fromCountryName,
    toCountryId,
    toCountryName,
    subject,
    content,
    classification,
    priority,
    encrypted: requiresEncryption,
    ixTimeTimestamp: Date.now(),
    status: "SENT",
  };

  // Encrypt message if required
  if (requiresEncryption) {
    console.log(`Encrypting ${classification} message from ${fromCountryName} to ${toCountryName}`);

    const encryptedMessage = await DiplomaticEncryptionService.encryptMessage(
      content,
      toCountryId,
      fromCountryId,
      classification,
      userContext
    );

    messageData = {
      ...messageData,
      content: "[ENCRYPTED]", // Placeholder for plaintext field
      encryptedContent: encryptedMessage.encryptedContent,
      signature: encryptedMessage.signature,
      encryptionVersion: encryptedMessage.encryptionVersion,
      iv: encryptedMessage.iv,
      encryptedKey: encryptedMessage.encryptedKey,
      senderKeyId: encryptedMessage.senderKeyId,
      signatureVerified: false, // Will be verified on decryption
    };

    console.log(`✓ Message encrypted with key: ${encryptedMessage.senderKeyId}`);
  }

  // Save to database
  const message = await db.diplomaticMessage.create({
    data: messageData,
  });

  // Update channel last activity
  await db.diplomaticChannel.update({
    where: { id: channelId },
    data: { lastActivity: new Date() },
  });

  // Notify recipient
  await notificationAPI.create({
    title: requiresEncryption ? "🔐 Encrypted Message Received" : "📨 New Message",
    message: `${fromCountryName} sent you a ${classification.toLowerCase()} message: "${subject}"`,
    countryId: toCountryId,
    category: "diplomatic",
    priority: priority === "URGENT" ? "high" : priority === "HIGH" ? "medium" : "low",
    type: "info",
    href: `/diplomatic/channels/${channelId}`,
    source: "diplomatic-system",
    actionable: true,
    metadata: {
      messageId: message.id,
      fromCountryId,
      encrypted: requiresEncryption,
      classification,
    },
  });

  return {
    messageId: message.id,
    encrypted: requiresEncryption,
  };
}

// ============================================================================
// EXAMPLE 3: Reading Encrypted Messages
// ============================================================================

/**
 * Retrieve and decrypt a diplomatic message
 */
export async function readEncryptedDiplomaticMessage(params: {
  messageId: string;
  recipientCountryId: string;
  userId: string;
}): Promise<DecryptedMessage | { content: string; verified: boolean }> {
  const { messageId, recipientCountryId, userId } = params;

  const userContext: UserLogContext = {
    userId,
    clerkUserId: userId,
    countryId: recipientCountryId,
  };

  // Fetch message from database
  const message = await db.diplomaticMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new Error(`Message not found: ${messageId}`);
  }

  // Verify user has access to this message
  if (message.toCountryId !== recipientCountryId && message.fromCountryId !== recipientCountryId) {
    throw new Error("Unauthorized: You do not have access to this message");
  }

  // If not encrypted, return plaintext
  if (!message.encrypted || !message.encryptedContent) {
    return {
      content: message.content,
      verified: false, // No signature for unencrypted messages
    };
  }

  // Decrypt message
  console.log(`Decrypting message ${messageId} for ${recipientCountryId}`);

  const encryptedMessage: EncryptedMessage = {
    encryptedContent: message.encryptedContent,
    signature: message.signature!,
    encryptionVersion: (message.encryptionVersion || "v1") as any,
    iv: message.iv!,
    encryptedKey: message.encryptedKey!,
    senderKeyId: message.senderKeyId!,
    timestamp: message.createdAt.getTime(),
    classification: message.classification as ClassificationLevel,
  };

  const decryptedMessage = await DiplomaticEncryptionService.decryptMessage(
    encryptedMessage,
    recipientCountryId,
    userContext
  );

  // Update message status and verification
  await db.diplomaticMessage.update({
    where: { id: messageId },
    data: {
      status: "READ",
      signatureVerified: decryptedMessage.verified,
    },
  });

  console.log(
    `✓ Message decrypted (signature ${decryptedMessage.verified ? "verified" : "FAILED"})`
  );

  // Warn if signature verification failed
  if (!decryptedMessage.verified) {
    await notificationAPI.create({
      title: "⚠️ Signature Verification Failed",
      message: `A message from ${message.fromCountryName} could not be verified. It may have been tampered with.`,
      countryId: recipientCountryId,
      category: "security",
      priority: "high",
      type: "warning",
      href: `/diplomatic/channels/${message.channelId}`,
      source: "encryption-system",
      actionable: true,
      metadata: {
        messageId,
        fromCountryId: message.fromCountryId,
      },
    });
  }

  return decryptedMessage;
}

// ============================================================================
// EXAMPLE 4: Key Rotation and Management
// ============================================================================

/**
 * Check and rotate keys that are expiring soon
 */
export async function checkAndRotateExpiringKeys(): Promise<void> {
  console.log("Checking for expiring encryption keys...");

  const warningThreshold = new Date();
  warningThreshold.setDate(warningThreshold.getDate() + 30); // 30 days warning

  // Find keys expiring within 30 days
  const expiringKeys = await db.encryptionKey.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: {
        lte: warningThreshold,
        gt: new Date(),
      },
    },
  });

  console.log(`Found ${expiringKeys.length} keys expiring within 30 days`);

  for (const key of expiringKeys) {
    const daysUntilExpiry = Math.floor(
      (key.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get country name separately since there's no direct relation
    const country = await db.country.findUnique({
      where: { id: key.countryId },
      select: { name: true },
    });

    console.log(
      `  ${country?.name || "Unknown Country"}: ${key.id} expires in ${daysUntilExpiry} days`
    );

    // Auto-rotate if within 7 days
    if (daysUntilExpiry <= 7) {
      console.log(`    → Auto-rotating keys`);

      const newKeyPair = await DiplomaticEncryptionService.rotateKeys(key.countryId);

      await notificationAPI.create({
        title: "🔄 Encryption Keys Rotated",
        message: `Your encryption keys have been automatically rotated. Old key expires in ${daysUntilExpiry} days.`,
        countryId: key.countryId,
        category: "security",
        priority: "high",
        type: "warning",
        href: "/diplomatic",
        source: "encryption-system",
        actionable: false,
        metadata: {
          oldKeyId: key.id,
          newKeyId: newKeyPair.keyId,
          reason: "auto-rotation",
        },
      });
    } else {
      // Send warning notification
      await notificationAPI.create({
        title: "⚠️ Encryption Keys Expiring Soon",
        message: `Your encryption keys expire in ${daysUntilExpiry} days. Consider rotating them soon.`,
        countryId: key.countryId,
        category: "security",
        priority: "medium",
        type: "warning",
        href: "/diplomatic",
        source: "encryption-system",
        actionable: true,
        metadata: {
          keyId: key.id,
          expiresAt: key.expiresAt.toISOString(),
          daysUntilExpiry,
        },
      });
    }
  }
}

/**
 * Manually rotate keys for a country
 */
export async function manuallyRotateKeys(countryId: string, userId: string): Promise<void> {
  const userContext: UserLogContext = {
    userId,
    clerkUserId: userId,
    countryId,
  };

  console.log(`Manually rotating keys for country: ${countryId}`);

  const newKeyPair = await DiplomaticEncryptionService.rotateKeys(countryId, userContext);

  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { name: true },
  });

  await notificationAPI.create({
    title: "🔄 Encryption Keys Rotated",
    message: `New encryption keys have been generated for ${country?.name || "your country"}. All future messages will use the new keys.`,
    countryId,
    category: "security",
    priority: "medium",
    type: "success",
    href: "/diplomatic",
    source: "encryption-system",
    actionable: false,
    metadata: {
      newKeyId: newKeyPair.keyId,
      reason: "manual-rotation",
    },
  });

  console.log(`✓ Keys rotated successfully: ${newKeyPair.keyId}`);
}

// ============================================================================
// EXAMPLE 5: Security Auditing
// ============================================================================

/**
 * Get encryption statistics for a country
 */
export async function getCountryEncryptionStats(countryId: string) {
  const [encryptionLogs, decryptionLogs, signLogs, verifyLogs, keys] = await Promise.all([
    db.encryptionAuditLog.count({
      where: { countryId, operation: "ENCRYPT", success: true },
    }),
    db.encryptionAuditLog.count({
      where: { countryId, operation: "DECRYPT", success: true },
    }),
    db.encryptionAuditLog.count({
      where: { countryId, operation: "SIGN", success: true },
    }),
    db.encryptionAuditLog.count({
      where: { countryId, operation: "VERIFY", success: true },
    }),
    db.encryptionKey.findMany({
      where: { countryId },
    }),
  ]);

  const failedDecryptions = await db.encryptionAuditLog.count({
    where: { countryId, operation: "DECRYPT", success: false },
  });

  const failedVerifications = await db.encryptionAuditLog.count({
    where: { countryId, operation: "VERIFY", success: false },
  });

  const activeKeys = keys.filter((k: any) => k.status === "ACTIVE" && k.expiresAt > new Date());
  const expiredKeys = keys.filter((k: any) => k.expiresAt <= new Date());
  const revokedKeys = keys.filter((k: any) => k.status === "REVOKED");

  // Get average encryption/decryption times
  const encryptionTimes = await db.encryptionAuditLog.findMany({
    where: { countryId, operation: "ENCRYPT", success: true },
    select: { metadata: true },
    take: 100,
  });

  const avgEncryptionTime =
    encryptionTimes.reduce((sum: number, log: any) => {
      const metadata = typeof log.metadata === "string" ? JSON.parse(log.metadata) : log.metadata;
      return sum + (metadata.durationMs || 0);
    }, 0) / Math.max(encryptionTimes.length, 1);

  const lastRotation = await db.encryptionAuditLog.findFirst({
    where: { countryId, operation: "ROTATE_KEY", success: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    countryId,
    totalMessagesEncrypted: encryptionLogs,
    totalMessagesDecrypted: decryptionLogs,
    totalSignatureVerifications: verifyLogs,
    failedDecryptions,
    failedSignatureVerifications: failedVerifications,
    averageEncryptionTime: Math.round(avgEncryptionTime),
    activeKeys: activeKeys.length,
    expiredKeys: expiredKeys.length,
    revokedKeys: revokedKeys.length,
    lastKeyRotation: lastRotation?.createdAt,
    securityScore: calculateSecurityScore({
      activeKeys: activeKeys.length,
      failedDecryptions,
      failedVerifications,
      expiredKeys: expiredKeys.length,
    }),
  };
}

/**
 * Calculate security score based on encryption health
 */
function calculateSecurityScore(params: {
  activeKeys: number;
  failedDecryptions: number;
  failedVerifications: number;
  expiredKeys: number;
}): number {
  let score = 100;

  // Deduct for security issues
  if (params.activeKeys === 0) score -= 50; // Critical: No active keys
  if (params.activeKeys > 1) score -= 5; // Multiple active keys (should rotate old ones)
  if (params.failedDecryptions > 5) score -= 20; // Multiple failed decryptions
  if (params.failedVerifications > 3) score -= 30; // Failed signature verifications
  if (params.expiredKeys > 2) score -= 10; // Too many expired keys

  return Math.max(0, Math.min(100, score));
}

/**
 * Get recent security events for a country
 */
export async function getSecurityEvents(countryId: string, limit = 20) {
  const events = await db.encryptionAuditLog.findMany({
    where: {
      countryId,
      OR: [
        { success: false }, // Failed operations
        { operation: "ROTATE_KEY" }, // Key rotations
        { operation: "REVOKE_KEY" }, // Key revocations
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return events.map((event: any) => ({
    id: event.id,
    operation: event.operation,
    classification: event.classification,
    success: event.success,
    errorMessage: event.errorMessage,
    timestamp: event.createdAt,
    metadata: typeof event.metadata === "string" ? JSON.parse(event.metadata) : event.metadata,
  }));
}

// ============================================================================
// EXAMPLE 6: Bulk Operations
// ============================================================================

/**
 * Send encrypted broadcast message to multiple countries
 */
export async function sendEncryptedBroadcast(params: {
  channelId: string;
  fromCountryId: string;
  fromCountryName: string;
  recipientCountryIds: string[];
  subject: string;
  content: string;
  classification: ClassificationLevel;
  userId: string;
}): Promise<{ totalSent: number; failures: string[] }> {
  const {
    channelId,
    fromCountryId,
    fromCountryName,
    recipientCountryIds,
    subject,
    content,
    classification,
    userId,
  } = params;

  let totalSent = 0;
  const failures: string[] = [];

  for (const recipientId of recipientCountryIds) {
    try {
      const recipient = await db.country.findUnique({
        where: { id: recipientId },
        select: { name: true },
      });

      await sendEncryptedDiplomaticMessage({
        channelId,
        fromCountryId,
        fromCountryName,
        toCountryId: recipientId,
        toCountryName: recipient?.name || "Unknown",
        subject,
        content,
        classification,
        priority: "NORMAL",
        userId,
      });

      totalSent++;
    } catch (error) {
      console.error(`Failed to send to ${recipientId}:`, error);
      failures.push(recipientId);
    }
  }

  console.log(`Broadcast complete: ${totalSent} sent, ${failures.length} failed`);

  return { totalSent, failures };
}

// ============================================================================
// EXAMPLE 7: Integration with tRPC
// ============================================================================

/**
 * Example tRPC procedure for sending encrypted messages
 * Add this to /src/server/api/routers/diplomatic.ts
 */
export const exampleTRPCProcedures = {
  // Send encrypted message
  sendEncryptedMessage: `
  sendEncryptedMessage: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      toCountryId: z.string(),
      toCountryName: z.string(),
      subject: z.string(),
      content: z.string(),
      classification: z.enum(['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET']).default('PUBLIC'),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await sendEncryptedDiplomaticMessage({
        channelId: input.channelId,
        fromCountryId: ctx.user.countryId!,
        fromCountryName: ctx.user.countryName || 'Unknown',
        toCountryId: input.toCountryId,
        toCountryName: input.toCountryName,
        subject: input.subject,
        content: input.content,
        classification: input.classification,
        priority: input.priority,
        userId: ctx.user.id,
      });

      return result;
    }),
  `,

  // Read encrypted message
  readEncryptedMessage: `
  readEncryptedMessage: protectedProcedure
    .input(z.object({
      messageId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const decryptedMessage = await readEncryptedDiplomaticMessage({
        messageId: input.messageId,
        recipientCountryId: ctx.user.countryId!,
        userId: ctx.user.id,
      });

      return decryptedMessage;
    }),
  `,

  // Get encryption stats
  getEncryptionStats: `
  getEncryptionStats: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user.countryId) {
        throw new Error('Country ID required');
      }

      const stats = await getCountryEncryptionStats(ctx.user.countryId);
      return stats;
    }),
  `,

  // Rotate keys
  rotateEncryptionKeys: `
  rotateEncryptionKeys: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user.countryId) {
        throw new Error('Country ID required');
      }

      await manuallyRotateKeys(ctx.user.countryId, ctx.user.id);
      return { success: true };
    }),
  `,
};
