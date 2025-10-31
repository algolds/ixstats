# MyCountry System Data Audit Report

## Executive Summary

**Issue**: Data discrepancies between MyCountry Editor and MyCountry frontend display.

**Root Cause**: Multiple API endpoints fetching country data differently, causing inconsistent data presentation.

## Single Source of Truth: Database Schema

The `Country` model in Prisma is the **authoritative source** with these key fields:

### Current/Live Data (What users see on frontend):
- `currentPopulation` - Live population after calculations
- `currentGdpPerCapita` - Live GDP per capita after calculations
- `currentTotalGdp` - Live total GDP after calculations
- `adjustedGdpGrowth` - Current adjusted growth rate
- `populationGrowthRate` - Current population growth

### Baseline Data (Starting point for calculations):
- `baselinePopulation` - Original population at baseline
- `baselineGdpPerCapita` - Original GDP/capita at baseline
- `baselineDate` - Timestamp of baseline

### Economic Indicators:
- All fields like `nominalGDP`, `realGDPGrowthRate`, `inflationRate`, etc.
- Labor fields: `unemploymentRate`, `laborForceParticipationRate`, etc.
- Fiscal fields: `taxRevenueGDPPercent`, `totalDebtGDPRatio`, etc.

## Data Flow Analysis

### 1. MyCountry Frontend (`/mycountry`)

**Data Source**: `api.countries.getByIdWithEconomicData`
- Fetches country from database
- **PERFORMS LIVE CALCULATIONS** using `IxStatsCalculator`
- Returns calculated values based on current IxTime
- Includes projections and historical data
- Uses `currentPopulation`, `currentGdpPerCapita`, `currentTotalGdp` from calculations

**Display Logic**:
- Uses `CountryDataProvider` context
- Generates economic data templates via `generateCountryEconomicData()`
- Merges calculated data with real database values
- Shows **calculated current values**

### 2. MyCountry Editor (`/mycountry/editor`)

**Data Source**: `api.countries.getByIdAtTime`
- Fetches country from database
- **TWO MODES**:
  - **Current Time Mode**: Returns database values directly (baseline values)
  - **Historical Time Mode**: Performs calculations for that timestamp

**Critical Issue**: When fetching for "current time", it returns:
```typescript
calculatedStats = {
  population: countryFromDb.baselinePopulation,  // ❌ BASELINE, not current!
  gdpPerCapita: countryFromDb.baselineGdpPerCapita,  // ❌ BASELINE, not current!
  currentPopulation: countryFromDb.currentPopulation,  // ✅ Current value
  currentGdpPerCapita: countryFromDb.currentGdpPerCapita,  // ✅ Current value
}
```

**Editor Display Logic**:
- Uses `useCountryEditorData` hook
- Populates forms with:
  ```typescript
  const currentPop = Number(country.currentPopulation) || Number(country.baselinePopulation);
  const currentGdpPerCap = Number(country.currentGdpPerCapita) || Number(country.baselineGdpPerCapita);
  ```
- **Falls back to baseline if current values are missing**

### 3. Update Flow (`updateEconomicData` mutation)

**What gets updated**:
- Updates economic indicators (labor, fiscal, demographics, etc.)
- **DOES NOT update `currentPopulation`, `currentGdpPerCapita`, `currentTotalGdp`**
- Those values should only be updated by the calculation engine

## Identified Discrepancies

### Issue 1: Editor shows baseline, Frontend shows calculated
**Scenario**: User opens `/mycountry` and sees calculated values, then opens `/mycountry/editor` and sees different (baseline) values.

**Why**:
- Frontend uses `getByIdWithEconomicData` which calculates
- Editor uses `getByIdAtTime` which returns baseline for current time

### Issue 2: Inconsistent fallback logic
**Editor fallback**:
```typescript
currentPop = Number(country.currentPopulation) || Number(country.baselinePopulation)
```

**Frontend generation**:
```typescript
population: country.currentPopulation || country.baselinePopulation || 0
```

### Issue 3: No update path for current values
- Editor mutation only updates economic indicators
- Current values (currentPopulation, etc.) are orphaned
- Must be updated by calculation engine separately

## Recommended Fixes

### Fix 1: Unified Data Fetching
**Goal**: Both editor and frontend use same data source

**Solution**: Modify `getByIdAtTime` to always return calculated current values:

```typescript
getByIdAtTime: publicProcedure
  .query(async ({ ctx, input }) => {
    // Always calculate for current time, even if "isCurrentTime"
    const calculatedStats = calc.calculateTimeProgression(initialStats, targetTime, dmInputs);

    return {
      ...calculatedStats.newStats,
      currentPopulation: calculatedStats.newStats.currentPopulation,
      currentGdpPerCapita: calculatedStats.newStats.currentGdpPerCapita,
      currentTotalGdp: calculatedStats.newStats.currentTotalGdp,
    };
  });
```

### Fix 2: Editor Should Show Current Values
**Goal**: Editor displays what users see on frontend

**Solution**: Update `useCountryEditorData` to prioritize current values:

```typescript
// Use calculated current values, not baseline
inputs.coreIndicators = {
  totalPopulation: country.currentPopulation,  // Not baselinePopulation
  gdpPerCapita: country.currentGdpPerCapita,   // Not baselineGdpPerCapita
  nominalGDP: country.currentTotalGdp,          // Current total
};
```

### Fix 3: Clear Separation of Concerns
**Database fields**:
- `baseline*` fields = Initial starting point (never updated after creation)
- `current*` fields = Live calculated values (updated by calculation engine)
- Economic indicators = User-editable settings (updated by editor)

**Calculation Engine**:
- Reads baseline and economic indicators
- Calculates current values based on IxTime
- Writes to `current*` fields

**Editor**:
- Displays current values (read-only calculated display)
- Edits economic indicators (user inputs)
- Does NOT modify current values

### Fix 4: Update Mutation Clarity
**Current behavior**: Updates economic indicators only
**Recommended**: Add comment and validation

```typescript
updateEconomicData: privateProcedure
  .mutation(async ({ ctx, input }) => {
    // NOTE: This only updates economic indicators.
    // Current population, GDP, etc. are calculated by the engine.
    // Do not expect immediate changes to currentPopulation/currentGdpPerCapita.

    await ctx.db.country.update({
      where: { id: input.countryId },
      data: input.economicData  // Only indicators, not current values
    });
  });
```

## Implementation Priority

1. **HIGH**: Fix `getByIdAtTime` to return calculated values for current time
2. **HIGH**: Update `useCountryEditorData` to use `current*` fields, not `baseline*`
3. **MEDIUM**: Add validation to prevent direct updates to `current*` fields
4. **LOW**: Add documentation comments explaining field usage

## Testing Checklist

- [ ] Verify editor and frontend show same population
- [ ] Verify editor and frontend show same GDP/capita
- [ ] Verify editor and frontend show same total GDP
- [ ] Verify saving in editor doesn't break calculations
- [ ] Verify calculation engine updates current values
- [ ] Verify baseline values never change after creation

## Conclusion

The core issue is **two different API endpoints using different logic** for fetching country data. The fix is to standardize on **always using calculated current values** from the calculation engine, regardless of which API endpoint is called.
