---
name: project_lorewards_sync_lag
description: Lorewards calendar lagged the Discord bot because sync was once-daily; cron-runner.mjs is the single cron owner and the live deployment is ixworld
metadata: 
  node_type: memory
  type: project
  originSessionId: d34ba724-d865-4ffb-bca9-1a54530a2782
---

Lorewards/OOL winners calendar (`/achievements?tab=leaderboard` → WikiLoreTab) is backed by
the `lorewardEntry` table, synced from the Discord bot's `/ixwiki/shared/bots/discord/lorewards-state.json`
via `src/lib/lorewards-sync.ts`.

**The lag bug (June 2026):** calendar showed "only through the 19th" while the bot had winners
through the 22nd. Root cause: the only reliable sync was the once-daily `fullSync` cron at
06:00 UTC. The lazy on-query `syncCurrentWinners()` (5-min throttle, fires on page load) rarely
runs because the **main ixstats web app on port 3550 is down** — the live user-facing deployment
is **ixworld (PM2 `ixworld`, port 3002)**. So the calendar only updated once/day and lagged the bot.

**Fix:** added a `*/10 * * * *` "Lorewards state-file sync" job to `cron-runner.mjs` calling the
cheap `syncFromStateFile()` (local JSON read + upserts; no wiki MySQL, no stats recompute — the
daily `fullSync` still does heavy reconciliation). Keeps the calendar within 10 min of the bot.

**Key operational facts:**
- `cron-runner.mjs` (PM2 `ixstats-cron`) is the **single cron owner**. `server.mjs`'s inline cron
  is intentionally NOT enabled (would double daily payouts). Add scheduled jobs to cron-runner.mjs.
- Run TS directly under **bun** (`bun -e 'await import("./src/lib/lorewards-sync.ts")'`); plain
  `node` can't resolve the `.js`→`.ts` imports the cron uses.
- dev (3000) and prod both point at the same Docker Postgres `localhost:5433/ixstats`.
- Pre-existing harmless `server-only` import error in the cron log (since 2026-06-20) is unrelated.
