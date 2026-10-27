/**
 * The trade builder's reads (spec §2.3 Trade builder): a partner by passport handle or by search, with their trade
 * privacy shown before building, each side's tradeable copies, and the partner's wishlist. The partners module holds
 * the rules; this bounds the input, rate-limits the reads and injects identity (card modules do not read it).
 */
import { CardFinish, CardRarity, CardType } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, readOnlyProcedure } from "~/server/api/trpc";
import {
  findTradePartner,
  getPartnerWishlist,
  getTradeables,
  searchTradePartners,
  type PartnerRules,
} from "~/server/modules/cards/trading/partners";
import type { Party } from "~/server/modules/cards/trading/trade-service";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { loadVaultCardsShown } from "~/server/modules/identity/identity.privacy";
import { resolveHandleUser } from "~/server/modules/identity/identity.resolve";

/** Partners resolve by any passport handle and are named by the identity rule, wiki attribution honoured. */
const rules: PartnerRules = {
  userOfHandle: async (handle) => (await resolveHandleUser(handle))?.id ?? null,
  namesOf: loadPlayerNames,
  cardsShown: loadVaultCardsShown,
};

const viewerOf = (user: { id: string; clerkUserId: string }): Party => ({
  id: user.id,
  clerkUserId: user.clerkUserId,
});

const id = z.string().min(1).max(64);

export const tradingBuilderRouter = createTRPCRouter({
  findPartner: readOnlyProcedure
    .input(z.object({ handle: z.string().max(80) }))
    .query(({ ctx, input }) => findTradePartner(ctx.db, rules, viewerOf(ctx.user), input.handle)),

  searchPartners: readOnlyProcedure
    .input(z.object({ query: z.string().max(64) }))
    .query(({ ctx, input }) => searchTradePartners(ctx.db, rules, viewerOf(ctx.user), input.query)),

  getTradeables: readOnlyProcedure
    .input(
      z.object({
        partnerId: id,
        side: z.enum(["mine", "theirs"]),
        filters: z
          .object({
            realmId: id.optional(),
            rarity: z.enum(CardRarity).optional(),
            finish: z.enum(CardFinish).optional(),
            cardType: z.enum(CardType).optional(),
            search: z.string().trim().max(80).optional(),
          })
          .default({}),
        cursor: id.optional(),
        limit: z.number().int().min(1).max(60).default(30),
      })
    )
    .query(({ ctx, input }) => getTradeables(ctx.db, rules, viewerOf(ctx.user), input)),

  getPartnerWishlist: readOnlyProcedure
    .input(z.object({ partnerId: id }))
    .query(({ ctx, input }) =>
      getPartnerWishlist(ctx.db, rules, viewerOf(ctx.user), input.partnerId)
    ),
});
