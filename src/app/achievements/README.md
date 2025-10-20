# Achievements & Leaderboards

**Last updated:** October 2025

This directory contains the React views and supporting utilities for `/achievements` and `/leaderboards`.

## Structure
| Path | Purpose |
| --- | --- |
| `page.tsx` | Lists achievements with filtering, search, and unlock details |
| `components/` (shared) | Badge cards, progress indicators, category filters |
| `/leaderboards/page.tsx` | Aggregated rankings across economic, social, and achievement metrics |

## Data Dependencies
- `api.achievements.getRecentByCountry`, `getAllByCountry`, `getLeaderboard`
- `api.users.getCurrentUserWithRole` and `api.users.getActiveUsers` for leaderboard context
- Economic and diplomatic stats from `api.countries.getByIdWithEconomicData`, `api.diplomatic.getInfluenceSummary`
- Notifications triggered through `api.notifications.createAchievementAlert`

## Implementation Notes
- Components rely on the shared design system (`src/components/ui`) for consistency with dashboards
- Real-time updates can be supplied via WebSocket events (see `docs/reference/events.md`)
- Keep category labels and copy aligned with `/help/social/` and `/help/getting-started/next-steps`

## Maintenance Checklist
- Update `docs/systems/achievements.md` whenever new categories, rarity tiers, or metrics ship
- Ensure leaderboard queries remain paginated and role-protected where appropriate
- Add Jest coverage for ranking/calculation helpers when modifying logic
