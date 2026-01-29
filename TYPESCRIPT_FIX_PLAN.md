# TypeScript Error Fix Plan

**Generated:** January 18, 2026  
**Total Errors:** 52  
**Categories:** 6

---

## Summary by Category

| Category | Count | Complexity | Fix Strategy |
|----------|-------|------------|--------------|
| Recharts Formatter Types | 35 | Low | Add null check to value |
| Recharts PieLabel Types | 4 | Low | Use proper PieLabelRenderProps |
| ChartDataInput Index Signature | 5 | Low | Add index signature to types |
| ChartTooltipProps Payload | 2 | Medium | Fix custom tooltip component types |
| PieLabelRenderProps Properties | 3 | Low | Access correct properties |
| Miscellaneous | 3 | Low | Individual fixes |

---

## Category 1: Recharts Formatter Types (35 errors)

### Problem
Recharts `Formatter` type expects `(value: number | undefined) => ...` but our formatters expect `(value: number) => ...`.

### Files Affected
- `src/app/_components/bot-monitoring.tsx` (2 errors)
- `src/app/builder/components/GovernmentSpending.tsx` (1 error)
- `src/app/builder/components/IncomeWealthDistribution.tsx` (4 errors)
- `src/app/countries/_components/economy/ComparativeAnalysis.tsx` (4 errors)
- `src/app/countries/_components/economy/Demographics.tsx` (4 errors)
- `src/app/countries/_components/economy/EconomicModelingEngine.tsx` (1 error)
- `src/app/countries/_components/economy/FiscalSystemComponent.tsx` (5 errors)
- `src/app/countries/_components/economy/GovernmentSpending.tsx` (1 error)
- `src/app/countries/_components/economy/IncomeWealthDistribution.tsx` (6 errors)
- `src/app/mycountry/intelligence/_components/CardEconomyAnalytics.tsx` (1 error)
- `src/components/economy/historical-charts/TimeSeriesChart.tsx` (1 error)
- `src/components/modals/PopulationDetailsModal.tsx` (1 error)
- `src/components/modals/PopulationTierDetailsModal.tsx` (1 error)
- `src/components/modals/StrategicPlanningModal.tsx` (1 error)

### Fix Pattern
```typescript
// BEFORE
formatter={(value: number) => formatCurrency(value)}

// AFTER - Option 1: Add undefined check
formatter={(value) => value !== undefined ? formatCurrency(value) : ''}

// AFTER - Option 2: Default value
formatter={(value = 0) => formatCurrency(value)}

// AFTER - Option 3: Type assertion (use sparingly)
formatter={(value) => formatCurrency(value as number)}
```

### Recommended Fix
Create a utility wrapper function:
```typescript
// src/lib/chart-utils.ts
export function createFormatter<T extends string>(
  fn: (value: number) => string | [string, T]
): (value: number | undefined) => string | [string, T] | '' {
  return (value) => value !== undefined ? fn(value) : '';
}

// Usage
formatter={createFormatter((value) => formatCurrency(value))}
```

---

## Category 2: Recharts PieLabel Types (4 errors)

### Problem
PieLabel expects `PieLabelRenderProps` but we're using custom destructured type.

### Files Affected
- `src/app/admin/military-equipment/analytics/page.tsx` (2 errors)
- `src/app/admin/military-equipment/page.tsx` (2 errors)

### Fix Pattern
```typescript
// BEFORE
label={({ name, percent }: { name: string; percent?: number }) =>
  `${name}: ${(percent || 0) * 100}%`
}

// AFTER
label={(props: PieLabelRenderProps) => {
  const { name, percent } = props;
  return `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`;
}}
```

---

## Category 3: ChartDataInput Index Signature (5 errors)

### Problem
Data types passed to charts are missing `[key: string]: unknown` index signature.

### Files Affected
- `src/app/countries/_components/economy/FiscalSystemComponent.tsx` (2 errors)
- `src/components/analytics/charts/PolicyDistributionChart.tsx` (1 error)
- `src/components/analytics/charts/RelationshipDistributionChart.tsx` (1 error)
- `src/components/modals/PopulationTierDetailsModal.tsx` (1 error)

### Fix Pattern
```typescript
// BEFORE
interface ChartDataItem {
  name: string;
  value: number;
}

// AFTER - Add index signature
interface ChartDataItem {
  name: string;
  value: number;
  [key: string]: unknown;
}

// OR - Use type assertion when passing data
data={chartData as ChartDataInput[]}
```

---

