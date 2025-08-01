# PRD-001: MyCountry Public Page Redesign
*Professional Portfolio for National Achievement Showcase*

## 🎯 Objective

Transform the public-facing MyCountry page into a sophisticated national portfolio that showcases a country's achievements, statistics, and international standing using our established glass refraction system, activity rings, and bento box layouts.

## 🔍 Current State vs. Target State

### Current Implementation
```typescript
// Basic tabbed interface with limited visual hierarchy
<Tabs defaultValue="overview">
  <TabsList>Overview | Economy | Demographics | Government</TabsList>
  <TabsContent>Basic content display</TabsContent>
</Tabs>
```

### Target Implementation
```typescript
// Executive portfolio with glass hierarchy and country theming
<CountryPortfolio country={countryData}>
  <NationalHeader />           // Flag, name, tier, key stats
  <VitalityDashboard />        // Activity rings + health metrics
  <AchievementShowcase />      // Timeline, milestones, rankings
  <StatisticalOverview />      // Bento grid with metric cards
  <InternationalStanding />    // Diplomatic relations, trade
</CountryPortfolio>
```

## 🎨 Design Specifications

### Visual Hierarchy Implementation

#### 1. National Header (Glass Parent Level)
```scss
.national-header {
  @apply glass-hierarchy-parent glass-mycountry;
  backdrop-filter: blur(24px) saturate(180%);
  background: linear-gradient(135deg, 
    color-mix(in srgb, var(--country-primary) 20%, rgba(252, 211, 77, 0.95)) 0%,
    color-mix(in srgb, var(--country-primary) 10%, rgba(251, 191, 36, 0.85)) 100%
  );
}
```

**Components:**
- Large country flag (dynamic color extraction)
- Nation name with executive typography
- Economic tier badge with shimmer effect
- Key statistics tickers (population, GDP, growth)
- IxTime display showing current game year

#### 2. Vitality Dashboard (Glass Child Level)
```typescript
interface VitalityMetrics {
  economicHealth: ActivityRingData;    // GDP growth, trade balance
  populationWellbeing: ActivityRingData; // Growth rate, stability
  diplomaticStanding: ActivityRingData;  // Relations, treaties
  governmentalEfficiency: ActivityRingData; // Policies, approval
}
```

**Apple Health-Style Rings:**
- Economic Health (Green): GDP growth trajectory
- Population Wellbeing (Blue): Demographics and quality of life  
- Diplomatic Standing (Purple): International relationships
- Governmental Efficiency (Gold): Policy effectiveness

#### 3. Achievement Showcase (Glass Child Level)
```typescript
interface Achievement {
  id: string;
  title: string;
  description: string;
  achievedDate: IxTimeStamp;
  category: 'economic' | 'diplomatic' | 'cultural' | 'military';
  rarity: 'common' | 'rare' | 'legendary';
  icon: LucideIcon;
}
```

**Visual Elements:**
- Timeline display with IxTime integration
- Achievement cards with rarity-based styling
- Milestone progress bars
- International ranking badges

### Component Integration

#### Activity Rings Configuration
```typescript
const vitalityConfig = {
  economicHealth: {
    value: calculateEconomicScore(countryData),
    max: 100,
    color: '--gdp-green',
    label: 'Economic Vitality',
    trend: economicTrend
  },
  populationWellbeing: {
    value: calculatePopulationScore(countryData), 
    max: 100,
    color: '--pop-blue',
    label: 'Population Health',
    trend: populationTrend
  },
  diplomaticStanding: {
    value: calculateDiplomaticScore(countryData),
    max: 100, 
    color: '--growth-purple',
    label: 'Diplomatic Relations',
    trend: diplomaticTrend
  }
};
```

#### Bento Grid Layout
```typescript
const bentoAreas = [
  { id: 'vitality', gridArea: '1 / 1 / 3 / 3', component: 'VitalityRings' },
  { id: 'economics', gridArea: '1 / 3 / 2 / 5', component: 'EconomicSummary' },
  { id: 'demographics', gridArea: '2 / 3 / 3 / 4', component: 'PopulationStats' },
  { id: 'achievements', gridArea: '2 / 4 / 3 / 5', component: 'RecentAchievements' },
  { id: 'timeline', gridArea: '3 / 1 / 4 / 5', component: 'NationalTimeline' }
];
```

### Country-Specific Theming

#### Dynamic Color Extraction
```typescript
interface CountryTheme {
  primary: string;      // From flag dominant color
  secondary: string;    // From flag accent color  
  tertiary: string;     // Computed complementary
  flag: {
    colors: string[];   // Extracted palette
    dominantHue: number; // HSL hue value
  };
}

// Integration with glass system
const dynamicGlassTheme = {
  '--country-primary': theme.primary,
  '--country-secondary': theme.secondary, 
  '--glass-country-bg': `color-mix(in srgb, ${theme.primary} 15%, rgba(255,255,255,0.1))`,
  '--glass-country-border': `color-mix(in srgb, ${theme.primary} 30%, rgba(255,255,255,0.2))`
};
```

## 📱 Responsive Design Strategy

### Desktop (>1200px)
- Full bento grid layout with all components visible
- Large activity rings with detailed labels
- Expanded achievement timeline
- Comprehensive statistical overview

