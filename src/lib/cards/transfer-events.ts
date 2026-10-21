/**
 * The ownership trail and the sales record. Every row carries the card, the serial and the copy's finish at the time,
 * so the market median reads one table and a burned copy's sales still count.
 */
import type { CardFinish, Prisma } from "@prisma/client";

export const SALE_ACTIONS = ["AUCTION_END", "AUCTION_BUYOUT", "LISTING_SALE"] as const;
export type SaleAction = (typeof SALE_ACTIONS)[number];
export type TransferAction = SaleAction | "TRADE" | "GIFT" | "FUSE" | "BREAKDOWN" | "ADMIN";

export interface TransferEventInput {
  ownershipId: string;
  cardId: string;
  serialNumber: number;
  finish: CardFinish;
  fromUserId: string | null;
  /** Null when the copy leaves every player (a break-down, a fusion's spent copies). */
  toUserId: string | null;
  action: TransferAction;
  price?: number;
}

export async function recordTransferTx(
  tx: Pick<Prisma.TransactionClient, "cardTransferEvent">,
  event: TransferEventInput
): Promise<void> {
  await tx.cardTransferEvent.create({
    data: {
      ownershipId: event.ownershipId,
      cardId: event.cardId,
      serialNumber: event.serialNumber,
      finish: event.finish,
      fromUserId: event.fromUserId,
      toUserId: event.toUserId,
      action: event.action,
      price: event.price ?? null,
    },
  });
}

export interface SaleRecord {
  ownershipId: string;
  cardId: string;
  serialNumber: number;
  finish: CardFinish;
  sellerId: string;
  buyerId: string;
  price: number;
  action: SaleAction;
  now: Date;
}

/** A sale: the priced event the median reads, and the card's first sale here (it ends an NS card's bank term). */
export async function recordSaleTx(
  tx: Pick<Prisma.TransactionClient, "cardTransferEvent" | "card">,
  sale: SaleRecord
): Promise<void> {
  await recordTransferTx(tx, {
    ownershipId: sale.ownershipId,
    cardId: sale.cardId,
    serialNumber: sale.serialNumber,
    finish: sale.finish,
    fromUserId: sale.sellerId,
    toUserId: sale.buyerId,
    action: sale.action,
    price: Math.round(sale.price),
  });
  await tx.card.updateMany({
    where: { id: sale.cardId, firstSoldAt: null },
    data: { firstSoldAt: sale.now },
  });
}

/** A card's sales here, newest first (the detail sheet's recent sales). */
export async function listCardSales(
  db: Pick<Prisma.TransactionClient, "cardTransferEvent">,
  cardId: string,
  limit: number
): Promise<Array<{ price: number; finish: CardFinish | null; at: Date }>> {
  const rows = await db.cardTransferEvent.findMany({
    where: { cardId, action: { in: [...SALE_ACTIONS] }, price: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { price: true, finish: true, createdAt: true },
  });
  return rows.flatMap((r) =>
    r.price === null ? [] : [{ price: r.price, finish: r.finish, at: r.createdAt }]
  );
}
