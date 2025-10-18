# Single Source of Truth: Component Governance v1.1.0

## Overview

This document establishes governance principles to prevent component duplication and ensure architectural consistency across the IxStats codebase.

**Version:** 1.1.0
**Status:** Active
**Enforcement:** Automated + Code Review
**Scope:** All React components, hooks, utilities

---

## Core Principles

### 1. Single Responsibility, Single Location
**Principle:** Every reusable pattern should exist in exactly one canonical location.

**Application:**
- One MetricCard component (not two or three)
- One ErrorBoundary system (not four variations)
- One modal system (not per-feature implementations)

**Exception:** Specialized wrappers around shared components are permitted if they add domain-specific behavior, not just styling.

### 2. Shared-First Development
**Principle:** Always check shared library before creating new components.

**Decision Tree:**
```
Need a component?
  ├─ Does shared library have it?
  │   ├─ YES → Use it (customize via props)
  │   └─ NO → Does it exist elsewhere in codebase?
  │       ├─ YES → Promote to shared library
  │       └─ NO → Create in shared library
  └─ Is this truly one-off?
      ├─ YES → Create locally, document why
      └─ NO → Create in shared library
```

### 3. Composition Over Duplication
**Principle:** Build complex components by composing simple shared components.

**Good Example:**
```typescript
// Complex feature using shared components
import { Modal, ModalHeader, ModalBody } from '@/components/shared/layouts/Modal';
import { MetricCard } from '@/components/shared/data-display/MetricCard';
import { UnifiedInput } from '@/components/shared/forms/UnifiedInput';

function EconomyBuilderFeature() {
  return (
    <Modal>
      <ModalHeader title="Economy Builder" />
      <ModalBody>
        <MetricCard variant="builder" />
        <UnifiedInput type="number" enhanced />
      </ModalBody>
    </Modal>
  );
}
```

**Bad Example:**
```typescript
// Duplicating modal, metric, and input functionality
function CustomEconomyBuilder() {
  return (
    <div className="custom-modal">
      <div className="custom-metric-card" />
      <input className="custom-number-input" />
    </div>
  );
}
```

### 4. Variants Over Versions
**Principle:** Extend components with variants, not by copying.

**Good Example:**
```typescript
<MetricCard variant="builder" /> // Glass physics styling
<MetricCard variant="compact" /> // Condensed for mobile
<MetricCard variant="detailed" /> // Expanded with chart
```

**Bad Example:**
```typescript
// Creating separate components
<BuilderMetricCard />
<CompactMetricCard />
<DetailedMetricCard />
```

---

## Component Hierarchy

### Shared Component Library Structure

```
/src/components/shared/
├── data-display/          # Presentation components
│   ├── MetricCard.tsx
│   ├── DataTable.tsx
│   ├── CountryFlag.tsx
│   └── index.ts
├── forms/                 # Input components
│   ├── UnifiedInput.tsx
│   ├── UnifiedSelect.tsx
│   ├── UnifiedSlider.tsx
│   └── index.ts
├── feedback/              # Loading, errors, validation
│   ├── LoadingState.tsx
│   ├── UnifiedErrorBoundary.tsx
│   ├── ValidationFeedback.tsx
│   └── index.ts
├── layouts/               # Structure components
│   ├── Modal.tsx
│   ├── SectionWrapper.tsx
│   ├── TabbedContent.tsx
│   ├── ExpandableCard.tsx
│   └── index.ts
├── charts/                # Data visualization
│   ├── BarChart.tsx
│   ├── LineChart.tsx
│   ├── PieChart.tsx
│   ├── chartConfig.ts
│   └── index.ts
└── README.md
```

### When to Create Local Components

**Permitted Local Components:**
1. **Page-specific layouts** - Unique to one route
2. **Feature-specific compositions** - Combine shared components for specific feature
3. **Domain-specific wrappers** - Add business logic to shared component

