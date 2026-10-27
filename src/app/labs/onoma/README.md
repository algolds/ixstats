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

- **`page.tsx`** / **`[...slug]/page.tsx`** → Mount `<OnomaRouter />` (the catch-all enables deep links to sections).
- **`glyphs/page.tsx`** → Standalone interactive glyph catalog at `/labs/onoma/glyphs`.
- **`layout.tsx`** → Declares metadata and the vector SVG favicon (`withBasePath("/images/onoma-favicon.svg")`).
- **`components/OnomaRouter.tsx`** → Lean master coordinator (~140 lines) delegating to:
  - **`hooks/useOnomaRouter.ts`** → Unified state machine, browser history/popstate listeners, Kokoro TTS player, and lexicon counter.
  - **`components/nav/OnomaHeader.tsx`** → Apple-style header bar with the formal `⟨ONOMA⟩` lockup logo (`OnomaBrandLogo.tsx`), `/ˈɒnəmə/` pronunciation attractor with Kokoro fallback, version badge, and spring-animated utility buttons (`Help`, `Stash`, `Studio`, `Settings`).
  - **`components/nav/onoma-tabs.tsx`** → Standardized navigation tab metadata (pillars, CREATE domains, Studio and Explore sub-tabs), theme colors, and `OnomaGlyph` badge adapters.
  - **`components/OnomaSectionRenderer.tsx`** → Section dispatcher: Overview and CategoryDomain load synchronously; heavier sections load via `next/dynamic` with a loading fallback.

---

## Modular Component Structure

```
src/app/labs/onoma/
├── components/
│   ├── OnomaRouter.tsx              # Master coordinator (~140 lines)
│   ├── OnomaSectionRenderer.tsx     # Dynamic lazy section dispatcher
│   ├── glyphs/                      # ⟨ONOMA⟩ Linguistic Glyph System (Apple SF Symbols × IPA)
│   │   ├── OnomaGlyph.tsx           # Vector glyph & composable expression renderer
│   │   ├── onoma-glyphs-catalog.tsx # 24 pure SVG mathematical vector paths
│   │   └── index.ts                 # Clean barrel export
│   ├── nav/
│   │   ├── OnomaHeader.tsx          # Apple toolbar, pronunciation lockup, Iconoir utilities
│   │   ├── OnomaFooter.tsx          # Footer
│   │   ├── PhysicsPullFooter.tsx    # Physics-based expandable footer
│   │   └── onoma-tabs.tsx           # Tab schemas, theme tokens, OnomaGlyph adapters
│   ├── sections/
│   │   ├── OverviewSection.tsx      # Sandbox: unified CREATE quick-synthesis surface
│   │   ├── QuickGeneratorControls.tsx # Sandbox generator controls
│   │   ├── CategoryDomainSection.tsx # Unified declarative domain panel (Places, People, Factions, Culture; a `military` taxonomy exists but has no tab)
│   │   ├── domain-taxonomies.ts     # Domain category definitions and subtype options
│   │   ├── batch/                   # BatchResultsTable + batch-constants (client-side batch generation)
│   │   ├── StudioSection.tsx        # STUDIO pillar: Workshop · Path Visualizer · Name Sets · Sound Shifts
│   │   ├── ExploreSection.tsx       # EXPLORE pillar: Acoustics & IPA · Grammar & Roots · Writing Systems · Community Packs
│   │   ├── GrammarRootsSection.tsx  # Hosts EtymologySection + SyntaxSection
│   │   ├── EtymologySection.tsx     # Root/derivation tree editor
│   │   ├── WritingSection.tsx       # Writing systems (writing/: GlyphForgeCanvas, GlyphMapRegistry, OrthographySandbox, ScriptSettingsPanel)
│   │   ├── ComparatorSection.tsx    # Phoneme-profile similarity (inside Acoustics & IPA)
│   │   ├── HistorySection.tsx       # Generation history & favorites (inside Stash)
│   │   ├── LexiconExplorer.tsx / MarkovVisualizer.tsx # Used by StudioVisualizer
│   │   ├── SettingsSection.tsx      # User settings coordinator
│   │   ├── settings/
│   │   │   ├── VoicePreferencesPanel.tsx # Kokoro voices, species presets, audio sliders
│   │   │   ├── VoiceSandboxPanel.tsx     # Live synthesis sandbox & G2P phoneme suggestions
│   │   │   └── ConlangDataManagerPanel.tsx # Local backup/restore/reset data manager
│   │   ├── SyntaxSection.tsx        # Morphosyntax profile manager
│   │   ├── syntax/
│   │   │   ├── SyntaxSentenceBuilder.tsx # Live translation and inflection preview engine
│   │   │   └── SyntaxDictionaryEditor.tsx# Vocabulary lookup and word pair manager
│   │   ├── StashSection.tsx         # User saved names and custom dictionary bank (+ ../stash/ImportStashPanel, SavedDictionaryCard)
│   │   ├── LanguagePacksSection.tsx # Community language pack sharing and discovery
│   │   ├── LoanwordsSection.tsx     # Contact channels and phonological adaptation (inside Sound Shifts)
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
│       ├── onoma-help-data.ts       # Structured help walkthroughs and guides
│       ├── SynthesisResultsGrid.tsx # Unified adaptive card grid & table results surface
│       ├── NameResultCard.tsx       # Name card with Kokoro audio, IPA, and morphology
│       └── …                        # UseNameDialog, CorpusSelector, PatternDepthControl, PronunciationEditor, DictionaryEditModal, etc.
├── hooks/
│   ├── useOnomaRouter.ts            # Navigation state, URL sync, speech attractor
│   ├── useOnomaPronunciation.ts     # Kokoro → browser-speech pronunciation helper
│   └── useStudioState.ts            # Markov model training & custom lexicon state
└── README.md
```

