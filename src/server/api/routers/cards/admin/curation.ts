import { CardType } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { cardWikiSourceSchema } from "~/lib/cards/card-sources";
import {
  acceptSuggestion,
  declineSuggestion,
  listReviewQueue,
  listSuggestions,
  reviewCards,
} from "~/server/modules/cards/cards.curation";
import { adminActor } from "./_actor";

const queueFilter = z.object({
  realm: z.string().min(1).max(100).default("admin"),
  source: cardWikiSourceSchema.optional(),
  cardType: z.nativeEnum(CardType).optional(),
});

export const cardsAdminCurationRouter = createTRPCRouter({
  queue: adminProcedure
    .input(
      queueFilter.extend({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
    )
    .query(({ ctx, input }) => listReviewQueue(ctx.db, input)),

  review: adminProcedure
    .input(
      z
        .object({
          decision: z.enum(["APPROVE", "REJECT"]),
          cardIds: z.array(z.string().min(1)).min(1).max(2000).optional(),
          filter: queueFilter.optional(),
          note: z.string().max(500).optional(),
        })
        .refine(
          (input) => Boolean(input.cardIds) !== Boolean(input.filter),
          "Choose cards or a filter, not both"
        )
    )
    .mutation(({ ctx, input }) => reviewCards(ctx.db, adminActor(ctx), input)),

  suggestions: adminProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "DONE"]).default("PENDING"),
        limit: z.number().int().min(1).max(200).default(100),
      })
    )
    .query(({ ctx, input }) => listSuggestions(ctx.db, input)),

  acceptSuggestion: adminProcedure
    .input(z.object({ requestId: z.string().min(1) }))
    .mutation(({ ctx, input }) => acceptSuggestion(ctx.db, adminActor(ctx), input.requestId)),

  declineSuggestion: adminProcedure
    .input(z.object({ requestId: z.string().min(1), reason: z.string().trim().min(3).max(500) }))
    .mutation(({ ctx, input }) => declineSuggestion(ctx.db, adminActor(ctx), input)),
});
