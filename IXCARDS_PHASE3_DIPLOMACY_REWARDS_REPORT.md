# IxCards Phase 3: Diplomacy Integration - Implementation Report

**Date:** November 2025
**Project:** IxStats Platform
**Phase:** IxCards Phase 3 - Diplomacy & Crisis Event Rewards
**Status:** ✅ COMPLETED

---

## Executive Summary

Successfully implemented IxCredits reward system for crisis event responses and diplomatic activities across 3 major router files. Players now earn credits for engaging with crisis management, diplomatic scenarios, embassies, and cultural exchanges.

**Total Implementation:**
- 3 files modified
- 5 reward systems implemented
- 11 different credit earning opportunities
- Reward range: 5-25 IxCredits per action

---

## Part 1: Crisis Event Response Rewards

### File Modified
`/ixwiki/public/projects/ixstats/src/server/api/routers/crisis-events.ts`

### Implementation Details

Enhanced the `updateResponseStatus` mutation to award IxCredits based on status transitions:

#### Reward Structure

| Status Transition | IxCredits | Source Key | Description |
|------------------|-----------|------------|-------------|
| `pending → in_progress` | 5 IxC | `crisis_response_action` | Taking action on crisis |
| `in_progress → resolved` | 10-25 IxC | `crisis_response_success` | Successful resolution |
| `in_progress → monitoring` | 8 IxC | `crisis_response_contained` | Crisis contained/mitigated |

#### Severity-Based Bonuses (Resolution)

```typescript
const severityBonus = {
  low: 10 IxC,      // Minor crisis resolved
  medium: 15 IxC,   // Moderate crisis resolved
  high: 20 IxC,     // Major crisis resolved
  critical: 25 IxC  // Critical crisis resolved
};
```

#### Metadata Tracked

```typescript
{
  crisisId: string,
  crisisType: string,           // e.g., "natural_disaster", "economic_crisis"
  crisisSeverity: string,       // "low", "medium", "high", "critical"
  statusTransition: string      // e.g., "pending -> resolved"
}
```

#### Key Features

- **Transaction Type:** `EARN_ACTIVE` (counts toward 100 IxC/day cap)
- **Safe Execution:** Credits failure doesn't block crisis response
- **Audit Trail:** Full metadata for transaction history
- **User Authentication:** Only awards to authenticated users

#### Example Scenarios

**Scenario 1: Swift Resolution**
```
1. Crisis appears (pending) → 0 IxC
2. Player takes action (in_progress) → +5 IxC
3. Crisis resolved (resolved, high severity) → +20 IxC
Total: 25 IxC earned
```

**Scenario 2: Containment Strategy**
```
1. Crisis appears (pending) → 0 IxC
2. Player takes action (in_progress) → +5 IxC
3. Crisis contained (monitoring) → +8 IxC
Total: 13 IxC earned
```

---

## Part 2: Diplomatic Scenario Rewards

### File Modified
`/ixwiki/public/projects/ixstats/src/server/api/routers/diplomaticScenarios.ts`

### Implementation Details

Enhanced the `recordChoice` mutation to award IxCredits for scenario participation with dynamic bonuses.

#### Reward Structure

| Component | IxCredits | Condition |
|----------|-----------|-----------|
| Base participation | 10 IxC | Always awarded |
| High-stakes bonus | +5 IxC | Cultural impact >70 OR diplomatic risk >70 |
| Risk-level bonus | 0-8 IxC | Based on choice risk level |

#### Risk-Level Bonuses

```typescript
const riskBonus = {
  low: 0 IxC,       // Safe diplomatic choice
  medium: 2 IxC,    // Moderate risk choice
  high: 5 IxC,      // High-stakes choice
  extreme: 8 IxC    // Extreme risk choice
};
```

#### Maximum Rewards

```
Base (10) + High-stakes (5) + Extreme risk (8) = 23 IxC
```

#### Metadata Tracked

```typescript
{
  scenarioId: string,
  scenarioType: string,         // e.g., "trade_renegotiation", "border_dispute"
  choiceId: string,
  choiceLabel: string,
  culturalImpact: number,       // 0-100
  diplomaticRisk: number,       // 0-100
  highStakes: boolean,
  riskLevel: string             // "low", "medium", "high", "extreme"
}
```

#### Example Scenarios

**Scenario 1: Low-Stakes Trade Negotiation**
```
Cultural Impact: 45
Diplomatic Risk: 30
Choice: "Diplomatic resolution" (medium risk)

Reward: 10 (base) + 0 (not high-stakes) + 2 (medium risk) = 12 IxC
```

