# Diplomatic Response AI System

## Overview

The **Diplomatic Response AI** is an intelligent event generation system that creates contextual diplomatic events and NPC country responses based on the current geopolitical state, player actions, and world dynamics. It transforms IxStats' diplomatic system from static interactions into a living, reactive world.

**Location:** `/src/lib/diplomatic-response-ai.ts`

---

## Core Philosophy

1. **Events Emerge Naturally**: Events are not random—they emerge from actual world conditions
2. **AI Learns Player Patterns**: The system analyzes player behavior through DiplomaticChoiceTracker
3. **Context-Driven**: Every event is weighted by current geopolitical context
4. **Country Personalities**: NPC countries have inferred personalities that influence their actions
5. **Probability-Based**: Events use sophisticated probability calculations for organic feel

---

## Architecture

### Main Components

```typescript
DiplomaticResponseAI
├── analyzeWorldState()        // Main entry point - scans world and generates events
├── calculateEventProbabilities() // Determines likelihood of each event type
├── generateContextualEvent()  // Creates realistic event with options
├── shouldGenerateEvent()      // Probability-based event firing
├── prioritizeEvents()         // Ranks events by importance
└── inferCountryPersonality()  // Determines NPC behavior patterns
```

### Integration Points

**Integrates with:**
- `DiplomaticChoiceTracker` - Analyzes player reputation and historical patterns
- `DiplomaticNetworkService` - Uses embassy and relationship data
- Database models: `Embassy`, `DiplomaticRelation`, `Treaty`, `DiplomaticEvent`

---

## Event Generation Algorithm

### Step 1: World State Analysis

```typescript
const context = buildEventContext(worldState);
// Analyzes:
// - All active embassies (levels, strength, specializations)
// - Current relationship strengths (0-100 scale)
// - Recent player diplomatic actions
// - Economic competition metrics (trade volumes, imbalances)
// - Alliance networks and treaty commitments
// - Global tension levels (0-100)
```

### Step 2: Probability Calculation

Each event type has a **dynamic probability** calculated from:

#### Trade Dispute
```typescript
probability = min(0.4,
  (economicCompetition / 100) * 0.3 +
  (highTradeRelations.count * 0.05) +
  (negativeTradeBalance ? 0.1 : 0)
)
```

**Triggers when:**
- High trade volume (>$500k annually) exists
- Economic competition is present
- Trade imbalance detected
- Player has trade-focused history

#### Alliance Offer
```typescript
probability = min(0.35,
  (strongRelations.count * 0.08) +
  (globalTensions / 100) * 0.15 +
  (playerCooperativeness / 100) * 0.12
)
```

**Triggers when:**
- Relationship strength >75% and status = 'friendly'
- Global tensions elevated (>40)
- Player has cooperative reputation
- Fewer than 3 existing alliances

#### Cultural Exchange Offer
```typescript
probability = min(0.45,
  (embassiesWithoutExchanges.count * 0.1) +
  (isCulturallyActive ? 0.2 : 0.05) +
  (culturalEmbassies.count * 0.08)
)
```

**Triggers when:**
- Level 2+ embassy exists
- No current cultural exchange program
- Player historically culturally active
- Cultural embassy specializations present

#### Sanction Threat
```typescript
probability = min(0.3,
  (deterioratingRelations.count * 0.12) +
  (playerAggressiveness / 100) * 0.15 +
  (globalTensions / 100) * 0.08
)
```

**Triggers when:**
- Relationship strength <30 and status = 'strained' or 'hostile'
- Recent negative player actions (embassy closures, treaty breaks)
- High player aggressiveness score
- Regional tensions present

#### Crisis Mediation Request
```typescript
probability = min(0.4,
  (globalTensions / 100) * 0.25 +
  (playerTrustLevel / 100) * 0.15 +
  (allianceCount * 0.05)
)
```

**Triggers when:**
- Player has interventionist reputation
- Global tensions >50
- High trust level (>70)
- Multiple alliance relationships

#### Treaty Proposal
```typescript
probability = min(0.38,
  (potentialPartners.count * 0.08) +
  (isMultilateral ? 0.15 : 0.05) +
  (trustLevel / 100) * 0.12
)
```

**Triggers when:**
- Relationship strength >60
- Fewer than 2 existing treaties with country
- High trust level
- Multilateral diplomatic pattern

