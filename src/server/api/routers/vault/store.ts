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
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { vaultService, getVaultConfig } from "~/lib/vault-service";
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

export const vaultStoreRouter = createTRPCRouter({
  /**
   * Get vault balance and stats for a user
   */
  getTransactions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        type: vaultTransactionTypeEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        const transactions = await vaultService.getTransactionHistory(
          ctx.auth.userId,
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
        console.error("[Vault Router] Error getting transactions:", error);
        throw new Error("Failed to retrieve transaction history");
      }
    }),

  /**
   * Claim daily login bonus
   */
  getPurchasedItems: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("Unauthorized");
      }
      const transactions = await ctx.db.vaultTransaction.findMany({
        where: {
          vault: { userId: ctx.auth.userId },
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
      console.error("[Vault Router] Error getting purchased items:", error);
      throw new Error("Failed to retrieve purchased items");
    }
  }),

  /**
   * Spend credits to purchase a storefront item (cosmetic or upgrade)
   */
  purchaseStoreItem: protectedProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("Unauthorized");
        }

        // 1. Fetch item definition from DB
        const item = await ctx.db.vaultStoreItem.findUnique({
          where: { id: input.itemId },
        });

        if (!item || !item.isActive) {
          throw new Error("Store item not found or inactive");
        }

        // 2. Fetch existing cosmetic/boost transactions to check if already owned
        const existingPurchases = await ctx.db.vaultTransaction.findMany({
          where: {
            vault: { userId: ctx.auth.userId },
            type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] },
          },
          select: { metadata: true },
        });

        const alreadyOwned = existingPurchases.some((tx) => {
          let meta = tx.metadata;
          if (typeof meta === "string") {
            try {
              meta = JSON.parse(meta);
            } catch {}
          }
          return meta && typeof meta === "object" && (meta as any).itemId === input.itemId;
        });

        if (alreadyOwned) {
          throw new Error("You already own this item");
        }

        // 3. Spend credits using vaultService helper
        const transactionType = item.category === "cosmetics" ? "SPEND_COSMETIC" : "SPEND_BOOST";
        const result = await vaultService.spendCredits(
          ctx.auth.userId,
          item.price,
          transactionType,
          `Purchase: ${item.name}`,
          ctx.db as any,
          { itemId: item.id }
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to purchase item");
        }

        return {
          success: true,
          message: `Successfully purchased ${item.name}!`,
          newBalance: result.newBalance,
        };
      } catch (error) {
        console.error("[Vault Router] purchaseStoreItem error:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to purchase store item");
      }
    }),

  /**
   * Get vault configuration for store prices and caps (accessible to all authenticated users)
   */
  getStoreConfig: protectedProcedure.query(async ({ ctx }) => {
    return getVaultConfig(ctx.db as any);
  }),

  // Get vault configuration (DB-backed)
  listStoreItems: protectedProcedure.query(async ({ ctx }) => {
    try {
      const items = await ctx.db.vaultStoreItem.findMany({
        where: { isActive: true },
        orderBy: { price: "asc" },
      });
      return items;
    } catch (error) {
      console.error("[Vault Router] listStoreItems error:", error);
      throw new Error("Failed to retrieve store items");
    }
  }),

  /**
   * Get currently equipped cosmetics for the logged-in user
   */
  getEquippedCosmetics: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("Unauthorized");
      }
      const vault = await ctx.db.myVault.findUnique({
        where: { userId: ctx.auth.userId },
        select: { equippedCosmetics: true },
      });
      const equipped = vault?.equippedCosmetics
        ? vault.equippedCosmetics.split(",").filter(Boolean)
        : [];
      return { success: true, equipped };
    } catch (error) {
      console.error("[Vault Router] getEquippedCosmetics error:", error);
      throw new Error("Failed to retrieve equipped cosmetics");
    }
  }),

  /**
   * Toggle equipped status of a cosmetic item for the logged-in user
   */
  toggleEquipCosmetic: protectedProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("Unauthorized");
        }

        // 1. Verify user owns the item
        const transactions = await ctx.db.vaultTransaction.findMany({
          where: {
            vault: { userId: ctx.auth.userId },
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
          throw new Error("You do not own this cosmetic item");
        }

        // 2. Fetch current equipped list
        const vault = await ctx.db.myVault.findUnique({
          where: { userId: ctx.auth.userId },
          select: { id: true, equippedCosmetics: true },
        });

        if (!vault) {
          throw new Error("Vault not found");
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
        console.error("[Vault Router] toggleEquipCosmetic error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to toggle equipped cosmetic"
        );
      }
    }),
});
