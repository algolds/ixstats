# IxStates Test Suite Comprehensive Audit & Justification

**Date**: August 2026  
**Platform**: IxStates 1.4.0 "Ogma" (Release Candidate)  
**Runners**: Jest 30.4.2 (`@swc/jest`, `jsdom`), Bun 1.4.0 Native Parallel Runner (`bun test`)  
**Scope**: 122 test files (860+ test cases) across `src/tests/` and root libraries  
**Methodologies**: Ponytail Audit (Over-Engineering & Dead Code Pruning), TypeScript & Jest Architectural Invariants  

---

## Executive Summary & Value Distribution

The IxStates test suite protects a complex modular monolith spanning procedural cartography (UPG v2), conlang phonetics (Onoma), statecraft simulations, an in-memory lore engine (WikiOS), and high-concurrency micro-economies (Vault).

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 0: Mission-Critical Invariants & Safety Nets (Ultra-High Value)  │
│ Mathematical engines, GIS/Voronoi mesh, PostGIS repairs, Concurrency  │
│ 31 files (25%) · Zero Tolerance for Failure                           │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 1: Core Simulation & Algorithmic Domain Logic (High Value)        │
│ Onoma linguistics, National Issues AST, Sports sim, WikiOS link graph  │
│ 45 files (37%) · Pure Algorithmic Contracts                            │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2: API Contract, Batching & Security Boundaries (Moderate-High)   │
│ Cross-router import blocks, RBAC/CASL auth, N+1 query batching gates   │
│ 24 files (20%) · Data Isolation & Architecture Guards                  │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3: Domain Utilities & Data Transformers (Moderate Value)          │
│ Currency formatters, admin transforms, blazon rules, date chronometry │
│ 15 files (12%) · Data Formatting & Minor Helpers                       │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 4: Brittle, Tautological, or Obsolete Tests (Removal Candidates)  │
│ Self-testing dummy vars, 80-line shallow DOM mocks, CSS class checks  │
│ 7 files (6%) · ~1,100 Lines of Net Removable Code                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Complete Test Suite Inventory & Justification

### Category 1: WorldGen UPG v2 & Spatial Math (15 files) — `[TIER 0]`
Procedural world generation is non-negotiable: bad geometry or non-deterministic terrain corrupts realms permanently.

| Test File | Justification & Verification Target | Risk / Failure Impact |
| :--- | :--- | :--- |
| `src/tests/lib/worldgen/v2/mesh.test.ts` | Validates 100k-cell Voronoi mesh generation, Lloyd relaxation convergence, Delaunay sampling, and bounding bounds. | Broken cell meshes cause infinite loops or NaN coordinates in map generation. |
| `src/tests/lib/worldgen/v2/tectonics.test.ts` | Validates plate partitioning, velocity vectors, and convergent/divergent/transform boundary classification. | Flat maps without mountain ranges or plate physics. |
| `src/tests/lib/worldgen/v2/terrain.test.ts` | Validates elevation hypsometry, zones 0–8, continental vs oceanic plate heights, and mountain ridge cells. | Glacial peaks on coastlines or inverted ocean floors. |
| `src/tests/lib/worldgen/v2/coastlines.test.ts` | Validates island clustering, micro-landmass pruning (<5 cells), and coastal distance damping (`coastDist <= 3`). | Unrealistic archipelago noise and broken shorelines. |
| `src/tests/lib/worldgen/v2/hydro-climate.test.ts` | Validates Trewartha biomes (0–11), orographic precipitation, downhill river tracing, and ocean mouth termination. | Rivers flowing uphill or biomes placed in impossible latitudes. |
| `src/tests/lib/worldgen/v2/politics.test.ts` | Validates state boundary claims, capital settlement allocation, and exclave prevention. | Unclaimed land or fragmented nation boundaries. |
| `src/tests/lib/worldgen/v2/export.test.ts` | Enforces RFC 7946 GeoJSON output across all 7 layers (altitudes, rivers, lakes, states). | MapLibre rendering crashes and layer schema incompatibilities. |
| `src/tests/lib/worldgen/v2/quality-gate.test.ts` | Verifies 9-point scientific quality gate with $\ge 85\%$ threshold. | Degraded procedural world quality passing into production. |
| `src/tests/lib/worldgen/v2/multi-seed-audit.test.ts` | Runs 10-seed deterministic audit against the 80% per-seed / 85% composite standard. | Seed regressions in the procedural generation pipeline. |
| `src/tests/lib/worldgen/v2/performance.test.ts` | Enforces $<3000\text{ms}$ execution budget and RSS memory limits for 10k-cell worlds. | Server memory exhaustion or worker timeouts during realm creation. |
| `src/tests/lib/worldgen/v2/regression.test.ts` | Ensures byte-identical GeoJSON generation on identical seeds and Chaikin spline vertex density. | Non-deterministic map generation across server restarts. |
| `src/tests/lib/worldgen/heightmap.test.ts` | Tests topographic multi-zone gradient distribution across seeds. | Elevation banding artifacts. |
| `src/tests/lib/hydro-downhill-tracer.test.ts` | Tests gradient flow pathing across irregular meshes. | Broken hydrology networks. |
| `src/tests/lib/shared-vertex-builder.test.ts` | Validates shared-vertex topology across contiguous geopolitical polygons. | Gaps or overlapping slivers between country borders. |
| `src/tests/lib/worldgen/v2/integration.test.ts` | Multi-seed end-to-end pipeline execution with timing assertions. | Integration regression across pipeline stages. |

