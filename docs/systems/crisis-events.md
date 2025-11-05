# Crisis Events Management System

**Last updated:** November 2025

Dynamic crisis event system that generates natural disasters, economic crises, diplomatic incidents, social unrest, and security threats with realistic progression and player responses.

## Table of Contents
1. [Event Types](#event-types)
2. [Event Lifecycle](#event-lifecycle)
3. [Impact Calculations](#impact-calculations)
4. [Response System](#response-system)
5. [Duration & Resolution](#duration--resolution)
6. [API Integration](#api-integration)

---

## Event Types

### 1. Natural Disasters

**Categories:**
- Earthquakes (magnitude 3.0-9.0)
- Floods (riverine, coastal, flash)
- Hurricanes/Typhoons (Cat 1-5)
- Wildfires (small, medium, major)
- Droughts (seasonal, multi-year)
- Volcanic eruptions
- Tsunamis

**Triggering Factors:**
- Geographic location
- Historical patterns
- Season/climate
- Random events (1-5% annual probability)

**Example Event:**
```json
{
  "type": "EARTHQUAKE",
  "magnitude": 7.2,
  "epicenter": { "lat": 35.6895, "lon": 139.6917 },
  "affectedArea": "Tokyo Metropolitan Area",
  "severity": "HIGH",
  "casualties": 2500,
  "economicDamage": 15000000000
}
```

### 2. Economic Crises

**Categories:**
- Market crashes (-10% to -40% stock market)
- Currency crises (devaluation, hyperinflation)
- Banking crises (liquidity, solvency)
- Debt defaults (sovereign, corporate)
- Trade disruptions
- Commodity shocks

**Triggering Factors:**
- High debt-to-GDP ratio (>80%)
- Budget deficits (>5% GDP)
- External shocks
- Policy failures
- Contagion from trading partners

**Impact Formula:**
```
GDPImpact = baseDamage * (debtRatio / 60) * (1 - fiscalResilience)
```

### 3. Diplomatic Incidents

**Categories:**
- Border disputes
- Embassy closures
- Sanctions imposed/received
- Treaty violations
- Espionage discoveries
- Diplomatic expulsions

**Triggering Factors:**
- Hostile relationships (<30 strength)
- Competing territorial claims
- Ideological conflicts
- Historical grievances
- Third-party provocations

**Relationship Impact:**
```
newStrength = currentStrength * (1 - incidentSeverity * 0.3)
```

### 4. Social Unrest

**Categories:**
- Protests (peaceful, violent)
- Strikes (sectoral, general)
- Riots
- Civil disorder
- Separatist movements

**Triggering Factors:**
- Low public approval (<40%)
- High unemployment (>8%)
- Income inequality (Gini >0.45)
- Recent austerity measures
- Ethnic/regional tensions

**Stability Impact:**
```
stabilityLoss = baseImpact * (100 - publicApproval) / 50 * durationWeeks
```

### 5. Security Threats

**Categories:**
- Terrorism attacks
- Cyber attacks
- Border incursions
- Organized crime
- Sabotage

**Triggering Factors:**
- Low security spending (<2% GDP)
- Hostile neighbors
- Internal instability
- Regional conflicts
- Random events

---

## Event Lifecycle

### State Progression

```
BREWING → ACTIVE → ESCALATING → RESOLVING → RESOLVED
          ↓
       CONTAINED (if managed well)
```

**BREWING (Pre-event):**
- Warning signals appear
- Intelligence alerts generated
- Preparation window (3-14 days)
- Can be mitigated with preventive action

**ACTIVE:**
- Event occurs
- Initial impact calculated
- Response options presented
- Timer starts for player action

**ESCALATING:**
- Situation worsening
- Additional impacts compound
- Response urgency increases
- International attention grows

**CONTAINED:**
- Player response effective
- Impacts minimized
- Recovery begins
- Reputation bonus awarded

**RESOLVING:**
- Crisis deescalating
- Cleanup/recovery underway
- Long-term impacts assessed
- Lessons learned recorded

**RESOLVED:**
- Crisis concluded
- Final impacts tallied
- Historical record created
- Achievements/penalties applied

### Lifecycle Example

**Earthquake Event:**
```
Day 0-3: BREWING
- Seismic activity increases
- Intelligence: "Elevated earthquake risk"
- Option: Evacuate high-risk areas (cost: $5M, reduces casualties 80%)

Day 4: ACTIVE
- Magnitude 7.2 earthquake strikes
- Initial damage: 2,500 casualties, $15B damage
- Response options presented:
  1. Immediate Response (72hrs, high cost, fast resolution)
  2. Measured Response (1 week, moderate cost)
  3. Delayed Response (2 weeks, low cost, high escalation risk)

Day 4-11: Player chooses "Immediate Response"
- Status: CONTAINED
- Additional cost: $3B emergency relief
- Casualties prevented: 800
- International aid: +$500M
- Diplomatic reputation: +5

Day 11-25: RESOLVING
- Rebuilding efforts
- Economic recovery stimulus
- Infrastructure repair

Day 25: RESOLVED
- Final tally: 1,700 casualties, $17.5B total cost
- GDP impact: -0.8% (vs -2.3% if delayed)
- Public approval: +8 (effective crisis management)
- Achievement unlocked: "Crisis Manager I"
```

---

## Impact Calculations

### Economic Impact

**Formula:**
```
gdpReduction = baseDamage / currentGDP * 100
unemploymentIncrease = (laborForceAffected / totalLaborForce) * severity
tradeDisruption = (affectedPorts + affectedBorders) * 0.15
inflationIncrease = (supplyShockSeverity * 0.5)

totalEconomicImpact = gdpReduction + (unemploymentIncrease * 0.3) +
                      tradeDisruption + (inflationIncrease * 0.2)
```

**Example (Major Flood):**
```
Base damage: $8 billion
Current GDP: $1.2 trillion
Affected workforce: 500,000 / 50,000,000 = 1%
Severity: High (0.8)

gdpReduction = (8 / 1200) * 100 = 0.67%
unemploymentIncrease = 0.01 * 0.8 = 0.008 (0.8 percentage points)
tradeDisruption = (2 ports * 0.15) = 0.30%
inflationIncrease = 0.5 * 0.5 = 0.25%

totalEconomicImpact = 0.67 + (0.8 * 0.3) + 0.30 + (0.25 * 0.2)
                    = 0.67 + 0.24 + 0.30 + 0.05
                    = 1.26% GDP loss
```

### Social Impact

**Public Approval:**
```
approvalChange = baseImpact * responseQuality * (1 - preparedness)

Where:
- baseImpact: -5 to -25 points
- responseQuality: 0.4 (poor) to 1.2 (excellent)
- preparedness: 0.0 (none) to 0.8 (high)
```

**Example (Poor Response to Riot):**
```
baseImpact = -15
responseQuality = 0.5 (below average)
preparedness = 0.2 (low)

approvalChange = -15 * 0.5 * (1 - 0.2) = -15 * 0.5 * 0.8 = -6 points
```

**Stability Score:**
```
stabilityLoss = (severity * duration * unrestFactor) / governmentEffectiveness

Where:
- severity: 1-10
- duration: weeks
- unrestFactor: 0.5-2.0 (based on social cohesion)
- governmentEffectiveness: 0-100
```

### Diplomatic Impact

**Relationship Changes:**
```
For each involved country:
  if (eventCausedByThisCountry) {
    relationshipChange = -10 to -30
  } else if (countryProvidedAid) {
    relationshipChange = +5 to +15
  } else if (countryIgnored) {
    relationshipChange = -2 to -5
  }
```

**International Reputation:**
```
reputationChange = (responseSpeed * responseEffectiveness * transparency) / 3

Where:
- responseSpeed: 0.5 (slow) to 1.5 (immediate)
- responseEffectiveness: 0.4 (poor) to 1.2 (excellent)
- transparency: 0.6 (secretive) to 1.0 (open)
```

---

## Response System

### Response Options

**1. Immediate Response**
- **Duration:** 24-72 hours
- **Cost:** 150-200% of standard response
- **Benefits:**
  - Casualties reduced by 40-60%
  - Public approval bonus: +5 to +10
  - International aid likely
- **Risks:**
  - Resource strain
  - Potential logistical errors

**2. Measured Response**
- **Duration:** 3-7 days
- **Cost:** 100% baseline
- **Benefits:**
  - Balanced approach
  - Sustainable resource use
  - Moderate public approval: +2 to +5
- **Risks:**
  - Some escalation possible
  - Moderate additional damage

**3. Delayed Response**
- **Duration:** 1-3 weeks
- **Cost:** 60-80% upfront
- **Benefits:**
  - Lower immediate cost
  - Time to coordinate
- **Risks:**
  - High escalation probability (60-80%)
  - Public approval penalty: -5 to -15
  - Significantly higher total cost (150-300%)

**4. International Cooperation**
- **Duration:** Varies
- **Cost:** 50-70% (shared with partners)
- **Benefits:**
  - Reduced financial burden
  - Diplomatic relationship bonuses: +8 to +15
  - Access to specialized resources
  - International reputation boost
- **Risks:**
  - Slower coordination
  - Loss of control
  - Dependency perception

### Response Effectiveness

**Formula:**
```
effectiveness = (responseSpeed * 0.3) +
                (resourceAllocation * 0.3) +
                (coordinationQuality * 0.2) +
                (publicCommunication * 0.2)

Where each component: 0.0 - 1.0
```

**Factors:**
- **Response speed:** Time from event to action
- **Resource allocation:** % of needed resources deployed
- **Coordination:** Government efficiency + organizational capacity
- **Communication:** Transparency + clarity of public messaging

**Example (Excellent Response):**
```
responseSpeed = 0.95 (within 6 hours)
resourceAllocation = 0.90 (90% of needs met)
coordinationQuality = 0.85 (good government efficiency)
publicCommunication = 0.80 (clear, transparent messaging)

effectiveness = (0.95 * 0.3) + (0.90 * 0.3) + (0.85 * 0.2) + (0.80 * 0.2)
              = 0.285 + 0.270 + 0.170 + 0.160
              = 0.885 (88.5% effectiveness)

Result: Event contained quickly, minimal escalation, public approval +8
```

---

## Duration & Resolution

### Duration Formula

```
actualDuration = baseDuration * severityMultiplier / responseEffectiveness

Where:
- baseDuration: Event-specific (e.g., earthquake: 30 days)
- severityMultiplier: 0.8 (low) to 2.0 (catastrophic)
- responseEffectiveness: 0.4 (poor) to 1.2 (excellent)
```

### Examples

**Earthquake (Excellent Response):**
```
baseDuration = 30 days
severityMultiplier = 1.5 (high severity)
responseEffectiveness = 0.9 (good response)

actualDuration = 30 * 1.5 / 0.9 = 50 days
Reduced from potential 75+ days with poor response
```

**Currency Crisis (Poor Response):**
```
baseDuration = 90 days
severityMultiplier = 1.8 (very high)
responseEffectiveness = 0.5 (poor response)

actualDuration = 90 * 1.8 / 0.5 = 324 days
Crisis prolonged significantly due to ineffective policy
```

### Resolution Outcomes

**Best Case (Contained):**
- Duration: 60-80% of baseline
- Economic impact: 50-70% of potential
- Public approval: +5 to +12
- International reputation: +8 to +15
- Achievement: Crisis management awards

**Average Case (Managed):**
- Duration: 90-110% of baseline
- Economic impact: 80-100% of potential
- Public approval: -2 to +3
- International reputation: +2 to +5

**Worst Case (Mismanaged):**
- Duration: 150-300% of baseline
- Economic impact: 120-200% of potential (compounding)
- Public approval: -10 to -25
- International reputation: -5 to -15
- Risk of government instability

---

## API Integration

### tRPC Endpoints

**Query events:**
```typescript
// Get active crises
api.crisisEvents.getActiveCrises.useQuery({ countryId });

// Get crisis history
api.crisisEvents.getHistory.useQuery({
  countryId,
  startDate,
  endDate
});

// Get crisis statistics
api.crisisEvents.getStatistics.useQuery({ countryId });
```

**Respond to crisis:**
```typescript
// Submit response
api.crisisEvents.submitResponse.useMutation({
  onSuccess: (data) => {
    console.log(`Response recorded: ${data.effectiveness}% effective`);
  }
});

// Request international aid
api.crisisEvents.requestAid.useMutation({
  onSuccess: (data) => {
    console.log(`Aid pledged: $${data.totalAid}`);
  }
});
```

### Event Generation

**Automatic generation:**
```typescript
// Runs daily via cron
async function generateCrisisEvents() {
  const countries = await db.country.findMany();

  for (const country of countries) {
    const riskScore = calculateRiskScore(country);

    // Check each event type
    if (shouldGenerateEarthquake(country, riskScore)) {
      await createCrisisEvent({
        type: 'EARTHQUAKE',
        countryId: country.id,
        severity: calculateSeverity(riskScore)
      });
    }

    // ... other event types
  }
}
```

**Manual triggering (admin):**
```typescript
// Admin can trigger specific events for storytelling
api.crisisEvents.adminTrigger.useMutation({
  input: {
    countryId: 'country_xyz',
    type: 'DIPLOMATIC_INCIDENT',
    severity: 'HIGH',
    customParameters: {
      involvedCountryId: 'country_abc',
      incidentType: 'BORDER_DISPUTE'
    }
  }
});
```

---

## Related Documentation

- [Economic Calculations](./calculations.md) - Impact formulas
- [Diplomatic Systems](./diplomacy.md) - Relationship effects
- [Intelligence Systems](./intelligence.md) - Crisis detection
- [API Reference](../reference/api-complete.md) - Complete endpoint list
