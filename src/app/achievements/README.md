# Achievements & Leaderboards

**Last updated:** June 2026

This directory holds the React view for `/achievements` — a single tabbed page combining
gameplay achievements, quest paths, wiki Lorewards, a showcase cabinet, and global leaderboards.
It is a Core System within IxStats; see `docs/systems/achievements.md` for the full guide.

## Routes

| Path | Purpose |
| --- | --- |
| `/achievements` | Tabbed hub: Quest Paths, Achievements, Lorewards, Global Leaderboards |
| `/achievements?tab=<id>` | Deep-links a tab; valid ids: `quest-trees`, `all-achievements`, `wiki-lore`, `leaderboard` |
| `/leaderboards` | Thin redirect to `/achievements?tab=leaderboard` (consolidated; no standalone page) |

## Key features

- **Profile summary** — top card shows Total Unlocked, Achievement Points (gameplay only,
  excluding `OOL_MEDAL`/`WIKI_AWARD` trigger types), Lore Score, and Global Rank for the
  signed-in user's country.
- **Quest Paths** (`quest-trees`) — 8 curated progression tracks defined in
  `components/achievements/constants.ts` (`QUEST_PATHS`): Merchant, Prosperity, Warlord,
  Diplomat, Sovereign, Thinker, Vidmaster, and Lore & Meme. Each lists ordered achievement
  `keys` rendered as a node tree.
- **Achievements** (`all-achievements`) — full master list with status, filterable by category
  (Economic, Diplomatic, Government, Military, Social, General) and rarity (Common → Legendary;
  colors via `getRarityColor`/`getRarityBg`).
- **Showcase Cabinet** — toggleable display of unlocked achievements; preference persisted in
  `localStorage` (`ixstats-show-achievements-cabinet`).
- **Lorewards** (`wiki-lore`) — wiki scoring sub-system: UFC-style leaderboard, a winners
  calendar (default June 2026), and per-day award detail. Admins (owner/admin/staff) get
  additional controls.
- **Global Leaderboards** (`leaderboard`) — country rankings, optionally scoped by category.

## Architecture

| Layer | Files |
| --- | --- |
| Page | `src/app/achievements/page.tsx` (orchestrates tabs, profile card, layout) |
| Layout | `VaultSidebarLayout` (`activeSection="achievements"`) |
| Tabs | `components/achievements/tabs/{QuestTreesTab,AllAchievementsTab,WikiLoreTab,ShowcaseTab,LeaderboardTab}.tsx` |
| Widgets | `components/achievements/{QuestPathCard,WikiLoreDayModal}.tsx`, `constants.ts` |

The page is fully client-side (`"use client"`); auth via `useUser()` from `~/context/auth-context`.

## Data sources (verified `api.*`)

- `api.users.getProfile` — user profile, role, `countryId`, `wikiUsername`
- `api.achievements.getAllWithStatus` — master achievements with per-country unlock status
- `api.achievements.getLeaderboard` — country rankings (optional `category`)
- `api.achievements.getRecentByCountry` — recent unlocks (used by showcase/widgets)
- `api.lorewards.getUserStats` — Lore Score for the user's wiki account
- `api.lorewards.getUfcLeaderboard` — UFC-style wiki leaderboard
- `api.lorewards.getWinnersCalendar` / `getAllArticleAwards` — Lorewards calendar data

Backend routers (registered in `src/server/api/root.ts`): `achievements` (merged from
`country` / `progress` / `management` sub-routers; mutations `unlock`,
`syncMyCollectorAchievements`) and `lorewards`.

## Connections

- **MyCountry / Dashboard** — `DashboardPlayerWidget` surfaces achievement data on the dashboard.
- **Lorewards** — wiki medal/award scoring feeds the profile Lore Score and the `wiki-lore` tab.

## Maintenance notes

- Keep `QUEST_PATHS` keys in sync with the achievement keys defined in the backend.
- Update `docs/systems/achievements.md` whenever categories, rarity tiers, or trigger types change.

---

_Corrected from the prior (May 2026) README, which described a separate `/leaderboards` page,
generic "badge cards/category filters" components, and several endpoints that do not exist
(`getAllByCountry` as the primary list source, `createAchievementAlert`,
`getCurrentUserWithRole`, `getActiveUsers`). The page is a single tabbed view; standalone
leaderboards now redirect._
