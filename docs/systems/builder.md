# 🏛️ Country Builder: founding and editing a nation

**Last updated:** 2026-10-15

**Parent App Suite:** MyCountry Suite (`MYCOUNTRY_VERSION = 6`)  
**Subsystem:** Country Builder (v5, the [redesign spec](../specs/2026-10-15-country-builder-editor-redesign-design.md))  
**Routes:** `/builder` (found) · `/mycountry/welcome` (after founding) · `/mycountry/editor` (edit) | **Status:** ✅ Live (see [SYSTEM_STATUS.md](SYSTEM_STATUS.md))

Founding a nation takes a few plain choices and works one-handed on a phone. Editing a nation is a settings page where
each section saves only its own data. Budget, departments, taxes, sectors and jobs are not asked for at founding; they
are generated from the player's choices, and tuned later in the MyCountry consoles. Code map:
[`src/app/builder/README.md`](../../src/app/builder/README.md).

---

## Founding flow (`/builder`)

```mermaid
graph LR
    R[Realm, if more than one] --> S[Start]
    S --> I[Identity]
    I --> G[Government]
    G --> E[Economy]
    E --> V[Review]
    V --> W[Welcome]
    W --> M[MyCountry with First steps]
```

| Step | What the player chooses |
| --- | --- |
| Realm | Shown only when more than one realm has room for another nation (`realms.builderRealms`) |
| Start | One of 20 archetypes (10 modern, 10 historical) by plain name, size, wealth and starting form, with a Details sheet; or Start blank; or Import from the wiki |
| Identity | Name (required), flag, capital, language, currency, motto; More details for official name, demonym, national animal and flower, religion, anthem, calling code, internet domain, country code, driving side, week start |
| Government | One of 11 government forms (`src/lib/government/forms.ts`); Customise institutions for names and titles, the 55 policy presets and the component picker (cap 15, defined components only) |
| Economy | Population band and wealth band (`src/lib/builder/founding-bands.ts`), each with Enter exact figure |
| Review | A summary per step with Edit, the nation's figures, what happens next, and Found nation behind a confirm |

- **One way to move:** a `StepIndicator` and one footer (Back, the primary action, the Nation button, the draft status).
  Halo offers only **Jump to section**. No keyboard shortcut founds.
- **Draft:** one server draft (`builderDraft.get` / `save` / `clear`), saved two seconds after the last change. Refresh,
  `?step=` deep links and another device resume at the same step; a step whose prerequisites are missing redirects to
  the first incomplete one.
- **Switching archetype** after applying one asks first; identity is never replaced.
- **Policy presets** replace the whole component set in one update (`getTemplateSelection`), with a confirm when they
  would replace the player's own choices.

### Wiki import

The Start step's **Import from the wiki** opens a sheet that searches IIWiki or AltHistory (`countries.searchWiki`),
parses the chosen infobox (`countries.parseInfobox`) and shows what it found field by field, each with a checkbox:
name, flag, capital, population, GDP per person, government form (mapped to the closest form), language, currency,
motto. Unticked fields keep the defaults. The Start step then marks the closest archetype as Suggested. Import state
lives in the server draft.

### Nation card and the one calculation

`countries.previewFounding` takes the draft and returns GDP, GDP per person, budget balance (with a plain label),
stability, government effectiveness and expected growth. It runs `computeFoundingSnapshot`
(`src/server/shared/founding-snapshot.ts`), the same pure preparation `countries.createCountry` runs before it writes,
so the founded nation has exactly the figures the card showed. Government effectiveness comes from
`src/lib/government/effectiveness.ts` over the shared synergy table (`src/lib/government/synergy-table.ts`), the same
formula `syncGovernmentComponents` stores and the editor previews.

### Generated defaults

| Data | Generated from |
| --- | --- |
| Departments | A default set per government form (`src/lib/government/form-departments.ts`) |
| Budget | Total spending set so the starting budget balances against the starting tax revenue; allocations by the archetype's priorities |
| Tax system | The archetype's tax profile, scaled to the same revenue target |
| Sectors, labour, demographics | The archetype's sector focus and the wealth band |
| Government components | The form's set, or the player's own |
| Economic components | The archetype's list |

### Realm and nation cap

- `createCountry` takes an optional `realmId`. Without one it uses the realm of the nation the player acts as, else
  Ixnay (`resolveBuilderRealm`, `src/server/modules/realms/realms.builder.ts`).
- The realm must exist and be `active` (Ixnay always is): an unknown realm is `NOT_FOUND`, a closed one `FORBIDDEN`.
- The player must be under their nation cap in that realm, otherwise `CONFLICT` with a message naming the limit. A name
  already used in the realm is a `CONFLICT` before anything is written. Slugs stay globally unique (`-2`, `-3`, …).
- The cap is `min(realm cap, tier cap)` (`nationCapacity`, `realms.nation-cap.ts`): the realm's
  `settings.maxNationsPerUser` (default 1, admins set 1 to 20) and `NATION_TIER_CAPS` (1 free, 5 Premium).
  `assignNation` re-checks it inside the create transaction.
- Refusals show on the Review step as a `Signal` naming the step that fixes them.

### After founding

The player lands on `/mycountry/welcome` (`mycountry.getWelcome`): the nation's header, "X is founded" and **Open
MyCountry**. MyCountry shows a dismissible **First steps** card (`mycountry.getFirstSteps` / `dismissFirstSteps`, rules
in `src/lib/mycountry/first-steps.ts`): review your budget, set your tax policy, appoint your cabinet, write your wiki
page, place your capital on the map. Each item links to its console and ticks itself when that data first changes after
founding.

---

## Country editor (`/mycountry/editor`)

`CountryEditor` (`src/app/mycountry/editor/_components/`), keyed by country id. A sticky grouped anchor nav (a scrolling
row below `lg`), deep links by `#hash`, and one `EditorSection` per section with its own button, disabled until
something changed:

| Group | Section | Mutation |
| --- | --- | --- |
| Identity | Name | `countries.rename` (live `checkNameAvailable`; the old slug goes to `CountrySlugRedirect`) |
| Identity | Flag and symbols, Capital and language, Culture, Civic standards | `countries.saveIdentity` |
| Government | Form and institutions | `countries.saveGovernmentForm` |
| Government | Institutions (with policy presets and the effectiveness line) | `countries.saveGovernmentComponents` |
| Size | Population and wealth (warns that saving rescales the economy) | `countries.saveSize` |
| Managed elsewhere | Links to Budget, Tax policy, Cabinet, Economy, Geography and Map | none |

- `countries.getEditorState` loads the page once. Each mutation patches only its own rows and sends the values it
  loaded; when another tab saved that section first, the page offers to reload just that section.
- `LeaveGuard` asks before a link or Back leaves sections with unsaved changes and names them.
- Results go through `useNotify` ("Government saved" / "Could not save the government" with the server's message).

---

## Stability guardrails

- **Wiki API compliance:** infobox imports use the central user agent (`DEFAULT_USER_AGENT`,
  `src/lib/wiki-os/config.ts`) and the cached wiki services; never ad-hoc fetches.
- **No whole-country rewrites:** there is no `updateCountry`; every editor save names what it touches.
- **One synergy table, one effectiveness formula** for the picker, the preview, founding and the save.

---

## Related documentation

- [Economic Calculations Guide](./calculations.md)
- [Government Components & Synergies](../reference/synergies.md)
- [Economy & Tax System Guide](./economy.md)
- [MyCountry Command Suite](./mycountry.md)
- [Help: Create Your First Nation](../../src/content/help/getting-started/first-country.md) (served at `/help/getting-started/first-country`)
