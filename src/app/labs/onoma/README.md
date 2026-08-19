# ⟨ONOMA⟩ — Linguistic Engine (UI Presentation & Studio)

The presentation, creative environment, and user experience layer for **⟨ONOMA⟩** at **`/labs/onoma`**.

> **Brand Identity & Brand Guide**: See [`docs/systems/onoma-brand-guide.md`](../../../../docs/systems/onoma-brand-guide.md).  
> **Engine & Computational Core**: See [`src/lib/onoma/README.md`](../../../lib/onoma/README.md).

```text
                    ⟨ ONOMA ⟩

                LINGUISTIC ENGINE

                 Language, engineered.

              ─────────────────────

             Build the language
                behind your world.

              ─────────────────────

             CREATE · STUDIO · EXPLORE

       Workshop · Phonology · Acoustics
          Sound Shifts · Lexicon
```

---

## The Core Position

> **Onoma is not a name generator.**  
> **It is the linguistic engine behind the name.**

Markov generation is one technology inside Onoma. Phonotactics is one system. Sound change is one process. Lexicons are one layer. Speech synthesis is one interface. Together, they form a **linguistic engine**.

---

## Architecture & Navigation Model

Onoma is built as a **Single-Page Application (SPA)** following IxStates' Single-Page Router pattern. Navigation across sections and Studio sub-tools uses `window.history.pushState` with zero Next.js page reloads.

- **`page.tsx`** → Mounts `<OnomaRouter />`.
- **`layout.tsx`** → Declares metadata and the vector SVG favicon (`withBasePath("/images/onoma-favicon.svg")`).
- **`components/OnomaRouter.tsx`** → Lean master coordinator (82 lines) delegating to:
  - **`hooks/useOnomaRouter.ts`** → Unified state machine, browser history/popstate listeners, Kokoro TTS player, and lexicon counter.
  - **`components/nav/OnomaHeader.tsx`** → Apple-style header bar with the formal `⟨ONOMA⟩` lockup logo (`OnomaBrandLogo.tsx`), `/ˈɒnəmə/` pronunciation attractor with Kokoro fallback, version badge, and spring-animated utility buttons (`Help`, `Stash`, `Studio`, `Settings`).
  - **`components/nav/onoma-tabs.tsx`** → Standardized navigation tab metadata, theme colors, and Game-Icon badges (`CategoryIcon`).
  - **`components/OnomaSectionRenderer.tsx`** → Dynamic lazy section dispatcher with Suspense loading fallbacks.

---

## Modular Component Structure

```
src/app/labs/onoma/
├── components/
│   ├── OnomaRouter.tsx              # Master coordinator (82 lines)
│   ├── OnomaSectionRenderer.tsx     # Dynamic lazy section dispatcher
│   ├── glyphs/                      # ⟨ONOMA⟩ Linguistic Glyph System (Apple SF Symbols × IPA)
│   │   ├── OnomaGlyph.tsx           # Vector glyph & composable expression renderer
│   │   ├── onoma-glyphs-catalog.tsx # 24 pure SVG mathematical vector paths
│   │   └── index.ts                 # Clean barrel export
│   ├── nav/
│   │   ├── OnomaHeader.tsx          # Apple toolbar, pronunciation lockup, Iconoir utilities
│   │   └── onoma-tabs.tsx           # Tab schemas, theme tokens, OnomaGlyph adapters
│   ├── sections/
│   │   ├── OverviewSection.tsx      # Quick Start synthesis surface
│   │   ├── CategoryDomainSection.tsx # Unified declarative domain panel (Places, People, Orgs, Culture, Military)
│   │   ├── domain-taxonomies.ts     # Domain category definitions and subtype options
│   │   ├── BatchSection.tsx         # Batch generation workbench coordinator
│   │   ├── batch/
│   │   │   ├── batch-constants.ts   # Taxonomy and parameter constraints
│   │   │   └── BatchResultsTable.tsx# Sortable, filterable results table with bulk actions
│   │   ├── SettingsSection.tsx      # User settings coordinator
│   │   ├── settings/
│   │   │   ├── VoicePreferencesPanel.tsx # Kokoro voices, species presets, audio sliders
│   │   │   ├── VoiceSandboxPanel.tsx     # Live synthesis sandbox & G2P phoneme suggestions
│   │   │   └── ConlangDataManagerPanel.tsx # Local backup/restore/reset data manager
│   │   ├── SyntaxSection.tsx        # Morphosyntax profile manager
│   │   ├── syntax/
│   │   │   ├── SyntaxSentenceBuilder.tsx # Live translation and inflection preview engine
│   │   │   └── SyntaxDictionaryEditor.tsx# Vocabulary lookup and word pair manager
│   │   ├── StashSection.tsx         # User saved names and custom dictionary bank
│   │   ├── MarketplaceSection.tsx   # Community language pack sharing and discovery
│   │   └── studio/
│   │       ├── StudioWorkshop.tsx   # Model training workspace & transition graph
│   │       ├── StudioPhonology.tsx  # Phonotactic templates & IPA rule editor
│   │       ├── AcousticFormantVisualizer.tsx # 2D vowel quadrilateral & rAF-optimized spectrum
│   │       ├── StudioSoundShifts.tsx# Historical sound change rule timeline & evolution diff
│   │       ├── StudioLexicon.tsx    # Lexicon dictionary manager & inflection tables
│   │       ├── StudioNameSets.tsx   # Curated seed name datasets
│   │       └── StudioVisualizer.tsx # Transition trie path explorer
│   └── shared/
│       ├── OnomaBrandLogo.tsx       # Canonical vector brand asset
│       ├── OnomaHelpModal.tsx       # Guided walkthrough modal
│       ├── GeneratorPanel.tsx       # Primary procedural generation interface
│       └── NameResultCard.tsx       # Name card with Kokoro audio, IPA, and morphology
├── hooks/
│   ├── useOnomaRouter.ts            # Navigation state, URL sync, speech attractor
│   └── useStudioState.ts            # Markov model training & custom lexicon state
└── README.md
```

