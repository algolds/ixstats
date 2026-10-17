import type { LorewardEntry } from "@prisma/client";
import { z } from "zod/v4";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { adminActor } from "~/server/shared/admin-actor";
import { db } from "~/server/db";
import * as fs from "fs";
import { fullSync, scoreDailyWikiOS } from "~/lib/lorewards";
import { postToBot, tellBotOfOverride } from "~/lib/lorewards/bot-client";
import { overrideLorewardEntry } from "~/server/modules/cards/cards.trophies";

const OVERRIDE_FIELDS = {
  winnerUser: z.string().nullable().optional(),
  winnerPage: z.string().nullable().optional(),
  winnerScore: z.number().nullable().optional(),
  winnerBytes: z.number().nullable().optional(),
  runnerUpUser: z.string().nullable().optional(),
  runnerUpPage: z.string().nullable().optional(),
  runnerUpScore: z.number().nullable().optional(),
  runnerUpBytes: z.number().nullable().optional(),
};

type WikiOsDaily = Awaited<ReturnType<typeof scoreDailyWikiOS>>;

const botView = (entry: LorewardEntry | null) => ({
  winner: entry?.winnerUser ?? null,
  winnerPage: entry?.winnerPage ?? null,
  score: entry?.winnerScore ?? null,
  runnerUp: entry?.runnerUpUser ?? null,
});

const wikiosView = (result: WikiOsDaily) => ({
  winner: result.winner?.user ?? null,
  winnerPage: result.winner?.page ?? null,
  score: result.winner?.finalScore ?? null,
  runnerUp: result.runnerUp?.user ?? null,
  breakdown: result.winner?.scoreBreakdown ?? null,
});

export const lorewardsAdminRouter = createTRPCRouter({
  /** Admin: trigger full sync from state file + OOL page. */
  triggerSync: adminProcedure.mutation(() => fullSync()),

  /** Cross-validate: compare bot picks vs WikiOS picks for a date. */
  crossValidate: adminProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const botEntry = await db.lorewardEntry.findUnique({
        where: { date_type: { date: input.date, type: "daily" } },
      });
      const wikios = await scoreDailyWikiOS(input.date);

      const bot = botView(botEntry);
      const wikiosPick = wikiosView(wikios);
      const winnersAgree = bot.winner === wikiosPick.winner;
      const runnerUpsAgree = bot.runnerUp === wikiosPick.runnerUp;
      const candidates = wikios.candidates.map((c) => ({
        user: c.user,
        page: c.page,
        score: c.finalScore,
        breakdown: c.scoreBreakdown,
      }));
      const wikiosFields = {
        wikiosWinner: wikiosPick.winner,
        wikiosWinnerPage: wikiosPick.winnerPage,
        wikiosWinnerScore: wikiosPick.score,
        wikiosRunnerUp: wikiosPick.runnerUp,
        winnersAgree,
        runnerUpsAgree,
        wikiosCandidates: JSON.stringify(candidates),
      };

      await db.lorewardCrossValidation.upsert({
        where: { date: input.date },
        create: {
          date: input.date,
          botWinner: bot.winner,
          botWinnerPage: bot.winnerPage,
          botWinnerScore: bot.score,
          botRunnerUp: bot.runnerUp,
          botCandidates: botEntry?.metadata ?? null,
          ...wikiosFields,
        },
        update: wikiosFields,
      });

      return {
        date: input.date,
        winnersAgree,
        runnerUpsAgree,
        bot,
        wikios: wikiosPick,
        candidates: candidates.slice(0, 5),
      };
    }),

  /** Cross-validation history with agreement rate. */
  getCrossValidationHistory: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(30),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const [results, total, agrees] = await Promise.all([
        db.lorewardCrossValidation.findMany({
          orderBy: { date: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        db.lorewardCrossValidation.count(),
        db.lorewardCrossValidation.count({ where: { winnersAgree: true } }),
      ]);
      return {
        results: results.map((r) => ({
          date: r.date,
          botWinner: r.botWinner,
          botWinnerPage: r.botWinnerPage,
          wikiosWinner: r.wikiosWinner,
          wikiosWinnerPage: r.wikiosWinnerPage,
          winnersAgree: r.winnersAgree,
          runnerUpsAgree: r.runnerUpsAgree,
        })),
        total,
        agreementRate: total > 0 ? Math.round((agrees / total) * 100) : 0,
      };
    }),

  /** Active Blacklist configuration */
  getBlacklist: adminProcedure.query(async () => {
    try {
      const statePath = "/ixwiki/shared/bots/discord/lorewards-state.json";
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
        return state.blacklist || {};
      }
    } catch (err) {
      console.error("Failed to read blacklist from state file:", err);
    }
    return {};
  }),

  /** Update user blacklist status */
  updateBlacklist: adminProcedure
    .input(
      z.object({
        username: z.string().min(1),
        action: z.enum(["add", "remove"]),
        expiryDate: z.string().nullable().optional(),
      })
    )
    .mutation(({ input }) =>
      postToBot("/lorewards/blacklist", input, "Failed to sync blacklist with Discord bot", (res) =>
        res.json()
      )
    ),

  /**
   * Override a past winner or runner-up; the place's trophy is reassigned or voided to match. The bot is told after the
   * override commits: `botSynced` is false when it could not be, and the override stands.
   */
  overrideWinner: adminProcedure
    .input(
      z.object({
        date: z.string().min(1),
        type: z.enum(["daily", "weekly", "monthly"]),
        ...OVERRIDE_FIELDS,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { date, type, ...fields } = input;
      const { written, day, ...trophies } = await overrideLorewardEntry(ctx.db, adminActor(ctx), {
        date,
        type,
        fields,
      });
      // The bot is told what the database now holds, not only the fields the admin typed
      const botSynced = await tellBotOfOverride({ date: day, type, ...written });
      return { success: true, trophies, botSynced };
    }),
});
