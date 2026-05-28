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
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedPublicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { vaultService, getVaultConfig, invalidateVaultConfigCache } from "~/lib/vault-service";
import { budgetVaultCalculator } from "~/lib/budget-vault-calculator";
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

export const vaultRouter = createTRPCRouter({
  /**
   * Get vault balance and stats for a user
   */
  getBalance: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const balance = await vaultService.getBalance(input.userId, ctx.db as any);
        return balance;
      } catch (error) {
        console.error("[Vault Router] Error getting balance:", error);
        throw new Error("Failed to retrieve vault balance");
      }
    }),

  /**
   * Get transaction history with pagination
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
  claimDailyBonus: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const result = await vaultService.claimDailyBonus(ctx.auth.userId, ctx.db as any);

      if (!result.success) {
        throw new Error(result.message || "Failed to claim daily bonus");
      }

      // Notification: daily bonus claimed (fire-and-forget)
      try {
        await notificationAPI.create({
          userId: ctx.auth.userId,
          title: "Daily Bonus Claimed",
          message: `+${result.bonus} IxC! ${result.streak}-day streak`,
          type: "info",
          category: "achievement",
          priority: "low",
          metadata: { bonus: result.bonus, streak: result.streak },
        });
      } catch {}

      return {
        success: true,
        bonus: result.bonus,
        streak: result.streak,
        message: `Claimed ${result.bonus} IxC! Streak: ${result.streak} days`,
      };
    } catch (error) {
      console.error("[Vault Router] Error claiming daily bonus:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to claim daily bonus");
    }
  }),

  /**
   * Claim streak bonus (updates login streak)
   */
  claimStreakBonus: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const newStreak = await vaultService.updateLoginStreak(ctx.auth.userId, ctx.db as any);

      return {
        success: true,
        streak: newStreak,
        message: `Login streak updated: ${newStreak} days`,
      };
    } catch (error) {
      console.error("[Vault Router] Error claiming streak bonus:", error);
      throw new Error("Failed to update login streak");
    }
  }),

  /**
   * Spend IxCredits
   */
  spendCredits: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(0.01, "Amount must be positive"),
        type: vaultTransactionTypeEnum,
        source: z.string().min(1, "Source is required"),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        // Validate spending type
        if (!input.type.startsWith("SPEND_") && input.type !== "ADMIN_ADJUSTMENT") {
          throw new Error("Invalid transaction type for spending");
        }

        const result = await vaultService.spendCredits(
          ctx.auth.userId,
          input.amount,
          input.type as VaultTransactionType,
          input.source,
          ctx.db as any,
          input.metadata
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to spend credits");
        }

        return {
          success: true,
          newBalance: result.newBalance,
          amountSpent: input.amount,
          message: `Spent ${input.amount} IxC. New balance: ${result.newBalance} IxC`,
        };
      } catch (error) {
        console.error("[Vault Router] Error spending credits:", error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Failed to spend credits");
      }
    }),

  /**
   * Get vault level
   */
  getVaultLevel: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const balance = await vaultService.getBalance(input.userId, ctx.db as any);

        return {
          vaultLevel: balance.vaultLevel,
          vaultXp: balance.vaultXp,
          nextLevelXp: balance.vaultLevel * 1000,
          progress: (balance.vaultXp % 1000) / 1000,
        };
      } catch (error) {
        console.error("[Vault Router] Error getting vault level:", error);
        throw new Error("Failed to retrieve vault level");
      }
    }),

  /**
   * Get today's earnings summary
   */
  getEarningsSummary: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const summary = await vaultService.getEarningsSummary(ctx.auth.userId, ctx.db as any);

      return summary;
    } catch (error) {
      console.error("[Vault Router] Error getting earnings summary:", error);
      throw new Error("Failed to retrieve earnings summary");
    }
  }),

  /**
   * Get today's earnings breakdown by source
   */
  getTodayEarnings: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const summary = await vaultService.getEarningsSummary(ctx.auth.userId, ctx.db as any);

      // Format source labels for display
      const formatSourceLabel = (source: string): string => {
        const labels: Record<string, string> = {
          EARN_PASSIVE: "Passive Income",
          EARN_ACTIVE: "Active Gameplay",
          EARN_CARDS: "Card Activities",
          EARN_SOCIAL: "Social Engagement",
          DAILY_LOGIN: "Daily Bonus",
        };
        return labels[source] || source.replace(/_/g, " ");
      };

      const sources = Object.entries(summary.breakdown).map(([type, amount]) => ({
        type,
        label: formatSourceLabel(type),
        amount,
      }));

      return {
        total: summary.total,
        sources,
        transactionCount: summary.transactionCount,
      };
    } catch (error) {
      console.error("[Vault Router] Error getting today's earnings:", error);
      throw new Error("Failed to retrieve today's earnings");
    }
  }),

  /**
   * Calculate passive income for a country
   */
  calculatePassiveIncome: protectedProcedure
    .input(
      z.object({
        countryId: z.string().min(1, "Country ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const dailyDividend = await vaultService.calculatePassiveIncome(
          input.countryId,
          ctx.db as any
        );

        return {
          countryId: input.countryId,
          dailyDividend,
          weeklyDividend: dailyDividend * 7,
          monthlyDividend: dailyDividend * 30,
        };
      } catch (error) {
        console.error("[Vault Router] Error calculating passive income:", error);
        throw new Error("Failed to calculate passive income");
      }
    }),

  /**
   * Check daily earning cap
   */
  checkDailyCap: protectedProcedure
    .input(
      z.object({
        earnType: z.enum(["EARN_ACTIVE", "EARN_SOCIAL"]),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        const capCheck = await vaultService.checkDailyCap(
          ctx.auth.userId,
          input.earnType,
          ctx.db as any
        );

        return capCheck;
      } catch (error) {
        console.error("[Vault Router] Error checking daily cap:", error);
        throw new Error("Failed to check daily earning cap");
      }
    }),

  /**
   * Earn IxCredits (internal use by other systems)
   * Admin-only endpoint
   */
  earnCredits: adminProcedure
    .input(
      z.object({
        amount: z.number().min(0.01, "Amount must be positive"),
        type: vaultTransactionTypeEnum,
        source: z.string().min(1, "Source is required"),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        // Validate earning type
        if (!input.type.startsWith("EARN_") && input.type !== "ADMIN_ADJUSTMENT") {
          throw new Error("Invalid transaction type for earning");
        }

        const result = await vaultService.earnCredits(
          ctx.auth.userId,
          input.amount,
          input.type as VaultTransactionType,
          input.source,
          ctx.db as any,
          input.metadata
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to earn credits");
        }

        return {
          success: true,
          newBalance: result.newBalance,
          amountEarned: input.amount,
          message: `Earned ${input.amount} IxC. New balance: ${result.newBalance} IxC`,
        };
      } catch (error) {
        console.error("[Vault Router] Error earning credits:", error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Failed to earn credits");
      }
    }),

  /**
   * Admin: Adjust a user's login streak (absolute delta applied)
   */
  adminAdjustStreak: adminProcedure
    .input(
      z.object({
        targetUserId: z.string().min(1),
        delta: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Ensure target user exists (upsert vault if missing)
        let vault = await ctx.db.myVault.findUnique({ where: { userId: input.targetUserId } });
        if (!vault) {
          vault = await ctx.db.myVault.create({
            data: {
              userId: input.targetUserId,
              credits: 0,
              lifetimeEarned: 0,
              lifetimeSpent: 0,
              todayEarned: 0,
              lastDailyReset: new Date(),
              loginStreak: 0,
              vaultLevel: 1,
              vaultXp: 0,
            },
          });
        }

        const newStreak = Math.max(0, (vault.loginStreak ?? 0) + input.delta);

        await ctx.db.myVault.update({ where: { id: vault.id }, data: { loginStreak: newStreak } });

        return { success: true, newStreak };
      } catch (error) {
        console.error("[Vault Router] Error adjusting streak:", error);
        throw new Error("Failed to adjust user streak");
      }
    }),

  /**
   * Admin: List user vault transactions
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
  getUserStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.user?.id) {
        throw new Error("User not found in authentication context");
      }

      return {
        totalCards: ctx.user.totalCards ?? 0,
        deckValue: ctx.user.deckValue ?? 0,
        collectorLevel: ctx.user.collectorLevel ?? 1,
        collectorXp: ctx.user.collectorXp ?? 0,
      };
    } catch (error) {
      console.error("[Vault Router] Error getting user stats:", error);
      throw new Error("Failed to retrieve user stats");
    }
  }),

  /**
   * Get budget multiplier for passive income
   * Admin-only endpoint
   */
  getBudgetMultiplier: adminProcedure
    .input(
      z.object({
        countryId: z.string().min(1, "Country ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const multiplier = await budgetVaultCalculator.calculateBudgetMultiplier(
          input.countryId,
          ctx.db as any
        );
        const description = budgetVaultCalculator.getMultiplierDescription(multiplier);

        return {
          countryId: input.countryId,
          multiplier,
          description,
          percentChange: Math.round((multiplier - 1.0) * 100),
        };
      } catch (error) {
        console.error("[Vault Router] Error getting budget multiplier:", error);
        throw new Error("Failed to retrieve budget multiplier");
      }
    }),

  /**
   * Get detailed budget multiplier breakdown by department
   * Admin-only endpoint
   */
  getBudgetMultiplierBreakdown: adminProcedure
    .input(
      z.object({
        countryId: z.string().min(1, "Country ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const breakdown = await budgetVaultCalculator.getBudgetBreakdown(
          input.countryId,
          ctx.db as any
        );
        const totalMultiplier = await budgetVaultCalculator.calculateBudgetMultiplier(
          input.countryId,
          ctx.db as any
        );

        return {
          countryId: input.countryId,
          totalMultiplier,
          breakdown,
          totalCategories: breakdown.length,
        };
      } catch (error) {
        console.error("[Vault Router] Error getting budget breakdown:", error);
        throw new Error("Failed to retrieve budget multiplier breakdown");
      }
    }),

  // ============================================
  // COLLECTION SOCIAL FEATURES
  // ============================================

  /**
   * Get public collections (browse all)
   * Public endpoint with rate limiting
   */
  getPublicCollections: rateLimitedPublicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
        sortBy: z
          .enum(["newest", "mostValuable", "mostCards", "topRated"])
          .optional()
          .default("newest"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { limit, offset, sortBy } = input;

        // Build order by clause
        let orderBy: any = { createdAt: "desc" };
        if (sortBy === "newest") orderBy = { createdAt: "desc" };
        if (sortBy === "mostValuable") orderBy = { updatedAt: "desc" }; // Placeholder for value
        if (sortBy === "mostCards") orderBy = { updatedAt: "desc" }; // Placeholder for card count
        if (sortBy === "topRated") orderBy = { updatedAt: "desc" }; // Placeholder for likes

        const collections = await ctx.db.cardCollection.findMany({
          where: {
            isPublic: true,
          },
          include: {
            User: {
              select: {
                id: true,
                clerkUserId: true,
              },
            },
          },
          orderBy,
          skip: offset,
          take: limit,
        });

        const total = await ctx.db.cardCollection.count({
          where: { isPublic: true },
        });

        return {
          collections,
          total,
          hasMore: offset + limit < total,
        };
      } catch (error) {
        console.error("[Vault Router] Error getting public collections:", error);
        throw new Error("Failed to retrieve public collections");
      }
    }),

  /**
   * Get collection leaderboard
   * Public endpoint with rate limiting
   */
  getCollectionLeaderboard: rateLimitedPublicProcedure
    .input(
      z.object({
        category: z.enum(["mostValuable", "mostComplete", "mostCards"]),
        limit: z.number().min(1).max(50).optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Placeholder: In production, calculate actual values
        // For now, return sorted by updatedAt
        const collections = await ctx.db.cardCollection.findMany({
          where: {
            isPublic: true,
          },
          include: {
            User: {
              select: {
                id: true,
                clerkUserId: true,
              },
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: input.limit,
        });

        return {
          category: input.category,
          collections: collections.map((c, index) => ({
            ...c,
            rank: index + 1,
            value: 0, // Placeholder
            completeness: 0, // Placeholder
            cardCount: 0, // Placeholder
          })),
        };
      } catch (error) {
        console.error("[Vault Router] Error getting collection leaderboard:", error);
        throw new Error("Failed to retrieve collection leaderboard");
      }
    }),

  /**
   * Like/unlike a collection
   * Protected endpoint
   */
  likeCollection: protectedProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
        unlike: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Note: Collection likes would need a CollectionLike model in schema
        // For now, return success placeholder
        return {
          success: true,
          liked: !input.unlike,
          collectionId: input.collectionId,
          message: input.unlike ? "Collection unliked" : "Collection liked",
        };
      } catch (error) {
        console.error("[Vault Router] Error liking collection:", error);
        throw new Error("Failed to like collection");
      }
    }),

  /**
   * Add comment to collection
   * Protected endpoint
   */
  addCollectionComment: protectedProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
        content: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found");
        }

        // Note: Collection comments would need a CollectionComment model in schema
        // For now, return success placeholder
        return {
          success: true,
          comment: {
            id: `comment_${Date.now()}`,
            collectionId: input.collectionId,
            userId: ctx.auth.userId,
            content: input.content,
            createdAt: new Date(),
          },
        };
      } catch (error) {
        console.error("[Vault Router] Error adding comment:", error);
        throw new Error("Failed to add comment");
      }
    }),

  /**
   * Get comments for a collection
   * Public endpoint with rate limiting
   */
  getCollectionComments: rateLimitedPublicProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Note: Collection comments would need a CollectionComment model in schema
        // For now, return empty array placeholder
        return {
          comments: [],
          total: 0,
          hasMore: false,
        };
      } catch (error) {
        console.error("[Vault Router] Error getting comments:", error);
        throw new Error("Failed to retrieve comments");
      }
    }),

  /**
   * Get collection details with stats
   * Public endpoint for viewing any public collection
   */
  getCollectionDetails: rateLimitedPublicProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const collection = await ctx.db.cardCollection.findUnique({
          where: {
            id: input.collectionId,
          },
          include: {
            User: {
              select: {
                id: true,
                clerkUserId: true,
              },
            },
          },
        });

        if (!collection) {
          throw new Error("Collection not found");
        }

        // Check if public or if user owns it
        if (!collection.isPublic && collection.userId !== ctx.auth?.userId) {
          throw new Error("Collection is private");
        }

        return {
          collection,
          stats: {
            cardCount: 0, // Placeholder
            totalValue: 0, // Placeholder
            likes: 0, // Placeholder
            comments: 0, // Placeholder
          },
        };
      } catch (error) {
        console.error("[Vault Router] Error getting collection details:", error);
        throw new Error("Failed to retrieve collection details");
      }
    }),

  /**
   * List all user vaults for admin credit controls
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
        if (tx.metadata && typeof tx.metadata === "object") {
          const meta = tx.metadata as Record<string, any>;
          if (meta.itemId && typeof meta.itemId === "string") {
            purchasedItemIds.add(meta.itemId);
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
   * Get vault configuration for store prices and caps (accessible to all authenticated users)
   */
  getStoreConfig: protectedProcedure.query(async ({ ctx }) => {
    return getVaultConfig(ctx.db as any);
  }),

  // Get vault configuration (DB-backed)
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
  listStoreItems: protectedProcedure.query(async ({ ctx }) => {
    try {
      let items = await ctx.db.vaultStoreItem.findMany({
        where: { isActive: true },
        orderBy: { price: "asc" },
      });
      if (items.length === 0) {
        await seedVaultStoreItems(ctx.db);
        items = await ctx.db.vaultStoreItem.findMany({
          where: { isActive: true },
          orderBy: { price: "asc" },
        });
      }
      return items;
    } catch (error) {
      console.error("[Vault Router] listStoreItems error:", error);
      throw new Error("Failed to retrieve store items");
    }
  }),

  /**
   * Admin: List all store items, including inactive ones. Seeds if empty.
   */
  adminListStoreItemsAll: adminProcedure.query(async ({ ctx }) => {
    try {
      let items = await ctx.db.vaultStoreItem.findMany({
        orderBy: { createdAt: "desc" },
      });
      if (items.length === 0) {
        await seedVaultStoreItems(ctx.db);
        items = await ctx.db.vaultStoreItem.findMany({
          orderBy: { createdAt: "desc" },
        });
      }
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
        if (tx.metadata && typeof tx.metadata === "object") {
          const meta = tx.metadata as Record<string, any>;
          itemId = meta.itemId || "";
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
});

/**
 * Helper function to seed dynamic VaultStoreItem database table if empty.
 */
async function seedVaultStoreItems(db: any) {
  const standardItems = [
    {
      id: "cosmetic_gold_glow",
      name: "Golden Profile Glow",
      description: "Adds a premium golden aura surrounding your user badges and avatar.",
      price: 500,
      icon: "Sparkles",
      glowColor: "rgba(245,158,11,0.35)",
      quality: "EPIC",
      badgeText: "Badge Custom",
      category: "cosmetics",
      isActive: true,
    },
    {
      id: "cosmetic_neon_frame",
      name: "Neon Cyber Frame",
      description: "Wraps your card profiles with a neon-glowing futuristic cybernetic border.",
      price: 750,
      icon: "Cpu",
      glowColor: "rgba(59,130,246,0.35)",
      quality: "RARE",
      badgeText: "Card Border",
      category: "cosmetics",
      isActive: true,
    },
    {
      id: "cosmetic_chat_badge",
      name: "Elite Chat Badge",
      description: "Displays a premium golden crown symbol next to your name in community grids.",
      price: 1000,
      icon: "Crown",
      glowColor: "rgba(168,85,247,0.35)",
      quality: "EPIC",
      badgeText: "Profile Title",
      category: "cosmetics",
      isActive: true,
    },
    {
      id: "upgrade_lore_token",
      name: "Lore Request Token",
      description:
        "Grants 1 submission token to request a custom lore card using any Wiki Article.",
      price: 2500,
      icon: "BookOpen",
      glowColor: "rgba(59,130,246,0.35)",
      quality: "RARE",
      badgeText: "Lore Token",
      category: "upgrades",
      isActive: true,
    },
    {
      id: "upgrade_card_capacity",
      name: "Card Capacity +50",
      description: "Permanently expands your personal vault collection limit by +50 cards.",
      price: 5000,
      icon: "Database",
      glowColor: "rgba(245,158,11,0.35)",
      quality: "LEGENDARY",
      badgeText: "Capacity Boost",
      category: "upgrades",
      isActive: true,
    },
    {
      id: "upgrade_yield_boost",
      name: "Passive Yield Boost (+5%)",
      description:
        "Adds a permanent +5% multiplier to all passive daily credit allowance earnings.",
      price: 5000,
      icon: "TrendingUp",
      glowColor: "rgba(245,158,11,0.35)",
      quality: "LEGENDARY",
      badgeText: "Yield Multiplier",
      category: "upgrades",
      isActive: true,
    },
  ];

  for (const item of standardItems) {
    await db.vaultStoreItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }
}
