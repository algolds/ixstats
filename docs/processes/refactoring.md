# Refactoring Best Practices

**Last updated:** October 2025

This guide documents the established patterns and best practices for refactoring large components in the IxStats codebase, based on successful refactoring work completed in October 2025.

## Overview

The IxStats codebase follows a **modular architecture pattern** that separates complex components into distinct layers for maintainability, reusability, and performance. This guide provides concrete guidelines for applying these patterns when refactoring large or complex components.

## When to Refactor

### Size Thresholds
Consider refactoring a component when it exceeds:
- **1,000+ lines of code** in a single file
- **500+ lines** in the main component function
- **10+ useState/useEffect hooks** in one component
- **5+ levels** of nested JSX

### Complexity Indicators
Refactor if the component exhibits:
- **Multiple responsibilities**: Handles data fetching, business logic, and presentation
- **Poor testability**: Difficult to test due to tight coupling
- **Performance issues**: Unnecessary re-renders, expensive calculations in render
- **Hard to maintain**: Changes in one area break unrelated functionality
- **Difficult onboarding**: New developers struggle to understand the component

### Business Triggers
- Feature requests require significant changes to a complex component
- Bug fixes consistently require changes across multiple concerns
- Performance profiling identifies specific components as bottlenecks
- Team feedback indicates maintainability concerns

## Layer Separation Principles

### 1. Business Logic Layer (`src/lib/*.ts`)

**Purpose**: Pure, testable functions for calculations, transformations, and validations.

**Characteristics**:
- **Zero React dependencies** (no hooks, no JSX)
- **Pure functions** with predictable inputs/outputs
- **No side effects** (API calls, localStorage, etc.)
- **Fully synchronous** when possible
- **Framework-agnostic** (could be used in Node.js, browser, etc.)

**Examples**:
```typescript
// src/lib/synergy-calculator.ts
/**
 * Calculates synergy bonuses between government components
 */
export function calculateComponentSynergy(
  component: GovernmentComponent,
  allComponents: GovernmentComponent[]
): number {
  // Pure calculation logic
  return synergyScore;
}

// src/lib/tax-builder-validation.ts
/**
 * Validates tax bracket configuration
 */
export function validateTaxBrackets(
  brackets: TaxBracket[]
): ValidationResult {
  // Pure validation logic
  return { isValid, errors };
}
```

**Anti-patterns**:
```typescript
// ❌ DO NOT: React hooks in business logic
export function calculateScore(data: Data) {
  const [result, setResult] = useState(0); // Wrong!
}

// ❌ DO NOT: Side effects in business logic
export function processData(data: Data) {
  api.saveData.mutate(data); // Wrong!
}

// ❌ DO NOT: Direct DOM access
export function formatValue(value: number) {
  document.getElementById('result').innerHTML = value; // Wrong!
}
```

### 2. State Management Layer (`src/hooks/*.ts`)

**Purpose**: Custom React hooks that encapsulate data fetching, state management, and React-specific logic.

**Characteristics**:
- **Encapsulate tRPC queries/mutations** for specific features
- **Use React.useMemo** for expensive computations
- **Use React.useCallback** for stable function references
- **Return stable references** (memoized objects/arrays)
- **Handle loading/error states** consistently
- **Compose other hooks** when needed

**Examples**:
```typescript
// src/hooks/useIntelligenceMetrics.ts
/**
 * Hook for fetching and computing intelligence metrics
 */
export function useIntelligenceMetrics(countryId: string) {
  const { data, isLoading, error } = api.intelligence.getMetrics.useQuery({ countryId });

  const computedMetrics = React.useMemo(() => {
    if (!data) return null;
    return calculateIntelligenceScore(data); // Uses business logic
  }, [data]);

  return { metrics: computedMetrics, isLoading, error };
}

// src/hooks/useTaxBuilderState.ts
/**
 * Hook for managing tax builder form state
 */
export function useTaxBuilderState(initialData?: TaxData) {
  const [state, setState] = useState(initialData ?? getDefaultTaxData());
  const saveMutation = api.taxes.save.useMutation();

  const updateBracket = useCallback((index: number, bracket: TaxBracket) => {
    setState(prev => updateBracketInState(prev, index, bracket));
  }, []);

  return { state, updateBracket, save: saveMutation };
}
```

