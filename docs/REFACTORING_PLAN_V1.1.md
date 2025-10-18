# IxStats Refactoring Plan v1.1.0

## Executive Summary

**Version:** 1.1.0
**Status:** Planning Phase
**Timeline:** 12 weeks (Q4 2025)
**Goal:** Consolidate duplicate components and establish single source of truth

### Current State Analysis
- **Total Duplicate Lines:** ~1,605 lines across components
- **Shared Library Adoption:** 2% (critically low)
- **Dual Design Systems:** Builder primitives + shared library coexistence
- **Maintenance Burden:** High - changes require updates in multiple locations
- **Developer Confusion:** Unclear which component system to use

### Target State (v1.1.0)
- **Shared Library Adoption:** 80%+ across codebase
- **Duplicate Lines:** <200 (maintenance-level duplication only)
- **Single Design System:** Unified component library with clear usage guidelines
- **Maintenance Burden:** Low - single update point for common patterns
- **Developer Experience:** Clear component selection with comprehensive documentation

---

## Priority 1: Critical Consolidations (Weeks 1-4)

### 1.1 ErrorBoundary Unification
**Current State:** 4 separate implementations
- `/src/app/builder/components/BuilderErrorBoundary.tsx` (builder-specific)
- `/src/app/builder/components/GovernmentBuilderError.tsx` (government-specific)
- `/src/components/shared/feedback/ErrorDisplay.tsx` (presentation only)
- `/src/components/shared/feedback/DashboardErrorBoundary.tsx` (dashboard-specific)

**Target:** Single unified ErrorBoundary with context variants

**Timeline:** Week 1-2

**Implementation Steps:**
1. Create `/src/components/shared/feedback/UnifiedErrorBoundary.tsx`
   - Support context prop: 'builder' | 'dashboard' | 'government' | 'general'
   - Preserve all existing error recovery mechanisms
   - Add error reporting to monitoring service
   - Include user-friendly error messages per context

2. Create context-specific wrappers (optional convenience exports)
   ```typescript
   export const BuilderErrorBoundary = (props) => (
     <UnifiedErrorBoundary context="builder" {...props} />
   );
   ```

3. Migrate all usage points (21 files estimated)
   - Replace imports progressively
   - Test error scenarios in each context
   - Verify error recovery flows

4. Remove old implementations after migration complete

**Success Metrics:**
- All 4 implementations consolidated into 1
- Zero regression in error handling behavior
- 200+ lines eliminated

---

### 1.2 MetricCard Consolidation
**Current State:** 2 separate implementations
- `/src/app/builder/primitives/enhanced/MetricCard.tsx` (builder variant)
- `/src/components/shared/data-display/MetricCard.tsx` (shared variant)

**Target:** Single MetricCard in shared library with variant support

**Timeline:** Week 2-3

**Implementation Steps:**
1. Analyze usage patterns across 47 instances
   - Document all prop variations
   - Identify builder-specific features
   - Map glass physics requirements

2. Create unified `/src/components/shared/data-display/MetricCard.tsx`
   - Merge all features from both implementations
   - Support variants: 'default' | 'builder' | 'compact' | 'detailed'
   - Preserve glass physics integration
   - Add Storybook documentation

3. Progressive migration (high-risk areas first)
   - Dashboard components (12 instances)
   - Builder sections (35 instances)
   - Verify visual consistency

4. Remove builder primitive version

**Success Metrics:**
- 47 usage points standardized
- 150+ duplicate lines eliminated
- Visual parity maintained

---

### 1.3 Input Component Unification
**Current State:** Dual systems with overlap
- Enhanced inputs: `/src/app/builder/primitives/enhanced/EnhancedNumberInput.tsx`, `EnhancedSelector.tsx`
- Validated inputs: `/src/components/shared/forms/ValidatedInput.tsx`, `ValidatedSelect.tsx`, `ValidatedSlider.tsx`

**Target:** Unified input system with validation + enhancement features

**Timeline:** Week 3-4

**Implementation Steps:**
1. Create unified form component library
   ```
   /src/components/shared/forms/
   ├── UnifiedInput.tsx (text, number, email, etc.)
   ├── UnifiedSelect.tsx (dropdown with search)
   ├── UnifiedSlider.tsx (range with labels)
   └── form-utils.ts (validation, formatting)
   ```

