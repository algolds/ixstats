/**
 * Block and mute enforcement (Settings → Privacy & Security).
 *
 * The lists live in UserConnection rows written by users/preferences.ts:
 * `userId` is the owner's Clerk id, `connectionType` is "blocked" or "muted",
 * `targetUserId` is the target's internal user id (older rows may hold a Clerk id) and a
 * blocked nation also sets `targetCountryId`.
 *
 * - Blocked and muted accounts' posts are left out of the owner's ThinkPages feeds.
 * - A user who blocked someone cannot be sent direct messages by them.
 * - In group conversations, blocked accounts' messages are left out of the owner's reads
 *   (they can still post to the group).
 */
import type { PrismaClient } from "@prisma/client";

type BlockDb = Pick<PrismaClient, "userConnection" | "user" | "thinkpagesAccount">;

/**
 * ThinkPages account ids whose posts the viewer has hidden by blocking or muting their owner
 * (or blocking their nation). Empty for anonymous viewers.
 */
export async function hiddenThinkpagesAccountIds(
  db: BlockDb,
  viewerClerkId: string | null | undefined
): Promise<string[]> {
  if (!viewerClerkId) return [];
  const rows = await db.userConnection.findMany({
    where: { userId: viewerClerkId, connectionType: { in: ["blocked", "muted"] } },
    select: { targetUserId: true, targetCountryId: true },
  });
  if (rows.length === 0) return [];

  const targetIds = [...new Set(rows.flatMap((r) => (r.targetUserId ? [r.targetUserId] : [])))];
  const countryIds = [
    ...new Set(rows.flatMap((r) => (r.targetCountryId ? [r.targetCountryId] : []))),
  ];
  const users = targetIds.length
    ? await db.user.findMany({
        where: { OR: [{ id: { in: targetIds } }, { clerkUserId: { in: targetIds } }] },
        select: { clerkUserId: true },
      })
    : [];
  const clerkIds = users.map((u) => u.clerkUserId).filter((id) => id !== viewerClerkId);
  if (clerkIds.length === 0 && countryIds.length === 0) return [];

  const accounts = await db.thinkpagesAccount.findMany({
    where: {
      OR: [
        ...(clerkIds.length ? [{ clerkUserId: { in: clerkIds } }] : []),
        ...(countryIds.length ? [{ countryId: { in: countryIds } }] : []),
      ],
      NOT: { clerkUserId: viewerClerkId },
    },
    select: { id: true },
  });
  return accounts.map((a) => a.id);
}

/**
 * Clerk ids of the users the viewer has blocked, by account or by nation (muted accounts are
 * not included). Raw `targetUserId`s are kept too, since older rows may already hold a Clerk id.
 * Empty for anonymous viewers.
 */
export async function blockedUserClerkIds(
  db: Pick<PrismaClient, "userConnection" | "user">,
  viewerClerkId: string | null | undefined
): Promise<string[]> {
  if (!viewerClerkId) return [];
  const rows = await db.userConnection.findMany({
    where: { userId: viewerClerkId, connectionType: "blocked" },
    select: { targetUserId: true, targetCountryId: true },
  });
  if (rows.length === 0) return [];

  const targetIds = [...new Set(rows.flatMap((r) => (r.targetUserId ? [r.targetUserId] : [])))];
  const countryIds = [
    ...new Set(rows.flatMap((r) => (r.targetCountryId ? [r.targetCountryId] : []))),
  ];
  const users = await db.user.findMany({
    where: {
      OR: [
        ...(targetIds.length
          ? [{ id: { in: targetIds } }, { clerkUserId: { in: targetIds } }]
          : []),
        ...(countryIds.length ? [{ countryId: { in: countryIds } }] : []),
      ],
    },
    select: { clerkUserId: true },
  });
  return [...new Set([...targetIds, ...users.map((u) => u.clerkUserId)])].filter(
    (id) => id !== viewerClerkId
  );
}

/**
 * Which of `recipientClerkIds` have blocked the sender (by account or by the sender's nation).
 */
export async function recipientsBlockingSender(
  db: Pick<PrismaClient, "userConnection" | "user">,
  senderClerkId: string,
  recipientClerkIds: string[]
): Promise<string[]> {
  const recipients = recipientClerkIds.filter((id) => id !== senderClerkId);
  if (recipients.length === 0) return [];
  const sender = await db.user.findUnique({
    where: { clerkUserId: senderClerkId },
    select: { id: true, countryId: true },
  });
  const blocks = await db.userConnection.findMany({
    where: {
      userId: { in: recipients },
      connectionType: "blocked",
      OR: [
        { targetUserId: { in: [senderClerkId, ...(sender?.id ? [sender.id] : [])] } },
        ...(sender?.countryId ? [{ targetCountryId: sender.countryId }] : []),
      ],
    },
    select: { userId: true },
  });
  return [...new Set(blocks.map((b) => b.userId))];
}
