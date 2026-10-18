/** The notices an ended auction sends, built after the commit (pure). */
import type { CardNotice } from "~/lib/cards/card-notify";

export interface AuctionEnd {
  auctionId: string;
  cardId: string;
  cardTitle: string;
  sellerId: string;
  winnerId: string | null;
  price: number;
  sellerNet: number;
  /** The listing-fee refund an unsold auction paid. */
  refund: number;
  /** Everyone who bid, the winner included. */
  bidderIds: string[];
  byBuyout: boolean;
}

export function auctionEndNotices(end: AuctionEnd): CardNotice[] {
  const about = { cardId: end.cardId, metadata: { auctionId: end.auctionId } };
  if (!end.winnerId) {
    const refunded = end.refund > 0 ? ` We refunded ${end.refund} IxC of the listing fee.` : "";
    return [
      {
        ...about,
        userId: end.sellerId,
        title: "Your auction ended with no bids",
        message: `${end.cardTitle} is back in your collection.${refunded}`,
        priority: "low",
      },
    ];
  }
  const winnerId = end.winnerId;
  // Sales at or under the fee threshold pay no market fee
  const feeTaken = end.sellerNet < end.price ? " after the market fee" : "";
  const losers = [...new Set(end.bidderIds)].filter((id) => id !== winnerId && id !== end.sellerId);
  return [
    {
      ...about,
      userId: winnerId,
      title: "You won an auction",
      message: `${end.cardTitle} is yours for ${end.price} IxC.`,
      type: "success",
      priority: "high",
    },
    {
      ...about,
      userId: end.sellerId,
      title: end.byBuyout ? "Your auction was bought out" : "Your auction sold",
      message: `${end.cardTitle} sold for ${end.price} IxC. You received ${end.sellerNet} IxC${feeTaken}.`,
      type: "success",
      priority: "high",
    },
    ...losers.map((userId) => ({
      ...about,
      userId,
      title: "An auction you bid on ended",
      message: `${end.cardTitle} went for ${end.price} IxC. Your bid was refunded.`,
    })),
  ];
}
