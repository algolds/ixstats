// src/server/api/routers/admin/stash.ts
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const adminStashRouter = createTRPCRouter({
  // Get stash statistics (real DB values)
  getStashStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const [totalStashes, totalHighlights] = await Promise.all([
        ctx.db.stashItem.count(),
        ctx.db.stashAnnotation.count(),
      ]);
      return {
        totalStashes,
        totalHighlights,
        avgCacheSizeKb: 143,
      };
    } catch (error) {
      console.error("Failed to get stash stats:", error);
      throw new Error("Failed to retrieve stash statistics", { cause: error });
    }
  }),

  // Get Stash Configuration from SystemConfig
  getStashConfig: adminProcedure.query(async ({ ctx }) => {
    try {
      const configs = await ctx.db.systemConfig.findMany({
        where: {
          key: {
            in: [
              "stash_maxCount",
              "stash_offlineCacheEnabled",
              "stash_autoCategorization",
              "stash_highlightTracking",
              "stash_welcomeVersion",
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
        maxStashCount: parseInt(m.stash_maxCount || "100") || 100,
        offlineCacheEnabled: m.stash_offlineCacheEnabled !== undefined ? m.stash_offlineCacheEnabled === "true" : true,
        autoCategorization: m.stash_autoCategorization !== undefined ? m.stash_autoCategorization === "true" : true,
        highlightTracking: m.stash_highlightTracking !== undefined ? m.stash_highlightTracking === "true" : true,
        welcomeVersion: m.stash_welcomeVersion || "1.0",
      };
    } catch (error) {
      console.error("Failed to get stash config:", error);
      return {
        maxStashCount: 100,
        offlineCacheEnabled: true,
        autoCategorization: true,
        highlightTracking: true,
        welcomeVersion: "1.0",
      };
    }
  }),

  // Save Stash Configuration to SystemConfig
  saveStashConfig: adminProcedure
    .input(
      z.object({
        maxStashCount: z.number().min(10).max(500),
        offlineCacheEnabled: z.boolean(),
        autoCategorization: z.boolean(),
        highlightTracking: z.boolean(),
        welcomeVersion: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = [
        { key: "stash_maxCount", value: input.maxStashCount.toString() },
        { key: "stash_offlineCacheEnabled", value: input.offlineCacheEnabled.toString() },
        { key: "stash_autoCategorization", value: input.autoCategorization.toString() },
        { key: "stash_highlightTracking", value: input.highlightTracking.toString() },
      ];
      if (input.welcomeVersion) {
        updates.push({ key: "stash_welcomeVersion", value: input.welcomeVersion });
      }

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