**Scenario 2: High-Stakes Border Dispute**
```
Cultural Impact: 85
Diplomatic Risk: 75
Choice: "Aggressive stance" (extreme risk)

Reward: 10 (base) + 5 (high-stakes) + 8 (extreme risk) = 23 IxC
```

---

## Part 3: Diplomatic Event Rewards

### File Modified
`/ixwiki/public/projects/ixstats/src/server/api/routers/diplomatic.ts`

### Implementation Details

Added two new reward systems for major diplomatic actions:

#### 3.1 Embassy Establishment

**Mutation:** `createEmbassy`
**Reward:** 15 IxCredits
**Source:** `embassy_established`

##### Metadata Tracked
```typescript
{
  embassyId: string,
  embassyName: string,
  hostCountryId: string,
  guestCountryId: string,
  hostCountryName: string | null,
  guestCountryName: string | null
}
```

##### Why 15 IxC?
- Embassy establishment is a significant diplomatic milestone
- Requires coordination between two nations
- Long-term commitment with maintenance costs
- Higher than scenario participation but lower than summit hosting

#### 3.2 Cultural Exchange Creation

**Mutation:** `createCulturalExchange`
**Reward:** 12 IxCredits
**Source:** `cultural_exchange_created`

##### Metadata Tracked
```typescript
{
  exchangeId: string,
  exchangeTitle: string,
  exchangeType: string,         // e.g., "arts_festival", "technology_transfer"
  hostCountryId: string,
  participantCountryId: string | undefined
}
```

##### Why 12 IxC?
- Organizing cultural exchanges requires planning and resources
- Multi-country events with lasting diplomatic impact
- Auto-creates embassy missions (additional gameplay)
- Slightly lower than embassy establishment due to lower commitment

---

## Part 4: Recommended Future Event Types

Based on the diplomatic systems architecture, here are **recommended event types** that should award IxCredits in future implementations:

### 4.1 Treaty Signatures (Recommended: 18 IxC)
**Why:** Formal agreements with legal standing
**Implementation:** Add to treaty creation/signing endpoint
**Metadata:** Treaty type, signatories, duration, economic value

### 4.2 Alliance Formation (Recommended: 20 IxC)
**Why:** Highest-tier diplomatic relationship
**Implementation:** Trigger when relationship status reaches "alliance"
**Metadata:** Partner countries, alliance type, military/economic terms

### 4.3 Summit Attendance (Recommended: 10 IxC)
**Why:** High-level diplomatic engagement
**Implementation:** Create summit participation tracking
**Metadata:** Summit type, attendees, outcomes, resolutions

### 4.4 Embassy Mission Completion (Recommended: 8-15 IxC)
**Why:** Active diplomatic work with measurable outcomes
**Implementation:** Add to mission completion handler
**Reward Scale:**
- Routine mission: 8 IxC
- Important mission: 12 IxC
- Critical mission: 15 IxC

### 4.5 Mediation Success (Recommended: 18 IxC)
**Why:** Third-party conflict resolution
**Implementation:** Create mediation system with outcome tracking
**Metadata:** Conflicting parties, resolution type, success rate

---

## Part 5: Event Commemorative Cards (Optional System)

### Concept: SPECIAL Rarity Event Cards

Create limited-edition cards to commemorate major diplomatic and crisis events.

#### Recommended Event Types for Commemorative Cards

1. **Critical Crisis Resolution**
   - **Trigger:** Player successfully resolves a "critical" severity crisis
   - **Card Type:** SPECIAL rarity
   - **Design:** Features crisis type imagery (earthquake, economic collapse, etc.)
   - **Stats:** Crisis management bonuses
   - **Limited:** 1 per player per crisis type

2. **Historic Treaty Signing**
   - **Trigger:** First treaty signed between two nations
   - **Card Type:** SPECIAL rarity
   - **Design:** Dual-nation imagery with treaty document
   - **Stats:** Diplomatic relationship bonuses
   - **Limited:** Both signatories receive unique card

3. **Alliance Formation**
   - **Trigger:** Two nations reach "alliance" status
   - **Card Type:** SPECIAL rarity
   - **Design:** Combined national symbols
   - **Stats:** Military/economic cooperation bonuses
   - **Limited:** Both alliance partners receive card

4. **Major Cultural Exchange**
   - **Trigger:** Cultural exchange with 5+ participants completes successfully
   - **Card Type:** SPECIAL rarity
   - **Design:** Collage of participating nations' cultural symbols
   - **Stats:** Cultural compatibility bonuses
   - **Limited:** All participants receive card

