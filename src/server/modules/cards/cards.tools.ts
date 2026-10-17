/**
 * Player card tools: an admin's view of one player's copies, unopened packs, auctions and pending trades, and the
 * actions on them. Grant and revoke take a reason; cancelling an auction refunds the bid it holds; voiding a trade
 * releases the initiator's locked cards. Every action writes an audit row, drops the cached vault figures of each
 * player it touched and tells them.
 */
import type { CardFinish, CardReviewState, Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { copyRoom } from "~/lib/cards/capacity";
import { refundListingFeeTx } from "~/lib/economy/auction-service";
import { mintCopy } from "~/lib/cards/mint";
import { removeCopyTx } from "~/lib/cards/remove-copy";
import { isTrophyCard } from "~/lib/lorewards/trophy-cards";
import { notificationAPI } from "~/lib/notifications/api";
import { TradeStatus, claimPendingTradeTx, unlockCardsTx } from "~/lib/vault/trade-settlement";
import { clearVaultCaches } from "~/lib/vault/vault-cache";
import { earnCreditsTx } from "~/lib/vault/vault-ledger";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";

const MAX_COPIES_SHOWN = 500;
const ownershipIds = z.array(z.string()).catch([]);
const TROPHY_REFUSAL = "Trophies move only by reassigning the Loreward";
const REVIEW_REFUSALS: Record<Exclude<CardReviewState, "APPROVED">, string> = {
  PENDING: "This card is waiting for review.",
  REJECTED: "This card was rejected.",
};

/** Why a card cannot be granted, or null: packs and the daily card draw only approved, unretired cards. */
function grantRefusal(card: {
  cardType: string;
  reviewState: CardReviewState;
  isRetired: boolean;
}): string | null {
  if (isTrophyCard(card)) return TROPHY_REFUSAL;
  if (card.reviewState !== "APPROVED") return REVIEW_REFUSALS[card.reviewState];
  return card.isRetired ? "This card is retired." : null;
}

/** After an action: drop the player's cached vault stats and balance, which it changed, then tell them. */
async function refreshAndNotify(
  db: PrismaClient,
  userId: string,
  title: string,
  message: string
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { clerkUserId: true } });
  await clearVaultCaches({ id: userId, clerkUserId: user?.clerkUserId });
  if (!user?.clerkUserId) return;
  await notificationAPI
    .create({
      userId: user.clerkUserId,
      title,
      message,
      type: "info",
      category: "cards",
      priority: "medium",
    })
    .catch((error: Error) => console.error("[cards.tools] Notification failed:", error.message));
}

async function playerOrThrow(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: { select: { level: true } } },
  });
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
  return user;
}

