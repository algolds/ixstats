# IxStates

### The Operating System for Worldbuilding.

[![Version](https://img.shields.io/badge/version-1.4.0%20%22Lobster%20Crosby%22-teal.svg?style=flat-square)](src/lib/buildVersion.ts)
[![Release Channel](https://img.shields.io/badge/channel-Release%20Candidate-14b8a6.svg?style=flat-square)](src/lib/buildVersion.ts)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.4-FBF0DF.svg?style=flat-square&logo=bun)](https://bun.sh/)
[![tRPC](https://img.shields.io/badge/tRPC-11.18-blueviolet.svg?style=flat-square&logo=trpc)](https://trpc.io/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748.svg?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.3-38bdf8.svg?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)

**IxStates** is a worldbuilding platform that allows your country (or world) to live, change, and grow. Where traditional worldbuilding traps your lore in static documents and spreadsheets, IxStates brings your world to life: every country’s economic output, policies, diplomatic initiatives, and military readiness are dynamically simulated based on your decisions and the actions of other nations.

---


## For the Worldbuilder — A Nation That Breathes

In traditional worldbuilding, lore is frozen in time. Numbers stay static until you manually edit them, and your civilization stops existing the moment you close the tab.

**IxStates breaks the frozen lore barrier:**

- **Continuous Simulation**: Design your country once in the **Builder**. From that moment forward, its economy hums, tax dividends compound, populations shift across provinces, and international trade balances evolve automatically.
- **Time is Everything (Temporal Engine)**: The universe breathes on a continuous timeline operating at 2x speed. Crises unfold, elections resolve, your economy grows or shrinks, and your stats organically sync in real time across the entire platform.
- **Geography Is King**: Your nation is not an arbitrary shape on a flat image. It occupies real, physics-driven terrain on a 100,000-cell Voronoi mesh with tectonic elevations, Coriolis-modeled river networks, and 12 distinct climate biomes.
- **MyCountry**:  Take the helm of your country. You will face complex decisions, navigate international relations, and manage your country's resources to ensure the prosperity and security of your people. Your choices will shape the future of your nation and its place in the world. 

---

## The Architecture

IxStates is a layered micro-OS: three **Apps** are the end-user surfaces, four **Engines** run the simulation underneath them, and **Core Systems** wire the two together. Every mechanic sits on the same spine — one gameplay loop, one immutable ledger, one shared clock, one geographic source of truth.

### The Statecraft Loop — the gameplay grammar

Domestic governance, diplomacy, and politics are the *same* loop — `IN → SEE → OUT → RIPPLE` — differing only in the counterparty and how commitments resolve:

| Beat | Domestic | Diplomacy | Politics |
| :--- | :--- | :--- | :--- |
| **IN** (stimulus) | National issue | Foreign overture / threat | Bill / coalition demand |
| **SEE** (recon) | Minister's minutes | Ambassador's cable | Whip count |
| **OUT** (commit) | Policy | Foreign policy / treaty | Bill vote |
| **Resolves by** | Executive fiat | Foreign consent | Legislative vote |

Play is two verbs — *See* (pay to look) and *Commit* (pay to act) — spent against three heterogeneous levers: **Capacity** (a *rate*: civil-service bandwidth), **Treasury** (a *stock*: the actual budget), and **Mandate** (a *standing*: legitimacy you risk, which abroad becomes Influence & Reputation). Over-extending Capacity or low government efficiency triggers **Information Fog** — the engine *never lies*, it withholds or qualifies (the *never-lie contract*). Today fog shows as warnings on previews; masking effects behind qualitative risk bands is designed but not yet built.

### The Canonical Loop — Action → World Effect → Narrative → Ledger

Commitments produce a **bounded, clamped** world-state change and a narrative entry in the country's canon feed via the event spine (`src/lib/activity/event-spine.ts`). Stat changes are capped by the growth-tier engine and credit movements are recorded in the vault ledger — the "Burg's Guardrail" goal that no stat can be quietly inflated. The spine is not yet universal: directives and national issues use it; diplomacy, defense, elections and meetings do not.

### System Engines

| Engine | Role |
| :--- | :--- |
| **IxTime** (Temporal) | Continuous dilated clock (currently 2.0×) with piecewise-linear epoch math, automated drift correction, and a client-side interpolation store. Governs issue deadlines, elections, budget cycles, match clocks, and wiki timestamps. |
| **Statecraft** (MyCountry Engine v4) | Tracks Civil Service Capacity (CivCap), applies clamped stat modifiers, classifies intent, and spawns resistance issues from domestic power brokers. |
| **Concord** (Living-World, v2) | IxTime, diplomatic stance drift, and NPC personality traits (8 traits scored from live data). The crisis lifecycle (`BREWING → … → RESOLVED`), NPC trait drift and event-fatigue dampening are designed but not yet built; crisis events are read-only today. |
| **Atlas** (Spatial, v5) | 100,000-cell Voronoi procedural worldgen (tectonic plates, coastal hypsometric damping, Coriolis hydrology, 12 Trewartha biomes). PostGIS `ST_Touches` geometry is the Tier-0 source of truth for borders, neighbors, and regional rollups. |

### Apps & Core Systems

**Apps** — `IxWorld`, `WikiOS`, `IxVault` — are independently versioned user surfaces with their own product lifecycles. **Core Systems** — `MyCountry` (Command Suite), `Builder`, `ThinkPages`, `Achievements`, `Halo`, `Onoma` — are interactive features wired directly into the engines. Each is detailed in the feature sections below.

### API, Data & Platform Infrastructure

- **API**: <!-- BEGIN_DOCS:COUNT:routers -->76<!-- END_DOCS:COUNT:routers --> domain-split **tRPC routers** (<!-- BEGIN_DOCS:COUNT:procedures -->973<!-- END_DOCS:COUNT:procedures --> end-to-end typed procedures; per-router counts in [api-complete.md](docs/reference/api-complete.md), regenerated by `bun run docs:sync`) composed via `mergeRouters`. All client data access goes through tRPC — never direct Prisma from components.
- **Data**: PostgreSQL + PostGIS, <!-- BEGIN_DOCS:COUNT:models -->342<!-- END_DOCS:COUNT:models --> Prisma models across <!-- BEGIN_DOCS:COUNT:schemaFiles -->21<!-- END_DOCS:COUNT:schemaFiles --> schema files — spatial geometry, immutable financial ledgers, and event spines included.
- **Realtime**: WebSockets served by `ws-backend.mjs` (Socket.IO for ThinkPages at `/ws/thinkpages`, plain `ws` for Market auctions at `/api/market-ws`) and Redis-backed caching + rate limiting with in-memory fallback.
- **Design**: the **Facet** design system (glass materials, physics springs, 4-tier depth) and the **Halo** global overlay (context-aware dynamic action bar, notifications, command palette).

### Realm-First Product Model

IxWorld is one realm among several: every country belongs to a realm (`Country.realmId`) and has an owner (`Country.ownerUserId`). Realms Phase 1 shipped in September 2026 with **Eurth** as the first hosted realm — players claim a realm's nation page (auto-approved when their verified wiki account created it), realm hubs list claimable nations and lore, and cross-country listings and map layers are realm-scoped while the simulation stays global. See [`docs/architecture/realms-framework-spec.md`](docs/architecture/realms-framework-spec.md) and the [Eurth onboarding runbook](docs/systems/realms-eurth-onboarding.md).

### 🏛️ MyCountry — Head of State Command Suite & Simulation

The flagship executive desk (`systems.mycountry` v6, `engines.mycountry` v4 in `src/lib/buildVersion.ts`). Lead your nation through authentic governance systems centered around executive power:

- **The Single Command Surface**: Unified leadership cockpit (`src/components/mycountry/shell/CommandSurface.tsx`) featuring Telemetry Standing Bands (Approval, Stability, CivCap, Vitality Rings), an interactive 7-day IxTime Executive Agenda horizon strip, and Priority Crisis hero spotlights.
- **National Directives & Statecraft Engine**: Declare national policy packages across 3 intensity levels (Measured, Moderate, Extreme). The Statecraft engine (`src/lib/statecraft/`, `src/lib/intent/`) tracks Civil Service Capacity (CivCap), applies clamped stat modifiers, and writes narrative entries to the country's canon feed. Directives are capped at 3 per IxTime week with a cooldown. Committing extreme directives triggers the **Intent ↔ Issues Resistance Rhythm**, spawning political pushback from domestic power brokers. Over-extended CivCap or low government effectiveness raises **Information Fog** warnings on policy previews (numbers are not yet masked into qualitative bands).
- **Grounded National Issues & 4-Branch Briefs**: The dynamic issue engine builds real-time national dilemmas by resolving live PostGIS `ST_Touches` neighboring countries, active cabinet ministers, and trade partners into templates (`{{neighborName}}`, `{{ministerName}}`). Leaders resolve dilemmas via 4 distinct action paths:
  - `Delegate`: Consumes 15 CivCap to pass non-urgent matters to the civil service for 5 in-game days.
  - `Resolve Brief`: Choose an immediate executive option with direct statistical tradeoffs.
  - `Set Cabinet Meeting`: Schedule a meeting in the 7-day Agenda (+7 IxTime days). Meetings are schedule-only for now — outcomes and decisions are not yet recorded.
  - `Make Directive`: Escalate the dilemma directly into the Intent Composer to enact a formal national directive.
- **Politics, Parliament & Hemicycles**: Manage political parties with ideological spectrum ratings (-100 to +100), configure unicameral, bicameral or custom legislatures (10–10,000 seats), table Bills against a fogged whip count, and resolve elections with D'Hondt, First-Past-The-Post (FPTP), or Mixed allocation shown on an SVG hemicycle. Known gap: candidate registration was removed in September, so cron-scheduled follow-up elections currently have no candidates.
- **Macroeconomics & Fiscal Policy**: Model economic output across 20 built-in archetypes (10 modern, 10 historical), set headline tax rates in MyCountry → Economy & Budget → Fiscal Policy (the engine defines 42 atomic tax components, which players don't pick directly), and collect daily Vault dividend yields.
- **Defense & Security (premium)**: Military branches, units and equipment procurement, readiness and security threats. The Defense domain (which also serves `/mycountry/intelligence`) is premium-gated. There is no standalone intelligence dashboard.
- **Diplomacy & NPC AI Reactions**: Establish physical embassies with dedicated specializations (Economic, Cultural, Security, General), sign bilateral treaties, deploy cultural missions, set diplomatic stances (which drift over time), and exchange with NPC nations whose 8 personality traits currently shape cultural-exchange responses. NPC trait drift, crisis events and NPC responses to embassies and treaties are still to be built.
- **Vitality Tracking & Governance Ledger**: Server-side composite vitality scores (Economic, Wellbeing, Diplomatic, Efficiency) and a country event spine surfaced as the owner's canon feed. Not every subsystem writes to the spine yet (diplomacy, defense, elections and meetings bypass it).
- **The Country Builder (v4)**: Launch a nation through a guided wizard (Foundation & Identity $\to$ Government $\to$ Economics $\to$ Preview) or import one from a wiki infobox, with atomic component synergy scoring. The same builder powers edit mode at `/mycountry/editor`.

---

### 🌍 IxWorld — Interactive Maps, Map Editor & Worldgen

A complete cartography, spatial analytics, and procedural world generation suite powered by GPU-accelerated MapLibre GL (`apps.ixworld` v2, `engines.atlas` v5):

- **The Interactive World Map**: High-performance WebGL vector globe and map rendering 7 distinct layers (rivers, lakes, icecaps, sovereign borders, altitudes, climate, and background) with deterministic hypsometry (hydrology rendering strictly above political borders). Features projection switching (Globe, Mercator, Equal Earth) and standalone deployment as **IxMaps** (`maps.ixwiki.com`).
- **Professional In-App Vector Map Editor**: Draw and edit sovereign borders with vertex snapping, paint provinces and administrative regions, place cities and Points of Interest (POIs), route trade networks, attach localized lore stories to territories, and import/export raw vector SVG and GeoJSON cartography.
- **Procedural Realms Engine (Atlas / UPG v2)**: Procedural world generation from pure mathematics on a 100,000-cell Voronoi spatial mesh with 5 Lloyd iterations. Simulates tectonic plate collisions, crust types, Euler rotation vectors, coastal hypsometric damping ($H_{\text{final}} = H_{\text{raw}} \cdot \min(1.0, 0.15 + 0.35 \cdot \text{coastDist})$), Coriolis wind precipitation, steepest-descent river networks, and 12 Trewartha climate biomes smoothed with 4-pass Catmull-Rom spline subdivision ($\tau=0.5$).
- **Spatial Geographic Analyzer & Tier-0 Grounding**: Computes exact geographic metrics directly from terrain mesh geometry (highest peaks, longest rivers, surface areas, biomes) and serves as the single source of truth for all nation borders (`ST_Touches`), neighbor relations, and regional attribute rollups.

---

### 🎴 Vault — Collectible Cards, Economy & Rewards

A living micro-economic and collectible card ecosystem backed by immutable financial ledgers (`apps.ixvault` v2):

- **Four-Pillar Card System (IxCards)**: Collectible cards powered by Force, Wealth, Influence, and Legacy attributes across 5 core card types:
  - `NATION`: Country cards with Force / Wealth / Influence / Legacy stats, re-priced daily against their country's GDP and growth by the `card-values` cron.
  - `LORE`: Generated from WikiOS articles; rarity is suggested from wiki signals (word count, links, edit count, category breadth, images, article age) and admins can override it.
  - `NS_IMPORT`: Synchronized with external NationStates card collections under strict compliance guardrails (streaming image proxying at `/api/proxy-ns-image`, attribution footers, and HMAC-MD5 self-service takedown verification).
  - `SPECIAL` & `COMMUNITY`: Commemorative milestone editions, contest winners, and alliance editions.
- **Pack Openings & 6 Rarity Tiers**: Common → Legendary. Each pack sets its own price, card count and odds; 20 packs are seeded (100–15,000 IxC), including NationStates season packs. The opening sequence peels, flips and reveals each card by rarity.
- **Crafting, Fusion & Card Junking**: Recycle unlocked cards for instant IxCredits. Fusion and evolution recipes exist at `/vault/crafting`, but that page is unlinked and does not work end to end yet (see `docs/systems/cards.md`).
- **Marketplace & P2P Escrow Trading**: Live public auctions with automated bidding and secure peer-to-peer card trading protected by atomic escrow locks.
- **IxCredits (IxC), Achievements & Lorewards**: The platform currency, earned through passive economic dividends, daily streaks, diplomatic scenarios, achievement unlocks and Lorewards (wiki-writing rewards), all recorded in the vault ledger.

---

### 📖 WikiOS — The Living Knowledge Platform

A modern, high-speed Next.js frontend for worldbuilding encyclopedias that headlessly integrates MediaWiki (`apps.wikios` v1, `subSystems.canvas` v1):

- **Instant Client-Side Navigation**: Multi-tier IndexedDB caching, speculative link prefetching, hover previews, sticky tables of contents, and sub-10ms page loads backed by direct MariaDB SQL caching.
- **Canvas Visual Block Editor (PlateJS)**: Dual-mode editing studio supporting visual WYSIWYG block authoring (HTML $\leftrightarrow$ Parsoid $\leftrightarrow$ Wikitext roundtrip) and CodeMirror 6 raw source editing with live preview and template parameter forms.
- **Living Simulation Embeds**: Wiki infoboxes dynamically embed live interactive IxWorld 3D maps and real-time IxTime universe timestamps.
- **Kokoro TTS Audio Narration**: Listen to wiki articles narrated by neural text-to-speech with integrated Halo dynamic audio visualizer and sentence scrubbing.
- **Stash Bookmarks & Media Commons**: Save articles for offline reading in Stash and search the centralized Commons multimedia repository for SVG coats of arms, flags, and historical imagery.

---

### 💬 ThinkPages & ThinkShare — In-Universe Social & Comms

- **ThinkPages**: The in-universe social and intelligence feed (`systems.thinkpages` v2). Features rich post authoring, hashtag exploration, community polling, headline blurb integration, and persistent collaborative ThinkTanks.
- **ThinkShare**: Direct and group messaging at `/messages`, delivered live over the ThinkPages socket. Messages carry a classification level (`PUBLIC` → `TOP_SECRET`); encryption and signature fields exist in the schema but no cryptography is implemented yet.

---

### 🏆 MyLeague & Creative Labs

- **MyLeague & MyClub**: 7-sport simulation engine (soccer, Formula 1, hockey, boxing, basketball, baseball, American football) with seeded play-by-play match engines, club finances, ticket revenue, and player career lifecycles, at `/myleague` and `/myclub`. Boxing currently reuses the soccer match loop.
- **⟨ONOMA⟩ Linguistics Studio (`systems.onoma` v4)**: Procedural phonology engine with Markov name synthesis, formant acoustic visualizers, historical sound shifts, and custom phonetic dictionaries for conlangs.
- **Vexel Heraldry**: Vector blazon generator creating heraldic shields, charges, and national flags adhering to classic tincture rules.



---

## Platform Utilities

| Utility | Description |
|---|---|
| **IxTime** | The universal Temporal Engine operating on mathematical time dilation ($2.0\times$ modern era) with automated drift synchronization. Drives economic ticks, election cycles, card seasons, and wiki timestamps across the ecosystem. |
| **IxnayID** | Unified authentication and identity layer bridging Clerk credentials, XenForo forum profiles, and Discord accounts into a single persona. |
| **Facet** | The signature design system: volumetric glass surfaces, physical spring animations, edge-glare refraction, and a strict 4-tier Z-axis depth hierarchy. |
| **Halo** | Context-aware dynamic action bar providing universal notifications, command palettes, and fast actions across all applications. |

---

## Experimental Labs (`/labs`)

Specialized creative toolkits and simulation sandboxes:

| Laboratory | Route | Status | Focus Area |
|---|---|:---:|---|
| **⟨ONOMA⟩** | `/labs/onoma` | **Active** | Procedural phonology engine: Markov name synthesis, formant acoustic visualizers, historical sound shifts, and custom phonetic dictionaries. |
| **Vexel** | `/labs/vexel` | **Preview** | Structured heraldry composer: vector blazon generation, tincture rules, gallery and revisions. Routable but not in the Labs menu; external ornaments and attach-to-country are unfinished. |
| **Map Pipeline** | `/labs/map-pipeline` | **Active** | Procedural worldgen testbed for testing 100k-cell Voronoi meshes and hypsometric algorithms without touching live data. |
| **Strata & Dynas** | — | *Roadmap* | Planned laboratories for tectonic relief simulation and dynastic genealogy modeling. |

---

## Version Registry & Architecture

IxStates follows an OS-inspired release model where all components read from a central Version Registry ([`src/lib/buildVersion.ts`](src/lib/buildVersion.ts)). See [`docs/reference/revision.md`](docs/reference/revision.md) for full specifications.

<!-- BEGIN_DOCS:VERSION_MATRIX -->
| Capability Domain | Component / Layer | Version / Release | Channel / Granularity |
| :--- | :--- | :---: | :--- |
| **Platform** | **IxStates (Lobster Crosby)** | **1.4.0 "Lobster Crosby"** | **Release Candidate** |
| **Apps** | IxWorld | v2 | Standalone & Embedded Maps Engine |
| | WikiOS | v1 | Headless Wiki & Canvas Architecture |
| | IxVault | v2 | Cards, Credits & Marketplace |
| **Engines** | MyCountry Engine | v4 | Deterministic Nation Simulation |
| | Concord Engine | v2 | Living World Simulation & Events |
| | Atlas Engine | v5 | Spatial Math & Geometry Pipeline |
| **Systems** | MyCountry UI | v6 | 4-Tier Command Architecture |
| | Nation Builder | v4 | Statecraft & Tax Builder Subsystems |
| | ThinkPages | v2 | Social Knowledge & Feed Components |
| | Achievements | v2 | Awards & LoreWards Resync |
| | Stash | v1 | Article Stashing (was LoreStash) |
| | Repository | v2 | Commons Media Explorer |
| | Halo | v6 | Contextual Overlay System |
| | Onoma | v4 | Conlang & Linguistics Studio |
| **Design** | Facet | v4 | Refraction / Depth Design System |
<!-- END_DOCS:VERSION_MATRIX -->

---

## Technology Stack

<!-- BEGIN_DOCS:FRAMEWORK_MATRIX -->
| Package / Layer | Version | Notes |
| :--- | :---: | :--- |
| **Next.js** | 16.3.6 | App Router architecture, Turbopack |
| **React** | 19.2.8 | React 19 concurrent features |
| **TypeScript** | 7.0.2 | Native Go Engine concurrency |
| **Prisma** | 6.19.3 | Multi-file schema partitioning |
| **tRPC** | 11.18.0 | Domain-split modular routers |
| **Tailwind CSS** | 4.3.3 | v4 CSS-first theme configuration |
| **Zod** | 4.4.3 | Schema validation |
| **Oxlint** | 1.80.0 | Flat config, TS 7 native (50-100× faster) |
| **Jest** | 30.4.2 | Unit and characterization suites |
| **Runtime** | Bun 1.4+ | Native concurrency & virtual store |
<!-- END_DOCS:FRAMEWORK_MATRIX -->

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) $\ge 1.4$ (strictly required runtime & package manager)
- Docker (for the bundled PostgreSQL + PostGIS and Redis in `docker-compose.dev.yml`), or your own PostgreSQL with
  PostGIS; Redis is optional in development (rate limiting falls back to in-memory)
- Node.js $\ge 20$

### Quickstart Setup

```bash
# 1. Install dependencies (automatically runs Prisma generation)
bun install

# 2. Configure your local environment (then add your Clerk development keys)
cp .env.example .env.local

# 3. Start PostgreSQL + PostGIS (port 5433) and Redis (6379)
docker compose -f docker-compose.dev.yml up -d

# 4. Build an empty database: PostGIS, schema push, reference-catalog seeds
bun run db:setup

# 5. Start the development server (Turbopack on http://localhost:3000)
bun run dev
```

The database starts with no countries: sign in and create a nation at `/builder`. To make yourself an admin, add
your Clerk user id to `SYSTEM_OWNER_IDS` in `.env.local` and run `bun run set-admin-role`. `bun run dev` runs
`db:push:force` against the local database whenever a `prisma/schema/*.prisma` file changed since the last push
(`SKIP_DB_PUSH=1` skips it).

### Environment Configuration

`.env.example` lists every variable `src/env.ts` declares, and its `DATABASE_URL` and `REDIS_URL` match
`docker-compose.dev.yml`. The ones you usually set in development:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."   # Needed to sign in
CLERK_SECRET_KEY="sk_test_..."                    # Needed to sign in
IXTIME_BOT_URL="http://localhost:3001"            # Optional in dev
```

For WSL2, the maintainers' SSH tunnels and production-dump workflow, see [`docs/operations/local-dev-setup.md`](docs/operations/local-dev-setup.md).

---

## Developer Commands & Quality Gates

### Testing & Verification

```bash
bun run test                   # Run the Jest suites (src/tests and colocated *.test.ts[x])
bun run test:unit              # Fast sub-second parallel unit tests (Bun 1.4 native runner)
bun run test -- <pattern>      # Run tests matching a specific pattern (e.g., bun run test -- ixtime)
bun run test:watch             # Interactive Jest watch mode
```

### Sub-Project Typechecking & Architecture Guard (TypeScript 7.0 Native Engine)

```bash
bun run typecheck              # Sequentially runs all sub-project typechecks via native TS 7.0 engine
bun run typecheck:ui           # Typecheck UI pages, components, and hooks
bun run typecheck:server       # Typecheck backend tRPC routers and services
bun run typecheck:trpc         # Typecheck tRPC router contracts
bun run typecheck:db           # Typecheck Prisma client models and queries
bun run typecheck:scripts      # Typecheck scripts/, proxy.ts, instrumentation.ts and content/
bun run audit:arch             # Architecture guard: file-size ceilings (ratcheted) and no cross-router imports
```

### Code Quality & Database Utilities

```bash
bun run format:write           # Format .ts, .tsx, .js, .jsx and .mdx files with Prettier (CSS is not included)
bun run lint                   # Run oxlint over src/
bun run db:studio              # Launch Prisma Studio GUI
```

---

## Documentation Bible

The repository includes a comprehensive, single-source-of-truth documentation system located in [`docs/`](docs/):

- **[Master Index](docs/README.md)** — Central documentation hub and navigation map
- **[Architecture](docs/architecture/)** — App Router patterns, Facet design system, caching, autosave, and tRPC routing
- **[Systems](docs/systems/)** — Detailed architectural specifications for all platform systems
- **[Operations](docs/operations/)** — Local environment setup, PM2 process management, and VPS deployment workflows
- **[Processes](docs/processes/)** — Modular refactoring guide, testing standards, and git branching protocols
- **[Reference](docs/reference/)** — Revision & versioning specifications, complete tRPC API catalog, and brand design tokens

---

## Contributing & Architectural Standards

1. Contributors branch from `development` and open PRs against it; `rose-garden` is the maintainer's nightly branch
   and `master` is production (see [contributing.md](docs/processes/contributing.md#branches)).
2. Follow the 4-tier modular separation: business logic in `src/lib/`, state in `src/hooks/`, UI in `src/components/`, API contracts in `src/server/`.
3. Keep new files under the `audit:arch` ceilings (700 lines; 500 in `src/hooks`); files already over are recorded
   in `scripts/audit/arch-baseline.json` and may not grow. The check is non-blocking in CI for now.
4. Ensure all unit and integration tests pass via `bun run test` prior to submitting pull requests.
