# PRD-003: Focus Cards & Activity Rings Integration
*Apple Health-Inspired National Vitality System*

## 🎯 Objective

Create a sophisticated Focus Cards and Activity Rings system that serves as the central nervous system for both public and private MyCountry experiences, providing intuitive visual feedback on national health while enabling deep management capabilities for country owners.

## 🍎 Apple Health Design Philosophy

### Core Principles
- **Intuitive Understanding**: Complex national data simplified into universally understood health metaphors
- **Progressive Disclosure**: Surface-level rings expand into detailed management interfaces
- **Temporal Awareness**: Real-time updates synchronized with IxTime progression
- **Gamification**: Achievement-oriented design encouraging national improvement

## 🔄 Dual-Purpose System Architecture

### Public Experience (Portfolio View)
**Goal**: Instantly communicate national health to visitors
```typescript
interface PublicActivityRings {
  economicVitality: HealthRing;     // GDP growth, trade health
  populationWellbeing: HealthRing;  // Demographics, quality of life
  diplomaticStanding: HealthRing;   // International relationships
  governmentalEfficiency: HealthRing; // Policy effectiveness
}
```

### Private Experience (Executive Control)
**Goal**: Provide actionable management interface for country owners
```typescript
interface ExecutiveActivityRings {
  economicCommand: ManagementRing;     // Economic policy controls
  populationManagement: ManagementRing; // Social program oversight
  diplomaticOperations: ManagementRing; // Foreign relations management
  governmentalControl: ManagementRing;  // Internal policy management
}
```

## 🎨 Visual Design System

### Activity Ring Specifications

#### Ring Geometry
```scss
.activity-ring {
  --ring-diameter: 120px;
  --ring-stroke-width: 8px;
  --ring-gap: 4px;
  --animation-duration: 2s;
  
  /* Responsive sizing */
  @media (max-width: 768px) {
    --ring-diameter: 80px;
    --ring-stroke-width: 6px;
  }
  
  @media (min-width: 1200px) {
    --ring-diameter: 160px;
    --ring-stroke-width: 12px;
  }
}
```

#### Ring Color System
```scss
:root {
  /* National Health Ring Colors */
  --ring-economic: #059669;      /* Emerald-600 - Economic prosperity */
  --ring-population: #2563EB;    /* Blue-600 - Population health */
  --ring-diplomatic: #7C3AED;    /* Violet-600 - Diplomatic relations */
  --ring-governmental: #DC2626;  /* Red-600 - Government efficiency */
  
  /* Ring State Colors */
  --ring-excellent: #10B981;     /* Green - 80-100% */
  --ring-good: #F59E0B;          /* Amber - 60-79% */
  --ring-concerning: #F97316;    /* Orange - 40-59% */
  --ring-critical: #EF4444;      /* Red - 0-39% */
}
```

### Ring Calculation Algorithms

#### Economic Vitality Ring
```typescript
interface EconomicVitality {
  calculate(country: CountryStats): number {
    const gdpGrowthScore = normalizeGrowthRate(country.adjustedGdpGrowth) * 0.4;
    const economicTierScore = getEconomicTierScore(country.economicTier) * 0.3;
    const tradeHealthScore = calculateTradeHealth(country) * 0.2;
    const economicStabilityScore = calculateStability(country) * 0.1;
    
    return Math.round(
      gdpGrowthScore + 
      economicTierScore + 
      tradeHealthScore + 
      economicStabilityScore
    );
  };
  
  components: {
    gdpGrowth: WeightedComponent;     // 40% weight
    economicTier: WeightedComponent;  // 30% weight  
    tradeHealth: WeightedComponent;   // 20% weight
    stability: WeightedComponent;     // 10% weight
  };
}
```

#### Population Wellbeing Ring
```typescript
interface PopulationWellbeing {
  calculate(country: CountryStats): number {
    const growthHealthScore = normalizePopulationGrowth(country.populationGrowthRate) * 0.35;
    const populationTierScore = getPopulationTierScore(country.populationTier) * 0.25;
    const densityOptimizationScore = calculateDensityOptimization(country) * 0.20;
    const socialCohesionScore = calculateSocialCohesion(country) * 0.20;
    
    return Math.round(
      growthHealthScore + 
      populationTierScore + 
      densityOptimizationScore + 
      socialCohesionScore
    );
  };
}
```

#### Diplomatic Standing Ring
```typescript
interface DiplomaticStanding {
  calculate(country: CountryStats): number {
    const allianceStrengthScore = calculateAllianceStrength(country) * 0.3;
    const tradePartnershipScore = calculateTradePartnerships(country) * 0.25;
    const internationalReputationScore = calculateReputation(country) * 0.25;
    const conflictAvoidanceScore = calculateConflictAvoidance(country) * 0.2;
    
    return Math.round(
      allianceStrengthScore + 
      tradePartnershipScore + 
      internationalReputationScore + 
      conflictAvoidanceScore
    );
  };
}
```