#### Economic Cooperation
```typescript
probability = min(0.42,
  (gdpGrowth / 10) * 0.15 +
  (highTradeRelations.count * 0.08) +
  0.12 // Base for trade-focused players
)
```

**Triggers when:**
- Player has trade-focused history
- Strong economic performance (high GDP growth)
- Multiple high-value trade relationships (>$100k)

#### Security Pact
```typescript
probability = min(0.36,
  (alliancesWithoutDefense.count * 0.12) +
  (globalTensions / 100) * 0.18 +
  (securityEmbassies.count * 0.06)
)
```

**Triggers when:**
- Alliance exists without defense pact
- Global tensions >40
- Security-specialized embassies present

#### Intelligence Sharing
```typescript
probability = min(0.33,
  (level3Embassies.count * 0.11) +
  (allianceCount * 0.07) +
  (globalTensions / 100) * 0.1
)
```

**Triggers when:**
- Level 3+ embassies exist with strength >65
- Alliance relationships present
- Security focus or elevated tensions

### Step 3: Event Generation Decision

```typescript
shouldGenerateEvent(probability, context) {
  const roll = Math.random();
  const eventFatigue = max(0, (recentEventCount - 10) * 0.05);
  const adjustedProbability = max(0, probability - eventFatigue);

  return roll < adjustedProbability;
}
```

**Event Fatigue Mechanic:**
- If player has >10 recent events, reduce probability by 5% per additional event
- Prevents overwhelming the player with too many simultaneous events
- Maintains organic pacing

### Step 4: Event Construction

Each generated event includes:

```typescript
{
  id: "event_timestamp_random",
  type: "alliance_offer",
  severity: "positive" | "warning" | "critical" | "info",
  priority: "urgent" | "high" | "medium" | "low",

  fromCountry: "Pelaxia",
  fromCountryId: "country_123",
  toCountryId: "player_country_id",

  title: "Alliance Proposal from Pelaxia",
  description: "Short summary...",
  longDescription: "Detailed context...",

  triggers: ["Strong relationship", "Geopolitical alignment"],
  relatedActions: ["action_id_1", "action_id_2"],

  responseOptions: [
    {
      id: "accept",
      label: "Accept Alliance",
      description: "Form strategic alliance...",
      expectedOutcome: "Major diplomatic coup...",
      risks: ["Defense obligations", "May antagonize rivals"],
      benefits: ["Mutual defense", "Intelligence sharing"],
      relationshipImpact: +40,
      economicImpact: +50000,
      reputationImpact: +20
    },
    // ... more options
  ],

  potentialConsequences: {
    accept: ["Strategic alliance formed", "Defense obligations incurred"],
    reject: ["Opportunity lost", "Relationship cooling"],
    negotiate: ["Custom alliance terms", "Extended negotiations"]
  },

  urgency: 60, // 0-100
  aiConfidence: 85, // 0-100
  contextualRelevance: 78, // 0-100
  generatedAt: "2025-10-24T12:00:00Z"
}
```

### Step 5: Event Prioritization

Events are ranked by composite score:

```typescript
score =
  priorityWeight[priority] * 2.0 +     // Urgent=4, High=3, Medium=2, Low=1
  severityWeight[severity] * 1.5 +     // Critical=4, Warning=3, Positive=2, Info=1
  (urgency / 100) +                    // 0-1 normalized
  (contextualRelevance / 100) +        // 0-1 normalized
  (aiConfidence / 100)                 // 0-1 normalized
```

**Top 3 events** are returned to prevent overwhelming the player.

---

## Country Personality System

The AI infers NPC country personalities from observable behavior:

### Personality Traits (0-100 scale)

```typescript
{
  assertiveness: number,      // Likelihood to make demands
  cooperativeness: number,    // Willingness to collaborate
  economicFocus: number,      // Priority on trade/economics
  culturalOpenness: number,   // Interest in cultural exchanges
  riskTolerance: number       // Willingness to take risks
}
```

### Personality Archetypes

Determined by trait combinations:

| Archetype | Conditions |
|-----------|------------|
| **Aggressive** | Assertiveness >70 AND RiskTolerance >70 |
| **Isolationist** | Cooperativeness <40 AND <3 relationships |
| **Mercantile** | EconomicFocus >75 |
| **Diplomatic** | Cooperativeness >80 |
| **Expansionist** | AllianceCount >3 AND Assertiveness >60 |
| **Defensive** | Assertiveness <40 AND Cooperativeness >60 |

### Trait Calculations

