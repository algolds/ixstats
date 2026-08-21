import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { getVaultConfig, invalidateVaultConfigCache } from "~/lib/vault";
import { getCurrentIxCardSeason, setCurrentIxCardSeason } from "~/lib/cards";

export const vaultAdminStoreRouter = createTRPCRouter({
  /**
   * Get list of purchased items for current user (profile customization, upgrades, etc.)
   */
  adminGetVaultConfig: adminProcedure.query(async ({ ctx }) => {
    return getVaultConfig(ctx.db);
  }),

  // Save vault configuration
  adminSaveVaultConfig: adminProcedure
    .input(
      z.object({
        activeDailyCap: z.number().min(1).max(10000),
        socialDailyCap: z.number().min(1).max(10000),
        xpPerLevel: z.number().min(100).max(100000),
        maxStreakBonus: z.number().min(1).max(365),
        premiumMultiplier: z.number().min(0.1).max(10),
        priceGoldenProfileGlow: z.number().min(0).max(100000),
        priceNeonCyberFrame: z.number().min(0).max(100000),
        priceEliteChatBadge: z.number().min(0).max(100000),
        priceLoreRequestToken: z.number().min(0).max(100000),
        priceCardCapacity: z.number().min(0).max(100000),
        pricePassiveYieldBoost: z.number().min(0).max(100000),
        isEarningEnabled: z.boolean(),
        isTradingEnabled: z.boolean(),
        isAuctionsEnabled: z.boolean(),
        isStoreEnabled: z.boolean(),
        isCraftingEnabled: z.boolean(),
        isPacksEnabled: z.boolean(),
        isMaintenanceMode: z.boolean(),
        exemptStaffFromLimit: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const configUpdates: { key: string; value: string }[] = [
          { key: "vault_activeDailyCap", value: input.activeDailyCap.toString() },
          { key: "vault_socialDailyCap", value: input.socialDailyCap.toString() },
          { key: "vault_xpPerLevel", value: input.xpPerLevel.toString() },
          { key: "vault_maxStreakBonus", value: input.maxStreakBonus.toString() },
          { key: "vault_premiumMultiplier", value: input.premiumMultiplier.toString() },
          { key: "vault_priceGoldenProfileGlow", value: input.priceGoldenProfileGlow.toString() },
          { key: "vault_priceNeonCyberFrame", value: input.priceNeonCyberFrame.toString() },
          { key: "vault_priceEliteChatBadge", value: input.priceEliteChatBadge.toString() },
          { key: "vault_priceLoreRequestToken", value: input.priceLoreRequestToken.toString() },
          { key: "vault_priceCardCapacity", value: input.priceCardCapacity.toString() },
          { key: "vault_pricePassiveYieldBoost", value: input.pricePassiveYieldBoost.toString() },
          { key: "vault_isEarningEnabled", value: input.isEarningEnabled.toString() },
          { key: "vault_isTradingEnabled", value: input.isTradingEnabled.toString() },
          { key: "vault_isAuctionsEnabled", value: input.isAuctionsEnabled.toString() },
          { key: "vault_isStoreEnabled", value: input.isStoreEnabled.toString() },
          { key: "vault_isCraftingEnabled", value: input.isCraftingEnabled.toString() },
          { key: "vault_isPacksEnabled", value: input.isPacksEnabled.toString() },
          { key: "vault_isMaintenanceMode", value: input.isMaintenanceMode.toString() },
          { key: "vault_exemptStaffFromLimit", value: input.exemptStaffFromLimit.toString() },
        ];

        await ctx.db.$transaction(
          configUpdates.map((config) =>
            ctx.db.systemConfig.upsert({
              where: { key: config.key },
              update: { value: config.value, updatedAt: new Date() },
              create: {
                key: config.key,
                value: config.value,
                description: `Vault configuration for ${config.key}`,
              },
            })
          )
        );

        invalidateVaultConfigCache();

        return { success: true, message: "Vault configuration saved successfully" };
      } catch (error) {
        console.error("[Vault Router] adminSaveVaultConfig error:", error);
        throw new Error("Failed to save vault configuration");
      }
    }),

  /**
   * Public/Protected: List active store items. Seeds if database table is empty.
   */
  adminListStoreItemsAll: adminProcedure.query(async ({ ctx }) => {
    try {
      const items = await ctx.db.vaultStoreItem.findMany({
        orderBy: { createdAt: "desc" },
      });
      return items;
    } catch (error) {
      console.error("[Vault Router] adminListStoreItemsAll error:", error);
      throw new Error("Failed to retrieve admin store items");
    }
  }),

  /**
   * Admin: Create a new store item.
   */
  adminCreateStoreItem: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        price: z.number().min(0, "Price must be non-negative"),
        icon: z.string().default("Sparkles"),
        glowColor: z.string().optional(),
        quality: z.string().default("COMMON"),
        badgeText: z.string().optional(),
        category: z.string().default("cosmetics"),
        effects: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("Unauthorized");
        }

        const newItem = await ctx.db.vaultStoreItem.create({
          data: {
            name: input.name,
            description: input.description,
            price: input.price,
            icon: input.icon,
            glowColor: input.glowColor ?? "rgba(245,158,11,0.35)",
            quality: input.quality,
            badgeText: input.badgeText ?? "Custom Item",
            category: input.category,
            effects: input.effects ?? undefined,
            isActive: true,
          },
        });

        await ctx.db.vaultStorePriceHistory.create({
          data: {
            itemId: newItem.id,
            price: newItem.price,
            adminId: ctx.auth.userId,
            adminName: "Admin",
          },
        });

        return { success: true, item: newItem };
      } catch (error) {
        console.error("[Vault Router] adminCreateStoreItem error:", error);
        throw new Error("Failed to create store item");
      }
    }),

  /**
   * Admin: Update an existing store item.
   */
  adminUpdateStoreItem: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        price: z.number().min(0, "Price must be non-negative"),
        icon: z.string().default("Sparkles"),
        glowColor: z.string().optional(),
        quality: z.string().default("COMMON"),
        badgeText: z.string().optional(),
        category: z.string().default("cosmetics"),
        isActive: z.boolean().default(true),
        effects: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("Unauthorized");
        }

        const existing = await ctx.db.vaultStoreItem.findUnique({
          where: { id: input.id },
        });

        if (!existing) {
          throw new Error("Store item not found");
        }

        const updated = await ctx.db.vaultStoreItem.update({
          where: { id: input.id },
          data: {
            name: input.name,
            description: input.description,
            price: input.price,
            icon: input.icon,
            glowColor: input.glowColor ?? "rgba(245,158,11,0.35)",
            quality: input.quality,
            badgeText: input.badgeText ?? "Custom Item",
            category: input.category,
            isActive: input.isActive,
            ...(input.effects !== undefined && { effects: input.effects }),
          },
        });

        if (existing.price !== input.price) {
          await ctx.db.vaultStorePriceHistory.create({
            data: {
              itemId: updated.id,
              price: updated.price,
              adminId: ctx.auth.userId,
              adminName: "Admin",
            },
          });
        }

        return { success: true, item: updated };
      } catch (error) {
        console.error("[Vault Router] adminUpdateStoreItem error:", error);
        throw new Error("Failed to update store item");
      }
    }),

  /**
   * Admin: Delete or soft-delete a store item.
   */
  adminDeleteStoreItem: adminProcedure
    .input(
      z.object({
        id: z.string(),
        hardDelete: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.hardDelete) {
          await ctx.db.vaultStoreItem.delete({
            where: { id: input.id },
          });
        } else {
          await ctx.db.vaultStoreItem.update({
            where: { id: input.id },
            data: { isActive: false },
          });
        }
        return { success: true };
      } catch (error) {
        console.error("[Vault Router] adminDeleteStoreItem error:", error);
        throw new Error("Failed to delete store item");
      }
    }),

  /**
   * Admin: Get price history log for a store item.
   */
  adminGetPriceHistory: adminProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.db.vaultStorePriceHistory.findMany({
          where: { itemId: input.itemId },
          orderBy: { changedAt: "desc" },
        });
      } catch (error) {
        console.error("[Vault Router] adminGetPriceHistory error:", error);
        throw new Error("Failed to retrieve price history");
      }
    }),

  /**
   * Admin: Get all storefront purchase transactions.
   */
  getIxCardSeason: protectedProcedure.query(async ({ ctx }) => {
    return getCurrentIxCardSeason(ctx.db);
  }),

  adminGetIxCardSeason: adminProcedure.query(async ({ ctx }) => {
    return getCurrentIxCardSeason(ctx.db);
  }),

  adminSetIxCardSeason: adminProcedure
    .input(z.object({ season: z.number().int().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await setCurrentIxCardSeason(ctx.db, input.season);
      return { success: true, season: input.season };
    }),
});
