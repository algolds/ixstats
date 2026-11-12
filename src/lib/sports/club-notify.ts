import type { PrismaClient } from "@prisma/client";

// Sender id for the system-authored record messages. Not a real user; the
// messaging UI renders `isSystem` messages without a sender profile.
const SPORTS_SENDER_ID = "system:sportsnews";

/**
 * Notify a club owner of their match result two ways:
 *  1. an in-app Notification (the bell), ephemeral
 *  2. a durable ThinkShare message in a per-user "Sports Desk" channel (the record)
 *
 * Best-effort — never throws into the simulation.
 */
export async function notifyClubMatchResult(
  prisma: PrismaClient,
  args: {
    userId: string;
    leagueName: string;
    teamName: string;
    opponentName: string;
    teamScore: number;
    opponentScore: number;
    matchDay: number;
    teamId: string;
  }
): Promise<void> {
  try {
    const { getSportsNotifyConfig } = await import("./notify-config");
    if (!(await getSportsNotifyConfig(prisma)).clubDms) return;

    const { userId, leagueName, teamName, opponentName, teamScore, opponentScore, matchDay } = args;
    const outcome = teamScore > opponentScore ? "won" : teamScore < opponentScore ? "lost" : "drew";
    const emoji = outcome === "won" ? "✅" : outcome === "lost" ? "❌" : "➖";
    const title = `${emoji} ${teamName} ${teamScore}–${opponentScore} ${opponentName}`;
    const body = `Matchday ${matchDay} · ${leagueName}: ${teamName} ${outcome} ${teamScore}–${opponentScore} vs ${opponentName}.`;

    // 1. In-app notification (the bell), unless the owner's preferences filter it out
    //    (sports results are "low" priority, so a higher minimum urgency hides them).
    //    Accepted results also go out by push (and email, which skips low priorities), SL-5.
    const { recipientAccepts } = await import("~/lib/notifications/recipient-preferences");
    if (await recipientAccepts(userId, "sports", "low")) {
      const href = `/myclub/${args.teamId}`;
      await prisma.notification.create({
        data: {
          userId,
          title,
          message: body,
          href,
          type: "sports_result",
          category: "sports",
          source: "SportsNews",
          priority: "low",
          severity: "informational",
        },
      });
      const { deliverNotification } = await import("~/lib/notifications/delivery/deliver");
      void deliverNotification(
        { userId, title, message: body, href, priority: "low" },
        { db: prisma }
      );
    }

    // 2. Durable record in a per-user system DM channel. ThinkShare participants are Clerk ids, while the
    //    club owner is held by their internal User id, so the record is keyed on the Clerk id.
    const clerkId = await clerkIdOf(prisma, userId);
    if (!clerkId) return;
    const convoId = await sportsDeskFor(prisma, userId, clerkId);
    await prisma.thinkshareMessage.create({
      data: {
        conversationId: convoId,
        userId: SPORTS_SENDER_ID,
        content: `${title}\n${body}`,
        isSystem: true,
        messageType: "system",
        source: "sports",
      },
    });
    await prisma.thinkshareConversation.update({
      where: { id: convoId },
      data: { lastActivity: new Date() },
    });
  } catch (err) {
    console.error("[notifyClubMatchResult] failed:", err);
  }
}

/** The Clerk id of a club owner held by internal User id (or already by Clerk id); null when no such user. */
async function clerkIdOf(prisma: PrismaClient, ownerId: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: ownerId }, { clerkUserId: ownerId }] },
    select: { clerkUserId: true },
  });
  return user?.clerkUserId ?? null;
}

/**
 * The owner's Sports Desk conversation, created on first use. One made before the fix is keyed on the internal
 * id (its source id and its participant): it is moved to the Clerk id, so the owner finally sees it.
 */
async function sportsDeskFor(
  prisma: PrismaClient,
  ownerId: string,
  clerkId: string
): Promise<string> {
  const keys = ownerId === clerkId ? [clerkId] : [clerkId, ownerId];
  const existing = await prisma.thinkshareConversation.findFirst({
    where: { source: "sports", sourceId: { in: keys } },
    select: { id: true, sourceId: true },
  });
  if (!existing) {
    const created = await prisma.thinkshareConversation.create({
      data: {
        type: "system",
        name: "Sports Desk",
        source: "sports",
        sourceId: clerkId,
        participants: { create: { userId: clerkId } },
      },
      select: { id: true },
    });
    return created.id;
  }
  if (existing.sourceId !== clerkId) {
    await prisma.conversationParticipant.updateMany({
      where: { conversationId: existing.id, userId: ownerId },
      data: { userId: clerkId },
    });
    await prisma.thinkshareConversation.update({
      where: { id: existing.id },
      data: { sourceId: clerkId },
    });
  }
  return existing.id;
}