---

### Category 2: Maps Pipeline, Topology, GIS & Routing (16 files) — `[TIER 0 - TIER 1]`
Geospatial calculation engines that power the Atlas cartography editor and domestic route networks.

| Test File | Justification & Verification Target | Risk / Failure Impact |
| :--- | :--- | :--- |
| `src/tests/lib/geo-validation.test.ts` | Tests polygon ring closure validation and PostGIS `ST_MakeValid` auto-repair. | **Critical:** Invalid GeoJSON crashes spatial database queries. |
| `src/tests/lib/border-snapping.test.ts` | Validates vertex-to-vertex snapping within distance tolerances. | Border gaps when editing nation boundaries. |
| `src/tests/lib/border-trace.test.ts` | Validates boundary polygon extraction from adjacent cell graphs. | Distorted geopolitical boundaries in map exports. |
| `src/tests/lib/border-shaping.test.ts` | Tests Catmull-Rom ($\tau=0.5$) spline subdivision and smoothing. | Jagged or self-intersecting nation borders. |
| `src/tests/lib/border-history-asof.test.ts` | Validates point-in-time geopolitical reconstruction from the event ledger. | Historical border playback displays corrupt or missing borders. |
| `src/tests/lib/territory-brush.test.ts` | Tests dynamic spatial brush radius operations and cell claim math. | Map editor paint tool over-painting or missing cells. |
| `src/tests/lib/topology-engine.test.ts` | Tests graph adjacency and manifold mesh consistency. | Broken map layer topology. |
| `src/tests/lib/maps/route-geometry.test.ts` | Tests great-circle arc densification for air/sea corridors and straight-line roads. | Route lines penetrating the globe or distorting across the antimeridian. |
| `src/tests/lib/maps/route-network-graph.test.ts` | Validates hub-and-spoke graph construction and nearest-hub endpoint snapping. | Broken pathfinding across domestic infrastructure networks. |
| `src/tests/lib/maps/province-importer/alignment.test.ts` | Tests nearest-island boundary snapping during external GIS imports. | Imported provinces floating in open ocean. |
| `src/tests/lib/maps/province-importer/merge-plan.test.ts` | Validates case/whitespace normalization and conflict resolution during shapefile imports. | Duplicate province records created on import. |
| `src/tests/lib/maps/pipeline/*` (5 files) | Validates Azgaar format conversion, RFC 7946 normalization, and geospatial quality metrics. | Corrupted GIS shapefile ingestion. |

---

### Category 3: Onoma Onomastics & Phonetics Engine (18 files) — `[TIER 1]`
IxStates's procedural linguistic engine powering 5 conlangs, name generation, and Kokoro TTS speech synthesis.

