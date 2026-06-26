# Statecraft — Stage 1 scope (the spine + the Almanac)

Date: 2026-06-25 · branch v2. Implements Stage 1 of `plans/mycountry-statecraft.md`.

## STATUS: built 2026-06-25 (ships dark behind `STATECRAFT_SPINE=1`)

All tickets done. New files: `src/lib/statecraft-almanac.ts` (+test), `src/lib/statecraft-recon.ts`
(+test) — 7 tests green. Schema: `NationalIssue.reconReadyIxTime` (additive `db push`, applied).
Flag: `gameplay-flags.ts` `statecraftSpine` (default off). Backend: `commissionRecon` +
`getReconReveal` in `national-issues/player.ts`. UI: recon panel in `IssueDetailModal.tsx`; almanac in
the hero "Up Next" + the Halo command palette ("Upcoming"). Cadence: weekly trickle via statecraft-aware
debounce in `national-issues-engine.ts`. Lint: 0 errors. **Key lazy calls:** Capacity reused the existing
`getCivilServiceStatus`/`calculateCivilServiceCapacity` (no new pool); Halo almanac surfaced via the
already-open command palette (NOT a risky global clock-click rewire — that's deferred, see S1.A.3 note).

Goal: the full
**IN → SEE → OUT → RIPPLE** loop in the **Domestic arena only**, weekly, with one mechanically-active
lever (Capacity), the never-lie recon, and the clock. Delivers the "you're governing" feel by itself;
diplomacy/politics/brokers are later stages.

## The big de-risk

Recon is nearly free to build: every issue response option **already stores both forms** —
`previewEffects` (vague strings, what the player sees today) and `consequences`
(`ConsequenceDefinition[]`, the hard numbers) — in `src/lib/national-issues-engine.ts`. **Recon = spend
Capacity to swap the vague preview for the hard numbers, with fog.** No new effect computation.

## Tickets

### S1.A — The Almanac (revised: reuse the Halo + hero, don't build a widget)
The clock already lives in the **Halo** (`DynamicIsland/CompactView.tsx`, via `useIxTime`), the **hero
smart stack** already has an iOS Calendar widget (`OverviewHero.tsx`), and the **live-activity pattern**
already exists (`SportsLiveDIPlugin.tsx` — high-priority pill that ticks off the shared IxTime clock).
So the Almanac is **one data feed → two existing surfaces.**

- **S1.A.1 — `getUpcomingEvents` feed.** ✅ DONE. `src/lib/statecraft-almanac.ts` — pure function
  (elections + issue deadlines + term end → future events, soonest first) + `formatRelativeIxDays`.
  Test: `statecraft-almanac.test.ts` (3 green). Pure/no-deps so hero *and* Halo reuse it.
- **S1.A.2 — Hero calendar wiring (the dwell surface).** ✅ DONE (first slice). `OverviewHero`'s
  "Up Next:" now shows the real next dated event ("General Election in 3 weeks") from `getUpcomingEvents`,
  fed by data the hero already loads (no new query). Falls back to the old vague status when nothing's
  dated. *Follow-up:* feed issue deadlines + term end once those dates are loaded here; richer agenda list.
- **S1.A.3 — Halo clock → almanac (GLOBAL rewire).** ✅ DONE. Added an `almanac` ViewMode
  (`types.ts`), a global `AlmanacView.tsx` (fetches the signed-in user's own country's events via the
  same pure feed — works on any page), an `ExpandedView` branch, and rewired the compact IxTime clock
  click → `onSwitchMode("almanac")` (replaced the time/date toggle). Also surfaced as an "Upcoming"
  category in `MyCountryCommandPalette`. **Nuance:** the clock renders on pages with no active DI plugin;
  on plugin-takeover pages (MyCountry/wiki/forum) the plugin's pill replaces the clock by existing
  design, so on MyCountry the Almanac is reached via the hero "Up Next" + command-palette "Upcoming".
  **Live activity ✅ DONE:** `plugins/AlmanacLiveDIPlugin.tsx` (mounted globally in `app/layout.tsx`,
  mirrors `SportsLiveDIPlugin`) — when the soonest event is within ~2 IxDays it takes over the pill with
  a per-second ticking countdown (`formatIxCountdown`, priority 90 < sports' 100); tapping expands the
  Almanac. *Remaining optional:* force the clock to coexist with plugin pills for a truly always-visible
  clock.

### S1.B — The recon fog function (the heart; pure + testable). TODO
`revealConsequences(consequences, components, departments, capacityState, efficiency) → RevealState[]`,
returning per-effect **revealed / greyed** (`"no Ecology component"`) **/ questioned** (`"may be
inaccurate — over capacity"`). Maps each `ConsequenceDefinition.targetField` → domain → required
component/department. *This is never-lie as code.* One test: a Stratocracy greys popularity; a
Democratic+Electoral build reveals it.

### S1.C — The Capacity lever: real + visible. TODO
Derive a weekly Capacity pool from `governmentCapacityIndex` (+ gov size); track recon spend this
IxWeek; render a `Spent / Total` bar. The hero **already has a "Civil Service Capacity" widget**
(`OverviewHero.tsx` ~line 108) — wire the pool into it. No full allocation ledger yet.

### S1.D — The Meeting (recon action) on issues. TODO (centerpiece)
"Commission research / convene cabinet" button in `national-issues/IssueDetailModal.tsx`. Costs Capacity
(+ token Treasury). Sets a **modest, constant** `reconReadyIxTime` (the "come back to see what your team
cooked" rhythm — constant across gov quality; penalty = fog, not time). On ready, reveals the hard
`consequences` per option with S1.B fog states. Persist via **3 additive nullable fields on
`NationalIssue`** (`reconReadyIxTime`, `reconLevel`, `reconRevealedJson`) — additive `db push` like T6.

### S1.E — Weekly cadence + flag. TODO
Retune issue arrival to ~weekly per country (generation cron currently runs every 15m). Gate the new
Capacity/recon behavior behind a new `gameplay-flags.ts` entry (`statecraftSpine`, default off) so it
ships dark.

## Out of Stage 1 (named so scope can't creep)
Diplomacy & Politics arenas, Bills, Power Brokers (Stages 2–4) · granular per-point recon drip with time
estimates (1.5 polish; Stage 1 is 2-tier vague→full + fog states) · full Capacity allocation ledger w/
policy upkeep · cabinet-model integration / first-class Meetings · the Chronicle (`recordCountryEvent`
spine, parallel track) · Mandate as an active gate (Stage 1 only surfaces it + the approval delta on
commit).

## Tunables to confirm before S1.D
1. **Recon delay** — start ~1–2 IxTime days, constant across gov quality. The come-back rhythm.
2. **Two-tier reveal** (vague → full, with the 3 fog states on the full tier). Granular point-drip = 1.5.

## Build order
S1.A.1 ✅ → S1.A.2 ✅ → **S1.A.3** (finish the Almanac: Halo) → **S1.B** (fog fn, testable heart) →
**S1.C** (Capacity into the existing hero widget) → **S1.D** (the Meeting; +3 fields) → **S1.E**
(cadence + flag).
