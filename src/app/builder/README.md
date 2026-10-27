# Founding and editing a nation

**Last updated:** 2026-10-15 · **Spec:** [`docs/specs/2026-10-15-country-builder-editor-redesign-design.md`](../../../docs/specs/2026-10-15-country-builder-editor-redesign-design.md)

`/builder` founds a nation in a few plain choices. Changing a nation afterwards happens in the country editor at
`/mycountry/editor`, one section at a time. Budget, departments, taxes, sectors and jobs are never asked for: founding
generates them, and the player tunes them later in their MyCountry consoles.

## Founding (`/builder`)

`page.tsx` renders `_founding/FoundingFlow.tsx` behind sign-in. `/builder?import=1` opens the wiki import sheet.

| Step | Component | What it asks |
| --- | --- | --- |
| `realm` | `RealmStep` | Which realm, only when more than one realm has room for the player |
| `start` | `StartStep` | Which kind of nation (one of 20 archetypes, Modern or Historical), or Start blank; Import from the wiki |
| `identity` | `IdentityStep` | Name (required), flag, capital, language, currency, motto; More details for the rest |
| `government` | `GovernmentStep` | A government form; Customise institutions for names and titles, policy presets and the component picker |
| `economy` | `EconomyStep` | Population and wealth bands, each with Enter exact figure |
| `review` | `ReviewStep` | A summary per step with Edit, the nation's figures, what happens next; Found nation (with a confirm) |

- **Navigation.** One `StepIndicator` and one `FoundingFooter` (Back, one primary action, the Nation button and the
  draft status). `?step=` names the step; `resolveStep` sends a deep link whose prerequisites are missing to the first
  incomplete step. Halo offers **Jump to section** (`src/components/halo/plugins/builder`). No keyboard shortcut
  founds.
- **Draft.** The whole draft (realm, archetype, step, choices) is one server draft (`api.builderDraft.get/save/clear`,
  `hooks/useFoundingDraft.ts`), saved two seconds after the last change. Local storage is only a crash fallback and
  never overrides a newer server draft. The rules live in `lib/founding-draft.ts`.
- **Nation card.** `hooks/useFoundingPreview.ts` calls `api.countries.previewFounding` (debounced) and `NationCard`
  shows GDP, GDP per person, budget balance, stability, government effectiveness and expected growth.
- **Wiki import.** `ImportSheet` searches IIWiki or AltHistory (`api.countries.searchWiki`, `parseInfobox`), shows what
  it found field by field with a checkbox each (`lib/founding-import.ts`), then the Start step marks the closest
  archetype as Suggested.
- **Founding.** `lib/founding-payload.ts` builds the `api.countries.createCountry` input. It never sends the tax system,
  government structure or economy builder state; the server generates them.

## One calculation for the preview and the nation

`src/server/shared/founding-snapshot.ts` (`computeFoundingSnapshot`) is the pure preparation both `previewFounding` and
`createCountry` run, so the nation card shows exactly what founding writes. From the archetype, the form and the bands
it generates:

- departments per government form (`src/lib/government/form-departments.ts`);
- a budget balanced against the starting tax revenue, split by the archetype's priorities;
- the archetype's tax profile, scaled to the same revenue target;
- sectors, labour and demographics from the archetype and the wealth band;
- the government components of the form (or the player's own set), scored by
  `src/lib/government/effectiveness.ts` over the shared synergy table (`src/lib/government/synergy-table.ts`), the same
  formula `syncGovernmentComponents` stores.

Catalogues: government forms in `src/lib/government/forms.ts`, policy presets (the 55 templates) in
`src/lib/government/policy-presets.ts`, plain component copy in `src/lib/government/component-guide.ts`, archetype
display copy in `src/lib/economy/archetypes/display.ts`, size and wealth bands in `src/lib/builder/founding-bands.ts`.

## After founding

`router.push("/mycountry/welcome")`: a full-page welcome (`src/app/mycountry/welcome`, `api.mycountry.getWelcome`)
with one **Open MyCountry**. MyCountry then shows the **First steps** card
(`src/components/mycountry/shell/FirstStepsCard.tsx`, `api.mycountry.getFirstSteps` / `dismissFirstSteps`, rules in
`src/lib/mycountry/first-steps.ts`): review your budget, set your tax policy, appoint your cabinet, write your wiki page,
place your capital on the map. Each ticks itself when its data first changes after founding.

## The editor (`/mycountry/editor`)

`src/app/mycountry/editor/_components/CountryEditor.tsx`, keyed by country id so switching nation remounts it. One list
(`editorGroups`) drives the anchor nav and the sections; every section has a `#hash`. Each section keeps its own copy of
its values and saves with its own mutation, checking the values it loaded so a stale tab gets a reload prompt instead of
overwriting:

| Section | Mutation |
| --- | --- |
| Name | `countries.rename` (with `checkNameAvailable`; the old slug redirects) |
| Flag and symbols, Capital and language, Culture, Civic standards | `countries.saveIdentity` |
| Form and institutions | `countries.saveGovernmentForm` |
| Institutions (with policy presets) | `countries.saveGovernmentComponents` |
| Population and wealth | `countries.saveSize` |

The page loads with `countries.getEditorState`. `LeaveGuard` asks before a link or Back leaves unsaved sections.
**Managed elsewhere** links to Budget, Tax policy, Cabinet, Economy, Geography and Map. Server code:
`src/server/api/routers/countries/editor.ts`.

## Maintenance checklist

- Change founding steps in `lib/founding-draft.ts` (`FOUNDING_STEP_LABELS`, `visibleSteps`, `isStepComplete`) and keep
  `docs/systems/builder.md`, `src/content/help/getting-started/first-country.md` and
  `src/content/help/gameplay/country-building.md` in step.
- Anything founding writes goes through `computeFoundingSnapshot`; never compute a figure for the nation card that the
  write path does not use.
- One h1 per page (the `PageHeader`); steps and sections start at h2 (pinned by
  `src/tests/architecture/facet-hig-leftovers.test.ts`).
- Copy is written from what ships: no tax setup, no promises of features that are not built.
