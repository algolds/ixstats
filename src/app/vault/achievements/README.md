# Achievements

**Last updated:** October 2026

This directory holds the React view for `/vault/achievements`, the achievements home inside the
Vault: four tabs under a visually hidden `h1` (the sidebar row names the page on screen). The nation boards live on the
standalone `/leaderboards` page, the Vault sidebar's Leaderboards row. See `docs/systems/achievements.md` for the full guide.

## Routes

| Path                           | Purpose                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `/vault/achievements`          | Standing card + tabs (`AchievementsTabs`)                                                  |
| `/vault/achievements?tab=<id>` | `all` (default, bare path), `lorewards`, `showcase`, `leaderboard`                         |
| `/vault/achievements?a=<key>`  | Opens that achievement in All: its series card shows the tier and scrolls into view        |
| `/leaderboards`                | Nation boards (`CountryLeaderboards`)                                                      |
| `/util/lorewards`              | Lorewards in WikiOS: today's race, standings, recent winners                               |

## Tabs

- **All** (`AllAchievementsTab`): the catalogue, filterable by rarity, with search, grid or list, and secret reveal.
- **Lorewards**: the page passes `VaultLorewardsPanel` (the shared `LorewardsView`, `focus="you"`) as `lorewardsPanel`; the tab is present only when a panel is passed.
- **Showcase** (`ShowcaseTab`): the player's rarest unlocks.
- **Leaderboard** (`LeaderboardTab`): players ranked by achievement points. It never queries the nation boards.

## Data sources

- `api.users.getProfile`: `countryId` (country achievements are added when there is one)
- `api.achievements.getAllWithStatus`: the catalogue with the player's unlocks
- `api.achievements.getMySummary`: invalidated after the sync (the Vault dashboard shows it)
- `api.achievements.getPlayerLeaderboard({ limit })`: ranked players (ties share a rank; names are the passport handle, else the forum name)
- `api.achievements.syncMyCollectorAchievements`: evaluates the player's achievements on load
- `api.achievements.getLeaderboard` and `getCountryLeaderboard`: nation boards on `/leaderboards` only

## Deep links

An unlock notification (`notificationAPI.trigger({ achievement: { key, ... } })`) and the feed entry for an
unlock (`achievementKey` in the activity metadata, read by `UnifiedFeedItem`) both link to
`/vault/achievements?a=<key>`.

## Maintenance notes

- Keep `docs/systems/achievements.md` updated whenever categories, rarity tiers, or trigger types change.