**Anti-patterns**:
```typescript
// ❌ DO NOT: Business logic in hooks
export function useCalculations(data: Data) {
  return useMemo(() => {
    // 500 lines of calculation logic here
    // This should be in src/lib/
  }, [data]);
}

// ❌ DO NOT: Return unstable references
export function useData() {
  const data = fetchData();
  return { data, metadata: { timestamp: Date.now() } }; // New object every render!
}

// ❌ DO NOT: Direct DOM manipulation
export function useScroll() {
  useEffect(() => {
    window.scrollTo(0, 0); // Use a proper scroll hook instead
  }, []);
}
```

### 3. Presentation Layer (`src/components/**/feature/*.tsx`)

**Purpose**: Focused UI components with single responsibilities, optimized for performance.

**Characteristics**:
- **Single Responsibility Principle** (one component, one job)
- **React.memo optimization** to prevent unnecessary re-renders
- **Props interface** clearly defined with TypeScript
- **Minimal logic** (presentation only, no business logic)
- **Composed from primitives** (use UI components from `src/components/ui`)
- **Barrel exports** via `index.ts` for clean imports

**File Organization**:
```
src/components/diplomatic/embassy-network/
├── index.ts                    # Barrel export
├── EmbassyCard.tsx            # Single embassy display
├── EmbassyGrid.tsx            # Grid layout of embassies
├── EmbassyFilters.tsx         # Filter controls
├── EmbassyMetrics.tsx         # Metrics display
└── NetworkVisualization.tsx   # Visual graph
```

**Examples**:
```typescript
// src/components/diplomatic/embassy-network/EmbassyCard.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import type { Embassy } from '@/types/diplomatic-network';

interface EmbassyCardProps {
  embassy: Embassy;
  onSelect?: (id: string) => void;
}

/**
 * Displays a single embassy with status and metrics
 */
export const EmbassyCard = React.memo<EmbassyCardProps>(({ embassy, onSelect }) => {
  return (
    <Card onClick={() => onSelect?.(embassy.id)}>
      <h3>{embassy.name}</h3>
      <p>{embassy.status}</p>
    </Card>
  );
});

EmbassyCard.displayName = 'EmbassyCard';
```

**Barrel Export Pattern**:
```typescript
// src/components/diplomatic/embassy-network/index.ts
export { EmbassyCard } from './EmbassyCard';
export { EmbassyGrid } from './EmbassyGrid';
export { EmbassyFilters } from './EmbassyFilters';
export { EmbassyMetrics } from './EmbassyMetrics';
export { NetworkVisualization } from './NetworkVisualization';
```

**Anti-patterns**:
```typescript
// ❌ DO NOT: Business logic in components
export const MyComponent = ({ data }) => {
  const result = data.reduce((acc, item) => {
    // 50 lines of complex calculation
  }, {});
  return <div>{result}</div>;
};

// ❌ DO NOT: Multiple responsibilities
export const UserDashboard = () => {
  // Fetches data
  // Processes data
  // Renders header
  // Renders sidebar
  // Renders main content
  // Handles form submission
  // All in one component!
};

// ❌ DO NOT: Missing React.memo on presentational components
export const ExpensiveCard = ({ item }) => {
  // Renders complex UI but re-renders unnecessarily
  return <div>...</div>;
};
```

### 4. Orchestration Layer (Main Component)

**Purpose**: Thin wrapper that composes hooks and UI components with minimal logic.