### Tablet (768px - 1200px)  
- Simplified bento grid (2x3 instead of 4x4)
- Medium-sized activity rings
- Condensed achievement cards
- Collapsible sections for detailed stats

### Mobile (>768px)
- Vertical stack layout
- Small activity rings with tap-to-expand
- Swipeable achievement carousel
- Accordion-style statistics sections

## 🔧 Technical Implementation

### Component Structure
```typescript
// Main component with country theming
export function MyCountryPublicPage({ countryId }: { countryId: string }) {
  const { data: countryData, isLoading } = api.countries.getById.useQuery({ id: countryId });
  const { data: achievements } = api.achievements.getByCountry.useQuery({ countryId });
  const theme = useCountryTheme(countryData?.flag);
  
  if (isLoading) return <LoadingStateWithSkeleton />;
  if (!countryData) return <CountryNotFoundError />;
  
  return (
    <div className="min-h-screen country-themed" style={theme.cssVariables}>
      <NationalHeader country={countryData} theme={theme} />
      <VitalityDashboard country={countryData} />
      <BentoGridLayout areas={bentoAreas}>
        <EconomicSummaryCard />
        <PopulationStatsCard />
        <AchievementShowcase achievements={achievements} />
        <NationalTimeline country={countryData} />
      </BentoGridLayout>
    </div>
  );
}
```

### Glass Integration
```typescript
// Enhanced glass components with country theming
const CountryGlassCard = ({ className, theme, ...props }) => (
  <GlassCard 
    className={cn(
      'glass-hierarchy-child',
      'glass-refraction', 
      theme && `theme-${theme}`,
      className
    )}
    {...props}
  />
);
```

## 🎯 User Experience Goals

### Primary User Journeys

#### 1. Visitor Discovery Flow
**Goal**: Help visitors understand the country's achievements and standing
```
Landing → Flag Recognition → Vitality Assessment → Achievement Exploration → Statistical Deep-dive
```

#### 2. Player Pride Flow  
**Goal**: Allow country owners to showcase their nation effectively
```
Share Link → Visual Impact → Key Metrics → Achievement Highlights → Call-to-Action
```

#### 3. Comparative Analysis Flow
**Goal**: Enable easy comparison between nations
```
Country A → Key Stats → Switch to Country B → Side-by-side Mental Model → Insights
```

### Interaction Design

#### Activity Rings Interactions
- **Hover**: Detailed tooltip with trend information
- **Click**: Expand to show historical data chart
- **Touch (Mobile)**: Tap to cycle through ring details

#### Achievement System
- **Hover**: Achievement details and rarity information
- **Click**: Full achievement history modal
- **Filter**: By category, date range, or rarity level

#### Statistical Cards
- **Hover**: Enhanced glass effect with data trends
- **Click**: Detailed breakdown modal
- **Compare**: Option to add comparison overlay

## 📊 Success Metrics

### Engagement Metrics
- **Time on Page**: Target 3+ minutes average
- **Interaction Rate**: 70% of visitors interact with at least one component  
- **Return Visits**: 40% of visitors return within 7 days
- **Sharing**: 15% of visits result in social sharing

### Performance Metrics
- **Core Web Vitals**: 
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1
- **Mobile Performance**: 90+ Lighthouse score
- **Accessibility**: WCAG 2.1 AA compliance

### Business Metrics
- **Player Retention**: 25% increase in daily active users
- **Community Growth**: 30% increase in referral traffic
- **Feature Adoption**: 60% of users explore executive dashboard

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Implement new component hierarchy
- [ ] Create country theming system
- [ ] Build responsive bento grid layout
- [ ] Integrate flag color extraction

### Phase 2: Core Features (Week 2)
- [ ] Implement activity rings with real data
- [ ] Build achievement showcase system
- [ ] Create statistical overview cards
- [ ] Add IxTime integration display

### Phase 3: Enhancement (Week 3)
- [ ] Advanced glass effects and animations
- [ ] Mobile optimization and responsive design
- [ ] Performance optimization
- [ ] Accessibility improvements

### Phase 4: Polish (Week 4)
- [ ] Cross-browser testing and fixes
- [ ] User experience testing
- [ ] Analytics implementation
- [ ] Documentation and handoff

## ✅ Acceptance Criteria

### Visual Design
- [ ] Country flag prominently displayed with extracted color theming
- [ ] Activity rings show real-time national vitality metrics
- [ ] Glass refraction effects enhance visual hierarchy
- [ ] Bento grid layout adapts fluidly across screen sizes

### Functionality
- [ ] All country statistics update automatically with IxTime
- [ ] Achievement system displays historical milestones
- [ ] International comparisons available on demand
- [ ] Sharing capabilities for social media

### Performance  
- [ ] Page loads completely within 2.5 seconds
- [ ] Smooth 60fps animations throughout
- [ ] Responsive design works perfectly on all devices
- [ ] Accessibility standards fully met

### Integration
- [ ] Seamless navigation to private executive dashboard
- [ ] Proper integration with existing routing system
- [ ] Compatible with current authentication flow
- [ ] Maintains existing URL structure and SEO

---

*This PRD establishes the foundation for a world-class national portfolio that showcases the best of each country while maintaining the sophisticated design language of the IxStats ecosystem.*