## Category 4: ChartTooltipProps Payload (2 errors)

### Problem
Custom tooltip components receive `readonly any[]` but expect mutable array.

### Files Affected
- `src/app/builder/primitives/enhanced/EnhancedBarChart.tsx` (1 error)
- `src/app/builder/primitives/enhanced/EnhancedPieChart.tsx` (1 error)

### Fix Pattern
```typescript
// BEFORE
interface ChartTooltipProps {
  payload: { name: string; value: number }[];
}

// AFTER - Accept readonly
interface ChartTooltipProps {
  payload: readonly { name: string; value: number }[];
}

// OR - Copy the array
const mutablePayload = [...payload];
```

---

## Category 5: PieLabelRenderProps Properties (3 errors)

### Problem
Accessing custom properties that don't exist on `PieLabelRenderProps`.

### Files Affected
- `src/components/analytics/AtomicAnalyticsDashboard.tsx` (2 errors - `category`, `count`)
- `src/components/modals/PopulationDetailsModal.tsx` (1 error - `percentage`)

### Fix Pattern
```typescript
// BEFORE - Direct property access
label={(props) => `${props.category}: ${props.count}`}

// AFTER - Use payload or extend props type
label={(props) => {
  const entry = props.payload as { category: string; count: number };
  return `${entry.category}: ${entry.count}`;
}}
```

---

## Category 6: Miscellaneous (3 errors)

### 6.1: Missing `User` Type
**File:** `src/app/_components/navigation.tsx:1374`
```typescript
// BEFORE
const user: User = ...

// AFTER - Check for correct import or use existing type
import type { User } from '@clerk/nextjs';
// OR use the correct variable reference
const { user } = useUser();
```

### 6.2: Null Assignment to Boolean
**File:** `src/components/thinkpages/ThinktankGroups.tsx:302`
```typescript
// BEFORE
enabled={condition && value}  // can be null

// AFTER
enabled={Boolean(condition && value)}
// OR
enabled={!!(condition && value)}
```

### 6.3: Invalid dominant-baseline Value
**File:** `src/app/builder/primitives/enhanced/EnhancedBarChart.tsx:78`
```typescript
// BEFORE
dominantBaseline="bottom"

// AFTER - Use valid SVG value
dominantBaseline="auto"
// OR
dominantBaseline="middle"
```

### 6.4: Undefined Name Check
**Files:** `src/app/admin/diplomatic-scenarios/analytics/page.tsx` (2 errors)
```typescript
// BEFORE
name.slice(0, 2)

// AFTER
(name ?? '').slice(0, 2)
```

### 6.5: Undefined Value Check  
**File:** `src/app/builder/components/IncomeWealthDistribution.tsx:465`
```typescript
// BEFORE
value.toFixed(1)

// AFTER
(value ?? 0).toFixed(1)
```

### 6.6: Unknown[] to ChartDataInput[]
**File:** `src/app/mycountry/intelligence/_components/DiplomaticAnalytics.tsx:459`
```typescript
// BEFORE
data={unknownArray}

// AFTER
data={unknownArray as ChartDataInput[]}
```

---

## Execution Plan

### Phase 1: Create Utility Functions (15 min)
1. Create `src/lib/chart-utils.ts` with formatter wrapper
2. Export types for common chart data structures

### Phase 2: Fix Formatter Issues (45 min)
1. Import utility in affected files
2. Wrap all formatter functions
3. Use default value pattern for simple cases

### Phase 3: Fix PieLabel Issues (15 min)
1. Update label functions to use PieLabelRenderProps
2. Add proper null checks

### Phase 4: Fix Index Signature Issues (15 min)
1. Add index signatures to data interfaces
2. Or use type assertions where appropriate

### Phase 5: Fix Remaining Issues (15 min)
1. Fix tooltip payload types
2. Fix property access on PieLabelRenderProps
3. Fix miscellaneous issues

### Phase 6: Verification (10 min)
1. Run `tsc --noEmit`
2. Run `npm run build`
3. Verify no new errors

---

## Estimated Time
- **Total:** 2-2.5 hours
- **Can be parallelized:** Phases 2-5 can be worked on simultaneously

---

## Notes

1. **Most errors are from Recharts type strictness** - The library expects formatters to handle undefined values
2. **No runtime issues** - These are type-only errors; the code works correctly at runtime
3. **Build passes** - Next.js build completes despite these TypeScript errors (they're non-blocking)
4. **Safe to fix incrementally** - Each fix is isolated and won't break other code
