/**
 * Clear history (Settings → Privacy & Security, SL-4).
 *
 * Deletes records of the user's own activity that only they see, and nothing anyone else
 * received or relies on:
 *
 * - their personal notifications: `Notification` rows addressed to them (by Clerk id or internal
 *   user id). Country-wide and global notices are shared, so they stay;
 * - their message read receipts (`MessageReadReceipt` rows they wrote);
 * - their online-status heartbeat (presence.ts), so they stop showing as recently online.
 *
 * It does not touch messages (theirs or others'), conversation read positions (unread counts
 * would reset), posts, activity feed entries (public, and others' comments hang off them),
 * audit and security logs, or settings. The browser half (Settings) also forgets the recently
 * viewed wiki articles and forum threads kept in that browser's session storage.
 *
 * `users.clearHistory` runs it behind a confirmation and a 3-per-hour rate limit.
 */
import type { PrismaClient } from "@prisma/client";
import { clearPresence } from "./presence";

export interface ClearHistoryResult {
  notifications: number;
  readReceipts: number;
}

export async function clearOwnHistory(
  db: Pick<PrismaClient, "notification" | "messageReadReceipt" | "$transaction">,
  clerkUserId: string,
  internalUserId?: string | null
): Promise<ClearHistoryResult> {
  const recipientIds = [clerkUserId, ...(internalUserId ? [internalUserId] : [])];
  const [notifications, readReceipts] = await db.$transaction([
    db.notification.deleteMany({ where: { userId: { in: recipientIds } } }),
    db.messageReadReceipt.deleteMany({ where: { userId: clerkUserId } }),
  ]);
  await clearPresence(clerkUserId);
  return { notifications: notifications.count, readReceipts: readReceipts.count };
}
