/**
 * One result the Discord bot pushes to `/api/bot/lorewards/sync`, the primary source of official results (design
 * decision 16): read it, write it under its contest's key, then settle that contest (decision 17).
 */
import type { LorewardEntry } from "@prisma/client";
import { invalidateCache } from "~/lib/cache";
import { db } from "~/server/db";
import { canonicalWeekly } from "./contest-week";
import { settleLorewardPlaces, type SettleResult } from "./settle";
import { recomputeUserStats } from "./sync";

type Count = number | string | null | undefined;

/** One result the bot pushes (the route's body). */
export interface BotLorewardPayload {
  date?: string;
  type?: string;
  winnerUser?: string | null;
  winnerPage?: string | null;
  winnerScore?: Count;
  winnerBytes?: Count;
  runnerUpUser?: string | null;
  runnerUpPage?: string | null;
  runnerUpScore?: Count;
  runnerUpBytes?: Count;
  status?: string;
  metadata?: string | null;
}

export interface BotLorewardResult {
  date: string;
  type: string;
  dateStart: string | null;
  dateEnd: string | null;
  places: {
    winnerUser: string | null;
    winnerPage: string | null;
    winnerScore: number | null;
    winnerBytes: number | null;
    runnerUpUser: string | null;
    runnerUpPage: string | null;
    runnerUpScore: number | null;
    runnerUpBytes: number | null;
  };
  status: string;
  metadata: string | null;
}

export type BotResultParse = { ok: true; result: BotLorewardResult } | { ok: false; error: string };

/** A weekly whose ISO key already holds another contest (another first day): nothing is written. */
export class BotWeekConflict extends Error {}

const toNumberOrNull = (value: Count) => (value !== undefined ? Number(value) : null);

/** Where the result is stored: a weekly under its ISO week with its range, anything else under its date. */
function keyOf(
  date: string,
  type: string
): Pick<BotLorewardResult, "date" | "dateStart" | "dateEnd"> | null {
  if (type !== "weekly") return { date, dateStart: null, dateEnd: null };
  return canonicalWeekly(date);
}

export function parseBotResult(payload: BotLorewardPayload): BotResultParse {
  const { date, type } = payload;
  if (!date || !type) return { ok: false, error: "Missing required fields: date, type" };
  const key = keyOf(date, type);
  if (!key) {
    return {
      ok: false,
      error: "A weekly date is an ISO week (2026-W34) or the week's first day (2026-08-17).",
    };
  }
  return {
    ok: true,
    result: {
      ...key,
      type,
      places: {
        winnerUser: payload.winnerUser ?? null,
        winnerPage: payload.winnerPage ?? null,
        winnerScore: toNumberOrNull(payload.winnerScore),
        winnerBytes: toNumberOrNull(payload.winnerBytes),
        runnerUpUser: payload.runnerUpUser ?? null,
        runnerUpPage: payload.runnerUpPage ?? null,
        runnerUpScore: toNumberOrNull(payload.runnerUpScore),
        runnerUpBytes: toNumberOrNull(payload.runnerUpBytes),
      },
      status: payload.status ?? "approved",
      metadata: payload.metadata ? String(payload.metadata) : null,
    },
  };
}

/** Throws `BotWeekConflict` when `stored` is the result's ISO week kept as a week with another first day. */
function refuseOtherWeek(
  { date, type, dateStart }: BotLorewardResult,
  stored: { dateStart: string | null } | null
): void {
  if (type === "weekly" && stored?.dateStart && stored.dateStart !== dateStart) {
    throw new BotWeekConflict(
      `Week ${date} is stored as the week from ${stored.dateStart}. Settle it with an admin override.`
    );
  }
}

/** Settles the entry's contest when it is approved; a settle that throws is logged and leaves null. */
async function settleEntry(entry: LorewardEntry): Promise<SettleResult | null> {
  if (entry.status !== "approved") return null;
  try {
    return await settleLorewardPlaces({ entryIds: [entry.id] });
  } catch (error) {
    console.error("[Lorewards Sync Webhook] Settling the contest failed:", error);
    return null;
  }
}

/**
 * Writes the result (the places and status unless an override holds them), recomputes the named users' stats, clears
 * the Lorewards caches, then, when the stored entry is approved, settles its contest. A settle that throws is logged and
 * leaves `settled: null`: the result stands and the next sync pays.
 */
export async function applyBotResult(
  result: BotLorewardResult
): Promise<{ entry: LorewardEntry; settled: SettleResult | null }> {
  const { date, type, dateStart, dateEnd, places, status, metadata } = result;
  refuseOtherWeek(
    result,
    type === "weekly"
      ? await db.lorewardEntry.findUnique({
          where: { date_type: { date, type } },
          select: { dateStart: true },
        })
      : null
  );
  // An entry an admin override wrote keeps its places and its status, so a status that withholds a contest stays;
  // the bot still updates its metadata. The override, and for a weekly its first day, are checked in the write itself,
  // so an override or another week's row (the OOL writer) that commits while this runs is never written over.
  const sameWeek = type === "weekly" ? { OR: [{ dateStart: null }, { dateStart }] } : {};
  await db.lorewardEntry.updateMany({
    where: { date, type, overriddenAt: null, ...sameWeek },
    data: { ...places, status },
  });
  const entry = await db.lorewardEntry.upsert({
    where: { date_type: { date, type } },
    create: { date, type, dateStart, dateEnd, ...places, status, metadata },
    update: { metadata, syncedAt: new Date() },
  });
  // ponytail: a row of another week created since the check keeps its places but takes this metadata; it is not settled
  refuseOtherWeek(result, entry);

  if (places.winnerUser) await recomputeUserStats(places.winnerUser);
  if (places.runnerUpUser) await recomputeUserStats(places.runnerUpUser);
  await invalidateCache(["lorewards.", "wiki."]);

  return { entry, settled: await settleEntry(entry) };
}