---

## Server API (tRPC Sub-Routers)

Under `src/server/api/routers/onoma/`, procedures are domain-split and merged via `mergeRouters` (all files strictly ≤595 lines, 100% `audit:arch` compliant):

| Sub-Router | File | Scope |
|---|---|---|
| **NameBank** | [`namebank.ts`](../../../server/api/routers/onoma/namebank.ts) | Stash item integration, saved names CRUD, custom dictionary imports/exports, public dictionary listing, training data. |
| **Speech** | [`speech.ts`](../../../server/api/routers/onoma/speech.ts) | Kokoro TTS voice catalog, per-culture voice mapping, audio presets, health probes, HuggingFace space wake-up, branding config. |
| **History** | [`history.ts`](../../../server/api/routers/onoma/history.ts) | Generation event logging, timeline, favorites, stats. |
| **Marketplace** | [`marketplace.ts`](../../../server/api/routers/onoma/marketplace.ts) | Language pack discovery, rating, and forking. |
| **Etymology** | [`etymology.ts`](../../../server/api/routers/onoma/etymology.ts) | Etymological graph links & root trees. |
| **Syntax** | [`syntax.ts`](../../../server/api/routers/onoma/syntax.ts) | Saved morphosyntax profiles (word order, affixes, articles, dictionary). |
| **Writing** | [`writing.ts`](../../../server/api/routers/onoma/writing.ts) | Saved grapheme-to-glyph writing systems. |
| **Loanwords** | [`loanwords.ts`](../../../server/api/routers/onoma/loanwords.ts) | Cross-cultural loanword adaptation. |

---

## Performance & Optimization

- **Compacted Datasets**: Syllable corpora, species datasets, and cultural profiles formatted as compact arrays, reducing line count by over **15,000 lines** and minimizing AST parsing memory overhead.
- **Unified Procedural Resolvers**: Shared [`template-resolver.ts`](../../../lib/onoma/template-resolver.ts) deduplicates regex token interpolation across all specialized generators.
- **Animation Frame Throttling**: `AcousticFormantVisualizer.tsx` pauses canvas 60fps waveform rendering when the browser tab is hidden via `document.visibilityState`.
- **Zero Architecture God Files**: All files remain under the project's ≤700 architecture ceiling.