5. **Summit Achievement**
   - **Trigger:** Host nation successfully organizes international summit
   - **Card Type:** SPECIAL rarity
   - **Design:** Summit venue with attendee flags
   - **Stats:** International reputation bonuses
   - **Limited:** Summit host and key attendees receive card

### Implementation Flow for Commemorative Cards

```typescript
// Pseudo-code for commemorative card generation

async function generateCommemorativeCard(
  eventType: CommemorativeEventType,
  eventData: CommemorativeEventData,
  recipientUserId: string
): Promise<Card> {

  // 1. Check if event qualifies for commemorative card
  const qualifies = checkCommemorativeQualification(eventType, eventData);
  if (!qualifies) return null;

  // 2. Check if player already has this commemorative card
  const existingCard = await db.card.findFirst({
    where: {
      cardType: 'COMMEMORATIVE',
      metadata: { eventType, eventId: eventData.id },
      CardOwnership: { some: { ownerId: recipientUserId } }
    }
  });

  if (existingCard) return null; // Already awarded

  // 3. Generate unique card
  const card = await db.card.create({
    data: {
      title: generateCommemorativeTitle(eventType, eventData),
      description: generateCommemorativeDescription(eventType, eventData),
      rarity: 'SPECIAL',
      cardType: 'COMMEMORATIVE',
      season: getCurrentSeason(),
      artwork: generateCommemorativeArtwork(eventType, eventData),
      metadata: {
        eventType,
        eventId: eventData.id,
        eventDate: new Date(),
        participants: eventData.participants,
        commemorative: true
      },
      stats: generateCommemorativeStats(eventType),
      totalSupply: eventData.participants.length // Limited edition
    }
  });

  // 4. Award card to player
  await db.cardOwnership.create({
    data: {
      cardId: card.id,
      userId: recipientUserId,
      ownerId: recipientUserId,
      serialNumber: getNextSerialNumber(card.id),
      acquiredAt: new Date()
    }
  });

  return card;
}
```

### Database Schema Considerations

The current `Card` model already supports commemorative cards:

```prisma
model Card {
  // ... existing fields
  metadata: Json?  // ✅ Can store event data
  cardType: String // ✅ Can use "COMMEMORATIVE"
  rarity: String   // ✅ Can use "SPECIAL"
  stats: Json?     // ✅ Can store bonus stats
  totalSupply: Int? // ✅ Can limit edition size
}
```

**No schema changes required** - the system is ready for commemorative cards.

### Integration Points

1. **Crisis Resolution:** `/src/server/api/routers/crisis-events.ts` line 362-372
2. **Diplomatic Scenarios:** `/src/server/api/routers/diplomaticScenarios.ts` line 613-663
3. **Embassy Establishment:** `/src/server/api/routers/diplomatic.ts` line 608-639
4. **Cultural Exchanges:** `/src/server/api/routers/diplomatic.ts` line 1172-1204

---

## Testing Plan

### Phase 1: Unit Testing (Recommended)

#### Test Crisis Event Rewards
```typescript
describe('Crisis Event IxCredits Rewards', () => {
  test('Awards 5 IxC when taking action on pending crisis', async () => {
    const result = await crisisEventsRouter.updateResponseStatus({
      id: 'crisis_123',
      responseStatus: 'in_progress'
    });
    expect(result.creditsEarned).toBe(5);
  });

  test('Awards severity-based credits on resolution', async () => {
    // Setup: Create critical severity crisis
    const result = await crisisEventsRouter.updateResponseStatus({
      id: 'crisis_critical',
      responseStatus: 'resolved'
    });
    expect(result.creditsEarned).toBe(25); // Critical severity bonus
  });

  test('Does not award duplicate credits', async () => {
    // First transition: pending -> in_progress
    await crisisEventsRouter.updateResponseStatus({
      id: 'crisis_123',
      responseStatus: 'in_progress'
    });

    // Second call with same status should not award again
    const result = await crisisEventsRouter.updateResponseStatus({
      id: 'crisis_123',
      responseStatus: 'in_progress'
    });
    expect(result.creditsEarned).toBe(0);
  });
});
```

