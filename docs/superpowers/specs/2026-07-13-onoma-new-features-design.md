# Onoma New Features — Design Spec

**Date:** 2026-07-13
**Status:** Approved
**Priority Order:** 1→3→4→5→6→7→8→2

---

## Feature 1: Language Exchange / Conlang Marketplace

### Summary
Users publish their entire linguistic profile — phonological rules, morphology tables, naming conventions, cultural profile config, and curated dictionaries — as a browsable, forkable **"Language Pack."** Other users browse, preview, clone, and adapt packs for their own nations.

### Data Model

```prisma
model LanguagePack {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  countryId       String?  @map("country_id")
  name            String
  slug            String   @unique
  description     String?  @db.Text
  culturalFamily  String?  @map("cultural_family")
  visibility      String   @default("draft") // draft | public | unlisted
  forkCount       Int      @default(0) @map("fork_count")
  cloneCount      Int      @default(0) @map("clone_count")
  ratingAvg       Float    @default(0) @map("rating_avg")
  ratingCount     Int      @default(0) @map("rating_count")
  tags            String[] @default([])
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user     User      @relation("UserLanguagePacks", fields: [userId], references: [id], onDelete: Cascade)
  country  Country?  @relation("CountryLanguagePacks", fields: [countryId], references: [id])
  versions LanguagePackVersion[]
  reviews  LanguagePackReview[]
  forks    LanguagePackFork[] @relation("ForkedPacks")
  forkedFrom LanguagePackFork? @relation("SourcePack")

  @@index([userId])
  @@index([visibility, ratingAvg])
  @@index([culturalFamily])
  @@map("language_pack")
}

model LanguagePackVersion {
  id                String   @id @default(cuid())
  packId            String   @map("pack_id")
  version           Int      @default(1)
  phonologyRules    Json?    @map("phonology_rules")
  morphologyRules   Json?    @map("morphology_rules")
  orthographyRules  Json?    @map("orthography_rules")
  namingConventions Json?    @map("naming_conventions")
  dictionaries      Json?    // array of { name, category, values[] }
  sampleOutputs     Json?    @map("sample_outputs")
  changelog         String?  @db.Text
  createdAt         DateTime @default(now()) @map("created_at")

  pack LanguagePack @relation(fields: [packId], references: [id], onDelete: Cascade)

  @@unique([packId, version])
  @@map("language_pack_version")
}

model LanguagePackReview {
  id        String   @id @default(cuid())
  packId    String   @map("pack_id")
  userId    String   @map("user_id")
  rating    Int      // 1-5
  comment   String?  @db.Text
  createdAt DateTime @default(now()) @map("created_at")

  pack LanguagePack @relation(fields: [packId], references: [id], onDelete: Cascade)
  user User         @relation("UserPackReviews", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([packId, userId])
  @@map("language_pack_review")
}

model LanguagePackFork {
  id           String   @id @default(cuid())
  sourcePackId String   @unique @map("source_pack_id")
  forkedPackId String   @unique @map("forked_pack_id")
  forkedAt     DateTime @default(now()) @map("forked_at")

  sourcePack LanguagePack @relation("SourcePack", fields: [sourcePackId], references: [id], onDelete: Cascade)
  forkedPack LanguagePack @relation("ForkedPacks", fields: [forkedPackId], references: [id], onDelete: Cascade)

  @@map("language_pack_fork")
}
```

### UI Surfaces
- **Marketplace browser** — new Onoma sidebar section: grid/list of public packs, search, filter by cultural family, sort by rating/popularity/newest
- **Pack detail page** — preview phonology, sample generated names, morphology tables, reviews, fork/clone buttons
- **Pack editor** — compose a pack from existing Studio workspace data, write description, publish
- **Fork graph** — visual lineage tree showing which packs descend from which

### tRPC Procedures
- `onoma.marketplace.list` — paginated, filterable public pack listing
- `onoma.marketplace.getById` — full pack detail with latest version
- `onoma.marketplace.publish` — create/update a pack + version from current workspace
- `onoma.marketplace.fork` — clone a pack under the current user, link lineage
- `onoma.marketplace.review` — submit/update a rating+comment
- `onoma.marketplace.getMyPacks` — user's own packs (draft + public)

### Integration
- Current `NameBank` public dictionary sharing becomes a subset — dictionaries are one layer inside a Language Pack
- Studio workspace settings (phonology rules, morphology config) currently in `localStorage` need serialization to/from `LanguagePackVersion` JSON fields
- Activity feed integration via `ActivityGenerator` for pack publishes and forks

---

## Feature 2: Writing System Studio (Glyph Forge)

