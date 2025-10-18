# Intelligence System Documentation

**Version:** 1.1.0
**Last Updated:** October 2025
**Status:** Production-Ready (95% Feature Complete)

---

## ⚠️ Important Notice: Unified Intelligence Router

As of v1.1.0, the intelligence system has been consolidated into a **unified intelligence router** (`unifiedIntelligence`). The legacy ECI and SDI routers are **deprecated** and will be removed in v2.0.0.

### Migration Required
- **Old**: `api.eci.*` and `api.sdi.*`
- **New**: `api.unifiedIntelligence.*`
- **Deadline**: v2.0.0 (Q2 2026)
- **Benefits**: Improved performance, unified analytics, single API surface

See [API_REFERENCE.md](./API_REFERENCE.md#unified-intelligence-router) for complete migration guide.

---

## Table of Contents

1. [Overview](#overview)
2. [Intelligence Engine Architecture](#intelligence-engine-architecture)
3. [Vitality Calculations](#vitality-calculations)
4. [Intelligence Generation Algorithms](#intelligence-generation-algorithms)
5. [Alert Detection Rules](#alert-detection-rules)
6. [Recommendation Engine](#recommendation-engine)
7. [Risk Assessment](#risk-assessment)
8. [Data Transformers](#data-transformers)
9. [Integration with MyCountry](#integration-with-mycountry)
10. [Development Guide](#development-guide)

---

## Overview

The Intelligence System is an advanced analytics engine that processes country data to generate actionable insights, predictions, alerts, and recommendations. It combines statistical analysis, machine learning techniques, and domain expertise to provide executive-level intelligence.

### Key Features

- **5 Vitality Metrics**: Economic, Population, Diplomatic, Governmental, Overall
- **4 Intelligence Types**: Alerts, Insights, Recommendations, Forecasts
- **Advanced Analytics**: Anomaly detection, trend analysis, correlation analysis, threshold monitoring
- **Real-time Processing**: 30-second update cycles with WebSocket broadcasts
- **Confidence Scoring**: All intelligence includes confidence levels (0-100%)

### Technology Stack

- **Statistical Analysis**: Z-score, Modified Z-score, MAD (Median Absolute Deviation)
- **Time Series**: Linear forecasting, Dynamic Factor Models, trend decomposition
- **Correlation**: Pearson correlation coefficient for multi-factor analysis
- **Anomaly Detection**: Threshold-based and statistical outlier detection

---

## Intelligence Engine Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Intelligence Engine                         │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Anomaly    │    Trend     │ Correlation  │   Threshold    │
│  Detection   │   Analysis   │   Analysis   │   Monitoring   │
└──────────────┴──────────────┴──────────────┴────────────────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                           │
                    ┌──────▼──────┐
                    │ Intelligence│
                    │   Report    │
                    │  Generator  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐     ┌─────▼─────┐    ┌─────▼─────┐
    │ Alerts  │     │  Insights │    │ Forecasts │
    └─────────┘     └───────────┘    └───────────┘
```

### Core Components

```typescript
// src/lib/intelligence-engine.ts

interface IntelligenceReport {
  countryId: string;
  generated: number;
  alerts: IntelligenceAlert[];
  correlations: CorrelationInsight[];
  trends: TrendAnalysis[];
  summary: {
    overallHealth: number;
    criticalIssues: number;
    opportunities: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export function generateIntelligenceReport(
  country: Country,
  historicalData: {
    gdpHistory: number[];
    populationHistory: number[];
    unemploymentHistory: number[];
  },
  peerAverages: Record<string, number>
): IntelligenceReport {
  // 1. Anomaly Detection
  // 2. Trend Analysis
  // 3. Correlation Analysis
  // 4. Threshold Monitoring
  // 5. Opportunity Detection
  // 6. Summary Generation
}
```

### Processing Pipeline

```
Input Data (Country + Historical)
         │
         ▼
  ┌──────────────┐
  │ Normalize    │ → Convert to standard scales
  │   Data       │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  Statistical │ → Calculate mean, std dev, median, MAD
  │   Analysis   │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  Detection   │ → Apply detection algorithms
  │  Algorithms  │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ Intelligence │ → Generate structured output
  │  Generation  │
  └──────┬───────┘
         │
         ▼
  Intelligence Report
```

---

## Vitality Calculations

### Economic Vitality

**Formula:**

```typescript
economicVitality = (
  gdpScore * 0.40 +
  growthScore * 0.30 +
  tierScore * 0.20 +
  componentBonus * 0.10
);
```

**Components:**

1. **GDP Score** (40% weight)

```typescript
function normalizeGDP(gdpPerCapita: number): number {
  // Logarithmic scale to handle wide range
  const minGDP = 500;
  const maxGDP = 150000;
  const logMin = Math.log(minGDP);
  const logMax = Math.log(maxGDP);
  const logValue = Math.log(Math.max(minGDP, Math.min(maxGDP, gdpPerCapita)));

  return ((logValue - logMin) / (logMax - logMin)) * 100;
}

// Examples:
// $5,000 → 35 points
// $25,000 → 65 points
// $75,000 → 90 points
```

2. **Growth Score** (30% weight)

```typescript
function normalizeGrowth(growthRate: number): number {
  // Linear scale from -5% to +10%
  const minGrowth = -0.05;
  const maxGrowth = 0.10;

  return Math.max(0, Math.min(100,
    ((growthRate - minGrowth) / (maxGrowth - minGrowth)) * 100
  ));
}

// Examples:
// -3% → 13 points
// 0% → 33 points
// 3% → 53 points
// 7% → 80 points
```

3. **Tier Score** (20% weight)

```typescript
function tierToScore(tier: EconomicTier): number {
  return {
    'developed': 85,
    'emerging': 60,
    'developing': 35
  }[tier];
}
```

4. **Component Bonus** (10% weight)

```typescript
function calculateComponentBonus(
  components: ComponentType[],
  area: 'economic'
): number {
  let bonus = 0;

  for (const component of components) {
    if (component.economicImpact?.gdpEffect) {
      bonus += component.economicImpact.gdpEffect;
    }
  }

  return Math.min(50, bonus); // Cap at 50 points
}
```

### Population Wellbeing

**Formula:**

```typescript
populationWellbeing = (
  populationScore * 0.25 +
  growthScore * 0.30 +
  tierScore * 0.20 +
  qualityOfLifeScore * 0.25
);
```

**Components:**

1. **Population Score** (25% weight)

```typescript
function normalizePopulation(population: number): number {
  // Logarithmic scale
  const minPop = 1000;
  const maxPop = 1000000000; // 1 billion
  const logMin = Math.log(minPop);
  const logMax = Math.log(maxPop);
  const logValue = Math.log(Math.max(minPop, Math.min(maxPop, population)));

  return ((logValue - logMin) / (logMax - logMin)) * 100;
}
```

2. **Growth Score** (30% weight)

```typescript
function normalizePopulationGrowth(growthRate: number): number {
  // Ideal range: 0.5% to 2.5%
  // Penalty for negative or excessive growth
  if (growthRate < 0) {
    return Math.max(0, 50 + growthRate * 100); // -1% → 40 points
  } else if (growthRate < 0.005) {
    return 50 + growthRate * 2000; // 0.5% → 60 points
  } else if (growthRate <= 0.025) {
    return 60 + (growthRate - 0.005) * 2000; // 2.5% → 100 points
  } else {
    return Math.max(50, 100 - (growthRate - 0.025) * 1000); // Penalty for > 2.5%
  }
}
```

3. **Tier Score** (20% weight)

```typescript
function popTierToScore(tier: PopulationTier): number {
  return {
    'massive': 90,
    'large': 75,
    'medium': 60,
    'small': 45,
    'tiny': 30
  }[tier];
}
```

4. **Quality of Life Score** (25% weight)

```typescript
function calculateQualityOfLife(
  economicVitality: number,
  governmentalEfficiency: number,
  infrastructureRating: number
): number {
  return (
    economicVitality * 0.4 +
    governmentalEfficiency * 0.3 +
    infrastructureRating * 0.3
  );
}
```

### Diplomatic Standing

**Formula:**

```typescript
diplomaticStanding = (
  embassyScore * 0.30 +
  missionScore * 0.25 +
  allianceScore * 0.20 +
  culturalInfluence * 0.15 +
  regionalIntegration * 0.10
);
```

**Components:**

1. **Embassy Network** (30% weight)

```typescript
function calculateEmbassyScore(embassyCount: number): number {
  // Diminishing returns: log scale
  return Math.min(100, Math.log(embassyCount + 1) / Math.log(200) * 100);
}

// Examples:
// 0 embassies → 0 points
// 10 embassies → 50 points
// 50 embassies → 75 points
// 150 embassies → 95 points
```

2. **Active Missions** (25% weight)

```typescript
function calculateMissionScore(missionCount: number): number {
  return Math.min(100, missionCount * 5); // 20 missions = 100 points
}
```

3. **Alliance Memberships** (20% weight)

```typescript
function calculateAllianceScore(allianceCount: number): number {
  return Math.min(100, allianceCount * 10); // 10 alliances = 100 points
}
```

4. **Cultural Influence** (15% weight)

```typescript
function calculateCulturalInfluence(
  economicVitality: number,
  populationWellbeing: number
): number {
  return (economicVitality + populationWellbeing) / 2;
}
```

5. **Regional Integration** (10% weight)

```typescript
function calculateRegionalIntegration(
  embassiesInRegion: number,
  totalEmbassies: number
): number {
  if (totalEmbassies === 0) return 50;
  return (embassiesInRegion / totalEmbassies) * 100;
}
```

### Governmental Efficiency

**Formula:**

```typescript
governmentalEfficiency = (
  administrativeEffectiveness * 0.30 +
  budgetExecution * 0.25 +
  policyImplementation * 0.20 +
  publicServiceQuality * 0.15 +
  corruptionControl * 0.10
);
```

**Components:**

1. **Administrative Effectiveness** (30% weight)

```typescript
function calculateAdministrativeEffectiveness(
  components: ComponentType[]
): number {
  let totalEffectiveness = 0;
  let totalWeight = 0;

  for (const component of components) {
    totalEffectiveness += component.efficiency * component.powerLevel / 100;
    totalWeight += component.powerLevel / 100;
  }

  return totalWeight > 0 ? totalEffectiveness / totalWeight : 50;
}
```

2. **Budget Execution** (25% weight)

```typescript
function calculateBudgetExecution(
  allocatedBudget: number,
  spentBudget: number
): number {
  const executionRate = spentBudget / allocatedBudget;

  // Ideal: 90-100% execution
  // Penalty for under-execution or over-execution
  if (executionRate < 0.7) {
    return executionRate * 100; // 70% → 70 points
  } else if (executionRate <= 1.0) {
    return 70 + (executionRate - 0.7) * 100; // 90% → 90 points
  } else {
    return Math.max(50, 100 - (executionRate - 1.0) * 100); // Over-budget penalty
  }
}
```

3. **Policy Implementation** (20% weight)

```typescript
function calculatePolicyImplementation(
  successfulPolicies: number,
  totalPolicies: number
): number {
  if (totalPolicies === 0) return 70; // Default
  return (successfulPolicies / totalPolicies) * 100;
}
```

4. **Public Service Quality** (15% weight)

```typescript
function calculatePublicServiceQuality(
  infrastructureRating: number,
  educationRating: number,
  healthcareRating: number
): number {
  return (infrastructureRating + educationRating + healthcareRating) / 3;
}
```

5. **Corruption Control** (10% weight)

```typescript
function calculateCorruptionControl(
  transparencyScore: number,
  judicialIndependence: number
): number {
  return (transparencyScore + judicialIndependence) / 2;
}
```

### Overall Vitality

**Formula:**

```typescript
overallVitality = (
  economicVitality * 0.35 +
  populationWellbeing * 0.25 +
  diplomaticStanding * 0.20 +
  governmentalEfficiency * 0.20
);
```

**Weighting Rationale:**
- Economic: 35% (most impactful on country success)
- Population: 25% (human capital critical)
- Diplomatic: 20% (international standing)
- Governmental: 20% (administrative capacity)

---

## Intelligence Generation Algorithms

### 1. Anomaly Detection

**Algorithm: Modified Z-Score**

```typescript
export function detectAnomalies(
  current: number,
  historical: number[],
  metric: string,
  category: string
): IntelligenceAlert | null {
  if (historical.length < 3) return null;

  // Calculate statistics
  const mean = calculateMean(historical);
  const stdDev = calculateStdDev(historical, mean);
  const median = calculateMedian(historical);
  const mad = calculateMAD(historical);

  // Use modified z-score for economic data (non-normal distributions)
  const zScore = calculateZScore(current, mean, stdDev);
  const modifiedZScore = calculateModifiedZScore(current, median, mad);
  const effectiveZScore = category === 'economic' ? modifiedZScore : zScore;

  // Thresholds
  // Critical: |z| > 3.0
  // High: |z| > 2.5
  // Medium: |z| > 2.0
  let severity: 'critical' | 'high' | 'medium' | 'low' | null = null;
  if (Math.abs(effectiveZScore) > 3.0) severity = 'critical';
  else if (Math.abs(effectiveZScore) > 2.5) severity = 'high';
  else if (Math.abs(effectiveZScore) > 2.0) severity = 'medium';

  if (!severity) return null;

  const deviation = ((current - mean) / mean) * 100;
  const direction = current > mean ? 'higher' : 'lower';
  const confidence = Math.min(95, 70 + Math.abs(effectiveZScore) * 8);

  return {
    id: `anomaly-${category}-${metric}-${Date.now()}`,
    type: 'anomaly',
    severity,
    category,
    title: `Unusual ${metric} detected`,
    description: `${metric} is ${Math.abs(deviation).toFixed(1)}% ${direction} than historical average (z-score: ${effectiveZScore.toFixed(2)})`,
    confidence,
    detected: Date.now(),
    factors: [metric, 'historical_deviation'],
    metrics: {
      current,
      expected: mean,
      deviation,
      zScore: effectiveZScore
    },
    recommendations: generateAnomalyRecommendations(metric, direction, severity, category)
  };
}
```

**Z-Score Calculation:**

```typescript
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}
```

**Modified Z-Score (Median Absolute Deviation):**

```typescript
function calculateModifiedZScore(value: number, median: number, mad: number): number {
  if (mad === 0) return 0;
  return 0.6745 * (value - median) / mad; // 0.6745 = 75th percentile of standard normal
}

function calculateMAD(values: number[]): number {
  const median = calculateMedian(values);
  const deviations = values.map(v => Math.abs(v - median));
  return calculateMedian(deviations);
}
```

### 2. Trend Analysis

**Algorithm: Time Series Decomposition**

```typescript
export function analyzeTrend(
  values: number[],
  metric: string,
  category: string
): TrendAnalysis | null {
  if (values.length < 5) return null;

  // Calculate velocities (rate of change)
  const velocities: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const percentChange = ((values[i]! - values[i - 1]!) / values[i - 1]!) * 100;
    velocities.push(percentChange);
  }

  const avgVelocity = calculateMean(velocities);
  const momentum = calculateMomentum(values); // Change in velocity

  // Determine trend type
  let trend: TrendAnalysis['trend'];
  if (Math.abs(avgVelocity) < 1) {
    trend = 'stable';
  } else if (avgVelocity > 0) {
    trend = momentum > 0 ? 'accelerating_up' : 'steady_up';
  } else {
    trend = momentum < 0 ? 'accelerating_down' : 'steady_down';
  }

  // Check volatility
  const velocityStdDev = calculateStdDev(velocities);
  if (velocityStdDev > Math.abs(avgVelocity) * 2) {
    trend = 'volatile';
  }

  // Simple linear forecast
  const lastValue = values[values.length - 1]!;
  const forecastWeek = lastValue * (1 + avgVelocity / 100);
  const forecastMonth = lastValue * Math.pow(1 + avgVelocity / 100, 4);
  const forecastQuarter = lastValue * Math.pow(1 + avgVelocity / 100, 12);

  // Confidence based on consistency
  const confidence = Math.max(50, Math.min(95, 100 - velocityStdDev * 10));

  return {
    metric,
    category,
    trend,
    velocity: avgVelocity,
    momentum,
    forecast: {
      next_week: forecastWeek,
      next_month: forecastMonth,
      next_quarter: forecastQuarter,
      confidence
    },
    inflectionPoints: detectInflectionPoints(values)
  };
}
```

**Momentum Calculation:**

```typescript
function calculateMomentum(values: number[]): number {
  if (values.length < 3) return 0;

  // Calculate velocities
  const velocities: number[] = [];
  for (let i = 1; i < values.length; i++) {
    velocities.push(values[i]! - values[i - 1]!);
  }

  // Momentum = change in velocity
  const momentum = velocities[velocities.length - 1]! - velocities[0]!;
  return momentum;
}
```

**Inflection Point Detection:**

```typescript
function detectInflectionPoints(
  values: number[]
): Array<{ timestamp: number; type: 'peak' | 'trough' | 'reversal' }> {
  const points: Array<{ timestamp: number; type: 'peak' | 'trough' | 'reversal' }> = [];

  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1]!;
    const curr = values[i]!;
    const next = values[i + 1]!;

    // Peak: higher than both neighbors
    if (curr > prev && curr > next) {
      points.push({
        timestamp: Date.now() - (values.length - i) * 86400000, // Days ago
        type: 'peak'
      });
    }
    // Trough: lower than both neighbors
    else if (curr < prev && curr < next) {
      points.push({
        timestamp: Date.now() - (values.length - i) * 86400000,
        type: 'trough'
      });
    }
  }

  return points;
}
```

### 3. Correlation Analysis

**Algorithm: Pearson Correlation Coefficient**

```typescript
export function analyzeCorrelations(
  factors: Array<{ name: string; values: number[]; category: string }>
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = [];

  // Compare each pair
  for (let i = 0; i < factors.length; i++) {
    for (let j = i + 1; j < factors.length; j++) {
      const f1 = factors[i]!;
      const f2 = factors[j]!;

      const correlation = calculateCorrelation(f1.values, f2.values);
      const absCorr = Math.abs(correlation);

      // Only report significant correlations (|r| > 0.5)
      if (absCorr < 0.5) continue;

      const significance = absCorr > 0.8 ? 'strong' : absCorr > 0.65 ? 'moderate' : 'weak';
      const direction = correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none';
      const confidence = Math.min(95, absCorr * 100);

      insights.push({
        factor1: f1.name,
        factor2: f2.name,
        correlation,
        significance,
        direction,
        confidence,
        implications: generateCorrelationImplications(f1.name, f2.name, direction, significance)
      });
    }
  }

  return insights;
}
```

**Pearson Correlation:**

```typescript
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);
  const stdX = calculateStdDev(x, meanX);
  const stdY = calculateStdDev(y, meanY);

  if (stdX === 0 || stdY === 0) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += ((x[i]! - meanX) / stdX) * ((y[i]! - meanY) / stdY);
  }

  return sum / n;
}
```

**Correlation Interpretation:**

| Correlation | Strength | Interpretation |
|-------------|----------|----------------|
| 0.8 - 1.0 | Strong | Highly related factors |
| 0.65 - 0.79 | Moderate | Related with some variation |
| 0.5 - 0.64 | Weak | Weakly related |
| < 0.5 | None | No significant relationship |

### 4. Threshold Monitoring

**Algorithm: Benchmark Comparison**

```typescript
export function monitorThresholds(
  country: Country,
  peerAverages: Record<string, number>
): IntelligenceAlert[] {
  const alerts: IntelligenceAlert[] = [];

  // GDP Per Capita Threshold (< 70% of peer average)
  if (country.currentGdpPerCapita < peerAverages.gdpPerCapita * 0.7) {
    const deviation = ((country.currentGdpPerCapita / peerAverages.gdpPerCapita - 1) * 100);

    alerts.push({
      id: `threshold-gdp-${Date.now()}`,
      type: 'threshold',
      severity: 'high',
      category: 'economic',
      title: 'GDP Per Capita Below Peer Benchmark',
      description: `GDP per capita is ${Math.abs(deviation).toFixed(1)}% below peer average`,
      confidence: 90,
      detected: Date.now(),
      factors: ['gdp_per_capita', 'peer_comparison'],
      metrics: {
        current: country.currentGdpPerCapita,
        expected: peerAverages.gdpPerCapita,
        deviation,
        zScore: -1.5
      },
      recommendations: [
        'Review economic growth strategies',
        'Analyze productivity barriers',
        'Consider investment incentives'
      ]
    });
  }

  // Unemployment Threshold (> 8%)
  if (country.unemploymentRate !== null && country.unemploymentRate > 8.0) {
    alerts.push({
      id: `threshold-unemployment-${Date.now()}`,
      type: 'threshold',
      severity: country.unemploymentRate > 12 ? 'critical' : 'high',
      category: 'economic',
      title: 'High Unemployment Rate',
      description: `Unemployment at ${country.unemploymentRate.toFixed(1)}% exceeds healthy threshold of 5-6%`,
      confidence: 95,
      detected: Date.now(),
      factors: ['unemployment', 'labor_market'],
      metrics: {
        current: country.unemploymentRate,
        expected: 5.5,
        deviation: ((country.unemploymentRate - 5.5) / 5.5) * 100,
        zScore: (country.unemploymentRate - 5.5) / 2.0
      },
      recommendations: [
        'Implement job creation programs',
        'Review labor market policies',
        'Invest in skills training'
      ]
    });
  }

  // Infrastructure Threshold (< 50 rating)
  if (country.infrastructureRating < 50) {
    alerts.push({
      id: `threshold-infrastructure-${Date.now()}`,
      type: 'threshold',
      severity: 'medium',
      category: 'governance',
      title: 'Infrastructure Below Acceptable Level',
      description: `Infrastructure rating at ${country.infrastructureRating} is below acceptable threshold of 50`,
      confidence: 85,
      detected: Date.now(),
      factors: ['infrastructure', 'public_services'],
      metrics: {
        current: country.infrastructureRating,
        expected: 50,
        deviation: ((country.infrastructureRating - 50) / 50) * 100,
        zScore: (country.infrastructureRating - 50) / 15
      },
      recommendations: [
        'Increase infrastructure investment',
        'Prioritize critical infrastructure projects',
        'Review infrastructure maintenance programs'
      ]
    });
  }

  return alerts;
}
```

---

## Alert Detection Rules

### Severity Levels

```typescript
type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

// Severity determination
function determineSeverity(
  zScore: number,
  impact: string,
  category: string
): AlertSeverity {
  const absZ = Math.abs(zScore);

  // Critical: |z| > 3.0 or major economic impact
  if (absZ > 3.0 || impact === 'severe') {
    return 'critical';
  }
  // High: |z| > 2.5 or high impact
  if (absZ > 2.5 || impact === 'high') {
    return 'high';
  }
  // Medium: |z| > 2.0 or medium impact
  if (absZ > 2.0 || impact === 'medium') {
    return 'medium';
  }
  // Low: everything else
  return 'low';
}
```

### Detection Rules

| Rule Type | Trigger Condition | Severity | Confidence |
|-----------|-------------------|----------|------------|
| GDP Anomaly | z-score > 3.0 | Critical | 85-95% |
| GDP Below Peers | < 70% of peer avg | High | 90% |
| High Unemployment | > 8% | High | 95% |
| Critical Unemployment | > 12% | Critical | 95% |
| Negative Growth | < -2% for 2+ quarters | High | 80% |
| Low Infrastructure | < 50 rating | Medium | 85% |
| Population Decline | < -1% growth | Medium | 75% |
| Trade Deficit | > 5% of GDP | Medium | 70% |

### Alert Lifecycle

```typescript
interface AlertLifecycle {
  created: number;        // Timestamp
  detected: number;       // Detection timestamp
  acknowledged?: number;  // User acknowledged
  resolved?: number;      // Issue resolved
  expired?: number;       // Alert expired (24-72h)
  status: 'active' | 'acknowledged' | 'resolved' | 'expired';
}

// Auto-expire alerts after 24 hours for medium/low severity
// Auto-expire after 72 hours for high/critical severity
function checkExpiration(alert: IntelligenceAlert): boolean {
  const now = Date.now();
  const age = now - alert.detected;

  if (alert.severity === 'critical' || alert.severity === 'high') {
    return age > 72 * 60 * 60 * 1000; // 72 hours
  } else {
    return age > 24 * 60 * 60 * 1000; // 24 hours
  }
}
```

---

## Recommendation Engine

### Recommendation Generation

```typescript
interface RecommendationContext {
  vitalityScores: Record<string, number>;
  alerts: IntelligenceAlert[];
  trends: TrendAnalysis[];
  economicData: EconomicInputs;
  governmentComponents: ComponentType[];
}

export function generateRecommendations(
  context: RecommendationContext
): ActionableRecommendation[] {
  const recommendations: ActionableRecommendation[] = [];

  // 1. Address critical alerts
  for (const alert of context.alerts.filter(a => a.severity === 'critical')) {
    recommendations.push(generateAlertRecommendation(alert));
  }

  // 2. Address low vitality scores
  for (const [area, score] of Object.entries(context.vitalityScores)) {
    if (score < 50) {
      recommendations.push(generateVitalityRecommendation(area, score, context));
    }
  }

  // 3. Capitalize on positive trends
  for (const trend of context.trends.filter(t => t.trend === 'accelerating_up')) {
    recommendations.push(generateTrendRecommendation(trend, context));
  }

  // 4. Optimize synergies
  const missedSynergies = detectMissedSynergies(context.governmentComponents);
  for (const synergy of missedSynergies) {
    recommendations.push(generateSynergyRecommendation(synergy));
  }

  return recommendations
    .sort((a, b) => urgencyScore(b) - urgencyScore(a))
    .slice(0, 10); // Top 10
}
```

### Recommendation Types

#### 1. Alert-Based

```typescript
function generateAlertRecommendation(alert: IntelligenceAlert): ActionableRecommendation {
  return {
    id: `rec-alert-${alert.id}`,
    title: `Address ${alert.title}`,
    description: alert.recommendedActions[0] || 'Take corrective action',
    category: alert.category,
    urgency: alert.severity === 'critical' ? 'urgent' : 'important',
    difficulty: 'moderate',
    estimatedDuration: alert.severity === 'critical' ? '1-2 days' : '1-2 weeks',
    estimatedCost: 'Medium',
    estimatedBenefit: alert.severity === 'critical' ? 'High' : 'Medium',
    prerequisites: ['Administrative approval', 'Resource allocation'],
    risks: ['Implementation complexity', 'Resource constraints'],
    successProbability: 70,
    impact: {
      [alert.category]: alert.severity === 'critical' ? 15 : 10
    }
  };
}
```

#### 2. Vitality-Based

```typescript
function generateVitalityRecommendation(
  area: string,
  score: number,
  context: RecommendationContext
): ActionableRecommendation {
  // Example: Low economic vitality
  if (area === 'economic' && score < 50) {
    return {
      id: `rec-vitality-economic-${Date.now()}`,
      title: 'Accelerate Economic Reforms',
      description: 'Implement comprehensive economic reforms to boost GDP growth and productivity',
      category: 'economic',
      urgency: 'important',
      difficulty: 'complex',
      estimatedDuration: '6-12 months',
      estimatedCost: 'High',
      estimatedBenefit: '+15 economic vitality',
      prerequisites: [
        'Stable government structure',
        'Fiscal space for investments',
        'Political will for reform'
      ],
      risks: [
        'Short-term economic disruption',
        'Political opposition',
        'Implementation complexity'
      ],
      successProbability: 65,
      impact: {
        economic: 15,
        governance: 5
      }
    };
  }

  // ... other vitality areas
}
```

#### 3. Trend-Based

```typescript
function generateTrendRecommendation(
  trend: TrendAnalysis,
  context: RecommendationContext
): ActionableRecommendation {
  return {
    id: `rec-trend-${trend.metric}-${Date.now()}`,
    title: `Capitalize on ${trend.metric} Growth`,
    description: `${trend.metric} showing strong momentum - scale successful policies`,
    category: trend.category as any,
    urgency: 'routine',
    difficulty: 'easy',
    estimatedDuration: '2-4 weeks',
    estimatedCost: 'Low',
    estimatedBenefit: 'Medium',
    prerequisites: ['Identify successful factors', 'Allocate resources'],
    risks: ['Market conditions change', 'Resource misallocation'],
    successProbability: 75,
    impact: {
      [trend.category]: 8
    }
  };
}
```

### Urgency Scoring

```typescript
function urgencyScore(recommendation: ActionableRecommendation): number {
  const urgencyWeights = {
    'urgent': 100,
    'important': 75,
    'routine': 50,
    'future': 25
  };

  const impactTotal = Object.values(recommendation.impact).reduce((sum, val) => sum + (val || 0), 0);

  return urgencyWeights[recommendation.urgency] + impactTotal;
}
```

---

## Risk Assessment

### Risk Identification

```typescript
interface RiskAssessment {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  probability: number; // 0-1
  impact: {
    magnitude: 'low' | 'medium' | 'high' | 'severe';
    areas: string[];
  };
  mitigation: string[];
  timeline: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  earlyWarnings: string[];
  monitoringRequired: boolean;
}

export function assessRisks(
  country: Country,
  alerts: IntelligenceAlert[],
  trends: TrendAnalysis[]
): RiskAssessment[] {
  const risks: RiskAssessment[] = [];

  // 1. Economic recession risk
  const negativeGrowthTrend = trends.find(
    t => t.category === 'economic' && t.velocity < -2
  );

  if (negativeGrowthTrend) {
    risks.push({
      id: `risk-recession-${Date.now()}`,
      type: 'economic',
      severity: 'high',
      title: 'Economic Recession Risk',
      description: 'Sustained negative growth indicates recession risk',
      probability: Math.abs(negativeGrowthTrend.velocity) / 10,
      impact: {
        magnitude: 'high',
        areas: ['economic', 'population', 'governance']
      },
      mitigation: [
        'Implement fiscal stimulus',
        'Support critical industries',
        'Expand social safety net'
      ],
      timeline: 'short-term',
      earlyWarnings: [
        'Increasing unemployment',
        'Declining consumer confidence',
        'Business bankruptcies rising'
      ],
      monitoringRequired: true
    });
  }

  // 2. Population decline risk
  if (country.populationGrowthRate < -0.005) {
    risks.push({
      id: `risk-population-decline-${Date.now()}`,
      type: 'demographic',
      severity: 'medium',
      title: 'Population Decline Risk',
      description: 'Negative population growth threatens long-term economic sustainability',
      probability: Math.abs(country.populationGrowthRate),
      impact: {
        magnitude: 'medium',
        areas: ['population', 'economic']
      },
      mitigation: [
        'Pro-natalist policies',
        'Immigration reform',
        'Support for families'
      ],
      timeline: 'long-term',
      earlyWarnings: [
        'Aging population',
        'Low birth rates',
        'Youth emigration'
      ],
      monitoringRequired: true
    });
  }

  // 3. High-severity alert escalation
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  if (criticalAlerts.length >= 3) {
    risks.push({
      id: `risk-multi-crisis-${Date.now()}`,
      type: 'systemic',
      severity: 'critical',
      title: 'Multiple Simultaneous Crises',
      description: `${criticalAlerts.length} critical alerts indicate systemic risk`,
      probability: 0.8,
      impact: {
        magnitude: 'severe',
        areas: ['economic', 'population', 'diplomatic', 'governance']
      },
      mitigation: [
        'Emergency coordination committee',
        'Prioritize critical interventions',
        'International assistance'
      ],
      timeline: 'immediate',
      earlyWarnings: [
        'Rapid deterioration of multiple indicators',
        'Loss of policy effectiveness',
        'Social unrest'
      ],
      monitoringRequired: true
    });
  }

  return risks;
}
```

---

## Data Transformers

### Live Data Transformation

```typescript
// src/app/mycountry/utils/liveDataTransformers.ts

export function transformApiDataToVitalityIntelligence(
  country: ApiCountryData,
  previousCountry?: ApiCountryData
): VitalityIntelligence[] {
  return [
    {
      area: 'economic',
      score: country.economicVitality, // Real score from API
      trend: calculateTrend(country.economicVitality, previousCountry?.economicVitality),
      change: {
        value: previousCountry ?
          country.economicVitality - previousCountry.economicVitality : 0,
        period: 'vs previous calculation',
        reason: 'Economic performance evaluation'
      },
      status: getVitalityStatus(country.economicVitality),
      keyMetrics: [
        {
          id: 'gdp-per-capita',
          label: 'GDP per Capita',
          value: Math.round(country.currentGdpPerCapita),
          unit: '',
          trend: calculateTrend(country.currentGdpPerCapita, previousCountry?.currentGdpPerCapita),
          changeValue: previousCountry ? country.currentGdpPerCapita - previousCountry.currentGdpPerCapita : 0,
          changePercent: previousCountry ? ((country.currentGdpPerCapita - previousCountry.currentGdpPerCapita) / previousCountry.currentGdpPerCapita) * 100 : 0,
          changePeriod: 'vs previous',
          status: getMetricStatus(country.currentGdpPerCapita, 'gdp')
        },
        // ... other metrics
      ],
      forecast: {
        shortTerm: {
          projected: Math.min(100, country.economicVitality + (country.realGDPGrowthRate * 50)),
          confidence: 75,
          factors: ['GDP growth rate', 'Economic tier stability', 'Regional performance']
        },
        longTerm: {
          projected: Math.min(100, country.economicVitality + (country.realGDPGrowthRate * 200)),
          confidence: 65,
          factors: ['Long-term economic trends', 'Demographic changes', 'Global economic conditions']
        }
      },
      comparisons: {
        peerAverage: calculatePeerAverage(country, 'economic'),
        regionalAverage: calculateRegionalAverage(country, 'economic'),
        historicalBest: Math.max(country.economicVitality, 85),
        rank: calculateCountryRank(country.economicVitality, 'economic'),
        totalCountries: 180
      }
    },
    // ... other vitality areas
  ];
}
```

---

## Integration with MyCountry

### Dashboard Integration

```typescript
// MyCountry dashboard component
export function MyCountryDashboard() {
  const { data: country } = api.countries.getMyCountry.useQuery();
  const { data: intelligenceData } = api.intelligence.getForCountry.useQuery(
    { countryId: country?.id },
    { enabled: !!country?.id, refetchInterval: 30000 } // 30s
  );

  const intelligence = useMemo(() => {
    if (!country || !intelligenceData) return null;

    return transformApiDataToExecutiveIntelligence(
      country,
      intelligenceData,
      previousCountry
    );
  }, [country, intelligenceData]);

  return (
    <div>
      {intelligence && (
        <>
          <ExecutiveSummary intelligence={intelligence} />
          <VitalityRings vitality={intelligence.vitalityIntelligence} />
          <CriticalAlerts alerts={intelligence.criticalAlerts} />
          <TrendingInsights insights={intelligence.trendingInsights} />
        </>
      )}
    </div>
  );
}
```

### Real-time Updates

```typescript
// WebSocket intelligence updates
export function useRealTimeIntelligence(countryId: string) {
  const [updates, setUpdates] = useState<IntelligenceUpdate[]>([]);

  useEffect(() => {
    const socket = io(WS_URL);

    socket.emit('subscribe:intelligence', countryId);

    socket.on('intelligence:update', (update: IntelligenceUpdate) => {
      setUpdates(prev => [...prev, update]);

      // Trigger refetch if major change
      if (update.changeType === 'alert' && update.changes[0]?.impact === 'major') {
        refetch();
      }
    });

    return () => {
      socket.emit('unsubscribe:intelligence', countryId);
      socket.close();
    };
  }, [countryId]);

  return updates;
}
```

---

## Development Guide

### Testing Intelligence Engine

```typescript
// Mock country data
const mockCountry: Country = {
  id: 'test_country',
  currentGdpPerCapita: 35000,
  currentPopulation: 25000000,
  currentTotalGdp: 875000000000,
  realGDPGrowthRate: 0.032,
  populationGrowthRate: 0.018,
  economicTier: 'developed',
  populationTier: 'medium',
  economicVitality: 78,
  populationWellbeing: 82,
  diplomaticStanding: 65,
  governmentalEfficiency: 75,
  unemploymentRate: 5.2,
  infrastructureRating: 72,
  // ... other fields
};

// Mock historical data
const historicalData = {
  gdpHistory: [30000, 32000, 33500, 34200, 35000],
  populationHistory: [24000000, 24300000, 24600000, 24800000, 25000000],
  unemploymentHistory: [6.5, 6.1, 5.8, 5.5, 5.2]
};

// Generate intelligence report
const report = generateIntelligenceReport(
  mockCountry,
  historicalData,
  { gdpPerCapita: 38000, population: 30000000 }
);

console.log('Alerts:', report.alerts);
console.log('Trends:', report.trends);
console.log('Summary:', report.summary);
```

### Adding New Detection Rules

```typescript
// Add custom threshold rule
export function monitorCustomThreshold(
  country: Country,
  threshold: { metric: string; value: number; severity: AlertSeverity }
): IntelligenceAlert | null {
  const currentValue = country[threshold.metric];

  if (currentValue < threshold.value) {
    return {
      id: `threshold-custom-${threshold.metric}-${Date.now()}`,
      type: 'threshold',
      severity: threshold.severity,
      category: 'economic',
      title: `${threshold.metric} Below Threshold`,
      description: `${threshold.metric} is ${currentValue}, below threshold of ${threshold.value}`,
      confidence: 90,
      detected: Date.now(),
      factors: [threshold.metric, 'custom_threshold'],
      metrics: {
        current: currentValue,
        expected: threshold.value,
        deviation: ((currentValue - threshold.value) / threshold.value) * 100,
        zScore: (currentValue - threshold.value) / (threshold.value * 0.15)
      },
      recommendations: [
        `Review ${threshold.metric} policies`,
        'Analyze contributing factors',
        'Implement corrective measures'
      ]
    };
  }

  return null;
}
```

---

## Conclusion

The Intelligence System provides comprehensive analytics through 5 vitality metrics, advanced statistical algorithms, and actionable insights. The system processes country data every 30 seconds, generating alerts, insights, recommendations, and forecasts with confidence scoring.

For additional support, consult:
- **Intelligence Engine**: `/src/lib/intelligence-engine.ts`
- **Data Transformers**: `/src/app/mycountry/utils/liveDataTransformers.ts`
- **Intelligence Types**: `/src/app/mycountry/types/intelligence.ts`
- **Calculator**: `/src/lib/intelligence-calculator.ts`

**Version**: 1.1.0
**Last Updated**: October 2025
**Status**: Production-Ready (95% Feature Complete)
