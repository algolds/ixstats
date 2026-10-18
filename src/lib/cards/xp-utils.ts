import type { Prisma } from "@prisma/client";
import { getEconomyConfig, type CardEconomyConfig } from "./economy-config";
import { utcDay } from "~/lib/vault/vault-dividend";
import { cappedXpGrant, levelForXp } from "./levels";

/** Where card XP comes from; the amounts are Economy tab numbers. The holding tick is `holding-xp.ts`. */
export type CardXpSource = "PACK_OPEN" | "DAILY_CLAIM" | "TRADE" | "AUCTION_WIN";

const AMOUNT: Record<CardXpSource, keyof CardEconomyConfig> = {
  PACK_OPEN: "xpPack",
  DAILY_CLAIM: "xpDaily",
  TRADE: "xpTradePerCard",
  AUCTION_WIN: "xpAuctionWin",
};

export interface GrantXpResult {
  prevLevel: number;
  newLevel: number;
  prevXP: number;
  newXP: number;
  leveledUp: boolean;
  xpGained: number;
}

const NOTHING: GrantXpResult = {
  prevLevel: 0,
  newLevel: 0,
  prevXP: 0,
  newXP: 0,
  leveledUp: false,
  xpGained: 0,
};
const ATTEMPTS = 3;

const unchanged = (row: { level: number; experience: number }): GrantXpResult => ({
  prevLevel: row.level,
  newLevel: row.level,
  prevXP: row.experience,
  newXP: row.experience,
  leveledUp: false,
  xpGained: 0,
});

/**
 * Grants a source's XP to one copy inside the caller's transaction, within the copy's daily cap. The write is a
 * compare-and-swap on the XP read, retried, so two grants racing on one copy never skip the cap. Each grant that
 * lands logs a CardExperienceEvent.
 */
export async function grantCardXp(
  tx: Prisma.TransactionClient,
  ownershipId: string,
  source: CardXpSource,
  metadata?: string,
  now: Date = new Date()
): Promise<GrantXpResult> {
  const cfg = await getEconomyConfig(tx);
  const xpDay = new Date(`${utcDay(now)}T00:00:00.000Z`);
  let last = NOTHING;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const row = await tx.cardOwnership.findUnique({
      where: { id: ownershipId },
      select: { level: true, experience: true, xpDay: true, xpToday: true },
    });
    if (!row) return NOTHING;
    last = unchanged(row);
    const { grant, xpToday } = cappedXpGrant(row, cfg[AMOUNT[source]], cfg.xpDailyCapPerCopy, now);
    if (grant <= 0) return last;

    const newXP = row.experience + grant;
    const newLevel = levelForXp(newXP);
    const moved = await tx.cardOwnership.updateMany({
      where: { id: ownershipId, experience: row.experience, xpToday: row.xpToday },
      data: { experience: newXP, level: newLevel, xpToday, xpDay },
    });
    if (moved.count !== 1) continue;

    await tx.cardExperienceEvent.create({
      data: {
        ownershipId,
        amount: grant,
        resultLevel: newLevel,
        resultXP: newXP,
        source,
        metadata: metadata ?? null,
      },
    });
    return { ...last, newLevel, newXP, leveledUp: newLevel > row.level, xpGained: grant };
  }
  console.warn(`[CardXP] gave up on ${ownershipId} after ${ATTEMPTS} conflicting grants`);
  return last;
}
