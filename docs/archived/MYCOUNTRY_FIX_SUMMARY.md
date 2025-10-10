# MyCountry Data Discrepancy - Fix Summary

## Problem Statement
Users reported seeing different values in the MyCountry editor versus the MyCountry frontend page for the same country data (population, GDP, etc.).

## Root Cause Analysis
The discrepancy was caused by two different API endpoints using different data sources:

1. **Frontend** (`/mycountry`) used `getByIdWithEconomicData` → returned **calculated current values**
2. **Editor** (`/mycountry/editor`) used `getByIdAtTime` → returned **baseline values** for current time

## Single Source of Truth: Database Schema

### Field Categories
```
Country Model:
├── Baseline (immutable starting point)
│   ├── baselinePopulation
│   ├── baselineGdpPerCapita
│   └── baselineDate
│
├── Current (calculated by engine)
│   ├── currentPopulation  ← UPDATED BY CALC ENGINE
│   ├── currentGdpPerCapita ← UPDATED BY CALC ENGINE
│   └── currentTotalGdp     ← UPDATED BY CALC ENGINE
│
└── Indicators (user-editable)
    ├── unemploymentRate
    ├── taxRevenueGDPPercent
    ├── totalDebtGDPRatio
    └── [50+ other economic indicators]
```

## Fixes Implemented

### Fix 1: API Endpoint - Return Current Values
**File**: `/src/server/api/routers/countries.ts`
**Line**: 766-801

**Before**:
```typescript
if (isCurrentTime) {
  calculatedStats = {
    population: countryFromDb.baselinePopulation,  // ❌ Wrong
    gdpPerCapita: countryFromDb.baselineGdpPerCapita,  // ❌ Wrong
    ...
  };
}
```

**After**:
```typescript
if (isCurrentTime) {
  // FIXED: Use current values, not baseline values
  calculatedStats = {
    population: validateNumber(countryFromDb.currentPopulation, 1e11),  // ✅ Correct
    gdpPerCapita: validateNumber(countryFromDb.currentGdpPerCapita, 1e7, 1),  // ✅ Correct
    ...
  };
}
```

**Impact**: Editor now receives the same current values as the frontend.

### Fix 2: Editor Data Initialization
**File**: `/src/app/mycountry/editor/hooks/useCountryEditorData.ts`
**Line**: 68-90

**Before**:
```typescript
const currentPop = Number(country.currentPopulation) || Number(country.baselinePopulation);  // ❌ Fallback to baseline
```

**After**:
```typescript
// FIXED: Use current values directly - no fallback to baseline
const currentPop = Number(country.currentPopulation) || Number(country.population) || 10000000;  // ✅ Use calculated values
```

**Impact**: Editor initialization prioritizes current calculated values.

### Fix 3: Documentation and Comments
**File**: `/src/server/api/routers/countries.ts`
**Line**: 564-567

**Added**:
```typescript
// IMPORTANT: This mutation updates ECONOMIC INDICATORS only.
// It does NOT update currentPopulation, currentGdpPerCapita, or currentTotalGdp.
// Those fields are calculated and updated by the IxStats calculation engine.
// The editor should display current* values but only allow editing of indicators.
updateEconomicData: protectedProcedure
```

**Impact**: Future developers understand the separation of concerns.

## Data Flow After Fixes

```
┌─────────────────────────────────────────────────────┐
│                   DATABASE                          │
│  ┌──────────────────────────────────────────────┐  │
│  │ Country Table (Single Source of Truth)      │  │
│  │                                              │  │
│  │  Baseline:     baselinePopulation = 10M     │  │
│  │  Current:      currentPopulation = 12.5M ←──┼──┼── Updated by Calc Engine
│  │  Indicators:   unemploymentRate = 5.2%      │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         ↓                                ↓
         ↓                                ↓
    [Frontend]                       [Editor]
         ↓                                ↓
  getByIdWithEconomicData          getByIdAtTime
         ↓                                ↓
  Returns: currentPopulation       Returns: currentPopulation
         = 12.5M ✅                      = 12.5M ✅
         ↓                                ↓
    User sees:                       User sees:
    "12.5M people"                   "12.5M people"
         ↓                                ↓
    ✅ CONSISTENT                    ✅ CONSISTENT
```

## Testing Checklist

### Manual Testing
- [ ] Open MyCountry frontend (`/mycountry`)
- [ ] Note the population, GDP/capita, and total GDP values
- [ ] Open MyCountry editor (`/mycountry/editor`)
- [ ] Verify the same values appear in the editor
- [ ] Make a change to an economic indicator (e.g., unemployment rate)
- [ ] Save the changes
- [ ] Verify the change persists
- [ ] Verify population/GDP values remain unchanged (calculated fields)

### Automated Testing
- [ ] Unit test: `getByIdAtTime` returns current values for current time
- [ ] Integration test: Editor and frontend fetch same country data
- [ ] Regression test: Saving economic indicators doesn't corrupt current values

## What Users Should See

### Before Fix
```
Frontend:     Population: 12.5M
Editor:       Population: 10M     ❌ DISCREPANCY
```

### After Fix
```
Frontend:     Population: 12.5M
Editor:       Population: 12.5M   ✅ CONSISTENT
```

## Important Notes

### What Gets Updated by Editor
- ✅ Economic indicators (unemployment, inflation, tax rates, etc.)
- ✅ Labor market data
- ✅ Fiscal system data
- ✅ Demographics (life expectancy, literacy, etc.)

### What DOESN'T Get Updated by Editor
- ❌ `currentPopulation` - Updated by calculation engine
- ❌ `currentGdpPerCapita` - Updated by calculation engine
- ❌ `currentTotalGdp` - Updated by calculation engine
- ❌ `baselinePopulation` - Immutable starting point
- ❌ `baselineGdpPerCapita` - Immutable starting point

### How Current Values Update
Current values are updated by the **IxStats calculation engine** which:
1. Reads baseline values
2. Reads economic indicators
3. Calculates growth over time based on IxTime
4. Writes results to `current*` fields

## Related Files Modified

1. `/src/server/api/routers/countries.ts` - API endpoint fixes
2. `/src/app/mycountry/editor/hooks/useCountryEditorData.ts` - Editor data initialization
3. `/MYCOUNTRY_DATA_AUDIT.md` - Comprehensive audit documentation
4. `/MYCOUNTRY_FIX_SUMMARY.md` - This file

## Rollback Plan

If issues arise, revert these commits:
- `getByIdAtTime` changes in countries router
- `useCountryEditorData` initialization logic

The database schema remains unchanged, so no migrations are needed.

## Success Criteria

✅ Editor and frontend display identical values for:
- Population
- GDP per capita
- Total GDP
- Growth rates
- Economic tier
- Population tier

✅ Users can edit economic indicators without affecting calculated values

✅ Calculation engine continues to update current values on schedule

## Deployment Notes

1. No database migration required
2. API changes are backward compatible
3. Frontend and editor can be deployed independently
4. No cache invalidation needed
5. No user data migration required

## Future Improvements

1. Add visual indicator in editor showing calculated vs. editable fields
2. Add real-time preview of how indicator changes affect calculations
3. Add validation to prevent accidental editing of calculated fields
4. Consider making current values read-only in UI with tooltips explaining they're calculated
