---
name: project_myleague_audit
description: "MyLeague/MyClub sports engine audit — shared helpers location, derived wages, idempotency pattern, what's already built"
metadata: 
  node_type: memory
  type: project
  originSessionId: 02d0ed45-4dc6-42d8-8698-69047a38290b
---

MyLeague/MyClub (sports) audit + hardening pass, June 2026, branch v2.

**Shared sim helpers live in `src/lib/sports/team-rating.ts`** — `computeTeamRatingVector`, `getTeamModifiers`, `simpleHash`, `teamIndexHash`, `careerStageMultiplier`, plus new `playerWage`/`teamWageBill`. These were copy-pasted into all 7 sports router files during the 2026-06-13 monolith split (dead in 5, live in 3); now one source, exported via `src/lib/sports/index.ts`. Don't re-duplicate them into router files.

**Sim idempotency pattern**: `simulateMatchDay`/`simulateRace`/`simulatePlayoffRound` in [matches.ts] now claim rows atomically (`updateMany` on `status: scheduled→completed`, skip if `count===0`) before applying non-idempotent standings `increment`s. Any new sim mutation that increments standings MUST use this guard or double-clicks double-count. `recalculateStandings` in leagues.ts is the idempotent full-recompute alternative (used by edit-match-result path).

**Player wages are DERIVED from overall rating** (`playerWage` = overall²/10), no schema column. Deducted from `SportTeam.budget` (not the user wallet) once per season in `transitionSeasonAction`. `getMyClubOverview` returns `wageBill`.

**Already-built (don't rebuild)**: promotion/relegation (parent↔sub-league swap via `parentLeagueId`/`relegationCount`/`promotionCount`), trophy-card minting, quadrennial World Cup, aging/draft/rookie generation — all in `src/lib/sports/transition.ts`. Season awards (top_scorer/most_assists/mvp → `SportSeasonRecord`) added there too.

**Transfer escrow**: bids escrow via `exchangeService.spend`; refund paths are `respondToTransferBid` (reject), `withdrawTransferBid`, `cancelTransferListing`. Bug fixed: `updateTeam` had no ownership check (IDOR) — now owner-or-`isSystemOwner`.

**June 2026 feature batch (v2, all shipped):**
- **Pause/resume league**: cron (`advanceSportsSeasons`) now skips `league.status="paused"`. UI was already there (LeagueSettingsModal Competition-tab status dropdown via `updateLeague`).
- **Standings movers**: cron re-rank captures old vs new rank → `formatMatchDayBulletin({movers})` adds "📈 Table Movers" section (optional arg, back-compat).
- **Next-match countdown**: `NextMatchCountdown.tsx` (IxTime→real via `IxTime.getDefaultMultiplier()`), fed by `findNextScheduledIxTime(schedule)` in league `[id]/page.tsx`.
- **Club result notifications** (`lib/sports/club-notify.ts` `notifyClubMatchResult`): in-app `Notification` row + durable ThinkShare record in a per-user "Sports Desk" convo (`source:"sports", sourceId:userId`, system message `userId:"system:sportsnews"`, isSystem). Called from cron match loop for owned teams. NOT wired into manual `simulateMatchDay` (cron-only). Per-club opt-out: `SportTeam.notifyResults` bool (default true) + `sports.setClubNotifications` mutation + "Match Notifications" Switch on MyClub page; cron skips when false.
- **MyClub overview card**: live ticker (`MatchTickerSim`) shows ONLY when `getLiveActivities` has a live match for the club (real trace, `homeTeamId`/`awayTeamId` now exposed on that query); otherwise `ClubResultsCard` (`src/components/myclub/ClubResultsCard.tsx`) = latest-result match overview + head-to-head bars + Last 5 Results, via `sports.getClubResultsOverview`. Replaced the old hardcoded demo trace.
- **Prediction market (parimutuel)**: NEW Prisma model `SportPrediction` (sports.prisma) — **needs `bun run db:push:force` to create `sport_predictions` table**. `lib/sports/predictions.ts`: pure `computeParimutuel()` (winners split pool pro-rata, refund/void if none right; tested) + `resolveMatchPredictions()` (idempotent on status="open", pays via `exchangeService.earn`). Router `sports/predictions.ts` (placePrediction/getMatchPool/getMyPredictions), merged in sports/index.ts. Added `PREDICTION_STAKE`/`PREDICTION_PAYOUT` to `ExchangeTxType` union (closed union in exchange-service.ts). Resolution wired into BOTH season-cron AND manual matches.ts. UI: `MatchPredictionWidget.tsx` in MatchDetailModal for scheduled matches. No house rake. Brackets/races have no predictions (SportMatch only).

DEPLOY: `db:push:force` (prediction table) + build (cron-runner uses compiled `.js`).

**Auto-advance IS already live** (June 2026): `advanceSportsSeasons()` in `src/lib/sports/season-cron.ts`, wired in `cron-runner.mjs` (`0 */6 * * *`, PM2 `ixstats-cron`). Matches scheduled 1 IxDay apart at season start (`startIxTime + matchDay*86_400_000`); cron resolves the earliest due matchday only if `scheduledIxTime <= now`, then auto-transitions on completion.

**IxTime is 2× (CONFIRMED by user)**, not 4×. `ixtime.ts` BASE_TIME_MULTIPLIER=4.0 is the PRE-pivot rate; effective rate uses a pivot — since 2025-07-27 real, IxTime = (2040-01-01 IxTime) + (now-pivot)*2. So 1 IxDay = 12 real hours. Always compute current IxTime via the pivot formula, NOT raw BASE_TIME_MULTIPLIER (that mistake made me wrongly report a 600-IxDay drift).

**Sim is tracking IxTime correctly** (verified June 2026: in-progress seasons had next matchday just-due and the rest scheduled into the IxTime future). Cron at 6h vs 12h/matchday ticks twice per interval — one resolves, next no-ops. NO backlog.

**IMPLEMENTED June 2026 (v2)** — automation refinement, all shipped:
- **(A) bounded catch-up loop** in `advanceSportsSeasons` (season-cron.ts): `MAX_STEPS_PER_RUN=50`, drains all matchdays due in IxTime, self-gates per step. Stage transitions mid-run deferred to next tick.
- **(B) per-league cadence**: `scheduler.ts` exports `matchIntervalMs(settings)` (default 1 IxDay) + `raceIntervalMs` (default 3). Used at all 6 schedule-write sites (lifecycle.ts, leagues.ts, transition.ts — match + race). UI knob "IxDays Between Matchdays" in LeagueCreator → `settings.matchIntervalDays` (7 = weekly). `createLeague` settings is arbitrary-JSON passthrough, no schema change.
- **(C) cron `*/15`** + per-process reentrancy guard in BOTH cron-runner.mjs (live owner) and server.mjs.
- **Feed gap closed**: extracted `src/lib/sports/feed-post.ts` `postMatchDayBulletin()` (SportsNews thinkpagesPost + async LLM narration + Discord mirror); now called by BOTH manual `simulateMatchDay` (matches.ts, replaced ~80-line inline block) AND the cron path (season-cron advanceLeagueMatchDay collects resultLines). Champion bulletin already posted via transitionSeasonAction.
- Test: `scheduler-interval.test.ts`. CEILING: catch-up draining N overdue matchdays posts N bulletins → N LLM/Discord calls (only on backlog recovery; fine normally). **Deploy: cron-runner imports compiled `season-cron.js` → needs a build.** Cross-process double-count risk unchanged (season-cron resolution still lacks matches.ts claim-guard; run sports advance in ONE process).
