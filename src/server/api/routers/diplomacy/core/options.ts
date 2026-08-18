import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import {
  STRATEGIC_PRIORITIES,
  PARTNERSHIP_GOALS,
  KEY_ACHIEVEMENTS,
} from "~/lib/diplomacy/profile-options";

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticCoreOptionsRouter = createTRPCRouter({
  /**
   * Get diplomatic options from database with fallback to hardcoded values
   * Supports filtering by type and category
   */
  getDiplomaticOptions: publicProcedure
    .input(
      z.object({
        type: z.enum(["strategic_priority", "partnership_goal", "key_achievement"]).optional(),
        category: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Build where clause for filtering
        const where: {
          type?: string;
          category?: string;
          isActive: boolean;
        } = {
          isActive: true,
        };

        if (input.type) {
          where.type = input.type;
        }

        if (input.category) {
          where.category = input.category;
        }

        // Fetch from database
        const dbOptions = await ctx.db.diplomaticOption.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
        });

        // If database has options, return them
        if (dbOptions.length > 0) {
          return dbOptions.map((opt) => ({
            id: opt.id,
            type: opt.type,
            value: opt.value,
            category: opt.category,
            description: opt.description,
            sortOrder: opt.sortOrder,
          }));
        }

        // Fallback to hardcoded values if database is empty
        const getFallbackOptions = () => {
          const allOptions: Array<{ type: string; value: string; category?: string }> = [];

          // Add strategic priorities
          if (!input.type || input.type === "strategic_priority") {
            STRATEGIC_PRIORITIES.forEach((priority) => {
              allOptions.push({
                type: "strategic_priority",
                value: priority,
                category: determineCategoryFromValue(priority),
              });
            });
          }

          // Add partnership goals
          if (!input.type || input.type === "partnership_goal") {
            PARTNERSHIP_GOALS.forEach((goal) => {
              allOptions.push({
                type: "partnership_goal",
                value: goal,
                category: determineCategoryFromValue(goal),
              });
            });
          }

          // Add key achievements
          if (!input.type || input.type === "key_achievement") {
            KEY_ACHIEVEMENTS.forEach((achievement) => {
              allOptions.push({
                type: "key_achievement",
                value: achievement,
                category: determineCategoryFromValue(achievement),
              });
            });
          }

          // Filter by category if specified
          if (input.category) {
            return allOptions.filter((opt) => opt.category === input.category);
          }

          return allOptions;
        };

        return getFallbackOptions();
      } catch (error) {
        console.error("Error fetching diplomatic options:", error);
        // On error, fall back to hardcoded values
        const fallbackOptions: Array<{ type: string; value: string; category?: string }> = [];

        if (!input.type || input.type === "strategic_priority") {
          STRATEGIC_PRIORITIES.forEach((priority) => {
            fallbackOptions.push({
              type: "strategic_priority",
              value: priority,
              category: determineCategoryFromValue(priority),
            });
          });
        }

        if (!input.type || input.type === "partnership_goal") {
          PARTNERSHIP_GOALS.forEach((goal) => {
            fallbackOptions.push({
              type: "partnership_goal",
              value: goal,
              category: determineCategoryFromValue(goal),
            });
          });
        }

        if (!input.type || input.type === "key_achievement") {
          KEY_ACHIEVEMENTS.forEach((achievement) => {
            fallbackOptions.push({
              type: "key_achievement",
              value: achievement,
              category: determineCategoryFromValue(achievement),
            });
          });
        }

        if (input.category) {
          return fallbackOptions.filter((opt) => opt.category === input.category);
        }

        return fallbackOptions;
      }
    }),

  /**
   * Get all active diplomatic options across all types
   * Useful for admin interfaces or bulk operations
   */
  getAllDiplomaticOptions: publicProcedure.query(async ({ ctx }) => {
    try {
      // Fetch all active options from database
      const dbOptions = await ctx.db.diplomaticOption.findMany({
        where: { isActive: true },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { value: "asc" }],
      });

      // If database has options, return them grouped by type
      if (dbOptions.length > 0) {
        const grouped = {
          strategic_priority: dbOptions.filter((opt) => opt.type === "strategic_priority"),
          partnership_goal: dbOptions.filter((opt) => opt.type === "partnership_goal"),
          key_achievement: dbOptions.filter((opt) => opt.type === "key_achievement"),
        };

        return {
          strategicPriorities: grouped.strategic_priority.map((opt) => opt.value),
          partnershipGoals: grouped.partnership_goal.map((opt) => opt.value),
          keyAchievements: grouped.key_achievement.map((opt) => opt.value),
          source: "database" as const,
        };
      }

      // Fallback to hardcoded values
      return {
        strategicPriorities: Array.from(STRATEGIC_PRIORITIES),
        partnershipGoals: Array.from(PARTNERSHIP_GOALS),
        keyAchievements: Array.from(KEY_ACHIEVEMENTS),
        source: "fallback" as const,
      };
    } catch (error) {
      console.error("Error fetching all diplomatic options:", error);
      // On error, return hardcoded values
      return {
        strategicPriorities: Array.from(STRATEGIC_PRIORITIES),
        partnershipGoals: Array.from(PARTNERSHIP_GOALS),
        keyAchievements: Array.from(KEY_ACHIEVEMENTS),
        source: "fallback" as const,
      };
    }
  }),

  /**
   * Get analytics on diplomatic option usage
   * Admin-only endpoint for understanding option popularity and usage patterns
   */
  getOptionUsageStats: adminProcedure.query(async ({ ctx }) => {
    try {
      // Get all options with usage counts
      const options = await ctx.db.diplomaticOption.findMany({
        include: {
          usage: {
            where: { removedAt: null },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Calculate usage counts
      const optionsWithStats = options.map((option) => ({
        id: option.id,
        type: option.type,
        value: option.value,
        category: option.category,
        isActive: option.isActive,
        currentUsageCount: option.usage.length,
        createdAt: option.createdAt,
      }));

      // Get top 10 most used options
      const topOptions = [...optionsWithStats]
        .sort((a, b) => b.currentUsageCount - a.currentUsageCount)
        .slice(0, 10);

      // Get least used options (candidates for deprecation)
      const leastUsedOptions = optionsWithStats
        .filter((opt) => opt.isActive)
        .sort((a, b) => a.currentUsageCount - b.currentUsageCount)
        .slice(0, 10);

      // Get usage by category
      const categoryStats = optionsWithStats.reduce(
        (acc, option) => {
          const cat = option.category || "Uncategorized";
          if (!acc[cat]) {
            acc[cat] = { count: 0, totalUsage: 0 };
          }
          acc[cat].count++;
          acc[cat].totalUsage += option.currentUsageCount;
          return acc;
        },
        {} as Record<string, { count: number; totalUsage: number }>
      );

      // Get usage by type
      const typeStats = optionsWithStats.reduce(
        (acc, option) => {
          if (!acc[option.type]) {
            acc[option.type] = { count: 0, totalUsage: 0 };
          }
          acc[option.type].count++;
          acc[option.type].totalUsage += option.currentUsageCount;
          return acc;
        },
        {} as Record<string, { count: number; totalUsage: number }>
      );

      // Get usage trends over last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUsage = await ctx.db.diplomaticOptionUsage.findMany({
        where: {
          selectedAt: {
            gte: thirtyDaysAgo,
          },
        },
        orderBy: { selectedAt: "asc" },
      });

      // Group by day
      const usageByDay = recentUsage.reduce(
        (acc, usage) => {
          const day = usage.selectedAt.toISOString().split("T")[0]!;
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Get total statistics
      const totalOptions = options.length;
      const activeOptions = options.filter((o) => o.isActive).length;
      const totalUsageRecords = await ctx.db.diplomaticOptionUsage.count({
        where: { removedAt: null },
      });

      return {
        summary: {
          totalOptions,
          activeOptions,
          inactiveOptions: totalOptions - activeOptions,
          totalCurrentUsage: totalUsageRecords,
        },
        topOptions,
        leastUsedOptions,
        categoryStats,
        typeStats,
        usageTrends: Object.entries(usageByDay).map(([date, count]) => ({
          date,
          count,
        })),
      };
    } catch (error) {
      console.error("Error fetching option usage stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch option usage statistics",
      });
    }
  }),
});

// Helper function to determine category from option value
function determineCategoryFromValue(value: string): string {
  const lowerValue = value.toLowerCase();

  // Economic & Trade keywords
  if (
    lowerValue.includes("economic") ||
    lowerValue.includes("trade") ||
    lowerValue.includes("investment") ||
    lowerValue.includes("market") ||
    lowerValue.includes("financial") ||
    lowerValue.includes("agricultural")
  ) {
    return "Economic";
  }

  // Military & Security keywords
  if (
    lowerValue.includes("military") ||
    lowerValue.includes("defense") ||
    lowerValue.includes("security") ||
    lowerValue.includes("intelligence") ||
    lowerValue.includes("counter-terrorism") ||
    lowerValue.includes("border") ||
    lowerValue.includes("maritime") ||
    lowerValue.includes("cybersecurity")
  ) {
    return "Military";
  }

  // Technology & Innovation keywords
  if (
    lowerValue.includes("technology") ||
    lowerValue.includes("research") ||
    lowerValue.includes("innovation") ||
    lowerValue.includes("digital") ||
    lowerValue.includes("space") ||
    lowerValue.includes("artificial intelligence") ||
    lowerValue.includes("telecommunications") ||
    lowerValue.includes("ai ")
  ) {
    return "Technology";
  }

  // Cultural & Social keywords
  if (
    lowerValue.includes("cultural") ||
    lowerValue.includes("educational") ||
    lowerValue.includes("scientific") ||
    lowerValue.includes("healthcare") ||
    lowerValue.includes("sports") ||
    lowerValue.includes("media") ||
    lowerValue.includes("student") ||
    lowerValue.includes("scholar") ||
    lowerValue.includes("artist") ||
    lowerValue.includes("festival") ||
    lowerValue.includes("language") ||
    lowerValue.includes("heritage")
  ) {
    return "Cultural";
  }

  // Environmental & Energy keywords
  if (
    lowerValue.includes("climate") ||
    lowerValue.includes("energy") ||
    lowerValue.includes("renewable") ||
    lowerValue.includes("environmental") ||
    lowerValue.includes("sustainable") ||
    lowerValue.includes("water") ||
    lowerValue.includes("conservation") ||
    lowerValue.includes("emission") ||
    lowerValue.includes("circular economy")
  ) {
    return "Environmental";
  }

  // Diplomatic & Political keywords
  if (
    lowerValue.includes("diplomatic") ||
    lowerValue.includes("regional") ||
    lowerValue.includes("humanitarian") ||
    lowerValue.includes("conflict") ||
    lowerValue.includes("democratic") ||
    lowerValue.includes("governance") ||
    lowerValue.includes("embassy") ||
    lowerValue.includes("consulate") ||
    lowerValue.includes("ambassadorial") ||
    lowerValue.includes("state visit") ||
    lowerValue.includes("summit") ||
    lowerValue.includes("partnership") ||
    lowerValue.includes("crisis") ||
    lowerValue.includes("mediation") ||
    lowerValue.includes("refugee")
  ) {
    return "Diplomatic";
  }

  // Default category
  return "General";
}
