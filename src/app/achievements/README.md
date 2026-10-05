# Achievements & Leaderboards

**Last updated:** September 2026

This directory holds the React view for `/achievements` — a single page combining a profile
header, an optional showcase shelf, and the full gameplay achievement catalog. Global
leaderboards live on the standalone `/leaderboards` page. It is a Core System within IxStats;
see `docs/systems/achievements.md` for the full guide.

## Routes

| Path              | Purpose                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `/achievements`   | Header card + optional Showcase shelf + full catalog (no tabs; `?tab=` is ignored) |
| `/leaderboards`   | Standalone global leaderboards (`LeaderboardTab`) in a plain page container  |
| `/wiki/lorewards` | Wiki Lorewards (moved out of `/achievements`; lives under WikiOS)                  |

## Key features

- **Header Summary** — country flag wash, Total Unlocked, Achievement Points (gameplay only,
  excluding `OOL_MEDAL`/`WIKI_AWARD` trigger types), and Global Rank for the signed-in user's
  country, plus a link to `/leaderboards`.
- **Collector resync** — on load the page calls `achievements.syncMyCollectorAchievements`,
  which evaluates all definitions for the user's country and unlocks anything newly met. This is
  currently the only path that unlocks achievements automatically.
- **Showcase shelf** — toggleable display of unlocked achievements (`ShowcaseTab`); preference
  persisted in `localStorage` (`ixstats-show-achievements-cabinet`).
- **Achievements catalog** (`AllAchievementsTab`) — master list with status, filterable by category
  (Economic, Diplomatic, Government, Military, Social, General) and rarity (Common → Legendary;
  colors via `getRarityColor`/`getRarityBg`), with search, grid/list toggle, and secret reveal.

Removed on 2026-08-10 (commit `fe55c1872`): the Quest Paths tab (`QUEST_PATHS` still exists in
`components/achievements/constants.ts` but is unused on this page), the Lorewards tab, and the
in-page leaderboard tab. The planned Ribbons tab is not built yet — see
`docs/specs/2026-08-10-achievements-ribbons-design.md`.

## Architecture

| Layer         | Files                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Page          | `src/app/achievements/page.tsx` (profile card, showcase toggle, catalog, layout)          |
| Layout        | Page container (no rail; the source list lists the sections)                              |
| Tabs / panels | `components/achievements/tabs/{AllAchievementsTab,ShowcaseTab,LeaderboardTab}.tsx`        |
| Widgets       | `components/achievements/{AchievementDecorations,FloatingRibbonRack}.tsx`, `constants.ts` |

The page is fully client-side (`"use client"`); auth via `useUser()` from `~/context/auth-context`.

## Data sources (verified `api.*`)

- `api.users.getProfile` — user profile, role, `countryId`
- `api.achievements.getAllWithStatus` — master achievements with per-country unlock status
- `api.achievements.syncMyCollectorAchievements` — collector resync on load
- `api.achievements.getLeaderboard` — country rankings (used for the Global Rank figure)
- `api.achievements.getCountryLeaderboard` — used by `LeaderboardTab` on `/leaderboards`

Backend routers (registered in `src/server/api/root.ts`): `achievements` (merged from
`country` / `progress` / `management` sub-routers; mutations `unlock`,
`syncMyCollectorAchievements`) and `lorewards`. Definitions and unlock logic live in
`src/lib/achievements/` (`definitions.ts` — 76 achievements, `service.ts`).

## Connections

- **IxVault** — unlocks pay one-time `EARN_BONUS` credits by rarity (Common 100 → Legendary 2,500 IxC)
  plus any cards/packs in `rewardsJson`.
- **Lorewards** — wiki medal/award scoring lives at `/wiki/lorewards` (WikiOS).

## Maintenance notes

- Keep `docs/systems/achievements.md` updated whenever categories, rarity tiers, or trigger types change.
- If Quest Paths return, keep `QUEST_PATHS` keys in sync with the achievement keys in `definitions.ts`.

---

_Corrected September 2026: the prior README described a five-tab page (Quest Paths, Master
Achievements, Showcase Cabinet, Lorewards, Global Leaderboards) and `?tab=` deep links that were
removed in August 2026, and claimed `/leaderboards` redirects (it is a live standalone page)._
