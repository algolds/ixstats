import type { Prisma } from "@prisma/client";
import { z } from "zod";

/** Everything the dividend reads about one user for one UTC day. */
export interface DividendInputs {
  /** Card deck value at settle time. */
  deckValue: number;
  /** Sum of the user's Lorewards engine candidate scores for the day. */
  wikiScore: number;
  /** Human ThinkPages posts plus forum posts and replies for the day. */
  posts: number;
  packsOpened: number;
  tradesCompleted: number;
  listingsSold: number;
  /** Login streak in force on the settled day. */
  streakDays: number;
  /** Sum of the owned upgrades' yieldBoost, e.g. 0.05. */
  yieldBoost: number;
}

export interface DividendLine {
  key: "interest" | "wiki" | "posts" | "cards" | "streak" | "boost";
  amount: number;
  /** The figures the amount came from, kept so a past day stays legible. */
  detail: Record<string, number>;
}

export interface DividendResult {
  total: number;
  lines: DividendLine[];
}

export const DIVIDEND = {
  INTEREST_RATE: 0.0025,
  INTEREST_CAP: 25,
  WIKI_POINTS_PER_CREDIT: 80,
  WIKI_CAP: 30,
  POST_RATE: 2,
  POST_CAP: 20,
  PACK_RATE: 2,
  TRADE_RATE: 5,
  SALE_RATE: 3,
  CARDS_CAP: 20,
  STREAK_STEP: 0.05,
  STREAK_MAX_DAYS: 10,
  TOTAL_CAP: 150,
  MISSED_DAYS: 7,
} as const;

/** Idempotency key of one user's payout for a UTC day (`yyyy-mm-dd`). */
export const dividendKey = (userId: string, day: string) => `dividend:${userId}:${day}`;

const DAY_MS = 86_400_000;

/** The UTC day (`yyyy-mm-dd`) a moment falls on. */
export const utcDay = (at: Date) => at.toISOString().slice(0, 10);

/** The UTC day `delta` days from `day` (`yyyy-mm-dd`). */
export const shiftDay = (day: string, delta: number) =>
  utcDay(new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * DAY_MS));

export function computeDividend(i: DividendInputs): DividendResult {
  const interest = Math.min(
    DIVIDEND.INTEREST_CAP,
    Math.round(i.deckValue * DIVIDEND.INTEREST_RATE)
  );
  const wiki = Math.min(
    DIVIDEND.WIKI_CAP,
    Math.floor(i.wikiScore / DIVIDEND.WIKI_POINTS_PER_CREDIT)
  );
  const posts = Math.min(DIVIDEND.POST_CAP, DIVIDEND.POST_RATE * i.posts);
  const cards = Math.min(
    DIVIDEND.CARDS_CAP,
    DIVIDEND.PACK_RATE * i.packsOpened +
      DIVIDEND.TRADE_RATE * i.tradesCompleted +
      DIVIDEND.SALE_RATE * i.listingsSold
  );
  const activity = wiki + posts + cards;
  const streakDays = Math.min(Math.max(0, i.streakDays), DIVIDEND.STREAK_MAX_DAYS);
  const streak = Math.round(activity * DIVIDEND.STREAK_STEP * streakDays);
  const subtotal = interest + activity + streak;
  const boost = Math.round(subtotal * i.yieldBoost);

  const lines: DividendLine[] = [
    {
      key: "interest",
      amount: interest,
      detail: { deckValue: i.deckValue, rate: DIVIDEND.INTEREST_RATE },
    },
    {
      key: "wiki",
      amount: wiki,
      detail: { score: i.wikiScore, pointsPerCredit: DIVIDEND.WIKI_POINTS_PER_CREDIT },
    },
    { key: "posts", amount: posts, detail: { posts: i.posts, rate: DIVIDEND.POST_RATE } },
    {
      key: "cards",
      amount: cards,
      detail: { packs: i.packsOpened, trades: i.tradesCompleted, sold: i.listingsSold },
    },
    {
      key: "streak",
      amount: streak,
      detail: { days: streakDays, activity, step: DIVIDEND.STREAK_STEP },
    },
    { key: "boost", amount: boost, detail: { subtotal, yieldBoost: i.yieldBoost } },
  ];
  return {
    total: Math.min(DIVIDEND.TOTAL_CAP, subtotal + boost),
    lines: lines.filter((l) => l.amount > 0),
  };
}

const lineSchema = z.object({
  key: z.enum(["interest", "wiki", "posts", "cards", "streak", "boost"]),
  amount: z.number(),
  detail: z.record(z.string(), z.number()),
});

const inputsSchema = z.object({
  deckValue: z.number(),
  wikiScore: z.number(),
  posts: z.number(),
  packsOpened: z.number(),
  tradesCompleted: z.number(),
  listingsSold: z.number(),
  streakDays: z.number(),
  yieldBoost: z.number(),
});

const metadataSchema = z.object({
  day: z.string(),
  lines: z.array(lineSchema),
  inputs: inputsSchema,
});

export type DividendMetadata = z.infer<typeof metadataSchema>;

/**
 * The `{ day, lines, inputs }` stored on a dividend row. `VaultTransaction.metadata` usually arrives as a JSON
 * string (the ledger stringifies it), so both forms are read; anything that is not a dividend breakdown is null.
 */
export function parseDividendMetadata(raw: Prisma.JsonValue | undefined): DividendMetadata | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as Prisma.JsonValue;
    } catch {
      return null;
    }
  }
  const parsed = metadataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
