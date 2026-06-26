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
  - **`GeneratorPanel.tsx`** — the reusable generator UI every section mounts. Left column: constraints (subtype, gender, **Culture / Linguistic Family**, and advanced options: Include Live World Data toggle, prefix/suffix, length/affix/order). Right column: results grid with copy / save-name / save-dictionary.
  - **`NameResultCard.tsx`** — name results featuring inline detail morphs. Toggling details expands the card to `col-span-2` in the grid and renders case-declension case tables, script badges, and dictionary definition edit forms in-situ.
  - `UseNameDialog.tsx` — "use this name" → routes into a builder/wiki flow.
  - `OnomaHelpModal.tsx` — in-app explainer.

## Generating

Sections render `<GeneratorPanel category=… />`. The panel drives the
[`useOnomaGenerator`](../../../hooks/useOnomaGenerator.ts) hook, which:

1. picks one **Culture / Linguistic Family** (default `any`). For that family it blends the
   hand-authored `cultural-profiles.ts` list with the matching bucket of the prebuilt wiki
   **lexicon** (lazy-loaded `data/lexicon/<category>.json`). Optionally folds in **live world
   data** (advanced toggle → `api.onoma.getTrainingData`).
2. trains parallel character + syllable Markov chains and `generate(n)` produces a batch,
   applying any prefix/suffix.

Some People/Organization subtypes (dwarf, elf, tavern, noble-surname, …) use rule-based
assemblers instead of the Markov chain — see the lib README. Each result can morph open to
show IPA, declension tables, and script transcriptions (the linguistics engine).

## Conventions

- Facet design system (`FacetCard`, `FacetTabs`, glass depth). Use theme tokens
  (`text-foreground`, `border-border/40`, `bg-secondary/5`) — no hardcoded slate/white/black,
  Light + Dark must both pass.
- Sections are thin: they set the category and render `GeneratorPanel`. Keep generation logic
  in the hook/lib, not in section components.

## Speech Synthesis & Natural Voices

Onoma supports two audio modes:
- **🔊 Pronunciation (IPA Badge)**: articular guide reading the generated IPA string. Driven by the browser's native `SpeechSynthesis` Web Speech API using BCP-47 culture mapped accents (falls back to client-side `meSpeak` (eSpeak asm.js) if browser synthesis fails).
- **🎙 Read Naturally (Natural Voice)**: immersive natural voice generation. Queries the self-hosted **Kokoro TTS container** proxy `/api/onoma/tts`. Falls back to the browser-native synthesis player if the Kokoro server is unreachable or disabled, and finally falls back to meSpeak.

