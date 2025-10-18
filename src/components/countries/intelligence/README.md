# Intelligence Briefing Components

Modular, reusable components extracted from the 2,720-line EnhancedIntelligenceBriefing.tsx monolith.

## Architecture

### Component Structure

```
intelligence/
├── charts/
│   ├── IntelligenceCharts.tsx     # Chart visualization components
│   ├── chartConfig.ts             # Chart configuration and settings
│   └── index.ts                   # Chart exports
├── VitalityMetricsPanel.tsx       # Vitality rings and health metrics
├── CountryMetricsGrid.tsx         # Grid of country statistics
├── WikiIntegrationPanel.tsx       # Wiki data integration display
├── IntelligenceSummary.tsx        # Summary cards and overview panels
├── StatusIndicators.tsx           # Classification badges and status displays
├── types.ts                       # Shared TypeScript types
├── constants.ts                   # Configuration constants
├── utils.ts                       # Utility functions
└── index.ts                       # Central exports
```

### Data Management

```
hooks/
└── useIntelligenceData.ts         # Custom hook for intelligence data
```

## Components

### 1. VitalityMetricsPanel (~150 lines)
**Purpose:** Display vitality rings with health metrics
**Features:**
- Health ring visualizations
- Trend indicators
- Status badges
- Classification filtering

**Usage:**
```tsx
<VitalityMetricsPanel
  metrics={vitalityMetrics}
  viewerClearanceLevel="PUBLIC"
  showClassified={false}
  flagColors={{ primary: '#3b82f6', secondary: '#6366f1', accent: '#8b5cf6' }}
/>
```

### 2. CountryMetricsGrid (~200 lines)
**Purpose:** Display country statistics in organized grid
**Features:**
- Automatic grouping by category (economy, demographics, labor, etc.)
- Expandable metric cards
- Trend indicators
- Importance-based styling

**Usage:**
```tsx
<CountryMetricsGrid
  metrics={countryMetrics}
  viewerClearanceLevel="PUBLIC"
  expandedMetrics={expandedSet}
  onMetricToggle={handleToggle}
/>
```

### 3. WikiIntegrationPanel (~280 lines)
**Purpose:** Display wiki data with editor integration
**Features:**
- Wiki content parsing
- Coat of arms display
- Create/edit overview
- Link handling
- Expandable content

**Usage:**
```tsx
<WikiIntegrationPanel
  wikiData={wikiData}
  country={country}
  isLoading={false}
  onSaveOverview={handleSave}
/>
```

### 4. IntelligenceSummary (~250 lines)
**Purpose:** Summary displays and alert panels
**Components:**
- `IntelligenceAlerts` - Active intelligence alerts
- `CountryInformationDisplay` - Organized country information
- `IntelligenceHeader` - Briefing header with clearance controls

**Usage:**
```tsx
<IntelligenceAlerts
  alerts={alerts}
  viewerClearanceLevel="RESTRICTED"
/>

<IntelligenceHeader
  countryName="Example Country"
  currentIxTime={Date.now()}
  viewerClearanceLevel="PUBLIC"
  onToggleClassified={handleToggle}
/>
```

### 5. StatusIndicators (~130 lines)
**Purpose:** Reusable status and classification displays
**Components:**
- `ClassificationBadge` - Security clearance badges
- `StatusBadge` - Health/status indicators
- `TrendIndicator` - Trend arrows with values
- `StabilityIndicator` - Stability status

**Usage:**
```tsx
<ClassificationBadge classification="CONFIDENTIAL" />
<StatusBadge status="excellent" />
<TrendIndicator trend="up" value={2.5} period="annual" />
```

### 6. IntelligenceCharts (~350 lines)
**Purpose:** Recharts-based chart components
**Charts:**
- `IntelligenceLineChart` - Time series line charts
- `IntelligenceBarChart` - Bar charts with custom colors
- `IntelligenceAreaChart` - Area charts with gradients
- `IntelligenceRadarChart` - Radar/spider charts
- `IntelligenceMultiLineChart` - Multi-series comparisons

**Usage:**
```tsx
<IntelligenceLineChart
  data={timeSeriesData}
  title="GDP Growth Over Time"
  dataKey="value"
  color="#3b82f6"
/>
```

## Data Management

### useIntelligenceData Hook (~350 lines)
**Purpose:** Centralized data fetching and calculations
**Returns:**
- `vitalityMetrics` - Calculated vitality metrics
- `countryMetrics` - Derived country statistics
- `countryInformation` - Organized information categories
- `wikiData` - Fetched/cached wiki data
- `isLoadingWiki` - Loading state
- `saveWikiOverview` - Save custom overview