**Assertiveness:**
```typescript
min(100,
  (hostileRelationships * 20) +
  (weakRelationships * 10) +
  30 // base
)
```

**Cooperativeness:**
```typescript
min(100,
  (allianceCount * 15) +
  (avgRelationshipStrength / 2) +
  (friendlyRelationships * 8)
)
```

**EconomicFocus:**
```typescript
min(100,
  (highTradeRelations * 15) +
  (tradeAgreements * 12) +
  20 // base
)
```

**CulturalOpenness:**
```typescript
min(100,
  (highCulturalExchanges * 20) +
  40 // base
)
```

**RiskTolerance:**
```typescript
min(100,
  (hostileRelationships * 15) +
  (weakRelationships * 10) +
  50 // base
)
```

---

## Event Types Reference

### 1. Trade Dispute
- **Severity:** Warning
- **Priority:** High
- **Urgency:** 75/100
- **Common Triggers:** High trade volume, economic competition, trade imbalance
- **Response Options:** Negotiate, Counter-tariffs, Make concessions
- **Typical Impact:** ±$50k-$200k economic, ±10-25 relationship

### 2. Alliance Offer
- **Severity:** Positive
- **Priority:** High
- **Urgency:** 60/100
- **Common Triggers:** Strong relationship (>75%), shared interests, tensions
- **Response Options:** Accept, Negotiate terms, Decline
- **Typical Impact:** +40 relationship (accept), +$50k economic, +20 reputation

### 3. Cultural Exchange Offer
- **Severity:** Positive
- **Priority:** Medium
- **Urgency:** 40/100
- **Common Triggers:** Embassy presence, cultural openness, positive relations
- **Response Options:** Full program, Pilot program, Decline
- **Typical Impact:** +15 relationship, +cultural influence, $10k-25k cost

### 4. Sanction Threat
- **Severity:** Critical
- **Priority:** Urgent
- **Urgency:** 90/100
- **Common Triggers:** Deteriorating relationship (<30%), diplomatic tensions
- **Response Options:** Diplomatic engagement, Stand firm, Counter-coalition
- **Typical Impact:** ±$50k-$200k economic, ±15-30 relationship, ±5-15 reputation

### 5. Crisis Mediation Request
- **Severity:** Warning
- **Priority:** High
- **Urgency:** 80/100
- **Common Triggers:** Interventionist reputation, high trust (>70), regional crisis
- **Response Options:** Accept mediation, Limited support, Decline
- **Typical Impact:** +25 relationship, +30 reputation (success), -15 reputation (decline)

### 6. Treaty Proposal
- **Severity:** Positive
- **Priority:** High
- **Urgency:** 65/100
- **Common Triggers:** Strong relationship (>60%), trust level, multilateral pattern
- **Response Options:** Accept, Negotiate, Decline
- **Typical Impact:** +35 relationship, varies by treaty type

### 7. Economic Cooperation
- **Severity:** Positive
- **Priority:** Medium
- **Urgency:** 50/100
- **Common Triggers:** Trade focus, strong economic performance, trade relationships
- **Response Options:** Full partnership, Limited cooperation, Decline
- **Typical Impact:** +25 economic multiplier, +trade efficiency

### 8. Security Pact
- **Severity:** Warning
- **Priority:** High
- **Urgency:** 70/100
- **Common Triggers:** Existing alliance, global tensions (>40), security embassies
- **Response Options:** Accept pact, Limited commitment, Decline
- **Typical Impact:** +30 security, +defense capabilities, regional perception shift

### 9. Intelligence Sharing Agreement
- **Severity:** Positive
- **Priority:** Medium
- **Urgency:** 55/100
- **Common Triggers:** Level 3+ embassies, alliances, security focus
- **Response Options:** Full sharing, Limited intel, Decline
- **Typical Impact:** +intelligence gathering bonus, +relationship strength

---

## Usage Examples

### Basic Event Generation

```typescript
import { DiplomaticResponseAI } from '@/lib/diplomatic-response-ai';

// Prepare world state
const worldState = {
  countryId: "country_123",
  countryName: "Your Country",
  embassies: [...], // From database
  relationships: [...], // From database
  recentActions: [...], // From DiplomaticChoiceTracker
  economicData: {
    currentGdp: 5000000000,
    gdpGrowth: 3.2,
    economicTier: "developed",
    tradeBalance: -50000000,
    totalTradeVolume: 2000000000
  },
  diplomaticReputation: "Cooperative",
  activeTreaties: [...]
};

// Generate events
const events = DiplomaticResponseAI.analyzeWorldState(worldState);

// events = [
//   { type: 'alliance_offer', severity: 'positive', ... },
//   { type: 'trade_dispute', severity: 'warning', ... },
//   { type: 'cultural_exchange_offer', severity: 'positive', ... }
// ]
```

