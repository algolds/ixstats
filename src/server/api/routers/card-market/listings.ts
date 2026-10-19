/** Fixed-price listings and the merged Browse (spec §2.3 Market). */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CardFinish, CardRarity, CardType } from "~/lib/cards/enums";
import { MAX_BULK_LISTINGS, MAX_LISTING_PRICE } from "~/lib/cards/market/fees";
import { clearVaultCachesFor } from "~/lib/vault/vault-cache";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  BROWSE_SORTS,
  browseMarket,
  MAX_BROWSE_OFFSET,
} from "~/server/modules/cards/market/browse";
import {
  buyListing,
  cancelListing,
  createListing,
  listMyListings,
} from "~/server/modules/cards/market/listings";

const price = z.number().int().min(1).max(MAX_LISTING_PRICE);
const ownershipId = z.string().min(1).max(64);
const listingId = z.object({ listingId: z.string().min(1).max(64) });

/** A bulk listing's line: the market's own refusal is the player's to read; anything else stays on the server. */
function listingError(error: Error): string {
  if (error instanceof TRPCError && error.code !== "INTERNAL_SERVER_ERROR") return error.message;
  console.error("[cardMarket.createListings] A copy could not be listed:", error);
  return "Could not list this copy.";
}

export const cardMarketListingsRouter = createTRPCRouter({
  createListing: rateLimitedMutationProcedure
    .input(z.object({ ownershipId, price, isFeatured: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const listing = await createListing(ctx.db, {
        sellerId: ctx.user.id,
        ...input,
        now: new Date(),
      });
      await clearVaultCachesFor(ctx.db, [ctx.user.id]);
      return listing;
    }),

  /** Lists several copies (Mine's select mode); each one is its own listing and transaction. */
  createListings: rateLimitedMutationProcedure
    .input(
      z.object({
        items: z.array(z.object({ ownershipId, price })).min(1).max(MAX_BULK_LISTINGS),
        isFeatured: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const results: Array<{
        ownershipId: string;
        listingId: string | null;
        error: string | null;
      }> = [];
      for (const item of input.items) {
        try {
          const listing = await createListing(ctx.db, {
            sellerId: ctx.user.id,
            ...item,
            isFeatured: input.isFeatured,
            now: new Date(),
          });
          results.push({ ownershipId: item.ownershipId, listingId: listing.id, error: null });
        } catch (error) {
          const message =
            error instanceof Error ? listingError(error) : "Could not list this copy.";
          results.push({ ownershipId: item.ownershipId, listingId: null, error: message });
        }
      }
      await clearVaultCachesFor(ctx.db, [ctx.user.id]);
      return results;
    }),

  cancelListing: rateLimitedMutationProcedure.input(listingId).mutation(async ({ ctx, input }) => {
    const result = await cancelListing(ctx.db, {
      sellerId: ctx.user.id,
      listingId: input.listingId,
      now: new Date(),
    });
    await clearVaultCachesFor(ctx.db, [ctx.user.id]);
    return result;
  }),

  buyListing: rateLimitedMutationProcedure.input(listingId).mutation(async ({ ctx, input }) => {
    const purchase = await buyListing(ctx.db, {
      buyerId: ctx.user.id,
      listingId: input.listingId,
      now: new Date(),
    });
    // The buyer paid, and the seller and any nation owner were paid
    const paid = purchase.settlement.royalties.map((royalty) => royalty.recipientId);
    await clearVaultCachesFor(ctx.db, [ctx.user.id, purchase.sellerId, ...paid]);
    return {
      ownershipId: purchase.ownershipId,
      cardId: purchase.cardId,
      price: purchase.price,
      leveledUp: purchase.xp.leveledUp,
      newLevel: purchase.xp.newLevel,
      xpGained: purchase.xp.xpGained,
    };
  }),

  getMyListings: protectedProcedure.query(({ ctx }) => listMyListings(ctx.db, ctx.user.id)),

  browse: protectedProcedure
    .input(
      z.object({
        kind: z.enum(["all", "listings", "auctions"]).default("all"),
        sort: z.enum(BROWSE_SORTS).default("ending_soon"),
        filters: z
          .object({
            realmId: z.string().min(1).max(64).optional(),
            rarity: z.enum(CardRarity).optional(),
            finish: z.enum(CardFinish).optional(),
            cardType: z.enum(CardType).optional(),
            cardId: z.string().min(1).max(64).optional(),
            search: z.string().trim().min(1).max(80).optional(),
          })
          .default({}),
        limit: z.number().int().min(1).max(100).default(24),
        offset: z.number().int().min(0).max(MAX_BROWSE_OFFSET).default(0),
      })
    )
    .query(({ ctx, input }) => browseMarket(ctx.db, ctx.user.id, input)),
});
