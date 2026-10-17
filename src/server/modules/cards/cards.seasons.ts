/**
 * The interim card season (SystemConfig `currentIxCardSeason`) new Lore and trophy cards take, until Phase 5's
 * Season model. NationStates cards keep their NS season.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  MAX_CARD_SEASON,
  getCurrentIxCardSeason,
  setCurrentIxCardSeason,
} from "~/lib/cards/season";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";

/** Sets the card season; a season equal to the current one writes and audits nothing. */
export async function setCardSeason(
  db: PrismaClient,
  actor: CardAdminActor,
  season: number
): Promise<void> {
  if (!Number.isInteger(season) || season < 1 || season > MAX_CARD_SEASON) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `The season must be a whole number between 1 and ${MAX_CARD_SEASON}`,
    });
  }
  await db.$transaction(async (tx) => {
    const before = await getCurrentIxCardSeason(tx);
    if (before === season) return;
    await setCurrentIxCardSeason(tx, season);
    await recordCardAudit(tx, {
      action: "CARD_SEASON_SET",
      actor: actor.clerkId,
      details: `Card season ${before} → ${season}`,
    });
  });
}
