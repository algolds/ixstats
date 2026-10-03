import { TRPCError } from "@trpc/server";

/** Throws unless the request carries a signed-in user id; narrows `ctx.auth.userId` to a string. */
export function assertAuthUserId(ctx: {
  auth?: { userId?: string | null } | null;
}): asserts ctx is { auth: { userId: string } } {
  if (!ctx.auth?.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User ID not found in authentication context",
    });
  }
}

const cardSelect = { id: true, title: true, artwork: true, rarity: true } as const;

/** The auctioned card ownership with its card summary. */
export const AUCTION_CARD_INCLUDE = {
  CardOwnership: { include: { cards: { select: cardSelect } } },
} as const;

/** Auction card plus the seller's ids. */
export const AUCTION_WITH_SELLER_INCLUDE = {
  ...AUCTION_CARD_INCLUDE,
  User: { select: { id: true, clerkUserId: true } },
} as const;