**Usage:**
```tsx
const {
  vitalityMetrics,
  countryMetrics,
  wikiData,
  isLoadingWiki
} = useIntelligenceData({
  country,
  viewerClearanceLevel: 'PUBLIC',
  flagColors,
  propWikiData
});
```

## Shared Resources

### Types (`types.ts`)
All TypeScript interfaces and types for intelligence components.

### Constants (`constants.ts`)
- `CLASSIFICATION_STYLES` - Security classification styling
- `STATUS_STYLES` - Health status styling
- `IMPORTANCE_STYLES` - Importance level styling
- `TIER_SCORE_MAP` - Economic tier scoring
- `ECONOMIC_TIER_DATA` - Economic tier definitions
- `POPULATION_TIER_DATA` - Population tier definitions

### Utilities (`utils.ts`)
- `getTrendIcon()` - Get icon for trend direction
- `getTrendColor()` - Get color for trend direction
- `getStatusFromValue()` - Calculate status from numeric value
- `hasAccess()` - Check clearance level access
- `parseWikiContent()` - Parse wiki markup to React elements

## Integration with Shared Library

The components integrate with the shared component library:

### From `~/components/shared/data-display/`:
- `MetricCard` - Used within CountryMetricsGrid for individual metrics

### From `~/components/shared/layouts/`:
- `SectionWrapper` - Can wrap intelligence sections
- Glass hierarchy classes for consistent styling

### From `~/components/shared/feedback/`:
- `LoadingState` - Used in WikiIntegrationPanel
- `ErrorDisplay` - For error states (future integration)

## Refactored Main Component

**Original:** 2,720 lines
**Refactored:** ~350 lines
**Reduction:** 87% fewer lines

The refactored `EnhancedIntelligenceBriefingRefactored.tsx` demonstrates clean composition:

```tsx
export const EnhancedIntelligenceBriefingRefactored = () => {
  // Data hook handles all calculations
  const { vitalityMetrics, countryMetrics, ... } = useIntelligenceData({...});

  return (
    <>
      <IntelligenceHeader {...headerProps} />
      <VitalityMetricsPanel metrics={vitalityMetrics} />
      <CountryMetricsGrid metrics={countryMetrics} />
      <WikiIntegrationPanel wikiData={wikiData} />
    </>
  );
};
```

## Benefits

### Maintainability
- **Single Responsibility:** Each component has one clear purpose
- **Easier Testing:** Smaller components are easier to test
- **Faster Debugging:** Issues isolated to specific components

### Reusability
- Components can be used independently
- Mix and match for different use cases
- Shared across intelligence views

### Performance
- Selective rendering of needed components
- Easier memoization with smaller components
- Reduced bundle size through tree-shaking

### Developer Experience
- Clear component boundaries
- TypeScript support throughout
- Consistent API patterns
- Comprehensive documentation

## Migration Guide

### From Original Component

**Before:**
```tsx
import { EnhancedIntelligenceBriefing } from '~/components/countries/EnhancedIntelligenceBriefing';
```

**After (Refactored):**
```tsx
import { EnhancedIntelligenceBriefingRefactored } from '~/components/countries/EnhancedIntelligenceBriefingRefactored';
// or use individual components
import { VitalityMetricsPanel, CountryMetricsGrid } from '~/components/countries/intelligence';
```

### Custom Implementations

You can now build custom intelligence views:

```tsx
import {
  useIntelligenceData,
  VitalityMetricsPanel,
  CountryMetricsGrid,
  IntelligenceLineChart
} from '~/components/countries/intelligence';

export const CustomIntelligenceView = ({ country }) => {
  const { vitalityMetrics, countryMetrics } = useIntelligenceData({ country });

  return (
    <div className="custom-layout">
      <VitalityMetricsPanel metrics={vitalityMetrics.slice(0, 2)} />
      <CountryMetricsGrid metrics={countryMetrics} />
      <IntelligenceLineChart data={historicalData} />
    </div>
  );
};
```

## Future Enhancements

1. **Chart Integration:** Connect charts to historical data sources
2. **Real-time Updates:** WebSocket integration for live metrics
3. **Export Functionality:** PDF/CSV export for intelligence reports
4. **Advanced Analytics:** ML-based trend predictions
5. **Collaborative Features:** Multi-user annotations and notes
