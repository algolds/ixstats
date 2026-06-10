# Platform Overview

**Last updated:** June 2026

IxStates (dev codename: IxStats) is an alternate-history and nation-simulation platform that brings together strategic planning, collaborative storytelling, and operational dashboards. The codebase balances narrative-first UX with a data-rich backend, letting storytellers, game masters, and analysts all share a consistent source of truth.

## Core Goals
- Provide a **command experience** for nation owners through the MyCountry suite (`src/app/mycountry`)
- Deliver transparent **economic, diplomatic, and intelligence data** backed by tRPC routers in `src/server/api/routers`
- Encourage **collaboration** through ThinkPages, ThinkShare, achievements, and live feeds
- Support **rapid worldbuilding** with builder flows, wiki import tooling, and help content directly in the app

## Audience Personas
| Persona | Needs | Key Routes |
| --- | --- | --- |
| Nation Executive | Real-time intel, compliance, defense posture, elections | `/mycountry`, `/mycountry/intelligence`, `/mycountry/politics` |
| Game Master | Monitoring, audit scripts, environment management | `/admin`, `scripts/audit` |
| Analyst / Researcher | Economic stats, diplomacy data, exports | `/dashboard`, `/leaderboards`, `/thinkpages` |
| Collector / Trader | Card packs, trading, IxVault management, marketplace | `/vault`, `/cards` |
| New Player | Guided onboarding, documentation, tutorials | `/help`, `/getting-started`, docs in `docs/overview` |

## Release Cadence & Versioning
- Codebase version: **v2** (`package.json`)
- Next.js 16.1.3, React 19.1.3, Prisma 6.19, tRPC 11.4, Tailwind CSS v4
- 61 tRPC routers, 927 API endpoints, 206 Prisma models, 645+ components
- Documentation updates must accompany feature work; use this overview and `docs/DOCUMENTATION_INDEX.md` as canonical entry points

## Platform Hierarchy

```
IxStates (platform)
├── Integrated Products: IxWorld (incl IxMaps standalone), IxForum, IxVault (incl IxCards, IxCredits, Card Crafting/Trading/Marketplace/Packs/Lore Cards/NS Import), IxWiki (powered by WikiOS + Canvas Editor + Image Repository)
├── Core Systems: MyCountry ★ (flagship, with grouped subsystems: Military & Security, Governance & Politics, Economy & Resources, Intelligence & Diplomacy, National Management), MyCountry Builder (standalone core system, not under MyCountry), ThinkPages (incl ThinkShare, ThinkTanks, IxTwitter), Achievements & Awards (incl LoreWards), LoreStash, Blurbs, Dynamic Island, Admin CMS
├── Platform Utilities: IxTime, IxnayID
├── Infrastructure: Glass Physics, Notifications, Help, c15t, Flag Service, WebSocket, Cron, Cache/RateLimit/Auth
└── Navigation Hubs: Dashboard, Explore/Countries, Feed
```

Each system has a dedicated guide in `docs/systems`. Cross-cutting architecture details live in `docs/architecture`.

## How to Use This Document
- Share with new contributors during onboarding
- Reference when planning roadmap or scoping new pillars
- Keep the persona table aligned with actual routes and experiences

The platform overview should evolve alongside major releases. Update the "Platform Hierarchy" and persona mappings whenever new modules ship or old modules retire.