**Examples:**
```typescript
// OK: Page-specific layout
/src/app/builder/components/BuilderLayout.tsx

// OK: Feature composition
/src/app/builder/components/EconomyPreviewPanel.tsx (uses shared MetricCard + BarChart)

// OK: Domain wrapper with business logic
/src/app/builder/components/ValidatedGovernmentForm.tsx (uses shared UnifiedInput + validation logic)

// NOT OK: Duplicate of shared component
/src/app/builder/components/BuilderMetricCard.tsx (should use shared MetricCard with variant)
```

---

## Component Approval Process

### Before Creating New Component

**Step 1: Search & Research (5 minutes)**
```bash
# Search for similar components
rg "export (function|const) [A-Z].*Card" --type tsx

# Search for similar patterns
rg "modal|dialog" --type tsx -i

# Check shared library
ls src/components/shared/*/
```

**Step 2: Evaluate Existing Components (5 minutes)**
- Can existing component be extended with variant?
- Can composition of existing components solve need?
- Is customization possible via props/slots?

**Step 3: Document Decision (2 minutes)**
If creating new component, document in PR description:
```markdown
## New Component Justification

**Component:** `CustomTaxCalculator`
**Location:** `/src/app/builder/components/tax/CustomTaxCalculator.tsx`

**Why not shared library?**
- [ ] Feature-specific: Unique to tax builder, not reusable
- [ ] Composition: Combines 3 shared components (MetricCard, UnifiedInput, BarChart)
- [ ] Business logic: Contains tax calculation domain logic

**Reusability assessment:** Low - specific to tax system calculations

**Alternative considered:** Extending shared MetricCard - rejected because tax calculation logic is too specialized
```

### New Shared Component Checklist

**Before adding to shared library:**
- [ ] Used in 2+ different features/pages
- [ ] Generic enough for multiple use cases
- [ ] Well-tested (unit + integration tests)
- [ ] Documented (JSDoc + Storybook story)
- [ ] Accessible (WCAG 2.1 AA compliant)
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Variant system designed (if applicable)
- [ ] Glass physics integrated (if applicable)

**Documentation Requirements:**
```typescript
/**
 * MetricCard - Displays a metric with optional trend and formatting
 *
 * @example
 * ```tsx
 * <MetricCard
 *   title="GDP"
 *   value={1000000000}
 *   format="currency"
 *   trend={5.2}
 *   variant="builder"
 * />
 * ```
 *
 * @param title - Metric label
 * @param value - Numeric value to display
 * @param format - Number formatting: 'number' | 'currency' | 'percent'
 * @param trend - Optional percentage change (positive = green, negative = red)
 * @param variant - Display variant: 'default' | 'builder' | 'compact' | 'detailed'
 */
export function MetricCard({ title, value, format, trend, variant = 'default' }: MetricCardProps) {
  // Implementation
}
```

---

## Code Review Guidelines

### Reviewer Checklist for Component Changes

**For New Components:**
- [ ] Justification provided for not using existing component
- [ ] Search performed to verify no duplicates
- [ ] If reusable (2+ use cases), should be in shared library
- [ ] Documentation complete (JSDoc, examples)
- [ ] Tests included (unit tests minimum)
- [ ] Storybook story added (for shared components)

**For Component Modifications:**
- [ ] Changes don't break existing usage (check file references)
- [ ] Backward compatibility maintained or breaking change documented
- [ ] Variants used instead of conditional logic where appropriate
- [ ] Props validated with TypeScript (no `any` types)

**For Styling Changes:**
- [ ] Tailwind v4 classes used (no inline styles)
- [ ] Glass physics hierarchy respected
- [ ] Responsive design maintained
- [ ] Dark mode support verified (if applicable)

### Automated Review Tools

**PR Template Section:**
```markdown
## Component Governance Checklist

- [ ] No duplicate components created (searched with rg/grep)
- [ ] Shared library checked before creating new component
- [ ] Component in correct location (shared vs local)
- [ ] Reusable components placed in `/src/components/shared/`
- [ ] Documentation added (JSDoc for shared components)
- [ ] Tests added (required for shared components)
```

---

## Preventing Future Duplication

### ESLint Rules

