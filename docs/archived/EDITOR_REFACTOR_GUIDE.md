# MyCountry Editor Refactor - Implementation Guide

## 🎯 Overview

This document outlines the comprehensive refactor of the MyCountry Editor to mirror the Builder's UI/UX and implement a sophisticated change scheduling system based on economic impact.

## ✅ Completed Components

### 1. Database Schema (✓ COMPLETE)
**File**: `prisma/schema.prisma`

Added `ScheduledChange` model to track delayed changes:
- `changeType`: instant, next_day, short_term, long_term
- `impactLevel`: none, low, medium, high
- `scheduledFor`: when change takes effect
- `status`: pending, applied, cancelled
- `warnings`: array of warning messages about the change

**Next Step**: Run migration
```bash
npx prisma migrate dev --name add_scheduled_changes
```

### 2. tRPC API Router (✓ COMPLETE)
**File**: `src/server/api/routers/scheduledChanges.ts`

Endpoints:
- `getPendingChanges` - Get user's pending changes
- `createScheduledChange` - Schedule a new change
- `cancelScheduledChange` - Cancel pending change
- `applyScheduledChange` - Apply a change (for cron)
- `applyDueChanges` - Bulk apply all due changes
- `getChangeHistory` - View past changes

**Integration**: Already added to `src/server/api/root.ts`

### 3. Change Impact Calculator (✓ COMPLETE)
**File**: `src/lib/change-impact-calculator.ts`

Features:
- Field-by-field impact mapping
- Automatic delay calculation based on impact
- Warning generation for risky changes
- Magnitude-based additional warnings

**Impact Levels**:
- **INSTANT** (none): Cosmetic changes (name, flag, symbols)
- **NEXT DAY** (low): Minor policy adjustments (exchange rate, government type)
- **3-5 DAYS** (medium): Significant changes (taxes, unemployment, budgets)
- **1 WEEK** (high): Major structural changes (GDP growth, inflation, economic tier)

### 4. Change Preview Dialog (✓ COMPLETE)
**File**: `src/app/mycountry/editor/components/ChangePreviewDialog.tsx`

Features:
- Grouped changes by impact level
- Expandable detail views
- Warning displays
- Color-coded impact indicators
- Delay explanations

### 5. National Identity Editor Section (✓ COMPLETE)
**File**: `src/app/mycountry/editor/sections/NationalIdentityEditorSection.tsx`

Sections:
- Basic Information (name, leader, government type)
- Geographic Information (continent, region, land area)
- Cultural Information (religion/philosophy)
- National Symbols (flag, coat of arms)

## 🚧 Next Steps to Complete

### Step 1: Update Existing Editor to Use New System

**File to Modify**: `src/app/mycountry/editor/page.tsx`

Current flow:
```
User edits → handleInputsChange → handleSave → Direct database update
```

New flow:
```
User edits → handleInputsChange (track changes) →
Review Changes → Calculate Impacts →
Create Scheduled Changes → Apply based on timing
```

### Step 2: Enhanced Editor Tabs Component

**File to Create**: `src/app/mycountry/editor/components/EnhancedEditorTabs.tsx`

Should include:
1. **National Identity Tab** (NEW)
   - Use `NationalIdentityEditorSection`
   - Instant changes

2. **Core Economics Tab**
   - Existing `CoreEconomicIndicators`
   - Add impact warnings

3. **Labor & Employment Tab**
   - Existing `LaborEmploymentSection`
   - Impact calculation

4. **Fiscal System & Taxes Tab**
   - Existing `FiscalSystemSection`
   - Tax builder integration
   - Medium impact warnings

5. **Government Structure Tab**
   - Existing `GovernmentBuilder`
   - Department management

6. **Demographics Tab**
   - Existing `DemographicsSection`
   - Population change warnings

7. **Advanced Settings Tab** (NEW)
   - Economic tier selection
   - Advanced growth factors
   - High-impact warnings

### Step 3: Change Tracking Hook

**File to Create**: `src/app/mycountry/editor/hooks/useChangeTracking.ts`

```typescript
export function useChangeTracking(original: EconomicInputs) {
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [current, setCurrent] = useState(original);

  function trackChange(field: string, newValue: unknown) {
    // Track change
    // Calculate impact
    // Update pending changes list
  }

  function getChanges() {
    return changes;
  }

  function clearChanges() {
    setChanges([]);
  }

  return { changes, trackChange, getChanges, clearChanges };
}
```

### Step 4: Scheduled Changes Display Component

**File to Create**: `src/app/mycountry/editor/components/ScheduledChangesPanel.tsx`

Features:
- Timeline view of pending changes
- Countdown timers
- Cancel pending changes
- Change history view
- Grouped by application date

### Step 5: Cron Job for Applying Changes

**File to Create**: `src/server/cron/apply-scheduled-changes.ts`

Should:
- Run every IxDay
- Call `scheduledChanges.applyDueChanges`
- Trigger recalculations for affected countries
- Log applications

**Integration**: Add to cron system or use Vercel Cron

### Step 6: Main Editor Page Refactor

**File to Modify**: `src/app/mycountry/editor/page.tsx`

New structure:
```tsx
<EditorPage>
  <EditorHeader />
  <EditorProgressIndicator /> {/* Like builder's step indicator */}

  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <div className="lg:col-span-3">
      <EnhancedEditorTabs>
        <NationalIdentityTab />
        <CoreEconomicsTab />
        <LaborTab />
        <FiscalTab />
        <GovernmentTab />
        <DemographicsTab />
        <AdvancedTab />
      </EnhancedEditorTabs>
    </div>

    <div className="lg:col-span-1">
      <ScheduledChangesPanel />
      <RealTimeFeedback />
    </div>
  </div>

  <EditorFooter
    onSave={handleSaveWithPreview}
    onCancel={handleCancel}
  />
</EditorPage>
```

