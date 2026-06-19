/**
 * MyVault Router
 *
 * tRPC router for IxCredits economy operations
 * Provides endpoints for:
 * - Balance queries
 * - Transaction history
 * - Daily bonuses and streaks
 * - Credit spending
 * - Vault level and earnings summaries
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { vaultService, getVaultConfig, invalidateVaultConfigCache } from "~/lib/vault-service";
import { getCurrentIxCardSeason, setCurrentIxCardSeason } from "~/lib/ixcard-season";
import { notificationAPI } from "~/lib/notification-api";
import { type VaultTransactionType } from "@prisma/client";

/**
 * Vault transaction type enum for validation
 */
const vaultTransactionTypeEnum = z.enum([
  "EARN_PASSIVE",
  "EARN_ACTIVE",
  "EARN_CARDS",
  "EARN_SOCIAL",
  "SPEND_PACKS",
  "SPEND_MARKET",
  "SPEND_CRAFT",
  "SPEND_BOOST",
  "SPEND_COSMETIC",
  "ADMIN_ADJUSTMENT",
]);

export const vaultAdminRouter = createTRPCRouter({
  /**
   * Get vault balance and stats for a user
   */
  adminListUserTransactions: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        type: vaultTransactionTypeEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const transactions = await vaultService.getTransactionHistory(
          input.userId,
          ctx.db as any,
          input.limit,
          input.offset,
          input.type as VaultTransactionType | undefined
        );

        return {
          transactions,
          count: transactions.length,
          hasMore: transactions.length === input.limit,
        };
      } catch (error) {
        console.error("[Vault Router] Error listing user transactions:", error);
        throw new Error("Failed to list user transactions");
      }
    }),

  /**
   * Get user stats (totalCards, deckValue)
   */
  adminListVaults: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const whereClause: any = {};
        if (input.search && input.search.trim()) {
          const s = input.search.trim();
          whereClause.OR = [
            { id: { contains: s, mode: "insensitive" } },
            { clerkUserId: { contains: s, mode: "insensitive" } },
            { forumUsername: { contains: s, mode: "insensitive" } },
            { wikiUsername: { contains: s, mode: "insensitive" } },
            { discordUsername: { contains: s, mode: "insensitive" } },
          ];
        }

        const users = await ctx.db.user.findMany({
          where: whereClause,
          include: {
            vault: true,
            country: { select: { id: true, name: true, flag: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { createdAt: "desc" },
        });

        const total = await ctx.db.user.count({ where: whereClause });

        return {
          users: users.map((u) => ({
            id: u.id,
            clerkUserId: u.clerkUserId,
            forumUsername: u.forumUsername,
            discordUsername: u.discordUsername,
            wikiUsername: u.wikiUsername,
            country: u.country,
            vault: u.vault || {
              credits: 0,
              lifetimeEarned: 0,
              lifetimeSpent: 0,
              vaultLevel: 1,
              vaultXp: 0,
              loginStreak: 0,
            },
          })),
          total,
        };
      } catch (error) {
        console.error("[Vault Router] adminListVaults error:", error);
        throw new Error("Failed to list vaults");
      }
    }),

  /**
   * Adjust credits for a user (add/subtract) with optional alert
   */
  adminAdjustCredits: adminProcedure
    .input(
      z.object({
        targetUserId: z.string().min(1, "Target User ID is required"),
        amount: z.number().refine((v) => v !== 0, "Amount cannot be zero"),
        type: vaultTransactionTypeEnum.default("ADMIN_ADJUSTMENT"),
        source: z.string().min(1, "Source description is required"),
        reason: z.string().min(1, "Reason is required"),
        sendNotification: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const metadata = {
          adminUserId: ctx.auth?.userId,
          reason: input.reason,
          timestamp: new Date().toISOString(),
        };

        let result;
        if (input.amount > 0) {
          result = await vaultService.earnCredits(
            input.targetUserId,
            input.amount,
            input.type as VaultTransactionType,
            input.source,
            ctx.db as any,
            metadata
          );
        } else {
          result = await vaultService.spendCredits(
            input.targetUserId,
            Math.abs(input.amount),
            input.type as VaultTransactionType,
            input.source,
            ctx.db as any,
            metadata
          );
        }

        if (!result.success) {
          throw new Error(result.message || "Failed to adjust credits");
        }

        // Send alert/notification if requested
        if (input.sendNotification) {
          try {
            const formattedAmount = input.amount > 0 ? `+${input.amount}` : `${input.amount}`;
            await notificationAPI.create({
              userId: input.targetUserId,
              title: "Credits Adjusted",
              message: `${formattedAmount} IxC by Administrator. Reason: ${input.reason}`,
              type: "info",
              category: "achievement",
              priority: "high",
              metadata: { amount: input.amount, reason: input.reason },
            });
          } catch (e) {
            console.error("[Vault Router] Failed to send credit adjustment notification:", e);
          }
        }

        return {
          success: true,
          newBalance: result.newBalance,
          message: `Successfully adjusted credits by ${input.amount}. New balance: ${result.newBalance}`,
        };
      } catch (error) {
        console.error("[Vault Router] adminAdjustCredits error:", error);
        if (error instanceof Error) throw error;
        throw new Error("Failed to adjust credits");
      }
    }),

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

  adminGetPurchaseLogs: adminProcedure.query(async ({ ctx }) => {
    try {
      const txs = await ctx.db.vaultTransaction.findMany({
        where: {
          type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] },
        },
        include: {
          vault: {
            include: {
              user: {
                select: {
                  id: true,
                  wikiUsername: true,
                  clerkUserId: true,
                  country: {
                    select: {
                      name: true,
                      flag: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return txs.map((tx: any) => {
        let itemId = "";
        let meta = tx.metadata;
        if (typeof meta === "string") {
          try {
            meta = JSON.parse(meta);
          } catch {}
        }
        if (meta && typeof meta === "object") {
          const metaObj = meta as Record<string, any>;
          itemId = metaObj.itemId || "";
        }
        return {
          id: tx.id,
          credits: tx.credits,
          balanceAfter: tx.balanceAfter,
          type: tx.type,
          source: tx.source,
          itemId,
          createdAt: tx.createdAt,
          user: {
            id: tx.vault.user?.id,
            displayName:
              tx.vault.user?.country?.name ??
              tx.vault.user?.wikiUsername ??
              tx.vault.user?.clerkUserId ??
              "Unknown User",
            flag: tx.vault.user?.country?.flag,
          },
        };
      });
    } catch (error) {
      console.error("[Vault Router] adminGetPurchaseLogs error:", error);
      throw new Error("Failed to retrieve purchase logs");
    }
  }),

  /**
   * Admin: Get purchased items for a specific user
   */
  adminGetPurchasedItems: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const transactions = await ctx.db.vaultTransaction.findMany({
          where: {
            vault: { userId: input.userId },
            type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] },
          },
          select: {
            metadata: true,
          },
        });

        const purchasedItemIds = new Set<string>();
        for (const tx of transactions) {
          let meta = tx.metadata;
          if (typeof meta === "string") {
            try {
              meta = JSON.parse(meta);
            } catch {}
          }
          if (meta && typeof meta === "object") {
            const metaObj = meta as Record<string, any>;
            if (metaObj.itemId && typeof metaObj.itemId === "string") {
              purchasedItemIds.add(metaObj.itemId);
            }
          }
        }

        return {
          success: true,
          purchasedItemIds: Array.from(purchasedItemIds),
        };
      } catch (error) {
        console.error("[Vault Admin Router] Error getting user purchased items:", error);
        throw new Error("Failed to retrieve purchased items for user");
      }
    }),

  /**
   * Admin: Grant a storefront item to a user (creating a free transaction)
   */
  adminGrantStoreItem: adminProcedure
    .input(z.object({ userId: z.string().min(1), itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const item = await ctx.db.vaultStoreItem.findUnique({
          where: { id: input.itemId },
        });
        if (!item) throw new Error("Store item not found");

        const vault = await ctx.db.myVault.findUnique({
          where: { userId: input.userId },
        });
        if (!vault) throw new Error("User vault not found");

        // Check if already owned
        const transactions = await ctx.db.vaultTransaction.findMany({
          where: {
            vaultId: vault.id,
            type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] },
          },
        });

        const alreadyOwned = transactions.some((tx) => {
          let meta = tx.metadata;
          if (typeof meta === "string") {
            try {
              meta = JSON.parse(meta);
            } catch {}
          }
          return meta && typeof meta === "object" && (meta as any).itemId === input.itemId;
        });

        if (alreadyOwned) {
          throw new Error("User already owns this item");
        }

        const transactionType = item.category === "cosmetics" ? "SPEND_COSMETIC" : "SPEND_BOOST";
        await ctx.db.vaultTransaction.create({
          data: {
            vaultId: vault.id,
            credits: 0,
            balanceAfter: vault.credits,
            type: transactionType,
            source: `Admin Grant: ${item.name}`,
            metadata: { itemId: item.id },
          },
        });

        return { success: true, message: `Successfully granted ${item.name} to user.` };
      } catch (error) {
        console.error("[Vault Admin Router] Error granting item:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to grant item");
      }
    }),

  /**
   * Admin: Revoke a storefront item from a user (deletes its purchase transaction)
   */
  adminRevokeStoreItem: adminProcedure
    .input(z.object({ userId: z.string().min(1), itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const vault = await ctx.db.myVault.findUnique({
          where: { userId: input.userId },
        });
        if (!vault) throw new Error("User vault not found");

        const transactions = await ctx.db.vaultTransaction.findMany({
          where: {
            vaultId: vault.id,
            type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] },
          },
        });

        const toDeleteIds: string[] = [];
        for (const tx of transactions) {
          let meta = tx.metadata;
          if (typeof meta === "string") {
            try {
              meta = JSON.parse(meta);
            } catch {}
          }
          if (meta && typeof meta === "object" && (meta as any).itemId === input.itemId) {
            toDeleteIds.push(tx.id);
          }
        }

        if (toDeleteIds.length === 0) {
          throw new Error("User does not own this item");
        }

        await ctx.db.vaultTransaction.deleteMany({
          where: { id: { in: toDeleteIds } },
        });

        return { success: true, message: "Successfully revoked item from user." };
      } catch (error) {
        console.error("[Vault Admin Router] Error revoking item:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to revoke item");
      }
    }),

  /**
   * Admin: Get currently equipped cosmetics for a specific user
   */
  adminGetEquippedCosmetics: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const vault = await ctx.db.myVault.findUnique({
          where: { userId: input.userId },
          select: { equippedCosmetics: true },
        });
        const equipped = vault?.equippedCosmetics
          ? vault.equippedCosmetics.split(",").filter(Boolean)
          : [];
        return { success: true, equipped };
      } catch (error) {
        console.error("[Vault Admin Router] adminGetEquippedCosmetics error:", error);
        throw new Error("Failed to retrieve equipped cosmetics for user");
      }
    }),

  /**
   * Admin: Toggle equipped status of a cosmetic item for a specific user
   */
  adminToggleEquipCosmetic: adminProcedure
    .input(z.object({ userId: z.string().min(1), itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch user vault
        const vault = await ctx.db.myVault.findUnique({
          where: { userId: input.userId },
          select: { id: true, equippedCosmetics: true },
        });
        if (!vault) throw new Error("User vault not found");

        // Verify ownership
        const transactions = await ctx.db.vaultTransaction.findMany({
          where: {
            vaultId: vault.id,
            type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] },
          },
          select: { metadata: true },
        });

        const ownsItem = transactions.some((tx) => {
          let meta = tx.metadata;
          if (typeof meta === "string") {
            try {
              meta = JSON.parse(meta);
            } catch {}
          }
          return meta && typeof meta === "object" && (meta as any).itemId === input.itemId;
        });

        if (!ownsItem) {
          throw new Error("User does not own this cosmetic item");
        }

        let equipped = vault.equippedCosmetics
          ? vault.equippedCosmetics.split(",").filter(Boolean)
          : [];

        const index = equipped.indexOf(input.itemId);
        let isEquipped = false;
        if (index > -1) {
          equipped.splice(index, 1);
        } else {
          equipped.push(input.itemId);
          isEquipped = true;
        }

        const nextEquipped = equipped.join(",");
        await ctx.db.myVault.update({
          where: { id: vault.id },
          data: { equippedCosmetics: nextEquipped },
        });

        return {
          success: true,
          isEquipped,
          equipped,
        };
      } catch (error) {
        console.error("[Vault Admin Router] adminToggleEquipCosmetic error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to toggle user equipped cosmetic"
        );
      }
    }),
});