**Rule 1: Enforce Shared Imports**
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/app/builder/primitives/enhanced/*'],
            message: 'Use shared library components from @/components/shared instead. See SINGLE_SOURCE_OF_TRUTH.md',
          },
          {
            group: ['../../../components/shared/*'],
            message: 'Use absolute imports: @/components/shared/... instead of relative imports',
          },
        ],
      },
    ],
  },
};
```

**Rule 2: Component Naming Conventions**
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'react/forbid-component-props': [
      'warn',
      {
        forbid: [
          {
            propName: 'className',
            allowedFor: ['div', 'span'], // Require styled components for custom styling
            message: 'Use variant prop instead of className for styling variations',
          },
        ],
      },
    ],
  },
};
```

**Rule 3: Duplicate Detection**
```javascript
// .eslintrc.js
module.exports = {
  plugins: ['no-duplicate-components'],
  rules: {
    'no-duplicate-components/no-duplicate-components': [
      'error',
      {
        maxSimilarity: 0.85, // Flag components >85% similar
        ignorePaths: ['src/app/**/page.tsx'], // Ignore page components
      },
    ],
  },
};
```

### Pre-Commit Hooks

**Duplicate Detection Hook:**
```bash
#!/bin/bash
# .husky/pre-commit

# Check for potential duplicate components
echo "Checking for duplicate components..."

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.tsx$')

if [ -n "$STAGED_FILES" ]; then
  # Check for common duplicate patterns
  for FILE in $STAGED_FILES; do
    # Check if creating new MetricCard variant
    if echo "$FILE" | grep -q "MetricCard" && ! echo "$FILE" | grep -q "src/components/shared"; then
      echo "⚠️  WARNING: Creating MetricCard outside shared library"
      echo "   File: $FILE"
      echo "   Consider using @/components/shared/data-display/MetricCard with variant prop"
      echo ""
    fi

    # Check for ErrorBoundary duplicates
    if echo "$FILE" | grep -q "ErrorBoundary" && ! echo "$FILE" | grep -q "src/components/shared"; then
      echo "⚠️  WARNING: Creating ErrorBoundary outside shared library"
      echo "   File: $FILE"
      echo "   Use @/components/shared/feedback/UnifiedErrorBoundary with context prop"
      echo ""
    fi

    # Check for Modal duplicates
    if echo "$FILE" | grep -q "Modal" && ! echo "$FILE" | grep -q "src/components/shared"; then
      echo "⚠️  WARNING: Creating Modal outside shared library"
      echo "   File: $FILE"
      echo "   Use @/components/shared/layouts/Modal with composition pattern"
      echo ""
    fi
  done
fi

# Check import patterns
echo "Checking import patterns..."
rg --type tsx "from ['\"]@/app/builder/primitives/enhanced" --files-with-matches | while read FILE; do
  if git diff --cached --name-only | grep -q "$FILE"; then
    echo "⚠️  WARNING: Using deprecated builder primitives"
    echo "   File: $FILE"
    echo "   Migrate to @/components/shared library (see COMPONENT_CONSOLIDATION_GUIDE.md)"
    echo ""
  fi
done

echo "✓ Pre-commit checks complete"
```

### Automated Monitoring

**Weekly Duplicate Scan:**
```bash
#!/bin/bash
# scripts/detect-duplicates.sh

echo "Running weekly duplicate component scan..."

# Find similar component names
echo "1. Checking for naming duplicates..."
find src -name "*.tsx" -type f | \
  xargs basename -a | \
  sort | \
  uniq -d | \
  while read DUPLICATE; do
    echo "⚠️  Found duplicate name: $DUPLICATE"
    find src -name "$DUPLICATE" -type f
    echo ""
  done

# Find similar component structures (using jsinspect)
echo "2. Checking for structural duplicates..."
npx jsinspect src/components src/app --threshold 30 --ignore "*.test.tsx"

# Find deprecated import usage
echo "3. Checking for deprecated imports..."
rg "from ['\"]@/app/builder/primitives" --type tsx | wc -l | \
  xargs -I {} echo "Found {} deprecated builder primitive imports"

# Calculate shared library adoption
TOTAL_IMPORTS=$(rg "from ['\"]@/(components|app)" --type tsx | wc -l)
SHARED_IMPORTS=$(rg "from ['\"]@/components/shared" --type tsx | wc -l)
ADOPTION=$((SHARED_IMPORTS * 100 / TOTAL_IMPORTS))

