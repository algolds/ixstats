# Economic & Statistical Calculations

**Last updated:** November 2025

This document provides complete formulas, examples, and logic for all economic calculations, growth modeling, synergy calculations, and statistical projections in IxStats.

## Table of Contents
1. [Tier-Based Growth Engine](#tier-based-growth-engine)
2. [Economic Resilience Index (ERI)](#economic-resilience-index)
3. [Productivity & Innovation Index](#productivity--innovation-index)
4. [Synergy Calculations](#synergy-calculations)
5. [Population Dynamics](#population-dynamics)
6. [GDP Projections](#gdp-projections)
7. [Vitality Scores](#vitality-scores)
8. [Tax Revenue Calculations](#tax-revenue-calculations)

---

## Tier-Based Growth Engine

The core growth system uses economic tiers to determine realistic growth rates based on development level.

### Formula
```
adjustedGrowth = baseGrowth * tierMultiplier * localFactor
```

**Components:**
- `baseGrowth`: User-defined growth rate (typically 1-8%)
- `tierMultiplier`: Tier-based modifier (see table below)
- `localFactor`: Country-specific adjustment (default 1.0)

### Economic Tiers & Multipliers

| Tier | Classification | Multiplier | Typical GDP/capita |
|------|---------------|------------|-------------------|
| 1 | Emerging | 1.8 | <$5,000 |
| 2 | Developing | 1.5 | $5,000-$15,000 |
| 3 | Industrializing | 1.2 | $15,000-$30,000 |
| 4 | Advanced | 1.0 | $30,000-$60,000 |
| 5 | Mature | 0.8 | >$60,000 |

### Examples

**Emerging Economy (Tier 1):**
```
baseGrowth = 3.5%
tierMultiplier = 1.8
localFactor = 1.0
adjustedGrowth = 3.5 * 1.8 * 1.0 = 6.3%
```

**Developing Economy (Tier 2):**
```
baseGrowth = 3.0%
tierMultiplier = 1.5
localFactor = 1.0
adjustedGrowth = 3.0 * 1.5 * 1.0 = 4.5%
```

**Mature Economy (Tier 5):**
```
baseGrowth = 1.5%
tierMultiplier = 0.8
localFactor = 1.0
adjustedGrowth = 1.5 * 0.8 * 1.0 = 1.2%
```

### Tier Transitions

When a country's GDP per capita crosses tier boundaries, growth is recalculated:
- Transition occurs over 1 IxTime year (smooth interpolation)
- Historical data preserves original tier classification
- Components may require re-validation for new tier

---

## Economic Resilience Index (ERI)

Measures a country's ability to withstand economic shocks. Scale: 0-100.

### Components (Weighted)

#### 1. Fiscal Stability (30% weight)
```
fiscalStability = 100 - (debtToGDP * 0.5) - (deficitGDP * 2)
normalized = clamp(fiscalStability, 0, 100)
```

**Example:**
- Debt-to-GDP: 60%
- Budget deficit: 3% of GDP
- Calculation: `100 - (60 * 0.5) - (3 * 2) = 100 - 30 - 6 = 64`
- Result: **64/100 fiscal stability**

#### 2. Monetary Stability (25% weight)
```
monetaryStability = 100 - (inflation * 10) - (currencyVolatility * 5)
normalized = clamp(monetaryStability, 0, 100)
```

**Example:**
- Inflation: 2.5%
- Currency volatility: 3.0
- Calculation: `100 - (2.5 * 10) - (3.0 * 5) = 100 - 25 - 15 = 60`
- Result: **60/100 monetary stability**

#### 3. Structural Balance (25% weight)
```
exportDependency = exports / GDP
sectorDiversity = 1 - concentrationIndex
structuralBalance = 50 + (sectorDiversity * 30) - (exportDependency * 20)
```

**Example:**
- Exports: 45% of GDP
- Sector concentration: 0.4 (diversified)
- Diversity score: 1 - 0.4 = 0.6
- Calculation: `50 + (0.6 * 30) - (0.45 * 20) = 50 + 18 - 9 = 59`
- Result: **59/100 structural balance**

#### 4. Social Cohesion (20% weight)
```
socialCohesion = 100 - (giniCoefficient * 150) - (unemploymentRate * 2)
normalized = clamp(socialCohesion, 0, 100)
```

**Example:**
- Gini coefficient: 0.35 (moderate inequality)
- Unemployment: 5.5%
- Calculation: `100 - (0.35 * 150) - (5.5 * 2) = 100 - 52.5 - 11 = 36.5`
- Result: **36.5/100 social cohesion**

### Overall ERI Score
```
ERI = (fiscalStability * 0.3) +
      (monetaryStability * 0.25) +
      (structuralBalance * 0.25) +
      (socialCohesion * 0.2)
```

**Example Calculation:**
```
ERI = (64 * 0.3) + (60 * 0.25) + (59 * 0.25) + (36.5 * 0.2)
ERI = 19.2 + 15.0 + 14.75 + 7.3
ERI = 56.25/100
```

**Interpretation:**
- 75-100: Very Resilient (minimal shock vulnerability)
- 60-74: Resilient (manageable challenges)
- 40-59: Moderate (improvement needed)
- 25-39: Vulnerable (significant risks)
- 0-24: Critical (major systemic issues)

---

## Productivity & Innovation Index

Measures economic efficiency and technological advancement. Scale: 0-100.

### Components (Weighted)

#### 1. Labor Productivity (35% weight)
```
laborProductivity = (GDP / totalHoursWorked) / industryAverage
normalized = clamp(laborProductivity * 100, 0, 100)
```

#### 2. Capital Efficiency (25% weight)
```
capitalEfficiency = GDP / capitalStock
ROI = (revenue - investment) / investment
capitalScore = (capitalEfficiency * 0.6) + (ROI * 0.4)
```

#### 3. Technological Adaptation (25% weight)
```
techScore = (R&D_spending / GDP * 100) +
            (patentsPer1M * 0.5) +
            (digitalAdoptionIndex * 0.3)
normalized = clamp(techScore, 0, 100)
```

#### 4. Entrepreneurship Index (15% weight)
```
entrepreneurship = (newBusinesses / population * 1000) * 10 +
                   (100 - regulatoryBurdenIndex) * 0.5
normalized = clamp(entrepreneurship, 0, 100)
```

### Overall Score
```
PII = (laborProductivity * 0.35) +
      (capitalEfficiency * 0.25) +
      (technologicalAdaptation * 0.25) +
      (entrepreneurshipIndex * 0.15)
```

---

## Synergy Calculations

Synergies occur when countries share atomic government or economic components.

### Embassy Synergy Score

#### Step 1: Component Matching
```
For each category (Power Structure, Decision Making, etc.):
  sharedComponents = intersection(countryA.components, countryB.components)
  matchScore = (sharedComponents.length / totalComponents.length) * 100
```

#### Step 2: Effectiveness Calculation
```
For each shared component:
  effectivenessAverage = (componentA.effectiveness + componentB.effectiveness) / 2
```

#### Step 3: Benefit Calculation
```
baseBonuses = {
  economic: 2.0%,
  diplomatic: 3.0%,
  cultural: 1.5%
}

For each benefit type:
  actualBonus = baseBonus * (matchScore / 100) * effectivenessAverage
```

### Complete Example

**Scenario:** Country A and Country B embassy relationship

**Country A Components (Power Structure):**
- CENTRALIZED_POWER (85% effectiveness)
- PROFESSIONAL_BUREAUCRACY (90% effectiveness)
- RULE_OF_LAW (88% effectiveness)

**Country B Components (Power Structure):**
- CENTRALIZED_POWER (92% effectiveness)
- RULE_OF_LAW (85% effectiveness)
- FEDERAL_SYSTEM (78% effectiveness)

**Calculation:**
```
Shared components: CENTRALIZED_POWER, RULE_OF_LAW (2 out of 5 possible)
Match score: (2 / 5) * 100 = 40%

Effectiveness calculations:
CENTRALIZED_POWER: (85 + 92) / 2 = 88.5%
RULE_OF_LAW: (88 + 85) / 2 = 86.5%
Overall effectiveness: (88.5 + 86.5) / 2 = 87.5%

Economic bonus:
2.0% * (40 / 100) * 0.875 = 2.0 * 0.4 * 0.875 = 0.70% GDP boost

Diplomatic bonus:
3.0% * (40 / 100) * 0.875 = 3.0 * 0.4 * 0.875 = 1.05% relationship boost

Cultural bonus:
1.5% * (40 / 100) * 0.875 = 1.5 * 0.4 * 0.875 = 0.525% influence boost
```

**Result:** 40% synergy match provides 0.70% economic, 1.05% diplomatic, and 0.525% cultural bonuses.

---

## Population Dynamics

### Population Growth Formula
```
newPopulation = currentPopulation * (1 + (growthRate / 100)) ^ years
```

**IxTime Adjustment:**
- IxTime runs at 2x real-world speed
- 1 real year = 2 IxTime years
- Growth calculations use IxTime years

**Example (5 real years = 10 IxTime years):**
```
Current population: 50,000,000
Annual growth rate: 1.2%
Years: 10 (IxTime)

newPopulation = 50,000,000 * (1 + 0.012) ^ 10
newPopulation = 50,000,000 * (1.012) ^ 10
newPopulation = 50,000,000 * 1.1268
newPopulation = 56,340,000

Growth: 6,340,000 people (12.68% increase)
```

### Population Density
```
populationDensity = population / landArea
```

Unit: people per square kilometer

---

## GDP Projections

Multi-factor model combining base growth, policies, synergies, and trade effects.

### Formula
```
projectedGDP = currentGDP *
               (1 + adjustedGrowthRate) ^ years *
               policyMultiplier *
               (1 + synergyBonus) *
               (1 + tradeMultiplier)
```

### Components

**1. Base GDP Growth:**
```
baseGDP = currentGDP * (1 + adjustedGrowthRate) ^ years
```

**2. Policy Multipliers (cumulative):**
```
policyMultiplier = product of all active policy effects
Example: [+2%, +3%, -1%] = 1.02 * 1.03 * 0.99 = 1.041 (4.1% net)
```

**3. Component Synergies:**
```
synergyBonus = sum of all component synergy bonuses
Example: Democratic + Federal + Free Market = 0.5% + 0.8% + 1.2% = 2.5%
```

**4. Trade Network Effects:**
```
tradeMultiplier = baseTradeBonus * (embassyCount / 10) * tradeOpenness
Example: 0.5% * (15 / 10) * 0.85 = 0.6375%
```

### Complete 10-Year Projection Example

**Starting Conditions:**
- Current GDP: $1.5 trillion
- Growth rate: 4.2% (tier-adjusted)
- Active policies: +0.5% net boost
- Component synergies: +0.3%
- Trade network: +0.2%

**Calculation:**
```
effectiveGrowth = 4.2% + 0.5% + 0.3% + 0.2% = 5.2%

projectedGDP = $1.5T * (1.052) ^ 10
projectedGDP = $1.5T * 1.658
projectedGDP = $2.487 trillion

Total growth: $987 billion (65.8% increase over 10 years)
```

---

## Vitality Scores

Four composite scores measuring national health. Scale: 0-100.

### 1. Economic Vitality
```
economicVitality = (GDPGrowth * 15) +
                   (employmentRate * 0.3) +
                   (fiscalHealth * 0.25) +
                   (tradeBalance * 0.1)
normalized = clamp(economicVitality, 0, 100)
```

### 2. Population Wellbeing
```
populationWellbeing = (HDI * 100) +
                      (literacyRate * 0.2) +
                      (healthcareAccess * 0.3) +
                      (100 - povertyRate * 2)
normalized = clamp(populationWellbeing, 0, 100)
```

### 3. Diplomatic Standing
```
diplomaticStanding = (allianceCount * 5) +
                     (positiveRelationships * 2) +
                     (diplomaticReputation * 0.5) +
                     (internationalTreaties * 3)
normalized = clamp(diplomaticStanding, 0, 100)
```

### 4. Governmental Efficiency
```
governmentalEfficiency = (100 - corruptionIndex) +
                         (bureaucraticEfficiency * 0.4) +
                         (policyEffectiveness * 0.3) +
                         (institutionalStrength * 0.3)
normalized = clamp(governmentalEfficiency, 0, 100)
```

### Overall National Health
```
overallHealth = (economicVitality +
                 populationWellbeing +
                 diplomaticStanding +
                 governmentalEfficiency) / 4
```

---

## Tax Revenue Calculations

### Progressive Income Tax
```
For each tax bracket [threshold, rate]:
  If income > threshold:
    taxableIncome = income - threshold
    tax += min(taxableIncome, nextThreshold - threshold) * rate
```

**Example (3-bracket system):**
```
Brackets:
  $0-$50,000: 10%
  $50,001-$150,000: 20%
  $150,001+: 30%

Income: $200,000

Tax calculation:
  First $50,000: $50,000 * 0.10 = $5,000
  Next $100,000: $100,000 * 0.20 = $20,000
  Remaining $50,000: $50,000 * 0.30 = $15,000

Total tax: $40,000 (20% effective rate)
```

### Corporate Tax
```
corporateTax = corporateProfits * corporateRate
adjustedTax = corporateTax * (1 - exemptionRate) * (1 + complianceRate)
```

### Sales Tax (VAT)
```
salesTax = (consumption * salesTaxRate) * collectionEfficiency
```

### Total Tax Revenue
```
totalRevenue = incomeTax + corporateTax + salesTax +
               propertyTax + exciseTaxes + tariffs

taxToGDPRatio = (totalRevenue / GDP) * 100
```

---

## Implementation Notes

### Caching Strategy
- Economic calculations cached for 6 IxTime hours
- Synergy scores cached per embassy pair
- Vitality scores recalculated on data change
- GDP projections cached with 24-hour TTL

### Performance Optimization
- Batch calculations for multiple countries
- Pre-compute tier transitions
- Indexed database queries for historical data
- Client-side caching for frequently accessed metrics

### Data Sources
- `src/lib/enhanced-economic-calculations.ts` - ERI, PII calculations
- `src/lib/synergy-calculator.ts` - Component synergy logic
- `src/lib/calculations.ts` - Base IxStatsCalculator class
- `src/lib/fiscal-calculations.ts` - Tax and revenue formulas

---

For implementation details, see:
- [Economic Systems Guide](./economy.md)
- [Government Components](./builder.md)
- [API Reference](../reference/api-complete.md)
