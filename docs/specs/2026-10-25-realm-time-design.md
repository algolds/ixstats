# Realm time: every realm owns its clock, the platform owns none

Revises `2026-10-14-realm-clocks-design.md` (phase 1 of that spec is shipped: `Realm.settings.clock`, Manage → Time,
the realm header and header clock). Where the two disagree, this one wins.

## Owner decisions (2026-10-25)

| Topic | Decision |
|---|---|
| IxTime | **IxTime is Ixnay's realm clock**: bot-synced, 2×, staff-run, exactly as today but scoped to Ixnay and its nations. No code path asks for a global game time; it asks for a realm's or a country's time. |
| Platform systems | Platform-wide systems (Vault income and dividends, the card exchange, cards, achievements, forum and ThinkPages timestamps, sports seasons, admin) run on **real time**. Anything owned by a nation (its economy, issues, budgets, policies, effects, elections, defense) runs on **its realm's clock**. |
| Realm clock lifecycle | **Every realm has a clock from founding**: founding asks for a start date, era and speed (default 2×). Realms without one get one at migration, continuous with today (no stored history moves). There is no "no clock / inherit Ixnay" state. |
| Founder controls | Kept: speed 0–12× (0 pauses), start date, era, one speed change per 7 real days, founder + site staff only (no officers), never backwards. Added: **custom calendar** and **forward date jumps**. |
| Calendar | **Month names and lengths** defined by the founder; year length = sum of month lengths; dates read "14 Frostfall 812 AE". No custom weekdays or leap rules. Gregorian stays the default. |
| Date jumps | **Time really passes**: a forward jump moves the realm clock ahead, so economies project forward, budget years roll, elections and deadlines come due, effects phase in, history fills. Capped per jump (5 in-world years), one jump per 7 real days (staff exempt), previewed before saving. |
| Defense clock | Operation durations, conflict windows, readiness recovery and strike cooldowns use the nation's realm clock; a paused realm's operations wait. |
| Defense strength | Readiness, training, technology and morale are **derived from defense spending, time and operations**, no longer free player inputs, and they decide PvP/PvNPC outcomes. |
| Defense budget | **The National budget's Defense department allocation is the defense budget.** The Defense page reads and edits that line. The separate `DefenseBudget` row goes. |
| Legacy security tables | `SecurityAssessment`, `BorderSecurity`, `NeighborThreatAssessment`, `SecurityThreat`, `SecurityEvent` (never written, all defaults) are **dropped**. |
| Combat | PvP/PvNPC resolution, threat scoring, success ratings and readiness numbers are **reviewed and rebalanced** on the derived strength. |
| Carried over | Cross-realm country interactions stay blocked; rankings per realm; header clock by context (realm context shows that realm's clock and calendar, outside realms the viewer's real local time). |

## 1. Clock model

- One server API: `clockForRealm(realmId)` and `clockForCountry(country)` return `{ now(): number, calendar }`,
  backed by `Realm.settings.clock`. Batch variant for crons: `realmClocks(db)` → map of realm id → clock, read once
  per run. Ixnay's clock reads the bot-synced state (SystemConfig `ixtime_clock_state`, see `src/lib/ixtime/shared-clock.ts`).
- Client: `useRealmClock(realmId)` / `useCountryClock(country)`; the global IxTime store survives only as Ixnay's
  clock source.
- Timeline: all realm clocks live on the shared millisecond timeline (they start equal to global IxTime at switch-on),
  so every stored IxTime column stays valid; a realm's "now" is simply a different point on it.
- Date jump: `anchorClockMs += jumpMs` (forward only, ≤ 5 in-world years, cooldown 7 real days, staff exempt).
- Calendar: `calendar = { months: [{ name, days }], era, startOffsetMs }`; one pure formatter
  `formatRealmDate(ms, calendar)` and its inverse for date inputs; Gregorian when no custom months.

## 2. Nation simulation on its realm clock