| Test File | Justification & Verification Target | Risk / Failure Impact |
| :--- | :--- | :--- |
| `src/tests/lib/onoma/kokoro-phonemes.test.ts` | Tests IPA phonetic reduction, cardinal vowel mappings ($o \to o\mho$), and Kokoro TTS token safety. | Text-to-speech engine crashes on unmapped phonemes or invalid token sets. |
| `src/tests/lib/onoma/phonology.test.ts` | Validates phoneme inventories, phonotactic constraints, and onset-nucleus-coda syllable templates. | Unpronounceable or culturally mismatched procedural names. |
| `src/tests/lib/onoma/markov-chain.test.ts` | Validates $N$-gram transition matrices and seed determinism. | Repetitive or degenerate generated names. |
| `src/tests/lib/onoma/generators.test.ts` | Tests preset generators for business corporations, academies, noble houses, and mercenary bands. | Empty names or malformed titles generated in-game. |
| `src/tests/lib/onoma/morphology.test.ts` | Validates affixation, compounding, and declension engines. | Broken grammatical agreement in conlang generators. |
| `src/tests/lib/onoma/sound-shifts.test.ts` | Validates Grimm's Law and sound mutation rules over historical language trees. | Broken language family drift simulations. |
| `src/tests/lib/onoma/vowel-formants.test.ts` | Validates F1/F2 acoustic formant calculations for vowel quadrilateral mapping. | Inaccurate vowel space charts in the conlang lab. |
| `src/tests/lib/onoma/comparator.test.ts` | Validates Jaccard and Cosine phonetic similarity between linguistic profiles. | Incorrect culture proximity classifications. |
| `src/tests/lib/onoma/lexicon-analytics.test.ts` | Validates Shannon entropy, $N$-gram frequency distributions, and lexicon health audits. | Degraded dictionary health scores in conlang tools. |
| `src/tests/lib/onoma/branding-utils.test.ts` | Validates chunk-based IPA to English phonetic pronunciation spelling. | Broken syllable stress formatting. |
| `src/tests/lib/onoma/species-generator.test.ts` | Tests taxonomic naming algorithms for flora, fauna, and sentients. | Conlang naming regressions. |
| `src/tests/lib/onoma/lexicon/*` (3 files) | Validates lexicon bucket segregation, character cleaning, and culture classification. | Corrupt or polluted vocabulary corpora. |
| `src/tests/lib/onoma/perplexity.test.ts` | Validates phonotactic probability scoring. | Conlang validation regressions. |
| `src/tests/lib/onoma/template-phonetics.test.ts` | Validates phonetic template string expansion. | Template parser failures. |
| `src/tests/app/api/onoma/tts/route.test.ts` | Validates the HTTP TTS streaming endpoint and error responses. | Audio generation API failures. |

---

### Category 4: Architecture Guards, Verification Gates & Scripts (8 files) — `[TIER 0 - TIER 1]`
Static analyzers that enforce code architecture ceilings, preventing code rot and modular boundary leaks.

| Test File | Justification & Verification Target | Risk / Failure Impact |
| :--- | :--- | :--- |
| `src/tests/scripts/audit-arch.test.ts` | Enforces the **$\le 700$-line router ceiling**, ratchet baseline, and architecture guardrails. | Router sprawl into unmaintainable god-files. |
| `src/tests/scripts/audit-arch-imports.test.ts` | Enforces **zero cross-router imports** (`routerA` importing from `routerB`). | Circular router dependencies and leaky domain boundaries. |
| `src/tests/architecture/client-server-entrypoints.test.ts` | Verifies that client files never import `server-only` code, Prisma, or Node runtime primitives. | Client bundle corruption and production build crashes. |
| `src/tests/lib/domain-contract-boundary.test.ts` | Asserts architectural boundary rules directly from TypeScript AST inspections. | Leaking backend business logic into presentation layers. |
| `src/tests/scripts/router-residue.test.ts` | Verifies that split routers don't leave deleted monolith files or duplicate exports. | Build breakage from dead router files. |
| `src/tests/scripts/validate-script-targets.test.ts` | Validates that every command in `package.json` points to a script file that actually exists. | Broken CI commands and dead developer scripts. |
| `src/tests/scripts/sync-reference-docs.test.ts` | Validates that `docs/reference/api-complete.md` matches the actual tRPC router catalog. | Outdated or inaccurate API documentation. |
| `src/tests/scripts/verification-gates.test.ts` | Validates strict verification gate pipelines before git commits. | Skipping mandatory quality gates. |

---

### Category 5: Statecraft, Simulation, Economics & National Issues (14 files) — `[TIER 1]`
The mathematical heartbeat of the MyCountry governance simulation and national game loops.