### Step 7: Testing Checklist

- [ ] Create instant change (name, flag)
- [ ] Create low-impact change (government type)
- [ ] Create medium-impact change (tax rate)
- [ ] Create high-impact change (GDP growth)
- [ ] Verify warnings display correctly
- [ ] Test change cancellation
- [ ] Test bulk change application
- [ ] Verify recalculations trigger
- [ ] Test change history view

## 🎨 UI/UX Patterns from Builder to Implement

### 1. Step-Based Progress Indicator
- Shows which section user is editing
- Minimizes automatically
- Expands on hover
- Shows completion status

### 2. Glass Physics Design
- Hierarchical depth levels
- Frosted glass effects
- Smooth animations
- Contextual color theming

### 3. Sectioned Content Cards
- Each major category in its own card
- Gradient backgrounds matching theme
- Icon-based headers
- Expandable detail views

### 4. Impact Badges
- Color-coded by severity
- Instant = Green
- Low = Blue
- Medium = Yellow
- High = Red

### 5. Change Timeline
- Visual representation of when changes apply
- Countdown timers
- Grouped by date
- Interactive hover states

## 📊 Impact Level Examples

### Instant (None)
- Country name
- Flag URL
- Coat of arms
- Leader name
- Religion

### Next Day (Low)
- Government type
- Exchange rate
- Local growth factor

### 3-5 Days (Medium)
- Tax rates
- Unemployment rate
- Minimum wage
- Government budget
- Population policies

### 1 Week (High)
- Real GDP growth rate
- Inflation rate
- Population growth rate
- Economic tier
- Total debt ratio

## 🔄 Daily Recalculation System

### Current System
- Manual recalculation trigger
- Admin-only access

### Enhanced System
1. **Every IxDay**:
   - Apply due scheduled changes
   - Trigger affected country recalculations
   - Update vitality scores
   - Log changes

2. **Integration Points**:
   - `scheduledChanges.applyDueChanges()` - Apply changes
   - `countries.recalculate()` - Recalculate economics
   - `atomicGovernment.calculateEffectiveness()` - Update effectiveness
   - Create notification for user

## 💡 Additional Features to Consider

### 1. Change Templates
- Save common change sets
- "Economic Stimulus Package"
- "Austerity Measures"
- "Development Initiative"

### 2. Impact Simulation
- Preview long-term effects
- "What if" scenarios
- Projected outcomes

### 3. Change Recommendations
- AI-suggested improvements
- Based on current state
- Aligned with user goals

### 4. Multiplayer Coordination
- See other countries' pending changes
- Coordinate regional policies
- Trade agreement impacts

### 5. Historical Comparison
- Compare to past versions
- Rollback capability
- Change audit trail

## 🚀 Deployment Checklist

- [ ] Run Prisma migration
- [ ] Update tRPC client types
- [ ] Test all API endpoints
- [ ] Set up cron job
- [ ] Update user documentation
- [ ] Create tutorial/walkthrough
- [ ] Monitor error rates
- [ ] Gather user feedback

## 📝 Code Examples

### Creating a Scheduled Change
```typescript
const createChange = api.scheduledChanges.createScheduledChange.useMutation();

await createChange.mutateAsync({
  countryId: country.id,
  changeType: "long_term",
  impactLevel: "high",
  fieldPath: "realGDPGrowthRate",
  oldValue: JSON.stringify(5.0),
  newValue: JSON.stringify(7.5),
  scheduledFor: addDays(new Date(), 7),
  warnings: [
    "Major economic restructuring required",
    "Market confidence adjustment needed"
  ],
  metadata: {
    category: "Core Economics",
    fieldLabel: "Real GDP Growth Rate"
  }
});
```

### Applying Changes (Cron)
```typescript
// In cron job
const result = await trpc.scheduledChanges.applyDueChanges();
console.log(`Applied ${result.appliedCount} changes`);

// Trigger recalculations for affected countries
for (const changeId of result.appliedChanges) {
  const change = await db.scheduledChange.findUnique({
    where: { id: changeId }
  });
  await trpc.countries.recalculate({ id: change.countryId });
}
```

## 🎓 Learning Resources

- Builder Pattern: `src/app/builder/components/enhanced/AtomicBuilderPageEnhanced.tsx`
- Change Impact Logic: `src/lib/change-impact-calculator.ts`
- Scheduled Changes API: `src/server/api/routers/scheduledChanges.ts`
- Preview Dialog: `src/app/mycountry/editor/components/ChangePreviewDialog.tsx`

## 🐛 Common Issues & Solutions

### Issue: Changes not applying
**Solution**: Check cron job is running, verify scheduledFor date

### Issue: Warnings not showing
**Solution**: Verify field path in FIELD_IMPACT_MAP

### Issue: Impact level incorrect
**Solution**: Update field mapping in change-impact-calculator.ts

### Issue: Recalculations not triggering
**Solution**: Ensure applyDueChanges calls recalculate for each country

## 📞 Support

For questions or issues:
1. Check this guide
2. Review existing code examples
3. Test with dummy data first
4. Document any new patterns

---

**Status**: 🟡 In Progress - Core infrastructure complete, UI integration needed
**Priority**: 🔴 High - Critical feature for user experience
**Estimated Completion**: 2-3 days of focused development
