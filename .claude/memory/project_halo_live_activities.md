---
name: project_halo_live_activities
description: Halo (Dynamic Island) Live Activities — sports live-match scoreboard via DI plugin + deterministic shared-clock playback
metadata: 
  node_type: memory
  type: project
  originSessionId: cdd7d408-28a8-423f-a754-0d37a47903be
---

Halo Live Activities (iOS-style live scoreboard in the Dynamic Island), built June 2026, v2. First use case: a signed-in user's sports clubs.

**Core trick — no realtime backend needed.** Matches resolve instantly in the cron, but the resolver emits a minute-by-minute event `trace` (stored at `SportMatch.matchStats.trace`; events `{ t, type:"goal"|"card"|..., team:"home"|"away", description }`). "Live" is a *deterministic shared-clock replay*: every client maps `(IxTime.getCurrentIxTime() - resolvedIxTime) / windowMs` → progress → match-minute → cumulative score from the trace. Because IxTime is shared and the trace is deterministic, all clients agree with ZERO server ticks / no WebSocket. Pure fn: `src/lib/sports/live-match.ts` `computeLiveMatchState()` (tested, live-match.test.ts). Window = 10 IxMinutes ≈ 5 real min @2x.

**DI plugin system** (`src/components/DynamicIsland/`): register via `useDIPlugin({ id, priority, center, expandedViews, badge, accentColor, context })` from `plugin-context.tsx`. `useActiveDIPlugin()` picks highest priority. Pill renders `activePlugin.center`; tapping opens `plugin:<firstExpandedViewKey>` → host renders `expandedViews[key]` with `DIViewProps` incl. `context`. GOTCHA: only register when ACTIVE — gate in a parent that returns null and mount a child that calls `useDIPlugin` (can't call the hook conditionally). An always-registered plugin makes `useActiveDIPlugin` non-null everywhere = pill side effects.

**This feature's pieces:** server `api.sports.getLiveActivities` (teams.ts, owned teams + matches with resolvedIxTime in window, returns trace+colors+finalScores); `SportsLiveDIPlugin.tsx` (parent gate + `ActiveSportsLivePlugin` registrar + `LivePill` center + `SportsLiveView` expanded, all one file); mounted globally in `app/layout.tsx` inside `DIPluginProvider`. Polls 30s, `enabled: isSignedIn`. priority 100 = takes over the island like iOS.

Note: `MatchTickerSim.tsx` (the old per-match replay) reads `step.teamId`/`.commentary`/`.minute` but the resolver pushes `team`/`description`/`t` — field-name mismatch, likely partly broken; live-match.ts uses the REAL resolver shape. See [[project_myleague_audit]].