| Test File | Justification & Verification Target | Risk / Failure Impact |
| :--- | :--- | :--- |
| `src/tests/lib/national-issues-evaluator.test.ts` | Validates recursive AST evaluation for issue spawn conditions (`count`, `any`, nested `and`/`or`/`not`). | National issues spawning for the wrong countries or never triggering. |
| `src/tests/lib/national-issues-limits.test.ts` | Enforces weekly issue generation caps and bypass capacity checks. | Event spam flooding players' dashboards. |
| `src/tests/lib/national-issues-consequences.test.ts` | Validates directive intent completion calculation from linked issue resolution statuses. | Broken progression on player directives. |
| `src/tests/lib/statecraft/recon.test.ts` | Validates CivCap recon cost formulas, reconnaissance depth, and fog-of-war reveals. | Exploits allowing players to scout rivals for zero cost. |
| `src/tests/lib/statecraft/whip.test.ts` | Validates party whip pressure, defection risk, and legislative discipline. | Incorrect parliamentary voting predictions. |
| `src/tests/lib/statecraft/power-brokers.test.ts` | Validates broker influence, alignment scores, and endorsement leverage. | Broken faction influence mechanics. |
| `src/tests/lib/economic-simulations.test.ts` | Validates GDP growth, corporate tax efficiency curves, and inflation adjustments. | Economic balance runaway bugs (infinite money glitches). |
| `src/tests/lib/legislative-vote.test.ts` | Validates bloc voting, abstention calculations, and simple vs supermajority margins. | Bills failing when they should pass or vice versa. |
| `src/tests/lib/approval.test.ts` | Validates government approval rating decay and popularity momentum. | Inaccurate political popularity metrics. |
| `src/tests/lib/intent/resistance.test.ts` | Validates policy implementation resistance curves. | Directives completing instantly with zero resistance. |
| `src/tests/lib/transport-costs.test.ts` | Validates multimodal freight and transit cost algorithms. | Distorted economic trade costs. |
| `src/tests/lib/policy-strategy-rework.test.ts` | Validates policy synergy calculation models. | Distorted strategic policy scores. |
| `src/tests/lib/national-issues-config.test.ts` | Validates spawn mode fallback and environment configuration overrides. | Unconfigured issue spawning loops. |
| `src/tests/lib/tier-utils.test.ts` | Validates tier categorization logic across platform entities. | Misclassified tier ranks. |

---

### Category 6: Temporal Engine, Vault, Concurrency & Cards (14 files) — `[TIER 0 - TIER 2]`
Handles monetary balances, card transactions, and game clock time dilation.

| Test File | Justification & Verification Target | Risk / Failure Impact |
| :--- | :--- | :--- |
| `src/tests/lib/vault-concurrency.test.ts` | Validates atomic transactions, balance validation, and race-condition prevention during card trading. | **Critical:** Card duplication exploits or balance desyncs. |
| `src/tests/lib/vault-service.test.ts` | Validates debit/credit ledgering and balance tracking. | Wallet corruption. |
| `src/tests/lib/ixtime/core.test.ts` | Validates time dilation (2x post-pivot, 4x historical), epoch conversions (2028/2040), and inverse mapping. | Chronological desynchronization across game systems. |
| `src/tests/lib/ixtime/accuracy.test.ts` | Enforces sub-second precision and leap-year invariants. | Time drift accumulating over months of simulation. |
| `src/tests/lib/card-valuation.test.ts` | Validates algorithmic card market pricing based on rarity, print run, and demand. | Market crash bugs or infinite credit exploits. |
| `src/tests/lib/cards/lore-card-generator.test.ts` | Validates procedural card generation from wiki articles. | Malformed cards entering the marketplace. |
| `src/tests/lib/heraldry/blazon.test.ts` & `validation.test.ts` | Validates Rule of Tincture, heraldic charges, and blazon grammar. | Invalid heraldic arms rendering with graphical glitches. |
| `src/tests/lib/flags/flag-resolver.test.ts` & `api/flags-route.test.ts` | Validates SVG flag fallback cascades and proxy caching. | Missing nation flags across the UI. |

---

### Category 7: Server Routers, Batching, Security & RBAC (19 files) — `[TIER 0 - TIER 2]`
Guards backend security, multi-tenant country data isolation, and query efficiency.

