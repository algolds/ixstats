/**
 * purge.ts — `action=purge` (plan 410): make the named pages render afresh. A bot-password session
 * may purge (a purge costs a render, so an anonymous caller may not); each page is marked stale and
 * a render queued through the purge service, which the render queue then single-flights and caps.
 * Each purged page also takes one from the `wiki_api_render` bucket (shared with the renders `parse`
 * asks MediaWiki for): 60 a minute per account, so a bot cannot queue thousands of renders in a minute.
 */

import type { JsonObject } from "../format";
import { buildPageSet } from "../pages";
import { HIGH_VALUE_LIMIT, NORMAL_VALUE_LIMIT } from "../params";
import { ApiError } from "../errors";
import type { ApiContext } from "../types";
import { requireBotSession } from "./write-common";

/** Pages one purge handles; each costs a render. */
const MAX_PURGE_PAGES = NORMAL_VALUE_LIMIT;
/** Purges (renders queued) one account may make a minute, on top of the write limit of the request. */
const PURGES_PER_MINUTE = 60;

/** Take one render from the account's bucket for each page that will be purged, before any is: over it is `ratelimited`. */
async function chargeRenders(rc: ApiContext, pages: number): Promise<void> {
  if (rc.session.permissions.rights.has("noratelimit")) return;
  for (let charged = 0; charged < pages; charged++) {
    const taken = await rc.deps.rateLimit(rc.clientKey, "wiki_api_render", {
      maxRequests: PURGES_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!taken.success) {
      throw new ApiError("ratelimited", "You've exceeded your rate limit. Please wait some time and try again.");
    }
  }
}

export async function runPurge(rc: ApiContext): Promise<JsonObject> {
  requireBotSession(rc);
  const p = rc.params.scope("", "purge");
  const max = rc.highLimits ? HIGH_VALUE_LIMIT : MAX_PURGE_PAGES;
  const titles = p.list("titles", max);
  const pageIds = p.integerList("pageids", max);
  const resolveRedirects = p.flag("redirects");
  const forceLinkUpdate = p.flag("forcelinkupdate") || p.flag("forcerecursivelinkupdate");

  const pageSet = await buildPageSet(rc.deps.store, { titles, pageIds, revIds: [], resolveRedirects });
  await chargeRenders(rc, pageSet.entries.filter((entry) => entry.state === "exists" && entry.row).length);
  const results: JsonObject[] = [];
  for (const entry of pageSet.entries) {
    if (entry.state === "exists" && entry.row) {
      await rc.deps.services.purgePage({ id: entry.row.articleId, title: entry.row.title });
      results.push({ ns: entry.ns, title: entry.title, purged: true, ...(forceLinkUpdate ? { linkupdate: true } : {}) });
    } else if (entry.state === "invalid") {
      results.push({ title: entry.title, invalidreason: entry.invalidReason, invalid: true });
    } else if (entry.state === "special") {
      results.push({ ns: entry.ns, title: entry.title, special: true });
    } else if (entry.state === "missingid") {
      results.push({ pageid: entry.key, missing: true });
    } else {
      results.push({ ns: entry.ns, title: entry.title, missing: true });
    }
  }
  return { batchcomplete: true, purge: results };
}
