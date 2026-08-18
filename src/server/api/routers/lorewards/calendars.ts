/**
 * lorewards.ts — Lorewards tRPC router.
 * Public endpoints for leaderboards, user stats, award history, and article badges.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { syncCurrentWinners } from "~/lib/lorewards";

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

  // ---------------------------------------------------------------------------
  // WikiOS Scoring Engine + Cross-Validation
  // ---------------------------------------------------------------------------

  /** Rolling 12-month calendar for a user. */
  getRollingStreakCalendar: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const dateStr = oneYearAgo.toISOString().slice(0, 10);

      const entries = await db.lorewardEntry.findMany({
        where: {
          date: { gte: dateStr },
          type: "daily",
          status: "approved",
          OR: [{ winnerUser: input.username }, { runnerUpUser: input.username }],
        },
        orderBy: { date: "asc" },
      });

      const days: Record<
        string,
        { role: "winner" | "runner-up"; page: string | null; score: number }
      > = {};
      for (const e of entries) {
        if (e.winnerUser === input.username) {
          days[e.date] = {
            role: "winner",
            page: e.winnerPage,
            score: e.winnerScore || 0,
          };
        } else if (e.runnerUpUser === input.username) {
          days[e.date] = {
            role: "runner-up",
            page: e.runnerUpPage,
            score: e.runnerUpScore || 0,
          };
        }
      }

      return days;
    }),

  /** Monthly Winners Calendar */
  getWinnersCalendar: publicProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
      })
    )
    .query(async ({ input }) => {
      await syncCurrentWinners();
      const monthStr = String(input.month).padStart(2, "0");
      const prefix = `${input.year}-${monthStr}`;

      const entries = await db.lorewardEntry.findMany({
        where: {
          date: { startsWith: prefix },
          type: "daily",
          status: "approved",
        },
      });

      // Gather all usernames for batch lookup
      const usernamesSet = new Set<string>();
      for (const e of entries) {
        if (e.winnerUser) usernamesSet.add(e.winnerUser);
        if (e.runnerUpUser) usernamesSet.add(e.runnerUpUser);
      }
      const usernames = Array.from(usernamesSet);

      const countryMap = new Map<string, string>();
      if (usernames.length > 0) {
        const dbUsers = await db.user.findMany({
          where: {
            wikiUsername: {
              in: usernames,
            },
          },
          select: {
            wikiUsername: true,
            country: {
              select: {
                name: true,
              },
            },
          },
        });

        for (const u of dbUsers) {
          if (u.wikiUsername && u.country?.name) {
            countryMap.set(u.wikiUsername.toLowerCase(), u.country.name);
          }
        }

        const cleanNames = usernames.map((u) => u.replace(/_/g, " "));
        const directCountries = await db.country.findMany({
          where: {
            name: {
              in: [...usernames, ...cleanNames],
            },
          },
          select: {
            name: true,
          },
        });

        for (const c of directCountries) {
          const matchedUser = usernames.find(
            (u) =>
              u.toLowerCase() === c.name.toLowerCase() ||
              u.replace(/_/g, " ").toLowerCase() === c.name.toLowerCase()
          );
          if (matchedUser && !countryMap.has(matchedUser.toLowerCase())) {
            countryMap.set(matchedUser.toLowerCase(), c.name);
          }
        }
      }

      const calendar: Record<
        number,
        {
          winnerUser: string | null;
          winnerCountryName: string | null;
          winnerPage: string | null;
          winnerScore: number | null;
          winnerBytes: number | null;
          runnerUpUser: string | null;
          runnerUpCountryName: string | null;
          runnerUpPage: string | null;
          runnerUpScore: number | null;
          runnerUpBytes: number | null;
          candidates: any[];
        }
      > = {};

      for (const e of entries) {
        const day = parseInt(e.date.slice(8, 10), 10);
        let candidates = [];
        if (e.metadata) {
          try {
            candidates = JSON.parse(e.metadata);
          } catch (_) {}
        }
        calendar[day] = {
          winnerUser: e.winnerUser,
          winnerCountryName: e.winnerUser
            ? countryMap.get(e.winnerUser.toLowerCase()) || null
            : null,
          winnerPage: e.winnerPage,
          winnerScore: e.winnerScore,
          winnerBytes: e.winnerBytes,
          runnerUpUser: e.runnerUpUser,
          runnerUpCountryName: e.runnerUpUser
            ? countryMap.get(e.runnerUpUser.toLowerCase()) || null
            : null,
          runnerUpPage: e.runnerUpPage,
          runnerUpScore: e.runnerUpScore,
          runnerUpBytes: e.runnerUpBytes,
          candidates,
        };
      }

      return calendar;
    }),
});
