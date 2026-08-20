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

## What IxStates Actually Is

Two perspectives. One persistent, living world.

### 🏛️ For the Worldbuilder — A Nation That Breathes

In traditional worldbuilding, lore is frozen in time. Numbers stay static until you manually edit them, and your civilization stops existing the moment you close the tab.

**IxStates breaks the frozen lore barrier:**

- **Continuous Simulation**: Design your country once in the **Builder**. From that moment forward, its economy hums, tax dividends compound, populations shift across provinces, and international trade balances evolve automatically.
- **The World Clock (IxTime)**: The world advances on a configurable and dynamic timeline. Crises emerge, elections resolve, sports seasons advance, and articles happen organically and in realtime.
- **Geography Is King**: Your nation is not an arbitrary shape on a flat image. It occupies real, physics-driven terrain on a 100,000-cell Voronoi mesh with tectonic elevations, Coriolis-modeled river networks, and 12 distinct climate biomes.
- **Statecraft That Pushes Back**: You don’t just adjust stat sliders. You declare national **Directives**. Your Civil Service Capacity (CivCap) and domestic power brokers react—pushing back against radical mandates with legislative gridlock, economic friction, or civil unrest.

### 💻 For the Engineer — An Integrated Simulation Micro-OS

IxStates is engineered as a low-latency, modular micro-OS built for high-throughput computation and zero-drift persistence.

- **Layered OS Architecture**:
  - **Apps** (`IxWorld`, `WikiOS`, `IxVault`): Independent, high-polish user surfaces with dedicated product lifecycles.
  - **Engines** (`MyCountry Engine`, `Concord`, `Atlas`): Headless simulation cores powering macroeconomics, living-world crises, NPC diplomacy, and procedural Voronoi spatial mathematics.
  - **Core Systems** (`Command Surface`, `Builder`, `ThinkPages`, `Achievements`, `Halo`, `Onoma`): Interactive feature systems wired directly into the headless engines.
- **Architectural Rigor**:
  - **90 Domain-Split tRPC Routers**: Over 1,450 end-to-end typed procedures composed seamlessly via `mergeRouters`.
  - **PostgreSQL + PostGIS Foundation**: 296 Prisma schemas powering atomic financial ledgers, spatial operations (`ST_Touches`), and immutable event logs (`CountryEventSpine`).
  - **Automated Architecture Guard**: Continuous CI enforcement (`bun run audit:arch`) guaranteeing strict file ceilings ($\le 700$ lines) and preventing circular cross-router coupling.

---

## Core Feature Pillars

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │                        IXSTATES                        │
                                  │         The Operating System for Worldbuilding         │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
                    ┌─────────────────────────┬───────────────┴───────────────┬─────────────────────────┐
                    ▼                         ▼                               ▼                         ▼
         ┌────────────────────┐    ┌────────────────────┐          ┌────────────────────┐    ┌────────────────────┐
         │      IXWORLD       │    │     MYCOUNTRY      │          │      WIKIOS        │    │      IXVAULT       │
         │  Procedural Maps   │    │  Statecraft & Sim  │          │   Living Wiki &    │    │  Cards, Economy &  │
         │  & Spatial Mesh    │    │  Executive Suite   │          │   Canvas Editor    │    │    Marketplace     │
         └────────────────────┘    └────────────────────┘          └────────────────────┘    └────────────────────┘