export async function playerCardInventory(db: PrismaClient, userId: string) {
  const user = await playerOrThrow(db, userId);
  const [copies, copyCount, packs, auctions, trades, room] = await Promise.all([
    db.cardOwnership.findMany({
      where: { ownerId: userId },
      orderBy: { acquiredAt: "desc" },
      take: MAX_COPIES_SHOWN,
      select: {
        id: true,
        serialNumber: true,
        finish: true,
        isLocked: true,
        acquiredAt: true,
        // A copy with any auction row cannot be revoked (removeCopyTx), so the sheet offers no revoke for it
        _count: { select: { CardAuction: true } },
        cards: {
          select: { id: true, title: true, rarity: true, cardType: true, isBound: true },
        },
      },
    }),
    db.cardOwnership.count({ where: { ownerId: userId } }),
    db.userPack.findMany({
      where: { userId, isOpened: false },
      orderBy: { acquiredDate: "desc" },
      select: {
        id: true,
        acquiredMethod: true,
        acquiredDate: true,
        pack: { select: { name: true } },
      },
    }),
    db.cardAuction.findMany({
      where: { status: "ACTIVE", OR: [{ sellerId: userId }, { currentBidderId: userId }] },
      orderBy: { endTime: "asc" },
      select: {
        id: true,
        sellerId: true,
        currentBid: true,
        currentBidderId: true,
        bidCount: true,
        endTime: true,
        CardOwnership: { select: { serialNumber: true, cards: { select: { title: true } } } },
      },
    }),
    db.tradeOffer.findMany({
      where: {
        status: TradeStatus.PENDING,
        OR: [{ initiatorId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        initiatorId: true,
        initiatorCardIds: true,
        recipientCardIds: true,
        initiatorCredits: true,
        recipientCredits: true,
        expiresAt: true,
      },
    }),
    copyRoom(db, { id: user.id, roleLevel: user.role?.level }),
  ]);
  return {
    copies: copies.map(({ _count, ...copy }) => ({ ...copy, auctioned: _count.CardAuction > 0 })),
    copyCount,
    /** Copies the player can still receive; null when staff are exempt from the limit (JSON has no Infinity). */
    room: Number.isFinite(room) ? room : null,
    packs: packs.map((pack) => ({
      id: pack.id,
      name: pack.pack.name,
      acquiredMethod: pack.acquiredMethod,
      acquiredDate: pack.acquiredDate,
    })),
    auctions: auctions.map((auction) => ({
      id: auction.id,
      title: `${auction.CardOwnership.cards.title} #${auction.CardOwnership.serialNumber}`,
      selling: auction.sellerId === userId,
      /** A bid is held, so a cancel refunds a bidder too */
      hasBid: auction.currentBidderId !== null,
      currentBid: auction.currentBid,
      bidCount: auction.bidCount,
      endTime: auction.endTime,
    })),
    trades: trades.map((trade) => ({
      id: trade.id,
      initiating: trade.initiatorId === userId,
      copiesOffered: ownershipIds.parse(trade.initiatorCardIds).length,
      copiesAsked: ownershipIds.parse(trade.recipientCardIds).length,
      creditsOffered: trade.initiatorCredits,
      creditsAsked: trade.recipientCredits,
      expiresAt: trade.expiresAt,
    })),
  };
}

export async function grantCard(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { userId: string; cardId: string; finish: CardFinish; reason: string }
): Promise<{ ownershipId: string; serialNumber: number }> {
  const [card, user] = await Promise.all([
    db.card.findUnique({
      where: { id: input.cardId },
      select: { id: true, title: true, cardType: true, reviewState: true, isRetired: true },
    }),
    playerOrThrow(db, input.userId),
  ]);
  if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
  const refusal = grantRefusal(card);
  if (refusal) throw new TRPCError({ code: "PRECONDITION_FAILED", message: refusal });
  if ((await copyRoom(db, { id: user.id, roleLevel: user.role?.level })) < 1) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This player's inventory is full",
    });
  }
  const copy = await db.$transaction(async (tx) => {
    const minted = await mintCopy(tx, {
      cardId: card.id,
      ownerId: user.id,
      finish: input.finish,
      source: "ADMIN",
    });
    await recordCardAudit(tx, {
      action: "CARD_GRANT",
      actor: actor.clerkId,
      target: card.id,
      details: `Granted ${card.title} #${minted.serialNumber} to ${user.id}: ${input.reason}`,
    });
    return minted;
  });
  await refreshAndNotify(
    db,
    user.id,
    "A card was added to your collection",
    `An admin gave you ${card.title} #${copy.serialNumber}.`
  );
  return { ownershipId: copy.id, serialNumber: copy.serialNumber };
}

/** Locked, auctioned and pending-trade copies are refused by `removeCopyTx`, inside the transaction. */
export async function revokeCopy(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { ownershipId: string; reason: string }
): Promise<void> {
  const copy = await db.cardOwnership.findUnique({
    where: { id: input.ownershipId },
    select: {
      id: true,
      ownerId: true,
      serialNumber: true,
      cards: { select: { id: true, title: true, cardType: true } },
    },
  });
  if (!copy) throw new TRPCError({ code: "NOT_FOUND", message: "Copy not found" });
  if (isTrophyCard(copy.cards)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: TROPHY_REFUSAL });
  }
  const name = `${copy.cards.title} #${copy.serialNumber}`;
  await db.$transaction(async (tx) => {
    await removeCopyTx(
      tx,
      {
        id: copy.id,
        cardId: copy.cards.id,
        serialNumber: copy.serialNumber,
        ownerId: copy.ownerId,
      },
      "REVOKE"
    );
    await recordCardAudit(tx, {
      action: "CARD_REVOKE",
      actor: actor.clerkId,
      target: copy.cards.id,
      details: `Revoked ${name} from ${copy.ownerId}: ${input.reason}`,
    });
  });
  await refreshAndNotify(
    db,
    copy.ownerId,
    "A card was removed from your collection",
    `An admin removed ${name}: ${input.reason}`
  );
}

interface CancellableAuction {
  id: string;
  sellerId: string;
  cardInstanceId: string;
  currentBid: number;
  currentBidderId: string | null;
  isFeatured: boolean;
  endTime: Date;
}

/**
 * Cancels the auction as read, refunding the bid it holds and half the listing fee; returns the fee refunded. An
 * auction past its end is refused: the cron settles it and pays the seller, so a cancel must not turn a sale into a
 * refund.
 */
