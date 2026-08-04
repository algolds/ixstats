# MyCountry v2 — Actions-First Command Surface

**Status:** In progress · **Branch:** v2 · **Supersedes:** the thin v2 overlay only.
**Grounding:** `plans/mycountry-v2-migration.md`, `plans/mycountry-bible-v2.md`, `plans/mycountry-vision-audit.md`,
`plans/mycountry-core-loops-design.md`, `docs/systems/mycountry-design-philosophy-and-prds.md`,
`docs/systems/community-feedback-audit.md`. Canon note: date the standing instruction in `revision.md`.

---

## 1. The gap (start here)

Almost everything **heavy in v2 is already backend-complete**. Missing is the shell.

**Built and reused as-is:**
- **Intent router** (`src/server/api/routers/intent.ts`): `suggest` / `getStatus` / `getIntent` / `getTree` / `commit` on a `db.intent` model, with assembled Measured/Moderate/Extreme packages + acceptance weighting, weekly cooldown + cap, and locked-lever enforcement (intents never touch core stats — Editor-only).
- **Home feed + ledger:** `mycountry.getCanonFeed` + `mycountry.getChangeLog` (`src/server/api/routers/mycountry/dashboard.ts`).
- **IntentComposer** (`src/components/mycountry/primitives/IntentComposer.tsx`): goal → 3 packages + draft-custom + propose-to-cabinet flow.

**What the front end actually is today:** `/mycountry/v2` renders the **same `MyCountryRouter`** with a `v2={true}` flag that only (a) adds the IntentComposer bottom sheet + committed toast, and (b) swaps the Overview home's 4 stat tabs for `NeedsYou` + `AgendaTree`. **Everything else — Executive/Diplomacy/Intelligence/Defense/Politics — still renders as the legacy sidebar war-rooms.**

**The north star this implements:** *"MyCountry is not a nation simulator — it is an executive decision simulator. You play the government."* The home surface is organized around **player country actions**, not KPIs.

---

## 2. Target information architecture (from migration plan §2)

`/mycountry/v2` (gated route; cut over in Phase 5)

```
HOME — "The Command Surface"
├─ Hero: collapsed-by-default compact bar (flag, name, Directive + Edit actions)
├─ Briefing strip (bands — no raw numbers)
├─ THE FEED (main column): canon events + NeedsYou (reactive Issues) w/ inline respond
└─ RAIL: Declare an Intent, national standing (bands), the Record (ledger), Agenda (commitments)

EXECUTIVE mode (Console)
└─ Intent composer as the primary surface; goal pre-filled from feed actions

DRILL-DOWNS (sheets/modals — reached from home; never top-level nav)
├─ Intent detail + dependency tree
├─ Policy detail / custom package  (reuse PolicyCreatorSheet)
├─ Relations (Diplomacy folds in as foreign-policy intents + a Relations sheet)
├─ Defense (intent category + drill-down)
└─ Politics config (fiat-friendly config sheet)

COUNTRY PROFILE (relocation target for deep stats)
└─ Economy / Government / Labor / Geography tabs + Vitality + governance ledger
```

**Nav decisions:**
- No sidebar-section model, no per-section WarRoom, no tab system in v2 — **one navigator, ≤1 click** (bible Commandment 12).
- **Diplomacy is not a top-level section** → folds into Executive as foreign-policy Intents + Relations drill-down (Urcea).
- **Intelligence / Defense stop being sections** → Intelligence = the brief + fog; Defense = an intent category + drill-down. Analytics move to Profile.
- **Politics stays reachable** as a fiat-friendly config surface (bible §6 — sim informs, never overrides).
- **Deep stat tabs move to Country Profile.** MyCountry = actions; Profile = at-a-glance stats.

---

## 3. Design constraints (non-negotiable)

- North star: **actions, not KPIs.** Raw numbers become bands; analytics go to modal/Profile depth (Facet progressive disclosure).
- **One navigator, ≤1 click** (bible Cmdt 12); **instant + cooldown, fewer clicks than you think** (Cmdt 11).
- Facet glass depth hierarchy maps to disclosure: intents at parent depth, raw numbers at modal/Profile depth.
- Locked levers stay intact — never re-derive or loosen the intent server-side guards.
- **Always load the `ixstates-design` skill** before writing any UI.
- Arch guard: routers ≤700 lines; components ≤500 (extract to `lib`/`hooks`/focused components).
- Never run global typecheck (crashes the server) — use split typechecks + `bun run lint`.
- No new DB model/migration this pass (DB writes gated) — ride existing models.
- Verify **both light and dark** theme tokens on every new primitive.

---

## 4. Phase plan (each independently shippable + reviewed)

### Phase 0 — Hero collapsed by default + persisted  ✅ (done)
- v2 hero defaults to **collapsed**; compact bar (StateSeal/flag, name, leader, `ChangedSinceChip`) + the action row (**Directive** + **Edit Country**) + expand chevron.
- **Persist** expand/collapse per country via `localStorage` key `ixstats:mycountry:hero:${countryId}`.
- Expanded state keeps today/reminders agenda widgets but stays out of the action path.
- Owner: `SectionShell` `heroCollapsed` state (`src/components/mycountry/primitives/SectionShell.tsx`); v2 action cluster added to the collapsed `OverviewHero` bar so the primary actions survive the collapsed-by-default state.

