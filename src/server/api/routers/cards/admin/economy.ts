import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { cardArticleSourceSchema, cardWikiSourceSchema } from "~/lib/cards/card-sources";
import { LOREWARD_PLACES, LOREWARD_TYPES } from "~/lib/cards/economy-fields";
import {
  economySettings,
  recomputeValues,
  saveBonuses,
  saveCardValues,
  saveDailyImport,
  saveLorewardPayouts,
  saveMarket,
  saveRarityThresholds,
} from "~/server/modules/cards/cards.economy";
import { adminActor } from "./_actor";

// Inputs check only the shape. The bounds live in cards.economy, so a refusal shows its sentence rather than
// zod's issue list.
const value = z.number();

export const cardsAdminEconomyRouter = createTRPCRouter({
  get: adminProcedure.query(({ ctx }) => economySettings(ctx.db)),

  saveValues: adminProcedure
    .input(
      z
        .object({
          floorCommon: value,
          floorUncommon: value,
          floorRare: value,
          floorUltraRare: value,
          floorEpic: value,
          floorLegendary: value,
          nsPremium: value,
          multSpecial: value,
          multNation: value,
        })
        .partial()
    )
    .mutation(({ ctx, input }) => saveCardValues(ctx.db, adminActor(ctx), input)),

  recomputeValues: adminProcedure.mutation(({ ctx }) => recomputeValues(ctx.db, adminActor(ctx))),

  saveMarket: adminProcedure
    .input(z.object({ auctionHouseRakePct: value, maxInventoryCards: value }).partial())
    .mutation(({ ctx, input }) => saveMarket(ctx.db, adminActor(ctx), input)),

  saveBonuses: adminProcedure
    .input(
      z
        .object({
          enabled: value,
          newPlayer: value,
          nsPerCard: value,
          nsCap: value,
          achievementCommon: value,
          achievementUncommon: value,
          achievementRare: value,
          achievementEpic: value,
          achievementLegendary: value,
        })
        .partial()
    )
    .mutation(({ ctx, input }) => saveBonuses(ctx.db, adminActor(ctx), input)),

  saveLorewardPayouts: adminProcedure
    .input(
      z
        .array(
          z.object({
            type: z.enum(LOREWARD_TYPES),
            place: z.enum(LOREWARD_PLACES),
            credits: value,
          })
        )
        .max(LOREWARD_TYPES.length * LOREWARD_PLACES.length)
    )
    .mutation(({ ctx, input }) => saveLorewardPayouts(ctx.db, adminActor(ctx), input)),

  saveRarityThresholds: adminProcedure
    .input(
      z.object({
        source: cardWikiSourceSchema,
        thresholds: z.object({
          UNCOMMON: value,
          RARE: value,
          ULTRA_RARE: value,
          EPIC: value,
          LEGENDARY: value,
        }),
      })
    )
    .mutation(({ ctx, input }) => saveRarityThresholds(ctx.db, adminActor(ctx), input)),

  saveDailyImport: adminProcedure
    .input(
      z.object({
        source: cardArticleSourceSchema,
        setting: z.object({ enabled: z.boolean(), count: value }),
      })
    )
    .mutation(({ ctx, input }) => saveDailyImport(ctx.db, adminActor(ctx), input)),
});