#### Governmental Efficiency Ring
```typescript
interface GovernmentalEfficiency {
  calculate(country: CountryStats): number {
    const policyEffectivenessScore = calculatePolicyEffectiveness(country) * 0.4;
    const administrativeEfficiencyScore = calculateAdminEfficiency(country) * 0.25;
    const publicApprovalScore = calculatePublicApproval(country) * 0.2;
    const corruptionIndexScore = calculateCorruptionIndex(country) * 0.15;
    
    return Math.round(
      policyEffectivenessScore + 
      administrativeEfficiencyScore + 
      publicApprovalScore + 
      corruptionIndexScore
    );
  };
}
```

## 🎯 Focus Cards System

### Card Architecture
```typescript
interface FocusCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  healthRing: ActivityRing;
  metrics: FocusMetric[];
  actions: FocusAction[];
  trends: TrendData;
  alerts: Alert[];
  status: 'excellent' | 'good' | 'concerning' | 'critical';
  priority: 'high' | 'medium' | 'low';
}

interface FocusMetric {
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'stable';
  change: string;
  target?: number;
  format: 'number' | 'percentage' | 'currency' | 'text';
}

interface FocusAction {
  id: string;
  label: string;
  type: 'policy' | 'budget' | 'diplomatic' | 'emergency';
  enabled: boolean;
  requiresConfirmation: boolean;
  estimatedImpact: ImpactEstimate;
}
```

### Focus Card Categories

#### 💰 Economic Focus Card
```typescript
const economicFocusCard: FocusCard = {
  id: 'economic-management',
  title: 'Economic Command Center',
  description: 'Monitor and manage your nation\'s economic health and growth',
  icon: TrendingUp,
  healthRing: {
    value: calculateEconomicVitality(country),
    max: 100,
    color: '--ring-economic',
    strokeWidth: 12
  },
  metrics: [
    {
      label: 'GDP per Capita',
      value: formatCurrency(country.currentGdpPerCapita),
      trend: getGdpTrend(country),
      change: calculateGdpChange(country),
      format: 'currency'
    },
    {
      label: 'Economic Tier',
      value: country.economicTier,
      trend: getTierTrend(country),
      change: 'Next milestone in 2.3 years',
      format: 'text'
    },
    {
      label: 'Growth Rate',
      value: (country.adjustedGdpGrowth * 100).toFixed(2),
      trend: 'up',
      change: '+0.3% this quarter',
      format: 'percentage'
    }
  ],
  actions: [
    {
      id: 'adjust-tax-policy',
      label: 'Adjust Tax Policy',
      type: 'policy',
      enabled: true,
      requiresConfirmation: false,
      estimatedImpact: { economic: '+2%', timeframe: '6 months' }
    },
    {
      id: 'infrastructure-investment',
      label: 'Infrastructure Investment',
      type: 'budget',
      enabled: true,
      requiresConfirmation: true,
      estimatedImpact: { economic: '+5%', timeframe: '2 years' }
    }
  ]
};
```

#### 👥 Population Focus Card
```typescript
const populationFocusCard: FocusCard = {
  id: 'population-management',
  title: 'Population & Demographics',
  description: 'Oversee population health, growth, and social wellbeing',
  icon: Users,
  healthRing: {
    value: calculatePopulationWellbeing(country),
    max: 100,
    color: '--ring-population',
    strokeWidth: 12
  },
  metrics: [
    {
      label: 'Population',
      value: formatPopulation(country.currentPopulation),
      trend: getPopulationTrend(country),
      change: calculatePopulationChange(country),
      format: 'number'
    },
    {
      label: 'Growth Rate',
      value: (country.populationGrowthRate * 100).toFixed(2),
      trend: 'stable',
      change: 'Optimal range',
      format: 'percentage'
    }
  ]
};
```

#### 🤝 Diplomatic Focus Card
```typescript
const diplomaticFocusCard: FocusCard = {
  id: 'diplomatic-relations',
  title: 'Diplomatic Relations',
  description: 'Manage international relationships and foreign affairs',
  icon: Globe,
  healthRing: {
    value: calculateDiplomaticStanding(country),
    max: 100,
    color: '--ring-diplomatic',
    strokeWidth: 12
  }
};
```

#### 🏛️ Government Focus Card
```typescript
const governmentFocusCard: FocusCard = {
  id: 'government-operations',
  title: 'Government Operations',
  description: 'Oversee internal governance and policy effectiveness',
  icon: Building2,
  healthRing: {
    value: calculateGovernmentalEfficiency(country),
    max: 100,
    color: '--ring-governmental',
    strokeWidth: 12
  }
};
```

## 🔗 Interactive Behaviors

