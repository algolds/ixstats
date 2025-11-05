# NPC Personality & Behavioral AI System

**Last updated:** November 2025

Comprehensive system that creates distinct personalities for NPC countries based on observable database data and drives their diplomatic behavior, event responses, and relationship evolution.

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Personality Traits](#personality-traits)
3. [Trait Calculation](#trait-calculation)
4. [Personality Archetypes](#personality-archetypes)
5. [Behavioral Prediction](#behavioral-prediction)
6. [Personality Drift](#personality-drift)
7. [Integration with Diplomatic Systems](#integration-with-diplomatic-systems)

---

## Design Philosophy

### Core Principles
- **Data-Driven**: Personalities emerge from observable actions and relationships
- **Dynamic**: Traits evolve based on experiences and player interactions
- **Consistent**: Behavior remains predictable within archetype boundaries
- **Transparent**: System shows why NPCs make certain decisions

### Key Features
- 8 core personality traits (0-100 scale)
- 6 distinct personality archetypes
- Behavioral response prediction system
- Event modifier calculation
- Personality drift algorithm (max ±2 points per IxTime year)
- Decision-making for player proposals

---

## Personality Traits

All traits are measured on a 0-100 scale, calculated from observable database data.

### 1. Assertiveness (0-100)

**Definition:** Willingness to take strong diplomatic stances and push for national interests.

**Behavioral Spectrum:**
- **High (75-100)**: Confrontational, demands concessions, issues ultimatums
- **Medium (40-74)**: Balanced approach, strategic positioning
- **Low (0-39)**: Accommodating, prefers compromise, avoids confrontation

**Data Sources:**
- Hostile relationships: +10 points per hostile relationship
- Low-strength relationships (<30): +5 points per weak relationship
- Conflict history: +2 points per recorded conflict
- Failed negotiations: +3 points per breakdown

**Formula:**
```typescript
baseAssertiveness = 50;
assertiveness = baseAssertiveness +
  (hostileRelationships * 10) +
  (weakRelationships * 5) +
  (conflictCount * 2) +
  (failedNegotiations * 3);
normalized = clamp(assertiveness, 0, 100);
```

**Example:**
```
NPC Country "Valoria":
- 2 hostile relationships: 2 * 10 = 20
- 3 weak relationships: 3 * 5 = 15
- 1 recorded conflict: 1 * 2 = 2
- 0 failed negotiations: 0

assertiveness = 50 + 20 + 15 + 2 + 0 = 87
Result: HIGH ASSERTIVENESS (Confrontational stance)
```

### 2. Cooperativeness (0-100)

**Definition:** Preference for multilateral solutions and working with partners.

**Behavioral Spectrum:**
- **High (75-100)**: Seeks alliances, proposes joint initiatives, values consensus
- **Medium (40-74)**: Selective cooperation, tactical partnerships
- **Low (0-39)**: Unilateral action, go-it-alone approach, skeptical of partnerships

**Data Sources:**
- Alliance count: +15 points per formal alliance
- Friendly relationships (>70): +8 points per friendly nation
- Treaty participation: +5 points per active treaty
- Joint missions: +3 points per cooperative mission

**Formula:**
```typescript
baseCooperativeness = 50;
cooperativeness = baseCooperativeness +
  (allianceCount * 15) +
  (friendlyRelationships * 8) +
  (activeTreaties * 5) +
  (jointMissions * 3);
normalized = clamp(cooperativeness, 0, 100);
```

**Example:**
```
NPC Country "Harmonia":
- 3 alliances: 3 * 15 = 45
- 5 friendly relationships: 5 * 8 = 40
- 4 active treaties: 4 * 5 = 20
- 2 joint missions: 2 * 3 = 6

cooperativeness = 50 + 45 + 40 + 20 + 6 = 161 → capped at 100
Result: MAXIMUM COOPERATIVENESS (Multilateral champion)
```

### 3. Economic Focus (0-100)

**Definition:** Prioritization of trade and economic concerns over other policy areas.

**Behavioral Spectrum:**
- **High (75-100)**: Trade deals prioritized, economic leverage used, merchant diplomacy
- **Medium (40-74)**: Balanced economic policy, pragmatic trade
- **Low (0-39)**: Economics subordinate to security/ideology, willing to sacrifice trade

**Data Sources:**
- Trade volume: +(tradeToGDP * 0.5) points
- Trade treaties: +12 points per trade agreement
- Economic embassy specializations: +8 points per economic embassy
- Cultural exchange level: +5 points per exchange program

**Formula:**
```typescript
baseEconomicFocus = 50;
economicFocus = baseEconomicFocus +
  (tradeToGDP * 0.5) +
  (tradeTreaties * 12) +
  (economicEmbassies * 8) +
  (culturalExchanges * 5);
normalized = clamp(economicFocus, 0, 100);
```

### 4. Cultural Openness (0-100)

**Definition:** Receptiveness to cultural exchanges and soft power initiatives.

**Behavioral Spectrum:**
- **High (75-100)**: Embraces exchanges, promotes culture, values people-to-people ties
- **Medium (40-74)**: Selective cultural engagement
- **Low (0-39)**: Protective of culture, limited exchanges, nationalist tendencies

**Data Sources:**
- Cultural exchange participation: +10 points per active exchange
- Cultural embassies: +8 points per cultural-focus embassy
- Exchange program level: +15 points for high-level programs
- International events: +5 points per hosted/participated event

### 5. Risk Tolerance (0-100)

**Definition:** Willingness to engage in risky or unconventional diplomatic moves.

**Behavioral Spectrum:**
- **High (75-100)**: Bold initiatives, gambling on outcomes, crisis escalation willing
- **Medium (40-74)**: Calculated risks, strategic timing
- **Low (0-39)**: Cautious, incremental, status quo preservation

**Data Sources:**
- Hostile relationships: +8 points per hostile relationship
- Deteriorating relations: +6 points per declining relationship
- Policy volatility: +5 points per major policy shift
- Failed initiatives: -10 points per significant failure

**Formula:**
```typescript
baseRiskTolerance = 50;
riskTolerance = baseRiskTolerance +
  (hostileRelationships * 8) +
  (deterioratingRelations * 6) +
  (policyShifts * 5) -
  (failedInitiatives * 10);
normalized = clamp(riskTolerance, 0, 100);
```

### 6. Ideological Rigidity (0-100)

**Definition:** Adherence to principles vs pragmatic flexibility.

**Behavioral Spectrum:**
- **High (75-100)**: Principled stances, ideological consistency, hard to compromise
- **Medium (40-74)**: Balanced pragmatism
- **Low (0-39)**: Pragmatic, flexible, willing to shift positions for gains

**Data Sources:**
- Policy consistency: +(100 - policyVolatilityIndex)
- Relationship volatility: -(relationshipFluctuations * 5)
- Alliance stability: +allianceDuration / 12 (months)
- Ideological partners: +10 points per similar-ideology partner

### 7. Militarism (0-100)

**Definition:** Preference for security and defense policies over other approaches.

**Behavioral Spectrum:**
- **High (75-100)**: Security-focused, defense alliances prioritized, threat perception high
- **Medium (40-74)**: Balanced security approach
- **Low (0-39)**: Diplomacy-first, minimal defense posture, cooperative security

**Data Sources:**
- Security embassies: +12 points per security-focus embassy
- Defense treaties: +15 points per mutual defense pact
- Tense/hostile relationships: +8 points per tense/hostile relationship
- Military budget: +(militaryBudgetPercent * 2) points

### 8. Isolationism (0-100)

**Definition:** Preference for limited engagement vs active international participation.

**Behavioral Spectrum:**
- **High (75-100)**: Minimal engagement, selective relationships, self-reliance focus
- **Medium (40-74)**: Strategic engagement
- **Low (0-39)**: Active internationalism, broad engagement, global participation

**Data Sources:**
- Embassy count: -(embassyCount * 3) points
- Treaty participation: -(activeTreaties * 5) points
- Relationship count: -(relationships * 2) points
- Regional focus: +20 if >80% relationships in same region

---

## Trait Calculation

### Calculation Pipeline

**Step 1: Gather Database Metrics**
```typescript
const metrics = await db.query(`
  SELECT
    COUNT(CASE WHEN strength < 30 THEN 1 END) as hostile_count,
    COUNT(CASE WHEN strength > 70 THEN 1 END) as friendly_count,
    COUNT(embassy_id) as embassy_count,
    COUNT(CASE WHEN type = 'TRADE' THEN 1 END) as trade_treaties,
    AVG(relationship_strength) as avg_relationship
  FROM diplomatic_relations
  WHERE country_id = $1
`);
```

**Step 2: Calculate Each Trait**
```typescript
const traits: PersonalityTraits = {
  assertiveness: calculateAssertiveness(metrics),
  cooperativeness: calculateCooperativeness(metrics),
  economicFocus: calculateEconomicFocus(metrics),
  culturalOpenness: calculateCulturalOpenness(metrics),
  riskTolerance: calculateRiskTolerance(metrics),
  ideologicalRigidity: calculateIdeologicalRigidity(metrics),
  militarism: calculateMilitarism(metrics),
  isolationism: calculateIsolationism(metrics)
};
```

**Step 3: Normalize & Validate**
```typescript
// Ensure all traits are 0-100
Object.keys(traits).forEach(key => {
  traits[key] = Math.max(0, Math.min(100, traits[key]));
});
```

**Step 4: Cache Results**
```typescript
await db.npcPersonality.upsert({
  where: { countryId },
  update: { traits, lastCalculated: new Date() },
  create: { countryId, traits, archetype: null }
});
```

---

## Personality Archetypes

Six distinct archetypes derived from trait combinations.

### 1. Aggressive Expansionist

**Trait Profile:**
- Assertiveness: 75-100
- Risk Tolerance: 70-100
- Militarism: 60-100
- Cooperativeness: 0-40

**Behavior Patterns:**
- Demands concessions in negotiations
- Issues ultimatums when relationships deteriorate
- Pursues territorial or influence expansion
- Low tolerance for perceived slights
- Quick to escalate conflicts

**Diplomatic Approach:**
- "Submit or face consequences"
- Leverages military/economic strength
- Views diplomacy as tool for gaining advantage
- Minimal compromise

**Example Response to Trade Proposal:**
```
Acceptance Probability: 25% (only if highly favorable)
Counter-Proposal: 70% (demands additional concessions)
Rejection: 5%
```

### 2. Pragmatic Trader

**Trait Profile:**
- Economic Focus: 75-100
- Cooperativeness: 60-90
- Assertiveness: 40-70
- Ideological Rigidity: 0-40

**Behavior Patterns:**
- Prioritizes economic benefits
- Willing to work with diverse partners
- Flexible on ideology for economic gains
- Builds extensive trade networks
- Uses economic leverage diplomatically

**Diplomatic Approach:**
- "What's in it for both of us?"
- Win-win focus
- Trade-first policy
- Pragmatic alliances

**Example Response to Trade Proposal:**
```
Acceptance Probability: 75% (if economically sensible)
Counter-Proposal: 20% (optimization tweaks)
Rejection: 5% (only if clearly disadvantageous)
```

### 3. Cultural Diplomat

**Trait Profile:**
- Cultural Openness: 75-100
- Cooperativeness: 70-100
- Isolationism: 0-30
- Assertiveness: 30-60

**Behavior Patterns:**
- Emphasizes soft power
- Promotes cultural exchanges
- Builds people-to-people connections
- Patient negotiation style
- Values long-term relationships

**Diplomatic Approach:**
- "Let's understand each other"
- Exchange programs prioritized
- Educational/cultural initiatives
- Consensus-building

**Example Response to Cultural Exchange Proposal:**
```
Acceptance Probability: 90% (strongly favors exchanges)
Counter-Proposal: 8% (expansion suggestions)
Rejection: 2% (only if serious cultural conflicts)
```

### 4. Defensive Isolationist

**Trait Profile:**
- Isolationism: 75-100
- Risk Tolerance: 0-40
- Cooperativeness: 0-40
- Assertiveness: Variable

**Behavior Patterns:**
- Minimal international engagement
- Protective of sovereignty
- Reluctant to join multilateral initiatives
- Suspicious of foreign influence
- Slow to respond to proposals

**Diplomatic Approach:**
- "We prefer to handle our own affairs"
- Self-reliance focus
- Selective engagement
- High threshold for participation

**Example Response to Alliance Proposal:**
```
Acceptance Probability: 15% (only critical security needs)
Counter-Proposal: 10% (limited scope alternatives)
Rejection: 75% (default response)
```

### 5. Ideological Crusader

**Trait Profile:**
- Ideological Rigidity: 75-100
- Assertiveness: 60-90
- Cooperativeness: 30-60 (only with like-minded)
- Cultural Openness: Variable

**Behavior Patterns:**
- Values over pragmatism
- Seeks ideological allies
- Confronts ideological opponents
- Unwilling to compromise principles
- Proselytizes worldview

**Diplomatic Approach:**
- "Join us or oppose us"
- Ideological litmus tests
- Principled stances
- Alliance based on shared values

**Example Response to Proposal from Ideological Opponent:**
```
Acceptance Probability: 5% (only overwhelming benefit)
Counter-Proposal: 15% (demands ideological concessions)
Rejection: 80% (principle-based)
```

### 6. Security Hawk

**Trait Profile:**
- Militarism: 75-100
- Risk Tolerance: 50-85
- Assertiveness: 60-90
- Cooperativeness: 40-70 (security-focused)

**Behavior Patterns:**
- Threat-focused worldview
- Prioritizes defense alliances
- Quick to perceive threats
- Willing to use hard power
- Security dominates policy

**Diplomatic Approach:**
- "Peace through strength"
- Military alliances prioritized
- Threat assessments guide policy
- Defensive posturing

**Example Response to Defense Pact Proposal:**
```
Acceptance Probability: 80% (high security value)
Counter-Proposal: 15% (strengthen commitments)
Rejection: 5% (only if partner unreliable)
```

---

## Behavioral Prediction

### Decision-Making Algorithm

```typescript
function predictResponse(
  personality: PersonalityTraits,
  archetype: PersonalityArchetype,
  proposal: DiplomaticProposal,
  relationshipStrength: number,
  historicalContext: DiplomaticHistory
): ResponseProbability {

  // Base acceptance score from relationship
  let acceptanceScore = relationshipStrength; // 0-100

  // Trait-based modifiers
  if (proposal.type === 'TRADE_AGREEMENT') {
    acceptanceScore += personality.economicFocus * 0.3;
    acceptanceScore += personality.cooperativeness * 0.2;
    acceptanceScore -= personality.isolationism * 0.15;
  }

  if (proposal.type === 'MILITARY_ALLIANCE') {
    acceptanceScore += personality.militarism * 0.4;
    acceptanceScore += personality.cooperativeness * 0.25;
    acceptanceScore -= personality.isolationism * 0.3;
  }

  if (proposal.type === 'CULTURAL_EXCHANGE') {
    acceptanceScore += personality.culturalOpenness * 0.5;
    acceptanceScore += personality.cooperativeness * 0.2;
  }

  // Proposal characteristics
  if (proposal.requiresConcession) {
    acceptanceScore -= personality.assertiveness * 0.4;
  }

  if (proposal.isRisky) {
    acceptanceScore += (personality.riskTolerance - 50) * 0.3;
  }

  if (proposal.hasIdeologicalComponent) {
    const ideologicalAlignment = calculateIdeologicalAlignment();
    if (personality.ideologicalRigidity > 70) {
      acceptanceScore += ideologicalAlignment * 0.6;
    }
  }

  // Historical context modifiers
  if (historicalContext.recentConflict) {
    acceptanceScore *= 0.7;
  }

  if (historicalContext.pastCooperation) {
    acceptanceScore *= 1.15;
  }

  if (historicalContext.brokenPromises > 0) {
    acceptanceScore *= (1 - historicalContext.brokenPromises * 0.1);
  }

  // Regional context
  if (proposal.fromRegionalPartner && personality.isolationism < 50) {
    acceptanceScore *= 1.1;
  }

  // Archetype-specific adjustments
  acceptanceScore = applyArchetypeModifiers(
    acceptanceScore,
    archetype,
    proposal
  );

  // Normalize and distribute probabilities
  acceptanceScore = clamp(acceptanceScore, 0, 100);

  return {
    accept: acceptanceScore,
    counter: Math.max(0, 100 - acceptanceScore - 20),
    reject: Math.max(0, 50 - acceptanceScore)
  };
}
```

### Concrete Example

**Scenario:** Player proposes trade agreement with NPC "Valoria"

**Valoria's Profile:**
```typescript
traits: {
  assertiveness: 87,
  cooperativeness: 45,
  economicFocus: 72,
  culturalOpenness: 38,
  riskTolerance: 65,
  ideologicalRigidity: 58,
  militarism: 82,
  isolationism: 35
}
archetype: "Security Hawk"
relationshipStrength: 55
```

**Proposal Details:**
```typescript
{
  type: 'TRADE_AGREEMENT',
  requiresConcession: false,
  isRisky: false,
  economicBenefit: 'moderate',
  hasIdeologicalComponent: false
}
```

**Calculation:**
```
Base score: 55 (relationship strength)

Trade agreement modifiers:
+ economicFocus * 0.3 = 72 * 0.3 = +21.6
+ cooperativeness * 0.2 = 45 * 0.2 = +9.0
- isolationism * 0.15 = 35 * 0.15 = -5.25

Running total: 55 + 21.6 + 9.0 - 5.25 = 80.35

No concession required: +0
Not risky: +0
No recent conflict: *1.0
Security Hawk archetype: slight trade skepticism = *0.95

Final score: 80.35 * 0.95 = 76.33

Result:
- Accept: 76% probability
- Counter: 19% probability
- Reject: 5% probability

AI Decision: LIKELY ACCEPTANCE with 76% confidence
```

---

## Personality Drift

Personalities evolve gradually based on experiences. Maximum change: ±2 points per IxTime year per trait.

### Drift Triggers

**Positive Experiences:**
- Successful cooperation: +0.5 cooperativeness
- Economic gains from trade: +0.8 economicFocus
- Positive cultural exchanges: +0.6 culturalOpenness
- Resolved conflicts peacefully: -0.7 militarism

**Negative Experiences:**
- Conflicts: +1.0 assertiveness, +1.0 militarism
- Broken agreements: +0.8 isolationism, -0.9 cooperativeness
- Economic losses: -0.5 economicFocus, +0.6 riskTolerance
- Failed initiatives: -0.6 riskTolerance, +0.4 ideologicalRigidity

### Drift Algorithm

```typescript
async function applyPersonalityDrift(
  countryId: string,
  experienceSince: Date
): Promise<PersonalityTraits> {

  const experiences = await getRecentExperiences(countryId, experienceSince);
  const currentTraits = await getPersonalityTraits(countryId);
  const yearsElapsed = calculateIxTimeYears(experienceSince, new Date());
  const maxDrift = yearsElapsed * 2; // ±2 points per year

  const driftAccumulator = {
    assertiveness: 0,
    cooperativeness: 0,
    economicFocus: 0,
    culturalOpenness: 0,
    riskTolerance: 0,
    ideologicalRigidity: 0,
    militarism: 0,
    isolationism: 0
  };

  // Accumulate drift from each experience
  for (const exp of experiences) {
    const drift = calculateExperienceDrift(exp);
    Object.keys(drift).forEach(trait => {
      driftAccumulator[trait] += drift[trait];
    });
  }

  // Apply drift with maximum constraints
  const newTraits = { ...currentTraits };
  Object.keys(driftAccumulator).forEach(trait => {
    const cappedDrift = clamp(driftAccumulator[trait], -maxDrift, maxDrift);
    newTraits[trait] = clamp(
      currentTraits[trait] + cappedDrift,
      0,
      100
    );
  });

  // Log drift for transparency
  await logPersonalityDrift(countryId, currentTraits, newTraits, experiences);

  return newTraits;
}
```

### Example Drift Scenario

**Country:** "Harmonia" (initially Cooperative, Low Militarism)

**Year 1 Experiences:**
- 3 successful trade agreements: +2.4 economicFocus, +1.5 cooperativeness
- 1 cultural exchange: +0.6 culturalOpenness
- 0 conflicts

**Year 2 Experiences:**
- Border dispute with neighbor: +1.0 assertiveness, +1.0 militarism
- Failed peace initiative: -0.6 riskTolerance
- Economic recession: -0.5 economicFocus

**Trait Evolution:**
```
Initial State:
cooperativeness: 88, militarism: 25, economicFocus: 62

After Year 1:
cooperativeness: 88 + 1.5 = 89.5 (capped at 2pt/year) → 88
economicFocus: 62 + 2.4 → 64 (within limit)
culturalOpenness: 75 + 0.6 → 75.6

After Year 2:
assertiveness: 42 + 1.0 = 43
militarism: 25 + 1.0 = 26
riskTolerance: 55 - 0.6 = 54.4
economicFocus: 64 - 0.5 = 63.5

Result: "Harmonia" becoming more cautious and security-conscious
while maintaining cooperative tendencies
```

---

## Integration with Diplomatic Systems

### Markov Chain Integration

NPC personalities influence relationship state transitions:

```typescript
// High assertiveness increases conflict escalation probability
if (personality.assertiveness > 75) {
  transitionProbabilities.tenseToHostile *= 1.3;
  transitionProbabilities.friendlyToNeutral *= 1.15;
}

// High cooperativeness smooths relationship improvements
if (personality.cooperativeness > 75) {
  transitionProbabilities.neutralToFriendly *= 1.4;
  transitionProbabilities.hostileToTense *= 1.25;
}
```

### Diplomatic Choice Tracking

NPCs make consistent choices based on personality:

```typescript
function selectDiplomaticChoice(
  scenario: DiplomaticScenario,
  personality: PersonalityTraits,
  archetype: PersonalityArchetype
): DiplomaticChoice {

  const choices = scenario.choices;
  const scores = choices.map(choice => {
    return calculateChoiceScore(choice, personality, archetype);
  });

  // Select highest-scoring choice
  const selectedIndex = scores.indexOf(Math.max(...scores));
  return choices[selectedIndex];
}
```

### Response Generation

Personality influences response tone and content:

```typescript
// Aggressive Expansionist tone
if (archetype === 'AGGRESSIVE_EXPANSIONIST') {
  response.tone = 'demanding';
  response.template = 'ultimatum';
  response.flexibility = 'low';
}

// Cultural Diplomat tone
if (archetype === 'CULTURAL_DIPLOMAT') {
  response.tone = 'welcoming';
  response.template = 'collaborative';
  response.flexibility = 'high';
}
```

---

## Implementation Details

### Data Sources
- `src/lib/diplomatic-npc-personality.ts` - Core personality system
- `src/lib/diplomatic-markov-engine.ts` - Relationship transitions
- `src/lib/diplomatic-choice-tracker.ts` - Choice recording
- `src/lib/diplomatic-response-ai.ts` - Response generation

### API Endpoints
- `api.npcPersonalities.getPersonality` - Fetch NPC traits
- `api.npcPersonalities.calculateArchetype` - Determine archetype
- `api.npcPersonalities.predictResponse` - Get response probability
- `api.npcPersonalities.applyDrift` - Update traits based on experiences

### Admin Interface
- `/admin/npc-personalities` - Manage trait configurations
- View trait calculation details
- Manually adjust archetypes
- Monitor personality drift
- Test response predictions

---

For implementation examples, see:
- [Diplomatic Systems Guide](./diplomacy.md)
- [Diplomatic AI Guide](./diplomatic-ai.md)
- [API Reference](../reference/api-complete.md)
