import { type PrismaClient } from "@prisma/client";

const XP_PER_LEVEL = 1000;

export interface GrantXpResult {
  prevLevel: number;
  newLevel: number;
  prevXP: number;
  newXP: number;
  leveledUp: boolean;
  xpGained: number;
  nextLevelThreshold: number;
}

/**
 * Grant experience to a card ownership.
 * Safe to call from both tRPC mutations and server-side services (cron, auction completion).
 * Creates a CardExperienceEvent record for audit/history.
 */
export async function grantCardXp(
  db: PrismaClient,
  ownershipId: string,
  amount: number,
  source?: string,
  metadata?: string
): Promise<GrantXpResult> {
  const ownership = await db.cardOwnership.findUnique({
    where: { id: ownershipId },
    select: { level: true, experience: true },
  });

  if (!ownership) {
    return {
      prevLevel: 0, newLevel: 0, prevXP: 0, newXP: 0,
      leveledUp: false, xpGained: 0, nextLevelThreshold: 0,
    };
  }

  const prevLevel = ownership.level;
  const prevXP = ownership.experience;
  const newXP = prevXP + amount;
  const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
  const leveledUp = newLevel > prevLevel;

  await db.cardOwnership.update({
    where: { id: ownershipId },
    data: { experience: newXP, level: newLevel },
  });

  if (source) {
    await db.cardExperienceEvent.create({
      data: {
        ownershipId,
        amount,
        resultLevel: newLevel,
        resultXP: newXP,
        source,
        metadata: metadata ?? null,
      },
    });
  }

  return {
    prevLevel,
    newLevel,
    prevXP,
    newXP,
    leveledUp,
    xpGained: amount,
    nextLevelThreshold: newLevel * XP_PER_LEVEL,
  };
}