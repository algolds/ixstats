# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status & Context (January 2026)

### ⚠️ **v2 Migration (January 2026)** ⚠️
- **Maps System Rebuilt**: IxWorld maps rebuilt from scratch with MapLibre GL JS (replaced old Leaflet/Martin tile server). Deployed standalone at maps.ixwiki.com and embedded at `/maps`.
- **Major Framework Upgrades**: Next.js 15 -> 16.1.3, React 18 -> 19.1.3, Prisma 6.19, Zod 4, Express 5, Jest 30
- **Middleware Renamed**: `src/middleware.ts` -> `src/proxy.ts` (Clerk middleware + CSP + security headers)
- **Active Branch**: `v2`

### 🎯 **Current Maturity: 100% Complete (Grade A+ - v1.42 Release)** ✅
IxStats is a production-ready economic simulation platform with comprehensive V1 compliance audit completed, all critical systems operational, extensive documentation coverage (106 atomic components documented), organized codebase structure, and **100% hardcoded data migration complete** (14,677 lines migrated to database).

#### ✅ **Production-Ready Systems (100%)**
- **Core Infrastructure**: Next.js 16.1.3, React 19.1.3, Prisma ORM (206 models), **61 tRPC routers** (927 endpoints), IxTime synchronization
- **Content Management System**: **20 admin interfaces**, 80+ reference data endpoints, 750+ seeded records, 100% dynamic
- **NPC AI System**: 8 personality traits, 6 archetypes, behavioral prediction, personality drift algorithm
- **Crisis Management**: Dynamic crisis events (natural disasters, economic crises, diplomatic incidents) with player responses
- **Security & Authentication**: Clerk integration, 13 security fixes, 8-layer middleware, audit logging, Redis rate limiting
- **Design System**: Glass physics framework with 100+ UI components, 645+ total components
- **Economic Engine**: Tier-based modeling, real-time calculations, historical tracking, comprehensive formulas documented
- **Database**: 206 models, 10+ migrations applied, PostgreSQL with PostGIS integration
- **External Integrations**: IxWiki API, Discord webhooks, flag services, monitoring systems

#### ✅ **Feature Complete (90-95%)**
- **Intelligence System** (95%): Live data wiring complete, executive dashboards operational
- **Government Systems** (90%): Atomic + traditional systems fully integrated
- **Economic Modeling** (95%): Real calculations, projections, historical tracking active
- **Diplomatic Systems** (90%): Embassy network, missions, cultural exchanges complete
- **Social Platform** (85%): ThinkPages, ThinkShare, ThinkTanks, collaborative docs

#### 📋 **Minor Enhancements (v1.1 Roadmap)**
- Budget system UI integration (calculations complete)
- Advanced mobile optimizations and PWA features
- Additional ECI/SDI admin interfaces polish
- Enhanced monitoring and analytics dashboards

> See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for detailed feature matrix

### 🏗️ **Architecture Overview**
- **Framework**: Next.js 16.1.3 with App Router, React 19.1.3, TypeScript 5.8, tRPC 11.4
- **Database**: PostgreSQL (dev + prod) with Prisma 6.19 ORM, PostGIS
- **UI System**: Tailwind CSS v4 with custom glass physics design framework
- **Middleware**: `src/proxy.ts` - Clerk auth + CSP + security headers (NOT `middleware.ts`)
- **Time System**: Custom IxTime (2x speed) synchronized with Discord bot
- **Economic Engine**: Tier-based growth modeling with sophisticated calculations
- **Dev Server**: Webpack mode (Turbopack disabled for stability), 4GB memory limit

## Design Practices

### Unified Design Framework
- **Glass Physics System**: Use hierarchical depth levels (parent/child/interactive/modal)
- **Color Theming**: Section-specific themes (MyCountry=Gold, Global=Blue, ECI=Indigo, SDI=Red)
- **Component Architecture**: Follow atomic design with glass physics integration
- **Responsive Design**: Mobile-first with desktop enhancements
- Reference `/docs/DESIGN_SYSTEM.md` for complete specifications

### Styling Guidelines
- **Tailwind v4**: All styling must use Tailwind CSS v4 syntax
- **Glass Effects**: Use predefined glass hierarchy classes for depth consistency
- **Theme Variables**: Use CSS custom properties for dynamic color theming
- **Accessibility**: Maintain WCAG 2.1 AA compliance with proper focus indicators

## Workflow & Codebase

### Development Priorities
1. **System Maintenance**: Ongoing performance optimization and security updates
2. **Feature Enhancement**: User experience improvements and accessibility enhancements
3. **Documentation**: Keeping system documentation current with implementation status
4. **Performance**: Continue React optimization patterns and database query optimization

