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

    // 1. In-app notification (the bell).
    await prisma.notification.create({
      data: {
        userId,
        title,
        message: body,
        href: `/myclub/${args.teamId}`,
        type: "sports_result",
        category: "sports",
        source: "SportsNews",
        priority: "low",
        severity: "informational",
      },
    });

    // 2. Durable record in a per-user system DM channel.
    let convo = await prisma.thinkshareConversation.findFirst({
      where: { source: "sports", sourceId: userId },
      select: { id: true },
    });
    if (!convo) {
      convo = await prisma.thinkshareConversation.create({
        data: {
          type: "system",
          name: "Sports Desk",
          source: "sports",
          sourceId: userId,
          participants: { create: { userId } },
        },
        select: { id: true },
      });
    }
    await prisma.thinkshareMessage.create({
      data: {
        conversationId: convo.id,
        userId: SPORTS_SENDER_ID,
        content: `${title}\n${body}`,
        isSystem: true,
        messageType: "system",
      },
    });
    await prisma.thinkshareConversation.update({
      where: { id: convo.id },
      data: { lastActivity: new Date() },
    });
  } catch (err) {
    console.error("[notifyClubMatchResult] failed:", err);
  }
}
