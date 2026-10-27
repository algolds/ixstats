/**
 * MyClub escrow: the locks and refunds shared by every path that holds players' Sovereigns.
 *
 * Transfer bids: a bid's Sovereigns leave the bidder's wallet when it is placed and come back
 * (or go to the seller) exactly once. Lock order, everywhere: clubs before players.
 * `placeTransferBid` and `respondToTransferBid` share-lock the bidding club, then row-lock the
 * listed player; `deleteLeague` row-locks the league's clubs, then their players. So a bid, an
 * answer, a relisting and a league deletion touching one player run one at a time and can't
 * deadlock.
 *
 * Prediction stakes: deleting matches (a season reset, a regenerated schedule, a deleted league)
 * cascades to their predictions, so the open ones are voided and refunded first, on the
 * settlement's own key, with the matches row-locked so no new stake lands in between.
 */
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { exchangeService } from "~/lib/vault/exchange-service";

type Tx = Prisma.TransactionClient;

/** ₷ bounds of an asking price or a bid: whole Sovereigns, the Exchange's own ceiling. */
export const MAX_TRANSFER_SOVEREIGNS = 10_000_000;

/** Row-lock the player until the transaction ends. False when the player no longer exists. */
export async function lockTransferPlayer(tx: Tx, playerId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "sport_players" WHERE id = ${playerId} FOR UPDATE`;
  return rows.length > 0;
}

/** Share-lock a club until the transaction ends, so it can't be deleted under a bid. */
export async function lockTransferClub(tx: Tx, teamId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "sport_teams" WHERE id = ${teamId} FOR SHARE`;
}

/**
 * Close a pending bid as `status` and give the bidder their escrow back, once: the bid is
 * claimed with a conditional update (a bid already answered matches nothing and is skipped),
 * and the credit carries the bid's refund key. False when the bid was no longer pending.
 */
export async function refundTransferBidTx(
  tx: Tx,
  bid: { id: string; bidderUserId: string; amount: number },
  status: "rejected" | "expired"
): Promise<boolean> {
  const claimed = await tx.sportTransferBid.updateMany({
    where: { id: bid.id, status: "pending" },
    data: { status },
  });
  if (claimed.count !== 1) return false;

  const source = `TRANSFER_BID_REFUND:${bid.id}`;
  const refund = await exchangeService.earn(
    bid.bidderUserId,
    bid.amount,
    "ADMIN_ADJUSTMENT",
    source,
    tx,
    undefined,
    { idempotencyKey: source }
  );
  if (!refund.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: refund.message ?? `Failed to refund bid ${bid.id}`,
    });
  }
  return true;
}

/**
 * Void and refund every open prediction on the matches `where` selects, before the caller
 * deletes them. The matches are row-locked first (a stake placed meanwhile waits, then fails
 * on the deleted match and rolls back); each prediction is claimed open → void like the
 * settlement's void refund and credited under its key, `PREDICTION_REFUND:<id>`, so a
 * settlement racing this pays it once.
 */
export async function refundOpenPredictionsTx(
  tx: Tx,
  where: { seasonId: string } | { leagueId: string }
): Promise<number> {
  const seasons =
    "seasonId" in where
      ? [where.seasonId]
      : (await tx.sportSeason.findMany({ where, select: { id: true } })).map((s) => s.id);
  if (seasons.length === 0) return 0;
  await tx.$queryRaw`SELECT id FROM "sport_matches" WHERE "seasonId" IN (${Prisma.join(seasons)}) FOR UPDATE`;

  const open = await tx.sportPrediction.findMany({
    where: { status: "open", seasonId: { in: seasons } },
    select: { id: true, userId: true, stake: true },
  });
  let refunded = 0;
  for (const p of open) {
    const claimed = await tx.sportPrediction.updateMany({
      where: { id: p.id, status: "open" },
      data: { status: "void", payout: p.stake, resolvedIxTime: Date.now() },
    });
    if (claimed.count !== 1 || p.stake <= 0) continue;
    const source = `PREDICTION_REFUND:${p.id}`;
    const refund = await exchangeService.earn(
      p.userId,
      p.stake,
      "PREDICTION_PAYOUT",
      source,
      tx,
      undefined,
      { idempotencyKey: source }
    );
    if (!refund.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: refund.message ?? `Failed to refund prediction ${p.id}`,
      });
    }
    refunded++;
  }
  return refunded;
}