### Code Quality Standards
- **TypeScript**: Maintain TypeScript coverage (do NOT run global type checks - see constraints section)
- **React Patterns**: Use React.memo, useMemo, useCallback for performance optimization
- **Error Handling**: Implement defensive programming with comprehensive error boundaries
- **API Integration**: Prefer tRPC APIs over direct database access in components

### System Architecture Status
**V1 Compliance Audit Completed:**
- ✅ **Security**: 13 critical fixes (9 endpoint hardening + 4 production guards)
- ✅ **Data Wiring**: 62.9% live integration (304 active endpoints), all critical paths operational
- ✅ **Codebase**: Zero technical debt remaining
- ✅ **Production Guards**: Demo/preview systems disabled in production
- ✅ **Audit Logging**: High-security events persisted to database
- ✅ **Rate Limiting**: Redis-based with in-memory fallback implemented

**Production-Ready Systems:**
- Core platform infrastructure with Next.js 16.1.3, Prisma ORM (206 models), and **61 tRPC routers** (927 endpoints)
- Authentication system with 8-layer middleware and database audit logging
- Economic calculation engine with tier-based modeling and historical tracking (**all formulas documented** with examples)
- NPC AI personality system with 8 traits, 6 archetypes, behavioral prediction
- Crisis events system with dynamic scenarios and player response options
- Glass physics design system with 100+ components (645+ total components)
- **20 admin interfaces** for complete content management
- External API integrations (IxWiki, Discord webhooks, flag services) fully operational
- Production optimizations (compression, caching, security headers, monitoring)

**Feature Complete (v1.0):**
- Intelligence system with live data wiring (95% complete)
- Atomic + traditional government systems fully integrated (90% complete)
- Diplomatic systems with embassy network and missions (90% complete)
- Social platform (ThinkPages, ThinkShare, ThinkTanks) operational (85% complete)

### Key File Locations
**Middleware & Security:**
- Middleware (Clerk + CSP + headers): `/src/proxy.ts` (NOT middleware.ts)
- CSP Configuration: `generateCSP()` function in `/src/proxy.ts`
- System owner constants: `/src/lib/system-owner-constants.ts`
- Production optimizations: `/src/lib/production-optimizations.ts`

**Intelligence System:**
- Components: `/src/app/mycountry/components/`
- Types: `/src/app/mycountry/types/intelligence.ts`
- Data Transformers: `/src/app/mycountry/utils/dataTransformers.ts`

**API Layer:**
- tRPC Routers: `/src/server/api/routers/`
- Database Schema: `/prisma/schema.prisma`

**Design System:**
- UI Components: `/src/components/ui/`
- Design Documentation: `/docs/DESIGN_SYSTEM.md`

**Maps & IxWorld:**
- Map config: `/src/lib/map-config.ts`
- Core map component: `/src/components/maps/core/IxWorldMap.tsx`
- Geo router: `/src/server/api/routers/geo.ts`
- Procedural generation: `/src/lib/procedural/`
- Deploy script: `/scripts/deploy-ixworld.sh`
- IxWorld PM2 config: `/ecosystem.ixworld.config.cjs`

**Configuration:**
- Next.js config: `/next.config.js`
- Dev startup: `/start-development.sh`
- Production startup: `/start-production.sh`
- PM2 config: `/ecosystem.config.cjs`

### Testing & Validation
- Run `npm run lint` for linting (ESLint with cache)
- Use `npm run dev` for development server (Webpack mode, port 3000)
- Database operations: `npm run db:setup` for initialization
- **DO NOT** run `npm run typecheck:full` or `tsc --noEmit` globally - see TypeScript section below

### Performance Considerations
- **Component Optimization**: Already implemented React.memo patterns, maintain consistency
- **Bundle Size**: Monitor imports and use dynamic imports for large components
- **Database Queries**: Use tRPC caching and optimize query patterns
- **Glass Effects**: GPU acceleration already implemented for glass physics

## Important Implementation Notes

### Current Architecture Strengths
- **Exceptional TypeScript Coverage**: 20+ intelligence interfaces with comprehensive type safety
- **Professional UI/UX**: Advanced glass physics system with contextual intelligence
- **Solid Data Foundation**: Comprehensive Prisma schema with economic modeling
- **Performance Optimized**: React best practices with memoization and error boundaries

