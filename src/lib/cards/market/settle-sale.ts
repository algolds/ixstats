/**
 * Settles a paid sale of one locked copy (an auction, a buyout or a listing): the copy moves to the buyer, the seller
 * is paid the price less the market fee, the royalty comes out of that fee, and the sale is recorded with its price.
 * The buyer has already paid (a reserved bid, or a spend earlier in the same transaction).
 */
import type { CardFinish, CardType, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { earnCreditsTx } from "~/lib/vault/vault-ledger";
import { lockVaultsTx } from "~/lib/vault/vault-locks";
import { marketplaceFee } from "../general-settings";
import { recordSaleTx, type SaleAction } from "../transfer-events";
import { payNationRoyaltiesTx, royaltyRecipientsTx, type RoyaltyPayout } from "./royalty";

export interface CardSale {
  ownershipId: string;
  cardId: string;
  serialNumber: number;
  finish: CardFinish;
  cardType: CardType;
  countryId: string | null;
  sellerId: string;
  buyerId: string;
  price: number;
  action: SaleAction;
  /** Ledger source of the seller's proceeds: card_sale_auction, card_sale_buyout or card_sale_listing. */
  sellerSource: string;
  context: Record<string, string>;
  now: Date;
}

export interface SaleSettlement {
  fee: number;
  sellerNet: number;
  royalties: RoyaltyPayout[];
}

/**
 * Locks, in user-id order, every vault a sale writes: the buyer's, the seller's, each royalty recipient's, and `others`
 * (a buyout's refunded bidder). Call it right after the sale's claim, before any credit or copy moves.
 */
export async function lockSaleVaultsTx(
  tx: Prisma.TransactionClient,
  sale: Pick<CardSale, "cardId" | "cardType" | "countryId" | "sellerId" | "buyerId">,
  others: ReadonlyArray<string | null> = []
): Promise<void> {
  const card = { cardId: sale.cardId, cardType: sale.cardType, countryId: sale.countryId };
  const recipients = await royaltyRecipientsTx(tx, [card], [sale.sellerId, sale.buyerId]);
  await lockVaultsTx(tx, [sale.buyerId, sale.sellerId, ...recipients, ...others]);
}

/**
 * Throws CONFLICT, rolling the caller's transaction back, if the copy is no longer the seller's locked copy. Any
 * failure after the move (the seller's ledger refusing, the royalty) throws too, so the move and the money roll back
 * together.
 */
export async function settleCardSaleTx(
  tx: Prisma.TransactionClient,
  sale: CardSale
): Promise<SaleSettlement> {
  // The holding XP tick counts from acquiredAt, so the buyer's holding starts now
  const moved = await tx.cardOwnership.updateMany({
    where: { id: sale.ownershipId, ownerId: sale.sellerId, isLocked: true },
    data: { ownerId: sale.buyerId, isLocked: false, acquiredAt: sale.now },
  });
  if (moved.count !== 1) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This card changed hands, so the sale cannot complete.",
    });
  }

  const fee = await marketplaceFee(tx, sale.price);
  const sellerNet = sale.price - fee;
  await earnCreditsTx(tx, {
    userId: sale.sellerId,
    amount: sellerNet,
    type: "EARN_CARDS",
    source: sale.sellerSource,
    metadata: {
      ...sale.context,
      ownershipId: sale.ownershipId,
      marketplaceFee: fee,
      grossSale: sale.price,
    },
  });
  const royalties = await payNationRoyaltiesTx(tx, {
    cards: [{ cardId: sale.cardId, cardType: sale.cardType, countryId: sale.countryId }],
    partyIds: [sale.sellerId, sale.buyerId],
    amount: sale.price,
    fee,
    context: sale.context,
  });
  // The priced event the median reads, and the card's first sale here; Card.marketValue is the cron's
  await recordSaleTx(tx, {
    ownershipId: sale.ownershipId,
    cardId: sale.cardId,
    serialNumber: sale.serialNumber,
    finish: sale.finish,
    sellerId: sale.sellerId,
    buyerId: sale.buyerId,
    price: sale.price,
    action: sale.action,
    now: sale.now,
  });
  return { fee, sellerNet, royalties };
}