async function cancelAuctionTx(
  tx: Prisma.TransactionClient,
  auction: CancellableAuction
): Promise<number> {
  const now = new Date();
  // The bid read before is the one refunded: a new bid, the end passing or the cron in between fails this swap
  const claimed = await tx.cardAuction.updateMany({
    where: {
      id: auction.id,
      status: "ACTIVE",
      currentBid: auction.currentBid,
      currentBidderId: auction.currentBidderId,
      endTime: { gt: now },
    },
    data: { status: "CANCELLED" },
  });
  if (claimed.count !== 1) {
    // A bid only ever moves the end later, so a read end already passed means the auction ended
    throw auction.endTime <= now
      ? new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This auction has ended; it settles on its own.",
        })
      : new TRPCError({ code: "CONFLICT", message: "This auction changed. Reload and try again." });
  }
  await tx.cardOwnership.updateMany({
    where: { id: auction.cardInstanceId },
    data: { isLocked: false },
  });
  if (auction.currentBidderId) {
    await earnCreditsTx(tx, {
      userId: auction.currentBidderId,
      amount: auction.currentBid,
      type: "REFUND",
      source: "auction_bid_refund",
      metadata: { auctionId: auction.id, reason: "admin_cancel" },
    });
  }
  // The same half-fee refund the seller gets for cancelling their own listing
  return refundListingFeeTx(tx, auction, "admin_cancel");
}

export async function adminCancelAuction(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { auctionId: string; reason: string }
): Promise<void> {
  const auction = await db.cardAuction.findUnique({
    where: { id: input.auctionId },
    select: {
      id: true,
      status: true,
      sellerId: true,
      cardInstanceId: true,
      currentBid: true,
      currentBidderId: true,
      isFeatured: true,
      endTime: true,
    },
  });
  if (!auction) throw new TRPCError({ code: "NOT_FOUND", message: "Auction not found" });
  if (auction.status !== "ACTIVE") {
    throw new TRPCError({ code: "CONFLICT", message: "This auction has ended" });
  }
  const bid = auction.currentBidderId
    ? `refunded the ${auction.currentBid} IxC bid to ${auction.currentBidderId}`
    : "no bid to refund";
  await db.$transaction(async (tx) => {
    const fee = await cancelAuctionTx(tx, auction);
    await recordCardAudit(tx, {
      action: "CARD_AUCTION_CANCEL",
      actor: actor.clerkId,
      target: auction.id,
      details: `Cancelled the auction of seller ${auction.sellerId}: ${bid}, refunded ${fee} IxC of the listing fee to the seller. Reason: ${input.reason}`,
    });
  });
  const message = `An admin cancelled an auction: ${input.reason}`;
  await refreshAndNotify(db, auction.sellerId, "Your auction was cancelled", message);
  if (auction.currentBidderId) {
    await refreshAndNotify(db, auction.currentBidderId, "Your bid was refunded", message);
  }
}

export async function voidTrade(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { tradeId: string; reason: string }
): Promise<void> {
  const trade = await db.tradeOffer.findUnique({
    where: { id: input.tradeId },
    select: { id: true, initiatorId: true, recipientId: true, initiatorCardIds: true },
  });
  if (!trade) throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
  await db.$transaction(async (tx) => {
    await claimPendingTradeTx(tx, trade.id, TradeStatus.CANCELLED, new Date());
    await unlockCardsTx(tx, ownershipIds.parse(trade.initiatorCardIds), trade.initiatorId);
    await recordCardAudit(tx, {
      action: "CARD_TRADE_VOID",
      actor: actor.clerkId,
      target: trade.id,
      details: `Voided the trade from ${trade.initiatorId} to ${trade.recipientId}. Reason: ${input.reason}`,
    });
  });
  const message = `An admin voided a trade: ${input.reason}`;
  await refreshAndNotify(db, trade.initiatorId, "Your trade was voided", message);
  await refreshAndNotify(db, trade.recipientId, "A trade offered to you was voided", message);
}

/** Any pack, including one the store does not sell (an event pack): opening does not check `isActive`. */
export async function awardPack(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { userId: string; packId: string }
): Promise<void> {
  const [pack] = await Promise.all([
    db.cardPack.findUnique({ where: { id: input.packId }, select: { id: true, name: true } }),
    playerOrThrow(db, input.userId),
  ]);
  if (!pack) throw new TRPCError({ code: "NOT_FOUND", message: "Pack not found" });
  await db.$transaction(async (tx) => {
    await tx.userPack.create({
      data: { userId: input.userId, packId: pack.id, acquiredMethod: "ADMIN_AWARD" },
    });
    await recordCardAudit(tx, {
      action: "CARD_PACK_AWARD",
      actor: actor.clerkId,
      target: input.userId,
      details: `Awarded ${pack.name}`,
    });
  });
  await refreshAndNotify(
    db,
    input.userId,
    "A pack was added to your Vault",
    `An admin gave you a ${pack.name} pack.`
  );
}
