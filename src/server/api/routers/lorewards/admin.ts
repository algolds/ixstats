import type { LorewardEntry } from "@prisma/client";
import { z } from "zod/v4";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import * as fs from "fs";
import { fullSync, scoreDailyWikiOS } from "~/lib/lorewards";

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

/** POSTs to the Discord bot; `failure` prefixes the error raised when the bot or the call fails. */
async function postToBot<T>(
  path: string,
  body: unknown,
  failure: string,
  onOk: (res: Response) => T | Promise<T>
): Promise<T> {
  const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${botUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Bot returned status ${res.status}`);
    }
    return await onOk(res);
  } catch (err) {
    throw new Error(`${failure}: ${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    });
  }
}

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
  getCrossValidationHistory: publicProcedure
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
  getBlacklist: protectedProcedure.query(async () => {
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

  /** Override past winner or runner-up */
  overrideWinner: adminProcedure
    .input(
      z.object({
        date: z.string().min(1),
        type: z.enum(["daily", "weekly", "monthly"]),
        ...OVERRIDE_FIELDS,
      })
    )
    .mutation(async ({ input }) => {
      const fields = Object.fromEntries(
        Object.keys(OVERRIDE_FIELDS).map((key) => [
          key,
          input[key as keyof typeof OVERRIDE_FIELDS] || null,
        ])
      ) as { [K in keyof typeof OVERRIDE_FIELDS]: NonNullable<(typeof input)[K]> | null };
      await db.lorewardEntry.upsert({
        where: { date_type: { date: input.date, type: input.type } },
        create: { date: input.date, type: input.type, ...fields, status: "approved" },
        update: fields,
      });

      return postToBot(
        "/lorewards/override",
        input,
        "Failed to sync override with Discord bot",
        () => ({ success: true })
      );
    }),
});