echo ""
echo "📊 Shared Library Adoption: ${ADOPTION}%"
echo "   Target: 80%"

if [ $ADOPTION -lt 80 ]; then
  echo "   Status: ⚠️  Below target"
else
  echo "   Status: ✓ Target met"
fi
```

**Run via cron or GitHub Actions:**
```yaml
# .github/workflows/duplicate-detection.yml
name: Weekly Duplicate Detection

on:
  schedule:
    - cron: '0 9 * * MON' # Every Monday at 9 AM

jobs:
  detect-duplicates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm install
      - name: Run duplicate detection
        run: bash scripts/detect-duplicates.sh
      - name: Post to Slack
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "⚠️ Duplicate components detected in IxStats codebase",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "Weekly duplicate scan found issues. Review needed."
                  }
                }
              ]
            }
```

---

## Component Lifecycle Management

### Deprecation Process

**Step 1: Mark as Deprecated (Release N)**
```typescript
/**
 * @deprecated Use @/components/shared/data-display/MetricCard instead
 * This component will be removed in v1.3.0
 * Migration guide: /docs/COMPONENT_CONSOLIDATION_GUIDE.md#metriccard-migration
 */
export function BuilderMetricCard(props: MetricCardProps) {
  // Add console warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      'BuilderMetricCard is deprecated. Use @/components/shared/data-display/MetricCard with variant="builder" instead. ' +
      'See migration guide: /docs/COMPONENT_CONSOLIDATION_GUIDE.md#metriccard-migration'
    );
  }

  // Original implementation
  return <OriginalImplementation {...props} />;
}
```

**Step 2: Track Usage (Release N + 1)**
```typescript
// Add usage tracking
import { trackDeprecatedComponentUsage } from '@/lib/analytics';

export function BuilderMetricCard(props: MetricCardProps) {
  useEffect(() => {
    trackDeprecatedComponentUsage('BuilderMetricCard', {
      file: new Error().stack, // Capture call site
      replacement: 'MetricCard with variant="builder"',
    });
  }, []);

  // Implementation
}
```

**Step 3: Remove (Release N + 2)**
```typescript
// Component removed, export error message
export function BuilderMetricCard() {
  throw new Error(
    'BuilderMetricCard has been removed in v1.3.0. ' +
    'Use @/components/shared/data-display/MetricCard with variant="builder" instead. ' +
    'See migration guide: /docs/COMPONENT_CONSOLIDATION_GUIDE.md#metriccard-migration'
  );
}
```

**Timeline:**
- v1.1.0: Deprecate old component, add warnings
- v1.2.0: Track usage, continue warnings
- v1.3.0: Remove deprecated component (breaking change)

---

## Success Metrics & Monitoring

### Key Performance Indicators

**Shared Library Adoption Rate:**
```typescript
// Calculate monthly
const sharedImports = await countImports('@/components/shared');
const totalImports = await countImports('@/(components|app)');
const adoptionRate = (sharedImports / totalImports) * 100;

// Target: 80% by end of Q4 2025
// Current: 2% (October 2025)
```

**Duplicate Line Count:**
```bash
# Run monthly via jsinspect
npx jsinspect src --threshold 30 --reporter json > duplicates.json

# Target: <200 lines (maintenance-level only)
# Current: ~1,605 lines (October 2025)
```

**Component Count by Category:**
```bash
# Track monthly
SHARED_COMPONENTS=$(find src/components/shared -name "*.tsx" | wc -l)
LOCAL_COMPONENTS=$(find src/app -name "*.tsx" ! -name "page.tsx" ! -name "layout.tsx" | wc -l)
RATIO=$((LOCAL_COMPONENTS / SHARED_COMPONENTS))

# Target: Ratio < 3:1 (local:shared)
```

**New Component Review Time:**
```typescript
// Track in PR metrics
const avgReviewTime = calculateAverage(
  prs.filter(pr => pr.labels.includes('new-component'))
    .map(pr => pr.firstApprovalTime - pr.createdAt)
);