### Public View Interactions
```typescript
interface PublicInteractions {
  onRingHover: (ringId: string) => {
    showTooltip({
      title: getRingTitle(ringId),
      value: getRingValue(ringId),
      description: getRingDescription(ringId),
      trend: getRingTrend(ringId)
    });
  };
  
  onRingClick: (ringId: string) => {
    if (isOwner) {
      navigateToExecutiveFocus(ringId);
    } else {
      showDetailedPublicView(ringId);
    }
  };
  
  onCardHover: (cardId: string) => {
    highlightRelatedRings(cardId);
    showPreviewMetrics(cardId);
  };
}
```

### Executive View Interactions
```typescript
interface ExecutiveInteractions {
  onRingClick: (ringId: string) => {
    expandToManagementInterface(ringId);
  };
  
  onActionClick: (actionId: string) => {
    if (requiresConfirmation(actionId)) {
      showConfirmationModal(actionId);
    } else {
      executeAction(actionId);
    }
  };
  
  onMetricClick: (metricId: string) => {
    showHistoricalTrends(metricId);
  };
  
  onCardExpand: (cardId: string) => {
    showFullManagementInterface(cardId);
  };
}
```

## 📱 Responsive Design Strategy

### Ring Layout Adaptation
```scss
/* Desktop Layout (4 rings in 2x2 grid) */
.rings-container-desktop {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2rem;
  padding: 2rem;
}

/* Tablet Layout (4 rings in line) */
.rings-container-tablet {
  display: flex;
  justify-content: space-between;
  padding: 1.5rem;
  overflow-x: auto;
}

/* Mobile Layout (4 rings stacked) */
.rings-container-mobile {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}
```

### Focus Card Responsive Behavior
```scss
/* Desktop: Side-by-side cards */
.focus-cards-desktop {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

/* Tablet: Stacked cards with horizontal scroll */
.focus-cards-tablet {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

/* Mobile: Full-width stacked cards */
.focus-cards-mobile {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
```

## 🎬 Animation & Micro-interactions

### Ring Animations
```scss
@keyframes ring-fill {
  from {
    stroke-dasharray: 0 251.2; /* 2π * 40px radius */
  }
  to {
    stroke-dasharray: var(--fill-percentage) 251.2;
  }
}

@keyframes pulse-glow {
  0%, 100% {
    filter: drop-shadow(0 0 8px var(--ring-color));
  }
  50% {
    filter: drop-shadow(0 0 16px var(--ring-color));
  }
}

.activity-ring {
  animation: ring-fill 2s ease-out;
}

.activity-ring.critical {
  animation: ring-fill 2s ease-out, pulse-glow 2s infinite;
}
```

### Card Micro-interactions
```scss
.focus-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.focus-card:hover {
  transform: translateY(-4px);
  box-shadow: 
    0 12px 48px rgba(0, 0, 0, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.1);
}

.focus-card.selected {
  border: 2px solid var(--mycountry-gold);
  box-shadow: 
    0 0 24px rgba(252, 211, 77, 0.3),
    0 8px 32px rgba(0, 0, 0, 0.15);
}
```

## 🚀 Implementation Timeline

### Week 1: Ring System Foundation
- [ ] Activity ring SVG component with customizable colors and values
- [ ] Ring calculation algorithms for all four health categories
- [ ] Basic ring animations and hover states
- [ ] Responsive ring layout system

### Week 2: Focus Cards Integration
- [ ] Focus card component architecture
- [ ] Card data integration with country statistics
- [ ] Interactive behaviors for public and private views
- [ ] Card expansion and management interfaces

### Week 3: Advanced Interactions
- [ ] Executive action system implementation
- [ ] Real-time data updates with IxTime synchronization
- [ ] Historical trend overlays and detailed analytics
- [ ] Achievement system integration

### Week 4: Polish & Optimization
- [ ] Performance optimization for smooth animations
- [ ] Accessibility improvements (screen readers, keyboard navigation)
- [ ] Cross-browser compatibility testing
- [ ] Mobile experience refinement

## ✅ Success Criteria

### Visual Excellence
- [ ] Rings display with smooth 60fps animations
- [ ] Color system consistently applied across all states
- [ ] Responsive design works flawlessly on all screen sizes
- [ ] Glass refraction effects enhance visual appeal

### Functional Requirements
- [ ] Real-time ring values update with country data changes
- [ ] Focus cards provide actionable management interfaces
- [ ] Executive actions integrate with existing systems
- [ ] Performance metrics show measurable improvement

### User Experience
- [ ] Intuitive understanding of national health at a glance
- [ ] Smooth transitions between public and private views
- [ ] Progressive disclosure reveals appropriate detail levels
- [ ] Gamification elements encourage engagement

---

*The Focus Cards & Activity Rings system serves as the heartbeat of the MyCountry experience, transforming complex national data into an intuitive, beautiful, and actionable interface that works seamlessly across both public showcase and private management contexts.*