2. Merge validation logic + enhanced styling
   - Zod schema integration from validated components
   - Glass physics styling from enhanced components
   - Animation utilities preserved
   - Accessibility features from both systems

3. Create migration guide with examples
   - Before/after code samples
   - Validation pattern updates
   - Styling class migrations

4. Migrate builder sections (28 files estimated)
   - Government builder forms
   - Economic customization inputs
   - Tax system configurators

5. Deprecate old components with console warnings

**Success Metrics:**
- 28 form-heavy files migrated
- 300+ duplicate lines eliminated
- Validation + enhancement features combined

---

## Priority 2: Pattern Standardization (Weeks 5-8)

### 2.1 Loading Pattern Standardization
**Current State:** Inconsistent loading states across components
- Inline loading spinners (various implementations)
- LoadingFallback component (builder-specific)
- LoadingState component (shared, underutilized)

**Target:** Single loading pattern with context awareness

**Timeline:** Week 5-6

**Implementation Steps:**
1. Audit all loading patterns (estimated 80+ instances)
   - Document current implementations
   - Identify full-page vs inline vs skeleton patterns

2. Enhance `/src/components/shared/feedback/LoadingState.tsx`
   - Add variants: 'fullpage' | 'inline' | 'skeleton' | 'spinner'
   - Support custom loading messages
   - Add glass physics integration
   - Include progress indicators for long operations

3. Create loading hooks for common patterns
   ```typescript
   const { isLoading, LoadingComponent } = useLoadingState({
     variant: 'skeleton',
     message: 'Loading economic data...'
   });
   ```

4. Migrate high-visibility areas first
   - Dashboard loading states
   - Builder section loading
   - Country page loading

**Success Metrics:**
- 80+ loading states standardized
- Consistent UX across platform
- 200+ lines consolidated

---

### 2.2 Modal System Creation
**Current State:** Duplicate modal implementations
- EconomyBuilderModal, EconomicArchetypeModal (builder)
- Government preview modals (scattered)
- Custom modal implementations (various)

**Target:** Reusable modal system with composition patterns

**Timeline:** Week 6-7

**Implementation Steps:**
1. Create `/src/components/shared/layouts/Modal.tsx`
   - Base modal with glass physics styling
   - Support sizes: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'
   - Animation transitions
   - Keyboard navigation (ESC to close)
   - Focus trap for accessibility

2. Create modal composition components
   ```typescript
   <Modal open={open} onClose={onClose}>
     <ModalHeader title="Economy Builder" />
     <ModalBody>{content}</ModalBody>
     <ModalFooter>
       <Button variant="ghost" onClick={onClose}>Cancel</Button>
       <Button onClick={onSave}>Save</Button>
     </ModalFooter>
   </Modal>
   ```

3. Migrate existing modals (15+ instances)
   - Builder modals first
   - Preview modals
   - Confirmation dialogs

4. Add modal management hook
   ```typescript
   const { isOpen, open, close, toggle } = useModal();
   ```

**Success Metrics:**
- 15+ modals consolidated
- Consistent modal UX
- 250+ duplicate lines eliminated

---

### 2.3 Section Component Consolidation
**Current State:** Duplicate section wrappers
- `/src/app/builder/components/glass/SectionBase.tsx` (builder)
- `/src/components/shared/layouts/SectionWrapper.tsx` (shared)
- Custom section implementations across builders

**Target:** Single section component system

**Timeline:** Week 7-8

**Implementation Steps:**
1. Enhance `/src/components/shared/layouts/SectionWrapper.tsx`
   - Merge glass physics features from SectionBase
   - Add collapsible functionality
   - Support section variants: 'default' | 'glass' | 'bordered' | 'elevated'
   - Include header/footer composition slots

2. Create section composition patterns
   ```typescript
   <Section variant="glass" collapsible title="Economic Indicators">
     <SectionHeader>
       <SectionTitle>GDP Overview</SectionTitle>
       <SectionActions><Button>Edit</Button></SectionActions>
     </SectionHeader>
     <SectionContent>{children}</SectionContent>
   </Section>
   ```

3. Migrate builder sections (40+ instances)
   - Government structure sections
   - Economic customization sections
   - Tax system sections

**Success Metrics:**
- 40+ sections standardized
- Consistent section styling
- 300+ duplicate lines eliminated

---

## Priority 3: Advanced Consolidations (Weeks 9-12)