### Phase 1 — New v2 command surface shell (the IA change)  ✅ (done)
- `V2CommandSurface` renders under `MyCountryRouter` **when `v2=true`**, replacing the section-switch war-room flow. Keep the single-page `pushState` router pattern.
- Three-layer IA: **HOME** (briefing + action grid + feed + rail) · **CONSOLE/EXECUTIVE mode** (Intent composer primary) · **DRILL-DOWN sheets** (right-side `Sheet`, Phase 3 scaffolds + working intent detail).
- Retire side nav in v2 mode; v1 path untouched. Sub-components: `v2/V2CommandSurface`, `V2ModeToggle`, `V2Home`, `V2Console`, `V2Agenda`, `V2DrillSheets`. Hero collapse extracted to `hooks/useHeroCollapsed.ts` (shared with `SectionShell`).
- Legacy v2 composer bottom-sheet + toast removed from `MyCountryRouter` (moved into the surface).

### Phase 2 — Action-first home assembly
- **Primary CTA:** large "Declare an Intent" → opens the `IntentComposer` bottom sheet with a pre-filled goal.
- **Action-domain nav grid:** tiles for Diplomacy (Relations sheet), Defense (intent category + drill-down), Politics (config sheet), Map (map-editor) — all 1-click.
- **NeedsYou** promoted as the "what needs your attention" heartbeat with **inline respond**.
- **Your Agenda** (intent dependency tree) → commitments rail.
- **Standing as bands** (Tense/Neutral/Cooperative), not percentages; raw analytics off home.
- **Stat tabs (Economy/Labor/Government/Geography) removed from home** → Phase 4.

### Phase 3 — Drill-downs (reuse, don't rebuild)
- **Relations sheet:** reuse `DiplomaticRelationsList` / `EmbassiesAndRelationsPanel`, restyled to bands.
- **Politics config sheet:** reuse `PartyManager` / `LegislatureConfig` / `CabinetPanel` behind one drill-down.
- **Defense drill:** reuse defense panels as an intent category.
- **Intent detail + dependency tree:** generalize the `AgendaTree` render into a modal.
- **Policy detail / custom package:** wire the composer's existing "Draft custom package" → `PolicyCreatorSheet`.

### Phase 4 — Country Profile consolidation
- Move deep stat tabs + geo/labor/government primitives (`StatGauge`, `MetricCardGrid`, `SectorBreakdownCard`, `VitalityRingsDisplay`) into the country profile route.
- Add the **governance-legible layer**: surface `CountryChangeLogTimeline` (already built) so every change is diffable (Burg's guardrail, made visible).

### Phase 5 — Cut over
- Make `/mycountry/v2` the default for the signed-in owner; keep legacy routes until parity is felt. Update nav entry points (diplomacy no longer a top-level section, etc.).

---

## 5. Reuse / keep

`CountryDataProvider`, `useMyCountryUnifiedData`, `AuthenticationGuard`, `AtomicStateProvider`; `IntentComposer`, `intent` router, `mycountry.getCanonFeed` / `getChangeLog`; `VitalityRings`, `LoreScoreBadge`, `CrossPillarBanner`, `ChangedSinceChip`, `StateSeal`, `cards/*`, `cards/glass`; `CountryChangeLogTimeline`, `SetupChecklist`, `VaultWidget`.

## 6. Component migration notes (from migration plan §3)

- **DISCARD (shell/nav):** `MyCountrySidebarNav`, `MyCountrySidebarLayout`, `MyCountryTabSystem`, `tabs/MyCountryTabsList`, `Enhanced*Content` (7), `sidebar-widgets/*`, `executive/*WarRoom`, `diplomacy/*WarRoom`, `politics/*WarRoom` — in v2 mode only.
- **DRILL:** `PolicyCreatorSheet`, `PolicyDetailSheet`, `MeetingDetailModal`, diplomacy lists/panels, politics `PartyManager`/`LegislatureConfig`/`CabinetPanel`.
- **PROFILE:** `tabs/{EconomyTab,GovernmentTab,LaborTab,EconomyLaborTab,OverviewTab}`, `GeographyTab`.
- **KEEP:** primitives, data providers, intent engine, feed/ledger, cards.

## 7. Guardrails / risks

- Keep the `db:intent` writer path untouched (already enforces locked levers + cooldown/cap).
- No new DB model/migration; ride existing models.
- Verify light+dark theme tokens per primitive; Arch-guard 700-line ceiling; lint after each phase.
- v1 and v2 share `MyCountryRouter` — keep v1 behavior intact while `v2` is gated; only cut over when parity is felt.

## 8. Verification

- Fresh-owner smoke test: walk HOME (compact hero, declare intent, respond to NeedsYou, open each drill-down) as free and premium; confirm read-only preview on premium-gated drills.
- Theme check (light + dark) on every new surface.
- `bun run lint` per phase; visual review at Phase 1 pilot before rollout.