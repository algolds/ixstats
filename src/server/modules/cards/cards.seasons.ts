/** The interim card season (SystemConfig `currentIxCardSeason`) new imports take, until Phase 5's Season model. */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { getCurrentIxCardSeason, setCurrentIxCardSeason } from "~/lib/cards/season";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";

export const MAX_CARD_SEASON = 100;

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
  const before = await getCurrentIxCardSeason(db);
  await setCurrentIxCardSeason(db, season);
  await recordCardAudit(db, {
    action: "CARD_SEASON_SET",
    actor: actor.clerkId,
    details: `Card season ${before} → ${season}`,
  });
}
