# Component Consolidation Migration Guide v1.1.0

## Overview

This guide provides step-by-step instructions for migrating from builder-specific primitives to the unified shared component library as part of the v1.1.0 refactoring initiative.

**Target Audience:** Developers working on IxStats codebase
**Version:** 1.1.0
**Status:** Active Migration (Q4 2025)

---

## Table of Contents

1. [Component Mapping Reference](#component-mapping-reference)
2. [Import Path Updates](#import-path-updates)
3. [Migration Examples](#migration-examples)
4. [Breaking Changes](#breaking-changes)
5. [Testing Migration Changes](#testing-migration-changes)
6. [Rollback Procedures](#rollback-procedures)
7. [FAQ](#faq)

---

## Component Mapping Reference

### Error Handling Components

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| `BuilderErrorBoundary` | `UnifiedErrorBoundary` | Use `context="builder"` prop |
| `GovernmentBuilderError` | `UnifiedErrorBoundary` | Use `context="government"` prop |
| `DashboardErrorBoundary` | `UnifiedErrorBoundary` | Use `context="dashboard"` prop |
| `ErrorDisplay` | `UnifiedErrorBoundary.Display` | Named export for presentation only |

**Migration Priority:** Week 1-2 (Priority 1)

### Data Display Components

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| `builder/primitives/enhanced/MetricCard` | `shared/data-display/MetricCard` | Use `variant="builder"` for builder styling |
| `shared/data-display/MetricCard` (old) | `shared/data-display/MetricCard` (new) | Feature-merged version |
| Custom metric cards | `shared/data-display/MetricCard` | Use variant prop for customization |

**Migration Priority:** Week 2-3 (Priority 1)

### Form Input Components

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| `EnhancedNumberInput` | `UnifiedInput` | Use `type="number"` + `enhanced` prop |
| `EnhancedSelector` | `UnifiedSelect` | Enhanced styling built-in |
| `ValidatedInput` | `UnifiedInput` | Validation via `schema` prop |
| `ValidatedSelect` | `UnifiedSelect` | Validation via `schema` prop |
| `ValidatedSlider` | `UnifiedSlider` | Unchanged import path |

**Migration Priority:** Week 3-4 (Priority 1)

### Feedback Components

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| Inline loading spinners | `LoadingState` | Use `variant="inline"` |
| `LoadingFallback` | `LoadingState` | Use `variant="fullpage"` |
| Skeleton loaders | `LoadingState` | Use `variant="skeleton"` |

**Migration Priority:** Week 5-6 (Priority 2)

### Layout Components

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| `EconomyBuilderModal` | `Modal` + composition | See modal composition guide |
| `EconomicArchetypeModal` | `Modal` + composition | See modal composition guide |
| `glass/SectionBase` | `shared/layouts/SectionWrapper` | Glass physics features merged |
| Custom section wrappers | `shared/layouts/SectionWrapper` | Use variant prop |
| `BuilderTabs` | `TabbedContent` | Enhanced version |
| `CountryTabs` | `TabbedContent` | Enhanced version |

**Migration Priority:** Week 6-8 (Priority 2)

### Visualization Components

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| Custom bar charts | `shared/charts/BarChart` | Standardized config |
| Custom line charts | `shared/charts/LineChart` | Standardized config |
| Intelligence charts | `shared/charts/*` | See charts library guide |

**Migration Priority:** Week 9-10 (Priority 3)

### Specialized Components

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| Custom flag displays | `shared/data-display/CountryFlag` | With loading states |
| Flag service calls | `useCountryFlagRouteAware` hook | Enhanced caching |

**Migration Priority:** Week 11-12 (Priority 3)

---

## Import Path Updates

### Pattern 1: ErrorBoundary Migration

**Before:**
```typescript
import { BuilderErrorBoundary } from '@/app/builder/components/BuilderErrorBoundary';

<BuilderErrorBoundary>
  <YourComponent />
</BuilderErrorBoundary>
```

**After:**
```typescript
import { UnifiedErrorBoundary } from '@/components/shared/feedback/UnifiedErrorBoundary';

<UnifiedErrorBoundary context="builder">
  <YourComponent />
</UnifiedErrorBoundary>
```

**Context Options:** `'builder' | 'government' | 'dashboard' | 'general'`

---

### Pattern 2: MetricCard Migration

**Before (Builder Primitive):**
```typescript
import { MetricCard } from '@/app/builder/primitives/enhanced/MetricCard';

<MetricCard
  title="GDP"
  value={gdpValue}
  format="currency"
  trend={5.2}
  className="custom-class"
/>
```

**After (Shared Library):**
```typescript
import { MetricCard } from '@/components/shared/data-display/MetricCard';

<MetricCard
  title="GDP"
  value={gdpValue}
  format="currency"
  trend={5.2}
  variant="builder" // Preserves builder styling
  className="custom-class"
/>
```

**Variant Options:** `'default' | 'builder' | 'compact' | 'detailed'`

---

### Pattern 3: Input Component Migration

**Before (Enhanced Input):**
```typescript
import { EnhancedNumberInput } from '@/app/builder/primitives/enhanced/EnhancedNumberInput';

<EnhancedNumberInput
  label="Population"
  value={population}
  onChange={setPopulation}
  min={0}
  max={1000000000}
  format="number"
/>
```

**After (Unified Input):**
```typescript
import { UnifiedInput } from '@/components/shared/forms/UnifiedInput';

<UnifiedInput
  type="number"
  label="Population"
  value={population}
  onChange={setPopulation}
  min={0}
  max={1000000000}
  format="number"
  enhanced // Enables glass physics styling
/>
```

**Before (Validated Input):**
```typescript
import { ValidatedInput } from '@/components/shared/forms/ValidatedInput';
import { z } from 'zod';

const schema = z.string().min(3).max(50);

<ValidatedInput
  label="Country Name"
  value={name}
  onChange={setName}
  schema={schema}
/>
```

**After (Unified Input):**
```typescript
import { UnifiedInput } from '@/components/shared/forms/UnifiedInput';
import { z } from 'zod';

const schema = z.string().min(3).max(50);

<UnifiedInput
  type="text"
  label="Country Name"
  value={name}
  onChange={setName}
  schema={schema} // Validation automatically applied
  enhanced // Optional: add enhanced styling
/>
```

---

### Pattern 4: Loading State Migration

**Before (Inline Spinner):**
```typescript
{isLoading && <div className="spinner">Loading...</div>}
{!isLoading && <YourContent />}
```

**After (Standardized Loading):**
```typescript
import { LoadingState } from '@/components/shared/feedback/LoadingState';

{isLoading ? (
  <LoadingState variant="inline" message="Loading economic data..." />
) : (
  <YourContent />
)}
```

**Before (Full Page Loading):**
```typescript
import { LoadingFallback } from '@/app/builder/components/LoadingFallback';

{isLoading && <LoadingFallback />}
```

**After (Standardized Loading):**
```typescript
import { LoadingState } from '@/components/shared/feedback/LoadingState';

{isLoading && <LoadingState variant="fullpage" message="Loading builder..." />}
```

**Variant Options:** `'inline' | 'fullpage' | 'skeleton' | 'spinner'`

---

### Pattern 5: Modal Migration

**Before (Custom Modal):**
```typescript
import { EconomyBuilderModal } from '@/app/builder/components/enhanced/EconomyBuilderModal';

<EconomyBuilderModal
  isOpen={isOpen}
  onClose={onClose}
  title="Economy Builder"
>
  <ModalContent />
</EconomyBuilderModal>
```

**After (Composable Modal):**
```typescript
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter
} from '@/components/shared/layouts/Modal';
import { Button } from '@/components/ui/button';

<Modal open={isOpen} onClose={onClose} size="lg">
  <ModalHeader title="Economy Builder" />
  <ModalBody>
    <ModalContent />
  </ModalBody>
  <ModalFooter>
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button onClick={handleSave}>Save Changes</Button>
  </ModalFooter>
</Modal>
```

**Size Options:** `'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'`

---

### Pattern 6: Section Component Migration

**Before (Builder SectionBase):**
```typescript
import { SectionBase } from '@/app/builder/components/glass/SectionBase';

<SectionBase
  title="Economic Indicators"
  icon={<ChartIcon />}
  collapsible
>
  <SectionContent />
</SectionBase>
```

**After (Shared SectionWrapper):**
```typescript
import { Section, SectionHeader, SectionContent } from '@/components/shared/layouts/SectionWrapper';
import { ChartIcon } from 'lucide-react';

<Section variant="glass" collapsible>
  <SectionHeader icon={<ChartIcon />} title="Economic Indicators" />
  <SectionContent>
    <YourContent />
  </SectionContent>
</Section>
```

**Variant Options:** `'default' | 'glass' | 'bordered' | 'elevated'`

---

### Pattern 7: Chart Component Migration

**Before (Custom Chart):**
```typescript
import { RechartsIntegration } from '@/components/charts/RechartsIntegration';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';

<RechartsIntegration>
  <BarChart data={data}>
    <XAxis dataKey="name" />
    <YAxis />
    <Bar dataKey="value" fill="#8884d8" />
  </BarChart>
</RechartsIntegration>
```

**After (Shared Chart Library):**
```typescript
import { BarChart } from '@/components/shared/charts/BarChart';

<BarChart
  data={data}
  xKey="name"
  yKey="value"
  theme="economic" // Auto-applies section colors
  tooltip={{ enabled: true }}
  responsive
/>
```

**Theme Options:** `'economic' | 'diplomatic' | 'intelligence' | 'default'`

---

### Pattern 8: Tabbed Interface Migration

**Before (Custom Tabs):**
```typescript
import { BuilderTabs } from '@/app/builder/components/enhanced/BuilderTabs';

<BuilderTabs
  tabs={[
    { id: 'overview', label: 'Overview', content: <Overview /> },
    { id: 'details', label: 'Details', content: <Details /> }
  ]}
  defaultTab="overview"
/>
```

**After (Shared TabbedContent):**
```typescript
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@/components/shared/layouts/TabbedContent';

<Tabs defaultTab="overview" variant="pills">
  <TabList>
    <Tab id="overview">Overview</Tab>
    <Tab id="details" badge={5}>Details</Tab>
  </TabList>
  <TabPanels>
    <TabPanel id="overview"><Overview /></TabPanel>
    <TabPanel id="details"><Details /></TabPanel>
  </TabPanels>
</Tabs>
```

**Variant Options:** `'default' | 'pills' | 'underline' | 'bordered'`

---

### Pattern 9: Flag Display Migration

**Before (Direct Service Call):**
```typescript
import { countryFlagService } from '@/lib/country-flag-service';

const flagUrl = await countryFlagService.getCountryFlag(countrySlug);

<img src={flagUrl} alt={countryName} className="w-8 h-8" />
```

**After (Component + Hook):**
```typescript
import { CountryFlag } from '@/components/shared/data-display/CountryFlag';

<CountryFlag
  countrySlug={countrySlug}
  countryName={countryName}
  size="md"
  showFallback
/>
```

**Size Options:** `'xs' | 'sm' | 'md' | 'lg' | 'xl'`

---

## Breaking Changes

### 1. ErrorBoundary Props Changes

**Breaking:** `BuilderErrorBoundary` no longer exists as standalone component

**Migration:**
```typescript
// OLD
import { BuilderErrorBoundary } from '@/app/builder/components/BuilderErrorBoundary';
<BuilderErrorBoundary fallback={<CustomFallback />}>

// NEW
import { UnifiedErrorBoundary } from '@/components/shared/feedback/UnifiedErrorBoundary';
<UnifiedErrorBoundary context="builder" fallback={<CustomFallback />}>
```

**Impact:** 21 files
**Timeline:** Week 1-2

---

### 2. MetricCard Variant Requirement

**Breaking:** Default styling changed, builder style requires explicit variant

**Migration:**
```typescript
// OLD (builder primitive - auto-applied glass physics)
import { MetricCard } from '@/app/builder/primitives/enhanced/MetricCard';
<MetricCard title="GDP" value={gdp} />

// NEW (must specify variant for builder styling)
import { MetricCard } from '@/components/shared/data-display/MetricCard';
<MetricCard title="GDP" value={gdp} variant="builder" />
```

**Impact:** 47 files
**Timeline:** Week 2-3

---

### 3. Input Component API Changes

**Breaking:** `EnhancedNumberInput` merged into `UnifiedInput`, requires type prop

**Migration:**
```typescript
// OLD
import { EnhancedNumberInput } from '@/app/builder/primitives/enhanced/EnhancedNumberInput';
<EnhancedNumberInput label="Population" value={pop} onChange={setPop} />

// NEW
import { UnifiedInput } from '@/components/shared/forms/UnifiedInput';
<UnifiedInput type="number" label="Population" value={pop} onChange={setPop} enhanced />
```

**Impact:** 28 files
**Timeline:** Week 3-4

---

### 4. Modal Composition Pattern

**Breaking:** Pre-built modals replaced with composition pattern

**Migration:**
```typescript
// OLD (pre-built modal)
<EconomyBuilderModal isOpen={open} onClose={close} title="Title">
  <Content />
</EconomyBuilderModal>

// NEW (composition pattern)
<Modal open={open} onClose={close}>
  <ModalHeader title="Title" />
  <ModalBody><Content /></ModalBody>
  <ModalFooter>
    <Button onClick={close}>Close</Button>
  </ModalFooter>
</Modal>
```

**Impact:** 15 files
**Timeline:** Week 6-7

---

### 5. Section Component Structure

**Breaking:** `SectionBase` component API changed to composition pattern

**Migration:**
```typescript
// OLD
<SectionBase title="Title" icon={icon} collapsible>
  <Content />
</SectionBase>

// NEW
<Section variant="glass" collapsible>
  <SectionHeader icon={icon} title="Title" />
  <SectionContent><Content /></SectionContent>
</Section>
```

**Impact:** 40 files
**Timeline:** Week 7-8

---

### 6. Chart Configuration Props

**Breaking:** Chart components now use simplified prop API

**Migration:**
```typescript
// OLD (Recharts direct usage)
<BarChart data={data}>
  <XAxis dataKey="name" />
  <YAxis />
  <Bar dataKey="value" fill="#8884d8" />
  <Tooltip />
</BarChart>

// NEW (simplified API)
<BarChart
  data={data}
  xKey="name"
  yKey="value"
  theme="economic"
  tooltip
/>
```

**Impact:** 30 files
**Timeline:** Week 9-10

---

## Testing Migration Changes

### Pre-Migration Checklist
- [ ] Read component mapping for target component
- [ ] Review breaking changes section
- [ ] Identify all usage instances (use grep/search)
- [ ] Create feature branch: `refactor/consolidate-[component-name]`
- [ ] Backup current implementation (git stash if needed)

### Migration Testing Steps

#### 1. Visual Regression Testing
```bash
# Run Playwright visual tests
npm run test:visual

# Compare screenshots before/after
npm run test:visual:compare
```

#### 2. Component Functionality Testing
```typescript
// Example test for MetricCard migration
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/components/shared/data-display/MetricCard';

describe('MetricCard Migration', () => {
  it('renders with builder variant', () => {
    render(
      <MetricCard
        title="GDP"
        value={1000000000}
        format="currency"
        variant="builder"
        trend={5.2}
      />
    );

    expect(screen.getByText('GDP')).toBeInTheDocument();
    expect(screen.getByText(/1[.,]000[.,]000[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/5\.2%/)).toBeInTheDocument();
  });
});
```

#### 3. Integration Testing
```bash
# Run relevant E2E tests
npm run test:e2e -- builder-country-from-scratch.spec.ts

# Verify builder workflows still function
npm run test:e2e -- government-builder.spec.ts
npm run test:e2e -- tax-builder-basic.spec.ts
```

#### 4. Manual Testing Checklist
- [ ] Visual appearance matches original (or documented changes)
- [ ] All interactions work (clicks, hovers, keyboard navigation)
- [ ] Accessibility maintained (screen reader, keyboard nav)
- [ ] Glass physics effects render correctly
- [ ] Responsive behavior works (mobile, tablet, desktop)
- [ ] Error states display properly
- [ ] Loading states transition correctly

### Post-Migration Validation
- [ ] All tests pass (`npm run test`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Bundle size unchanged or reduced
- [ ] No console errors in development

---

## Rollback Procedures

### Immediate Rollback (During Development)

**If migration breaks functionality:**

```bash
# Stash current changes
git stash save "WIP: MetricCard migration - reverting"

# Return to previous working state
git checkout main
git pull origin main

# Review what went wrong
git stash show -p
```

### Partial Rollback (Keep Some Changes)

```bash
# Cherry-pick specific files to revert
git checkout HEAD -- src/app/builder/sections/CoreIndicatorsSection.tsx

# Or use interactive rebase
git rebase -i HEAD~5
# Mark problematic commits as 'drop' or 'edit'
```

### Feature Flag Rollback (Production)

**New components support feature flag fallback:**

```typescript
// components/shared/data-display/MetricCard.tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function MetricCard(props) {
  const useNewMetricCard = useFeatureFlag('unified-metric-card');

  if (!useNewMetricCard) {
    // Fallback to old implementation (deprecated but functional)
    return <LegacyMetricCard {...props} />;
  }

  return <NewMetricCard {...props} />;
}
```

**Toggle feature flag:**
```typescript
// lib/feature-flags.ts
export const FEATURE_FLAGS = {
  'unified-metric-card': process.env.NEXT_PUBLIC_USE_UNIFIED_METRIC_CARD === 'true',
  'unified-error-boundary': process.env.NEXT_PUBLIC_USE_UNIFIED_ERROR_BOUNDARY === 'true',
};
```

### Version Rollback (Emergency)

**If entire release needs rollback:**

```bash
# Tag before refactoring for safety
git tag pre-refactor-v1.0.6

# If rollback needed, restore tag
git checkout pre-refactor-v1.0.6
git checkout -b rollback/v1.1.0-failed
npm install
npm run build
npm run start:prod
```

---

## FAQ

### Q: Can I use both old and new components during migration?
**A:** Yes, for 2 releases (v1.1 and v1.2), old components will remain functional but deprecated. Console warnings will remind you to migrate.

### Q: What if the new component doesn't support my use case?
**A:** File an issue with details. Critical use cases will be added to the unified component. Temporary workarounds may use the old component.

### Q: How do I know which variant to use?
**A:**
- `variant="builder"` - Use in builder sections for glass physics styling
- `variant="default"` - Use in dashboard/general areas
- `variant="compact"` - Use in space-constrained areas (mobile, sidebars)
- `variant="detailed"` - Use for primary data displays requiring emphasis

### Q: Will migration affect performance?
**A:** No, performance should improve or stay neutral due to:
- Better tree-shaking with unified imports
- Shared component caching
- Reduced bundle duplication

### Q: What if tests fail after migration?
**A:**
1. Check breaking changes section for API changes
2. Update test snapshots if visual changes are intentional: `npm run test -- -u`
3. Verify prop mappings match new component API
4. Review console warnings for deprecation notices

### Q: Can I migrate one file at a time?
**A:** Yes, gradual migration is recommended. Both old and new components coexist during transition period.

### Q: How do I handle custom styling on old components?
**A:**
- Check if new component variant supports your style
- Use `className` prop for additional custom styles
- Consider if custom style should be added as new variant

### Q: What's the timeline for removing old components?
**A:**
- v1.1.0 (Q4 2025): New components released, old components deprecated
- v1.2.0 (Q1 2026): Old components still functional with warnings
- v1.3.0 (Q2 2026): Old components removed (breaking change)

### Q: How do I migrate a complex custom implementation?
**A:**
1. Review component composition patterns (Modal, Section examples)
2. Check if composition of multiple new components achieves goal
3. If truly custom, extend shared component with specialized variant
4. Document new pattern for team reference

### Q: What if I find a bug in the new component?
**A:**
1. Verify it's not a migration issue (check props, imports)
2. Check if bug exists in old component too
3. File issue with reproduction steps
4. Use feature flag to temporarily disable if critical

---

## Additional Resources

- **Refactoring Plan:** `/docs/REFACTORING_PLAN_V1.1.md`
- **Governance:** `/docs/SINGLE_SOURCE_OF_TRUTH.md`
- **Design Framework:** `/docs/DESIGN_SYSTEM.md`
- **Component Storybook:** `http://localhost:6006` (run `npm run storybook`)
- **Migration Support:** #ixstats-refactoring Slack channel

---

**Document Version:** 1.1.0
**Last Updated:** October 2025
**Maintainer:** Development Team
**Questions:** File issue or ask in #ixstats-refactoring
