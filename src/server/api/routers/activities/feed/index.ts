/**
 * Activities feed router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.activities.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - global:    cross-source global activity feed (ActivityFeed + ThinkPages + wiki + forum)
 *  - personal:  user-scoped feeds (following, user-specific, country-specific)
 *  - headlines: aggregated news-style headlines from game systems for the ThinkPages ticker
 */
import { mergeRouters } from "~/server/api/trpc";
import { activitiesFeedGlobalRouter } from "./global";
import { activitiesFeedPersonalRouter } from "./personal";
import { activitiesFeedHeadlinesRouter } from "./headlines";

export const activitiesFeedRouter = mergeRouters(
  activitiesFeedGlobalRouter,
  activitiesFeedPersonalRouter,
  activitiesFeedHeadlinesRouter
);