// Target: < 24 hours with governance guidelines
```

### Quarterly Reports

**Generate every quarter:**
```markdown
# Q4 2025 Component Governance Report

## Adoption Metrics
- Shared library adoption: 45% (+43% from Q3)
- Duplicate line count: 650 (-955 from Q3)
- Component ratio: 4.2:1 (improving from 8.1:1)

## Top Duplicates Remaining
1. Chart components (35 instances)
2. Flag displays (28 instances)
3. Loading states (15 instances)

## Next Quarter Focus
- Consolidate chart components (Priority 3)
- Standardize flag displays (Priority 3)
- Enforce pre-commit hooks
```

---

## Emergency Procedures

### Critical Duplication Detected

**If major duplication discovered after merge:**

1. **Assess Impact**
   - How many files affected?
   - Is functionality broken?
   - Can it wait for normal refactor?

2. **Immediate Action (if critical)**
   - Create hotfix branch
   - Consolidate duplicate immediately
   - Fast-track PR review
   - Deploy fix

3. **Post-Mortem**
   - Why did automated checks miss it?
   - Update detection rules
   - Improve review checklist
   - Team retrospective

### Governance Process Failures

**If developers consistently bypass governance:**

1. **Identify Root Cause**
   - Are guidelines too strict?
   - Is shared library missing needed components?
   - Are timelines too aggressive?

2. **Adjust Process**
   - Update guidelines based on feedback
   - Add missing shared components
   - Improve documentation

3. **Team Training**
   - Review session on governance
   - Pair programming on migrations
   - Update onboarding materials

---

## Documentation Requirements

### For All Shared Components

**Required Documentation:**
1. **JSDoc comments** - Component purpose, props, examples
2. **Storybook story** - Visual examples with variants
3. **Unit tests** - Core functionality coverage
4. **Migration guide** - If replacing existing component

**Example:**
```typescript
/**
 * UnifiedErrorBoundary - Catches React errors with context-aware fallbacks
 *
 * Replaces: BuilderErrorBoundary, GovernmentBuilderError, DashboardErrorBoundary
 *
 * @example
 * ```tsx
 * <UnifiedErrorBoundary context="builder">
 *   <BuilderContent />
 * </UnifiedErrorBoundary>
 * ```
 *
 * @param children - Components to wrap with error boundary
 * @param context - Error context for tailored messaging
 * @param fallback - Custom fallback UI (optional)
 * @param onError - Error callback for logging (optional)
 */
export function UnifiedErrorBoundary({
  children,
  context = 'general',
  fallback,
  onError,
}: UnifiedErrorBoundaryProps) {
  // Implementation
}
```

### For Local Components

**Required Documentation:**
1. **File header comment** - Purpose and justification
2. **Reusability note** - Why not in shared library

**Example:**
```typescript
/**
 * TaxCalculationPanel - Tax system calculation display
 *
 * Location: Local to tax builder (not shared library)
 * Justification: Highly specialized tax domain logic, not reusable outside tax system
 * Reusability: Low - specific to tax calculation workflows
 *
 * Shared components used:
 * - MetricCard (display)
 * - UnifiedInput (input fields)
 * - BarChart (visualization)
 */
export function TaxCalculationPanel() {
  // Implementation
}
```

---

## Version History

- **v1.1.0** (October 2025) - Initial governance framework
- **v1.2.0** (Planned Q1 2026) - Post-refactor updates
- **v2.0.0** (Planned Q2 2026) - Deprecated component removal

---

## Additional Resources

- **Refactoring Plan:** `/docs/REFACTORING_PLAN_V1.1.md`
- **Migration Guide:** `/docs/COMPONENT_CONSOLIDATION_GUIDE.md`
- **Design Framework:** `/docs/DESIGN_SYSTEM.md`
- **Component Library:** `src/components/shared/README.md`

---

**Document Owner:** Architecture Team
**Reviewers:** All developers (via PR reviews)
**Enforcement:** Automated (ESLint, pre-commit) + Manual (code review)
**Last Updated:** October 2025
**Next Review:** January 2026
