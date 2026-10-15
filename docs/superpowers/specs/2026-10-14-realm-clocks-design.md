# Realm clocks: each realm runs its own time

**Date:** 2026-10-14
**Status:** Approved design (owner, 2026-10-14).
**Supersedes:** the "one shared IxTime clock" row (18) and the "per-realm clocks/speeds" exclusion in
[realms-framework-spec.md](../../architecture/realms-framework-spec.md), and the display-only in-world date
(`Realm.settings.inWorldDate`).

## Owner decisions

| Topic | Decision |
|---|---|
| Scope | The realm clock drives its nations' **simulation**, not only the display. |
| Speeds | **Paused** or a **custom multiplier**, bounded 0 to 12×. |
| Limits | One speed change per **7 real days**; site staff exempt. |
| Control | **Founder only** (and site staff). No officer power. |
| Calendar | **Start date + era** (Gregorian months), replacing the In-world date setting. |
| Date jumps | **None**: the date moves only by the clock running. Nothing in the simulation goes backwards. |
| Nations | Every nation is **locked to one realm** and runs on that realm's clock. |
| Cross-realm | Country-to-country diplomacy, cultural exchanges, conflicts and trade across realms are **blocked**. Realm-to-realm embassies and forum posts stay. |
| Switchover | **Continuous + calendar**: a realm's clock starts equal to global IxTime when it is switched on, so no stored history moves; the start date and era only set the calendar it is shown in. |
| Rankings | **Per realm** by default. |
| Header clock | **By context.** Inside a realm (its pages, its nations' pages, MyCountry, realm-scoped Maps, its forum board) that realm's clock; **outside realms, real-world local time**. |
| Ixnay | Stays on **global IxTime**, run by staff and the Discord bot as today; the bot keeps posting global IxTime only. |

## 1. The clock

- **Storage.** `Realm.settings.clock` (JSON, no migration):
  `{ anchorRealMs, anchorClockMs, multiplier, changedAt, calendarOffsetMs, era }`. Stored in the database so the
  cron runner, the WebSocket backend and every Next process agree. Today's IxTime overrides live in memory
  per process, so cron runs miss them; a realm clock must not.
- **Reading it.** One pure function, `realmClockNow(clock, realNowMs)`:
  `anchorClockMs + (realNowMs - anchorRealMs) * multiplier`. No clock (Ixnay, and any realm not switched on)
  means global `IxTime.getCurrentIxTime()`.
- **Switching on.** `anchorClockMs` = global IxTime at that moment, `anchorRealMs` = now, multiplier = the
  realm's choice. Every stored timestamp of the realm's nations is already on this timeline, so nothing is
  rebased.
- **Calendar.** The founder picks the in-world date the realm stands at now (e.g. 14 March 1203) and an era
  ("AE"). `calendarOffsetMs` = chosen date minus the clock's time at that moment. Displayed date = clock time +
  offset. The offset is set once with the clock; there are no later date jumps.
- **Speed change.** Re-anchor (the current clock time becomes `anchorClockMs`, now becomes `anchorRealMs`), then
  set the multiplier. 0 pauses. The 7-day cooldown reads `changedAt`. Bounds 0 to 12 are checked in zod and the
  module.
- **Migrating the In-world date.** An `offset` in-world date becomes a calendar with the same year offset and
  era. A `fixed` label stays shown as a legacy label until the founder sets a calendar.

## 2. The simulation on the realm clock

The economy is already a projection: `projectCountryStats` (src/server/shared/country-helpers.ts) runs a nation's
baseline forward to a target time. A realm clock passes that realm's "now" instead of the global one.
Server-side, one helper resolves a country's clock: `clockForCountry(country) → now`.

- **Projection and history.**
  - Callers: the stat-progression cron (src/server/cron/stat-progression.ts), live projections in
    countries/economy.ts, and component activation in country-helpers.ts.
  - The monthly history throttle is kept per realm.
  - A paused realm projects to the same instant every run, so nothing grows. The cron skips paused realms
    entirely.
- **Per-country timers.**
  - Budget year: `currentBudgetYear()` and the rollover cron.
  - National issues: the engine, consequences and snapshots.
  - Policies: lifecycle and maintenance. Also politics drift and stability.
  - Elections: the cron, lifecycle and elections.
  - Executive intents and legislation cooldowns.
  - Each reads the country's realm clock. They also write that clock's time to their IxTime columns.
- **StorytellerEffect writers** (about 10 sites) stamp `ixTimeTimestamp` with the country's realm clock.
- **Country creation.** Create, import and map assignment set `baselineDate` from the realm clock.
- **Global loops** (stat-progression, issue generation, budget rollover, policy maintenance, politics drift)
  group countries by realm and take each realm's "now" once per run.
- **Stays on global time:**
  - Sports seasons, the exchange, and Vault dividends and rewards.
  - Achievements and other real-time timers (trade expiry, proposal lifecycle, embassy missions).
- **Multiplier 0 safety.** Conflict length divides by the multiplier (military/conflict-outcome.ts:100); it uses
  the realm's speed with a floor, so a paused realm's conflict waits rather than ending at infinity. The exchange
  stays global, so its bidding window is unaffected.

## 3. Cross-realm rules and rankings

- **Blocked across realms:** country-level embassies, cultural exchanges, conflicts and trade. The mutation
  refuses with "Both nations must be in the same realm". Alliances are already realm-scoped (`Alliance.realmId`).
- **Rankings:** leaderboards and `getGlobalStats` scope to a realm. Ixnay is the default view. A site-wide view is
  labelled as mixing realms that run at different speeds.

## 4. Where time shows

- **Manage → Time** (founder and site staff; replaces In-world date):
  - The current realm date and era, the speed (Paused or ×N), and when the speed may next change.
  - Switching on: a start date, an era and a speed, previewed before saving.
  - Speed changes are previewed too.
- **Realm header:** the realm date and era, the speed when not ×2 ("Paused", "×6"), and "Founded".
- **Country pages and MyCountry:** `CountryDataProvider` and the profile layout use the country's realm clock;
  so do the executive agenda, directives, budget UIs and chart time windows.
- **Header clock and Halo, by context:**
  - **Realm context** shows that realm's clock and calendar:
    - `/r/<realm>` and a realm's forum board (`/thinkpages/r/<realm>`): that realm.
    - A country page (`/countries/<slug>`): the country's realm.
    - MyCountry and the builder: the active nation's realm.
    - `/maps?realm=`: that realm. Ixnay contexts show global IxTime.
    - The realm's clock comes from the public `realms.region.contextClock` query; global IxTime from the
      existing store.
  - **Outside realms**, the clock shows the viewer's real local time:
    - Home and Dashboard, Vault, the sitewide forum, Wiki and WikiOS, Settings, Help and Labs.
    - Admin, except its IxTime controls, which keep showing global IxTime.
    - The signed-out front page.
  - No in-game date shows there. The context resolves from the path, so the server and the hydrating pass
    agree.

## 5. Phases

1. **Clock and calendar.** `Realm.settings.clock`, `realmClockNow`, Manage → Time (switch on, speed, pause,
   cooldown, bounds, founder/staff only), In-world date migration, the realm header and the header clock.
   Nothing simulates on it yet.
2. **Simulation.** Everything in §2, server first, then the client per-country displays.
3. **Cross-realm and rankings.** The guards in §3, per-realm leaderboards and global stats.

Each phase is its own commit series with tests; phase 2 is checked on the `ixstats_wv1` clone by switching a
realm on, speeding it up and pausing it, and confirming its nations' projections, budget year and issues
follow while Ixnay's do not.

## 6. Testing

- **Clock math:** continuity across speed changes, pause and resume, bounds, and the cooldown (staff exempt).
- **Calendar:** offset and era formatting, and migration of the In-world date.
- **Access:** founder and site staff only.
- **Simulation:** the projection target follows the realm clock; a paused realm does not grow. The per-realm
  history throttle, the budget year on the realm clock, and issue and election timers on the realm clock.
- **Cross-realm refusals:** one test per blocked action.
- **Rankings:** scoped per realm.
- **Header clock:** realm resolution (active nation, page realm, global fallback), including hydration (the
  server renders global IxTime, then switches after hydration).
