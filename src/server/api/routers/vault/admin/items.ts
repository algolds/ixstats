import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

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
        throw new Error(error instanceof Error ? error.message : "Failed to grant item", {
          cause: error,
        });
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
        console.error("[Vault Admin Router] adminToggleEquipCosmetic error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to toggle user equipped cosmetic",
          { cause: error }
        );
      }
    }),
});
