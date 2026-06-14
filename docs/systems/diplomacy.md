# Diplomacy System

**Last updated:** June 2026
**Hierarchy:** Part of MyCountry core system — grouped under Intelligence & Diplomacy.

The diplomacy domain handles relationships, embassy networks, missions, cultural exchanges, alliances, foreign policy, and strategic intelligence.

> **⚠️ IMPORTANT:** All diplomatic messaging uses the **unified ThinkShare system**. See the [Unified Messaging (ThinkShare)](#unified-messaging-thinkshare) section below for complete details on the consolidated messaging architecture.

## Application Surfaces
- `src/app/mycountry/intelligence/_components/DiplomaticOperationsHub.tsx` – summarises embassy reach, missions, influence, and alerts
- `src/components/diplomatic/LiveDiplomaticFeed.tsx` – realtime event ticker
- `src/components/diplomatic` – reusable cards for embassies, missions, treaties, and influence breakdowns
- `src/components/diplomacy/alliances/` – AllianceCreationWizard, AllianceDashboard, CollectiveActionsPanel (alliance management)
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
3. **Cultural Programs** – Configure exchanges, monitor engagement and benefits. NPC auto-participation is driven by `NPCPersonalitySystem.predictResponse()`.
4. **Intelligence Briefings** – `api.diplomaticIntelligence.getIntelligenceBriefing` merges relations, missions, notifications, and events into command-ready packets
5. **Alliances** – Create alliances via `AllianceCreationWizard`, manage via `AllianceDashboard`, coordinate collective actions
6. **Foreign Policy** – Mutations (`proposeForeignPolicyAction`, `liftForeignPolicyAction`) are wrapped in `$transaction` for atomicity — foreign policy action creation, StorytellerEffect records, relationship strength updates, and bilateral trade multiplier adjustments all commit or roll back together. Policy CRUD produces narrative output via `generateDiplomaticNews` (`embargo_imposed`, `sanction_imposed`, `free_trade_signed`, `military_alliance_signed`, `blockade_imposed`). Lifting an action atomically recovers 30% of relationship damage and deactivates associated storyteller effects.
7. **News Auto-Generation** – `src/lib/diplomatic-news-generator.ts` automatically generates diplomatic headlines for the social feed
8. **Diplomatic Scenarios & Incidents** – Scenario generation via `api.diplomaticScenarios.getAllScenarios`. Types include `diplomatic_incident`, `border_dispute`, `trade_renegotiation`, `intelligence_breach`, `humanitarian_crisis`, `alliance_pressure`, and more. Filterable by relationship level, difficulty (trivial → legendary), and time frame (urgent → long_term). Player choices recorded via `api.diplomaticScenarios.recordPlayerChoice`.
9. **NPC Auto-Response** — NPC countries react to player diplomatic actions based on `NPCPersonalitySystem` trait calculations. The `npcPersonalities` router exposes `predictScenarioResponse` (returns predicted action, confidence, reasoning, and alternative actions) and `getToneForContext` (formal/casual tone matrix). Personality traits are data-driven — calculated from embassy counts, relationship strengths, trade volume, and cultural activity rather than hardcoded.

## Realtime & Alerts
- Diplomatic events (`DiplomaticEvent` records) push through Socket.IO and the notification router
- Alerts feed into the compliance modal and the `/mycountry/intelligence` view

## Help & Documentation
- Update `/help/diplomacy/*` articles alongside router or UI changes
- Cross-reference with `docs/systems/intelligence.md` when changes affect both intelligence and diplomacy contexts

Ensure new diplomatic features maintain consistent data contracts and classification levels, and document them in both this guide and the help center.

## Diplomatic Response AI

> **Merged from:** docs/systems/diplomatic-ai.md

### Overview

The **Diplomatic Response AI** is an intelligent event generation system that creates contextual diplomatic events and NPC country responses based on the current geopolitical state, player actions, and world dynamics. It transforms IxStats' diplomatic system from static interactions into a living, reactive world.

**Location:** `/src/lib/diplomatic-response-ai.ts`

### Core Philosophy

1. **Events Emerge Naturally**: Events are not random—they emerge from actual world conditions
2. **AI Learns Player Patterns**: The system analyzes player behavior through DiplomaticChoiceTracker
3. **Context-Driven**: Every event is weighted by current geopolitical context
4. **Country Personalities**: NPC countries have inferred personalities that influence their actions
5. **Probability-Based**: Events use sophisticated probability calculations for organic feel

### Architecture

**Main Components:**

```
DiplomaticResponseAI
├── analyzeWorldState()        // Main entry point - scans world and generates events
├── calculateEventProbabilities() // Determines likelihood of each event type
├── generateContextualEvent()  // Creates realistic event with options
├── shouldGenerateEvent()      // Probability-based event firing
├── prioritizeEvents()         // Ranks events by importance
└── inferCountryPersonality()  // Determines NPC behavior patterns
```

**Integrates with:**
- `DiplomaticChoiceTracker` - Analyzes player reputation and historical patterns
- `DiplomaticNetworkService` - Uses embassy and relationship data
- Database models: `Embassy`, `DiplomaticRelation`, `Treaty`, `DiplomaticEvent`

### Event Generation Algorithm

**Step 1: World State Analysis** — Analyzes all active embassies (levels, strength, specializations), current relationship strengths (0-100 scale), recent player diplomatic actions, economic competition metrics, alliance networks and treaty commitments, and global tension levels (0-100).

**Step 2: Probability Calculation** — Each event type has a dynamic probability:

| Event Type | Probability Formula | Key Triggers |
|---|---|---|
| Trade Dispute | `min(0.4, (economicCompetition/100)*0.3 + highTradeRelations*0.05 + (negativeTradeBalance ? 0.1 : 0))` | High trade volume (>$500k), economic competition, trade imbalance |
| Alliance Offer | `min(0.35, strongRelations*0.08 + (globalTensions/100)*0.15 + (playerCooperativeness/100)*0.12)` | Relationship strength >75%, global tensions >40, cooperative reputation |
| Cultural Exchange | `min(0.45, embassiesWithoutExchanges*0.1 + (isCulturallyActive ? 0.2 : 0.05) + culturalEmbassies*0.08)` | Level 2+ embassy, no current exchange, cultural activity |
| Sanction Threat | `min(0.3, deterioratingRelations*0.12 + (playerAggressiveness/100)*0.15 + (globalTensions/100)*0.08)` | Relationship <30 and hostile, recent negative actions, high aggressiveness |
| Crisis Mediation | `min(0.4, (globalTensions/100)*0.25 + (playerTrustLevel/100)*0.15 + allianceCount*0.05)` | Interventionist reputation, global tensions >50, high trust (>70) |
| Treaty Proposal | `min(0.38, potentialPartners*0.08 + (isMultilateral ? 0.15 : 0.05) + (trustLevel/100)*0.12)` | Relationship >60, fewer than 2 existing treaties, high trust |
| Economic Cooperation | `min(0.42, (gdpGrowth/10)*0.15 + highTradeRelations*0.08 + 0.12)` | Trade-focused history, strong GDP growth, high-value trade (>$100k) |
| Security Pact | `min(0.36, alliancesWithoutDefense*0.12 + (globalTensions/100)*0.18 + securityEmbassies*0.06)` | Alliance without defense pact, global tensions >40, security embassies |
| Intelligence Sharing | `min(0.33, level3Embassies*0.11 + allianceCount*0.07 + (globalTensions/100)*0.1)` | Level 3+ embassies (strength >65), alliances, security focus |

**Step 3: Event Generation Decision** — Uses `shouldGenerateEvent(probability, context)` with an Event Fatigue Mechanic: if player has >10 recent events, reduce probability by 5% per additional event to prevent overwhelming the player.

**Step 4: Event Construction** — Each generated event includes: id, type, severity (positive/warning/critical/info), priority (urgent/high/medium/low), from/to country, title, description, detailed description, triggers, related actions, response options (with expected outcomes, risks, benefits, relationship/economic/reputation impact), potential consequences, urgency score (0-100), AI confidence (0-100), and contextual relevance (0-100).

**Step 5: Event Prioritization** — Events ranked by composite score: `priorityWeight[priority] * 2.0 + severityWeight[severity] * 1.5 + (urgency/100) + (contextualRelevance/100) + (aiConfidence/100)`. Top 3 events returned.

### Country Personality System

The AI infers NPC country personalities from observable behavior:

**Personality Traits (0-100 scale):** assertiveness, cooperativeness, economicFocus, culturalOpenness, riskTolerance.

**Personality Archetypes:**

| Archetype | Conditions |
|---|---|
| Aggressive | Assertiveness >70 AND RiskTolerance >70 |
| Isolationist | Cooperativeness <40 AND <3 relationships |
| Mercantile | EconomicFocus >75 |
| Diplomatic | Cooperativeness >80 |
| Expansionist | AllianceCount >3 AND Assertiveness >60 |
| Defensive | Assertiveness <40 AND Cooperativeness >60 |

**Trait Calculations:**
- **Assertiveness:** `min(100, hostileRelationships*20 + weakRelationships*10 + 30)`
- **Cooperativeness:** `min(100, allianceCount*15 + avgRelationshipStrength/2 + friendlyRelationships*8)`
- **EconomicFocus:** `min(100, highTradeRelations*15 + tradeAgreements*12 + 20)`
- **CulturalOpenness:** `min(100, highCulturalExchanges*20 + 40)`
- **RiskTolerance:** `min(100, hostileRelationships*15 + weakRelationships*10 + 50)`

### Event Types Reference

| Event Type | Severity | Priority | Urgency | Typical Impact |
|---|---|---|---|---|
| Trade Dispute | Warning | High | 75 | ±$50k-$200k economic, ±10-25 relationship |
| Alliance Offer | Positive | High | 60 | +40 relationship, +$50k economic, +20 reputation |
| Cultural Exchange | Positive | Medium | 40 | +15 relationship, +cultural influence, $10k-25k cost |
| Sanction Threat | Critical | Urgent | 90 | ±$50k-$200k economic, ±15-30 relationship, ±5-15 reputation |
| Crisis Mediation | Warning | High | 80 | +25 relationship, +30 reputation (success) |
| Treaty Proposal | Positive | High | 65 | +35 relationship, varies by treaty type |
| Economic Cooperation | Positive | Medium | 50 | +25 economic multiplier, +trade efficiency |
| Security Pact | Warning | High | 70 | +30 security, +defense capabilities |
| Intelligence Sharing | Positive | Medium | 55 | +intelligence gathering bonus, +relationship |

### Performance Considerations

- **Computational Complexity:** O(n) linear — World State Analysis O(n), Probability Calculation O(m), Event Generation O(k)
- **Optimization:** Cache world state analysis 5-10 minutes, lazy-load probabilities, event fatigue throttling, batch processing for multiple countries
- **Recommended Trigger Frequency:** Real-time on major diplomatic actions, every 24 IxTime hours (~12 real hours at 2x speed), or manual player-triggered

### Future Enhancements

1. Machine Learning Integration — train on player behavior patterns
2. Multi-Country Events — 3+ country events, regional crises, trade bloc formations
3. Event Chains — follow-up events, long-term narrative arcs
4. Dynamic Difficulty — adjust complexity based on player experience
5. Historical Event Analysis — learn from past responses, personalize diplomatic experience

### Troubleshooting

- **No Events Generating:** Check relationships length, recent actions data, event fatigue thresholds, relationship strengths
- **Events Feel Repetitive:** Increase event fatigue coefficient (currently 0.05), add diverse relationship types, vary player actions
- **Events Not Contextually Relevant:** Verify economicData is current, check globalTensions calculation, ensure recentActions includes last 20 actions

## NPC Personality-Driven Auto-Response

NPC countries respond automatically to player diplomatic actions based on their personality archetypes. The system is backed by two core libraries:

- **`src/lib/diplomatic-npc-personality.ts`** (1,511 lines) — `NPCPersonalitySystem` class calculates 8 core traits (assertiveness, cooperativeness, economicFocus, culturalOpenness, riskTolerance, ideologicalRigidity, militarism, isolationism) from observable database data (embassies, relationships, trade, cultural exchanges). Traits are measured 0-100 and map to 6 archetypes: aggressive_exansionist, peaceful_merchant, cautious_isolationist, cultural_diplomat, pragmatic_realist, ideological_hardliner. Personality drifts over time (max ±2 points per IxTime year) based on experiences.

- **`src/lib/npc-cultural-participation.ts`** (920 lines) — Drives NPC participation in cultural exchanges using `NPCPersonalitySystem.predictResponse()`. Personality traits determine participation enthusiasm, resource commitment, and predicted actions in response to diplomatic invitations.

**NPC Personalities Router** (`src/server/api/routers/npcPersonalities/`): Split into query, diplomacy, and admin sub-routers. The diplomacy sub-router exposes `predictScenarioResponse` (predicts NPC response based on personality + relationship context), `getToneForContext` (formal/casual tone matrix), and `incrementUsage` (tracks personality usage stats).

## Unified Messaging (ThinkShare)

> **Merged from:** docs/systems/UNIFIED_MESSAGING_SYSTEM.md

ThinkShare is the unified messaging backbone for IxStats. All messaging systems—personal conversations, diplomatic communications, secure channels, and group discussions—use the same underlying infrastructure.

### Core Models

**ThinkshareConversation:** Includes diplomatic extensions — `conversationType` (personal/diplomatic/official), `diplomaticClassification` (PUBLIC/RESTRICTED/CONFIDENTIAL/SECRET/TOP_SECRET), `priority` (LOW/NORMAL/HIGH/URGENT/CRITICAL), `encrypted`, `channelType` (BILATERAL/MULTILATERAL/EMERGENCY).

**ThinkshareMessage:** Includes diplomatic extensions — `classification`, `priority`, `subject`, `signature` (digital signature for verification), `encryptedContent`, `status` (SENT/DELIVERED/READ/ARCHIVED), plus standard fields: `content`, `messageType`, `replyToId`, `mentions`, `attachments`.

### Classification Levels

| Level | Description | Use Case |
|---|---|---|
| `PUBLIC` | Unrestricted information | General diplomatic correspondence |
| `RESTRICTED` | Internal government only | Sensitive policy discussions |
| `CONFIDENTIAL` | Need-to-know basis | Treaty negotiations, trade secrets |
| `SECRET` | Highly sensitive | National security matters, military planning |
| `TOP_SECRET` | Most critical | Crisis response, intelligence operations |

### Priority Levels

| Priority | Response Time | Use Case |
|---|---|---|
| `LOW` | 24+ hours | Routine correspondence |
| `NORMAL` | 8-24 hours | Standard diplomatic communications |
| `HIGH` | 2-8 hours | Important policy matters |
| `URGENT` | <2 hours | Time-sensitive negotiations |
| `CRITICAL` | Immediate | Crisis situations, emergency responses |

### UI Integration

**SecureCommunications component** (`src/app/mycountry/intelligence/_components/SecureCommunications`): Full-featured diplomatic messaging UI with split-pane layout (channels list + message thread), classification badges (color-coded), real-time encryption/decryption, signature verification badges, key expiration warnings, country-based authorization, IxTime timestamps, typing indicators, read receipts, message search/filter, and channel creation modal.

**ThinkshareMessages component** (`src/components/thinkshare/ThinkshareMessages`): Standard ThinkShare UI for personal messaging.

### Migration from Diplomatic Channels

Old API (`api.diplomatic.getChannels` / `api.diplomatic.sendMessage`) is deprecated. New unified API uses `api.thinkpages.getConversations` / `api.thinkpages.sendMessage` with conversationType filtering for diplomatic channels. Migration script: `scripts/migrate-diplomatic-to-thinkshare.ts` converts DiplomaticChannel → ThinkshareConversation, DiplomaticMessage → ThinkshareMessage, preserving all metadata.

### Benefits

- **Single Source of Truth:** All messaging in one place, consistent API, unified WebSocket real-time updates
- **Reduced Code Duplication:** -2,000 lines of redundant messaging code removed
- **Enhanced Features:** Diplomatic channels gain real-time features (typing indicators, read receipts); personal messages gain classification/encryption capabilities

### Real-Time Features

WebSocket support for typing indicators, read receipts, presence status (online/away/busy), live message delivery, and conversation updates. Enabled via `useThinkPagesWebSocket` hook.

### Security Considerations

- **Encryption:** `encrypted` flag enables end-to-end encryption, `encryptedContent` stores encrypted payload, `signature` for message authentication
- **Access Control:** Classification-based filtering at query level, participant verification, country-based authorization for diplomatic channels, role-based access (participant/moderator/observer)
- **Audit Logging:** All classified messages logged, message status tracking, participant join/leave events tracked

### Performance

- Database indexes on classification, priority, status fields
- Cursor-based pagination for large conversation lists
- Message caching via tRPC staleTime configuration
- WebSocket optimizations for real-time updates
- Lazy loading of message history