### Infer Country Personality

```typescript
const personality = DiplomaticResponseAI.inferCountryPersonality(
  "pelaxia_id",
  pelaxiaRelationships,
  pelaxiaHistoricalActions
);

// personality = {
//   archetype: 'mercantile',
//   traits: {
//     assertiveness: 55,
//     cooperativeness: 75,
//     economicFocus: 82,
//     culturalOpenness: 60,
//     riskTolerance: 50
//   },
//   historicalBehavior: { ... }
// }
```

### Check Event Probability

```typescript
const context = buildEventContext(worldState);
const probabilities = DiplomaticResponseAI.calculateEventProbabilities(
  context,
  playerReputation
);

// probabilities = [
//   {
//     eventType: 'cultural_exchange_offer',
//     probability: 0.42,
//     reasoning: 'Embassy presence and cultural openness...',
//     contextFactors: ['5 embassies without exchanges', ...]
//   },
//   ...
// ]
```

---

## Integration with tRPC API

### Recommended Router Method

```typescript
// src/server/api/routers/diplomatic.ts

generateDiplomaticEvents: protectedProcedure
  .input(z.object({
    countryId: z.string()
  }))
  .query(async ({ ctx, input }) => {
    const country = await ctx.db.country.findUnique({
      where: { id: input.countryId }
    });

    // Fetch embassies
    const embassies = await ctx.db.embassy.findMany({
      where: {
        OR: [
          { hostCountryId: input.countryId },
          { guestCountryId: input.countryId }
        ],
        status: 'active'
      }
    });

    // Fetch relationships
    const relationships = await ctx.db.diplomaticRelation.findMany({
      where: {
        OR: [
          { country1: input.countryId },
          { country2: input.countryId }
        ]
      }
    });

    // Fetch recent diplomatic actions
    const recentActions = await getDiplomaticChoices(input.countryId);

    // Build world state
    const worldState = {
      countryId: input.countryId,
      countryName: country.name,
      embassies: embassies.map(e => ({...})),
      relationships: relationships.map(r => ({...})),
      recentActions,
      economicData: {
        currentGdp: country.currentTotalGdp,
        gdpGrowth: country.actualGdpGrowth,
        economicTier: country.economicTier,
        tradeBalance: country.tradeBalance,
        totalTradeVolume: calculateTotalTrade(relationships)
      },
      diplomaticReputation: country.diplomaticReputation,
      activeTreaties: await getActiveTreaties(input.countryId)
    };

    // Generate events
    const events = DiplomaticResponseAI.analyzeWorldState(worldState);

    // Store events in database
    for (const event of events) {
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: event.toCountryId,
          country2Id: event.fromCountryId,
          eventType: event.type,
          title: event.title,
          description: event.description,
          severity: event.severity,
          metadata: JSON.stringify({
            responseOptions: event.responseOptions,
            consequences: event.potentialConsequences,
            urgency: event.urgency,
            aiConfidence: event.aiConfidence
          })
        }
      });
    }

    return events;
  })
```

---

## Performance Considerations

### Computational Complexity

- **World State Analysis:** O(n) where n = number of relationships
- **Probability Calculation:** O(m) where m = number of event types (~9)
- **Event Generation:** O(k) where k = number of triggered events (max 3)
- **Overall:** O(n + m + k) = O(n) - **Linear complexity**

### Optimization Strategies

1. **Caching:** Cache world state analysis for 5-10 minutes
2. **Lazy Loading:** Only calculate probabilities when needed
3. **Event Throttling:** Event fatigue system prevents spam
4. **Batch Processing:** Generate events for multiple countries in parallel

### Recommended Trigger Frequency

- **Real-time:** On major diplomatic action (embassy establishment, treaty signing)
- **Periodic:** Every 24 IxTime hours (~12 real hours at 2x speed)
- **Manual:** Player-triggered via "Check Diplomatic Situation" button

---

## Testing Strategy

### Unit Tests

