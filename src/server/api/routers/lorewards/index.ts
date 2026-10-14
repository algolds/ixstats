/**
 * Lorewards router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.lorewards.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - awards:       article award lookups, achievements, frequency, recent winners
 *  - leaderboards: standings, per-user stats and award history
 *  - calendars:    streak calendars
 *  - trophies:     today's race, a wiki user's trophies and trophy cards
 *  - admin:        cross-validation, WikiOS scoring, sync, overrides, blacklist
 */
import { mergeRouters } from "~/server/api/trpc";
import { lorewardsAwardsRouter } from "./awards";
import { lorewardsLeaderboardsRouter } from "./leaderboards";
import { lorewardsCalendarsRouter } from "./calendars";
import { lorewardsTrophiesRouter } from "./trophies";
import { lorewardsAdminRouter } from "./admin";

export const lorewardsRouter = mergeRouters(
  lorewardsAwardsRouter,
  lorewardsLeaderboardsRouter,
  lorewardsCalendarsRouter,
  lorewardsTrophiesRouter,
  lorewardsAdminRouter
);
