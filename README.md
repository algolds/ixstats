# IxStates

### The Operating System for Worldbuilding.

[![Version](https://img.shields.io/badge/version-1.3.0%20%22Ogma%22-sky.svg?style=flat-square)](src/lib/buildVersion.ts)
[![Release Channel](https://img.shields.io/badge/channel-Beta-38bdf8.svg?style=flat-square)](src/lib/buildVersion.ts)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
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

Play is two verbs — *See* (pay to look) and *Commit* (pay to act) — spent against three heterogeneous levers: **Capacity** (a *rate*: civil-service bandwidth), **Treasury** (a *stock*: the actual budget), and **Mandate** (a *standing*: legitimacy you risk, which abroad becomes Influence & Reputation). Over-extending Capacity or low government efficiency triggers **Information Fog** — the engine *never lies*, it withholds or qualifies (the *never-lie contract*), masking precise effects behind qualitative risk bands rather than fabricated numbers.

### The Canonical Loop — Action → World Effect → Narrative → Ledger

Every commitment produces a **bounded, clamped** world-state change, an automatic narrative headline on ThinkPages, and an immutable ledger row via the `CountryEventSpine` dispatcher. Stat changes are capped by the 7-tier growth engine, recorded through `VaultTransaction` double-entry ledgers and the `AuditLog`, and surfaced in the **Country Change Log Timeline** — the "Burg's Guardrail" guarantee that no stat can be quietly inflated.

### System Engines

| Engine | Role |
| :--- | :--- |
| **IxTime** (Temporal) | Continuous dilated clock (currently 2.0×) with piecewise-linear epoch math, automated drift correction, and a client-side interpolation store. Governs issue deadlines, elections, budget cycles, match clocks, and wiki timestamps. |
| **Statecraft** (MyCountry Engine v4) | Validates Civil Service Capacity (CivCap) throughput, applies clamped stat modifiers, classifies intent, and spawns resistance issues from 5 domestic power brokers. |
| **Concord** (Living-World, v2) | NPC nation AI (8 traits → 6 behavioral archetypes, naturalistic drift), crisis lifecycle state machine (`BREWING → ACTIVE → ESCALATING → CONTAINED → RESOLVING → RESOLVED`), and event fatigue dampening. |
| **Atlas** (Spatial, v4) | 100,000-cell Voronoi procedural worldgen (tectonic plates, coastal hypsometric damping, Coriolis hydrology, 12 Trewartha biomes). PostGIS `ST_Touches` geometry is the Tier-0 source of truth for borders, neighbors, and regional rollups. |

### Apps & Core Systems

**Apps** — `IxWorld`, `WikiOS`, `IxVault` — are independently versioned user surfaces with their own product lifecycles. **Core Systems** — `MyCountry` (Command Suite), `Builder`, `ThinkPages`, `Achievements`, `Halo`, `Onoma` — are interactive features wired directly into the engines. Each is detailed in the feature sections below.

### API, Data & Platform Infrastructure

- **API**: 90 domain-split **tRPC routers** (~1,450 end-to-end typed procedures) composed via `mergeRouters`. All client data access goes through tRPC — never direct Prisma from components.
- **Data**: PostgreSQL + PostGIS, 296 Prisma models across 15 schema files — spatial geometry, immutable financial ledgers, and event spines included.
- **Realtime**: Socket.IO WebSockets (diplomatic/crisis feeds, markets) and Redis-backed caching + rate limiting with in-memory fallback.
- **Design**: the **Facet** design system (glass materials, physics springs, 4-tier depth) and the **Halo** global overlay (context-aware dynamic action bar, notifications, command palette).

### Realm-First Product Model

IxWorld is architecturally just the `realm="default"` tenant — it shares identical code paths, models, and engines with the multi-tenant **Realms** platform, where external players create isolated realms with procedural geography and sovereign simulation instances. Everything is realm-scoped.

### 🏛️ MyCountry — Head of State Command Suite & Simulation

The flagship executive desk (`MYCOUNTRY_VERSION = 5`, `MYCOUNTRY_ENGINE_VERSION = 4`). Lead your nation through authentic governance systems centered around executive power:

- **The Single Command Surface**: Unified leadership cockpit (`CommandSurface.tsx`) featuring Telemetry Standing Bands (Approval, Stability, CivCap, Vitality Rings), an interactive 7-day IxTime Executive Agenda horizon strip, and Priority Crisis hero spotlights.
- **National Directives & Statecraft Engine**: Declare national policy packages across 3 intensity levels (Measured, Moderate, Extreme). The Statecraft simulation engine validates Civil Service Capacity (CivCap) throughput, applies clamped stat modifiers, and broadcasts narrative bulletins across global feeds. Committing extreme directives triggers the **Intent ↔ Issues Resistance Rhythm**, spawning political pushback from 5 domestic power brokers (Military Junta, Merchant Guilds, Clerisy, Bureaucracy, Industrialists). Over-allocating CivCap activates **Information Fog**, masking exact numeric outcomes into qualitative risk bands.
- **Grounded National Issues & 4-Branch Briefs**: The dynamic issue engine builds real-time national dilemmas by resolving live PostGIS `ST_Touches` neighboring countries, active cabinet ministers, and trade partners into templates (`{{neighborName}}`, `{{ministerName}}`). Leaders resolve dilemmas via 4 distinct action paths:
  - `Delegate`: Consumes 15 CivCap to pass non-urgent matters to the civil service for 5 in-game days.
  - `Resolve Brief`: Choose an immediate executive option with direct statistical tradeoffs.
  - `Set Cabinet Meeting`: Schedule a formal meeting in the 7-day Agenda (+7 IxTime days) to deliberate complex crises without slot cooldowns.
  - `Make Directive`: Escalate the dilemma directly into the Intent Composer to enact a formal national directive.
- **Politics, Parliament & Hemicycles**: Manage political parties with ideological spectrum ratings (-100 to +100), configure unicameral or bicameral legislatures (10–1,000 seats), and run elections using D'Hondt proportional representation, First-Past-The-Post (FPTP), or Mixed allocation. An 11-step simulation algorithm factors GDP growth, campaign charisma, and stability margins into live SVG Parliament Hemicycle seat visualizations and cabinet minister appointments.
- **Macroeconomics, 42-Tax System & Fiscal Policy**: Model economic output across 12+ macro templates (Free Market, Nordic Social Democracy, Developmental State, etc.), 42 distinct tax components across 4 brackets (income, corporate, consumption, wealth), sector composition donuts, and daily Vault dividend yields.
- **Defense Readiness, SDI & Border Threats**: Calibrate readiness postures across 5 military branches (Army, Navy, Air Force, Cyber, Strategic Defense Initiative), procure hardware from military equipment catalogs, track border threat heatmaps, and deploy forces via the Operations Wizard.
- **Diplomacy & NPC AI Reactions**: Establish physical embassies with dedicated specializations (Economic, Cultural, Security, General), sign bilateral treaties, deploy cultural missions, and negotiate with autonomous NPC nations governed by 8 core personality traits and 6 behavioral archetypes with dynamic event fatigue dampening.
- **Vitality Tracking & Governance Ledger**: Server-side composite vitality calculations (Economic, Wellbeing, Diplomatic, Efficiency) and immutable `CountryEventSpine` audit timeline preventing unearned stat inflation ("Burg's Guardrail").
- **The 6-Step Country Builder**: Launch new sovereign states via a guided wizard (Identity $\to$ Government $\to$ Economy $\to$ Demographics $\to$ Fiscal $\to$ Review) with atomic component synergy scoring and MediaWiki infobox auto-import.

---

### 🌍 IxWorld — Interactive Maps, Map Editor & Worldgen

A complete cartography, spatial analytics, and procedural world generation suite powered by GPU-accelerated MapLibre GL (`IXWORLD_VERSION = 1.2`, `ATLAS_ENGINE_VERSION = 4`):

- **The Interactive World Map**: High-performance WebGL vector globe and map rendering 7 distinct layers (rivers, lakes, icecaps, sovereign borders, altitudes, climate, and background) with deterministic hypsometry (hydrology rendering strictly above political borders). Features projection switching (Globe, Mercator, Equal Earth) and standalone deployment as **IxMaps** (`maps.ixwiki.com`).
- **Professional In-App Vector Map Editor**: Draw and edit sovereign borders with vertex snapping, paint provinces and administrative regions, place cities and Points of Interest (POIs), route trade networks, attach localized lore stories to territories, and import/export raw vector SVG and GeoJSON cartography.
- **Procedural Realms Engine (Atlas / UPG v2)**: Procedural world generation from pure mathematics on a 100,000-cell Voronoi spatial mesh with 5 Lloyd iterations. Simulates tectonic plate collisions, crust types, Euler rotation vectors, coastal hypsometric damping ($H_{\text{final}} = H_{\text{raw}} \cdot \min(1.0, 0.15 + 0.35 \cdot \text{coastDist})$), Coriolis wind precipitation, steepest-descent river networks, and 12 Trewartha climate biomes smoothed with 4-pass Catmull-Rom spline subdivision ($\tau=0.5$).
- **Spatial Geographic Analyzer & Tier-0 Grounding**: Computes exact geographic metrics directly from terrain mesh geometry (highest peaks, longest rivers, surface areas, biomes) and serves as the single source of truth for all nation borders (`ST_Touches`), neighbor relations, and regional attribute rollups.

---

### 🎴 Vault — Collectible Cards, Economy & Rewards

A living micro-economic and collectible card ecosystem backed by immutable financial ledgers (`IXVAULT_VERSION = 2`):

- **Four-Pillar Card System (IxCards)**: Collectible cards powered by Force, Wealth, Influence, and Legacy attributes across 5 core card types:
  - `NATION`: Dynamically minted and continuously recalculated from live country telemetry (GDP per capita, military readiness, embassy network, social vitality).
  - `LORE`: Procedurally generated from WikiOS articles, scored on historical depth, reference citations, and inbound cross-links.
  - `NS_IMPORT`: Synchronized with external NationStates card collections under strict compliance guardrails (streaming image proxying at `/api/proxy-ns-image`, attribution footers, and HMAC-MD5 self-service takedown verification).
  - `SPECIAL` & `COMMUNITY`: Commemorative milestone editions, contest winners, and alliance editions.
- **Pack Openings & 6 Rarity Tiers**: 6 rarity tiers (Common 65%, Uncommon 25%, Rare 7%, Ultra Rare 2%, Epic 0.9%, Legendary 0.1%) with particle shatter animations and rarity-specific audio reveals across 6 pack tiers (Basic, Premium, Elite, Themed, Seasonal, Event).
- **Crafting, Fusion & Card Junking**: Combine duplicate cards into higher rarities via fusion recipes, upgrade cards directly through evolution, or recycle unlocked cards for instant IxCredits.
- **Marketplace & P2P Escrow Trading**: Live public auctions with automated bidding and secure peer-to-peer card trading protected by atomic escrow locks.
- **IxCredits (IxC) & Achievements**: The universal platform currency earned through passive economic dividends, daily streaks, diplomatic resolutions, and achievements (LoreWards) recorded on double-entry transaction ledgers.

---

### 📖 WikiOS — The Living Knowledge Platform

A modern, high-speed Next.js frontend for worldbuilding encyclopedias that headlessly integrates MediaWiki (`WIKIOS_VERSION = 1`, `CANVAS_VERSION = 1`):

- **Instant Client-Side Navigation**: Multi-tier IndexedDB caching, speculative link prefetching, hover previews, sticky tables of contents, and sub-10ms page loads backed by direct MariaDB SQL caching.
- **Canvas Visual Block Editor (PlateJS)**: Dual-mode editing studio supporting visual WYSIWYG block authoring (HTML $\leftrightarrow$ Parsoid $\leftrightarrow$ Wikitext roundtrip) and CodeMirror 6 raw source editing with live preview and template parameter forms.
- **Living Simulation Embeds**: Wiki infoboxes dynamically embed live interactive IxWorld 3D maps and real-time IxTime universe timestamps.
- **Kokoro TTS Audio Narration**: Listen to wiki articles narrated by neural text-to-speech with integrated Halo dynamic audio visualizer and sentence scrubbing.
- **Stash Bookmarks & Media Commons**: Save articles for offline reading in Stash and search the centralized Commons multimedia repository for SVG coats of arms, flags, and historical imagery.

---

### 💬 ThinkPages & ThinkShare — In-Universe Social & Comms

- **ThinkPages**: The in-universe social and intelligence feed (`THINKPAGES_VERSION = 2`). Features rich post authoring, hashtag exploration, community polling, headline blurb integration, and persistent collaborative ThinkTanks.
- **ThinkShare**: Unified, cross-platform encrypted messaging powering personal DMs, diplomatic communiqués, and secure group channels across 5 classification clearance levels (`PUBLIC`, `RESTRICTED`, `CONFIDENTIAL`, `SECRET`, `TOP_SECRET`) with digital signatures.

---

### 🏆 MyLeague & Creative Labs

- **MyLeague & MyClub**: 7-sport simulation engine (soccer, Formula 1, hockey, boxing, basketball, baseball, American football) with seeded play-by-play match engines, club finances, ticket revenue, and Markov-chain player career lifecycles.
- **⟨ONOMA⟩ Linguistics Studio (`ONOMA_VERSION = 4`)**: Procedural phonology engine with Markov name synthesis, formant acoustic visualizers, historical sound shifts, and custom phonetic dictionaries for conlangs.
- **Vexel Heraldry**: Vector blazon generator creating heraldic shields, charges, and national flags adhering to classic tincture rules.
- **Simulation Sandbox**: Interactive formula tester and verification suite for economic, demographic, and tax algorithms.


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
| **Vexel** | `/labs/vexel` | **Active** | Structured heraldry composer: vector blazon generation, tincture rules, and deterministic charge composition from Commons assets. |
| **Map Pipeline** | `/labs/map-pipeline` | **Active** | Procedural worldgen testbed for testing 100k-cell Voronoi meshes and hypsometric algorithms without touching live data. |
| **Design Bible** | `/labs/design-bible` | **Active** | Interactive design token and component showcase for the Facet design system. |
| **Sandbox** | `/labs/sandbox` | **Active** | Interactive formula tester and verification suite for economic and demographic simulation algorithms. |
| **Strata & Dynas** | — | *Roadmap* | Planned laboratories for tectonic relief simulation and dynastic genealogy modeling. |

---

## Version Registry & Architecture

IxStates follows an OS-inspired release model where all components read from a central Version Registry ([`src/lib/buildVersion.ts`](src/lib/buildVersion.ts)). See [`docs/reference/revision.md`](docs/reference/revision.md) for full specifications.

| Layer | Capability Tier | Managed Systems & Applications |
|---|:---:|---|
| **Platform** | `1.3.0` ("Ogma", Beta) | Core runtime, API gateway, global middleware, unified identity |
| **Apps** | v1–v2 | **IxWorld** (v1.2), **WikiOS** (v1.0), **IxVault** (v2.0) |
| **Engines** | v2–v4 | **MyCountry Engine** (v4), **Concord** (v2), **Atlas** (v4) |
| **Core Systems** | v1–v5 | **MyCountry** (v5), **Builder** (v3), **ThinkPages** (v2), **Achievements** (v2), **Halo** (v4), **Onoma** (v4) |
| **Design** | v2 | **Facet** (v2.0 design tokens, glass materials, physics springs) |

---

## Technology Stack

```
Frontend:   Next.js 16.3 (Turbopack) · React 19.2 · Tailwind CSS 4.3 · MapLibre GL · Motion
Backend:    tRPC 11.18 · PostgreSQL 16 + PostGIS · Prisma 6.19 · Redis · Socket.IO · Express 5
Tooling:    Bun 1.2+ · TypeScript 5.9 · Jest 30 · ESLint 10 · Prettier
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) $\ge 1.2$ (strictly required package manager)
- Docker & Docker Compose (for PostgreSQL + PostGIS & Redis)
- Node.js $\ge 20$

### Quickstart Setup

```bash
# 1. Install dependencies (automatically runs Prisma generation)
bun install

# 2. Configure your local environment
cp .env.example .env.local.dev

# 3. Start the development server (Turbopack on http://localhost:3000)
bun run dev
```

### Environment Configuration

Configure `.env.local.dev` with your local database and service endpoints:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."   # Optional in dev (demo auth active)
CLERK_SECRET_KEY="sk_test_..."                    # Optional in dev
IXTIME_BOT_URL="http://localhost:3001"            # Optional in dev
```

For comprehensive instructions on WSL2 automation, SSH VPS tunneling, and database replication, see [`docs/operations/local-dev-setup.md`](docs/operations/local-dev-setup.md).

---

## Developer Commands & Quality Gates

### Testing & Verification

```bash
bun run test                   # Execute all 153 Jest test suites across the repository
bun run test -- <pattern>      # Run tests matching a specific pattern (e.g., bun run test -- ixtime)
bun run test:watch             # Interactive Jest watch mode
```

### Sub-Project Typechecking & Architecture Guard

```bash
bun run typecheck              # Sequentially runs all sub-project typechecks with safe heap bounds
bun run typecheck:ui           # Typecheck UI pages, components, and hooks (6GB heap limit)
bun run typecheck:server       # Typecheck backend tRPC routers and services (6GB heap limit)
bun run typecheck:trpc         # Typecheck tRPC router contracts (4GB heap limit)
bun run typecheck:db           # Typecheck Prisma client models and queries (4GB heap limit)
bun run audit:arch             # Architecture guard: enforces ≤700L ceilings & modular boundaries
```

### Code Quality & Database Utilities

```bash
bun run format:write           # Format TypeScript, TSX, and CSS with Prettier + Tailwind plugin
bun run lint                   # Run ESLint with cache
bun run db:studio              # Launch Prisma Studio GUI
bun run db:sync                # Sync production database snapshot to local dev
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

1. Active work branch is `v2`.
2. Follow the 4-tier modular separation: business logic in `src/lib/`, state in `src/hooks/`, UI in `src/components/`, API contracts in `src/server/`.
3. Keep all files strictly $\le 700$ lines to satisfy `bun run audit:arch`.
4. Ensure all unit and integration tests pass via `bun run test` prior to submitting pull requests.
