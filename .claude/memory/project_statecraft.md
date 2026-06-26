---
name: project_statecraft
description: Statecraft = the branded MyCountry gameplay loop design; three levers Capacity/Treasury/Mandate; one loop across domestic/diplomacy/politics
metadata: 
  node_type: memory
  type: project
  originSessionId: 37bb762d-f4ad-4847-89cd-7ee56524465a
---

**Statecraft** is the agreed brand for the MyCountry gameplay loop (June 2026, v2). Full design:
`plans/mycountry-statecraft.md`. Evolves [[project_mycountry_core_loops]] (loops) and builds on
[[project_lore_alignment]] (atoms + canon surface). Brand note: "Statecraft" was a candidate app name
before IxStates (the ix- brand from NationStates region Ixnay) — now the MyCountry loop.

**The model (co-designed w/ Heku + tester Keaor):**
- **Loop:** IN → SEE → OUT → RIPPLE, weekly (IxTime). Player verbs = only **See** (pay to de-fog a
  Stimulus via a Meeting) and **Commit** (Policy/Event/Bill). Answers community "feels like a browser
  game" objection: diegetic in, narrative out, math hidden in the middle.
- **3 actors:** You (decide+spend) / The World (deals Stimuli, answers recon, adjudicates, recharges) /
  Other Powers (foreign nations + internal Power Brokers — originate Stimuli, gate consent).
- **3 levers (NOT "currencies" — 3 different kinds, mostly already in code):** **Capacity** = a *rate*
  (admin bandwidth; `governmentCapacityIndex` + `GovernmentComponent.requiredCapacity`). **Treasury** =
  a *stock* (the real budget/economy — never rebrand as a token). **Mandate** = a *standing* (legitimacy
  you risk; `computeApproval` = leading-party support + stability; foreign twin = `Embassy.influence`/
  `.reputation` via `EmbassyMission` cost→reward).
- **3 arenas = same loop, differ only by resolution:** Domestic=**executive fiat**, Diplomacy=**foreign
  consent**, Politics=**legislative vote**. Cross-arena ripple via `recordCountryEvent` spine. Gives the
  inert politics layer a job (Bills=legislature verb vs Policy=executive verb).
