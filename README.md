# IxStates

### Build a nation. Shape history.

IxStates is a next-generation nation simulation and worldbuilding platform — a persistent, living world where every country's economy, military, diplomacy, geography, and culture are live and interconnected.

[**IxStates 1.3.0 "Ogma"** (Beta) · 90 routers · 1,450+ procedures · 296 data models · 750+ components · 151 test suites]

---

### 🌍 IxWorld
A procedural and handmade world powered by the UPG v2 100,000-cell Voronoi spatial mesh with Catmull-Rom spline subdivision, coastal hypsometry, dynamic border editors, and live-updating territory.

### 🏛️ MyCountry Suite
Unified executive command across Defense & Security, Governance & Politics, Economy & Resources, and Intelligence & Diplomacy. Includes the step-by-step Nation & Economy Builder.

### 🎴 IxVault
Trading cards, crafting recipes, live auctions, peer-to-peer trading, and NationStates collection imports powered by an atomic credit ledger.

### 💬 ThinkPages & ThinkShare
Real-time social knowledge sharing, direct messaging, ThinkTanks, and cross-platform Discord synchronization.

### ⟨ONOMA⟩ Linguistic Studio
Procedural phonological linguistics, Markov name synthesis, formant acoustic visualizers, and custom dictionary sound shifts.

### 🏆 MyLeague
Multi-sport league simulation, team club management, tactical fixtures, and season standings.

### 📖 WikiOS
Next-generation living wiki with a visual canvas editor, dual-pane markdown authoring, and integrated media repository.

---

## Under the Hood

Next.js 16.3 (Turbopack) · React 19.2 · TypeScript 5.9 · Prisma 6.19 · tRPC 11.18 · Tailwind CSS 4.3 · MapLibre GL · PostgreSQL (PostGIS) · Socket.IO · Redis · Jest 30

---

## Platform Overview

- **App Router Architecture**: Next.js 16.3 App Router with 210+ routes across `src/app/`
- **Design System**: **Facet** design system with 4-tier depth hierarchy and native light/dark themes
- **API Surface**: **90 tRPC routers** (domain-split into modular subdirectories via `mergeRouters`), **1,450+ typed procedures**
- **Data Layer**: Prisma 6.19 ORM with **296 models** split across 15 domain schemas on PostgreSQL + PostGIS
- **Architecture Guard**: `bun run audit:arch` enforces a ≤700-line file ceiling, baseline ratcheting, and blocks cross-router coupling
- **Centralized Test Suite**: 151 test suites (1,329+ unit/integration tests) located under `src/tests/`
- **Documentation Bible**: Comprehensive developer documentation hub organized across 9 domains in `docs/`

---

## Feature Pillars & Systems

Each tier carries an independent capability version — see the **[Versioning & Release Architecture](docs/reference/revision.md)** (`docs/reference/revision.md`) and the central Version Registry in [`src/lib/buildVersion.ts`](src/lib/buildVersion.ts).

| Tier | Capability | Systems |
|---|:---:|---|
| **Apps** | v1–v2 | **IxWorld** (maps; standalone: IxMaps), **WikiOS** (living wiki & canvas editor), **IxVault** (cards, packs, marketplace, atomic credits) |
| **Engines** | v2–v4 | **MyCountry** (nation sim core & intent engine), **Concord** (living-world clock, crises & NPCs), **Atlas** (UPG v2 spatial mesh & worldgen) |
| **Core Systems** | v1–v5 | **MyCountry** (flagship executive desk), **Builder** (statecraft & tax wizard), **ThinkPages** (social feed & ThinkShare), **Achievements** (progression & LoreWards), **Halo** (contextual notification bar), **Onoma** (linguistic laboratory) |
| **Design System** | v2 | **Facet** (glass refraction, specular lighting, and physical spring depth) |
| **Platform Utilities** | — | **IxTime** (universal game clock), **IxnayID** (cross-platform identity & SSO) |
| **Navigation Hubs** | — | **Dashboard** (`/dashboard`), **Explore Nations** (`/countries`), **Global Feed** (`/feed`) |

---

## Experimental Labs

Prototypes and specialized worldbuilding studios accessible under `/labs`:

| Lab | Path | Description |
|---|---|---|
| **⟨ONOMA⟩** | `/labs/onoma` | Procedural phonological linguistics, Markov name synthesis, formant acoustic visualizers, and lexicon dictionaries |
| **Vexel** | `/labs/vexel` | Vector heraldry studio, vexillological flag generator, and SVG coat of arms composer |
| **Strata** | `/labs/strata` | Planetary tectonics simulator, hypsometric relief renderer, and elevation matrix generator |
| **Dynas** | `/labs/dynas` | Royal genealogy tracker, dynastic succession trees, and noble house political alliances |
| **Nomora** | `/labs/nomora` | Cultural jurisprudence generator, civic custom codification, and legal precedent engine |

---

## Technology Stack

| Area | Technologies |
|---|---|
| **Runtime & Tooling** | Node.js ≥ 20, Bun ≥ 1.2 (`bun.lock`), Jest 30 |
| **Framework** | Next.js 16.3.0, React 19.2.8, React DOM 19.2.8 |
| **Type System** | TypeScript 5.9.3 with isolated module safety and strict schemas |
| **API & Contracts** | tRPC 11.18.0 with SuperJSON serialization and Clerk auth context |
| **Database & GIS** | Prisma 6.19.3, PostgreSQL 16 + PostGIS (port `5433`) |
| **Styling & Motion** | Tailwind CSS 4.3 (`@theme`), Facet design tokens, Motion / Lucide icons |
| **Mapping & Geospatial** | MapLibre GL JS (Globe & Mercator), Turf.js, Voronoi mesh graphs |
| **Realtime & State** | Socket.IO, Redis (rate limiting & cache), Zustand |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (strictly required package manager)
- Docker & Docker Compose (for PostgreSQL + PostGIS & Redis)
- Node.js 20+

### Standard Development Setup

```bash
# 1. Install dependencies (auto-generates Prisma client via postinstall)
bun install

# 2. Start dev server on http://localhost:3000 (Turbopack)
bun run dev
```

### Environment Configuration

Create a `.env.local.dev` or `.env.local` file in the root directory:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."   # optional in dev (demo mode active)
CLERK_SECRET_KEY="sk_test_..."                    # optional in dev
IXTIME_BOT_URL="http://localhost:3001"            # optional in dev
```

For comprehensive instructions on WSL2 automation, SSH VPS tunneling, and database replication, see [`docs/operations/local-dev-setup.md`](docs/operations/local-dev-setup.md).

---

## Developer Commands & Quality Gates

### Testing & Verification

```bash
bun run test                   # Run all 151 Jest test suites across the repository
bun run test -- <pattern>      # Run single test (e.g. bun run test -- onoma)
bun run test:watch             # Jest interactive watch mode
```

### Typecheck & Architecture Guard

```bash
bun run typecheck              # Sequentially runs all 4 sub-project typechecks
bun run typecheck:ui           # Frontend App Router, components, and hooks (6GB heap)
bun run typecheck:server       # Backend tRPC routers, services, and libraries (6GB heap)
bun run typecheck:trpc         # Core tRPC types and router definitions (4GB heap)
bun run typecheck:db           # Prisma client connections and database helpers (4GB heap)
bun run audit:arch             # Architecture guard: validates ≤700L ceilings & modular splits
```

### Database & Tooling

```bash
bun run db:studio              # Open Prisma Studio GUI
bun run db:sync                # Sync production database snapshot to local dev
bun run format:write           # Format all TypeScript, TSX, and CSS files with Prettier
bun run lint                   # ESLint check with cache
```

---

## Documentation Bible

The repository maintains an overhauled, single-source-of-truth documentation system in the [`docs/`](docs/) directory:

- **[Master Index](docs/README.md)** — Central documentation hub and navigation map
- **[Architecture](docs/architecture/)** — App Router patterns, Facet design system, caching, autosave, and tRPC routing
- **[Systems](docs/systems/)** — Detailed architectural specifications for all 16 platform systems (100% Gold Master status)
- **[Operations](docs/operations/)** — Local environment setup, PM2 process management, and VPS deployment workflows
- **[Processes](docs/processes/)** — Modular refactoring guide, testing standards, and git branching protocols
- **[Reference](docs/reference/)** — Revision & versioning specifications, complete tRPC API catalog, and brand design tokens

---

## Contributing

1. Work branch is `v2`
2. Follow the 4-layer refactoring architecture (`src/lib` logic, `src/hooks` state, `src/components` UI, `src/server` tRPC)
3. Keep all files strictly $\le 700$ lines to satisfy `bun run audit:arch`
4. Verify all tests pass with `bun run test` before opening pull requests
