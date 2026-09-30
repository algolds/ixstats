/**
 * lorewards.ts — Lorewards tRPC router.
 * Public endpoints for leaderboards, user stats, award history, and article badges.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const lorewardsCalendarsRouter = createTRPCRouter({
  /** Streak calendar — day-by-day award status for a month. */
  getStreakCalendar: publicProcedure
    .input(
      z.object({
        username: z.string().min(1).max(200),
        year: z.number().min(2020).max(2030),
        month: z.number().min(1).max(12),
      })
    )
    .query(async ({ input }) => {
      const monthStr = String(input.month).padStart(2, "0");
      const prefix = `${input.year}-${monthStr}`;

      const entries = await db.lorewardEntry.findMany({
        where: {
          date: { startsWith: prefix },
          type: "daily",
          status: "approved",
          OR: [{ winnerUser: input.username }, { runnerUpUser: input.username }],
        },
      });

      const days: Record<number, "winner" | "runner-up"> = {};
      for (const e of entries) {
        const day = parseInt(e.date.slice(8, 10), 10);
        if (e.winnerUser === input.username) {
          days[day] = "winner";
        } else if (!days[day]) {
          days[day] = "runner-up";
        }
      }

      return { year: input.year, month: input.month, days };
    }),
});