```

### 🌍 IxWorld — The Map, The Mesh, and The Editor

IxWorld unifies cartography, procedural generation, and spatial analytics into a single GPU-accelerated rendering stack (MapLibre GL JS):

- **The Canonical World Map**: Converts hand-authored vector cartography through an automated pipeline (`svg-parser` $\to$ affine WGS84 transform $\to$ topology locking $\to$ GeoJSON compression) into seven live layers (rivers, lakes, icecaps, political borders, altitudes, climate, and background). Hydrology and topology render with deterministic layering above sovereign borders. Deployable standalone as **IxMaps** (`maps.ixwiki.com`).
- **Procedural Realms Engine (Atlas / UPG v2)**: World generation from pure mathematics. Simulates tectonic plate collisions, coastal hypsometric damping, Coriolis precipitation, and 12-biome Trewartha climate classification across 100,000 Voronoi cells, smoothed with 4-pass Catmull-Rom spline subdivision ($\tau=0.5$).
- **In-App Map Editor**: Professional in-browser cartography suite featuring contextual tools (vector border editing with vertex snapping, province population painters, POI placement, and trade route routing) plus a spatial analyzer that computes actual geographic records (tallest peak, longest river, primary biome) directly from terrain mesh geometry.

---

### 🏛️ MyCountry Suite — The Executive Desk

A single, unified Command Surface replaces fragmented menus with an authentic executive desk centered around **Directives**:

- **Directive-Driven Statecraft**: Enact Measured, Moderate, or Extreme directives. The Statecraft engine validates Civil Service Capacity (CivCap), factors in locked levers, applies clamped economic modifiers, and publishes news bulletins across the global feed. Extreme measures trigger resistance events from power broker factions.
- **Four Integrated Governance Dashboards**:
  - **Politics & Power Brokers**: Manage parliamentary seat allocation, candidate registration, polling trends, and five influential power brokers (Military Junta, Merchant Guilds, Clerisy, Bureaucracy, Industrialists).
  - **Macroeconomics & Fiscal Policy**: Real-time GDP calculation, sector composition, tax bracket modeling with live dividend projections, and labor market telemetry.
  - **Defense & Strategic Security**: Military readiness ratings, equipment procurement pipelines, Strategic Defense Initiative postures, and border threat matrices.
  - **Diplomacy & Intelligence**: Embassy networks, bilateral treaties, cultural missions, and real-time risk briefings synthesized from global geopolitical signals.
- **The Six-Step Country Builder**: Launch new nations via an intuitive wizard (Identity $\to$ Government $\to$ Economy $\to$ Demographics $\to$ Fiscal $\to$ Review) featuring atomic component synergy scoring, MediaWiki infobox auto-import, and autosaving drafts.
- **Concord Living-World Engine**: Drives autonomous NPC reactions, dynamic crises, and time progression. Every stat change is immutably recorded to the `CountryEventSpine` ledger.

---

### 📖 WikiOS — The Living Wiki

WikiOS replaces legacy MediaWiki interfaces with a high-performance, reactive Next.js frontend while retaining MediaWiki headlessly for template and wikitext resolution:

- **Instant Client-Side Navigation**: Multi-tier IndexedDB caching, speculative link prefetching, hover previews, sticky tables of contents, and zero full-page reloads.
- **Living Simulation Embeds**: Wiki infoboxes embed interactive, live-rendered IxWorld 3D maps and dynamic IxTime date tooltips tied to the active universe timeline.
- **Dual-Mode Editing Studio**: Seamlessly switch between a modern visual WYSIWYG editor (HTML $\leftrightarrow$ Parsoid $\leftrightarrow$ Wikitext roundtrip) and a CodeMirror 6 source editor with real-time preview and template parameter forms.
- **Resilient Four-Tier Waterfall**: Read queries resolve through a local Postgres shadow copy ($<5\text{ms}$), direct MariaDB queries ($\sim 38\text{ms}$), MediaWiki Action API fallback ($\sim 400\text{ms}$), and stale cache guarantees—ensuring 100% uptime even during upstream maintenance.

---

### 🎴 IxVault — Cards, Credits, and Rewards Economy

A complete collectible card and micro-economic system backed by immutable financial ledgers:

- **IxCards (Four Pillars System)**: Trading cards powered by Force, Wealth, Influence, and Legacy attributes across five distinct types:
  - `NATION`: Auto-generated and continuously recalculated from live country telemetry.
  - `LORE`: Procedurally minted from WikiOS articles, scored on historical depth and inbound citation volume.
  - `NS_IMPORT`: Synchronized with external NationStates card dumps under strict compliance guardrails (zero local image storage, live proxying, and self-service takedown checksums).
  - `SPECIAL` & `COMMUNITY`: Commemorative event and contest editions.
  - *Mechanics*: 6 rarity tiers (Common $\to$ Legendary), 6 pack varieties, card fusion, evolution upgrades, and atomic card junking.
- **IxCredits (IxC)**: The universal platform currency earned through passive economic dividends, active gameplay streaks, diplomatic resolution, and community authorship. Every transaction is immutably ledgered.
- **Marketplace & Trade Escrow**: Live auctions with automated bidding and secure peer-to-peer card trading with escrow protection.
- **Achievements & LoreWards**: Dual-track recognition rewarding economic milestones, military feats, and deep wiki lore authorship with badges, profile medals, and direct credit payouts.

---

### 💬 ThinkPages & ThinkShare — The Social Backbone

- **ThinkPages**: The in-universe social and intelligence feed. Features rich post authoring, hashtag exploration, community polling, and persistent ThinkTanks (collaborative research groups). Cached read feeds deliver sub-$2\text{ms}$ response times with instantaneous write invalidation.
- **ThinkShare**: Unified, cross-platform encrypted messaging powering personal DMs, diplomatic communiqués, and secure group channels with 5 security classification levels (Public $\to$ Top Secret) and digital signatures.

---

### 🏆 MyLeague & MyClub — Sports Simulation

A full-featured sports simulation engine covering soccer, Formula 1, hockey, boxing, basketball, baseball, and American football:

- **Seeded Match Resolution**: Computes multi-vector tactical matchups and generates granular play-by-play events (goals, penalties, injuries).
- **Career Lifecycles**: Simulates player development from Rookie $\to$ Prime $\to$ Veteran $\to$ Retired using Markov chains.
- **Economic Integration**: Ticket revenue, sponsorship contracts, and franchise claims tie directly into club budgets and national IxCredit sinks.

---

## Platform Utilities

| Utility | Description |
|---|---|
| **IxTime** | The universal platform clock operating on fixed multipliers against real time. Automatically synchronizes economic ticks, election cycles, card seasons, and wiki timestamps across the ecosystem. |
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
bun run test                   # Execute all 151 Jest test suites across the repository
bun run test -- <pattern>      # Run tests matching a specific pattern (e.g., bun run test -- onoma)
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
