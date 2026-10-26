/**
 * Transfer-market escrow: the locks and the refund every transfer path shares.
 *
 * A bid's Sovereigns leave the bidder's wallet when it is placed and come back (or go to the
 * seller) exactly once. Lock order, everywhere: clubs before players. `placeTransferBid` and
 * `respondToTransferBid` share-lock the bidding club, then row-lock the listed player;
 * `deleteLeague` row-locks the league's clubs, then their players. So a bid, an answer, a
 * relisting and a league deletion touching one player run one at a time and can't deadlock.
 */
import type { Prisma } from "@prisma/client";
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