### Summary
Visual canvas where users design custom alphabets, syllabaries, or logographic systems by drawing or uploading glyphs, mapping each to phonemes from their IPA inventory. The system renders any generated name or phrase in the custom script.

### Data Model

```prisma
model WritingSystem {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  languagePackId  String?  @map("language_pack_id")
  name            String
  scriptType      String   @default("alphabet") // alphabet | syllabary | abjad | logographic
  direction       String   @default("ltr") // ltr | rtl | ttb
  glyphs          Json     @default("[]") // array of { id, phoneme, svgPath, unicode? }
  ligatures       Json     @default("[]") // array of { sequence, svgPath }
  baselineOffset  Float    @default(0) @map("baseline_offset")
  glyphSize       Float    @default(32) @map("glyph_size")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user         User          @relation("UserWritingSystems", fields: [userId], references: [id], onDelete: Cascade)
  languagePack LanguagePack? @relation(fields: [languagePackId], references: [id])

  @@index([userId])
  @@map("writing_system")
}
```

### Architecture
- **Glyph Canvas** — HTML5 Canvas / SVG drawing surface with basic vector tools (stroke, bezier, fill, eraser, undo). Each glyph saved as SVG path string.
- **Phoneme Mapping Table** — two-column editor: user's phoneme inventory ↔ assigned glyph. Unmapped phonemes flagged.
- **Script Type Selector** — alphabet (1 glyph = 1 phoneme), syllabary (1 glyph = 1 CV/CVC), abjad (consonants only, vowels optional).
- **Specimen Renderer** — renders any text in the custom script. Handles directionality and ligature rules.

### Starter Kits
6 pre-built script templates: Runic-inspired, Tengwar-inspired, Devanagari-derived, Cuneiform-ish, Arabic-calligraphic, Geometric/modernist. Each comes with full phoneme mapping.

### UI Location
- New sub-tab: `Studio > Script` (alongside workshop, visualizer, namesets, lexicon, phonology)
- `NameResultCard` gets optional "Show in script" toggle

---

## Feature 3: Syntax & Sentence Builder

### Summary
Users define basic grammar rules (word order, case system, agreement patterns) and compose phrases/sentences. A structured phrase template engine, not full translation.

### Data Model

```prisma
model GrammarProfile {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  languagePackId  String?  @map("language_pack_id")
  name            String
  wordOrder       String   @default("SVO") // SVO | SOV | VSO | VOS | OVS | OSV
  caseSystem      Json     @default("{}") // { nominative: suffix, accusative: suffix, ... }
  verbConjugation Json     @default("{}") // { present: { 1sg, 2sg, 3sg, ... }, past: {...} }
  articles        Json     @default("{}") // { definite: "el", indefinite: "un", none: true }
  numberSystem    Json     @default("{}") // { singular: "", plural: "-s", dual?: "-du" }
  adjectiveOrder  String   @default("before") // before | after noun
  negation        Json     @default("{}") // { particle: "ne", position: "before-verb" }
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user         User          @relation("UserGrammars", fields: [userId], references: [id], onDelete: Cascade)
  languagePack LanguagePack? @relation(fields: [languagePackId], references: [id])

  @@index([userId])
  @@map("grammar_profile")
}
```

### Phrase Template Engine
- Users input an English template: `"The king commands the army"`
- Engine parses into semantic roles: `[DEF_ART] [NOUN:subject] [VERB:present:3sg] [DEF_ART] [NOUN:object]`
- Applies word order reordering (SVO → SOV: subject object verb)
- Applies case suffixes (nominative to subject, accusative to object)
- Conjugates verb based on profile rules
- Looks up vocabulary from the user's lexicon dictionary
- Outputs the conlang sentence with glossing annotation

### UI
- New Onoma sidebar section: **"Sentences"** or sub-tab in Studio
- Split-screen: English input (top) → grammatical breakdown (middle) → conlang output (bottom)
- Glossing display (interlinear format): conlang word / morpheme breakdown / English translation
- "Speak" button synthesizes the sentence via Kokoro

---

## Feature 4: Etymological Web

### Summary
Graph visualization showing how words derive from root morphemes — compounds, prefixes, suffixes, semantic shifts. Users define roots and derivation rules; Onoma auto-generates a family tree of related words.

### Data Model

