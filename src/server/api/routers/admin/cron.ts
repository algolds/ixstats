// src/server/api/routers/admin/cron.ts
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { invalidateConfigCache } from "~/lib/config-service";
import { readConfigKeys, writeConfigKeys } from "./_config-kv";

const CRON_SCHEDULE_DEFAULTS: Record<string, string> = {
  cronSchedule_lorewardsScoring: "0 6 * * *",
  cronSchedule_passiveIncome: "0 0 * * *",
  cronSchedule_cardValue: "0 */6 * * *",
};

export const adminCronRouter = createTRPCRouter({
  getCronSchedules: adminProcedure.query(async ({ ctx }) => {
    const stored = await readConfigKeys(ctx.db, Object.keys(CRON_SCHEDULE_DEFAULTS));
    return { ...CRON_SCHEDULE_DEFAULTS, ...stored };
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
      const updates = Object.entries(input).map(([key, value]) => ({ key, value: value.trim() }));
      await writeConfigKeys(ctx.db, updates, (key) => `Cron schedule expression for ${key}`);
      invalidateConfigCache();
      return { success: true };
    }),
});
