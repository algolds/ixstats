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
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, lightMutationProcedure, protectedProcedure } from "~/server/api/trpc";
import { vaultService } from "~/lib/vault/vault-service";
import { LedgerError, getOrCreateVault, spendCreditsTx } from "~/lib/vault/vault-ledger";
import { clearUserPerksCache } from "~/lib/vault/vault-perks";
import {
  countStorePurchases,
  isRepeatableStoreItem,
  storePrerequisiteMet,
} from "~/lib/vault/store-purchases";
import { globalCache } from "~/lib/cache";
import { type VaultTransactionType } from "@prisma/client";
import { resolveVaultUserId } from "./_resolveUserId";

const STORE_SPEND_TYPES: VaultTransactionType[] = ["SPEND_COSMETIC", "SPEND_BOOST"];

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
        throw new Error("Failed to retrieve transaction history", { cause: error });
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
      const userId = await resolveVaultUserId(ctx);
      const transactions = await ctx.db.vaultTransaction.findMany({
        where: {
          vault: { userId },
          type: { in: STORE_SPEND_TYPES },
        },
        select: {
          metadata: true,
        },
      });

      const purchaseCounts = countStorePurchases(transactions);
      const purchasedItemIds = new Set<string>(Object.keys(purchaseCounts));

      // Also ensure any currently equipped cosmetics are marked as owned
      const vault = await ctx.db.myVault.findUnique({
        where: { userId },
        select: { equippedCosmetics: true },
      });
      if (vault?.equippedCosmetics) {
        for (const id of vault.equippedCosmetics.split(",").filter(Boolean)) {
          purchasedItemIds.add(id);
          purchaseCounts[id] = Math.max(purchaseCounts[id] || 0, 1);
        }
      }

      return {
        success: true,
        purchasedItemIds: Array.from(purchasedItemIds),
        purchaseCounts,
      };
    } catch (error) {
      console.error("[Vault Router] Error getting purchased items:", error);
      throw new Error("Failed to retrieve purchased items", { cause: error });
    }
  }),

  /**
   * Buy a store item. The price, availability and prerequisites come from
   * `VaultStoreItem` on the server; the client only names the item.
   */
  purchaseStoreItem: lightMutationProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.vaultStoreItem.findUnique({ where: { id: input.itemId } });
      if (!item || !item.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This item is not available." });
      }

      const userId = await resolveVaultUserId(ctx);
      const type: VaultTransactionType = isRepeatableStoreItem(item.category)
        ? "SPEND_BOOST"
        : "SPEND_COSMETIC";

      try {
        const result = await ctx.db.$transaction(async (tx) => {
          const vault = await getOrCreateVault(userId, tx);
          // Serialize purchases per vault so the ownership and prerequisite checks can't race
          await tx.$queryRaw`SELECT id FROM "my_vault" WHERE id = ${vault.id} FOR UPDATE`;

          const purchaseCounts = countStorePurchases(
            await tx.vaultTransaction.findMany({
              where: { vaultId: vault.id, type: { in: STORE_SPEND_TYPES } },
              select: { metadata: true },
            })
          );
          const equipped = (vault.equippedCosmetics ?? "").split(",").filter(Boolean);

          if (
            !isRepeatableStoreItem(item.category) &&
            ((purchaseCounts[item.id] ?? 0) > 0 || equipped.includes(item.id))
          ) {
            throw new TRPCError({ code: "CONFLICT", message: "You already own this item." });
          }
          if (!storePrerequisiteMet(item.id, purchaseCounts)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "You don't meet the requirements for this item yet.",
            });
          }

          return spendCreditsTx(tx, {
            userId,
            amount: item.price,
            type,
            source: `Purchase item: ${item.name}`,
            metadata: { itemId: item.id, price: item.price },
          });
        });

        await globalCache.delete(`user_vault_balance:${ctx.auth.userId}`);
        clearUserPerksCache(userId);
        clearUserPerksCache(ctx.auth.userId);

        return {
          success: true,
          itemId: item.id,
          amountSpent: result.amount,
          newBalance: result.newBalance,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof LedgerError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        console.error("[Vault Router] purchaseStoreItem error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to complete the purchase.",
        });
      }
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
      throw new Error("Failed to retrieve store items", { cause: error });
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
      const userId = await resolveVaultUserId(ctx);
      const vault = await ctx.db.myVault.findUnique({
        where: { userId },
        select: { equippedCosmetics: true },
      });
      const equipped = vault?.equippedCosmetics
        ? vault.equippedCosmetics.split(",").filter(Boolean)
        : [];
      return { success: true, equipped };
    } catch (error) {
      console.error("[Vault Router] getEquippedCosmetics error:", error);
      throw new Error("Failed to retrieve equipped cosmetics", { cause: error });
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
        const userId = await resolveVaultUserId(ctx);

        // 1. Verify user owns the item
        const transactions = await ctx.db.vaultTransaction.findMany({
          where: {
            vault: { userId },
            type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] },
          },
          select: { metadata: true },
        });

        const ownsItem = transactions.some((tx) => {
          let meta = tx.metadata;
          if (typeof meta === "string") {
            try {
              meta = JSON.parse(meta);
            } catch {
              // non-JSON metadata — treated as no item match
            }
          }
          return meta && typeof meta === "object" && (meta as any).itemId === input.itemId;
        });

        // 2. Fetch current equipped list
        const vault = await ctx.db.myVault.findUnique({
          where: { userId },
          select: { id: true, equippedCosmetics: true },
        });

        if (!vault) {
          throw new Error("Vault not found");
        }

        const isCurrentlyEquipped = vault.equippedCosmetics
          ? vault.equippedCosmetics.split(",").includes(input.itemId)
          : false;

        if (!ownsItem && !isCurrentlyEquipped) {
          throw new Error("You do not own this cosmetic item");
        }

        const equipped = vault.equippedCosmetics
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
          error instanceof Error ? error.message : "Failed to toggle equipped cosmetic",
          { cause: error }
        );
      }
    }),
});
