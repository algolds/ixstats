/**
 * Player card tools: an admin's view of one player's copies, unopened packs, auctions and pending trades, and the
 * actions on them. Grant and revoke take a reason; cancelling an auction refunds the bid it holds; voiding a trade
 * releases the initiator's locked cards. Every action writes an audit row and tells the player.
 */
import type { CardFinish, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { copyRoom } from "~/lib/cards/capacity";
import { mintCopy } from "~/lib/cards/mint";
import { removeCopyTx } from "~/lib/cards/remove-copy";
import { isTrophyCard } from "~/lib/lorewards/trophy-cards";
import { notificationAPI } from "~/lib/notifications/api";
import { TradeStatus, claimPendingTradeTx, unlockCardsTx } from "~/lib/vault/trade-settlement";
import { earnCreditsTx } from "~/lib/vault/vault-ledger";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";

const MAX_COPIES_SHOWN = 500;
const ownershipIds = z.array(z.string()).catch([]);
const TROPHY_REFUSAL = "Trophies move only by reassigning the Loreward";

async function notifyPlayer(
  db: PrismaClient,
  userId: string,
  title: string,
  message: string
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { clerkUserId: true } });
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
      select: { id: true, title: true, cardType: true },
    }),
    playerOrThrow(db, input.userId),
  ]);
  if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
  if (isTrophyCard(card)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: TROPHY_REFUSAL });
  }
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
  await notifyPlayer(
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
  await notifyPlayer(
    db,
    copy.ownerId,
    "A card was removed from your collection",
    `An admin removed ${name}: ${input.reason}`
  );
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
    },
  });
  if (!auction) throw new TRPCError({ code: "NOT_FOUND", message: "Auction not found" });
  if (auction.status !== "ACTIVE") {
    throw new TRPCError({ code: "CONFLICT", message: "This auction has ended" });
  }
  await db.$transaction(async (tx) => {
    // The bid read above is the one refunded: a new bid or the completion cron in between fails this swap
    const claimed = await tx.cardAuction.updateMany({
      where: {
        id: auction.id,
        status: "ACTIVE",
        currentBid: auction.currentBid,
        currentBidderId: auction.currentBidderId,
      },
      data: { status: "CANCELLED" },
    });
    if (claimed.count !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This auction changed. Reload and try again.",
      });
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
    await recordCardAudit(tx, {
      action: "CARD_AUCTION_CANCEL",
      actor: actor.clerkId,
      target: auction.id,
      details: `Cancelled auction: ${input.reason}`,
    });
  });
  const message = `An admin cancelled an auction: ${input.reason}`;
  await notifyPlayer(db, auction.sellerId, "Your auction was cancelled", message);
  if (auction.currentBidderId) {
    await notifyPlayer(db, auction.currentBidderId, "Your bid was refunded", message);
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
      details: `Voided trade: ${input.reason}`,
    });
  });
  const message = `An admin voided a trade: ${input.reason}`;
  await notifyPlayer(db, trade.initiatorId, "Your trade was voided", message);
  await notifyPlayer(db, trade.recipientId, "A trade offered to you was voided", message);
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
  await notifyPlayer(
    db,
    input.userId,
    "A pack was added to your Vault",
    `An admin gave you a ${pack.name} pack.`
  );
}