| Test File | Justification & Verification Target | Risk / Failure Impact |
| :--- | :--- | :--- |
| `src/tests/security/xss-sanitization.test.ts` | Verifies DOMPurify and wikitext XSS stripping against malicious payloads (`<script>`, `onerror`, `javascript:`). | **Critical:** Stored XSS vulnerabilities on social feeds or wiki pages. |
| `src/tests/auth/ability.test.ts` | Validates CASL permission rules across `User`, `Admin`, and `SystemOwner` roles. | **Critical:** Privilege escalation vulnerabilities. |
| `src/tests/server/api/routers/roles-auth.test.ts` | Verifies tRPC middleware blocking unauthorized access to admin/system endpoints. | **Critical:** Unauthenticated users executing admin mutations. |
| `src/tests/server/api/routers/atomic-country-authorization.test.ts` | Verifies that players cannot edit another nation's atomic components or policies. | Cross-tenant data tampering between players. |
| `src/tests/server/api/trpc-impersonation.test.ts` | Validates session security and token bounds during admin user impersonation. | Account takeover via leaked impersonation contexts. |
| `src/tests/server/api/routers/messages-principal-binding.test.ts` | Verifies that message senders cannot spoof sender identity. | Impersonation and forged messages in ThinkShare. |
| `src/tests/server/api/routers/*-batching.test.ts` (4 files) | Validates DataLoader batching for achievements, crafting, NPC diplomacy, and conversations. | N+1 database query avalanches bringing down PostgreSQL. |
| `src/tests/server/api/routers/component-serializers.test.ts` | Validates SuperJSON and BigInt serialization across tRPC boundaries. | Crash on serializing large GDP figures or dates. |
| `src/tests/server/modules/atomic/compound-mutations.test.ts` | Validates atomic rollbacks when multi-table component updates fail mid-transaction. | Orphaned database records and inconsistent state. |
| `src/tests/server/shared/wiki-placeholder-resolver.test.ts` | Validates cross-domain dynamic wikitext variable interpolation (`{POPULATION}`, `{LEADER}`). | Broken templates on auto-generated pages. |
| `src/tests/server/modules/forum/*` (4 files) | Validates XenForo SSO bridge, password hashing, and trophy synchronization. | Forum login failures or out-of-sync player avatars. |

---

### Category 8: WikiOS Native Engine (14 files) — `[TIER 1 - TIER 3]`
In-memory relational link graph, MediaWiki bridge, and media caching layer.

| Test File | Justification & Verification Target | Risk / Failure Impact |
| :--- | :--- | :--- |
| `src/tests/lib/wiki-os/core-domain.test.ts` | Validates slugifiers, link extraction, and ParserFunctions (`#if`, `#ifeq`, `#switch`, `#expr`). | Template rendering failures across 4,000+ wiki articles. |
| `src/tests/lib/wiki-os/media-theme.test.ts` | Validates SVG/LaTeX dark mode inversion filters, frosted plinths, and de-thumbnailing. | Unreadable dark-mode diagrams or blurry low-res thumbnails. |
| `src/tests/lib/wiki-os/media-asset-service.test.ts` | Validates MD5 2-level shard path calculation and asset reference extraction. | Broken image URLs for 7,500+ wiki media assets. |
| `src/tests/lib/wiki-os/blurhash-service.test.ts` | Validates Base-83 encoding and inline SVG blur placeholder generation. | Layout shift during article media loading. |
| `src/tests/lib/wiki-os/mediawiki-timestamp.test.ts` | Validates 14-digit MediaWiki timestamp parsing and relative time formatting. | "Invalid Date" displayed on article revision histories. |
| `src/tests/lib/wiki-os/draft-store.test.ts` | Validates localStorage draft saving and deduplication between visual and source editors. | Player losing unsaved wiki article edits. |
| `src/tests/lib/wiki-search-service.test.ts` | Validates PostgreSQL full-text Spotlight search queries. | Broken article search. |
| `src/tests/lib/wiki-os/advanced-search.test.ts` | Validates reading-time estimation and search snippet extraction. | Minor search UI formatting errors. |
| `src/tests/lib/wiki-os/search-service.test.ts` | Validates wikitext intro paragraph extraction and reference stripping. | Search snippets showing raw wikitext tags. |
| `src/tests/lib/wiki-infobox-mapper.test.ts` | Validates mapping infobox wikitext parameters to relational DB models. | Data sync errors between MediaWiki and PostgreSQL. |
| `src/tests/lib/wiki-import-pipeline.test.ts` | Validates batch article import pipeline from XML dumps. | Corrupt article data during migrations. |