```typescript
describe('DiplomaticResponseAI', () => {
  describe('calculateEventProbabilities', () => {
    it('should increase trade dispute probability with high trade volume', () => {
      const context = createTestContext({
        relationships: [
          { tradeVolume: 1000000, strength: 60 }
        ]
      });

      const probs = DiplomaticResponseAI.calculateEventProbabilities(
        context,
        mockReputation
      );

      const tradeDisputeProb = probs.find(p => p.eventType === 'trade_dispute');
      expect(tradeDisputeProb.probability).toBeGreaterThan(0.2);
    });
  });

  describe('shouldGenerateEvent', () => {
    it('should respect event fatigue', () => {
      const context = createTestContext({
        recentPlayerActions: Array(15).fill(mockAction) // 15 recent events
      });

      const shouldGenerate = DiplomaticResponseAI.shouldGenerateEvent(
        0.5, // 50% base probability
        context
      );

      // Probability reduced by (15-10)*0.05 = 0.25
      // Adjusted probability = 0.5 - 0.25 = 0.25
      // Test multiple times due to randomness
    });
  });
});
```

---

## Future Enhancements

### Planned Features (v1.2+)

1. **Machine Learning Integration**
   - Train on player behavior patterns
   - Improve event relevance over time
   - Predict player responses

2. **Multi-Country Events**
   - Events involving 3+ countries
   - Regional crises requiring coalition response
   - Trade bloc formations

3. **Event Chains**
   - Events trigger follow-up events
   - Long-term narrative arcs
   - Consequence tracking across time

4. **Dynamic Difficulty**
   - Adjust event complexity based on player experience
   - Scale diplomatic challenges appropriately
   - Adaptive tutorial events

5. **Historical Event Analysis**
   - Learn from player's past event responses
   - Adjust future event types based on preferences
   - Personalized diplomatic experience

---

## Troubleshooting

### No Events Generating

**Problem:** `analyzeWorldState()` returns empty array

**Solutions:**
1. Check if `worldState.relationships.length > 0`
2. Verify `worldState.recentActions` has data
3. Ensure event fatigue hasn't reduced all probabilities to 0
4. Check if all relationships have strength < 60 (limits many events)

### Events Feel Repetitive

**Problem:** Same event types keep appearing

**Solutions:**
1. Increase event fatigue coefficient (currently 0.05)
2. Add more diverse relationship types to database
3. Vary player diplomatic actions
4. Check if personality archetypes are too homogeneous

### Events Not Contextually Relevant

**Problem:** Events don't match current geopolitical situation

**Solutions:**
1. Verify `economicData` is current and accurate
2. Check `globalTensions` calculation logic
3. Ensure `recentActions` includes last 20 actions
4. Review `contextualRelevance` scores in generated events

---

## Credits

**System Design:** Diplomatic Response AI v1.0
**Integration:** DiplomaticChoiceTracker, DiplomaticNetworkService
**Database Models:** Embassy, DiplomaticRelation, Treaty, DiplomaticEvent
**Documentation:** October 2025

---

## Quick Reference Card

### Event Type Probability Thresholds

| Event Type | Min Probability | Max Probability | Typical Triggers |
|------------|-----------------|-----------------|------------------|
| Trade Dispute | 0.05 | 0.40 | High trade + competition |
| Alliance Offer | 0.08 | 0.35 | Strong relations + tensions |
| Cultural Exchange | 0.10 | 0.45 | Embassy + cultural activity |
| Sanction Threat | 0.05 | 0.30 | Weak relations + hostility |
| Crisis Mediation | 0.08 | 0.40 | High trust + interventionist |
| Treaty Proposal | 0.08 | 0.38 | Strong relations + multilateral |
| Economic Cooperation | 0.12 | 0.42 | Trade focus + good economy |
| Security Pact | 0.10 | 0.36 | Alliance + tensions |
| Intelligence Sharing | 0.08 | 0.33 | High-level embassies + alliances |

### Personality Archetype Traits

| Archetype | Assertiveness | Cooperativeness | Economic Focus | Risk Tolerance |
|-----------|---------------|-----------------|----------------|----------------|
| Aggressive | 70-100 | 20-60 | 30-70 | 70-100 |
| Isolationist | 20-50 | 0-40 | 40-80 | 20-60 |
| Mercantile | 30-60 | 50-80 | 75-100 | 40-70 |
| Diplomatic | 20-50 | 80-100 | 40-70 | 30-60 |
| Expansionist | 60-100 | 60-85 | 50-80 | 60-90 |
| Defensive | 0-40 | 60-100 | 30-60 | 20-50 |
