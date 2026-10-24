/**
 * The one settle step every Lorewards sync runs: mint, grant and pay, over every approved place or the contests holding
 * a scope of entries (design decisions 17 and 19).
 */
import type { PrismaClient } from "@prisma/client";
import { db } from "~/server/db";
import { findContestEntries } from "./contest-store";
import { grantLorewardBonuses } from "./payout";
import { nameSpellings } from "./resolve-user";
import { grantUnownedTrophyCards, mintTrophyCards } from "./trophy-cards";

export interface SettleScope {
  entryIds?: readonly string[];
}

export interface SettleResult {
  minted: number;
  granted: number;
  paid: number;
  refused: number;
  payoutsEnabled: boolean;
}

export const NOTHING_SETTLED: SettleResult = Object.freeze({
  minted: 0,
  granted: 0,
  paid: 0,
  refused: 0,
  payoutsEnabled: true,
});

/** One step's result, or `failed` (logged) when it throws, so the next step still runs. */
async function step<T>(name: string, run: () => Promise<T>, failed: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[Lorewards] settle ${name} failed:`, error);
    return failed;
  }
}

/**
 * Mint the missing trophy cards, give the waiting ones whose place now resolves, then pay the unpaid places, over every
 * approved place or only the contests holding `scope.entryIds`. Each step is idempotent and in its own transactions; a
 * step that throws is logged ("[Lorewards] settle <step> failed:") and counts 0, and the next step still runs.
 */
export async function settleLorewardPlaces(scope: SettleScope = {}): Promise<SettleResult> {
  const { entryIds } = scope;
  if (entryIds?.length === 0) return { ...NOTHING_SETTLED };
  const { minted } = await step("mint", () => mintTrophyCards(db, entryIds), { minted: 0 });
  const { granted } = await step("grant", () => grantUnownedTrophyCards(db, entryIds), {
    granted: 0,
  });
  const run = await step("pay", () => grantLorewardBonuses(scope), {
    paid: 0,
    refused: 0,
    enabled: true,
  });
  return { minted, granted, paid: run.paid, refused: run.refused, payoutsEnabled: run.enabled };
}

const CONTESTS = ["daily", "weekly", "monthly"];

/** The approved daily, weekly and monthly entries that record `name` (any of `nameSpellings`) in either place. */
export async function entryIdsOfName(
  database: Pick<PrismaClient, "lorewardEntry">,
  name: string
): Promise<string[]> {
  const spellings = { in: nameSpellings(name) };
  const entries = await findContestEntries(database, {
    status: "approved",
    type: { in: CONTESTS },
    OR: [{ winnerUser: spellings }, { runnerUpUser: spellings }],
  });
  return entries.map((entry) => entry.id);
}