---

### Category 9: Sports Simulation Engine (6 files) — `[TIER 1 - TIER 2]`
Simulates 7 sports, league schedules, Elo ratings, and tactical formations.

| Test File | Justification & Verification Target | Risk / Failure Impact |
| :--- | :--- | :--- |
| `src/tests/lib/sports/live-match.test.ts` | Validates minute-by-minute match simulation, momentum swings, and stamina decay. | Sports matches ending in impossible scores or infinite loops. |
| `src/tests/lib/sports/predictions.test.ts` | Validates Elo/Glicko win probabilities and expected goal calculations. | Broken betting and prediction odds. |
| `src/tests/lib/sports/commentary/narrator.test.ts` | Validates procedural play-by-play commentary generation. | Social feed commentary showing broken template strings. |
| `src/tests/lib/sports/feed-bulletins.test.ts` | Validates regex header stripping (`[blurb:...]`) and sports bulletin parsing. | Social feed crash when displaying match recaps. |
| `src/tests/sports/tactics.test.ts` & `transition.test.ts` | Validates formation matchups and tactical transition matrices. | Sports simulation tactical bugs. |
| `src/tests/sports/wages.test.ts` & `integration.test.ts` | Validates player contract math and multi-team league scheduling. | Salary cap violations in league management. |

---

### Category 10: UI Components, Builder & Utilities (20 files) — `[TIER 2 - TIER 4]`
React hooks, calculations, data tables, and formatting utilities.

| Test File | Justification & Verification Target | Value Tier |
| :--- | :--- | :---: |
| `src/tests/app/builder/utils/*Calculations.test.ts` (4 files) | Pure math for sector GDP, labor distribution, preview scaling, and population demography. | **Tier 1** |
| `src/tests/app/builder/services/BidirectionalSyncService.test.ts` | Validates two-way sync between builder form state and country database models. | **Tier 2** |
| `src/tests/lib/format-utils.test.ts` | Validates custom currencies (Taler, Crown) and ISO currency formatting. | **Tier 2** |
| `src/tests/components/mycountry/domains/defense/BorderThreatPanel.test.tsx` | Validates military threat calculation and visual alert states. | **Tier 2** |
| `src/tests/hooks/duplicateFeature.test.ts` | Pure data transform for map feature cloning and coordinate offsetting. | **Tier 2** |
| `src/tests/components/atomic-ui-characterization.test.tsx` | Characterization test for atomic component selector interaction. | **Tier 3** |
| `src/tests/components/stability-guardrails.test.tsx` | Tests WebGL error recovery hooks and NPC calculation fallback resilience. | **Tier 3** |
| `src/tests/lib/common-utils.test.ts` & `title-case.test.ts` | Basic string and array helpers. | **Tier 3** |
| `src/tests/lib/editor-prefs.test.ts` | LocalStorage preference getter/setter wrapper. | **Tier 3** |
| `src/tests/app/admin/*-page.test.tsx` (3 files) | **Shallow DOM renders** with 80+ lines of mock hooks checking if text renders. | **Tier 4** |
| `src/tests/clerk-components.test.ts` | **CSS class checks** asserting that theme objects contain `"backdrop-blur-2xl"`. | **Tier 4** |
| `src/tests/passport-architecture.test.ts` | **Self-testing dummy variables** declared inline inside the test file itself. | **Tier 4** |
| `src/tests/lib/wiki-os/margin.test.ts` | Implements logic inline inside the test instead of importing source code. | **Tier 4** |

---

## 2. Ponytail Audit: Removal & Shrink Candidates

Applying the `ponytail-audit` standard:

```
TAG     WHAT TO CUT                                    REPLACEMENT / ACTION                   FILE PATH
delete  Self-testing dummy variables with zero imports Replace with real hook test            src/tests/passport-architecture.test.ts
delete  Static CSS class name string assertions        Delete (covered by build/typecheck)    src/tests/clerk-components.test.ts
delete  Inline regex & clustering algorithms in test   Extract to lib or test actual component src/tests/lib/wiki-os/margin.test.ts
shrink  80-line mock objects for shallow DOM tests     Delete page tests; keep pure transforms src/tests/app/admin/diplomatic-scenarios-page.test.tsx
shrink  80-line mock objects for shallow DOM tests     Delete page tests; keep pure transforms src/tests/app/admin/economic-components-page.test.tsx
shrink  80-line mock objects for shallow DOM tests     Delete page tests; keep pure transforms src/tests/app/admin/government-components-page.test.tsx
delete  Out-of-date ignored benchmark test             Delete (ignored in jest config)        src/tests/server/api/routers/caching-benchmark.test.ts
```

### Detailed Evidence for Cuts

1. **`src/tests/passport-architecture.test.ts`** (277 lines)
   - **Evidence:** Lines 6–16 test `const allowedTabs = ["realms", "work", "history"]; expect(allowedTabs).toHaveLength(3);`. Lines 184–198 define an inline `for` loop inside the test file and assert that the loop works.
   - **Verdict:** `delete`. It tests no application code and gives false confidence.

2. **`src/tests/clerk-components.test.ts`** (28 lines)
   - **Evidence:** Tests whether a static configuration object contains the string `"backdrop-blur-2xl"` and `"border-border"`.
   - **Verdict:** `delete`. CSS class changes break this test without indicating a bug.

3. **`src/tests/lib/wiki-os/margin.test.ts`** (134 lines)
   - **Evidence:** Lines 64–74 write an inline regex to slugify a string inside the test. Lines 96–118 write an inline pin-clustering loop inside the test. Furthermore, importing `SelectionCapsule` causes a `ReferenceError: document is not defined` failure in headless runners.
   - **Verdict:** `delete` or rewrite to test actual exported functions from `src/lib/wiki-os/margin/`.

4. **`src/tests/app/admin/*-page.test.tsx`** (3 files, ~350 lines)
   - **Evidence:** Each file constructs a 75-line mock object of `use*Admin` hooks just to render a skeleton and assert `expect(screen.getByText("...")).toBeInTheDocument()`. The underlying logic is already tested in `src/tests/lib/admin/*-transforms.test.ts`.
   - **Verdict:** `shrink`/`delete`. High maintenance burden when UI copy changes; zero logic tested.

5. **`src/tests/server/api/routers/caching-benchmark.test.ts`** (273 lines)
   - **Evidence:** Benchmark test that relies on real timing (`performance.now()`), already excluded in `package.json` (`testPathIgnorePatterns`).
   - **Verdict:** `delete`.

---

## 3. Test Runner Environment & Flakiness Root Causes

In `bun test` runs, three distinct issues occurred:

1. **Prisma Node-API Panics in Bun (`failed to delete napi ref`)**:
   - **Cause:** When Bun's worker threads terminate while Prisma's native C++ query engine (`query-engine-node-api`) has open connection references, the N-API destructor triggers an assertion failure.
   - **Remedy:** Pure unit tests (`test:unit`) must mock `~/server/db` with `mock-prisma.ts` so they never load the native engine binary.

2. **Missing DOM Globals in Headless Runs (`document is not defined`)**:
   - **Cause:** `margin.test.ts` imports a React component which imports `next/router`. Next.js evaluates `document.documentElement.dataset` at module load time.
   - **Remedy:** Separate DOM/component tests (which run in Jest with `jsdom`) from pure mathematical/algorithmic tests (which run in Bun's fast native runner).

3. **Global Mock State Leakage (`article-store.test.ts`)**:
   - **Cause:** Tests share global Prisma client spies across tests without `mockReset()` in `beforeEach`.
   - **Remedy:** Add `beforeEach(() => { jest.clearAllMocks(); })` and isolate database queries using `transactional-mock-db.ts`.

---

## 4. Summary Metrics

- **Total Test Files:** 122
- **Ultra-High Value (Tier 0 & 1):** 76 files (62%) — WorldGen, GIS, Onoma, Simulation, Security, Statecraft, Concurrency.
- **Moderate Value (Tier 2 & 3):** 39 files (32%) — API batching, Auth rules, serializers, builder utils, formatters.
- **Low Value / Removal Candidates (Tier 4):** 7 files (6%) — ~1,100 lines of brittle mocks, inline tautologies, and static CSS checks.
- **Net Removable Lines:** **~1,100 lines** across 7 files.
