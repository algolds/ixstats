# Platform Overview

**Last updated:** October 2025

IxStats is an alternate-history and nation-simulation platform that brings together strategic planning, collaborative storytelling, and operational dashboards. The codebase balances narrative-first UX with a data-rich backend, letting storytellers, game masters, and analysts all share a consistent source of truth.

## Core Goals
- Provide a **command experience** for nation owners through the MyCountry suite (`src/app/mycountry`)
- Deliver transparent **economic, diplomatic, and intelligence data** backed by tRPC routers in `src/server/api/routers`
- Encourage **collaboration** through ThinkPages, ThinkShare, achievements, and live feeds
- Support **rapid worldbuilding** with builder flows, wiki import tooling, and help content directly in the app

## Audience Personas
| Persona | Needs | Key Routes |
| --- | --- | --- |
| Nation Executive | Real-time intel, compliance, defense posture | `/mycountry`, `/mycountry/intelligence` |
| Game Master | Monitoring, audit scripts, environment management | `/admin`, `scripts/audit` |
| Analyst / Researcher | Economic stats, diplomacy data, exports | `/dashboard`, `/leaderboards`, `/thinkpages` |
| New Player | Guided onboarding, documentation, tutorials | `/help`, `/getting-started`, docs in `docs/overview` |

## Release Cadence & Versioning
- Codebase version: **1.1.0** (`package.json`)
- Next major milestone: consolidate realtime upgrades and expand automated testing
- Documentation updates must accompany feature work; use this overview and `docs/DOCUMENTATION_INDEX.md` as canonical entry points

## Domain Pillars
1. **MyCountry Command Suite** – Executive control, compliance, and analytics
2. **Intelligence & Diplomacy** – Live feeds, missions, relationships, and crisis tooling
3. **Economy & Builder** – Economic modeling, projections, and nation creation flows
4. **Social & Collaboration** – ThinkPages, ThinkShare, messaging, and achievements
5. **Operations & Help** – Documentation, environment scripts, monitoring, and the `/help` experience

Each pillar has a dedicated guide in `docs/systems`. Cross-cutting architecture details live in `docs/architecture`.

## How to Use This Document
- Share with new contributors during onboarding
- Reference when planning roadmap or scoping new pillars
- Keep the persona table aligned with actual routes and experiences

The platform overview should evolve alongside major releases. Update the "Domain Pillars" and persona mappings whenever new modules ship or old modules retire.