**Characteristics**:
- **Composition over logic** (orchestrate, don't implement)
- **Clear structure** (easy to read, understand flow)
- **Minimal state** (delegate to hooks)
- **Error boundaries** where appropriate
- **Loading states** handled cleanly
- **Clean JSX** (avoid deeply nested ternaries)

**Examples**:
```typescript
// src/components/countries/EnhancedIntelligenceBriefing.tsx
import React from 'react';
import { useIntelligenceMetrics } from '@/hooks/useIntelligenceMetrics';
import { useWikiIntelligence } from '@/hooks/useWikiIntelligence';
import {
  MetricsOverview,
  IntelligenceAlerts,
  WikiDataSection,
  AnalyticsChart
} from '@/components/countries/intelligence-briefing';

interface EnhancedIntelligenceBriefingProps {
  countryId: string;
}

/**
 * Main intelligence briefing dashboard - orchestrates metrics, alerts, and wiki data
 */
export function EnhancedIntelligenceBriefing({ countryId }: EnhancedIntelligenceBriefingProps) {
  const { metrics, isLoading: metricsLoading } = useIntelligenceMetrics(countryId);
  const { wikiData, isLoading: wikiLoading } = useWikiIntelligence(countryId);

  if (metricsLoading || wikiLoading) {
    return <LoadingState />;
  }

  return (
    <div className="intelligence-briefing">
      <MetricsOverview metrics={metrics} />
      <IntelligenceAlerts countryId={countryId} />
      <WikiDataSection data={wikiData} />
      <AnalyticsChart metrics={metrics} />
    </div>
  );
}
```

**Anti-patterns**:
```typescript
// ❌ DO NOT: Inline business logic
export function MyComponent({ data }) {
  const result = data.map(item => {
    // 100 lines of transformation logic
  });
  return <div>{result}</div>;
}

// ❌ DO NOT: Direct tRPC calls (use hooks)
export function MyComponent({ id }) {
  const { data } = api.countries.getById.useQuery({ id }); // Should be in a hook
  const { data: economics } = api.economics.get.useQuery({ id }); // Should be in a hook
}

// ❌ DO NOT: Complex nested JSX
export function MyComponent({ data }) {
  return (
    <div>
      {data ? (
        data.items.length > 0 ? (
          data.items.map(item => (
            item.active ? (
              <div>{/* ... */}</div>
            ) : null
          ))
        ) : (
          <EmptyState />
        )
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
```

## File Organization Conventions

### Directory Structure
```
src/
├── lib/                          # Business logic utilities
│   ├── synergy-calculator.ts
│   ├── tax-builder-validation.ts
│   └── wiki-markup-parser.ts
├── hooks/                        # Custom React hooks
│   ├── useIntelligenceMetrics.ts
│   ├── useTaxBuilderState.ts
│   └── useWikiIntelligence.ts
├── components/
│   ├── ui/                       # Design system primitives
│   ├── diplomatic/
│   │   ├── embassy-network/      # Feature module
│   │   │   ├── index.ts
│   │   │   ├── EmbassyCard.tsx
│   │   │   └── EmbassyGrid.tsx
│   │   └── EnhancedEmbassyNetwork.tsx  # Main orchestrator
│   └── countries/
│       ├── intelligence-briefing/
│       │   ├── index.ts
│       │   ├── MetricsOverview.tsx
│       │   └── AnalyticsChart.tsx
│       └── EnhancedIntelligenceBriefing.tsx
└── types/                        # TypeScript type definitions
    ├── diplomatic-network.ts
    └── intelligence-briefing.ts
```

### File Naming Conventions
- **Business logic**: kebab-case (`synergy-calculator.ts`, `tax-validation.ts`)
- **Hooks**: camelCase with `use` prefix (`useIntelligenceMetrics.ts`)
- **Components**: PascalCase (`EmbassyCard.tsx`, `MetricsOverview.tsx`)
- **Types**: kebab-case (`diplomatic-network.ts`, `intelligence-briefing.ts`)
- **Barrel exports**: `index.ts` (always lowercase)

### Module Boundaries
- **One feature per directory**: Keep related components together
- **Shared utilities in `lib/`**: Don't duplicate logic across features
- **Shared hooks in `hooks/`**: Reuse data fetching/state management
- **Types co-located**: Keep types near their usage, or in `types/` if shared widely

## Naming Conventions

### Functions and Variables
```typescript
// Business logic: Descriptive, verb-based
export function calculateSynergyBonus(...)
export function validateTaxBrackets(...)
export function parseSectionContent(...)

// Hooks: Use "use" prefix
export function useIntelligenceMetrics(...)
export function useTaxBuilderState(...)
export function useEmbassyNetworkData(...)

// Components: Noun-based, descriptive
export const MetricsOverview = ...
export const EmbassyCard = ...
export const AnalyticsChart = ...
```

### Types and Interfaces
```typescript
// Props interfaces: ComponentName + "Props"
interface EmbassyCardProps { ... }
interface MetricsOverviewProps { ... }

// Data types: Descriptive nouns
type Embassy = { ... }
type IntelligenceMetrics = { ... }
type TaxBracket = { ... }

// Result types: Noun + Result/Response/Data
type ValidationResult = { ... }
type SynergyCalculationResult = { ... }
```

## Performance Optimization Patterns

### React.memo Usage
**When to use React.memo**:
- Presentational components that receive stable props
- Components that render frequently but props change infrequently
- Components with expensive rendering logic
- List items in mapped arrays

**When NOT to use React.memo**:
- Components that always receive new props
- Very simple components (single `<div>`)
- Components that render once (modals, pages)

**Examples**:
```typescript
// ✅ DO: Memoize presentational components
export const EmbassyCard = React.memo<EmbassyCardProps>(({ embassy }) => {
  return <Card>{embassy.name}</Card>;
});

// ✅ DO: Memoize list items
export const MetricItem = React.memo<MetricItemProps>(({ metric }) => {
  return <li>{metric.label}: {metric.value}</li>;
});

// ❌ DON'T: Memoize if props always change
export const Clock = React.memo(() => {
  const time = new Date().toISOString(); // Always new!
  return <div>{time}</div>;
});
```

### useMemo and useCallback
**useMemo**: Memoize expensive calculations
```typescript
const sortedData = React.useMemo(() => {
  return data.sort((a, b) => a.value - b.value);
}, [data]);

const metrics = React.useMemo(() => {
  return calculateComplexMetrics(rawData);
}, [rawData]);
```

**useCallback**: Stabilize function references for child components
```typescript
const handleSelect = React.useCallback((id: string) => {
  onSelect?.(id);
}, [onSelect]);

const updateBracket = React.useCallback((index: number, bracket: TaxBracket) => {
  setState(prev => updateBracketInState(prev, index, bracket));
}, []);
```

### Avoiding Re-renders
```typescript
// ✅ DO: Return stable references from hooks
export function useData() {
  const [data, setData] = useState<Data[]>([]);

  return React.useMemo(() => ({ data, setData }), [data]);
}

// ❌ DON'T: Return new objects every render
export function useData() {
  const [data, setData] = useState<Data[]>([]);

  return { data, setData }; // New object every time!
}
```

## Documentation Requirements

### JSDoc Standards
Every exported function, hook, and component MUST have JSDoc documentation.

**Business Logic**:
```typescript
/**
 * Calculates the synergy bonus between government components
 *
 * @param component - The primary government component
 * @param allComponents - All active components in the system
 * @returns Synergy score from 0 to 100
 *
 * @example
 * ```typescript
 * const synergy = calculateSynergyBonus(
 *   presidentialComponent,
 *   [presidentialComponent, parliamentaryComponent]
 * );
 * console.log(synergy); // 25
 * ```
 */
export function calculateSynergyBonus(
  component: GovernmentComponent,
  allComponents: GovernmentComponent[]
): number {
  // Implementation
}
```

**Custom Hooks**:
```typescript
/**
 * Hook for fetching and computing intelligence metrics for a country
 *
 * @param countryId - The ID of the country to fetch metrics for
 * @returns Object containing metrics, loading state, and error state
 *
 * @example
 * ```typescript
 * function MyComponent({ countryId }: Props) {
 *   const { metrics, isLoading, error } = useIntelligenceMetrics(countryId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorState />;
 *
 *   return <MetricsDisplay metrics={metrics} />;
 * }
 * ```
 */
export function useIntelligenceMetrics(countryId: string) {
  // Implementation
}
```

**React Components**:
```typescript
/**
 * Displays a single embassy card with status, metrics, and actions
 *
 * @param embassy - Embassy data to display
 * @param onSelect - Optional callback when card is clicked
 *
 * @example
 * ```tsx
 * <EmbassyCard
 *   embassy={embassyData}
 *   onSelect={(id) => console.log('Selected:', id)}
 * />
 * ```
 */
export const EmbassyCard = React.memo<EmbassyCardProps>(({ embassy, onSelect }) => {
  // Implementation
});
```

### Inline Comments
- **Explain "why" not "what"**: Code should be self-documenting; comments explain reasoning
- **Complex algorithms**: Add step-by-step comments for non-obvious logic
- **Business rules**: Document business requirements that inform implementation
- **TODOs**: Use `// TODO:` for future improvements, include context

## Testing Strategies

### Business Logic Testing
Business logic in `src/lib/` should have comprehensive unit tests:

```typescript
// src/lib/__tests__/synergy-calculator.test.ts
import { calculateSynergyBonus } from '../synergy-calculator';

describe('calculateSynergyBonus', () => {
  it('should return 0 for components with no synergies', () => {
    const result = calculateSynergyBonus(componentA, [componentA]);
    expect(result).toBe(0);
  });

  it('should calculate correct bonus for compatible components', () => {
    const result = calculateSynergyBonus(componentA, [componentA, componentB]);
    expect(result).toBe(25);
  });

  it('should handle edge case of empty component list', () => {
    const result = calculateSynergyBonus(componentA, []);
    expect(result).toBe(0);
  });
});
```

### Hook Testing
Use `@testing-library/react-hooks` for hook tests:

```typescript
// src/hooks/__tests__/useIntelligenceMetrics.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useIntelligenceMetrics } from '../useIntelligenceMetrics';

describe('useIntelligenceMetrics', () => {
  it('should fetch and compute metrics', async () => {
    const { result } = renderHook(() => useIntelligenceMetrics('country-123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics).toBeDefined();
  });
});
```

### Component Testing
Use `@testing-library/react` for component tests:

```typescript
// src/components/diplomatic/embassy-network/__tests__/EmbassyCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { EmbassyCard } from '../EmbassyCard';

describe('EmbassyCard', () => {
  const mockEmbassy = {
    id: '123',
    name: 'Test Embassy',
    status: 'active'
  };

  it('should render embassy name', () => {
    render(<EmbassyCard embassy={mockEmbassy} />);
    expect(screen.getByText('Test Embassy')).toBeInTheDocument();
  });

  it('should call onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<EmbassyCard embassy={mockEmbassy} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledWith('123');
  });
});
```

## Migration Approach

### Pre-Refactoring Checklist
- [ ] Review component to understand all functionality
- [ ] Identify all external dependencies (APIs, context, etc.)
- [ ] Document current behavior and edge cases
- [ ] Create comprehensive test suite for existing functionality
- [ ] Get approval from team/stakeholders for refactoring

### Refactoring Process
1. **Create feature branch**: `refactor/component-name-modular-architecture`
2. **Extract business logic**: Move pure functions to `src/lib/`
3. **Extract state management**: Create custom hooks in `src/hooks/`
4. **Extract UI components**: Create focused components in `src/components/domain/feature/`
5. **Update main component**: Refactor to orchestration pattern
6. **Add documentation**: JSDoc on all new modules
7. **Optimize performance**: Apply React.memo where appropriate
8. **Test thoroughly**: Ensure zero breaking changes
9. **Update tests**: Adapt tests to new structure
10. **Review and merge**: Get team review before merging

### Zero Breaking Changes
**Critical**: Refactoring MUST NOT change external behavior.

**Verification checklist**:
- [ ] All props interfaces unchanged (or backward compatible)
- [ ] Component exports unchanged (same import paths work)
- [ ] Visual appearance identical
- [ ] User interactions work exactly the same
- [ ] API calls unchanged (same endpoints, same data)
- [ ] Performance equal or better (measure before/after)
- [ ] All tests pass without modification (or minimal updates)

### Incremental Migration
For large components, consider incremental refactoring:

1. **Phase 1**: Extract business logic to `src/lib/`
2. **Phase 2**: Extract first custom hook
3. **Phase 3**: Extract first UI component
4. **Phase 4**: Continue extracting components one at a time
5. **Phase 5**: Final optimization and documentation

Each phase should be a separate commit, making it easy to review and roll back if needed.

## Code Examples

### Before Refactoring (Anti-pattern)
```typescript
// ❌ Monolithic component (1,851 lines)
export function TaxBuilder({ countryId }: TaxBuilderProps) {
  const [brackets, setBrackets] = useState<TaxBracket[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // 200 lines of validation logic
  const validateBrackets = (brackets: TaxBracket[]) => {
    const errors: ValidationError[] = [];

    // Complex validation logic inline
    brackets.forEach((bracket, index) => {
      if (bracket.min < 0) {
        errors.push({ field: `bracket-${index}-min`, message: 'Minimum cannot be negative' });
      }
      // ... 150 more lines
    });

    return errors;
  };

  // 100 lines of calculation logic
  const calculateTotalRevenue = (brackets: TaxBracket[]) => {
    // Complex revenue calculation inline
    return brackets.reduce((total, bracket) => {
      // ... 80 more lines
    }, 0);
  };

  // 50 lines of suggestion logic
  const generateSuggestions = (brackets: TaxBracket[]) => {
    // Complex suggestion generation inline
    // ... 40 more lines
  };

  // tRPC calls directly in component
  const { data: taxData } = api.taxes.getByCountryId.useQuery({ countryId });
  const saveMutation = api.taxes.save.useMutation();

  // 1,500 more lines of complex JSX and logic
  return (
    <div className="tax-builder">
      {/* Deeply nested JSX */}
    </div>
  );
}
```

### After Refactoring (Best Practice)
```typescript
// ✅ Business logic extracted (src/lib/tax-builder-validation.ts)
/**
 * Validates tax bracket configuration
 */
export function validateTaxBrackets(brackets: TaxBracket[]): ValidationError[] {
  const errors: ValidationError[] = [];

  brackets.forEach((bracket, index) => {
    if (bracket.min < 0) {
      errors.push({ field: `bracket-${index}-min`, message: 'Minimum cannot be negative' });
    }
    // Validation logic here
  });

  return errors;
}

/**
 * Calculates total tax revenue from brackets
 */
export function calculateTaxRevenue(brackets: TaxBracket[]): number {
  return brackets.reduce((total, bracket) => {
    // Calculation logic here
  }, 0);
}

// ✅ State management extracted (src/hooks/useTaxBuilderState.ts)
/**
 * Hook for managing tax builder state and operations
 */
export function useTaxBuilderState(countryId: string) {
  const { data: taxData, isLoading } = api.taxes.getByCountryId.useQuery({ countryId });
  const saveMutation = api.taxes.save.useMutation();

  const [brackets, setBrackets] = useState<TaxBracket[]>([]);

  const errors = React.useMemo(() => validateTaxBrackets(brackets), [brackets]);
  const revenue = React.useMemo(() => calculateTaxRevenue(brackets), [brackets]);

  const updateBracket = React.useCallback((index: number, bracket: TaxBracket) => {
    setBrackets(prev => {
      const next = [...prev];
      next[index] = bracket;
      return next;
    });
  }, []);

  return { brackets, errors, revenue, updateBracket, save: saveMutation, isLoading };
}

// ✅ UI components extracted (src/components/tax-system/tax-builder/)
export const BracketEditor = React.memo<BracketEditorProps>(({ bracket, onChange }) => {
  return <div>{/* Focused UI for editing a single bracket */}</div>;
});

export const ValidationDisplay = React.memo<ValidationDisplayProps>(({ errors }) => {
  return <div>{/* Display validation errors */}</div>;
});

export const RevenueProjection = React.memo<RevenueProjectionProps>(({ revenue }) => {
  return <div>{/* Display revenue projection */}</div>;
});

// ✅ Main component refactored (orchestration only, 567 lines)
import { useTaxBuilderState } from '@/hooks/useTaxBuilderState';
import { BracketEditor, ValidationDisplay, RevenueProjection } from '@/components/tax-system/tax-builder';

/**
 * Main tax builder interface - orchestrates tax configuration workflow
 */
export function TaxBuilder({ countryId }: TaxBuilderProps) {
  const { brackets, errors, revenue, updateBracket, save, isLoading } = useTaxBuilderState(countryId);

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="tax-builder">
      <ValidationDisplay errors={errors} />
      <RevenueProjection revenue={revenue} />
      {brackets.map((bracket, index) => (
        <BracketEditor
          key={bracket.id}
          bracket={bracket}
          onChange={(updated) => updateBracket(index, updated)}
        />
      ))}
    </div>
  );
}
```

## Common Anti-Patterns

### 1. God Components
```typescript
// ❌ Component does everything
export function MyDashboard() {
  // Fetches 10 different APIs
  // Processes all the data
  // Renders entire dashboard
  // Handles all user interactions
  // 3,000 lines of code
}
```

**Solution**: Split into domain components, extract hooks, move logic to utilities.

### 2. Prop Drilling
```typescript
// ❌ Props passed through many levels
<ParentComponent data={data}>
  <MiddleComponent data={data}>
    <AnotherMiddle data={data}>
      <FinalComponent data={data} />
    </AnotherMiddle>
  </MiddleComponent>
</ParentComponent>
```

**Solution**: Use React Context or composition patterns.

### 3. Inline Business Logic
```typescript
// ❌ Complex logic in component
export function MyComponent({ items }) {
  const result = items.reduce((acc, item) => {
    // 100 lines of complex calculation
  }, initialValue);

  return <div>{result}</div>;
}
```

**Solution**: Extract to `src/lib/` utility function.

### 4. Hook Soup
```typescript
// ❌ Too many hooks in one component
export function MyComponent() {
  const [state1, setState1] = useState();
  const [state2, setState2] = useState();
  const [state3, setState3] = useState();
  // ... 15 more useState hooks

  useEffect(() => { /* ... */ }, []);
  useEffect(() => { /* ... */ }, [state1]);
  useEffect(() => { /* ... */ }, [state2]);
  // ... 10 more useEffect hooks
}
```

**Solution**: Extract state management to custom hooks.

### 5. Unstable References
```typescript
// ❌ New objects/arrays every render
export function MyComponent({ items }) {
  const config = { sort: 'asc', filter: 'active' }; // New object every render!

  return <ChildComponent items={items} config={config} />;
}
```

**Solution**: Use `useMemo` or define outside component.

## Success Metrics

Track these metrics before and after refactoring:

### Quantitative Metrics
- **Lines of code**: Main component should be <500 lines
- **Cyclomatic complexity**: <10 per function
- **Number of hooks**: <8 in main component
- **Test coverage**: >80% for business logic
- **Bundle size**: Monitor with `npm run build`
- **Re-render count**: Use React DevTools Profiler

### Qualitative Metrics
- **Developer velocity**: Time to implement new features
- **Bug frequency**: Regression rate post-refactor
- **Code review time**: How quickly reviews are completed
- **Onboarding time**: How long it takes new developers to understand the code

## Conclusion

Following these refactoring patterns ensures:
- **Maintainable codebase**: Clear separation of concerns
- **High performance**: React.memo and memoization prevent wasteful re-renders
- **Testable code**: Each layer can be tested independently
- **Developer productivity**: Easier to understand, modify, and extend

Remember: **Refactoring is an investment in long-term code health**. Take the time to do it right, and the codebase will thank you.

## References

- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)
- IxStats Refactoring Summary: `REFACTORING_SUMMARY_OCT_2025.md`
- IxStats Design System: `docs/DESIGN_SYSTEM.md`
