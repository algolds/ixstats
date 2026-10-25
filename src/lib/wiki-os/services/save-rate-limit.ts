/**
 * save-rate-limit.ts — the wiki-save rate limit (plan 2026-10-24 A7), per group: a new account gets MediaWiki's newbie
 * default, an autoconfirmed or confirmed one more, far below the 100 requests a minute of the procedures, and a holder
 * of `noratelimit` (sysop, bot) is never limited. `commitWikitextSave` asks it before every person's save, so the
 * editor, api.php, revert, rollback and "Restore my text" share one bucket; a system save (`authorLabel`) skips it.
 * The counting is the shared `rateLimiter`'s (Redis, with its in-memory fallback).
 */

import { TRPCError } from "@trpc/server";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { requireWikiUserId, type WikiAuthContext } from "../auth";
import { getWikiPermissions } from "../rights";

/** Saves a minute: a new account (MediaWiki's newbie default), and an autoconfirmed or confirmed one. */
export const WIKI_SAVE_LIMITS = {
  newbie: { max: 8, windowMs: 60_000 },
  autoconfirmed: { max: 30, windowMs: 60_000 },
} as const;

export const WIKI_SAVE_REFUSAL = "You are saving too fast. Wait a minute and try again.";

/** The groups that save at the autoconfirmed rate. */
const TRUSTED_GROUPS: ReadonlySet<string> = new Set(["autoconfirmed", "confirmed"]);

/**
 * Takes one save from the caller's bucket; throws TOO_MANY_REQUESTS (api.php: `ratelimited`) when it is empty. A holder
 * of `noratelimit` is not counted.
 */
export async function assertWikiSaveRate(ctx: WikiAuthContext): Promise<void> {
  const { groups, rights } = await getWikiPermissions(ctx);
  if (rights.has("noratelimit")) return;
  const bucket = groups.some((group) => TRUSTED_GROUPS.has(group)) ? "autoconfirmed" : "newbie";
  const { max, windowMs } = WIKI_SAVE_LIMITS[bucket];
  const taken = await rateLimiter.check(
    `wiki-save:${requireWikiUserId(ctx)}`,
    `wiki_save:${bucket}`,
    { maxRequests: max, windowMs }
  );
  if (!taken.success)
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: WIKI_SAVE_REFUSAL });
}
