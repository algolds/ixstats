# Achievements

**Last updated:** 2026-11-14

This directory holds the React view for `/vault/achievements` and `?tab=lorewards` inside the Vault. Both destinations live directly in the global Vault sidebar (`src/lib/navigation/app-sections.ts`), so neither page renders a secondary `SegmentedControl` tab bar. Nation and collector standings live on `/leaderboards`. See `docs/systems/achievements.md` for the full guide.

## Routes

| Path                                | Purpose                                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/vault/achievements`               | Mastery summary (`AchievementsSummaryCard`), rarest earned medals shelf (`RarestEarnedMedalsShelf`), and grouped `FacetList` catalogue (`AllAchievementsTab` + `AchievementListView`) |
| `/vault/achievements?tab=lorewards` | Dedicated Lorewards writing honours page (`VaultLorewardsPanel` wrapping `LorewardsView` + `LorewardAchievements`)                                                                    |
| `/vault/achievements?a=<key>`       | Highlights and scrolls to that achievement or series row inside `AchievementListView`                                                                                                 |
| `/leaderboards`                     | Unified `data` ranking table (`CountryLeaderboards` + `LeaderboardTab` collectors mode)                                                                                               |
| `/util/lorewards`                   | Lorewards in WikiOS: today's race, standings, recent winners                                                                                                                          |

## Surfaces

- **Achievements** (`AchievementsSummaryCard`, `RarestEarnedMedalsShelf`, `AllAchievementsTab`, `AchievementListView`): `LensCard` mastery summary, `CutoutCard` rarest earned medal shelf, and inset grouped `FacetList` rows with Roman-numeral tier pips (`I · II · III`) and secret reveal.
- **Lorewards** (`VaultLorewardsPanel`): Order of the Lore summary `LensCard`, annual recognition cycle `FacetList`, and the shared `LorewardsView` (`focus="you"`).
- **Leaderboards** (`CountryLeaderboards` + `LeaderboardTab` on `/leaderboards`): unified ranking table with inline `ActionPill` metrics (`Total GDP`, `GDP per capita`, `Population`, `Density`, `Growth`, `Collectors`) and `LeaderboardRealmSelect`.

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
