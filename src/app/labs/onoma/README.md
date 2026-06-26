# Onoma Lab — UI

The `/labs/onoma` page. This is the presentation layer; the engines, the corpus
pipeline, and how to rebuild the dictionaries live in
[`src/lib/onoma/README.md`](../../../lib/onoma/README.md). Read that for anything below
the UI.

## Structure

A single-page app (no Next route transitions between sections), following the project's
Single-Page Router pattern.

- **`page.tsx`** → renders `OnomaRouter`. `layout.tsx` wraps the labs chrome.
- **`components/OnomaRouter.tsx`** — top-level `FacetTabs`; holds the active-section state,
  syncs the URL with `history.pushState`, and dispatches to a section component.
- **`components/sections/`** — one component per tab:

  | Tab | Section | Category fed to the generator |
  |-----|---------|-------------------------------|
  | Overview | `OverviewSection` | landing / quick generate |
  | Places | `PlacesSection` | `country`, `city`, `province`, `geography` |
  | People | `PeopleSection` | `person` (+ species/gender subtypes) |
  | Military | `MilitarySection` | `military` |
  | Organizations | `OrganizationsSection` | `organization` (taverns, orders, units) |
  | Culture | `CultureSection` | `dynasty`, `culture` |
  | Studio | `StudioSection` | Studio — paste/upload your own training list |
  | Name Bank | `StashSection` (`"bank"`) | saved names + seed dictionaries |

- **`components/shared/`**
  - **`GeneratorPanel.tsx`** — the reusable generator UI every section mounts. Left column:
    constraints (subtype, gender, **Markov source**, **culture bucket**, advanced
    length/affix/order). Right column: results grid with copy / save-name / save-dictionary.
  - `NameResultCard.tsx` — a single result with save/use actions.
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
