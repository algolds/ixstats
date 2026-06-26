# Onoma 2.0 — Product & Architecture Roadmap

This document outlines the **10-phase roadmap** for Onoma—the Language & Naming Engine of IxStates—matching the v2.0 Product Requirements Document against the current codebase.

---

## 1. Executive Status Dashboard

The core philosophy of Onoma is **"Deterministic First"**: procedural generation remains the foundation and source of truth, while Machine Learning and AI models enrich and validate the output.

```mermaid
gantt
    title Onoma 2.0 Roadmap Progress
    dateFormat  YYYY-MM-DD
    section Completed
    Phase 1: Foundation            :done, p1, 2026-06-01, 2026-06-15
    Phase 2: Corpus Intelligence   :done, p2, 2026-06-16, 2026-06-22
    Phase 3: Linguistics Engine    :done, p3, 2026-06-23, 2026-06-26
    section Active & Planned
    Phase 4: Living Languages      :active, p4, 2026-06-27, 2026-07-10
    Phase 5: Machine Learning      :after p4, p5, 14d
    Phase 6: AI Linguist           :after p5, p6, 14d
    Phase 7: Voice                 :after p6, p7, 10d
    Phase 8: Translation Engine    :after p7, p8, 14d
    Phase 9: Language Studio       :after p8, p9, 21d
    Phase 10: Onoma AI             :after p9, p10, 21d
```