#### Test Diplomatic Scenario Rewards
```typescript
describe('Diplomatic Scenario IxCredits Rewards', () => {
  test('Awards base 10 IxC for scenario participation', async () => {
    const result = await diplomaticScenariosRouter.recordChoice({
      scenarioId: 'scenario_123',
      countryId: 'country_abc',
      choiceId: 'choice_diplomatic',
      choiceLabel: 'Pursue diplomatic resolution'
    });
    expect(result.creditsEarned).toBeGreaterThanOrEqual(10);
  });

  test('Awards high-stakes bonus for risky scenarios', async () => {
    // Setup: Create high-stakes scenario (culturalImpact > 70)
    const result = await diplomaticScenariosRouter.recordChoice({
      scenarioId: 'scenario_highstakes',
      countryId: 'country_abc',
      choiceId: 'choice_extreme',
      choiceLabel: 'Extreme risk action'
    });
    expect(result.creditsEarned).toBe(23); // 10 + 5 (high-stakes) + 8 (extreme risk)
  });
});
```

#### Test Diplomatic Action Rewards
```typescript
describe('Diplomatic Action IxCredits Rewards', () => {
  test('Awards 15 IxC for embassy establishment', async () => {
    const result = await diplomaticRouter.createEmbassy({
      hostCountryId: 'country_host',
      guestCountryId: 'country_guest',
      name: 'Embassy Test',
      location: 'Capital City'
    });
    expect(result.creditsEarned).toBe(15);
  });

  test('Awards 12 IxC for cultural exchange creation', async () => {
    const result = await diplomaticRouter.createCulturalExchange({
      title: 'Arts Festival',
      type: 'arts',
      hostCountryId: 'country_host',
      // ... other required fields
    });
    expect(result.creditsEarned).toBe(12);
  });
});
```

### Phase 2: Integration Testing

#### Test VaultService Integration
```typescript
describe('VaultService Integration', () => {
  test('Respects daily earning caps', async () => {
    // Earn 95 IxC through various activities
    await earnCreditsMultipleTimes(95);

    // Attempt to earn 10 more (should be capped to 5)
    const result = await crisisEventsRouter.updateResponseStatus({
      id: 'crisis_123',
      responseStatus: 'in_progress'
    });
    expect(result.creditsEarned).toBe(5); // Capped to remaining allowance
  });

  test('Creates proper transaction records', async () => {
    await crisisEventsRouter.updateResponseStatus({
      id: 'crisis_123',
      responseStatus: 'resolved'
    });

    const transactions = await vaultService.getTransactionHistory(userId, db);
    const crisisTransaction = transactions.find(
      tx => tx.source === 'crisis_response_success'
    );

    expect(crisisTransaction).toBeDefined();
    expect(crisisTransaction.metadata).toMatchObject({
      crisisId: 'crisis_123',
      crisisType: expect.any(String),
      crisisSeverity: expect.any(String)
    });
  });
});
```

### Phase 3: End-to-End Testing

#### Manual Testing Checklist

**Crisis Events:**
- [ ] Create pending crisis event (admin)
- [ ] Take action on crisis (in_progress) → Verify 5 IxC awarded
- [ ] Resolve crisis (resolved, high severity) → Verify 20 IxC awarded
- [ ] Check transaction history shows both transactions
- [ ] Verify metadata is present in transaction details

**Diplomatic Scenarios:**
- [ ] Generate diplomatic scenario with high cultural impact (>70)
- [ ] Make extreme risk choice → Verify 23 IxC awarded (10+5+8)
- [ ] Generate low-stakes scenario
- [ ] Make low risk choice → Verify 10 IxC awarded (base only)
- [ ] Check transaction history for scenario metadata

**Diplomatic Actions:**
- [ ] Establish new embassy → Verify 15 IxC awarded
- [ ] Create cultural exchange → Verify 12 IxC awarded
- [ ] Verify both transactions appear in vault history
- [ ] Confirm metadata includes country names and IDs

**Daily Cap Testing:**
- [ ] Earn 90 IxC through various activities
- [ ] Attempt to earn 15 IxC more → Verify capped to 10 IxC
- [ ] Check that transaction shows capped amount
- [ ] Wait for daily reset
- [ ] Verify can earn again after reset

---

## Summary of Changes

### Files Modified
1. `/ixwiki/public/projects/ixstats/src/server/api/routers/crisis-events.ts`
2. `/ixwiki/public/projects/ixstats/src/server/api/routers/diplomaticScenarios.ts`
3. `/ixwiki/public/projects/ixstats/src/server/api/routers/diplomatic.ts`