- **Never-lie contract:** World withholds/caveats, never fabricates. 3 recon states: revealed / greyed
  (no component/dept) / question-marked (over-capacity/low-efficiency). Fog is **motivated by your atomic
  build**, not arbitrary (a Stratocracy literally can't read popularity well).
- **Personalization:** atomic components = the EQ on all 4 beats (deck bias / fog / commit price+gate /
  recharge). Lore-first 2-layer: **surface** = verbatim canon free-text (Corcillum, Woqalate, N
  branches), **substrate** = ~90 atoms the engine computes on. Free text for identity, atoms for
  mechanics, never collapse.
- **Power Brokers** = internal "Other Powers" (canon-named, component-synergy-unlocked, atom-gated dept-
  spend modifiers); BUILD LAST (config table once spine exists).
- **Cadence:** weekly not daily; penalty axis = **fog not time** (don't vex IRL time). **Almanac** (IxTime
  clock) = cheapest ship-first win. **Chronicle** = wiki-ready history = lore-first payoff.

**Stage 1 scoping + build (June 2026):** `plans/statecraft-stage1.md`. BIG DE-RISK: issue response
options already store BOTH `previewEffects` (vague) AND `consequences` (hard numbers) in
`national-issues-engine.ts` → recon = spend Capacity to swap vague→hard with fog, no new effect calc.
**Almanac decision:** don't build a widget — reuse the Halo clock (`DynamicIsland/CompactView.tsx`) +
hero smart-stack iOS Calendar (`OverviewHero.tsx`) + the live-activity pattern (`SportsLiveDIPlugin.tsx`).
One feed → two surfaces. SHIPPED: `src/lib/statecraft-almanac.ts` `getUpcomingEvents` (pure) + test (3
green); hero "Up Next:" now shows real next dated event. TODO: S1.A.3 Halo almanac expand view + live
countdown; S1.B `revealConsequences` fog fn; S1.C Capacity pool→existing hero Civil-Service widget; S1.D
Meeting recon action in `IssueDetailModal` (+3 additive `NationalIssue` fields reconReadyIxTime/reconLevel/
reconRevealedJson); S1.E weekly cadence + `statecraftSpine` gameplay-flag (default off). Tunables: recon
delay ~1-2 IxDays CONSTANT across gov quality (penalty=fog not time); 2-tier reveal (granular drip=1.5).

**STAGE 1 BUILT 2026-06-25 (v2, ships dark behind env `STATECRAFT_SPINE=1`, default off):** New libs
`statecraft-almanac.ts` (`getUpcomingEvents` pure feed) + `statecraft-recon.ts` (`revealConsequences`
never-lie fog: revealed/greyed/questioned, domain→component/dept map; Stratocracy greys popularity) —
both +tests (7 green). Schema: additive `NationalIssue.reconReadyIxTime` (one field encodes recon state;
db push applied). Backend: `commissionRecon`+`getReconReveal` in `national-issues/player.ts` (recon
reserves Capacity via `loadReconContext`, RECON_DELAY 1.5 IxDays CONSTANT, RECON_CAPACITY_COST 20). UI:
recon panel in `IssueDetailModal.tsx`. Almanac surfaced in hero "Up Next" (`OverviewHero`) + GLOBAL
Halo clock rewire (user requested 2026-06-25): new `almanac` ViewMode (`types.ts`) + global
`AlmanacView.tsx` (fetches signed-in user's own country events, any page) + `ExpandedView` branch +
compact clock click → `onSwitchMode("almanac")` (replaced time/date toggle); also "Upcoming" category in
`MyCountryCommandPalette`. NUANCE: clock only renders when no DI plugin is active; on plugin-takeover
pages (mycountry/wiki/forum) the plugin pill replaces the clock — on mycountry the almanac is still
reached via hero + command palette. LIVE ACTIVITY DONE (2026-06-25): `plugins/AlmanacLiveDIPlugin.tsx` (mounted
globally in `app/layout.tsx`, mirrors SportsLiveDIPlugin) — soonest event within ~2 IxDays takes over the
pill with a per-second ticking countdown (`formatIxCountdown` in statecraft-almanac.ts, priority 90 <
sports 100), tap expands AlmanacView. Only remaining optional: force clock to coexist with plugin pills
(always-visible). DIPlugin shape: {id,priority,center,expandedViews,accentColor,stickyLabel,badge}. Capacity = REUSED existing `getCivilServiceStatus`/`calculateCivilServiceCapacity`, no new
pool. Cadence: weekly trickle via statecraft-aware debounce (2 IxDays) in `national-issues-engine.ts`
`shouldEvaluate` (maxIssuesPerWeek cap already existed). KEY GOTCHA: issue options already store BOTH
`previewEffects` (vague) + `consequences` (hard) so recon just gates which you see. Doc: `plans/statecraft-stage1.md`.

**STAGE 2 (diplomacy interconnect) STARTED 2026-06-25:** scope `plans/statecraft-stage2.md`. S2.A ✅ DONE:
`src/lib/statecraft-foreign-policy.ts` `computeForeignPolicyImpact` (pure +test) with Keaor's
relative-development asymmetry (richer partner→more GDP for you; bigger gap→bigger relations boost; poorer
side out-gains); de-duped the impact switch that was COPIED in both `previewForeignPolicyImpact` +
`proposeForeignPolicyAction` (`diplomacy/policies/foreignPolicy.ts`). GOTCHA: kept `inputType`
(GDP_ADJUSTMENT/TRADE_AGREEMENT/GROWTH_RATE_MODIFIER — how effect applies, not magnitude). TODO S2.B
diplomacy recon (SEE: intel briefing reveals target stats, fogged by your embassy/intel reach, spends
Capacity, reuse `statecraft-recon.ts`); S2.C Diplomatic Events (foreign-consent state machine on
`ForeignPolicyAction.status` proposed→accepted→active; cooperative=consent, hostile=unilateral; event
catalog via EmbassyMission rewards). Deferred: military/geo blockade math (needs military-stat plumbing).

**S2.B ✅ + S2.C ✅ (backend, 2026-06-25):** S2.B `src/lib/statecraft-diplo-intel.ts` (`assessReach`
embassy→revealed/ties→questioned/none→greyed + `fogNumber` 2-sig-fig estimate, never fabricates) + query
`api.diplomaticPolicies.getForeignIntel` (target stats fogged by YOUR reach = Embassy guest/host + relation
strength); Capacity-timed briefing deferred. S2.C reused `ForeignPolicyAction.status` (no migration):
extracted shared `enactForeignPolicyEffects(db,actionId,actorUserId)` helper (idempotent); cooperative
(free_trade/military_alliance) propose→`proposed` no-effects, hostile→enact `active` immediately; new
`getForeignPolicyProposals` + `respondToForeignPolicyProposal` (target accept→enact / decline). GOTCHA: 2
proposal systems — DiplomaticAction inbox (`inbox.ts`, NPC/treaty/embassy_upgrade, uses CountryEventSpine
which IS BUILT in `lib/country-event-spine.ts`) vs my ForeignPolicyAction consent. 10 lib tests green, lint
clean. UI ✅ DONE: intel block + reach caption in `ForeignPolicyCreatorSheet` (IntelStat: greyed "—",
questioned "~"); new `ForeignPolicyProposalsInbox` (accept/decline) in `ForeignPolicyPanel`; creator
success msg distinguishes "Proposal sent" (cooperative) vs "enacted" (hostile). FP api path =
`api.diplomaticPolicies.*`. STAGE 2 COMPLETE (backend+UI, lint clean, 10 lib tests green).

**STAGE 3 (politics/Bills) ✅ DONE 2026-06-25:** scope `plans/statecraft-stage3.md`. BIG DE-RISK: Bills loop
already closed — `routers/legislation.ts` (bill = Policy `policyType:legislative_bill`) propose→holdVote→
`tallyVote`(pure `lib/legislative-vote.ts`)→`applyPolicyEffect`+news; UI `BillsPanel`/`ApprovalPanel`/
`PoliticsWarRoom`. S3.A whip count: `src/lib/statecraft-whip.ts` `fogVoteProjection(result,standing)`
(revealed≥60 exact/questioned≥35 directional/greyed<35) + query `api.legislation.previewBillVote` + UI
`WhipCount` in BillsPanel. S3.B Mandate factor: `tallyVote` += optional `governmentBacking` (approval/100,
whips ½ abstainers→yes; omitted=back-compat) fed from holdVote+preview. BONUS BUG FIX: holdVote read
non-existent `seat.seats`→NaN tallies; extracted `loadBlocs` (each LegislativeSeat=1 seat). `getGovernmentBacking`
= `computeApproval(parties, politicalStability)`. S3.C (bills mandate/unlock) deferred. 5 whip tests green,
23 total statecraft lib tests green, lint clean.

**Staging:** 1) spine ✅ 2) diplomacy ✅ 3) politics/Bills ✅ DONE 4) Power Brokers — SCOPED `plans/statecraft-stage4.md` (not built). Internal "Other Powers": atom-unlocked
(government-synergy.ts SYNERGY_MAP), dept-spend-gated (BudgetAllocation.allocatedPercent by category),
bonus rides applyGovernmentComponentEffects→StorytellerEffect tagged BROKER:<id> (re-run by politics-drift
cron). v1 boundary = S4.A pure catalog+derive (`statecraft-power-brokers.ts` deriveBrokers) + S4.B apply +
UI panel, DERIVED (no table) bonus-side only; defer S4.C demands→Issues + S4.D selection table/Editor.
Seed brokers: Technocrats/The Party/Generals/Magnates/Clergy (atom→canon name→dept condition→lever bonus).
No existing broker concept (net-new). Open calls: derived-vs-selected (rec derived), minPercent ~15%, tensions w/ S4.C. **Open calls (recommended):** recon unilateral (only binding deals need consent);
penalty=fog; Bills=legislature verb. Nothing built yet — this is the design doc; engine pieces mostly
exist (see doc §9 "Built from" table).