### Key Documentation Resources (v1.42)
- **[docs/README.md](./docs/README.md)** - Documentation hub and navigation guide
- **[docs/DOCUMENTATION_INDEX.md](./docs/DOCUMENTATION_INDEX.md)** - Complete documentation index
- **[docs/reference/api-complete.md](./docs/reference/api-complete.md)** - Complete tRPC API catalog (**927 endpoints across 61 routers**)
- **[docs/reference/edge-cases.md](./docs/reference/edge-cases.md)** - **NEW:** Comprehensive edge case handling and error scenarios
- **[docs/systems/calculations.md](./docs/systems/calculations.md)** - **NEW:** All economic formulas with step-by-step examples
- **[docs/systems/npc-ai.md](./docs/systems/npc-ai.md)** - **NEW:** Complete NPC personality system documentation
- **[docs/systems/crisis-events.md](./docs/systems/crisis-events.md)** - **NEW:** Crisis management system guide
- **[docs/systems/admin-cms.md](./docs/systems/admin-cms.md)** - **NEW:** All 20 admin interfaces documented
- **[docs/reference/database.md](./docs/reference/database.md)** - Prisma schema and data models (206 models)
- **[docs/systems/](./docs/systems/)** - System-specific guides (MyCountry, Intelligence, Diplomacy, Economy, etc.)
- **[docs/SYNERGY_REFERENCE.md](./docs/SYNERGY_REFERENCE.md)** - Government component synergy system
- **[docs/RATE_LIMITING_GUIDE.md](./docs/RATE_LIMITING_GUIDE.md)** - Rate limiting configuration and Redis setup
- **[docs/USER_PROFILE_UTILS_USAGE.md](./docs/USER_PROFILE_UTILS_USAGE.md)** - User profile and display name utilities
- **[docs/TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md](./docs/TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md)** - Complete tax system reference
- **[docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)** - Comprehensive API documentation

### MyCountry Architecture (v1.4.2 - November 2025)

**Clear Separation of Concerns Achieved:**

The MyCountry system now follows a strict separation principle:

| Page | Purpose | Content Type | Implementation |
|------|---------|--------------|----------------|
| **Overview** | Monitor | Real-time snapshot | Current vitals only |
| **Executive** | Command | Decision-making | Action queues |
| **Diplomacy** | Interact | Social gameplay | 100% player interactions |
| **Intelligence** | Analyze | Data visualization | 100% analytics |
| **Defense** | Secure | Military ops | Force management |
| **Politics** | Govern | Electoral systems | Elections, parties, legislature |

**Key Components:**
- **Diplomacy Page** (`/mycountry/diplomacy`):
  - Network tab: Embassy establishment/management
  - Missions tab: Mission planning/execution
  - Communications tab: Direct messaging
  - Events tab: Scenario responses with impact preview (v1.4.4)
  - NPC Intel tab: Personality viewer (planned)

- **Intelligence Page** (`/mycountry/intelligence`):
  - Dashboard tab: Executive insights
  - Economic tab: GDP/sector analytics
  - Diplomatic tab: Relationship trends/network visualization (v1.4.3)
  - Policy tab: Effectiveness analysis/simulation (v1.4.5)
  - Forecasting tab: Predictive models
  - Settings tab: Alert configuration

**Architecture Files:**
- `/mycountry-architecture.md` - Complete architecture specification
- `/docs/systems/mycountry.md` - System documentation
- `/src/app/mycountry/diplomacy/` - Diplomacy page implementation
- `/src/app/mycountry/intelligence/` - Intelligence page implementation

**Phase 2 Implementation Complete (v1.4.3-1.4.4):**
- ✅ DiplomaticAnalytics component (5 interactive chart tabs)
- ✅ DiplomaticEventsHub component (event management system)
- ✅ Clean separation enforced (removed DiplomaticIntelligenceHub from Diplomacy)

### Single-Page Router Architecture (February 2026)

MyCountry, Vault, ThinkPages, and Dashboard all use a **single-page router pattern** for instant navigation:

**Pattern:**
- A central `*Router.tsx` component manages section state via `useState`
- URL sync via `window.history.pushState()` (no Next.js route transitions)
- All sub-page `page.tsx` files render the same Router component
- `popstate` listener handles browser back/forward

**Implementations:**
| Router | Location | Sections |
|--------|----------|----------|
| `MyCountryRouter` | `src/components/mycountry/MyCountryRouter.tsx` | Overview, Executive, Diplomacy, Intelligence, Defense, Politics |
| `VaultRouter` | `src/components/vault/VaultRouter.tsx` | Dashboard, Cards, Acquire, Create, Import |
| `ThinkPagesRouter` | `src/components/thinkpages/ThinkPagesRouter.tsx` | Feed, ThinkTanks, ThinkShare |
| `DashboardRouter` | `src/components/dashboard/DashboardRouter.tsx` | Main, Diplomacy, Feed, Trends |

