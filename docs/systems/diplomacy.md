# Diplomacy System

**Last updated:** February 2026

The diplomacy domain handles relationships, embassy networks, missions, cultural exchanges, alliances, foreign policy, and strategic intelligence.

> **⚠️ IMPORTANT:** As of v1.4.0, all diplomatic messaging now uses the **unified ThinkShare system**. See [UNIFIED_MESSAGING_SYSTEM.md](./UNIFIED_MESSAGING_SYSTEM.md) for complete details on the consolidated messaging architecture.

## Application Surfaces
- `src/app/mycountry/intelligence/_components/DiplomaticOperationsHub.tsx` – summarises embassy reach, missions, influence, and alerts
- `src/components/diplomatic/LiveDiplomaticFeed.tsx` – realtime event ticker
- `src/components/diplomatic` – reusable cards for embassies, missions, treaties, and influence breakdowns
- `src/components/diplomacy/AlliancesPanel.tsx` – Alliance management
- `src/components/diplomacy/alliances/` – AllianceCreationWizard, AllianceDashboard, CollectiveActionsPanel
- `src/components/diplomacy/ForeignPolicyPanel.tsx` – Foreign policy management
- `src/components/diplomacy/foreign-policy/` – ActivePoliciesList, ProposePolicyModal, TradeImpactChart

## Backend Routers
- `diplomatic.ts` – Core CRUD for embassies, missions, cultural exchange programs
- `diplomatic-intelligence.ts` – Executive intelligence overlays (relations, threat assessments, recommended actions)
- `diplomaticScenarios.ts` – Dynamic scenario generation and player choices
- `npcPersonalities.ts` – NPC personality system for diplomatic interactions
- `elections.ts` – Political party system and elections (overlaps with executive)
- `notifications.ts` – Diplomatic alert pipelines and acknowledgement mutations
- `countries.ts` – Country profile metadata and comparative stats used in diplomatic overlays

## Data Model Highlights
- `DiplomaticRelation`, `DiplomaticEvent`, `Embassy`, `EmbassyMission`, `CulturalExchange`
- Metrics include relation strength, mission difficulty, threat levels, and cultural influence scores

## Workflows
1. **Embassy Lifecycle** – Create via `api.diplomatic.createEmbassy`, monitor with `api.diplomatic.getEmbassies`
2. **Missions** – Launch with `api.diplomatic.createMission`, track status updates and success probability
3. **Cultural Programs** – Configure exchanges, monitor engagement and benefits
4. **Intelligence Briefings** – `api.diplomaticIntelligence.getIntelligenceBriefing` merges relations, missions, notifications, and events into command-ready packets

5. **Alliances** – Create alliances via `AllianceCreationWizard`, manage via `AllianceDashboard`, coordinate collective actions
6. **Foreign Policy** – Propose policies via `ProposePolicyModal`, track active policies, analyze trade impact
7. **News Auto-Generation** – `src/lib/diplomatic-news-generator.ts` automatically generates diplomatic headlines for the social feed

## Realtime & Alerts
- Diplomatic events (`DiplomaticEvent` records) push through Socket.IO and the notification router
- Alerts feed into the compliance modal and the `/mycountry/intelligence` view

## Help & Documentation
- Update `/help/diplomacy/*` articles alongside router or UI changes
- Cross-reference with `docs/systems/intelligence.md` when changes affect both intelligence and diplomacy contexts

Ensure new diplomatic features maintain consistent data contracts and classification levels, and document them in both this guide and the help center.
