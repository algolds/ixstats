# IxStats Atomic Components & Formulas Documentation

> **📚 Note**: This document provides detailed technical specifications for atomic components and formulas. For a comprehensive overview of all IxStats systems, see [SYSTEMS_GUIDE.md](../SYSTEMS_GUIDE.md)

## Table of Contents
1. [Atomic Components Overview](#atomic-components-overview)
2. [UI Atomic Components](#ui-atomic-components)
3. [Government Atomic Components](#government-atomic-components)
4. [Economic Atomic Components](#economic-atomic-components)
5. [Core Formulas](#core-formulas)
6. [Integration Guidelines](#integration-guidelines)

---

## Atomic Components Overview

IxStats uses an atomic design system where complex interfaces are built from smaller, reusable components. This ensures consistency, maintainability, and scalability across the platform.

### Component Hierarchy
```
Atoms → Molecules → Organisms → Templates → Pages

- Atoms: Basic UI elements (buttons, inputs, badges)
- Molecules: Simple groups of atoms (form fields, cards)
- Organisms: Complex components (dashboards, panels)
- Templates: Page layouts
- Pages: Complete views
```

---

## UI Atomic Components

### Core Atomic UI Components

#### 1. **AtomicMetric**
- **Purpose**: Display key metrics with trends and status
- **Props**: label, value, unit, trend, status, icon
- **Usage**: KPIs, statistics, performance indicators
```tsx
<AtomicMetric
  label="GDP Growth"
  value={3.5}
  unit="%"
  trend="up"
  status="success"
/>
```

#### 2. **AtomicProgress**
- **Purpose**: Visual progress indicators
- **Props**: label, value, max, color, size
- **Formula**: `percentage = (value / max) * 100`
```tsx
<AtomicProgress
  label="Capacity"
  value={75}
  max={100}
  color="blue"
/>
```

#### 3. **AtomicGauge**
- **Purpose**: Circular gauge visualization
- **Props**: value, max, thresholds, label
- **Visual**: SVG-based circular progress
- **Formula**: `rotation = (percentage / 100) * 180 - 90`

#### 4. **AtomicStatus**
- **Purpose**: Status indicators with optional pulse
- **States**: active, inactive, pending, error, success
- **Visual**: Colored dot with optional animation

#### 5. **AtomicEffectiveness**
- **Purpose**: Comprehensive effectiveness display
- **Props**: value, factors, showDetails
- **Levels**:
  - Excellent: ≥90%
  - Good: ≥75%
  - Moderate: ≥60%
  - Poor: ≥40%
  - Critical: <40%

#### 6. **AtomicComponentCard**
- **Purpose**: Display component information with actions
- **Features**: Effectiveness, cost, synergies, conflicts
- **Actions**: Activate/deactivate, configure

#### 7. **AtomicSynergy**
- **Purpose**: Visualize component relationships
- **Levels**: high, medium, low, conflict
- **Visual**: Connected component badges

---

## Government Atomic Components

### Component Types

#### Power Distribution Components
1. **CENTRALIZED_POWER**
   - Effectiveness: 85%
   - Cost: ₡50,000/mo
   - Synergies: Autocratic Process, Professional Bureaucracy
   - Conflicts: Federal System, Consensus Process

2. **FEDERAL_SYSTEM**
   - Effectiveness: 75%
   - Cost: ₡75,000/mo
   - Synergies: Democratic Process, Rule of Law
   - Conflicts: Centralized Power, Autocratic Process

3. **CONFEDERATE_SYSTEM**
   - Effectiveness: 65%
   - Cost: ₡60,000/mo
   - Synergies: Consensus Process, Traditional Legitimacy
   - Conflicts: Centralized Power, Military Administration

4. **UNITARY_SYSTEM**
   - Effectiveness: 80%
   - Cost: ₡45,000/mo
   - Synergies: Professional Bureaucracy, Rule of Law
   - Conflicts: Confederate System

#### Decision Process Components
1. **DEMOCRATIC_PROCESS**
   - Effectiveness: 70%
   - Legitimacy Bonus: +15
   - Synergies: Electoral Legitimacy, Independent Judiciary
   - Conflicts: Autocratic Process, Military Enforcement

2. **AUTOCRATIC_PROCESS**
   - Effectiveness: 90%
   - Speed Bonus: +25
   - Synergies: Centralized Power, Surveillance System
   - Conflicts: Democratic Process, Consensus Process

3. **TECHNOCRATIC_PROCESS**
   - Effectiveness: 85%
   - Innovation Bonus: +20
   - Synergies: Professional Bureaucracy, Performance Legitimacy
   - Conflicts: Traditional Legitimacy, Charismatic Legitimacy

4. **CONSENSUS_PROCESS**
   - Effectiveness: 60%
   - Stability Bonus: +30
   - Synergies: Confederate System, Social Pressure
   - Conflicts: Autocratic Process, Military Enforcement

#### Legitimacy Sources
1. **ELECTORAL_LEGITIMACY**
   - Stability: +20
   - International Relations: +15
   - Requirements: Democratic Process

2. **TRADITIONAL_LEGITIMACY**
   - Stability: +25
   - Cultural Unity: +20
   - Requirements: Historical continuity

3. **PERFORMANCE_LEGITIMACY**
   - Economic Bonus: +15
   - Requires: >70% effectiveness

4. **CHARISMATIC_LEGITIMACY**
   - Mobilization: +30
   - Volatility: +20
   - Duration: Limited

---

## Economic Atomic Components

### Economic Indicators

#### 1. **AtomicEconomicIndicators**
- GDP Growth Rate
- Inflation Rate
- Unemployment Rate
- Trade Balance
- Currency Stability

#### 2. **AtomicTaxSystem**
- Tax Components:
  - Income Tax
  - Corporate Tax
  - Sales/VAT
  - Property Tax
  - Capital Gains
  - Import/Export Duties

#### 3. **AtomicBudgetAllocator**
- Categories:
  - Defense
  - Education
  - Healthcare
  - Infrastructure
  - Social Services
  - Research & Development

---

## Core Formulas

### Government Effectiveness Formula
```javascript
Government_Effectiveness = Base_Score + Σ(Component_Scores * Weights) + Synergy_Bonus - Conflict_Penalty

Where:
- Base_Score = 50
- Component_Score = Component_Effectiveness * 0.2
- Synergy_Bonus = 5 * Number_of_Synergies
- Conflict_Penalty = 8 * Number_of_Conflicts
```

### Economic Vitality Formula
```javascript
Economic_Vitality = (GDP_Growth_Weight * GDP_Growth_Score +
                     Employment_Weight * Employment_Score +
                     Trade_Weight * Trade_Balance_Score +
                     Innovation_Weight * Innovation_Score) / 100

Weights:
- GDP_Growth: 30%
- Employment: 25%
- Trade_Balance: 20%
- Innovation: 25%
```

### Population Wellbeing Formula
```javascript
Population_Wellbeing = (Healthcare_Access * 0.25 +
                       Education_Quality * 0.25 +
                       Income_Equality * 0.20 +
                       Life_Satisfaction * 0.30)

Where each factor is scored 0-100
```

### Diplomatic Standing Formula
```javascript
Diplomatic_Standing = Base_Reputation +
                     Treaty_Score * 0.15 +
                     Trade_Relations * 0.20 +
                     International_Aid * 0.10 +
                     Conflict_Resolution * 0.15 +
                     Cultural_Influence * 0.10

Base_Reputation = 50
Treaty_Score = Active_Treaties * 2 (max: 30)
Trade_Relations = Trade_Partners * 1.5 (max: 30)
```

### Tax Effectiveness Formula
```javascript
Tax_Effectiveness = Collection_Efficiency * (1 - Evasion_Rate) * Compliance_Factor

Where:
- Collection_Efficiency = Base_Efficiency * Technology_Multiplier
- Evasion_Rate = Base_Evasion * (1 - Enforcement_Level)
- Compliance_Factor = 0.5 + (Trust_in_Government * 0.5)
```

### Budget Balance Formula
```javascript
Budget_Balance = Total_Revenue - Total_Expenditure

Revenue = Tax_Revenue + Non_Tax_Revenue + Grants
Expenditure = Current_Expenditure + Capital_Expenditure + Debt_Service

Deficit_Ratio = Budget_Balance / GDP * 100
```

### Innovation Score Formula
```javascript
Innovation_Score = (R&D_Spending / GDP) * 20 +
                  Patent_Applications * 0.001 +
                  Tech_Exports / Total_Exports * 30 +
                  Education_Index * 20 +
                  Digital_Infrastructure * 15

Capped at 100
```

### Economic Performance Score (for Rankings)
```javascript
Performance_Score = (GDP_Score * 0.4) + (Growth_Score * 0.35) + (Tier_Score * 0.25)

Where:
- GDP_Score = min(100, (GDP_per_capita / 100000) * 100)
- Growth_Score = min(100, max(0, ((Growth_Rate + 10) / 20) * 100))
- Tier_Score = ((11 - Economic_Tier) / 10) * 100
```

### Regional Economic Deviation
```javascript
Regional_Deviation = ((Regional_GDP_per_capita - National_GDP_per_capita) / National_GDP_per_capita) * 100

Regional_GDP_per_capita = National_GDP_per_capita * Urbanization_Factor * Employment_Factor

Where:
- Urbanization_Factor = Regional_Urbanization / National_Urbanization
- Employment_Factor = Regional_Employment / National_Employment
```

### IxTime Conversion
```javascript
// IxTime runs at 2x speed
IxTime_Days = Real_Days * 2
IxTime_Epoch_Start = January 1, 2020 (Real Time)
Current_IxTime = Base_Time + (Current_Real_Time - Base_Time) * 2
```

---

## Integration Guidelines

### Component Composition Pattern
```tsx
// Atomic components should be composable
<Card className="glass-hierarchy-parent">
  <CardHeader>
    <AtomicMetric {...metricProps} />
  </CardHeader>
  <CardContent>
    <AtomicProgress {...progressProps} />
    <AtomicEffectiveness {...effectivenessProps} />
  </CardContent>
</Card>
```

### State Management
```tsx
// Use unified atomic state
import { useAtomicState } from '~/lib/unified-atomic-state';

const { state, updateComponent, calculateEffectiveness } = useAtomicState();
```

### Glass Hierarchy System
```scss
.glass-hierarchy-parent    // Top level container
.glass-hierarchy-child     // Nested components
.glass-hierarchy-interactive // Interactive elements
.glass-hierarchy-modal     // Modal overlays
```

### Performance Optimization
1. Use `React.memo` for pure components
2. Implement `useMemo` for expensive calculations
3. Use `useCallback` for event handlers
4. Virtualize long lists
5. Lazy load heavy components

### Accessibility Requirements
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Focus indicators
- Color contrast ratios

---

## Component Lifecycle

### Initialization
1. Load component configuration
2. Calculate initial state
3. Check synergies/conflicts
4. Apply modifiers

### Update Cycle
1. Receive state change
2. Validate constraints
3. Calculate new effectiveness
4. Update dependent components
5. Trigger side effects

### Cleanup
1. Save component state
2. Remove event listeners
3. Clear timers/intervals
4. Dispose of resources

---

## Testing Checklist

### Unit Tests
- [ ] Component renders correctly
- [ ] Props validation
- [ ] State updates
- [ ] Event handlers
- [ ] Formula calculations

### Integration Tests
- [ ] Component interactions
- [ ] API data flow
- [ ] State synchronization
- [ ] Performance metrics
- [ ] Error handling

### Visual Tests
- [ ] Responsive design
- [ ] Theme compatibility
- [ ] Animation smoothness
- [ ] Glass effects
- [ ] Accessibility

---

## Best Practices

1. **Naming Convention**: Use descriptive, prefixed names (Atomic*)
2. **Props Interface**: Define TypeScript interfaces for all props
3. **Default Values**: Provide sensible defaults
4. **Error Boundaries**: Implement error handling
5. **Documentation**: Include JSDoc comments
6. **Performance**: Monitor render counts and optimize
7. **Testing**: Achieve >80% test coverage
8. **Accessibility**: Test with screen readers
9. **Responsive**: Test on multiple screen sizes
10. **Version Control**: Use semantic versioning

---

## Future Enhancements

### Planned Components
- AtomicDiplomaticNetwork
- AtomicMilitaryCapacity
- AtomicTradeFlows
- AtomicClimateImpact
- AtomicSocialCohesion

### Formula Improvements
- Machine learning optimization
- Real-time calibration
- Historical pattern analysis
- Predictive adjustments
- Multi-factor correlations

### Integration Features
- Component marketplace
- Custom component builder
- Formula editor
- Visual synergy mapper
- Performance profiler

---

*Last Updated: November 2025*
*Version: 1.0.0*