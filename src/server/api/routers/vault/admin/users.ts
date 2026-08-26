import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { vaultService } from "~/lib/vault/vault-service";
import { notificationAPI } from "~/lib/notifications/api";
import { type VaultTransactionType } from "@prisma/client";

/**
 * Vault transaction type enum for validation
 */
export const vaultTransactionTypeEnum = z.enum([
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

export const vaultAdminUsersRouter = createTRPCRouter({
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
        throw new Error("Failed to list user transactions", { cause: error });
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
        throw new Error("Failed to list vaults", { cause: error });
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
              message: `${formattedAmount} IxCredits by Administrator. Reason: ${input.reason}`,
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
        throw new Error("Failed to adjust credits", { cause: error });
      }
    }),
});
