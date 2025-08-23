# Enhanced Builder Primitives Implementation Guide

## Overview

This enhanced primitive system provides a standardized, section-themed, glass physics-based set of input and visualization components for the IxStats Country Builder.

## Key Features

### 🎨 **Section-Specific Theming**
- Automatic color theming based on section ID
- Gold theme for National Symbols & Fiscal System
- Blue theme for Core Indicators  
- Emerald theme for Labor & Employment
- Purple theme for Government Spending
- Red theme for Demographics

### 🌊 **Animated NumberFlow**
- Smooth value transitions with configurable duration
- Smart number formatting (K, M, B, T suffixes)
- Real-time animated value display
- Support for currency, percentage, and custom formatting

### 🪟 **Glass Physics Integration**
- Consistent depth hierarchy (base, elevated, modal)
- Section-specific color gradients and effects
- Hover and focus animations
- Light/dark mode compatible

### 📊 **Intelligent Data Visualization**
- Automatic chart type selection based on data
- Section-themed color palettes
- Interactive tooltips and legends
- Performance optimized with truncation for large datasets

## Component Usage

### Input Components

#### EnhancedNumberInput
```tsx
import { EnhancedNumberInput } from '../primitives/enhanced';

<EnhancedNumberInput
  label="Population"
  value={population}
  onChange={setPopulation}
  min={100000}
  max={2000000000}
  step={100000}
  unit=" people"
  sectionId="core"  // Automatic blue theme
  showComparison={true}
  referenceValue={referenceCountry.population}
  referenceLabel={referenceCountry.name}
  format={(value) => formatPopulation(value)}
  showButtons={true}
  showReset={true}
  animationDuration={800}
/>
```

#### EnhancedSlider
```tsx
<EnhancedSlider
  label="GDP Growth Rate"
  value={growthRate}
  onChange={setGrowthRate}
  min={-10}
  max={15}
  step={0.1}
  precision={1}
  unit="%"
  sectionId="core"
  showTicks={true}
  tickCount={6}
  showComparison={true}
  referenceValue={2.5}
  referenceLabel="Global Average"
/>
```

#### EnhancedDial
```tsx
<EnhancedDial
  label="Inflation Rate"
  value={inflationRate}
  onChange={setInflationRate}
  min={-5}
  max={20}
  unit="%"
  sectionId="core"
  showTicks={true}
  showValue={true}
  size="lg"
/>
```

#### EnhancedToggle
```tsx
<EnhancedToggle
  label="Advanced Labor Protections"
  description="Enable strong worker rights and job security"
  checked={laborProtections}
  onChange={setLaborProtections}
  sectionId="labor"  // Automatic emerald theme
  variant="switch"
  showIcons={true}
/>
```

### Chart Components

#### EnhancedBarChart
```tsx
<EnhancedBarChart
  data={comparisonData}
  xKey="name"
  yKey="gdpPerCapita"
  title="GDP Comparison"
  description="Your country vs reference"
  height={300}
  sectionId="core"
  formatValue={(value) => formatCurrency(value)}
  showTooltip={true}
  showGrid={true}
  maxBars={20}  // Auto-truncation for performance
/>
```

#### MetricCard
```tsx
<MetricCard
  label="Total GDP"
  value={nominalGDP}
  unit=""
  description="Nominal Gross Domestic Product"
  icon={DollarSign}
  sectionId="core"
  trend="up"
  change={2.3}
  changeUnit="%"
/>
```

## Section Integration

### Automatic Theming by Section ID

```tsx
// Core Indicators (Blue Theme)
<EnhancedNumberInput sectionId="core" ... />

// Labor & Employment (Emerald Theme)  
<EnhancedSlider sectionId="labor" ... />

// Government Spending (Purple Theme)
<EnhancedDial sectionId="government" ... />

// Demographics (Red Theme)
<MetricCard sectionId="demographics" ... />

// National Symbols (Gold Theme)
<EnhancedToggle sectionId="symbols" ... />

// Fiscal System (Gold Theme)
<EnhancedBarChart sectionId="fiscal" ... />
```

### Manual Theme Override
```tsx
<EnhancedNumberInput theme="emerald" ... />  // Override to emerald
<MetricCard theme="purple" ... />            // Override to purple
```

## Advanced Features

### Reference Value Comparisons
All input components support reference value comparison:
```tsx
<EnhancedNumberInput
  referenceValue={referenceCountry.population}
  referenceLabel={referenceCountry.name}
  showComparison={true}
/>
```

### Custom Formatters
```tsx
const formatCurrency = (value: number) => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  return `$${value.toLocaleString()}`;
};

<EnhancedNumberInput format={formatCurrency} ... />
```

### Animation Control
```tsx
<EnhancedSlider animationDuration={1200} ... />  // Slower animation
<MetricCard animationDuration={400} ... />       // Faster animation
```

## Migration from Legacy Components

### Replace Legacy Glass Components

**Before:**
```tsx
import { GlassNumberPicker, GlassSlider, GlassDial } from '~/components/charts';

<GlassNumberPicker theme="blue" ... />
<GlassSlider theme="blue" ... />
<GlassDial theme="blue" ... />
```

**After:**
```tsx
import { EnhancedNumberInput, EnhancedSlider, EnhancedDial } from '../primitives/enhanced';

<EnhancedNumberInput sectionId="core" ... />  // Auto blue theme
<EnhancedSlider sectionId="core" ... />
<EnhancedDial sectionId="core" ... />
```

### Section Component Refactoring

**Before:**
```tsx
export function CoreIndicatorsSection({ inputs, onInputsChange, referenceCountry }) {
  return (
    <div className="space-y-6">
      <GlassNumberPicker
        label="Population"
        value={inputs.coreIndicators.totalPopulation}
        onChange={(value) => onInputsChange({...})}
        theme="blue"
      />
    </div>
  );
}
```

**After:**
```tsx
export function CoreIndicatorsSectionEnhanced({ inputs, onInputsChange, referenceCountry }) {
  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Population"
          value={inputs.coreIndicators.totalPopulation}
          icon={Users}
          sectionId="core"
        />
      </div>
      
      {/* Enhanced Inputs */}
      <EnhancedNumberInput
        label="Population"
        value={inputs.coreIndicators.totalPopulation}
        onChange={(value) => onInputsChange({...})}
        sectionId="core"  // Automatic theming
        showComparison={true}
        referenceValue={referenceCountry.population}
        referenceLabel={referenceCountry.name}
        format={formatPopulation}
      />
    </div>
  );
}
```

## Performance Considerations

### Automatic Data Truncation
Charts automatically truncate large datasets:
```tsx
<EnhancedBarChart maxBars={20} ... />  // Shows top 20 items
```

### Optimized Animations
- Uses Framer Motion's optimized animation system
- GPU-accelerated transforms
- Configurable animation duration
- Smart animation disabling for accessibility

### Memoization
All components use React.memo and useMemo for optimal performance:
```tsx
const processedData = useMemo(() => {
  return expensiveDataProcessing(rawData);
}, [rawData]);
```

## Accessibility Features

- Proper ARIA labels and descriptions
- Keyboard navigation support
- Focus management
- High contrast mode compatibility
- Screen reader optimized
- Reduced motion support

## Next Steps

1. **Replace existing sections** with enhanced versions
2. **Test section theming** across all builder sections  
3. **Add more chart types** (Line, Pie, Area, Gauge)
4. **Implement advanced animations** for section transitions
5. **Add accessibility testing** and compliance verification