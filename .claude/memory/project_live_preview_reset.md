---
name: project_live_preview_reset
description: The live-preview data reset + hero/map UX changes done June 2026
metadata:
  type: project
---

Prepped a clean live preview (June 2026, v2):

- **Data reset** via `scripts/reset-for-live-preview.ts` (dry-run default, `--apply`). Cleared transient gameplay state across ALL nations: nationalIssue (+consequences), issueGenerationLog, policy (+effect logs), cabinetMeeting (+children), activitySchedule, intelligence briefings/alerts/recommendations, vitalitySnapshot, countryActivity, activityFeed, and country-tied notifications. Counts at run: 94 issues, 449 policies, 91 issue logs, 2 meetings, 55 activityFeed, 172 notifications. **0 `isDemo:true` countries existed** (the `user_1`/`user_2`/`test-auth-id` records are Jest mocks only, never in prod). 144 real nations (isDemo:false) untouched. NOT touched: Country/User/economy/gov 1:1 models, *Template tables. Re-runnable. Demo removal path = `DemoSeedService.destroyDemoCountry`.

- **Hero map** (`src/components/maps/widgets/hooks/useCountryMapEmbedLayers.ts`): city dots now reveal RELATIVE to the fitted baseline zoom (captured on `map.once("idle")` after fitBounds) — default view = national capital only; region capitals then cities appear as you zoom in (delta-based thresholds), hide on zoom out. Build-time 200k floor still drops tiny cities from the embed.

- **Hero help modals**: reusable `src/components/ui/hero-help-modal.tsx` (`HeroHelpModal` — a "?" button + stepped Dialog, ALWAYS reopenable, unlike `IntroDisclosure` which permanently self-hides). Wired into DashboardRouter `DashboardHero` (global guide, blue) and `OverviewHero` (MyCountry guide, amber). Steps defined as module consts in each hero.

- **Hero info panels**: stronger border/opacity + backdrop-blur for readability (DashboardRouter line ~817, OverviewHero line ~791).