**Supporting Infrastructure:**
- `*SidebarNav` - Dual-mode navigation (controlled via props or uncontrolled via pathname)
- `*SidebarLayout` - Shared responsive grid (`lg:grid-cols-4`)
- Sidebar widgets: `ExecutiveSidebarWidget`, `DiplomacySidebarWidget`, `DefenseSidebarWidget`
- `BaseMetricDetailsModal` with 4-tab drill-down (Overview, Trends, Comparison, Details)

### New Systems (v2 - January-February 2026)

**Elections & Political Parties** (`src/server/api/routers/elections.ts`):
- D'Hondt proportional representation and FPTP seat allocation
- Political party management, legislature configuration, election simulation
- Components in `src/components/executive/politics/`

**Card Image Management** (`src/server/api/routers/cardImages.ts`):
- Background image customization for 13 card types
- Per-country custom or preset images
- Components: `CardBackgroundImage`, `CardImageUploadModal` in `src/components/mycountry/primitives/`

**Defense Operations** (`src/components/defense/operations/`):
- `ActiveOperations`, `DeploymentWizard`, `PvPConflictPanel`

**Alliance & Foreign Policy Systems**:
- Alliances: `src/components/diplomacy/alliances/`
- Foreign Policy: `src/components/diplomacy/foreign-policy/`

**Dev Country View** (`src/context/DevCountryViewContext.tsx`):
- Development tool for system owners to view other countries' data

**Memory Configuration** (`src/lib/dev-memory-config.ts`):
- Environment-aware memory limits to prevent OOM crashes in development

**News Auto-Generation** (`src/lib/diplomatic-news-generator.ts`):
- Auto-generates ThinkPages news posts for diplomatic events

### Maps & IxWorld System (v2 — January-March 2026)

**IxWorld** is the interactive world map, deployed standalone at `maps.ixwiki.com` and embedded within IxStats at `/maps`. Built with MapLibre GL JS (replacing the v1 Leaflet system).

**Key Files:**
- Components: `src/components/maps/` (core/, editor/, widgets/ — 27 files)
- Hooks: `src/hooks/useMapData.ts`, `useBorderEditor.ts`, `useMapEditor.ts`, `useMapPinInfo.ts`, `useCountryMapEmbed.ts`
- Lib: `src/lib/map-config.ts`, `border-editor.ts`, `svg-parser.ts`, `map-pipeline.ts`, `map-idb-cache.ts`
- Procedural: `src/lib/procedural/` (19 files, ~7,400 lines — world generation)
- API: `src/server/api/routers/geo.ts` (~4,300 lines, 70 endpoints)
- Pages: `src/app/maps/page.tsx`, `src/app/admin/maps/`, `src/app/mycountry/map-editor/`
- Deployment: `scripts/deploy-ixworld.sh`, `ecosystem.ixworld.config.cjs`
- Documentation: `docs/systems/maps.md`, `docs/IXWORLD_OCEANOGRAPHY_REPORT.md`

**Features:** Globe/mercator dual projection, 7 map layers, border editor with undo/redo, pin tool, search overlay, distance measurement, keyboard controls, country info panels, IndexedDB caching, 34 sovereignty types, 12 Trewartha climate zones, 9 elevation zones.

**Deployment:** Built from IxStats source via `scripts/deploy-ixworld.sh`, runs on port 3002 via `ecosystem.ixworld.config.cjs`. Shares database with IxStats.

### Development Focus Areas (v1.1.3 Status)
- ✅ **Authentication System**: COMPLETE - 13 security fixes, 8-layer middleware, audit logging
- ✅ **Data Connectivity**: COMPLETE - 62.9% live data wiring (304 endpoints), all critical paths operational
- ✅ **Security Hardening**: COMPLETE - Admin endpoints secured, production guards in place
- ✅ **Economic Calculations**: COMPLETE - Real formulas, historical tracking, projections active
- ✅ **Codebase Quality**: COMPLETE - Zero technical debt
- ✅ **Rate Limiting**: COMPLETE - Redis-based with in-memory fallback operational
- ✅ **Production Optimizations**: COMPLETE - Compression, caching, security headers, monitoring
- 📋 **Real-time Updates**: FEATURE COMPLETE - WebSocket infrastructure operational, polish ongoing
- 📋 **Mobile Experience**: RESPONSIVE - Desktop-optimized, native feel enhancements for v1.1
- 📋 **Advanced Features**: FRAMEWORK COMPLETE - ECI/SDI admin UI polish for v1.1

