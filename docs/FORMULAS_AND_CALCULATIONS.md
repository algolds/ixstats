# IxStats Formulas and Calculations Reference

**Version:** 1.1.1
**Last Updated:** October 17, 2025
**Status:** Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Core Economic Calculations](#core-economic-calculations)
3. [Enhanced Economic Indices](#enhanced-economic-indices)
4. [Builder Economy Calculations](#builder-economy-calculations)
5. [Atomic Component Effectiveness](#atomic-component-effectiveness)
6. [Unified Effectiveness Calculator](#unified-effectiveness-calculator)
7. [Vitality & Intelligence](#vitality--intelligence)
8. [Stability Formulas](#stability-formulas)
9. [Tax Calculations](#tax-calculations)
10. [Configuration Constants](#configuration-constants)
11. [Dependency Graph](#dependency-graph)
12. [Data Sources](#data-sources)
13. [Formula Reference Tables](#formula-reference-tables)
14. [Example Calculations](#example-calculations)
15. [File Locations](#file-locations)
16. [Performance Considerations](#performance-considerations)

---

## Overview

### Calculation Architecture

IxStats implements a **multi-layered calculation architecture** with clear separation of concerns:

- **Core Layer**: Base economic progression formulas (GDP, population)
- **Enhancement Layer**: Advanced economic indices (ERI, PII, SEWI, ECTI)
- **Builder Layer**: Real-time data generation for country building
- **Atomic Layer**: Component-based effectiveness calculations
- **Unified Layer**: Cross-builder integration and synergy detection
- **Intelligence Layer**: National health and vitality scoring

### Philosophy

1. **Single Source of Truth**: Each calculation has one authoritative implementation
2. **Compound Effects**: Modifiers apply multiplicatively for realistic compounding
3. **Tier-Based Constraints**: Economic growth is capped based on development level
4. **Time Integration**: All calculations reference IxTime for consistency
5. **Defensive Programming**: All formulas include bounds checking and fallback values

### Key Principles

- **Realism**: Formulas based on real-world economic relationships
- **Balance**: Growth rates and modifiers tuned for gameplay balance
- **Transparency**: Clear documentation of all calculation steps
- **Performance**: Optimized for real-time calculation with caching where appropriate

---

## Core Economic Calculations

**File**: `/src/lib/calculations.ts`

### GDP Per Capita Progression

The fundamental formula for economic growth over time:

```typescript
effectiveGrowthRate = adjustedGdpGrowth × globalGrowthFactor × localGrowthFactor × tierModifier
finalGrowthRate = min(effectiveGrowthRate, tierMaxGrowthRate)
newGdpPerCapita = baselineGdpPerCapita × (1 + finalGrowthRate)^yearsElapsed
```

**Step-by-step breakdown:**

1. **Base Growth**: Start with `adjustedGdpGrowth` (decimal form, e.g., 0.03 = 3%)
2. **Global Amplification**: Multiply by `globalGrowthFactor` (1.0321 = 3.21% boost)
3. **Local Modulation**: Apply country-specific `localGrowthFactor` (default 1.0)
4. **Tier Adjustment**: Apply tier-specific modifier (default 1.0 for most tiers)
5. **Cap Application**: Enforce tier maximum growth rate
6. **Time Compounding**: Apply compound growth formula over elapsed years

**Diminishing Returns** (for extravagant economies):

```typescript
if (gdpPerCapita > 60000) {
  diminishingFactor = log(gdpPerCapita / 60000 + 1) / log(2)
  effectiveGrowthRate /= (1 + diminishingFactor × 0.5)
}
```

### Population Progression

```typescript
adjustedPopulationGrowthRate = basePopulationGrowthRate + Σ(DM_population_adjustments)
newPopulation = baselinePopulation × (1 + adjustedPopulationGrowthRate)^yearsElapsed
```

**Simple compound growth** with DM modifier support.

### Total GDP

```typescript
totalGDP = currentPopulation × currentGdpPerCapita
```

### Economic Tier Classification

```typescript
tier =
  gdpPerCapita >= 65000 ? "Extravagant"
  : gdpPerCapita >= 55000 ? "Very Strong"
  : gdpPerCapita >= 45000 ? "Strong"
  : gdpPerCapita >= 35000 ? "Healthy"
  : gdpPerCapita >= 25000 ? "Developed"
  : gdpPerCapita >= 10000 ? "Developing"
  : "Impoverished"
```

**Tier Maximum Growth Rates:**

| Tier | GDP Range | Max Annual Growth |
|------|-----------|-------------------|
| Impoverished | $0 - $9,999 | 10.0% |
| Developing | $10,000 - $24,999 | 7.5% |
| Developed | $25,000 - $34,999 | 5.0% |
| Healthy | $35,000 - $44,999 | 3.5% |
| Strong | $45,000 - $54,999 | 2.75% |
| Very Strong | $55,000 - $64,999 | 1.5% |
| Extravagant | $65,000+ | 0.5% |

### Population Tier Classification

```typescript
tier =
  population >= 500_000_000 ? "X"
  : population >= 350_000_000 ? "7"
  : population >= 120_000_000 ? "6"
  : population >= 80_000_000 ? "5"
  : population >= 50_000_000 ? "4"
  : population >= 30_000_000 ? "3"
  : population >= 10_000_000 ? "2"
  : "1"
```

### DM Input Modifiers

**Types and Application:**

```typescript
// Population Adjustment: Additive to growth rate
adjustedRate += dmInput.value

// GDP Adjustment: Additive to growth rate
effectiveGrowthRate += dmInput.value

// Growth Rate Modifier: Multiplicative to growth rate
effectiveGrowthRate *= (1 + dmInput.value)

// Natural Disaster: Direct population/GDP impact
newPopulation *= (1 + dmInput.value)
newTotalGdp *= (1 + dmInput.value × 1.5)

// Trade Agreement: GDP per capita boost
newGdpPerCapita *= (1 + dmInput.value)

// Economic Policy: Local growth factor adjustment
localGrowthFactor *= (1 + dmInput.value)
```

---

## Enhanced Economic Indices

**File**: `/src/lib/enhanced-economic-calculations.ts`

### Economic Resilience Index (ERI)

**Overall Score (0-100):**

```typescript
ERI = fiscalStability × 0.30 +
      monetaryStability × 0.25 +
      structuralBalance × 0.25 +
      socialCohesion × 0.20
```

#### Fiscal Stability (0-100)

```typescript
score = 50  // Base

// Debt-to-GDP ratio
if (debtRatio <= 60) score += 25
else if (debtRatio <= 90) score += 15
else if (debtRatio <= 120) score += 5
else score -= 10

// Budget balance (as % of GDP)
if (budgetBalance > 0.02) score += 15      // Surplus
else if (budgetBalance > -0.03) score += 10 // Small deficit
else if (budgetBalance > -0.06) score += 0  // Moderate deficit
else score -= 15                            // Large deficit

// Tax efficiency
if (taxRevenue >= 15% && taxRevenue <= 35%) score += 10
else if (taxRevenue < 10% || taxRevenue > 45%) score -= 10

final_score = max(0, min(100, score))
```

#### Monetary Stability (0-100)

```typescript
score = 50  // Base

// Inflation stability
if (inflation >= 1% && inflation <= 4%) score += 25  // Ideal
else if (inflation >= 0% && inflation <= 6%) score += 15
else if (inflation > 10%) score -= 20      // High inflation
else if (inflation < -2%) score -= 15      // Deflation

// Growth volatility (if 10+ historical points)
volatility = standardDeviation(last10GrowthRates)
if (volatility <= 0.02) score += 15        // Low volatility
else if (volatility <= 0.04) score += 10
else if (volatility > 0.08) score -= 15

score += 10  // Currency stability placeholder
```

#### Structural Balance (0-100)

```typescript
score = 50  // Base

// Economic tier bonus
score += {
  Extravagant: 20, Very_Strong: 20, Strong: 15, Healthy: 15,
  Developed: 10, Developing: 5, Impoverished: -5
}[tier]

// Population tier bonus
score += {
  TIER_3: 10, TIER_4: 10, TIER_5: 10,  // Optimal
  TIER_1: 5, TIER_2: 5,                 // Manageable
  TIER_X: -5                             // Coordination challenge
}[populationTier]

// Employment health
if (unemployment <= 5) score += 15
else if (unemployment <= 8) score += 10
else if (unemployment <= 12) score += 0
else score -= 15
```

#### Social Cohesion (0-100)

```typescript
score = 50  // Base

// Income inequality (Gini coefficient)
if (gini <= 0.30) score += 25       // Very equal
else if (gini <= 0.40) score += 15
else if (gini <= 0.50) score += 5
else score -= 15                     // High inequality

// Social mobility
if (mobility >= 70) score += 15
else if (mobility >= 50) score += 10
else if (mobility <= 30) score -= 10

// Education access
if (literacy >= 95%) score += 10
else if (literacy >= 85%) score += 5
else if (literacy <= 70%) score -= 10
```

### Productivity & Innovation Index (PII)

```typescript
PII = laborProductivity × 0.35 +
      capitalEfficiency × 0.25 +
      technologicalAdaptation × 0.25 +
      entrepreneurshipIndex × 0.15
```

**Labor Productivity:**

```typescript
score = 50 + gdpPerCapitaBonus + laborForceBonus + educationBonus

gdpPerCapitaBonus =
  gdpPerCapita >= 60000 ? 30
  : gdpPerCapita >= 40000 ? 20
  : gdpPerCapita >= 25000 ? 15
  : gdpPerCapita >= 15000 ? 10 : 5

laborForceBonus =
  participation >= 70% ? 15
  : participation >= 60% ? 10 : 5

educationBonus =
  literacy >= 95% ? 5
  : literacy >= 85% ? 3 : -5
```

### Social Economic Wellbeing Index (SEWI)

```typescript
SEWI = livingStandards × 0.30 +
       healthcareAccess × 0.25 +
       educationOpportunity × 0.25 +
       socialMobility × 0.20
```

### Economic Complexity & Trade Integration Index (ECTI)

```typescript
ECTI = exportDiversity × 0.30 +
       valueChainIntegration × 0.25 +
       financialSophistication × 0.25 +
       regulatoryQuality × 0.20
```

---

## Builder Economy Calculations

**File**: `/src/app/builder/lib/economy-calculations.ts`

### Employment Data Generation

**Total Workforce:**

```typescript
workingAgePopulation = totalPopulation × 0.65
totalWorkforce = workingAgePopulation × (participationRate / 100)
```

**Derived Rates:**

```typescript
employmentRate = 100 - unemploymentRate
underemploymentRate = unemploymentRate × 0.6
youthUnemploymentRate = unemploymentRate × 2.2
femaleParticipationRate = participationRate × 0.85
maleParticipationRate = participationRate × 1.15
```

**Sector Distribution (Standard Economy):**

| Sector | Employment % |
|--------|--------------|
| Agriculture | 3.5% |
| Mining | 0.8% |
| Manufacturing | 12.5% |
| Construction | 6.5% |
| Utilities | 1.2% |
| Wholesale | 5.5% |
| Retail | 11.0% |
| Transportation | 4.8% |
| Information | 3.2% |
| Finance | 5.5% |
| Professional | 13.5% |
| Education | 9.0% |
| Healthcare | 14.0% |
| Hospitality | 7.5% |
| Government | 15.0% |
| Other | 6.5% |

### Income Distribution Generation

**Income Estimates:**

```typescript
nationalMeanIncome = gdpPerCapita × 0.85
nationalMedianIncome = nationalMeanIncome × 0.72

// Percentiles based on median
p10 = median × 0.35
p25 = median × 0.55
p50 = median × 1.00
p75 = median × 1.65
p90 = median × 2.80
p95 = median × 4.20
p99 = median × 8.50
p99_9 = median × 25.00
```

**Income Classes:**

```typescript
lowerClass: {
  percent: 18%,
  averageIncome: p10 × 1.3,
  threshold: p10 × 1.8
}
lowerMiddleClass: {
  percent: 22%,
  averageIncome: p25 × 1.2,
  threshold: p25 × 1.6
}
middleClass: {
  percent: 32%,
  averageIncome: p50 × 1.1,
  threshold: p50 × 1.5
}
upperMiddleClass: {
  percent: 18%,
  averageIncome: p75 × 1.15,
  threshold: p75 × 1.4
}
upperClass: {
  percent: 8%,
  averageIncome: p90 × 1.3,
  threshold: p90 × 1.8
}
wealthyClass: {
  percent: 2%,
  averageIncome: p99 × 1.5,
  threshold: p99
}
```

**Gini Coefficient & Palm Ratio:**

```typescript
// Input parameter (default 0.38)
giniCoefficient = 0.38

// Palm ratio: Top 10% to Bottom 40%
palmRatio = p90 / (p10 × 4)
```

### Sector GDP Contribution

**Advanced Economy (GDP/capita > $35k):**

```typescript
sectorGDPContribution = {
  agriculture: 1.5%, mining: 2.0%, manufacturing: 12.0%,
  information: 8.5%, finance: 12.0%, professional: 15.5%,
  healthcare: 11.0%, government: 12.0%
  // ... other sectors
}
```

**Emerging Economy ($15k - $35k):**

```typescript
sectorGDPContribution = {
  agriculture: 8.5%, mining: 5.5%, manufacturing: 22.0%,
  information: 5.0%, finance: 8.5%, professional: 9.0%
  // ... other sectors
}
```

**Developing Economy (< $15k):**

```typescript
sectorGDPContribution = {
  agriculture: 18.0%, mining: 8.5%, manufacturing: 14.0%,
  healthcare: 3.5%, technology: 2.5%
  // ... other sectors
}
```

### Trade Data Generation

```typescript
exportShare = isAdvanced ? 28% : 22%
importShare = isAdvanced ? 26% : 25%

totalExports = nominalGDP × (exportShare / 100)
totalImports = nominalGDP × (importShare / 100)
tradeBalance = totalExports - totalImports

// Trade openness index
tradeOpennessIndex = (totalExports + totalImports) / nominalGDP
```

---

## Atomic Component Effectiveness

**File**: `/src/lib/atomic-client-calculations.ts`

### Component Effectiveness Data Structure

Each atomic component has:

```typescript
{
  baseEffectiveness: number,      // 0-100 baseline
  economicImpact: number,         // Multiplier (e.g., 1.15 = +15%)
  taxImpact: number,              // Multiplier
  stabilityImpact: number,        // Additive points (-20 to +20)
  legitimacyImpact: number        // Additive points
}
```

### Example Components

**Professional Bureaucracy:**

```typescript
{
  baseEffectiveness: 85,
  economicImpact: 1.20,    // +20% GDP growth
  taxImpact: 1.25,         // +25% tax collection
  stabilityImpact: 15,     // +15 stability points
  legitimacyImpact: 8      // +8 legitimacy points
}
```

**Rule of Law:**

```typescript
{
  baseEffectiveness: 85,
  economicImpact: 1.15,
  taxImpact: 1.20,
  stabilityImpact: 20,     // Highest stability bonus
  legitimacyImpact: 18
}
```

**Meritocratic System:**

```typescript
{
  baseEffectiveness: 88,   // Highest base
  economicImpact: 1.18,
  taxImpact: 1.20,
  stabilityImpact: 12,
  legitimacyImpact: 12
}
```

### Synergy Detection

**Technocratic Process + Professional Bureaucracy:**

```typescript
{
  economicBonus: 0.15,      // Additional +15% economic impact
  taxBonus: 0.20,           // Additional +20% tax efficiency
  stabilityBonus: 10,       // +10 stability points
  description: 'Optimal policy implementation synergy'
}
```

**Rule of Law + Independent Judiciary:**

```typescript
{
  economicBonus: 0.12,
  taxBonus: 0.15,
  stabilityBonus: 15,
  description: 'Strong institutional framework synergy'
}
```

### Conflict Penalties

**Democratic Process + Surveillance System:**

```typescript
{
  economicPenalty: 0.10,    // -10% economic impact
  taxPenalty: 0.05,         // -5% tax efficiency
  stabilityPenalty: 8,      // -8 stability points
  description: 'Democratic surveillance conflict'
}
```

**Partisan Institutions + Rule of Law:**

```typescript
{
  economicPenalty: 0.15,
  taxPenalty: 0.10,
  stabilityPenalty: 15,
  description: 'Partisan capture of institutions'
}
```

### Economic Modifier Calculation

```typescript
function calculateAtomicEconomicImpact(components, baseGdpPerCapita, baseTaxRevenue) {
  modifiers = {
    taxCollectionMultiplier: 1.0,
    gdpGrowthModifier: 1.0,
    stabilityBonus: 0,
    innovationMultiplier: 1.0,
    internationalTradeBonus: 0,
    governmentEfficiencyMultiplier: 1.0
  }

  // Apply base component effects (multiplicative)
  for each component {
    modifiers.taxCollectionMultiplier *= component.taxImpact
    modifiers.gdpGrowthModifier *= component.economicImpact
    modifiers.stabilityBonus += component.stabilityImpact
    modifiers.governmentEfficiencyMultiplier *= (component.baseEffectiveness / 70)
  }

  // Apply synergies (multiplicative bonuses)
  for each synergy {
    if all synergy components present {
      modifiers.gdpGrowthModifier *= (1 + synergy.economicBonus)
      modifiers.taxCollectionMultiplier *= (1 + synergy.taxBonus)
      modifiers.stabilityBonus += synergy.stabilityBonus
    }
  }

  // Apply conflicts (multiplicative penalties)
  for each conflict {
    if all conflict components present {
      modifiers.gdpGrowthModifier *= (1 - conflict.economicPenalty)
      modifiers.taxCollectionMultiplier *= (1 - conflict.taxPenalty)
      modifiers.stabilityBonus -= conflict.stabilityPenalty
    }
  }

  return modifiers
}
```

### Overall Effectiveness Score

```typescript
function calculateOverallEffectiveness(components) {
  if (components.length === 0) return 0

  // Base effectiveness (average)
  baseScore = sum(component.baseEffectiveness) / components.length

  // Synergy bonuses
  synergyBonus = detectSynergies(components).length × 5

  // Conflict penalties
  conflictPenalty = detectConflicts(components).length × 8

  return max(0, min(100, baseScore + synergyBonus - conflictPenalty))
}
```

---

## Unified Effectiveness Calculator

**File**: `/src/app/builder/services/UnifiedEffectivenessCalculator.ts`

### Overall Unified Score

```typescript
unifiedEffectiveness =
  economyScore × weightEconomy +
  governmentScore × weightGovernment +
  taxScore × weightTax +
  synergyBonus × weightSynergy -
  conflictPenalty × weightConflict
```

**Default Weights:**

```typescript
{
  economy: 0.35,        // 35%
  government: 0.30,     // 30%
  tax: 0.20,           // 20%
  synergy: 0.10,       // 10%
  conflict: 0.05       // 5% (penalty)
}
```

### Cross-Builder Synergies

**Economy + Government:**

```typescript
// Technocratic government with market economy
if (hasComponent(TECHNOCRATIC_PROCESS) &&
    hasEconomicComponent(MARKET_BASED)) {
  synergyBonus += 12
  description = "Efficient market regulation"
}

// Democratic government with entrepreneurship
if (hasComponent(DEMOCRATIC_PROCESS) &&
    hasEconomicComponent(ENTREPRENEURSHIP_FOCUS)) {
  synergyBonus += 10
  description = "Democratic innovation ecosystem"
}
```

**Government + Tax:**

```typescript
// Professional bureaucracy with progressive tax
if (hasComponent(PROFESSIONAL_BUREAUCRACY) &&
    taxSystem.type === 'progressive') {
  taxEfficiencyBonus += 15
  description = "Effective progressive taxation"
}

// Digital government with automated collection
if (hasComponent(DIGITAL_GOVERNMENT) &&
    taxSystem.automatedCollection) {
  taxCollectionBonus += 20
  description = "Digital tax automation"
}
```

**Economy + Tax:**

```typescript
// High-growth economy with appropriate tax burden
if (economicGrowth > 4% && taxBurden < 30%) {
  growthBonus += 8
  description = "Growth-friendly tax environment"
}

// Service economy with consumption tax
if (servicesSectorShare > 60% && hasConsumptionTax) {
  revenueBonus += 12
  description = "Service-aligned tax structure"
}
```

### Optimization Recommendations

**Priority Scoring:**

```typescript
function calculatePriority(recommendation) {
  score = expectedImprovement × 10

  if (implementationCost < 1000000) score += 20      // Low cost
  else if (implementationCost > 100000000) score -= 20 // High cost

  if (timeToImplement === 'immediate') score += 15
  else if (timeToImplement === 'long_term') score -= 15

  if (affectedSystems.length > 2) score += 10  // Cross-cutting impact

  priority =
    score >= 80 ? 'critical'
    : score >= 60 ? 'high'
    : score >= 40 ? 'medium'
    : 'low'

  return priority
}
```

---

## Vitality & Intelligence

**File**: `/src/lib/vitality-calculator.ts`

### Economic Vitality (0-100)

```typescript
score = 50  // Base

// GDP per capita (0-30 points)
if (gdpPerCapita >= 80000) score += 30
else if (gdpPerCapita >= 60000) score += 25
else if (gdpPerCapita >= 40000) score += 20
else if (gdpPerCapita >= 20000) score += 15
else if (gdpPerCapita >= 10000) score += 10
else score += max(0, (gdpPerCapita / 10000) × 10)

// GDP growth rate (0-20 points)
if (growthRate >= 5) score += 20
else if (growthRate >= 3) score += 15
else if (growthRate >= 1) score += 10
else if (growthRate >= 0) score += 5
else score -= abs(growthRate) × 2

// Employment (0-20 points)
effectiveEmployment = 100 - unemploymentRate
score += min(20, effectiveEmployment / 5)

// Economic tier (0-15 points)
tierBonus = {
  "Very Strong": 15, "Strong": 12, "Stable": 9,
  "Developing": 6, default: 3
}[tier]

// Trade balance (0-10 points)
if (tradeBalance > 0) {
  score += min(10, (tradeBalance / 1000000000) × 2)
}

// Inflation control (0-5 points or -10 penalty)
if (inflation >= 0 && inflation <= 3) score += 5
else if (inflation <= 5) score += 2
else if (inflation > 10) score -= 10

return max(0, min(100, score))
```

### Population Wellbeing (0-100)

```typescript
score = 50  // Base

// Life expectancy (0-25 points)
if (lifeExpectancy >= 80) score += 25
else if (lifeExpectancy >= 75) score += 20
else if (lifeExpectancy >= 70) score += 15
else if (lifeExpectancy >= 65) score += 10
else if (lifeExpectancy >= 60) score += 5

// Literacy rate (0-20 points)
score += min(20, (literacyRate / 100) × 20)

// Income inequality (0-20 points, inverted Gini)
if (gini <= 0.25) score += 20
else if (gini <= 0.35) score += 15
else if (gini <= 0.45) score += 10
else if (gini <= 0.55) score += 5

// Poverty rate (0-15 points, inverted)
if (povertyRate <= 5) score += 15
else if (povertyRate <= 10) score += 12
else if (povertyRate <= 20) score += 8
else if (povertyRate <= 30) score += 4

// Population growth (0-10 points)
if (popGrowth >= 0.5 && popGrowth <= 2) score += 10
else if (popGrowth >= 0 && popGrowth < 0.5) score += 7
else if (popGrowth > 2 && popGrowth <= 3) score += 5
else if (popGrowth < 0) score += 3

// Social mobility (0-10 points)
score += min(10, (socialMobility / 100) × 10)

return max(0, min(100, score))
```

### Diplomatic Standing (0-100)

```typescript
score = 50  // Base

// Active alliances (0-30 points)
if (alliances >= 10) score += 30
else if (alliances >= 7) score += 25
else if (alliances >= 5) score += 20
else if (alliances >= 3) score += 15
else if (alliances >= 1) score += 10

// Active treaties (0-25 points)
if (treaties >= 30) score += 25
else if (treaties >= 20) score += 20
else if (treaties >= 10) score += 15
else if (treaties >= 5) score += 10
else score += treaties × 2

// Diplomatic reputation (0-30 points)
reputationBonus = {
  "Excellent": 30, "Rising": 30, "Good": 20, "Stable": 20,
  "Neutral": 10, "Declining": 5, "Poor": 0
}[reputation]

// Regional influence by GDP (0-15 points)
totalGdp = gdpPerCapita × population
if (totalGdp >= 5_000_000_000_000) score += 15  // $5T+
else if (totalGdp >= 1_000_000_000_000) score += 12
else if (totalGdp >= 500_000_000_000) score += 9
else if (totalGdp >= 100_000_000_000) score += 6

return max(0, min(100, score))
```

### Governmental Efficiency (0-100)

```typescript
score = 50  // Base

// Public approval (0-30 points)
score += min(30, ((approval - 50) / 50) × 30)

// Political stability (0-25 points)
stabilityBonus = {
  "Very Stable": 25, "Stable": 20, "Moderate": 10,
  "Monitored": 10, "Unstable": 0, "Critical": -10
}[stability]

// Government efficiency rating (0-20 points)
efficiencyBonus = {
  "Excellent": 20, "Very High": 20, "Good": 15, "High": 15,
  "Moderate": 10, "Low": 5
}[efficiency]

// Infrastructure rating (0-15 points)
score += min(15, (infrastructureRating / 100) × 15)

// Fiscal responsibility (0-10 points)
balancePercent = (budgetBalance / gdp) × 100
if (balancePercent > 0) score += 10        // Surplus
else if (balancePercent > -3) score += 7   // Small deficit
else if (balancePercent > -5) score += 4   // Moderate
else if (balancePercent > -10) score += 1  // Large deficit

return max(0, min(100, score))
```

### Overall National Health

```typescript
overallHealth =
  economicVitality × 0.35 +
  populationWellbeing × 0.30 +
  governmentalEfficiency × 0.20 +
  diplomaticStanding × 0.15
```

---

## Stability Formulas

**File**: `/src/lib/stability-formulas.ts`

### Crime Rate Calculation

**Overall Crime Rate (per 100k population):**

```typescript
unemploymentFactor = unemploymentRate × 0.8
inequalityFactor = (giniIndex / 100) × 15
povertyFactor = povertyRate × 0.6
youthFactor = youthUnemployment × 0.4
urbanFactor = (urbanizationRate / 100) × 5

policingPerCapita = policingBudget / population
policingFactor = max(0, 10 - (policingPerCapita / 100) × 10)

baseCrimeRate = unemploymentFactor + inequalityFactor +
                povertyFactor + urbanFactor + policingFactor

violentCrimeRate = max(1, (baseCrimeRate × 0.3) + youthFactor + (povertyFactor × 0.5))
propertyCrimeRate = max(5, (baseCrimeRate × 0.7) + inequalityFactor + (inflationRate × 0.3))

overallCrimeRate = min(100, violentCrimeRate + propertyCrimeRate)
```

### Organized Crime Level (0-100)

```typescript
corruptionFactor = corruptionIndex × 0.4
stabilityFactor = (2.5 - politicalStability) × 8
institutionsFactor = (100 - democracyIndex) × 0.3
desperationFactor = (unemploymentRate + povertyRate) × 0.2

organizedCrimeLevel = corruptionFactor + stabilityFactor +
                      institutionsFactor + desperationFactor

return max(0, min(100, organizedCrimeLevel))
```

### Social Cohesion (0-100)

```typescript
score = 60  // Base

growthFactor = min(10, max(-10, gdpGrowth × 3))
inequalityPenalty = (giniIndex / 100) × 30
stabilityFactor = ((politicalStability + 2.5) / 5) × 20
polarizationPenalty = politicalPolarization × 0.3
diversityFactor = (ethnicDiversity / 100) × -5

cohesion = score + growthFactor + stabilityFactor -
           inequalityPenalty - polarizationPenalty + diversityFactor

return max(0, min(100, cohesion))
```

### Protest Frequency (events per year)

```typescript
basePoliticalFactor = politicalPolarization × 0.15
unemploymentFactor = unemploymentRate × 0.5
inequalityFactor = (giniIndex / 100) × 8

// Recent unpopular policies (last 90 days)
policyImpact = sum(
  for policy in recentPolicies where daysSince < 90:
    max(0, -policy.popularityImpact) × 0.1
)

democracyFactor = (democracyIndex / 100) × 10

frequency = basePoliticalFactor + unemploymentFactor +
            inequalityFactor + policyImpact + democracyFactor

return max(0, round(frequency))
```

### Riot Risk (0-100)

```typescript
polarizationFactor = politicalPolarization × 0.3
desperationFactor = (unemploymentRate + povertyRate) × 0.3
crimeFactor = (crimeRate / 100) × 20
policingFactor = max(0, 20 - (policingEffectiveness / 100) × 20)
protestFactor = min(20, protestFrequency × 0.5)

riotRisk = polarizationFactor + desperationFactor +
           crimeFactor + policingFactor + protestFactor

return max(0, min(100, riotRisk))
```

### Trust in Government (0-100)

```typescript
score = 30  // Base

democracyFactor = (democracyIndex / 100) × 30
corruptionPenalty = corruptionIndex × 0.4
economicFactor = min(15, max(-15, gdpGrowth × 4))
stabilityFactor = ((politicalStability + 2.5) / 5) × 20
polarizationPenalty = politicalPolarization × 0.15

trust = score + democracyFactor + economicFactor +
        stabilityFactor - corruptionPenalty - polarizationPenalty

return max(5, min(95, trust))
```

### Overall Stability Score (0-100)

```typescript
stabilityScore =
  socialCohesion × 0.25 +
  trustInGovernment × 0.20 +
  (100 - crimeRate) × 0.20 +
  (100 - ethnicTension) × 0.15 +
  (100 - riotRisk) × 0.10 +
  policingEffectiveness × 0.10

return round(max(0, min(100, stabilityScore)))
```

**Stability Trend:**

```typescript
trend =
  (stabilityScore >= 70 && gdpGrowth > 2) ? "improving"
  : (stabilityScore < 40 || riotRisk > 60) ? "critical"
  : (gdpGrowth < 0 || polarization > 70) ? "declining"
  : "stable"
```

---

## Tax Calculations

**File**: `/src/lib/tax-calculator.ts`

### Progressive Tax Calculation

```typescript
function calculateProgressiveTax(taxableIncome, brackets) {
  totalTax = 0
  remainingIncome = taxableIncome
  appliedBrackets = []

  for each bracket in sortedBrackets {
    if (remainingIncome <= 0) break

    bracketIncome = min(remainingIncome, bracket.maxIncome - bracket.minIncome)
    bracketTax = bracketIncome × (bracket.rate / 100)

    totalTax += bracketTax
    remainingIncome -= bracketIncome

    appliedBrackets.push({
      bracket: bracket,
      incomeInBracket: bracketIncome,
      taxFromBracket: bracketTax
    })
  }

  return { totalTax, appliedBrackets }
}
```

### Tax Category Calculation

```typescript
function calculateCategoryTax(category, taxableIncome, adjustedGrossIncome, grossIncome) {
  categoryTaxableAmount = taxableIncome

  // Apply category minimums/maximums
  if (category.minimumAmount && categoryTaxableAmount < category.minimumAmount) {
    categoryTaxableAmount = 0
  }
  if (category.maximumAmount && categoryTaxableAmount > category.maximumAmount) {
    categoryTaxableAmount = category.maximumAmount
  }

  // Apply category exemptions
  if (category.exemptionAmount) {
    categoryTaxableAmount = max(0, categoryTaxableAmount - category.exemptionAmount)
  }

  // Apply category deductions
  if (category.deductionAllowed && category.standardDeduction) {
    categoryTaxableAmount = max(0, categoryTaxableAmount - category.standardDeduction)
  }

  // Calculate tax based on method
  switch (category.calculationMethod) {
    case 'percentage':
      categoryTax = categoryTaxableAmount × (category.baseRate / 100)
      break
    case 'fixed':
      categoryTax = category.baseRate
      break
    case 'tiered':
      categoryTax = calculateTieredTax(categoryTaxableAmount, category.brackets)
      break
  }

  return categoryTax
}
```

### Effective vs Marginal Rate

```typescript
// Effective rate: Total tax as percentage of gross income
effectiveRate = (totalTaxOwed / grossIncome) × 100

// Marginal rate: Rate on next dollar earned
marginalRate = findHighestApplicableBracket(taxableIncome).rate
```

### Alternative Minimum Tax (AMT)

```typescript
if (taxSystem.alternativeMinTax && taxSystem.alternativeMinRate) {
  amtTax = adjustedGrossIncome × (taxSystem.alternativeMinRate / 100)
  if (amtTax > totalTaxOwed) {
    totalTaxOwed = amtTax
  }
}
```

### Tax Effectiveness Score

```typescript
function calculateTaxEffectiveness(taxSystem) {
  score = 50  // Base

  // Progressive structure bonus
  if (taxSystem.type === 'progressive' && numberOfBrackets >= 5) {
    score += 15
  }

  // Compliance rate
  if (taxSystem.complianceRate >= 90) score += 20
  else if (taxSystem.complianceRate >= 75) score += 10
  else score -= 10

  // Collection efficiency
  if (taxSystem.collectionEfficiency >= 95) score += 15
  else if (taxSystem.collectionEfficiency >= 85) score += 10

  // Simplicity (fewer categories = higher score)
  if (taxCategories.length <= 5) score += 10
  else if (taxCategories.length >= 15) score -= 10

  return max(0, min(100, score))
}
```

---

## Configuration Constants

**File**: `/src/lib/calculations.ts`

### Global Growth Factor

```typescript
GLOBAL_GROWTH_FACTOR = 1.0321  // 3.21% multiplier applied to all growth rates
```

**Application:**

```typescript
effectiveGrowthRate = baseGrowthRate × GLOBAL_GROWTH_FACTOR
```

### Tier Growth Modifiers

```typescript
TIER_GROWTH_MODIFIERS = {
  IMPOVERISHED: 1.0,
  DEVELOPING: 1.0,
  DEVELOPED: 1.0,
  HEALTHY: 1.0,
  STRONG: 1.0,
  VERY_STRONG: 1.0,
  EXTRAVAGANT: 1.0
}
```

**Note:** All default to 1.0; can be adjusted for game balance.

### IxTime Configuration

**File**: `/src/lib/ixtime.ts`

```typescript
REAL_WORLD_EPOCH = new Date(2020, 9, 4, 0, 0, 0, 0)  // Oct 4, 2020
IN_GAME_EPOCH = new Date(2028, 0, 1, 0, 0, 0, 0)     // Jan 1, 2028

BASE_TIME_MULTIPLIER = 4.0         // 4x speed (before July 27, 2025)
POST_SPEED_CHANGE_MULTIPLIER = 2.0 // 2x speed (after July 27, 2025)
SPEED_CHANGE_DATE = new Date('2025-07-27T00:00:00.000Z')
```

**Time Conversion:**

```typescript
function convertToIxTime(realWorldTimestamp) {
  multiplier = getTimeMultiplier()
  realSecondsElapsed = (realWorldTimestamp - REAL_WORLD_EPOCH) / 1000
  ixSecondsElapsed = realSecondsElapsed × multiplier
  return REAL_WORLD_EPOCH + (ixSecondsElapsed × 1000)
}
```

### Validation Constants

```typescript
// Growth rate bounds (annual)
MIN_GROWTH_RATE = -0.50  // -50% (catastrophic decline)
MAX_GROWTH_RATE = 0.50   // +50% (exceptional growth)

// Population bounds
MIN_POPULATION = 1000
MAX_POPULATION = 10_000_000_000

// GDP per capita bounds
MIN_GDP_PER_CAPITA = 100
MAX_GDP_PER_CAPITA = 500_000
```

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                      IxTime System                       │
│         (Foundation for all time-based calcs)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Core Economic Calculations                  │
│  (GDP progression, population growth, tier classification)│
└────────┬────────────────────────┬───────────────────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐    ┌──────────────────────────────┐
│  Enhanced Econ   │    │  Builder Economy             │
│  Indices         │    │  Calculations                │
│  (ERI,PII,SEWI)  │    │  (Employment, Income, Trade) │
└────────┬─────────┘    └───────────┬──────────────────┘
         │                          │
         │                          │
         ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│           Atomic Component Effectiveness                 │
│    (Government components, synergies, conflicts)         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│        Unified Effectiveness Calculator                  │
│   (Cross-builder integration, optimization)              │
└────────┬──────────────────────┬─────────────────────────┘
         │                      │
         ▼                      ▼
┌──────────────────┐    ┌────────────────────────┐
│ Vitality Scores  │    │  Stability Formulas    │
│ (5 vitality      │    │  (Crime, cohesion,     │
│  metrics)        │    │   protests, trust)     │
└──────────────────┘    └────────────────────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
         ┌─────────────────────┐
         │ Intelligence System  │
         │ (National health,    │
         │  alerts, forecasts)  │
         └─────────────────────┘
```

**Key Dependencies:**

1. **IxTime → All Systems**: Time calculations are foundational
2. **Core Calculations → Enhanced Indices**: Enhanced metrics build on core stats
3. **Core + Builder → Atomic**: Component effectiveness uses economic data
4. **All Systems → Unified**: Unified calculator integrates everything
5. **Unified → Intelligence**: Intelligence derives from unified metrics

---

## Data Sources

### Database Tables

**Primary Sources:**

```sql
-- Core economic data
Country: population, gdpPerCapita, economicTier, populationTier

-- Builder data
EconomyBuilderData: selectedAtomicComponents, customValues
GovernmentBuilderData: selectedComponents, structureType
TaxSystem: type, categories, brackets, exemptions

-- Historical tracking
HistoricalDataPoint: population, gdpPerCapita, totalGdp, timestamp

-- DM inputs
DmInputs: inputType, value, duration, ixTimeTimestamp

-- Vitality scores (cached)
Country: economicVitality, populationWellbeing, diplomaticStanding,
         governmentalEfficiency, overallNationalHealth

-- Intelligence data
IntelligenceAlert: alertType, severity, generatedAt
CountryForecast: forecastType, projectedValue, confidenceLevel
```

### External Integrations

**IxWiki API:**

- Country roster data (baseline values)
- Diplomatic relationships
- Treaty information
- Historical events

**Discord Bot:**

- IxTime synchronization
- Real-time updates
- Admin commands
- Event notifications

### DM Inputs

**Input Types:**

1. **Population Adjustment**: Direct modifier to population growth rate
2. **GDP Adjustment**: Direct modifier to GDP growth rate
3. **Growth Rate Modifier**: Multiplicative modifier to growth
4. **Natural Disaster**: Immediate population/GDP impact
5. **Trade Agreement**: GDP per capita boost
6. **Economic Policy**: Local growth factor adjustment
7. **Special Event**: Combined population/GDP effects

---

## Formula Reference Tables

### Quick Reference: Tier Thresholds

| Metric | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 | Tier 7 |
|--------|--------|--------|--------|--------|--------|--------|--------|
| **Economic** (GDP/cap) | <$10k | $10-25k | $25-35k | $35-45k | $45-55k | $55-65k | $65k+ |
| **Max Growth** | 10% | 7.5% | 5% | 3.5% | 2.75% | 1.5% | 0.5% |
| **Population** | <10M | 10-30M | 30-50M | 50-80M | 80-120M | 120-350M | 350M+ |

### Quick Reference: Vitality Weights

| Score | Economic | Population | Government | Diplomatic |
|-------|----------|------------|------------|------------|
| **Weight** | 35% | 30% | 20% | 15% |
| **Max Points** | 100 | 100 | 100 | 100 |

### Quick Reference: Component Effectiveness Top 10

| Component | Base | Economic | Tax | Stability |
|-----------|------|----------|-----|-----------|
| Meritocratic System | 88 | +18% | +20% | +12 |
| Professional Bureaucracy | 85 | +20% | +25% | +15 |
| Rule of Law | 85 | +15% | +20% | +20 |
| Technocratic Process | 85 | +15% | +12% | +8 |
| Technocratic Agencies | 82 | +18% | +15% | +10 |
| Developmental State | 82 | +20% | +15% | +8 |
| Digital Government | 82 | +12% | +18% | +10 |
| Independent Judiciary | 80 | +8% | +12% | +18 |
| Economic Planning | 80 | +12% | +15% | +5 |
| Performance Legitimacy | 80 | +12% | +8% | +8 |

---

## Example Calculations

### Example 1: GDP Progression for Developing Country

**Scenario:**
- Country: "Examplestan"
- Population: 15,000,000
- Baseline GDP/capita: $18,000 (Developing tier)
- Adjusted GDP growth: 4.5% annually
- Local growth factor: 1.0
- Time elapsed: 3 years

**Step 1: Determine tier max growth**
```
GDP/capita $18,000 → Developing tier
Max growth rate = 7.5%
```

**Step 2: Calculate effective growth rate**
```
Base growth = 0.045 (4.5%)
× Global factor = 0.045 × 1.0321 = 0.0464445 (4.64%)
× Local factor = 0.0464445 × 1.0 = 0.0464445
× Tier modifier = 0.0464445 × 1.0 = 0.0464445
```

**Step 3: Apply tier cap**
```
Effective rate = 0.0464445 (4.64%)
Tier max = 0.075 (7.5%)
Final rate = min(0.0464445, 0.075) = 0.0464445
```

**Step 4: Compound over time**
```
New GDP/capita = 18000 × (1.0464445)^3
               = 18000 × 1.14563
               = $20,621.34
```

**Step 5: Calculate total GDP**
```
Population growth = 1.5% annually
New population = 15,000,000 × (1.015)^3 = 15,683,587

Total GDP = 15,683,587 × $20,621.34
          = $323,468,927,858 ($323.47 billion)
```

### Example 2: Atomic Component Effectiveness

**Scenario:**
- Government components: [Professional Bureaucracy, Rule of Law, Democratic Process]
- Base GDP: $35,000/capita
- Base tax revenue: 25% of GDP

**Step 1: Base component effects**
```
Professional Bureaucracy:
  economic = 1.20, tax = 1.25, stability = +15

Rule of Law:
  economic = 1.15, tax = 1.20, stability = +20

Democratic Process:
  economic = 1.03, tax = 1.05, stability = +5
```

**Step 2: Multiplicative application**
```
GDP modifier = 1.20 × 1.15 × 1.03 = 1.4214 (+42.14%)
Tax modifier = 1.25 × 1.20 × 1.05 = 1.575 (+57.5%)
Stability = 15 + 20 + 5 = +40 points
```

**Step 3: Check for synergies**
```
No synergies detected (none of the synergy pairs present)
```

**Step 4: Check for conflicts**
```
No conflicts detected
```

**Step 5: Final modifiers**
```
New GDP growth = base × 1.4214
New tax efficiency = base × 1.575
Stability bonus = +40 points
```

**Step 6: Overall effectiveness**
```
Base effectiveness = (85 + 85 + 68) / 3 = 79.33
Synergy bonus = 0
Conflict penalty = 0
Overall score = 79.33
```

### Example 3: Vitality Score Calculation

**Scenario:**
- GDP/capita: $42,000 (Healthy tier)
- Growth rate: 2.8%
- Unemployment: 4.2%
- Life expectancy: 78 years
- Literacy: 97%
- Gini: 0.33
- Alliances: 6
- Treaties: 15

**Economic Vitality:**
```
Base = 50
GDP/capita ($42k) = +20 (range: $40k-$60k)
Growth (2.8%) = +15 (range: 1-3%)
Employment (95.8%) = +19.16 (min(20, 95.8/5))
Tier (Healthy) = +9
Total = 50 + 20 + 15 + 19.16 + 9 = 113.16 → capped at 100
Final = 100
```

**Population Wellbeing:**
```
Base = 50
Life expectancy (78) = +20 (range: 75-80)
Literacy (97%) = +19.4 (97/100 × 20)
Gini (0.33) = +15 (range: 0.25-0.35)
Total = 50 + 20 + 19.4 + 15 = 104.4 → capped at 100
Final = 100
```

**Diplomatic Standing:**
```
Base = 50
Alliances (6) = +20 (range: 5-7)
Treaties (15) = +15 (range: 10-20)
Total = 50 + 20 + 15 = 85
Final = 85
```

**Governmental Efficiency:**
```
Assume: approval 65%, stability "Stable", efficiency "Good", infrastructure 75
Base = 50
Approval (65%) = +9 (((65-50)/50) × 30)
Stability = +20
Efficiency = +15
Infrastructure = +11.25 (75/100 × 15)
Total = 50 + 9 + 20 + 15 + 11.25 = 105.25 → capped at 100
Final = 100
```

**Overall National Health:**
```
Overall = 100 × 0.35 + 100 × 0.30 + 100 × 0.20 + 85 × 0.15
        = 35 + 30 + 20 + 12.75
        = 97.75 → rounded to 98
```

### Example 4: Tax Calculation (Progressive System)

**Scenario:**
- Gross income: $150,000
- Tax system: Progressive with 5 brackets
- Standard deduction: $12,000
- Exemptions: $4,000 (personal)

**Brackets:**
```
1. $0 - $10,000: 10%
2. $10,001 - $40,000: 15%
3. $40,001 - $85,000: 22%
4. $85,001 - $160,000: 24%
5. $160,001+: 28%
```

**Step 1: Calculate adjusted gross income**
```
Gross income = $150,000
Exemptions = $4,000
Adjusted gross = $150,000 - $4,000 = $146,000
```

**Step 2: Apply deductions**
```
Standard deduction = $12,000
Taxable income = $146,000 - $12,000 = $134,000
```

**Step 3: Calculate tax by bracket**
```
Bracket 1: $10,000 × 0.10 = $1,000
Bracket 2: $30,000 × 0.15 = $4,500
Bracket 3: $45,000 × 0.22 = $9,900
Bracket 4: $49,000 × 0.24 = $11,760
Bracket 5: $0 (income doesn't reach this bracket)

Total tax = $1,000 + $4,500 + $9,900 + $11,760 = $27,160
```

**Step 4: Calculate rates**
```
Effective rate = ($27,160 / $150,000) × 100 = 18.11%
Marginal rate = 24% (highest bracket reached)
```

---

## File Locations

### Core Calculation Files

```
/src/lib/
├── calculations.ts                          # Core GDP/population progression
├── enhanced-economic-calculations.ts        # ERI, PII, SEWI, ECTI indices
├── vitality-calculator.ts                   # 5 vitality scores
├── stability-formulas.ts                    # Crime, cohesion, stability
├── tax-calculator.ts                        # Tax calculation engine
├── atomic-client-calculations.ts            # Component effectiveness
├── ixtime.ts                                # Time system
└── economic-data-templates.ts               # Default data generation
```

### Builder Calculation Files

```
/src/app/builder/
├── lib/
│   └── economy-calculations.ts              # Employment, income, sectors, trade
└── services/
    ├── UnifiedEffectivenessCalculator.ts    # Cross-builder integration
    ├── CrossBuilderSynergyService.ts        # Synergy detection
    ├── BidirectionalTaxSyncService.ts       # Tax-economy sync
    └── BidirectionalGovernmentSyncService.ts # Gov-economy sync
```

### Component Definition Files

```
/src/components/
├── economy/atoms/
│   └── AtomicEconomicComponents.tsx         # Economic component definitions
├── government/atoms/
│   └── AtomicGovernmentComponents.tsx       # Government component definitions
└── tax-system/atoms/
    └── TaxSystemForm.tsx                     # Tax system configuration
```

### Service Layer Files

```
/src/services/
├── AtomicEffectivenessService.ts            # Component effectiveness scoring
├── ContextIntelligenceEngine.ts             # Intelligence generation
└── NotificationOrchestrator.ts              # Alert calculation triggers
```

### Type Definition Files

```
/src/types/
├── ixstats.ts                               # Core types (Country, Stats)
├── economics.ts                             # Economic data types
├── economy-builder.ts                       # Builder state types
├── government.ts                            # Government types
├── tax-system.ts                            # Tax system types
└── validation/
    ├── government.ts                        # Government validation
    └── tax.ts                               # Tax validation
```

---

## Performance Considerations

### Caching Strategy

**Calculation Results:**

```typescript
// Cache vitality scores in database (updated every 15 minutes)
Country.economicVitality
Country.populationWellbeing
Country.diplomaticStanding
Country.governmentalEfficiency
Country.overallNationalHealth

// Cache historical data points (written on calculation)
HistoricalDataPoint.population
HistoricalDataPoint.gdpPerCapita
HistoricalDataPoint.totalGdp
```

**Intelligence Data:**

```typescript
// Cache intelligence scores (updated on request, 5-minute TTL)
useIntelligenceData() hook with SWR caching

// Cache forecasts (updated daily)
CountryForecast table with timestamp validation
```

### Optimization Patterns

**1. Memoization for Component Calculations:**

```typescript
// Memoize expensive synergy detection
const synergyResults = useMemo(() =>
  detectPotentialSynergies(components),
  [components]
);

// Memoize effectiveness calculations
const effectiveness = useMemo(() =>
  calculateOverallEffectiveness(components),
  [components]
);
```

**2. Lazy Evaluation:**

```typescript
// Only calculate detailed breakdown when requested
if (showDetailedBreakdown) {
  const breakdown = calculateEffectivenessBreakdown(...);
}

// Only generate recommendations when viewing optimization panel
if (optimizationPanelOpen) {
  const recommendations = await generateOptimizationRecommendations(...);
}
```

**3. Batch Processing:**

```typescript
// Batch historical data point creation
const dataPoints = countries.map(country =>
  calculator.createHistoricalDataPoint(country)
);
await prisma.historicalDataPoint.createMany({ data: dataPoints });
```

**4. Incremental Updates:**

```typescript
// Only recalculate changed values
if (populationChanged || gdpChanged) {
  vitality = calculateEconomicVitality(country);
} else {
  vitality = cachedVitality;
}
```

### Database Query Optimization

**Indexed Fields:**

```sql
-- Core indexes for calculations
CREATE INDEX idx_country_gdp ON Country(currentGdpPerCapita);
CREATE INDEX idx_country_population ON Country(currentPopulation);
CREATE INDEX idx_country_tier ON Country(economicTier);

-- Historical data indexes
CREATE INDEX idx_historical_country_time ON HistoricalDataPoint(countryId, ixTimeTimestamp);
CREATE INDEX idx_dm_inputs_time ON DmInputs(ixTimeTimestamp, countryId);
```

**Query Patterns:**

```typescript
// Fetch only needed fields
const country = await prisma.country.findUnique({
  where: { id },
  select: {
    currentGdpPerCapita: true,
    currentPopulation: true,
    economicTier: true,
    // ... only what's needed
  }
});

// Use pagination for large datasets
const countries = await prisma.country.findMany({
  take: 50,
  skip: page * 50,
  orderBy: { currentGdpPerCapita: 'desc' }
});
```

### Calculation Frequency Guidelines

| Calculation Type | Frequency | Trigger |
|------------------|-----------|---------|
| Core GDP/Population | On-demand | User navigation, time advance |
| Vitality Scores | 15 minutes | Background job |
| Intelligence Alerts | Real-time | Threshold crossing |
| Historical Points | Daily | Scheduled job |
| Enhanced Indices | On-request | Dashboard load |
| Stability Metrics | On-demand | Security page load |
| Tax Calculations | Real-time | Tax builder interaction |

### Memory Management

**Large Dataset Handling:**

```typescript
// Stream processing for bulk calculations
async function* calculateCountryBatch(countries: Country[]) {
  for (const country of countries) {
    yield calculateAllVitalityScores(country);
  }
}

// Use generators to avoid loading all data at once
for await (const scores of calculateCountryBatch(allCountries)) {
  await saveScores(scores);
}
```

**Cleanup Patterns:**

```typescript
// Clear calculation caches after use
useEffect(() => {
  return () => {
    clearCalculationCache();
  };
}, []);
```

---

## Version History

### v1.1.1 (October 17, 2025)

- Updated documentation to reflect current system metrics
- Database schema now includes 131 Prisma models
- API layer expanded to 36 tRPC routers with 304 endpoints
- Enhanced calculation accuracy and performance optimizations

### v1.1.0 (October 2025)

- Added unified effectiveness calculator
- Enhanced cross-builder synergy detection
- Improved stability formulas with 15+ metrics
- Added comprehensive example calculations
- Performance optimization documentation

### v1.0.0 (September 2025)

- Initial production release
- Core economic calculations implemented
- Enhanced indices (ERI, PII, SEWI, ECTI)
- Vitality scoring system
- Tax calculation engine
- Atomic component effectiveness

---

## References

### Internal Documentation

- [Implementation Status](./IMPLEMENTATION_STATUS.md)
- [Unified Design Framework](./UNIFIED_DESIGN_FRAMEWORK.md)
- [API Documentation](./API_DOCUMENTATION.md)

### External Resources

- World Bank Economic Indicators
- IMF GDP Growth Models
- OECD Tax Policy Analysis
- UN Human Development Index Methodology

---

**End of Document**