### 3.1 Chart Components Library
**Current State:** Scattered chart implementations
- RechartsIntegration component (base)
- Intelligence charts (country intelligence)
- Builder charts (economy preview)
- Dashboard charts (various)

**Target:** Centralized chart library with consistent styling

**Timeline:** Week 9-10

**Implementation Steps:**
1. Create `/src/components/shared/charts/` library
   ```
   /src/components/shared/charts/
   ├── BarChart.tsx
   ├── LineChart.tsx
   ├── PieChart.tsx
   ├── AreaChart.tsx
   ├── ComposedChart.tsx
   ├── chartConfig.ts (colors, themes)
   ├── chartUtils.ts (formatting, tooltips)
   └── index.ts
   ```

2. Extract and standardize chart configurations
   - Color schemes per section theme
   - Tooltip formatting utilities
   - Responsive sizing logic
   - Glass physics integration

3. Migrate existing charts (30+ instances)
   - Intelligence dashboards
   - Economic preview charts
   - SDI/ECI visualizations

**Success Metrics:**
- 30+ charts migrated
- Consistent data visualization
- 200+ duplicate lines eliminated

---

### 3.2 Tabbed Interface System
**Current State:** Multiple tab implementations
- BuilderTabs, CountryTabs (custom)
- TabbedContent (shared, underutilized)
- Inline tab implementations

**Target:** Single tabbed interface system

**Timeline:** Week 10-11

**Implementation Steps:**
1. Enhance `/src/components/shared/layouts/TabbedContent.tsx`
   - Add variants: 'default' | 'pills' | 'underline' | 'bordered'
   - Support icon tabs
   - Add tab badges (notifications, counts)
   - Keyboard navigation (arrow keys)

2. Create tabs composition API
   ```typescript
   <Tabs defaultTab="overview" variant="pills">
     <TabList>
       <Tab id="overview" icon={<HomeIcon />}>Overview</Tab>
       <Tab id="economy" badge={3}>Economy</Tab>
     </TabList>
     <TabPanels>
       <TabPanel id="overview">{content}</TabPanel>
       <TabPanel id="economy">{content}</TabPanel>
     </TabPanels>
   </Tabs>
   ```

3. Migrate existing tab interfaces (20+ instances)
   - Builder navigation tabs
   - Country page tabs
   - Dashboard sections

**Success Metrics:**
- 20+ tab interfaces standardized
- Consistent navigation UX
- 150+ duplicate lines eliminated

---

### 3.3 Flag Display Standardization
**Current State:** Inconsistent flag rendering
- useCountryFlagRouteAware hook
- Direct flag service calls
- Various flag display components

**Target:** Unified flag component system

**Timeline:** Week 11-12

**Implementation Steps:**
1. Create `/src/components/shared/data-display/CountryFlag.tsx`
   - Support sizes: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
   - Loading states with skeleton
   - Fallback to initials on error
   - Lazy loading for lists
   - Glass physics border styling

2. Enhance useCountryFlagRouteAware hook
   - Cache optimization
   - Prefetch on hover
   - Batch loading for lists

3. Migrate all flag displays (50+ instances)
   - Country selectors
   - Diplomatic displays
   - Dashboard cards

**Success Metrics:**
- 50+ flag displays standardized
- Consistent visual treatment
- Improved loading performance

---

## Weekly Breakdown

### Week 1-2: ErrorBoundary + Setup
- Day 1-2: Audit all ErrorBoundary implementations
- Day 3-5: Create UnifiedErrorBoundary with context support
- Day 6-8: Migrate high-traffic areas (Dashboard, Builder home)
- Day 9-10: Complete migration, remove old implementations

### Week 3-4: MetricCard + Inputs
- Day 1-2: Analyze MetricCard usage patterns
- Day 3-5: Create unified MetricCard with variants
- Day 6-8: Migrate MetricCard instances
- Day 9-10: Unify input components (Enhanced + Validated)

### Week 5-6: Loading + Modals Start
- Day 1-2: Audit loading patterns
- Day 3-5: Create standardized LoadingState variants
- Day 6-8: Migrate loading states
- Day 9-10: Begin modal system creation

### Week 7-8: Modals + Sections
- Day 1-2: Complete modal system
- Day 3-5: Migrate existing modals
- Day 6-8: Consolidate section components
- Day 9-10: Migrate builder sections

### Week 9-10: Charts Library
- Day 1-2: Audit chart implementations
- Day 3-5: Create centralized chart library
- Day 6-8: Migrate intelligence charts
- Day 9-10: Migrate builder/dashboard charts