## Modular Architecture Patterns (October 2025)

### Component Refactoring Standard
For components exceeding ~500 lines or with complex business logic, follow this modular architecture:

#### 1. Business Logic Layer (`src/lib/*.ts`)
- Pure functions for calculations, validations, transformations
- No React dependencies
- Fully unit-testable
- Example: `synergy-calculator.ts`, `wiki-markup-parser.ts`, `tax-builder-validation.ts`

#### 2. State Management Layer (`src/hooks/*.ts`)
- Custom React hooks for data fetching and state management
- Encapsulate tRPC queries/mutations
- Use `useMemo` for expensive computations
- Return clean, typed interfaces
- Example: `useEmbassyNetworkData.ts`, `useNetworkMetrics.ts`, `useTaxBuilderState.ts`

#### 3. Presentation Layer (`src/components/domain/feature/*.tsx`)
- Focused UI components with single responsibilities
- Optimize with `React.memo` for performance
- Accept props only (no internal state/logic)
- Barrel exports via `index.ts`
- Example: `embassy-network/`, `intelligence-briefing/`, `tax-builder/`

#### 4. Orchestration Layer (main component)
- Thin wrapper composing hooks and UI components
- Minimal logic (primarily composition)
- Clear, readable structure (~100-200 lines)
- Example: `EnhancedEmbassyNetwork.tsx` (103 lines)

### Implementation Checklist
When refactoring or creating complex components:

- [ ] Extract pure functions to `src/lib/` utilities
- [ ] Create custom hooks for state/data in `src/hooks/`
- [ ] Split UI into focused components under `src/components/domain/feature/`
- [ ] Apply `React.memo` to all extracted components
- [ ] Add comprehensive JSDoc documentation
- [ ] Ensure TypeScript strict mode compliance
- [ ] Preserve all existing functionality (zero breaking changes)
- [ ] Create barrel exports (`index.ts`) for clean imports

### Proven Results
This pattern has successfully refactored:
- `EnhancedIntelligenceBriefing`: 2,724 → 445 lines (83.7% reduction)
- `TaxBuilder`: 1,851 → 567 lines (69.4% reduction)
- `EnhancedEmbassyNetwork`: 402 → 103 lines (74.4% reduction)

**Total Impact**: 84.0% code reduction, improved maintainability, enhanced testability, zero breaking changes.

See `REFACTORING_SUMMARY_OCT_2025.md` for complete implementation details.

### Current Development Status (January 2026)
**v2 Migration In Progress** (branch: `v2`)

**Recent Upgrades (v2):**
- Next.js 15 -> **16.1.3** (with Webpack dev mode)
- React 18 -> **19.1.3**
- Prisma 5 -> **6.19.2**
- Zod 3 -> **4.0.5**
- Express 4 -> **5.1.0**
- Jest 29 -> **30.0.4**
- ESLint 8 -> **9.31.0**
- tRPC -> **11.4.3**
- Tailwind CSS -> **4.1.11**
- Middleware renamed: `src/middleware.ts` -> `src/proxy.ts`
- `src/middleware.ts` deleted (Next.js picks up `proxy.ts` via compiled output)

**v1.42 Production Baseline:**
- ✅ All 14,677 lines hardcoded data migrated to database
- ✅ 20 admin interfaces, 927 tRPC endpoints across 61 routers
- ✅ Full RBAC with Clerk, audit logging, Redis rate limiting
- ✅ Glass physics design system with 645+ total components

## CRITICAL: TypeScript and Memory Constraints

**NEVER run global TypeScript checks.** This project has 206 Prisma models, 645+ components, and 927 API endpoints. Global `tsc` WILL exhaust server memory (7.2GB total, 4GB allocated to Node).

**Forbidden commands:**
- `tsc --noEmit` (global)
- `npm run typecheck:full`
- `npm run typecheck:quick`
- `npm run check` (calls typecheck)
- Any command that runs TypeScript compiler across the entire codebase

**Safe alternatives:**
- Check individual files: `npx tsc --noEmit path/to/file.ts --skipLibCheck`
- Rely on the Next.js dev server for incremental type checking
- Rely on the build process: `npm run build` (has `ignoreBuildErrors: true`)
- Use IDE/editor TypeScript for per-file checking

**Development server memory:**
- `NODE_OPTIONS="--max-old-space-size=4096"` is set in `start-development.sh`
- Turbopack is disabled (Webpack mode used instead) due to memory constraints
- Dev command: `npm run dev` starts via `start-development.sh`