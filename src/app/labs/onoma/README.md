# Onoma Lab — UI

The `/labs/onoma` page. This is the presentation layer; the engines, the corpus
pipeline, and how to rebuild the dictionaries live in
[`src/lib/onoma/README.md`](../../../lib/onoma/README.md). Read that for anything below
the UI.

## Structure

A single-page app (no Next route transitions between sections), following the project's
Single-Page Router pattern.

- **`page.tsx`** → renders `OnomaRouter`. `layout.tsx` wraps the labs chrome.
- **`components/OnomaRouter.tsx`** — top-level `FacetTabs`; orchestrates the active-section and active-sub-tab state, handles history synchronisation with `history.pushState` under `/labs/onoma/studio/*` sub-routes, and morphs the tab headers dynamically when entering the Custom Studio.
- **`components/sections/`** — one component per tab:

  | Tab | Section | Category fed to the generator |
  |-----|---------|-------------------------------|
  | Overview | `OverviewSection` | landing / quick generate + Apple-style glassmorphic animated DNA helix |
  | Places | `PlacesSection` | `country`, `city`, `province`, `geography` |
  | People | `PeopleSection` | `person` (+ species/gender subtypes) |
  | Military | `MilitarySection` | `military` |
  | Organizations | `OrganizationsSection` | `organization` (taverns, orders, units) |
  | Culture | `CultureSection` | `dynasty`, `culture` |
  | Studio | `StudioSection` | Custom Studio (delegates to Workshop or Lexicon views) |
  | Name Bank | `StashSection` (`"bank"`) | saved names + seed dictionaries |

- **`components/sections/studio/`** — modular Custom Studio sub-panels:
  - **`StudioWorkshop.tsx`** — the Markov training input workspace, parameter controls, circular React Flow probability path visualizer, and Lexicon Explorer health panel.
  - **`StudioLexicon.tsx`** — split-screen interactive conlang lexicon viewer and case-declension definition manager.
- **`hooks/`** — local state managers:
  - **`useStudioState.ts`** — unified hook housing all Custom Studio state, analytics calculations (entropy, letter frequencies), dictionary loader triggers, and deletion cascades.
- **`components/shared/`**
  - **`GeneratorPanel.tsx`** — the reusable generator UI every section mounts. Left column: constraints (subtype, gender, **Markov source**, **culture family**, advanced length/affix/order). Right column: results grid with copy / save-name / save-dictionary.
  - **`NameResultCard.tsx`** — name results featuring inline detail morphs. Toggling details expands the card to `col-span-2` in the grid and renders case-declension case tables, script badges, and dictionary definition edit forms in-situ.
  - `UseNameDialog.tsx` — "use this name" → routes into a builder/wiki flow.
  - `OnomaHelpModal.tsx` — in-app explainer.

## Generating

Sections render `<GeneratorPanel category=… />`. The panel drives the
[`useOnomaGenerator`](../../../hooks/useOnomaGenerator.ts) hook, which:

1. picks a **Markov source** — `corpus` (default, wiki-trained dicts), `preset` (hand-authored
   cultures), or `ixworld` (live DB);
2. in corpus mode, lazy-loads `data/corpus/<category>.json` and exposes the **Culture Bucket**
   facet (Any / 7 single cultures / top-6 `A+B` compounds);
3. trains a client-side Markov chain and `generate(n)` produces a batch.

Some People/Organization subtypes (dwarf, elf, tavern, …) use rule-based assemblers instead
of the Markov chain — see the lib README.

## Conventions

- Facet design system (`FacetCard`, `FacetTabs`, glass depth). Use theme tokens
  (`text-foreground`, `border-border/40`, `bg-secondary/5`) — no hardcoded slate/white/black,
  Light + Dark must both pass.
- Sections are thin: they set the category and render `GeneratorPanel`. Keep generation logic
  in the hook/lib, not in section components.
