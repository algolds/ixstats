# NumberFlow Usage Guide for IxStats

This guide ensures all numbers in IxStats use the NumberFlow component for consistent, animated number displays.

## Quick Start

```tsx
import { NumberFlowDisplay } from '~/components/ui/number-flow';
import { quickFormat } from '~/lib/number-utils';

// Basic usage
<NumberFlowDisplay value={42000} format="currency" />
// Displays: $42K

// With utility helper
const config = quickFormat.currency(1250000);
<NumberFlowDisplay {...config} />
// Displays: $1.3M
```

## Available Formats

### Currency
```tsx
<NumberFlowDisplay value={1250000} format="currency" />
// → $1.3M

<NumberFlowDisplay value={45} format="currency" />
// → $45
```

### Population
```tsx
<NumberFlowDisplay value={8500000} format="population" />
// → 8.5M

<NumberFlowDisplay value={1200000000} format="population" />
// → 1.20B
```

### Percentage
```tsx
<NumberFlowDisplay value={23.7} format="percentage" />
// → 23.7%

<NumberFlowDisplay value={2.5} format="percentage" trend="up" />
// → 2.5% (with green color)
```

### Growth Rates
```tsx
// Use the growth helper for automatic trend detection
const config = quickFormat.growth(3.2); // Positive = up trend
<NumberFlowDisplay {...config} />
// → 3.2% (green)

const config = quickFormat.growth(-1.5); // Negative = down trend
<NumberFlowDisplay {...config} />
// → -1.5% (red)
```

## Advanced Usage

### Custom Formatting
```tsx
<NumberFlowDisplay 
  value={42000}
  prefix="≈ $"
  suffix=" USD"
  decimalPlaces={2}
  duration={1500}
  className="text-lg font-bold"
/>
```

### Trend Indicators
```tsx
<NumberFlowDisplay 
  value={23.5}
  format="percentage"
  trend="up"    // 'up' | 'down' | 'stable'
  className="text-green-500"
/>
```

## Migration from Direct Numbers

### Before (Avoid)
```tsx
// ❌ Don't use direct number displays
<span>${value.toFixed(2)}</span>
<span>{value.toLocaleString()}</span>
<span>{(growthRate * 100).toFixed(1)}%</span>
```

### After (Use NumberFlow)
```tsx
// ✅ Use NumberFlow for all numbers
<NumberFlowDisplay value={value} format="currency" decimalPlaces={2} />
<NumberFlowDisplay value={value} format="compact" />
<NumberFlowDisplay value={growthRate * 100} format="percentage" />
```

## Quick Format Helpers

For common patterns, use the utility helpers:

```tsx
import { quickFormat } from '~/lib/number-utils';

// Currency with automatic scaling
const currencyConfig = quickFormat.currency(1500000);
<NumberFlowDisplay {...currencyConfig} />

// Population with automatic scaling  
const popConfig = quickFormat.population(8500000);
<NumberFlowDisplay {...popConfig} />

// Growth rate with trend detection
const growthConfig = quickFormat.growth(2.5);
<NumberFlowDisplay {...growthConfig} />

// Compact numbers
const compactConfig = quickFormat.compact(45000);
<NumberFlowDisplay {...compactConfig} />
```

## Performance Considerations

- NumberFlow is optimized for smooth animations
- Default duration is 1000ms, adjust for UX needs
- Use shorter durations (800ms) for frequent updates
- Use longer durations (1500ms) for important milestones

## Integration Examples

### In Intelligence Components
```tsx
// Economic indicators
<NumberFlowDisplay 
  value={country.gdpPerCapita}
  format="currency"
  trend={getEconomicTrend()}
  duration={1200}
/>

// Population data
<NumberFlowDisplay 
  value={country.population}
  format="population"
  className="text-xl font-semibold"
/>
```

### In Dashboard Cards
```tsx
// Stat cards
<div className="stat-card">
  <h3>Total GDP</h3>
  <NumberFlowDisplay 
    value={totalGdp}
    format="currency"
    className="text-2xl font-bold"
  />
</div>
```

### In Data Tables
```tsx
// Table cells
<td>
  <NumberFlowDisplay 
    value={country.gdpGrowth * 100}
    format="percentage"
    trend={country.gdpGrowth > 0 ? 'up' : 'down'}
  />
</td>
```

## Rules for Developers

1. **Always use NumberFlow for numeric displays** - Never use direct number rendering
2. **Choose appropriate formats** - Use format="currency" for GDP, format="population" for people counts
3. **Include trend indicators** - Use trend prop for growth rates and changes
4. **Use utility helpers** - Prefer `quickFormat.*` helpers for common patterns
5. **Consistent durations** - Use standard durations (800ms, 1000ms, 1200ms, 1500ms)

## Common Patterns

### GDP Values
```tsx
<NumberFlowDisplay value={gdp} format="currency" />
```

### Population Counts  
```tsx
<NumberFlowDisplay value={population} format="population" />
```

### Growth Rates
```tsx
<NumberFlowDisplay 
  value={rate * 100} 
  format="percentage" 
  trend={rate > 0 ? 'up' : 'down'} 
/>
```

### Large Numbers (Rankings, Scores)
```tsx
<NumberFlowDisplay value={score} format="compact" />
```

### Money Amounts
```tsx
<NumberFlowDisplay value={amount} format="currency" decimalPlaces={2} />
```

This ensures all numbers in IxStats have smooth, consistent animations and appropriate formatting.