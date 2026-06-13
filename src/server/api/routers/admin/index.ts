/**
 * Admin router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.admin.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - system:      config, status, health, stats, logs, calculations, time control
 *  - bot:         Discord bot control, process management, commands/roles, sync
 *  - users:       user⇄country mapping/assignment, navigation visibility settings
 *  - countries:   god-mode country data, roster import, grid/detail, audit, announcements, scenarios
 *  - worldEvents: storyteller world events, event chains, diplomatic options, upcoming events
 *  - wiki:        wiki links, article awards, loreward scoring, templates, cache purges, cron, wiki users
 */
import { mergeRouters } from "~/server/api/trpc";
import { adminSystemRouter } from "./system";
import { adminBotRouter } from "./bot";
import { adminUsersRouter } from "./users";
import { adminCountriesRouter } from "./countries";
import { adminWorldEventsRouter } from "./worldEvents";
import { adminWikiRouter } from "./wiki";

export const adminRouter = mergeRouters(
  adminSystemRouter,
  adminBotRouter,
  adminUsersRouter,
  adminCountriesRouter,
  adminWorldEventsRouter,
  adminWikiRouter,
);