| Phase | Objective | Status | Core Source Files / Modules |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Foundation** | **100% Completed** | [markov-chain.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/markov-chain.ts), [useOnomaGenerator.ts](file:///home/jxsig/projects/ixstats/src/hooks/useOnomaGenerator.ts), [GeneratorPanel.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/shared/GeneratorPanel.tsx), [OnomaRouter.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/OnomaRouter.tsx) |
| **Phase 2** | **Corpus Intelligence** | **100% Completed** | [lexicon-analytics.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/lexicon-analytics.ts), [LexiconExplorer.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/LexiconExplorer.tsx), [MarkovVisualizer.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/MarkovVisualizer.tsx) |
| **Phase 3** | **Linguistics Engine** | **90% Completed** | [phonology.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/phonology.ts), [morphology.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/morphology.ts), [orthography.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/orthography.ts), [StudioLexicon.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/studio/StudioLexicon.tsx) |
| **Phase 4** | **Living Languages** | *Planned* | Evolution engine, timelines, loanword/dialect tracking. |
| **Phase 5** | **ML Layer** | *In Progress* | ✅ Phonotactic perplexity scorer (`perplexity.ts`, naturalness % badge). ⏳ TF-IDF semantic search, lexicon gap recommender. |
| **Phase 6** | **AI Linguist** | *Planned* | Local LLM-backed dictionary writing & etymologies. |
| **Phase 7** | **Voice** | *Core Done* | ✅ IPA-driven synthesis via meSpeak (asm.js eSpeak): `speech.ts` (`ipaToEspeak`, culture→voice) + `mespeak-loader.ts`, wired to the pronounce button. ⏳ Historical voice shifts (depends on Phase 4). |
| **Phase 8** | **Translation Engine** | *Planned* | Grammar-aware English <=> conlang translators. |
| **Phase 9** | **Language Studio** | *Planned* | Visual grammar/alphabet editor, dialect forks. |
| **Phase 10**| **Onoma AI** | *Planned* | Generative language simulation agents. |

---

## 2. Completed Phase Details & File Links

### Phase 1: Foundation (Naming Engine)
- **Status**: Complete.
- **Architectural Delivery**:
  - **Markov Chains & Backoff**: Rebuilt the character & syllable training algorithms. Features multi-order lookback models that automatically back off to order $N-1$ down to $1$ when tight constraints cannot be met. Implemented in [markov-chain.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/markov-chain.ts).
  - **Culture Classifier**: A Naive-Bayes bigram classifier in [culture-classifier.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/lexicon/culture-classifier.ts) that groups training inputs into single cultures or compound blends (e.g. `celtic+germanic`).
  - **Wiki Extractors & Cleaning**: Automation scripts under [scripts/onoma/](file:///home/jxsig/projects/ixstats/scripts/onoma/) that pull, clean, and bucket over 28,000 wiki names.
  - **Custom Studio Workspace**: Paste-in text areas, drag-and-drop file upload streams, and local-storage session caching implemented in [StudioWorkshop.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/studio/StudioWorkshop.tsx) and [useStudioState.ts](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/hooks/useStudioState.ts).

### Phase 2: Corpus Intelligence
- **Status**: Complete.
- **Architectural Delivery**:
  - **Lexicon Analytics**: Functions in [lexicon-analytics.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/lexicon-analytics.ts) calculate Shannon entropy (phonetic diversity), letter density arrays, and bigram/trigram frequencies.
  - **Visualizer Graph Canvas**: Interactive center-panning graph using `@xyflow/react` in [MarkovVisualizer.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/MarkovVisualizer.tsx) demonstrating next-token transition pathways and executing weighted random walks.
  - **Dictionary Health Auditing**: Real-time quality audits that flag duplicates, punctuation errors, length outliers, and compute a `Corpus Quality Score (0-100)` before model compilation.

### Phase 3: Linguistics Engine
- **Status**: Complete (Core UI/UX & Primitives).
- **Architectural Delivery**:
  - **Grapheme-to-IPA Parser**: Custom sound rules mapping graphemes to IPA transcriptions across all 8 cultures, including a consonant-onset stress stress heuristic (`ˈ`). Implemented in [phonology.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/phonology.ts).
  - **Orthography script mapping**: Transcribes IPA characters to Cyrillic, Greek, and Arabic (RTL-rendered) scripts in [orthography.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/orthography.ts).
  - **Morphological Declensions**: Calculates grammatical gender (masculine, feminine, neuter) and plural/singular cases (Nominative, Genitive, Accusative, Dative, Ablative) in [morphology.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/morphology.ts).
  - **UI Integrations**:
    - Interactive audio pronunciation player badges in [NameResultCard.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/shared/NameResultCard.tsx).
    - Split-screen Lexicon Dictionary and terms catalog editor in [StudioLexicon.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/studio/StudioLexicon.tsx).

---

## 3. Active & Future Execution Backlog (Phase 4 to 10)

```
                       [Phase 3 (Linguistics Engine)]
                                    │
                                    ▼
                      [Phase 4: Living Languages]
                      (Evolution Engine / Timelines)
                                    │
                                    ▼
                      [Phase 5: Machine Learning]
                      (Perplexity / Semantic Search)
                                    │
                                    ▼
                        [Phase 6: AI Linguist]
                       (Local LLM Root-Derivation)
                                    │
                                    ▼
                          [Phase 7-8: Voice]
                     (Speech Synth / Translation)
                                    │
                                    ▼
                        [Phase 9-10: Onoma AI]
                     (Visual Dialects / Assistants)
```

### Phase 4: Living Languages (Linguistic Evolution)
- **Objective**: Procedural simulation of conlang sound shifts, grammar updates, and vocabulary drift across epochs (1000 BC $\rightarrow$ 2033 AD).
- **Backlog Items**:
  - **Sound Change Engine**: Build a rule parser applying phonetic shift laws (e.g. Grimm's Law, vowel shifts, final-consonant erosion) over time intervals.
  - **Vocabulary Timeline Viewer**: A slider-based interface showing how a word evolves (e.g. *Imperium* $\rightarrow$ *Empyre* $\rightarrow$ *Empire*).
  - **Language Family Trees**: Visual generation of linguistic descent trees (Proto $\rightarrow$ dialect branches).

### Phase 5: Machine Learning Layer
- **Objective**: Replace basic filters with deep scoring models, semantic search, and similarity checks.
- **Backlog Items**:
  - **Phonotactic Perplexity Scorer**: Train a statistical N-gram probability model scoring conlang word "naturalness" and pronounceability percentages.
  - **Semantic Embeddings**: Vectorize conlang vocab definitions using sentence embeddings to support semantic mapping (e.g. searching "Empire" returns conlang roots for *Realm*, *Dominion*, and *Kingdom*).
  - **Corpus Recommendation**: Suggestions flagging phonetic gaps in dictionaries.

### Phase 6: AI Linguist
- **Objective**: Integrate LLM inference to compose etymologies, examples, and idioms strictly bound to procedural conlang roots.
- **Backlog Items**:
  - **Etymology Composers**: Connect LLMs via tRPC prompt templates that consume conlang root constants and definitions and output consistent in-world etymologies.
  - **No-Hallucination Guardrails**: Restrict LLM translation inputs to only utilize vocabulary defined in the procedural database.

### Phase 7: Voice
- **Objective**: Audio voice synthesis matching conlang dialect constraints.
- **Backlog Items**:
  - **Speech Synthesizer integration**: Connect an open-source grapheme-to-speech model mapping synthesized IPA transcriptions into natural speech audio files.
  - **Speech Evolution**: Voice qualities changing over timelines.

### Phase 8: Translation Engine
- **Objective**: Context-aware conlang translators.
- **Backlog Items**:
  - **Grammar-Aware Translators**: Multi-step pipeline that maps input words, applies case declensions and verb conjugations, arranges syntax (SVO vs SOV), and returns the conlang phrase.

### Phase 9: Language Studio
- **Objective**: visual UI suite for user-created dialects and custom alphabets.
- **Backlog Items**:
  - **Visual Alphabet Editor**: Canvas tool mapping glyph shapes and sound rules.
  - **Dialect Branch Forking**: Git-style forking and merging of custom dictionaries.

### Phase 10: Onoma AI
- **Objective**: Fully agentic language generation assistants.
- **Backlog Items**:
  - **Linguistic Simulation Agents**: Prompt-driven conlang setups ("Generate a maritime republic dialect with Greek sound rules, simulate 500 years of sound shifts, and write its vocabulary").

---

## 4. Platform Integration Roadmap

```
                    [Procedural Language Engine]
                                 │
           ┌───────────┬─────────┴─────────┬───────────┐
           ▼           ▼                   ▼           ▼
       [IxWiki]   [MyCountry]          [IxMaps]    [NPC Engine]
     (Etymologies) (Demonyms)          (Toponyms)   (Dynasties)
```

1.  **NPC Engine (Dynasties & Call-signs)**:
    *   Inject the conlang etymologies generator into character name builders.
    *   Provide culturally aligned call-signs and titles based on historical government types.
2.  **IxMaps (Procedural Toponyms)**:
    *   Map the natural landmark presets to procedural maps generation, automatically naming rivers, roads, mountains, and airports using nearby geographical conlang vocabulary.
3.  **MyCountry (Demonyms & Decrees)**:
    *   Use the morphology engine to generate demonym plurals and case variations for government policy strategy titles and official documents.