---

## Server API (tRPC Sub-Routers)

Under `src/server/api/routers/onoma/`, procedures are domain-split and merged via `mergeRouters` (all files strictly ≤595 lines, 100% `audit:arch` compliant):

| Sub-Router | File | Scope |
|---|---|---|
| **NameBank** | [`namebank.ts`](file:///home/jxsig/projects/ixstats/src/server/api/routers/onoma/namebank.ts) | Stash item integration, saved names CRUD, custom dictionary imports/exports, public dictionary listing, training data. |
| **Speech** | [`speech.ts`](file:///home/jxsig/projects/ixstats/src/server/api/routers/onoma/speech.ts) | Kokoro TTS voice catalog, per-culture voice mapping, audio presets, health probes, HuggingFace space wake-up, branding config. |
| **History** | [`history.ts`](file:///home/jxsig/projects/ixstats/src/server/api/routers/onoma/history.ts) | Generation event logging, timeline, favorites, stats. |
| **Batch** | [`batch.ts`](file:///home/jxsig/projects/ixstats/src/server/api/routers/onoma/batch.ts) | Batch generation jobs & matrix permutations. |
| **Marketplace** | [`marketplace.ts`](file:///home/jxsig/projects/ixstats/src/server/api/routers/onoma/marketplace.ts) | Language pack discovery, rating, and forking. |
| **Etymology** | [`etymology.ts`](file:///home/jxsig/projects/ixstats/src/server/api/routers/onoma/etymology.ts) | Etymological graph links & root trees. |
| **Syntax** | [`syntax.ts`](file:///home/jxsig/projects/ixstats/src/server/api/routers/onoma/syntax.ts) | Sentence structure, POS, and grammar trees. |
| **Writing** | [`writing.ts`](file:///home/jxsig/projects/ixstats/src/server/api/routers/onoma/writing.ts) | Grapheme-to-glyph systems and script converters. |
| **Loanwords** | [`loanwords.ts`](file:///home/jxsig/projects/ixstats/src/server/api/routers/onoma/loanwords.ts) | Cross-cultural loanword adaptation. |

---

## Performance & Optimization

- **Compacted Datasets**: Syllable corpora, species datasets, and cultural profiles formatted as compact arrays, reducing line count by over **15,000 lines** and minimizing AST parsing memory overhead.
- **Unified Procedural Resolvers**: Shared [`template-resolver.ts`](file:///home/jxsig/projects/ixstats/src/lib/onoma/template-resolver.ts) deduplicates regex token interpolation across all specialized generators.
- **Animation Frame Throttling**: `AcousticFormantVisualizer.tsx` pauses canvas 60fps waveform rendering when the browser tab is hidden via `document.visibilityState`.
- **Zero Architecture God Files**: All files remain under the project's ≤700 architecture ceiling.