### Week 11-12: Tabs + Flags + Finalization
- Day 1-2: Enhance tabbed interface system
- Day 3-5: Migrate tab implementations
- Day 6-8: Standardize flag displays
- Day 9-10: Final testing, documentation, release

---

## Impact Assessment

### Maintenance Burden Reduction
**Before:**
- Update MetricCard: 2 files + 47 usage points to verify
- Update ErrorBoundary: 4 files + 21 usage points
- Update form inputs: 5 files + 28 usage points
- Total coordination: 11 files, 96 verification points

**After:**
- Update MetricCard: 1 file, automatic propagation
- Update ErrorBoundary: 1 file, context variants
- Update form inputs: 3 files (Input, Select, Slider)
- Total coordination: 5 files, automatic propagation

**Estimated Time Savings:** 60% reduction in component update time

### Developer Experience Improvements
**Before:**
- 15-minute decision time: "Which MetricCard should I use?"
- 30-minute debugging: "Why do error boundaries look different?"
- 20-minute setup: "How do I validate this form input?"

**After:**
- 2-minute decision: Clear documentation, single source of truth
- 5-minute debugging: Consistent error handling
- 5-minute setup: Unified form components with examples

**Estimated Onboarding Time:** 50% reduction for new developers

### Bundle Size Impact
- **Estimated Reduction:** 25-35KB (minified, gzipped)
- **Tree Shaking:** Improved with single import paths
- **Code Splitting:** Easier with consolidated components

---

## Success Metrics

### Quantitative Metrics
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Shared Library Adoption | 2% | 80% | Component import analysis |
| Duplicate Lines | 1,605 | <200 | Code analysis tools |
| Component Variations | 15+ | 5 | Component inventory |
| Average PR Size | 450 lines | 250 lines | Git statistics |
| Failed Imports | 12/month | 2/month | Error tracking |

### Qualitative Metrics
- Developer satisfaction survey (quarterly)
- Component documentation completeness (100% target)
- Code review efficiency (time to approve)
- New developer onboarding feedback

### Continuous Monitoring
- Weekly: Duplicate detection scans
- Monthly: Shared library adoption rate
- Quarterly: Developer experience surveys
- Per Release: Bundle size analysis

---

## Risk Mitigation

### High-Risk Areas
1. **Builder Section Migrations** (35-40 instances)
   - Mitigation: Gradual rollout, feature flags for new components
   - Rollback: Keep old components deprecated but functional for 2 releases

2. **Visual Regression** (glass physics changes)
   - Mitigation: Visual regression testing with Playwright
   - Validation: Side-by-side screenshot comparison

3. **Breaking Changes** (API changes)
   - Mitigation: Deprecation warnings 1 release before removal
   - Documentation: Detailed migration guides per component

### Rollback Procedures
- All old components marked `@deprecated` but functional for 2 releases (v1.1 + v1.2)
- Feature flags for new component system (can disable per-route)
- Git tags for each consolidation phase
- Automated tests prevent regression

---

## Post-Refactoring Governance

### Prevention Measures (See SINGLE_SOURCE_OF_TRUTH.md)
1. ESLint rules preventing duplicate component creation
2. Pre-commit hooks checking for shared library imports
3. Component approval process in PR template
4. Quarterly component audits

### Documentation Updates
- Component library Storybook stories
- Migration guides per component
- Architecture decision records (ADRs)
- Developer onboarding checklist

---

## Version History

- **v1.1.0** - Initial refactoring plan (October 2025)
- Target completion: January 2026
- Next review: February 2026

---

## Appendix: Component Inventory

### Priority 1 Components (Weeks 1-4)
- ErrorBoundary (4 implementations → 1)
- MetricCard (2 implementations → 1)
- Input Components (5 implementations → 3 unified)

### Priority 2 Components (Weeks 5-8)
- Loading States (80+ instances → 1 system)
- Modal System (15+ modals → 1 composable system)
- Section Wrappers (40+ sections → 1 component)

### Priority 3 Components (Weeks 9-12)
- Chart Library (30+ charts → centralized library)
- Tabbed Interfaces (20+ tabs → 1 system)
- Flag Displays (50+ instances → 1 component)

---

**Document Maintainer:** Development Team
**Last Updated:** October 2025
**Next Review:** Weekly during refactoring phase