```prisma
model EtymologyRoot {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  languagePackId  String?  @map("language_pack_id")
  root            String   // e.g. "kel-"
  meaning         String   // e.g. "to protect"
  ipa             String?  // IPA transcription of the root
  notes           String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user         User          @relation("UserEtymologyRoots", fields: [userId], references: [id], onDelete: Cascade)
  languagePack LanguagePack? @relation(fields: [languagePackId], references: [id])
  derivations  EtymologyDerivation[] @relation("RootDerivations")

  @@index([userId])
  @@map("etymology_root")
}

model EtymologyDerivation {
  id              String   @id @default(cuid())
  rootId          String   @map("root_id")
  parentId        String?  @map("parent_id") // null = direct from root
  word            String   // e.g. "kelari"
  meaning         String   // e.g. "guardian"
  ipa             String?
  derivationType  String   // prefix | suffix | compound | semantic-shift | reduplication
  morphemeAdded   String?  @map("morpheme_added") // e.g. "-ari" (agentive suffix)
  notes           String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  root   EtymologyRoot        @relation("RootDerivations", fields: [rootId], references: [id], onDelete: Cascade)
  parent EtymologyDerivation?  @relation("DerivationChildren", fields: [parentId], references: [id])
  children EtymologyDerivation[] @relation("DerivationChildren")

  @@index([rootId])
  @@map("etymology_derivation")
}
```

### UI
- New sub-tab: `Studio > Etymology`
- Interactive tree/graph using `@xyflow/react` (already used by MarkovVisualizer)
- Root node → child derivations fanning outward
- Click any node to see word card: word, meaning, IPA, derivation path, pronunciation button
- "Auto-derive" button: given a root + derivation rules from morphology, generate candidate derived words
- Color-coding by derivation type (prefix=blue, suffix=green, compound=purple, semantic-shift=amber)

---

## Feature 5: Batch Generation & Export Workbench

### Summary
Generate hundreds of names at once with constraints, preview in a sortable/filterable table, export as CSV/JSON/PDF specimen sheet or directly into a nation's database.

### Architecture
- **No new Prisma models** — this is a client-side + API feature
- New tRPC procedure: `onoma.batchGenerate` — accepts constraints (count, category, cultural profile, generation options) and returns an array of generated names with metadata (IPA, syllable count, perplexity score)
- Server-side generation avoids browser performance bottlenecks for large batches (500+ names)

### Constraints Input
- Count: 10–1000 names
- Cultural profile selector
- All existing `GenerateOptions` (min/max length, startsWith, endsWith, syllable count, CV template, etc.)
- **Consistency mode**: optional flag that trains a single Markov chain once and generates all names from it (vs. re-training per name)

### Results Table
- Sortable columns: Name, IPA, Syllables, Perplexity Score, Length
- Bulk select + save to Name Bank
- Filter by perplexity range ("only show natural-sounding names")
- Dedup toggle (remove near-duplicates by Levenshtein distance)

### Export Formats
- **CSV** — name, ipa, syllables, category, cultural_profile
- **JSON** — full metadata including generation parameters
- **PDF Specimen Sheet** — formatted document with names in columns, IPA below each, optional custom script rendering
- **Direct Import** — push names into the user's nation as city/province names (via existing tRPC endpoints)

### UI Location
- New Onoma sidebar section: **"Batch"** or accessible from each category section via "Generate Batch" button

---

## Feature 6: Side-by-Side Language Comparator

### Summary
Split-screen view comparing two conlang profiles — phoneme inventories, morphological rules, sample outputs, phonotactic statistics — with a "linguistic distance" metric.

### Architecture
- **No new Prisma models** — reads from existing Language Pack data or localStorage profiles
- Pure client-side comparison logic

### Comparison Dimensions
1. **Phoneme Inventory** — Venn diagram or highlighted IPA chart showing shared vs. unique phonemes
2. **Phonotactic Statistics** — side-by-side Shannon entropy, bigram frequencies, consonant/vowel ratios
3. **Morphology** — table comparing case systems, conjugation patterns, word order
4. **Sample Output** — generate 10 names from each profile using the same category, displayed side by side
5. **Linguistic Distance Score** — composite metric: phoneme Jaccard distance + bigram cosine similarity + morphological feature overlap. Scale 0 (identical) to 100 (completely alien)

### UI
- Accessible from Marketplace (compare any two public packs) and Studio (compare your workspace against a pack)
- Two-panel layout with synchronized scrolling
- "Blend Preview" button: mix the two profiles at a 50/50 ratio and generate sample names from the hybrid

---

## Feature 7: Generation History & Favorites Timeline

### Summary
Persistent timeline of every name generated, searchable and filterable, with one-click favoriting and session replay.

### Data Model

