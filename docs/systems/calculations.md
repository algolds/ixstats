# 🏛️ Statecraft Economic & Statistical Calculus

**Last updated:** 2026-10-05

**Parent Engine:** Statecraft Simulation Engine (`MYCOUNTRY_ENGINE_VERSION = 4`)  
**Parent App Suite:** MyCountry Suite (`MYCOUNTRY_VERSION = 6`)  
**Scope:** Mathematical formulas, worked examples, and deterministic rules for growth caps, tax brackets, and vitality indices.  
**Status:** ✅ Live formulas plus reference models; see [SYSTEM_STATUS.md](SYSTEM_STATUS.md)  

This document provides mathematical formulas, worked examples, and architectural rules for all economic models, tier-based growth caps, synergy calculations, and statistical indices in IxStates.

> **Live engine vs. reference formulas:** The tier-based growth engine, population compounding, government synergy scoring, and vitality scores below are what the running code computes. The **ERI**, **PII**, **Embassy Synergy Match**, and **Multi-Factor GDP Projection** formulas are reference models: ERI, embassy synergy, and GDP projection are shown in the admin Calculation Lab (`src/app/admin/calculations/system-formulas.ts`), and PII exists only in this document. The simulation does not compute any of the four.

---

## Table of Contents
1. [Active Game Engine vs Sandbox Modeling Math](#active-game-engine-vs-sandbox-modeling-math)
2. [Tier-Based Growth Engine](#tier-based-growth-engine)
3. [Economic Resilience Index (ERI)](#economic-resilience-index-eri)
4. [Productivity & Innovation Index (PII)](#productivity--innovation-index-pii)
5. [Synergy Calculations](#synergy-calculations)
6. [Population Dynamics](#population-dynamics)
7. [GDP Projections](#gdp-projections)
8. [Vitality Composite Scores](#vitality-composite-scores)
9. [Tax Revenue Calculations](#tax-revenue-calculations)

---

## Active Game Engine vs Sandbox Modeling Math

Developers must adhere to the standard representation difference between engine layers:

| Dimension | Active Game Engine (`src/lib/economy/calculations.ts`) | Sandbox Modeling Engine (`src/lib/economy/modeling-engine.ts`) |
| :--- | :--- | :--- |
| **Rate Representation** | **Decimals** (`3.5%` $\to$ `0.035`) | **Percentages** (`3.5%` $\to$ `3.5`) |
| **Compounding** | Exact decimal math: `Math.pow(1 + rate, years)` | Percentage division: `currentGDP *= 1 + rate / 100` |
| **Input Bounds** | Clamped between `-0.50` and `+0.50` (-50% to +50%) | Validated between `-20.0` and `+20.0` (-20% to +20%) |
| **Usage Context** | Core tick simulation, Storyteller effects, cron jobs | `/countries/[slug]/modeling` what-if scenarios (`useEconomicModel`) |

---

## Tier-Based Growth Engine

The core growth system divides nations into 7 economic tiers to enforce realistic growth rate ceilings based on development level.

### Formula
```
effectiveGrowthRate = min(
  max(
    (baseGrowth * globalGrowthFactor * localGrowthFactor * tierModifier + gdpAdjustments) * growthModifiers,
    minGrowthFloor
  ),
  tierMaxRate
)
```

### Economic Tiers & Growth Caps

| Tier | Classification | GDP per Capita Range | Max Growth Rate Cap |
| :--- | :--- | :--- | :--- |
| **Impoverished** | Emerging / low income | $0 – $9,999 | 10.0% (`0.10`) |
| **Developing** | Low-middle income | $10,000 – $24,999 | 7.5% (`0.075`) |
| **Developed** | Middle income | $25,000 – $34,999 | 5.0% (`0.050`) |
| **Healthy** | High-middle income | $35,000 – $44,999 | 3.5% (`0.035`) |
| **Strong** | High income | $45,000 – $54,999 | 2.75% (`0.0275`) |
| **Very Strong** | Very high income | $55,000 – $64,999 | 1.5% (`0.015`) |
| **Extravagant** | Ultra high income | $65,000+ | 0.5% (`0.005`) |

The cap follows the tier GDP per capita is in: a forward projection compounds piecewise, and each time GDP per capita crosses a tier threshold the rest of the span grows at the new tier's (capped) rate.

The growth floor defaults to `-0.10` (`minGrowthFloor`). Legacy Storyteller `GDP_ADJUSTMENT` effects add to the rate and `GROWTH_RATE_MODIFIER` effects multiply it, before the tier cap is applied. They change the rate for the whole span from `baselineDate` to the target time, so they reshape the projected path before their own start; nothing writes them any more (the 2026-10 MyCountry SQL converted the old rows to level effects).

### Level effects

Every StorytellerEffect is written through `src/lib/economy/storyteller-effects.ts`: it stamps IxTime (a pre-epoch, wall-clock start is refused) and accepts only types an engine reads. Level effects are never edited or deactivated, because that would rewrite the projected past: `syncLevelEffects` moves a keyed level (`createdBy`) by appending a delta row from now on, and `endStorytellerEffects` appends the row that unwinds it over its duration.

Effect types are matched case-insensitively. `GDP_LEVEL_ADJUSTMENT` (`gdp_level_adjustment`), `TRADE_AGREEMENT` (`trade_agreement`) and `POPULATION_LEVEL_ADJUSTMENT` (`population_level_adjustment`) scale GDP per capita or population by `1 + value × phaseIn` after the growth calculation, bypassing the tier cap. `phaseIn` (`levelPhaseIn`) is 0 before the effect's `ixTimeTimestamp`, rises linearly over `duration` IxTime years, and stays 1 afterwards; an effect with no duration applies at once. They never alter the path before they start, and the shift is kept after the duration ends.

National-issue resolution (`src/lib/national-issues/projection-effects.ts`) creates them instead of writing fields the projection overwrites:

| Consequence | Effect | Value |
| :--- | :--- | :--- |
| `actualGdpGrowth` add / subtract X (percentage points) | `gdp_level_adjustment`, duration 1 IxTime year (or `durationDays` rounded to whole years) | `(1 ± X/100)^years − 1`, capped at ±3% |
| `currentTotalGdp` / `currentGdpPerCapita` multiply m | `gdp_level_adjustment`, no duration | `m − 1`, capped at ±3% |
| `currentPopulation` multiply m | `population_level_adjustment`, no duration | `m − 1`, capped at ±1% |

Growth directives (`routers/intent/directives.ts`) also create a `gdp_level_adjustment`, phased in over 1 IxTime year: `growthModifierToLevelShift(m, 1)` = `(1 + g(1+m)) / (1+g) − 1` at the reference growth `g = 3%` (`REFERENCE_GDP_GROWTH`), where `m` is the package's growth modifier (capped at 0.05).

Any other operation on those fields (`set`, an absolute add to GDP) is dropped: it is not applied, not listed in the issue's consequence log, and not shown in the recon preview.

The other producers:

| Producer | Effect | Value, phase-in |
| :--- | :--- | :--- |
| Active policy (`policies/effects-sync.ts`, `POLICY:<id>`) | `gdp_level_adjustment` | `gdpEffect / 100` (+2 = +2%, capped at ±5%), 1 year; unwound when the policy ends |
| Foreign-policy action (`fp:<id>`) | `trade_agreement` (free trade) or `gdp_level_adjustment` | the action's GDP impact, 4 years |
| Resolved conflict | `gdp_level_adjustment` | −`economicDamage` × 1.5 (loser) or × 0.5 (winner), 2 years |
| Military operation (`operation:<id>`) | `gdp_level_adjustment` | −annual cost / GDP, over the operation's years; unwound when it ends |
| Election result | `gdp_level_adjustment` | +0.3% decisive, +0.1% clear, −0.3% close, over the term |
| Government components and the Magnates broker (`component:<category>`, `broker:<id>`, via politics-drift) | `gdp_level_adjustment` | 0.15% to 0.4% per component (scaled by effectiveness), +0.5% Magnates, 5 years |
| Admin world event | `gdp_level_adjustment` + `population_level_adjustment` | up to −20% / −2% (negative types) or +15% / +1% at severity 1, over the event's duration |

`NATURAL_DISASTER` scales population by `1 + v` and total GDP by `1 + 1.5v` at once; `SPECIAL_EVENT` scales population by `1 + 0.5v` and GDP per capita by `1 + 0.8v`.

### High GDP per Capita Diminishing Returns
For nations whose baseline GDP per capita exceeds `$60,000` (`diminishingReturnsThreshold`), a logarithmic diminishing return modifier (factor `0.5`, `diminishingReturnsFactor`) dampens growth after the tier cap:
$$\text{diminishingFactor} = \log_2\left(\frac{\text{gdpPerCapita}}{60000} + 1\right)$$
$$\text{effectiveGrowthRate} = \frac{\text{effectiveGrowthRate}}{1 + \text{diminishingFactor} \times 0.5}$$

---

## Economic Resilience Index (ERI)

*Reference formula (admin Calculation Lab) — not computed by the live engine.* Measures a nation's ability to withstand shocks on a 0–100 scale:

$$\text{ERI} = (\text{FiscalStability} \times 0.30) + (\text{MonetaryStability} \times 0.25) + (\text{StructuralBalance} \times 0.25) + (\text{SocialCohesion} \times 0.20)$$

### 1. Fiscal Stability (30% weight)
$$\text{fiscalStability} = \text{clamp}(100 - (\text{debtToGDP} \times 0.5) - (\text{deficitGDP} \times 2.0), 0, 100)$$

### 2. Monetary Stability (25% weight)
$$\text{monetaryStability} = \text{clamp}(100 - (\text{inflation} \times 10.0) - (\text{currencyVolatility} \times 5.0), 0, 100)$$

### 3. Structural Balance (25% weight)
$$\text{structuralBalance} = \text{clamp}(50 + ((1 - \text{concentrationIndex}) \times 30) - ((\text{exports} / \text{GDP}) \times 20), 0, 100)$$

### 4. Social Cohesion (20% weight)
$$\text{socialCohesion} = \text{clamp}(100 - (\text{gini} \times 150) - (\text{unemployment} \times 2.0), 0, 100)$$

---

## Productivity & Innovation Index (PII)

*Design-only formula — not implemented in code.* Measures efficiency and technical advancement (0–100):

$$\text{PII} = (\text{LaborProductivity} \times 0.35) + (\text{CapitalEfficiency} \times 0.25) + (\text{TechAdaptation} \times 0.25) + (\text{Entrepreneurship} \times 0.15)$$

- **Labor Productivity**: $\text{clamp}\left(\frac{\text{GDP} / \text{HoursWorked}}{\text{IndustryAverage}} \times 100, 0, 100\right)$
- **Capital Efficiency**: $(\text{GDP} / \text{CapitalStock}) \times 60 + \text{ROI} \times 40$
- **Tech Adaptation**: $\text{clamp}((\text{R\&D} / \text{GDP} \times 100) + (\text{patentsPer1M} \times 0.5) + (\text{digitalAdoption} \times 0.3), 0, 100)$
- **Entrepreneurship**: $\text{clamp}((\text{newBusinesses} / \text{pop} \times 1000) \times 10 + (100 - \text{regulatoryBurden}) \times 0.5, 0, 100)$

---

## Synergy Calculations

### Government Component Synergy (live)
Within one government, `governmentEffectiveness` (`src/lib/government/effectiveness.ts`) averages component effectiveness, adds **+10** per additive pair and subtracts **15** per conflicting pair from the shared table (`src/lib/government/synergy-table.ts`), then clamps to 0–100. Founding, the editor's preview and the server save all use it. The 106 additive and 48 conflicting pairs are listed in the [Synergy Reference](../reference/synergies.md).

### Embassy Synergy Match (reference)
*Admin Calculation Lab formula — not wired into the embassy routers.* Synergies would activate when nations share atomic government or economic components.
1. **Component Match Rate**:
   $$\text{matchScore} = \frac{|\text{Components}_A \cap \text{Components}_B|}{|\text{Components}_{\text{total}}|} \times 100$$
2. **Effectiveness Average**:
   $$\text{avgEffectiveness} = \frac{\text{eff}_A + \text{eff}_B}{2}$$
3. **Bilateral Bonuses**:
   - **Economic**: $2.0\% \times (\text{matchScore}/100) \times \text{avgEffectiveness}$
   - **Diplomatic**: $3.0\% \times (\text{matchScore}/100) \times \text{avgEffectiveness}$
   - **Cultural**: $1.5\% \times (\text{matchScore}/100) \times \text{avgEffectiveness}$

---

## Population Dynamics

Population compounding uses IxTime years ($1\text{ real year} = 2\text{ IxTime years}$):
$$\text{newPopulation} = \text{currentPopulation} \times (1 + \text{growthRate})^{\text{years}_{\text{IxTime}}}$$

---

## GDP Projections

*Reference formula (admin Calculation Lab).*

$$\text{projectedGDP} = \text{currentGDP} \times (1 + \text{growthRate})^t \times \prod(1 + \text{policyEffects}) \times (1 + \text{synergyBonus}) \times (1 + \text{tradeBonus})$$

---

## Vitality Composite Scores

Four 0–100 scores computed server-side by `calculateVitalityScores` in `src/server/shared/mycountry-helpers.ts` (same formulas as `countries.getActivityRingsData`):

1. **Economic Vitality**: $\text{clamp}(0.7 \times \min(100, \tfrac{\text{GDPpc}}{50000} \times 100) + \text{clamp}(\text{adjustedGdpGrowth} \times 400, -20, 20) + 30,\ 0, 100)$
2. **Population Wellbeing**: $\big(\text{growthHealth} + \text{densityFactor}\big) / 2$, where growthHealth is 70 if population growth > 0 else 40, and densityFactor is $\max(50, 100 - \text{density}/500)$ (60 when density is unknown)
3. **Diplomatic Standing**: $\text{clamp}(\text{influence} + \text{tradeStrength} + \text{allianceStrength} - \text{tensions},\ 40, 100)$ (defaults 50 / 10 / 15 / 5)
4. **Governmental Efficiency**: $0.8 \times \text{tierScore}$, with tierScore Extravagant 95, Very Strong 85, Strong 75, Healthy 65, Developed 50, Developing 35, Impoverished 25

$$\text{Overall Vitality} = \frac{\text{Economic} + \text{Wellbeing} + \text{Diplomatic} + \text{Efficiency}}{4}$$

---

## Tax Revenue Calculations

### Progressive Income Tax Bracket Integration
$$\text{Total Tax} = \sum_{i=1}^{n} \max\left(0, \min(\text{Income}, \text{BracketMax}_i) - \text{BracketMin}_i\right) \times \text{Rate}_i$$

---

## Code Locations
- `src/lib/economy/calculations.ts` – Base `IxStatsCalculator` class (tiers, growth caps, population)
- `src/lib/economy/modeling-engine.ts` – Sandbox what-if modeling engine
- `src/lib/government/synergy-table.ts` and `src/lib/government/effectiveness.ts` – Government component synergy/conflict pairs and the effectiveness formula
- `src/lib/government/tax/atomic-tax-components.ts` – Atomic tax components, synergies and revenue effects (`atomic-tax-integration.ts` was deleted)
- `src/app/admin/calculations/system-formulas.ts` – Reference formulas shown in the admin Calculation Lab (ERI, embassy synergy, projections)
- `src/server/shared/mycountry-helpers.ts` – Server-side vitality calculations
