# Country builder and editor redesign (design)

**Date:** 2026-10-15 · **Branch:** `docs/builder-editor-redesign-spec` (from `rose-garden` 5d6c53a)
**Status:** Design. Stopgap for the worst data loss is [PR #78](https://github.com/algolds/ixstats/pull/78)
(editor saves no longer wipe the cabinet, budget history or component effectiveness).
**Replaces:** the flow described in `src/app/builder/README.md` and `docs/systems/builder.md`. The companion guide spec
(`2026-09-08-builder-unified-companion-guide-design.md`) is superseded where they disagree.
**Goal:** founding a nation takes a casual player about five minutes of plain-language choices and works one-handed on
a phone. Editing a nation is a calm settings page that can never destroy data the player did not touch. All depth stays
available, opt-in, and the numbers the player sees are the numbers the simulation uses.

## Decisions

Settled with the product owner on 2026-10-15. This table is the source of truth; later sections only elaborate.

| # | Question | Decision |
|---|---|---|
| D1 | Editor save model | One save per section ("Save identity"), disabled until something changes. Each section saves only its own data. No whole-country autosave. |
| D2 | Audience | Casual first. Depth sits behind a per-section "Customise", never a global mode switch. |
| D3 | Tax in the builder | Removed entirely, including every promise of it in copy. |
| D4 | Editor scope | Identity and structure only. Live numbers (budget, tax, cabinet, economy levers) are edited only in their MyCountry consoles; the editor links to them. |
| D5 | Starting paths | Archetype-led. "Import from wiki" and "Start blank" are secondary. The real-world benchmark country becomes a detail of an archetype, not a path. |
| D6 | Builder depth | Departments, budget, sectors and labor leave the builder. They are generated and tuned later in MyCountry. |
| D7 | Choosing a government | Pick a recognisable form first; it applies a working component set. "Customise institutions" opens the component picker. Conflicts are warnings. |
| D8 | Starting tax system | Derived from the archetype behind the scenes and balanced against the starting budget. |
| D9 | Live preview | A nation card fed by a server dry run of the real engine. |
| D10 | Undefined economic components | Write real definitions for all of them. |
| D11 | Sequencing | Stopgap PR (#78), then this spec, then the phased rebuild. |
| D12 | Phones | Full parity at 375px. |
| D13 | Synergy data | One shared table, server-owned, read by the UI, the preview and the save. |
| D14 | Renaming | An explicit "Save name" action with a uniqueness check. The slug updates and the old slug redirects. |
| D15 | After founding | A welcome screen, then MyCountry with a first-steps checklist. |
| D16 | Identity at founding | Essentials only; culture and civic standards sit in a collapsed "More details". |
| D17 | Size and wealth | Plain bands prefilled by the archetype, each with "Enter exact figure". |
| D18 | Realm choice | First, and only when the player can join more than one realm. |
| D19 | Wiki import | Import fills identity, size, wealth and government form, shows what it found, then suggests an archetype. |

## What is wrong today

From the 2026-10-15 audit (four parallel reviews of create flow, editor, government and economics depth, and the rest
of the app). Items marked ✅ were confirmed by reading the code; the rest were traced through code paths, not run.

**Broken or losing data**
- ✅ Every editor autosave rewrote the whole government and deleted every department, cascading away cabinet
  appointments, sub-budgets and budget allocations (fixed by #78).
- ✅ Builder budget allocations and parent links were keyed by list position and never matched on the server, so they
  were never saved (fixed by #78).
- ✅ Cmd/Ctrl+S founds the nation from any step with no confirmation (`BuilderRouter.tsx:267`,
  `useBuilderSubmit.ts:220`).
- ✅ The first Continue on Identity switches to an `"indicators"` tab that does not exist (`useBuilderActions.ts:111`).
- ✅ Government quick templates keep only the last component: each pick overwrites the one before
  (`AtomicGovernmentComponents.tsx:115`, `useAtomicSelectorState.ts:136`).
- ✅ The economic archetype modal can never open (`EconomyBuilderPage.tsx:84`).
- Lowering population after the budget is set can block Create in Standard mode, with the fix on a hidden tab.
- Refresh drops the foundation country and archetype from the submission; deep links on a fresh session spin forever or
  render the wrong step.
- Switching nation with the editor open can write one country's state into another.

**Promised but not built**
- No tax editing anywhere, though the welcome modal, guide, README and editor section description promise it.
- 33 of 60 economic component types have no definition; archetypes and templates reference them, and they count
  toward the 15-component cap while being invisible.
- No live consequences. The guide's "watch the indicators" refers to UI that does not exist.
- New nations start at a deficit of about 15% of GDP (budget defaults to 35% of GDP, tax revenue to 20%).
- Client and server synergy tables disagree; what the player sees is not what is saved.
- National animal is collected and never saved; population and GDP cannot be edited in the editor.

**Structure**
- Seven overlapping navigation systems (header stepper, footer, tabs, nested segmented controls, Foundation sub-steps,
  Halo, keyboard shortcuts). "Completed" means "visited". Continue validates nothing.
- The editor runs three or four save paths at once and can show "3 changes" next to "All changes saved".
- Country data is editable in six places with no single owner.
- About 110 economic sliders with no visible consequence, labelled in jargon ("Rd Investment", "Sovereign Surplus
  Target", "GDP Threshold Violated").

## Principles

1. **One way to move.** A stepper and one sticky footer in founding; an anchor nav in the editor. Nothing else
   navigates.
2. **Plain words first, numbers on request.** Every choice reads as a sentence a non-economist understands. Exact
   figures are always one tap away and never required.
3. **What you see is what you get.** Every number shown comes from the same code that runs the simulation.
4. **A save touches only what it names.** No write ever rewrites data the player did not edit.
5. **Nothing is promised that does not exist.** Copy is written from the shipped feature, not the roadmap.
6. **Facet 4, no exceptions.** `PageHeader`, `StepIndicator`, `Card content="input"`, `CardTitle icon`,
   `RadioCardGroup`, `Signal`, `Stat`, `Inspector`, `EntityHeader`, `FacetList`. No bespoke glass primitives.

## §1 Founding flow

Route `/builder` (create). Layout: `PageHeader` with `StepIndicator` (labelled at every width, `compactOnPhones`) in
Chrome, one `Card content="input"` per step, an `Inspector` for the nation card (§2), and a sticky footer with Back and
one primary action. Steps:

### Step 0: Realm

Shown only when the player may found in more than one realm (`realmSettings` caps). Otherwise skipped silently. A
`RadioCardGroup` of realms with name, banner, clock and "You can found 1 more nation here". The chosen realm shows in
the header for the rest of the flow. Changing it later returns here and keeps everything else.

### Step 1: Start

Title "What kind of nation are you building?". A grid of archetype cards (`RadioCardGroup`, two columns on phones):

- **Plain name and one-line pitch.** Archetypes get display names in plain language; the current name becomes the
  inspiration line. Example: "Wealthy welfare state · inspired by the Nordic model". The 20 archetypes stay; the 10
  historical ones sit under a "Historical" segmented filter.
- **Three facts per card:** typical size, typical wealth, government form it starts with.
- **Detail sheet** (one "Details" link per card, not two): what it fills, the real-world benchmark country it is
  calibrated on (this replaces the benchmark-country path, D5), strengths and trade-offs in plain words.
- Selecting a card selects it; the footer's "Continue" applies it. There is no second confirm pattern.

Below the grid, two quiet links: **Import from the wiki** (§6) and **Start blank** (uses the "Balanced mixed economy"
default archetype under the hood, so every downstream default exists).

Picking a different archetype later shows an `AlertDialog`: "Switching to X replaces your size, wealth and government.
Your name, flag and other identity stay." Identity is never wiped by a path change (today it is,
`step-transitions.ts:252`).

### Step 2: Identity

Essentials, in this order: name (required), flag (upload, repository or URL, as `RealmImageField`), capital city,
official language, currency, motto (optional). Required fields say "Required" in text, not a coloured dot.

"More details" (`Collapsible`, closed) holds culture and civic standards: official name, demonym, national animal and
flower, religion, anthem, calling code, internet TLD, ISO code, driving side, week start. Each has a one-line helper.
The national animal is saved (schema and save list gain it).

Validation is inline (`aria-invalid` plus helper text) and runs on Continue; Continue scrolls to and focuses the first
problem.

### Step 3: Government

Title "How is your nation governed?". A `RadioCardGroup` of government forms (§4). The archetype's form is preselected.
Picking a form sets the government type, the institution names (head of state and government titles, legislature,
judiciary) and a working component set.

Below: **Customise institutions** (`Collapsible`). Inside, the editable institution names, then the component picker
grouped by plain categories ("How leaders are chosen", "Where power sits", "What the state provides", …). Each
component shows a one-line effect in plain words. Conflicts and synergies show as a `Signal` per pair ("Military rule
works against independent courts: both weaken"). Conflicts are warnings; nothing here blocks Continue. The cap of 15
stays, counting only defined components.

### Step 4: Economy

Title "How big and how wealthy?". Two `SegmentedControl`s prefilled from the archetype:

- **Population:** Small (under 5 million), Medium (5 to 50 million), Large (50 to 200 million), Very large (over 200
  million). Each band maps to a representative figure.
- **Wealth:** Developing, Emerging, Wealthy, Very wealthy, each mapped to a GDP per capita figure and labelled with an
  everyday hint ("Most people own a car").

Each has "Enter exact figure", which reveals a number field with range and the archetype's value next to it
("Archetype: 8.4 million · Reset"), following `StudioFieldFrame`. There is no other economic input in the builder.
Sectors, labor and demographics are generated from the archetype (§3).

### Step 5: Review

- `EntityHeader` with flag, name, realm and a facts line.
- One `FacetList` group per step, each row a plain summary with an Edit link that jumps back to that step and returns
  here on Continue.
- The nation card's figures, larger, with one sentence each on what they mean.
- "What happens next": the nation becomes your active nation in the realm; MyCountry opens with a checklist; you can
  change identity and government any time; budget, taxes and cabinet are set in MyCountry.
- One primary button, **Found nation**, which opens a short confirm dialog naming the nation and realm. Founding never
  happens without it, and no keyboard shortcut founds.
- Server errors (realm cap, name taken, lore page conflict) show as a `Signal` with a plain message and the action that
  fixes it.

### Drafts

The whole founding state, including realm, archetype and step, is one server draft (`builderDraft`) saved two seconds
after the last change, with a visible status in the footer ("Draft saved" / "Saving…" / "Could not save your draft ·
Retry"). Refresh and deep links restore the exact step. A step whose prerequisites are missing redirects to the first
incomplete step instead of rendering a spinner or the wrong step. The local copy is a crash fallback only and never
overrides a newer server draft.

## §2 Live nation card

An `Inspector` column (320px, a bottom sheet below `xl`, opened from a "Nation" button in the footer) showing:

- GDP and GDP per capita
- Budget balance, as a share of GDP, with a plain label ("Balanced", "Small deficit", "Large deficit")
- Stability and government effectiveness
- Expected growth

**Source.** A new query `countries.previewFounding` takes the founding draft and returns these figures by running the
same preparation `createCountry` runs (`prepareFounding`, `withArchetypeDefaults`, `buildCountryNumbers` and the synergy
and effectiveness calculation in `country-mutation-helpers.ts`) without writing anything. Those helpers are refactored
into a pure `computeFoundingSnapshot(input)` used by both, so the preview cannot drift from the real result.

**Behaviour.** Debounced 400ms after a change; the previous figures stay visible, dimmed, while a new result loads.
Each figure follows Vault's `Figure` rule: loading shows a skeleton, unavailable shows "–" with an accessible label,
never 0 or NaN. A change in a figure animates with `springSnappy` and announces through a polite live region. Each
figure has an info popover explaining what moves it.

## §3 Generated defaults

At founding, everything the builder no longer asks for is generated from the archetype and the size and wealth bands:

| Data | Generated from |
|---|---|
| Departments | A default set per government form (5 to 9 departments), named for the form ("Ministry of Defence" or "Imperial Legion Command"). Real ids from creation, no index keys anywhere. |
| Budget | Total spending set so the starting budget balances against the starting tax revenue, within ±1% of GDP. Allocations per department from the archetype's spending priorities. |
| Tax system | The archetype's tax profile (`archetypeTaxSystem`), scaled to the same revenue target. Blank and import use the default archetype's profile. |
| Sectors | The archetype's `sectorFocus`, normalised to 100% (today it is ignored and sectors start empty). |
| Labor and demographics | Defaults derived from wealth band and archetype, each sum validated to 100%. |
| Economic components | The archetype's list, all defined (§5). |

No generated value may leave a validation error the player cannot see or fix in the builder. A test founds one nation
per archetype and size and wealth band combination and asserts zero validation errors and a balanced budget.

## §4 Government forms

A new catalogue `src/lib/government/forms.ts`. Each form has a plain name, a one-line description, default
`governmentType`, institution names, a default department set and a component set. Draft list (component names are
existing `ComponentType` values; the set per form is reviewed against the merged synergy table so no form starts with a
conflict):

| Form | Starts with |
|---|---|
| Parliamentary republic | Democratic process, electoral legitimacy, independent judiciary, rule of law, professional bureaucracy, unitary system |
| Presidential republic | Same as parliamentary, institution titles differ (president leads both) |
| Federal republic | Democratic process, electoral legitimacy, federal system, administrative decentralisation, independent judiciary, rule of law |
| Constitutional monarchy | Traditional legitimacy, democratic process, independent judiciary, rule of law, professional bureaucracy |
| Absolute monarchy | Traditional legitimacy, autocratic process, centralised power, professional bureaucracy, cultural preservation |
| One-party state | Partisan institutions, autocratic process, centralised power, strategic planning, surveillance system |
| Military government | Military administration, military enforcement, centralised power, autocratic process |
| Theocracy | Religious legitimacy, traditional legitimacy, cultural preservation, centralised power, social pressure |
| Technocracy | Technocratic process, technocratic agencies, merit-based system, performance legitimacy |
| Merchant oligarchy | Oligarchic process, economic incentives, rule of law, trade agreements |
| Confederation | Confederate system, consensus process, administrative decentralisation |

The 55 existing policy templates (`templates.json`) become "Policy presets" inside Customise institutions, applied with
one `setSelection` call (the current loop bug goes away with the code). `PLANNED_ECONOMY` and
`INSTITUTIONAL_LEGITIMACY`, which templates reference but which are not defined, are either defined or removed from the
templates in phase 1.

## §5 Content and data

- **Economic components.** Define the 33 missing `EconomicComponentType` values with effects, synergies, conflicts and
  plain copy, in the existing `components-part*` format. Display names are written, not derived from the enum (no more
  "Rd Investment").
- **Copy pass.** Every government and economic component, archetype, form and figure gets a plain one-line effect,
  reviewed for sentence case and no jargon. Terms that must stay ("GDP") get an info popover.
- **One synergy table (D13).** Merge the client per-component arrays (`lib/government/atomic-utils.ts`) and the server
  `SYNERGY_MAP` (`lib/government/synergy.ts`) into one module `src/lib/government/synergy-table.ts`, review the merged
  pairs, and make the picker, `previewFounding` and `syncGovernmentComponents` all read it. A test asserts every
  referenced component exists and every pair is symmetric.
- **Remove the cross-domain ribbon's invented effects** (`InstitutionalFoundationRibbon.tsx`) or back them with the
  shared table.

## §6 Wiki import

"Import from the wiki" opens a search sheet (the existing `DynamicIslandSearch` restyled). On pick, the infobox is
parsed and a review card shows what was found, field by field, with a checkbox each: name, flag, capital, population,
GDP per capita, government form (mapped to the closest §4 form, with the raw infobox value shown), language, currency,
motto. Unchecked fields fall back to defaults. Then Start shows the archetype grid with a "Suggested" badge on the
closest match by wealth and government form. Import state lives in the server draft; nothing re-applies on refresh.

## §7 After founding

1. A full-page welcome: the nation's `EntityHeader`, "X is founded" and one primary "Open MyCountry".
2. MyCountry shows a "First steps" card (dismissible, stored per nation) with: Review your budget, Set your tax policy,
   Appoint your cabinet, Write your wiki page, Place your capital on the map. Each links to the console that owns it
   and ticks itself when that data first changes.

## §8 Editor

Route `/mycountry/editor`, keyed by `countryId` so switching nation remounts it and can never cross-write. Layout copies
Realm Manage (`src/app/r/[realm]/(region)/manage`): `PageHeader` with the nation's name and flag, a sticky grouped
anchor nav (`lg:grid-cols-[200px_minmax(0,1fr)]`, a horizontal scroller below `lg`), deep links by `#hash`.

| Group | Sections (each a `ManageSection` with its own save) |
|---|---|
| Identity | Name (D14), Flag and symbols, Capital and language, Culture, Civic standards |
| Government | Form and institutions, Components |
| Size | Population and wealth (exact figures, with a plain warning that changing them rescales the economy) |
| Managed elsewhere | Rows linking to Budget, Tax policy, Cabinet, Economy, Geography and Map in MyCountry |

**Each section** keeps a local copy of its values, shows an inline consequence line under its fields where there is
one ("Saving moves your stability from 62 to 58"), and has one button named for what it saves ("Save government"),
disabled until something changed or while invalid or pending. Results go through `useNotify` ("Government saved" /
"Could not save the government" with the server's message). After a save the section re-keys from server state.

**Server.** One mutation per section (`countries.saveIdentity`, `saveGovernmentForm`, `saveGovernmentComponents`,
`saveSize`, `rename`), each patching only its own rows and checking `updatedAt` so a stale tab gets "This nation
changed since you opened it · Reload" instead of overwriting. `updateCountry`'s whole-country rewrite is no longer
called by the editor.

**Renaming (D14).** The Name section validates uniqueness live, saves only on its button, and writes the old slug to a
new `CountrySlugRedirect` table; `/countries/[slug]` checks it and redirects permanently. Settings' rename calls the
same mutation, so name, slug and `nationalIdentity.countryName` never diverge.

**Leave guard.** One unsaved-changes dialog covering links, `router.push` and browser Back, listing the sections with
unsaved changes.

**Entry points.** Every link into the editor deep-links to the right section (`#government`, `#identity`). Links
labelled as map or territory editors go to the map editor, not here.

## §9 Removed

- The global Standard/Advanced mode, Departments, Budget, Sectors and Workforce tabs, and their ~110 sliders, from both
  builder and editor (D6).
- Every tax promise in copy: welcome modal, guide rules, contextual help, README, `docs/systems/builder.md` (D3).
- Header Continue/Back/Restart, Halo's step list and save actions for the builder, and builder keyboard shortcuts except
  a discoverable `?` sheet. Halo keeps a "Jump to section" command.
- The welcome modal (the Start step does its job), the auto-opening guide sheet, completion toasts and sounds.
- `EditorSaveBar`'s autosave and undo stack, `EditorDraftBanner`, the edit-mode confirm modal, `EditorChangeSummary` as a
  page (each section shows its own changes instead).
- Bespoke primitives: `SliderWithDirectInput`, `EnhancedNumberInput`, `GlassSelectBox`, `MetricCard`, glass charts,
  `primitives/enhanced/theme-utils.ts`.
- Dead code found in the audit: the unreachable presets dialog, `autoSyncRegistry`/`syncAllNow`, the unused
  `BuilderSidebarLayout` props, legacy step and tab maps, `console.log` in `useBuilderSubmit.ts`.

## §10 Accessibility and phones

- Every step and section works at 375px with one hand: footer actions in thumb reach, 44pt targets, no nested scroll
  areas, no fixed bars that overflow.
- All choice cards are real radio inputs (`RadioCardGroup`), reachable and operable by keyboard.
- One h1 per page; steps and sections start at h2 (keeps `facet-hig-leftovers` green).
- Errors are announced; focus moves to the first invalid field on Continue or Save.
- `facet-ratchet` counts for the builder fall to zero for eyebrows, `data-cuelume-*`, ad hoc springs, raw buttons and
  inputs.

## §11 Phases

Each phase ships on its own and leaves the product working.

| Phase | Scope | Done when |
|---|---|---|
| 0 | Stopgap: #78 | Merged |
| 1 | Data: 33 economic components defined, template ghosts fixed, synergy table merged, government forms catalogue, archetype seeding fills sectors and balances the budget, `computeFoundingSnapshot` extracted | Per-archetype founding test passes with zero validation errors and a balanced budget; synergy table test passes |
| 2 | Editor: Manage-style page, section mutations with `updatedAt` checks, rename with redirects, leave guard, deep links | Editing one section changes only its rows (test per mutation); two-tab conflict shows the reload message; old slug redirects |
| 3 | Founding flow: steps 0 to 5, server draft, `previewFounding` and the nation card, import review card | A new player founds a nation at 375px without errors; preview figures equal the founded nation's figures (test) |
| 4 | After founding: welcome screen, first-steps card | Checklist items tick from real data changes |
| 5 | Cleanup: §9 removals, docs and help content rewritten | No builder file imports a removed primitive; docs describe only shipped behaviour |

## Open questions

1. The government forms list (§4) is a draft. Which forms does IxWorld need that are missing, and should forms differ
   per realm?
2. Archetype display names: who writes them, and should historical archetypes be hidden in realms set in the present?
3. Should "Size" be editable in the editor at all after founding, or only by request to a realm officer, given it
   rescales the economy?
4. Does the founding draft persist per realm, so a player can have one draft in each realm?
