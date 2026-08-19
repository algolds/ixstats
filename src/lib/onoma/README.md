# Onoma — Language & Naming Engine

Client-side procedural name generator + computational linguistics engine at **`/labs/onoma`**. The philosophy is **"deterministic first"**: procedural generation and formal phonotactic rules are the source of truth.

Four core pillars:

1. **Markov Engine** (`markov-chain.ts`) — Multi-order character **and** syllable models trained on a word list, with automatic **backoff** (tries order $N$, falls back to $N-1 \dots 1$ when constraints are tight) and phonotactic safeguards (consonant/vowel cluster caps, vowel harmony, double-letter control).
2. **Linguistics Engine** — Enriches each generated name: IPA phonetic transcription (`phonology.ts`), grammatical gender + 5-case noun declensions (`morphology.ts`), and Cyrillic/Greek/Arabic script transcription (`orthography.ts`).
3. **Sound Change & Conlang Evolution Engine** (`sound-shifts.ts`) — Historical phonological sound shift rule interpreter ($X \to Y\ /\ \text{ENV}$) across chronological epochs (e.g. Grimm's Law, Latin-to-Romance Lenition, Slavic Palatalization, Great Vowel Shift) to derive daughter conlangs and regional dialects from Proto-Lexicons with full step tracking.
4. **Acoustic Formants & Spectrogram Engine** (`vowel-formants.ts`) — Real-time 2D IPA Vowel Quadrilateral ($F_1$ vowel height vs $F_2$ vowel frontness/backness), acoustic center of gravity calculations, and Web Audio API FFT spectrum visualization.

Everything runs in the browser. The server is only touched to save names to the Stash, fetch optional live-world training data, and proxy natural neural voice synthesis through Kokoro TTS.

---

## 7 Core Optimization & Architecture Initiatives (Plans 125–131)

| Initiative | Scope | Description |
|---|---|---|
| **Plan 125** | Production BasePath & Voice Clean | Enforced Next.js production `withBasePath` on `/api/onoma/tts` fetch endpoints. Preserved word-initial cardinal vowels ($ɑ$, $ɛ$, $oʊ$) in `branding-utils.ts` and `kokoro-phonemes.ts` to eliminate leading "uh/eh" vocal hesitation artifacts. Replaced CJS `require()` with static ESM dictionary loaders. |
| **Plan 126** | Centralized Presets & Ponytail Trim | Unified all preset naming paths (species, taverns, mystic orders, noble dynasties) into `generatePresetName` in `name-generator.ts`. Trimmed dead `export.ts` file and removed legacy getters in `markov-chain.ts`. Unified speech synthesis to `speakBrowserNative`. |
| **Plan 127** | Code-Splitting & Lazy LM Calibration | Converted heavy Studio sections (`StudioSection`, `MarketplaceSection`, `StashSection`, `SettingsSection`) to Next.js `next/dynamic` imports to eliminate main-thread TBT. Refactored `useOnomaGenerator.ts` to lazily calibrate and cache n-gram language models (`getOrTrainLM`) on demand. |
| **Plan 128** | Strict Schemas & Nominal Branding | Defined nominal branded types (`IPAString`, `LanguagePackId`) and strict Zod validation schemas (`PhonologyRulesSchema`, `MorphologyRulesSchema`, `StashNoteMetadataSchema`). Eliminated `z.any()` across `marketplace.ts`, `syntax.ts`, and `core.ts`. |
| **Plan 129** | Apple Motion & Facet Aesthetics | Implemented spring-physics layout expansion (`bounce: 0, duration: 0.35`) for `NameResultCard.tsx` linguistic details. Added tactile active press compression (`active:scale-[0.92]`), optical typography tracking (`tracking-[-0.015em]`), and OS accessibility support (`useReducedMotion`). |
| **Plan 130** | Historical Sound Shift Evolution Engine | Built rule parser and execution engine (`src/lib/onoma/sound-shifts.ts`) for environmental phonological shifts (`V_V`, `_[ei]`, `_#`, `#_`, `(?![ʰh])`). Integrated multi-epoch chronological evolution studio (`StudioSoundShifts.tsx`) with side-by-side Proto-Word vs Daughter Word comparisons. |
| **Plan 131** | Acoustic Formants & FFT Spectrogram | Built $F_1/F_2$ vowel formant coordinates and inverted trapezoid chart space (`src/lib/onoma/vowel-formants.ts`). Integrated real-time 2D IPA Vowel Quadrilateral and FFT audio frequency spectrum canvas into IPA Studio (`AcousticFormantVisualizer.tsx`). |
| **Plan 132** | Customized IRL & Template Phonetics Engine | Upgraded all 13 IRL culture phonetic tables with authentic diacritics and regional stress. Built 18+ dedicated linguistic profiles (`template-phonetics.ts`) for fantasy species, organizations, and noble lineages. Implemented 5-tier hierarchical resolver (`resolveNamePhonetics`) and canonical "Hello World" benchmark suite (`template-phonetics.test.ts`). |

---

## File Map

```
src/lib/onoma/
  markov-chain.ts              Markov engine (multi-order backoff, char+syllable modes, cluster limits, vowel harmony)
  name-generator.ts            Markov wrapper + preset dispatcher (generatePresetName) + CSV/JSON export
  phonology.ts                 Grapheme→IPA parser per culture/template + 5-tier hierarchical phonetic resolver
  template-phonetics.ts        18+ dedicated linguistic profiles, BCP-47 speech tags, and Kokoro voice personas
  sound-shifts.ts              Historical sound change rule interpreter (Grimm's Law, Romance Lenition, Slavic Palatalization)
  vowel-formants.ts            Acoustic vowel formant frequencies (F1/F2), coordinate projections, center of gravity
  morphology.ts                Grammatical gender detection & 5-case noun declension tables
  orthography.ts               Script transcribers for Cyrillic, Greek, and Arabic (RTL)
  perplexity.ts                Char n-gram LM → name "naturalness" 0–100 percentile fit scoring
  browser-speech.ts            Browser-native SpeechSynthesis player mapping naming cultures to BCP-47 language tags
  branding-utils.ts            Linguistic flanking styles, Google Fonts registry, and IPA-to-Speech-Spelling converter
  kokoro-phonemes.ts           IPA to Kokoro phoneme converter and token normalizer
  lexicon-analytics.ts         Shannon entropy, letter/bigram/trigram frequencies, 0–100 health audit
  types.ts                     Nominal branded types (IPAString, LanguagePackId) and strict Zod validation schemas
  cultural-profiles.ts         13 culture word lists (preset training + classifier training)
  species/group/tavern         Rule-based fantasy assemblers
  data/                        Generated, COMMITTED:
    fantasy/species/group/tavern-data.ts   syllable/template data
    lexicon/<category>.json + manifest.json  compact wiki dictionaries (build output)
  lexicon/                     Lexicon pipeline logic (pure, jest-tested):
    clean.ts                   title → trainable name
    culture-classifier.ts      n-gram Naive-Bayes → single culture or "A+B" compound
    bucket.ts                  final bucket assignment + top-compound ranking

src/hooks/
  useOnomaGenerator.ts         State, lazy lexicon loading, training, cached LM calibration, curated pickers
  useNameBank.ts               Name Bank queries, Stash persistence, and dictionary mutations
  useWikiNarrator.ts           Immersive natural audio narrator for WikiOS article voiceover

src/app/labs/onoma/components/
  OnomaRouter.tsx              SPA router + Facet navigation tabs + dynamic code-splitting
  sections/
    OverviewSection.tsx        Quick generator & popular presets
    PlacesSection.tsx          Settlement, geography & natural feature generators
    PeopleSection.tsx          First names, noble houses & cultural ethnonyms
    MilitarySection.tsx        Military regiments, ships & fortress namers
    StudioSection.tsx          Conlang creation suite (Workshop, Visualizer, Name Sets, Lexicon, IPA, Sound Shifts)
    MarketplaceSection.tsx     Conlang sharing & community dictionary repository
    StashSection.tsx           Saved names & exported conlang dictionaries
    SettingsSection.tsx        Voice sandbox, speed/pitch preferences & server wake controls
  sections/studio/
    StudioSoundShifts.tsx      Historical sound change rule timeline & Proto-to-Daughter evolution diff
    AcousticFormantVisualizer.tsx  Interactive 2D IPA Vowel Quadrilateral ($F_1/F_2$) & FFT audio spectrum canvas
    StudioPhonology.tsx        IPA Studio: interactive grapheme-to-sound mapper & live formant feedback
    StudioWorkshop.tsx         Markov model weight inspector & token path simulator
    StudioLexicon.tsx          Lexicon dictionary editor, definition manager & health analyzer
```

---

## Historical Sound Change Engine (`sound-shifts.ts`)

Languages evolve systematically through historical sound shifts. Onoma supports standard linguistic notation:
- **`source` $\to$ `target` / `context`**: Target phoneme becomes replacement in specified phonetic environment.
- **Environments**:
  - `V_V`: Intervocalic (between vowels, e.g. `p → b / V_V` in Latin *ripa* $\to$ *riba*).
  - `_[ei]`: Front vowel palatalization (e.g. `c → tʃ / _[ei]` in Latin *civitas* $\to$ *tʃividas*).
  - `#_`: Word-initial onset (e.g. `p → pf / #_` in German *pan* $\to$ *pfan*).
  - `_#`: Word-final apocope (e.g. `m → ∅ / _#` in Latin *aurum* $\to$ *auru*).
  - `(?![ʰh])`: Aspiration lookahead preserving digraphs (e.g. Grimm's Law $d \to t$ vs $d^h \to d$).

### Built-in Historical Presets
1. **Grimm's Law (PIE $\to$ Proto-Germanic)**: $P, T, K \to F, \theta, H$; $B, D, G \to P, T, K$; $B^h, D^h, G^h \to B, D, G$.
2. **Latin to Early Romance Lenition**: Palatalization before front vowels, intervocalic stop voicing, and terminal $m$-apocope.
3. **Proto-Slavic First Palatalization**: $k, g, x \to č, ž, š$ before front vowels.
4. **Great Vowel Shift**: High vowel diphthongization and mid-vowel raising.

---

## Acoustic Phonetics & Vowel Quadrilateral (`vowel-formants.ts`)

Acoustic phonetics defines vowel qualities by their first two formant resonance frequencies:
- **$F_1$ (Vowel Height / Jaw Openness)**: Inversely related to tongue height. Close vowels ($/i/, /u/ \approx 280-300\text{Hz}$) have low $F_1$; Open vowels ($/a/, /ɑ/ \approx 700-750\text{Hz}$) have high $F_1$.
- **$F_2$ (Vowel Frontness / Tongue Advancement)**: Directly related to tongue advancement. Front vowels ($/i/ \approx 2250\text{Hz}$) have high $F_2$; Back vowels ($/u/ \approx 800\text{Hz}$) have low $F_2$.

### Real-Time Visualization
`AcousticFormantVisualizer.tsx` renders:
- An inverted SVG IPA Quadrilateral plotting active word vowels in real time.
- Animated trajectory lines tracing the phonetic path through vowel space during articulation.
- Mean **Acoustic Center of Gravity** marker and Front/Back distribution ratios.
- Simulated Web Audio API FFT frequency resonance spectrum ($0 - 3000\text{Hz}$).

---

## Natural Neural Voice & Server Wake Engine

Onoma provides dual voice synthesis:
1. **🔊 Browser-Native SpeechSynthesis** (`browser-speech.ts`): Instant client-side playback mapping conworld cultures to standard BCP-47 language codes.
2. **🎙 Kokoro Neural TTS** (`/api/onoma/tts`): Self-hosted neural model proxy passing canonical IPA phonemes directly to `/dev/generate_from_phonemes`.

### Hugging Face / GPU Cold-Start Wake Engine
Idle Hugging Face spaces and GPU containers sleep when inactive. The `wakeKokoroServer` tRPC mutation in `src/server/api/routers/onoma/core.ts` provides:
- Extended **45-second cold-start timeout** to allow container bootup.
- Live status reporting (`awake`, `waking`, `down`, `unconfigured`) and latency tracking ($ms$).
- Interactive "Ping / Wake Server" triggers in both the Admin Panel and Onoma Lab Settings.

---

## Automated Test Suites

Run the full Onoma test suite with `bun`:

```bash
# Run all Onoma engine, linguistics, and TTS proxy tests (18 test suites, 154 tests)
bun run test -- src/lib/onoma src/app/api/onoma/tts

# Run dedicated Initiatives 125-131 verification suite
bun run test -- src/lib/onoma/onoma-audit-initiatives.test.ts

# Run sound shift engine tests
bun run test -- src/lib/onoma/sound-shifts.test.ts

# Run vowel formant acoustic tests
bun run test -- src/lib/onoma/vowel-formants.test.ts
```
