// src/server/api/routers/cards/settings.ts
// Settings & Valuation sub-router for IxCards

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  getValuationConfig,
  recomputeAllCardValues,
  setValuationConfig,
  type CardValuationConfig,
} from "~/lib/cards";
import { getBonusConfig, setBonusConfig, type VaultBonusConfig } from "~/lib/vault";
import {
  getGeneralCardSettings,
  setGeneralCardSetting,
  type CardGeneralSettings,
} from "~/lib/cards";

export const cardsSettingsRouter = createTRPCRouter({
  // ─── Valuation Admin ─────────────────────────────────────────────

  /** Read the current card-valuation config (defaults overlaid with SystemConfig). */
  getValuationConfig: adminProcedure.query(async ({ ctx }) => {
    return getValuationConfig(ctx.db);
  }),

  /** Update valuation config fields, then recompute every card's value. */
  setValuationConfig: adminProcedure
    .input(
      z
        .object({
          floorCommon: z.number().min(0),
          floorUncommon: z.number().min(0),
          floorRare: z.number().min(0),
          floorUltraRare: z.number().min(0),
          floorEpic: z.number().min(0),
          floorLegendary: z.number().min(0),
          nsPremium: z.number().min(0),
          multSpecial: z.number().min(0),
          multNation: z.number().min(0),
          junkRate: z.number().min(0),
        })
        .partial()
    )
    .mutation(async ({ ctx, input }) => {
      for (const [field, value] of Object.entries(input)) {
        if (value != null) {
          await setValuationConfig(ctx.db, field as keyof CardValuationConfig, value);
        }
      }
      const result = await recomputeAllCardValues(ctx.db);
      return { config: await getValuationConfig(ctx.db), ...result };
    }),

  // ─── Metagame Bonus Admin ────────────────────────────────────────

  /** Read the current vault-bonus config (defaults overlaid with SystemConfig). */
  getBonusConfig: adminProcedure.query(async ({ ctx }) => {
    return getBonusConfig(ctx.db);
  }),

  /** Update vault-bonus config fields (new player, imports, achievements, lorewards). */
  setBonusConfig: adminProcedure
    .input(
      z
        .object({
          enabled: z.number().min(0).max(1),
          newPlayer: z.number().min(0),
          wikiImport: z.number().min(0),
          nsPerCard: z.number().min(0),
          nsCap: z.number().min(0),
          achievementCommon: z.number().min(0),
          achievementUncommon: z.number().min(0),
          achievementRare: z.number().min(0),
          achievementEpic: z.number().min(0),
          achievementLegendary: z.number().min(0),
          loreward: z.number().min(0),
        })
        .partial()
    )
    .mutation(async ({ ctx, input }) => {
      for (const [field, value] of Object.entries(input)) {
        if (value != null) {
          await setBonusConfig(ctx.db, field as keyof VaultBonusConfig, value);
        }
      }
      return getBonusConfig(ctx.db);
    }),

  // ─── General System Settings Admin ───────────────────────────────

  /** Read general card system settings. */
  getGeneralConfig: adminProcedure.query(async ({ ctx }) => {
    return getGeneralCardSettings(ctx.db);
  }),

  /** Update general card system settings. */
  setGeneralConfig: adminProcedure
    .input(
      z
        .object({
          tradingEnabled: z.number().min(0).max(1),
          auctionHouseRakePct: z.number().min(0).max(50),
          dailyFreePacks: z.number().min(0).max(100),
          dailyPackCooldownHours: z.number().min(0).max(168),
          allowPlayerMinting: z.number().min(0).max(1),
          maxInventoryCards: z.number().min(10).max(100000),
          maxJunkBatchSize: z.number().min(1).max(1000),
          autoGenerateLoreThumbnails: z.number().min(0).max(1),
        })
        .partial()
    )
    .mutation(async ({ ctx, input }) => {
      for (const [field, value] of Object.entries(input)) {
        if (value != null) {
          await setGeneralCardSetting(ctx.db, field as keyof CardGeneralSettings, value);
        }
      }
      return getGeneralCardSettings(ctx.db);
    }),
});
