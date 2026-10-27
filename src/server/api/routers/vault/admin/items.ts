import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  countStorePurchases,
  isRevokedPurchase,
  purchasedItemId,
  revokedPurchaseMetadata,
} from "~/lib/vault/store-purchases";
import { clearUserPerksCache } from "~/lib/vault/vault-perks";
import { toggleEquippedCosmetic } from "../_equippedCosmetics";

export const vaultAdminItemsRouter = createTRPCRouter({
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
                  handle: true,
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

      return txs.map((tx) => {
        const buyer = tx.vault.user;
        return {
          id: tx.id,
          credits: tx.credits,
          balanceAfter: tx.balanceAfter,
          type: tx.type,
          source: tx.source,
          itemId: purchasedItemId(tx.metadata) ?? "",
          createdAt: tx.createdAt,
          user: {
            id: buyer.id,
            // The nation, then the passport handle, then the Clerk id; never an old wiki name.
            displayName: buyer.country?.name ?? buyer.handle ?? buyer.clerkUserId,
            flag: buyer.country?.flag,
          },
        };
      });
    } catch (error) {
      console.error("[Vault Router] adminGetPurchaseLogs error:", error);
      throw new Error("Failed to retrieve purchase logs", { cause: error });
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

        return {
          success: true,
          purchasedItemIds: Object.keys(countStorePurchases(transactions)),
        };
      } catch (error) {
        console.error("[Vault Admin Router] Error getting user purchased items:", error);
        throw new Error("Failed to retrieve purchased items for user", { cause: error });
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

        const alreadyOwned = (countStorePurchases(transactions)[input.itemId] ?? 0) > 0;

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
        throw new Error(error instanceof Error ? error.message : "Failed to grant item", {
          cause: error,
        });
      }
    }),

  /**
   * Admin: Revoke a storefront item from a user. The purchase rows stay in the ledger (so it
   * still sums to the balance and the audit trail keeps them), marked revoked so they grant
   * nothing; a zero-credit ADMIN_ADJUSTMENT row records the revoke, and the item is unequipped.
   * Nothing is refunded (the admin console offers none); a refund is a separate adjustment.
   */
  adminRevokeStoreItem: adminProcedure
    .input(z.object({ userId: z.string().min(1), itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { clerkUserId: true },
        });
        const item = await ctx.db.vaultStoreItem.findUnique({
          where: { id: input.itemId },
          select: { name: true },
        });
        await ctx.db.$transaction(async (tx) => {
          const found = await tx.myVault.findUnique({
            where: { userId: input.userId },
            select: { id: true },
          });
          if (!found) throw new Error("User vault not found");
          // Lock the vault so the balance and the equipped list below are current
          await tx.$queryRaw`SELECT id FROM "my_vault" WHERE id = ${found.id} FOR UPDATE`;
          const vault = await tx.myVault.findUniqueOrThrow({ where: { id: found.id } });

          const purchases = (
            await tx.vaultTransaction.findMany({
              where: { vaultId: vault.id, type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] } },
              select: { id: true, metadata: true },
            })
          ).filter(
            (row) =>
              purchasedItemId(row.metadata) === input.itemId && !isRevokedPurchase(row.metadata)
          );
          if (purchases.length === 0) {
            throw new Error("User does not own this item");
          }

          const adminUserId = ctx.auth?.userId ?? null;
          for (const row of purchases) {
            await tx.vaultTransaction.update({
              where: { id: row.id },
              data: { metadata: revokedPurchaseMetadata(row.metadata, adminUserId) },
            });
          }
          await tx.vaultTransaction.create({
            data: {
              vaultId: vault.id,
              credits: 0,
              balanceAfter: vault.credits,
              type: "ADMIN_ADJUSTMENT",
              source: `Admin Revoke: ${item?.name ?? input.itemId}`,
              metadata: JSON.stringify({
                revokedItemId: input.itemId,
                sourceTransactionIds: purchases.map((row) => row.id),
                adminUserId,
              }),
            },
          });

          // Equipped cosmetics also read as owned, so take it off
          const equipped = (vault.equippedCosmetics ?? "").split(",").filter(Boolean);
          if (equipped.includes(input.itemId)) {
            await tx.myVault.update({
              where: { id: vault.id },
              data: { equippedCosmetics: equipped.filter((id) => id !== input.itemId).join(",") },
            });
          }
        });
        // Perks (capacity, yield) are cached per user id and per Clerk id
        clearUserPerksCache(input.userId);
        if (user?.clerkUserId) clearUserPerksCache(user.clerkUserId);

        return { success: true, message: "Successfully revoked item from user." };
      } catch (error) {
        console.error("[Vault Admin Router] Error revoking item:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to revoke item", {
          cause: error,
        });
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
        throw new Error("Failed to retrieve equipped cosmetics for user", { cause: error });
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

        if ((countStorePurchases(transactions)[input.itemId] ?? 0) === 0) {
          throw new Error("User does not own this cosmetic item");
        }

        return await toggleEquippedCosmetic(ctx.db, vault, input.itemId);
      } catch (error) {
        console.error("[Vault Admin Router] adminToggleEquipCosmetic error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to toggle user equipped cosmetic",
          { cause: error }
        );
      }
    }),
});
