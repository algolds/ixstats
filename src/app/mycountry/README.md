# MyCountry Command Suite

**Last updated:** June 2026

The MyCountry route (`/mycountry`) provides the executive command suite for nation owners. It uses a **single-page router pattern** (via `MyCountryRouter`) to manage all sections without full page navigations.

## Architecture
MyCountry uses the single-page router pattern found across the application:
- `MyCountryRouter.tsx` — Central router component that switches between sections using client-side state + `pushState`
- `MyCountrySidebarNav.tsx` — Navigation sidebar with section list and active state tracking
- Core sections are **eagerly imported** for instant tab switching
- Rarely-visited sections are **lazy-loaded** to keep the initial bundle smaller

## Sections
| Section | Key Components |
| --- | --- |
| **Overview** | Country metrics, activity rings, compliance summary |
| **Executive** | National issues inbox, crisis management, government metrics, **9 executive actions** (economic/social/diplomatic/emergency) with real economic impact, cooldowns, and budget costs |
| **Diplomacy** | Diplomatic operations hub, embassy management, treaty negotiations |
| **Intelligence** | Intelligence briefings, live feeds, unified command view |
| **Defense** | Strategic defense initiative, military readiness, equipment management |
| **Politics** | Election simulator, legislature config, party management, hemicycle visualization |

## Layout
| File | Purpose |
| --- | --- |
| `page.tsx` | Entry point rendering `MyCountryRouter` once the user is authenticated |
| `components/` | Shared UI shells (tab system, intelligence content, compliance modal, quick actions) |
| `intelligence/` | Live feeds, diplomatic operations hub, analytics widgets |
| `defense/` | Strategic defense initiative panels and readiness summaries |
| `politics/` | Election simulation and legislature management |
| `hooks/` | Domain hooks (`useMyCountryCompliance`, etc.) for data orchestration |
| `services/` | Server helpers and adapters supporting MyCountry-specific data workflows |
| `utils/` | Data transformers, formatting helpers, validation routines |
| `types/` | TypeScript definitions for intelligence + compliance payloads |
| `editor/` | Post-creation editing flows linked to builder data |

## Data Sources
- Country metrics: `api.countries.getByIdWithEconomicData`, `api.countries.getActivityRingsData`
- Intelligence: `api.intelligence.getExecutiveDashboard`, `api.diplomaticIntelligence.getIntelligenceBriefing`, `api.unifiedIntelligence.getCommandView`
- Compliance & Alerts: `api.mycountry.getComplianceSummary`, `api.notifications.getCountryAlerts`
- Defense: `api.unifiedIntelligence.getModules`, `api.security.getThreatStatus`
- Elections: `api.elections.getElections`, `api.elections.simulateElection`
- National Issues: `api.nationalIssues.getMyIssues`, `api.nationalIssues.respond`
- News Feed: `api.mycountry.getNewsFeed` (surfaces narrative output from executive actions, government effects, and diplomatic events)
- Government Components: `api.government.getComponents` (56 atomic components now affect game state via `src/lib/government-component-effects.ts` — political metrics and economic StorytellerEffects)

## Implementation Notes
- Section switching is client-side via `MyCountryRouter` — no full page reloads
- Core sections are eagerly imported; less-visited sections use `lazy()` with `SectionSkeleton` fallback
- Error boundaries per section (`SectionErrorFallback`) with retry capability
- Live feeds subscribe to Socket.IO channels when available (production runtime)
- **Shared helpers** (`src/server/shared/mycountry-helpers.ts`) were extracted from 3 routers to eliminate ~900 lines of duplicated code. Exports `calculateVitalityScores`, `generateIntelligenceFeed`, `calculateAchievements`, `generateRankings`, `generateMilestones`, and cache helpers. Follows the `layer-cache.ts` pattern for cross-router shared primitives.
- **NewsFeedWidget** (`src/components/mycountry/NewsFeedWidget.tsx`) renders the player-facing narrative output from executive actions, government effects, and diplomatic events. Queries `api.mycountry.getNewsFeed` and resolves category icons (economic/diplomatic/military/social/emergency) from `inputType` and `description` fields.

## Documentation
- Keep `docs/systems/mycountry.md` and `/help/mycountry/*` synced with new functionality
- Update this README when adding sections, hooks, or services

Use this file as the quick reference when extending the MyCountry experience.