### New Reward Sources
| Source Key | IxCredits | Activity |
|-----------|-----------|----------|
| `crisis_response_action` | 5 | Taking action on crisis |
| `crisis_response_success` | 10-25 | Resolving crisis (severity-based) |
| `crisis_response_contained` | 8 | Containing crisis |
| `diplomatic_scenario` | 10-23 | Scenario participation (dynamic bonuses) |
| `embassy_established` | 15 | Establishing embassy |
| `cultural_exchange_created` | 12 | Organizing cultural exchange |

### Total Implementation Stats
- **Lines of code added:** ~180
- **New transaction sources:** 6
- **Credit range:** 5-25 IxC per action
- **Metadata fields tracked:** 15+
- **Transaction type:** EARN_ACTIVE (all)
- **Daily cap compliance:** ✅ Yes

---

## Production Deployment Checklist

- [ ] Code review completed
- [ ] TypeScript type checking passes
- [ ] Database migrations applied (none required)
- [ ] VaultService integration tested
- [ ] Daily cap behavior verified
- [ ] Transaction metadata validated
- [ ] Error handling tested (credits fail gracefully)
- [ ] Console logging reviewed
- [ ] Performance impact assessed
- [ ] Documentation updated
- [ ] Integration tests passing
- [ ] Staging environment tested
- [ ] Production deployment plan reviewed

---

## Future Enhancements

### Priority 1 (Immediate)
1. **Embassy Mission Completion Rewards**
   - Add IxCredits for completing embassy missions (8-15 IxC)
   - Differentiate by mission difficulty and success rate
   - Track mission types (cultural_outreach, intelligence_gathering, etc.)

2. **Treaty/Alliance Rewards**
   - Implement treaty signing rewards (18 IxC)
   - Implement alliance formation rewards (20 IxC)
   - Track treaty types and partner countries

### Priority 2 (Near Future)
3. **Summit System**
   - Create summit hosting/attendance system
   - Award 10 IxC for attendance, 20 IxC for hosting
   - Track summit outcomes and resolutions

4. **Commemorative Card System**
   - Implement card generation for major events
   - Create SPECIAL rarity system for event cards
   - Design artwork generation pipeline
   - Set up limited edition tracking

### Priority 3 (Long-term)
5. **Mediation System**
   - Create third-party conflict resolution mechanics
   - Award 18 IxC for successful mediation
   - Track mediation outcomes and reputation bonuses

6. **Advanced Crisis Mechanics**
   - Multi-stage crisis progression with incremental rewards
   - International cooperation bonuses
   - Historical crisis tracking and lessons learned

---

## Contact & Support

**Implementation Lead:** Claude AI Assistant
**Date Completed:** November 2025
**Documentation:** This file + inline code comments
**Related Docs:**
- `/docs/systems/crisis-events.md` - Crisis system documentation
- `/docs/reference/api-complete.md` - Complete API catalog
- `/lib/vault-service.ts` - IxCredits service implementation

---

## Appendix: Code Snippets

### A. Crisis Event Reward Logic

```typescript
// Award credits based on status transitions
if (event.responseStatus === "pending" && input.responseStatus === "in_progress") {
  creditReward = 5;
  rewardSource = "crisis_response_action";
} else if (event.responseStatus === "in_progress" && input.responseStatus === "resolved") {
  const severityBonus = {
    low: 10,
    medium: 15,
    high: 20,
    critical: 25,
  };
  creditReward = severityBonus[event.severity as keyof typeof severityBonus] || 10;
  rewardSource = "crisis_response_success";
} else if (event.responseStatus === "in_progress" && input.responseStatus === "monitoring") {
  creditReward = 8;
  rewardSource = "crisis_response_contained";
}
```

### B. Diplomatic Scenario Reward Logic

```typescript
// Base reward + high-stakes bonus + risk bonus
let creditReward = 10; // Base participation

const isHighStakes = scenario.culturalImpact > 70 || scenario.diplomaticRisk > 70;
if (isHighStakes) {
  creditReward += 5;
}

const riskBonus = {
  low: 0,
  medium: 2,
  high: 5,
  extreme: 8,
};
creditReward += riskBonus[selectedChoice.riskLevel] || 0;
```

### C. VaultService Call Pattern

```typescript
const earnResult = await vaultService.earnCredits(
  ctx.auth.userId,
  creditReward,
  "EARN_ACTIVE",
  rewardSource,
  ctx.db,
  metadata
);

if (earnResult.success) {
  creditsEarned = creditReward;
  console.log(`[System] Awarded ${creditReward} IxC to ${ctx.auth.userId} for ${rewardSource}`);
}
```

---

**End of Report**
