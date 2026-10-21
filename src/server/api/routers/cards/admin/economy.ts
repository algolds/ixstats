import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { cardArticleSourceSchema, cardWikiSourceSchema } from "~/lib/cards/card-sources";
import type { CardEconomyConfig } from "~/lib/cards/economy-config";
import { LOREWARD_PLACES, LOREWARD_TYPES } from "~/lib/vault/loreward-places";
import {
  economySettings,
  recomputeValues,
  saveBonuses,
  saveCardValues,
  saveDailyImport,
  saveEconomy,
  saveLorewardPayouts,
  saveMarket,
  saveRarityThresholds,
} from "~/server/modules/cards/cards.economy";
import { adminActor } from "~/server/shared/admin-actor";

// Inputs check only the shape. The bounds live in cards.economy, so a refusal shows its sentence rather than
// zod's issue list.
const value = z.number();

/** Every card economy number, so none is dropped as an unknown key. */
const economyShape = {
  finishFoilPct: value,
  finishHoloPct: value,
  dailyCommonPct: value,
  dailyUncommonPct: value,
  dailyRarePct: value,
  dailyUltraRarePct: value,
  dailyEpicPct: value,
  dailyLegendaryPct: value,
  dustCommon: value,
  dustUncommon: value,
  dustRare: value,
  dustUltraRare: value,
  dustEpic: value,
  dustLegendary: value,
  dustFoilMult: value,
  dustHoloMult: value,
  dustImportMult: value,
  fusionCopies: value,
  craftDustMult: value,
  listingFee: value,
  listingFeeFeatured: value,
  listingRefundPct: value,
  listingDays: value,
  saleFeeThreshold: value,
  royaltyPct: value,
  xpPack: value,
  xpDaily: value,
  xpTradePerCard: value,
  xpAuctionWin: value,
  xpHoldingTick: value,
  xpDailyCapPerCopy: value,
} satisfies Record<keyof CardEconomyConfig, typeof value>;

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
          multTrophy: value,
          finishFoil: value,
          finishHolo: value,
          levelBonusPerLevel: value,
          levelBonusCap: value,
          medianSales: value,
          medianDays: value,
        })
        .partial()
    )
    .mutation(({ ctx, input }) => saveCardValues(ctx.db, adminActor(ctx), input)),

  recomputeValues: adminProcedure.mutation(({ ctx }) => recomputeValues(ctx.db, adminActor(ctx))),

  saveMarket: adminProcedure
    .input(z.object({ auctionHouseRakePct: value, maxInventoryCards: value }).partial())
    .mutation(({ ctx, input }) => saveMarket(ctx.db, adminActor(ctx), input)),

  saveEconomy: adminProcedure
    .input(z.object(economyShape).partial())
    .mutation(({ ctx, input }) => saveEconomy(ctx.db, adminActor(ctx), input)),

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