```prisma
model GenerationEvent {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  sessionId       String   @map("session_id") // groups a generation session
  names           String[] // generated names in this batch
  category        String
  culturalProfile String?  @map("cultural_profile")
  trainingMode    String   @map("training_mode")
  parameters      Json     // GenerateOptions snapshot
  count           Int
  createdAt       DateTime @default(now()) @map("created_at")

  user      User                @relation("UserGenerationEvents", fields: [userId], references: [id], onDelete: Cascade)
  favorites GenerationFavorite[]

  @@index([userId, createdAt])
  @@index([sessionId])
  @@map("generation_event")
}

model GenerationFavorite {
  id        String   @id @default(cuid())
  eventId   String   @map("event_id")
  userId    String   @map("user_id")
  name      String   // the specific name favorited
  note      String?  // optional user annotation
  createdAt DateTime @default(now()) @map("created_at")

  event GenerationEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user  User            @relation("UserGenerationFavorites", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([eventId, userId, name])
  @@index([userId, createdAt])
  @@map("generation_favorite")
}
```

### UI
- New Onoma sidebar section: **"History"**
- Chronological timeline with date grouping
- Each entry shows: timestamp, category, cultural profile, count, and expandable list of generated names
- Star icon on each name for one-click favorite
- Filter by: category, cultural profile, date range, favorites only
- **Session replay** button: re-run with same parameters but different random seed
- **Statistics dashboard**: total names generated, most-used profiles, favorite categories, generation streak

### Integration
- Hooks into the existing `logGeneration` procedure — extend it to also record the generated names
- Favorites can be bulk-saved to Name Bank

---

## Feature 8: Loanword & Contact Registry

### Summary
Users define loanword relationships between conlang profiles — "my Slavic language borrowed 30% of its military vocabulary from your Latin language" — and Onoma generates hybrid names reflecting cultural contact.

### Data Model

```prisma
model LoanwordContact {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  sourcePackId    String   @map("source_pack_id")
  targetPackId    String   @map("target_pack_id")
  domain          String   // military | trade | religious | academic | general
  intensity       Float    @default(0.3) // 0.0–1.0, percentage of vocabulary borrowed
  adaptationRules Json     @default("{}") @map("adaptation_rules") // phonological adaptation rules
  notes           String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user       User         @relation("UserLoanwordContacts", fields: [userId], references: [id], onDelete: Cascade)
  sourcePack LanguagePack @relation("LoanwordSources", fields: [sourcePackId], references: [id], onDelete: Cascade)
  targetPack LanguagePack @relation("LoanwordTargets", fields: [targetPackId], references: [id], onDelete: Cascade)

  @@unique([sourcePackId, targetPackId, domain])
  @@index([userId])
  @@map("loanword_contact")
}
```

### Hybrid Generation Engine
- When generating names for a language with active contacts, the Markov chain blends training data:
  - Base training data from the target language (weighted by `1 - intensity`)
  - Source language training data for the matching domain (weighted by `intensity`)
- **Phonological Adaptation**: borrowed words are modified to fit the target language's phonotactics
- Adaptation rules defined per-contact: consonant substitutions, vowel shifts, suffix additions

### UI
- Accessible from Marketplace pack detail page: "Add Contact" button
- Contact editor: select source language, domain, intensity slider, adaptation rules
- Preview: generate 10 names showing the influence, with annotations showing which elements are borrowed
- Visual: chord diagram showing all contact relationships between a user's languages

### Dependencies
- Requires Feature 1 (Language Exchange) to exist — contacts link between Language Packs

---

## Implementation Priority & Dependencies

```
Feature 7 (History)          ── no dependencies, standalone
Feature 5 (Batch)            ── no dependencies, standalone
Feature 6 (Comparator)       ── no dependencies, standalone
Feature 1 (Marketplace)      ── no dependencies, foundational for 2, 3, 4, 8
Feature 4 (Etymology)        ── soft dep on Feature 1 (linkable to packs)
Feature 3 (Syntax)           ── soft dep on Feature 1 (linkable to packs)
Feature 2 (Writing System)   ── soft dep on Feature 1 (linkable to packs)
Feature 8 (Loanwords)        ── hard dep on Feature 1 (links between packs)
```

### Recommended Build Order (respecting user priority + dependencies)
1. **Feature 7** — History & Favorites (quick win, no schema deps)
2. **Feature 5** — Batch Generation (quick win, no schema deps)
3. **Feature 6** — Comparator (client-side, no schema deps)
4. **Feature 1** — Language Exchange (foundational schema)
5. **Feature 4** — Etymology Web (needs pack linkage)
6. **Feature 3** — Syntax Builder (needs pack linkage)
7. **Feature 2** — Writing System (needs pack linkage)
8. **Feature 8** — Loanwords (needs packs to exist)

---

## Verification Plan

### Automated Tests
- Unit tests for each new lib module (etymology graph traversal, batch generation, hybrid Markov blending, linguistic distance calculation)
- tRPC procedure tests for all new CRUD operations
- `bun run test` for regression

### Manual Verification
- Visual review of each new UI section in dev
- End-to-end flow: create language pack → publish → fork → compare → generate batch → export