Everything in the 10-14 spec §2: projection and stat-progression (grouped per realm; paused realms skipped; a jump
is caught up by the next run), budget year and rollover, national issues, policies and maintenance, politics drift
and stability, elections, executive intents and legislation cooldowns, StorytellerEffect stamps
(`createStorytellerEffect` takes the country's clock), country creation baselines, and the defense timers above.

## 3. Platform on real time

Vault, exchange, cards, achievements, forum/ThinkPages, sports seasons and admin stop calling IxTime and use
`Date.now()`. Admin keeps an Ixnay clock panel (staff controls Ixnay like any realm, plus the bot sync).

## 4. Defense model

Researched model: `plans/realm-time/defense-research.md` §7 (86 sources; values marked "designer" there are tunable
defaults, not evidence) on the inventory in `plans/realm-time/defense-audit-codebase.md`. That §7 is the formula
reference; this section fixes the owner's choices on top of it.

### 4.1 Owner decisions (defense, 2026-10-25)

| Topic | Decision |
|---|---|
| Fidelity | **Hybrid**: branches carry personnel, PIM capital stock and readiness from money and time; catalog assets add quality and specific capabilities. |
| Branches | **Fixed domains, custom names**: each branch has a domain (land, sea, air, marines, space, strategic missile) that sets capital intensity α, depreciation δ, crew norms and role; the player names it. |
| Outcomes | **Stochastic with shown odds**: logistic odds on the effective force ratio (k = 2.5, 5% catastrophe tails), outcome bands, HMAC seed bound to the committed orders, 1,000-run preview. |
| Intel | **Estimates with error bands**: the enemy's power (and so the odds) is shown as a range whose width shrinks with intelligence investment, relations and recon. |
| Levers | All four: **budget split** (personnel / O&M / procurement / R&D / infrastructure, with Professional / Territorial conscript / Rearm presets), **manpower model** (volunteer share, service months, reserves, mobilisation), **procurement** (catalog orders with lead times), **doctrine and posture** (defensive / balanced / expeditionary; alert levels Peacetime / Elevated / High / War). |
| Procurement sources | **Domestic + catalog imports**: domestic within industrial capacity; imports from the catalog at +15% cost and longer lead times. No player arms trade yet. |
| Theatre | **Map-derived with fallback**: terrain from the realm map's altitude/climate layers, front width from border length (force-to-space), reach and supply from distance; when map data is missing, the defender's declared terrain profile. |
| Mobilisation funding | **Emergency supplement**: mobilising above the budget raises defense spending outside the annual budget; it lifts the burden, crowding-out and collapse risk. |
| Economic feedback | **Realistic**: crowding-out above 2% of GDP (elasticity −0.15, ~3%/yr convergence), R&D spillover, mobilisation labour hit, burden collapse hazard above 50%, war damage toward −30% GDP on home soil over ~5 years (−10% neighbours), ~25% of casualties are deaths removed from population, civilian losses on war sites. All as level effects on the realm clock. |
| NPCs | **Derived from their economy**: Defense share by government type/region, forces generated with the same formulas, damped Richardson budget response to threats. |
| Existing forces | **Reset to a starter force** under the new model (typed readiness/technology/training/morale and free assets are discarded). |

### 4.2 Shape
- Per-country defense policy record (shares, manpower settings, doctrine, alert) and per-branch state (domain, N,
  reserves, K, R&D/infrastructure stocks at country level, readiness sub-scores P/S/Rc/T, `lastTickClockMs`).
- Monthly update on the nation's realm clock, brought up to date lazily on read and write (closed forms for long gaps
  and date jumps); paused realms don't move.
- Assets keep their catalog key; orders are rows with lead times and a payment schedule.
- Budget input: the Defense department line with a fallback chain when a nation has no structure (builder Defense
  line → government-form default share × spending → 2% of GDP), as the codebase audit recommends.

## 5. Phases

1. Clock core + calendar + jumps + founding + migration of existing realms; defense budget → Defense department;
   drop legacy tables.
2. Nation simulation on realm clocks; platform systems on real time; defense strength model and realm-clock timing.
3. Client per-country displays; cross-realm guards and per-realm rankings; combat rebalance; runbook.

Checked on `ixstats_wv1` by giving two realms different speeds, pausing one and jumping one, and confirming their
nations' projections, budget years, issues, elections and defense follow while Ixnay's do not.
