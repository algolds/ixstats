# Achievements & Leaderboards

**Last updated:** October 2025

Achievements reward milestone progress across economic, diplomatic, social, and defense domains. Leaderboards surface comparative stats across nations and players.

## Frontend Modules
- `src/app/achievements` – Achievement index, detail views, and filters
- `src/app/leaderboards/page.tsx` – Leaderboard hub with sortable metrics
- `src/components/achievements` – UI widgets, badges, unlock progress indicators
- `src/components/dashboard/_components/EnhancedCountryCard.tsx` – Integrates achievement highlights into dashboards

## Backend Routers
- `achievements.ts` – Fetch recent achievements, per-country lists, leaderboards, and unlock mutations
- `activities.ts` – Provides social feed data when achievements should broadcast
- `notifications.ts` – Sends unlock and leaderboard movement alerts
- `users.ts` – Supplies player metadata for leaderboards

## Data Models
- `Achievement`, `AchievementCategory`, `AchievementProgress`, `UserAchievement`
- Leaderboards aggregate economic, social, defense, and intelligence stats from respective tables

## Unlock Flow
1. Backend services calculate progress (scripts or scheduled jobs)
2. `achievements.unlock` mutation records completion and triggers notifications
3. UI updates via React Query caches and optional WebSocket pushes
4. Leaderboards recompute as part of scheduled audits or on-demand requests

## Documentation & Help
- `/help/achievements/*` (to be created) should mirror this guide and provide player-facing explanations
- Update references when new categories or scoring rules ship

Ensure any schema or scoring change updates routers, calculations, tests, and documentation simultaneously.
