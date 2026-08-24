// src/server/api/routers/admin/cron.ts
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { invalidateConfigCache } from "~/lib/config-service";

export const adminCronRouter = createTRPCRouter({
  getCronSchedules: adminProcedure.query(async ({ ctx }) => {
    const keys = [
      "cronSchedule_lorewardsScoring",
      "cronSchedule_passiveIncome",
      "cronSchedule_cardValue",
    ];
    const configs = await ctx.db.systemConfig.findMany({
      where: { key: { in: keys } },
    });
    const schedules = configs.reduce(
      (acc, config) => {
        acc[config.key] = config.value;
        return acc;
      },
      {
        cronSchedule_lorewardsScoring: "0 6 * * *",
        cronSchedule_passiveIncome: "0 0 * * *",
        cronSchedule_cardValue: "0 */6 * * *",
      } as Record<string, string>
    );
    return schedules;
  }),

  saveCronSchedules: adminProcedure
    .input(
      z.object({
        cronSchedule_lorewardsScoring: z.string(),
        cronSchedule_passiveIncome: z.string(),
        cronSchedule_cardValue: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = Object.entries(input).map(([key, value]) => ({
        key,
        value: value.trim(),
      }));
      await ctx.db.$transaction(
        updates.map((cfg) =>
          ctx.db.systemConfig.upsert({
            where: { key: cfg.key },
            update: { value: cfg.value, updatedAt: new Date() },
            create: {
              key: cfg.key,
              value: cfg.value,
              description: `Cron schedule expression for ${cfg.key}`,
            },
          })
        )
      );
      invalidateConfigCache();
      return { success: true };
    }),
});
