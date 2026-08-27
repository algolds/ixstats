// src/server/api/routers/admin/thinkpages.ts
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const adminThinkpagesRouter = createTRPCRouter({
  // Get ThinkPages statistics (real DB values)
  getThinkPagesStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const [totalPosts, totalAccounts] = await Promise.all([
        ctx.db.thinkpagesPost.count(),
        ctx.db.thinkpagesAccount.count(),
      ]);

      // Calculate weekly engagement growth (real DB ratio of posts in last 7 days vs previous 7 days)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const [postsThisWeek, postsLastWeek] = await Promise.all([
        ctx.db.thinkpagesPost.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
        ctx.db.thinkpagesPost.count({
          where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
        }),
      ]);

      let weeklyGrowth = 0.0;
      if (postsLastWeek > 0) {
        weeklyGrowth = ((postsThisWeek - postsLastWeek) / postsLastWeek) * 100;
      } else if (postsThisWeek > 0) {
        weeklyGrowth = 100.0;
      }

      return {
        totalPosts,
        totalAccounts,
        weeklyGrowth: parseFloat(weeklyGrowth.toFixed(1)),
      };
    } catch (error) {
      console.error("Failed to get thinkpages stats:", error);
      throw new Error("Failed to retrieve ThinkPages statistics", { cause: error });
    }
  }),

  // Get ThinkPages Configuration from SystemConfig
  getThinkPagesConfig: adminProcedure.query(async ({ ctx }) => {
    try {
      const configs = await ctx.db.systemConfig.findMany({
        where: {
          key: {
            in: [
              "thinkpages_maxAccountsPerUser",
              "thinkpages_maxCharLength",
              "thinkpages_autoNewsElections",
              "thinkpages_autoNewsPolicies",
              "thinkpages_commentAttachments",
              "thinkpages_feedLimit",
            ],
          },
        },
      });

      const m = configs.reduce(
        (acc, c) => {
          acc[c.key] = c.value;
          return acc;
        },
        {} as Record<string, string>
      );

      return {
        maxAccountsPerUser: parseInt(m.thinkpages_maxAccountsPerUser || "25") || 25,
        maxCharLength: parseInt(m.thinkpages_maxCharLength || "2000") || 2000,
        autoNewsElections:
          m.thinkpages_autoNewsElections !== undefined
            ? m.thinkpages_autoNewsElections === "true"
            : true,
        autoNewsPolicies:
          m.thinkpages_autoNewsPolicies !== undefined
            ? m.thinkpages_autoNewsPolicies === "true"
            : true,
        commentAttachments:
          m.thinkpages_commentAttachments !== undefined
            ? m.thinkpages_commentAttachments === "true"
            : true,
        feedLimit: parseInt(m.thinkpages_feedLimit || "100") || 100,
      };
    } catch (error) {
      console.error("Failed to get thinkpages config:", error);
      return {
        maxAccountsPerUser: 25,
        maxCharLength: 2000,
        autoNewsElections: true,
        autoNewsPolicies: true,
        commentAttachments: true,
        feedLimit: 100,
      };
    }
  }),

  // Save ThinkPages Configuration to SystemConfig
  saveThinkPagesConfig: adminProcedure
    .input(
      z.object({
        maxAccountsPerUser: z.number().min(1).max(100),
        maxCharLength: z.number().min(280).max(10000),
        autoNewsElections: z.boolean(),
        autoNewsPolicies: z.boolean(),
        commentAttachments: z.boolean(),
        feedLimit: z.number().min(10).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = [
        { key: "thinkpages_maxAccountsPerUser", value: input.maxAccountsPerUser.toString() },
        { key: "thinkpages_maxCharLength", value: input.maxCharLength.toString() },
        { key: "thinkpages_autoNewsElections", value: input.autoNewsElections.toString() },
        { key: "thinkpages_autoNewsPolicies", value: input.autoNewsPolicies.toString() },
        { key: "thinkpages_commentAttachments", value: input.commentAttachments.toString() },
        { key: "thinkpages_feedLimit", value: input.feedLimit.toString() },
      ];

      await Promise.all(
        updates.map((u) =>
          ctx.db.systemConfig.upsert({
            where: { key: u.key },
            update: { value: u.value },
            create: { key: u.key, value: u.value },
          })
        )
      );

      return { success: true };
    }),
});
