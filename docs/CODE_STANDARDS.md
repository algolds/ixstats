# IxStats Code Standards
**Version 1.1.0**

This document defines coding standards, conventions, and best practices for the IxStats codebase.

## Table of Contents
- [TypeScript Standards](#typescript-standards)
- [Naming Conventions](#naming-conventions)
- [File Organization](#file-organization)
- [React Patterns](#react-patterns)
- [tRPC Router Patterns](#trpc-router-patterns)
- [Error Handling](#error-handling)
- [Comment and Documentation](#comment-and-documentation)
- [Import Organization](#import-organization)
- [ESLint and Prettier Configuration](#eslint-and-prettier-configuration)
- [Testing Standards](#testing-standards)

## TypeScript Standards

### Strict Type Safety

Always use TypeScript's strict mode features:

```typescript
// ✅ Good: Explicit types
function calculateGDP(population: number, gdpPerCapita: number): number {
  return population * gdpPerCapita;
}

// ❌ Bad: Implicit any
function calculateGDP(population, gdpPerCapita) {
  return population * gdpPerCapita;
}
```

### Type Definitions

**DO:**
- Define interfaces for all object shapes
- Use type aliases for union types
- Export types that are used across files
- Use Zod schemas for runtime validation

```typescript
// ✅ Good: Well-defined interfaces
interface CountryData {
  id: string;
  name: string;
  population: number;
  gdp: number;
  slug: string;
}

type EconomicTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// With Zod for validation
const CountrySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  population: z.number().positive(),
  gdp: z.number().nonnegative(),
  slug: z.string(),
});
```

**DON'T:**
```typescript
// ❌ Bad: Using any
const data: any = fetchData();

// ❌ Bad: Loose object types
const country: object = getCountry();

// ✅ Good: Proper typing
const country: CountryData = getCountry();
```

### Type Inference

Leverage TypeScript's type inference where it's clear:

```typescript
// ✅ Good: Inference is clear
const countries = await db.country.findMany();
const isActive = true;
const count = countries.length;

// ✅ Good: Explicit when needed
const tier: EconomicTier = calculateTier(gdp);
const result: Promise<CountryData[]> = fetchCountries();
```

### Generics

Use generics for reusable, type-safe code:

```typescript
// ✅ Good: Generic utility function
function mapItems<T, U>(items: T[], mapper: (item: T) => U): U[] {
  return items.map(mapper);
}

// Usage
const countries: CountryData[] = [/* ... */];
const names = mapItems(countries, (c) => c.name);
```

### Null Safety

Always handle null and undefined explicitly:

```typescript
// ✅ Good: Explicit null checking
function getUserCountry(userId: string): CountryData | null {
  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  return user.country ?? null;
}

// ✅ Good: Optional chaining
const countryName = user?.country?.name ?? "Unknown";

// ❌ Bad: Assuming values exist
const countryName = user.country.name;
```

## Naming Conventions

### Files and Directories

```
# Components: PascalCase
CountryCard.tsx
EconomicDashboard.tsx

# Utilities: camelCase
calculations.ts
formatters.ts

# Constants: UPPER_SNAKE_CASE (if exported)
ECONOMIC_TIERS.ts

# Pages: lowercase with hyphens (Next.js routing)
my-country/
economic-data/
```

### Variables and Functions

```typescript
// ✅ camelCase for variables and functions
const userCountry = getUserCountry(userId);
const isAuthenticated = checkAuth();

function calculateGDPGrowth(gdp: number, rate: number): number {
  return gdp * (1 + rate);
}

// ✅ PascalCase for React components
function CountryCard({ country }: { country: CountryData }) {
  return <div>{country.name}</div>;
}

// ✅ UPPER_SNAKE_CASE for constants
const MAX_GDP_GROWTH_RATE = 0.15;
const ECONOMIC_TIER_THRESHOLDS = [10000, 20000, 35000, 50000, 65000];
```

### Types and Interfaces

```typescript
// ✅ PascalCase for types and interfaces
interface CountryData {
  id: string;
  name: string;
}

type EconomicTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ✅ Prefix interfaces with 'I' only if needed to avoid conflicts
interface ICountryService {
  getCountry(id: string): Promise<CountryData>;
}

// ✅ Suffix with descriptive name
type CountryWithEconomy = CountryData & {
  economicData: EconomicData;
};
```

### Boolean Variables

Prefix with `is`, `has`, `can`, or `should`:

```typescript
// ✅ Good
const isAuthenticated = true;
const hasCountry = user.countryId !== null;
const canEdit = checkPermissions(user);
const shouldShowBanner = !user.hasSeenBanner;

// ❌ Bad
const authenticated = true;
const country = user.countryId !== null;
```

### Event Handlers

Prefix with `handle` or `on`:

```typescript
// ✅ Good
function handleSubmit(event: FormEvent) {
  event.preventDefault();
}

function onCountryChange(countryId: string) {
  setSelectedCountry(countryId);
}

// ❌ Bad
function submit(event: FormEvent) { }
function countryChange(countryId: string) { }
```

## File Organization

### Directory Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── dashboard/
│   │   ├── page.tsx         # Main page component
│   │   └── _components/     # Page-specific components (underscore = private)
│   └── api/                 # API routes
├── components/              # Shared React components
│   ├── ui/                  # Basic UI components (buttons, inputs)
│   ├── shared/              # Shared feature components
│   └── [feature]/           # Feature-specific components
├── lib/                     # Utility libraries
│   ├── utils.ts            # General utilities
│   ├── calculations.ts     # Economic calculations
│   └── [feature].ts        # Feature-specific utilities
├── server/                  # Server-side code
│   ├── api/
│   │   ├── routers/        # tRPC routers
│   │   └── trpc.ts         # tRPC configuration
│   └── services/           # Business logic services
├── hooks/                   # Custom React hooks
├── types/                   # TypeScript type definitions
└── styles/                  # Global styles
```

### Component File Structure

Single component per file:

```typescript
// CountryCard.tsx
import { type CountryData } from "~/types";

interface CountryCardProps {
  country: CountryData;
  onSelect?: (id: string) => void;
}

export function CountryCard({ country, onSelect }: CountryCardProps) {
  // Component implementation
  return (
    <div className="rounded-lg border p-4">
      {/* ... */}
    </div>
  );
}
```

Multiple related small components in one file:

```typescript
// EconomicIndicators.tsx
interface IndicatorProps {
  label: string;
  value: number;
}

function Indicator({ label, value }: IndicatorProps) {
  return <div>{label}: {value}</div>;
}

export function EconomicIndicators({ data }: { data: EconomicData }) {
  return (
    <div>
      <Indicator label="GDP" value={data.gdp} />
      <Indicator label="Population" value={data.population} />
    </div>
  );
}
```

## React Patterns

### Function Components

Always use function components with TypeScript:

```typescript
// ✅ Good: Function component with typed props
interface UserProfileProps {
  userId: string;
  showDetails?: boolean;
}

export function UserProfile({ userId, showDetails = false }: UserProfileProps) {
  // Component logic
  return <div>{/* ... */}</div>;
}
```

### Hooks

**useState:**
```typescript
// ✅ Good: Typed state
const [country, setCountry] = useState<CountryData | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**useEffect:**
```typescript
// ✅ Good: Clear dependencies and cleanup
useEffect(() => {
  let mounted = true;

  async function fetchData() {
    const data = await fetchCountry(countryId);
    if (mounted) setCountry(data);
  }

  fetchData();

  return () => {
    mounted = false;
  };
}, [countryId]);
```

**Custom Hooks:**
```typescript
// ✅ Good: Reusable custom hook
export function useCountryData(countryId: string) {
  const [data, setData] = useState<CountryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fetch logic
  }, [countryId]);

  return { data, isLoading, error };
}

// Usage
const { data, isLoading, error } = useCountryData(countryId);
```

### Performance Optimization

Use React.memo for expensive components:

```typescript
// ✅ Good: Memoized component
export const CountryCard = React.memo(function CountryCard({
  country,
}: {
  country: CountryData;
}) {
  return <div>{country.name}</div>;
});
```

Use useMemo for expensive calculations:

```typescript
// ✅ Good: Memoized calculation
const sortedCountries = useMemo(() => {
  return countries.sort((a, b) => b.gdp - a.gdp);
}, [countries]);
```

Use useCallback for stable function references:

```typescript
// ✅ Good: Memoized callback
const handleSelect = useCallback((id: string) => {
  onCountrySelect(id);
}, [onCountrySelect]);
```

### Error Boundaries

```typescript
// ErrorBoundary.tsx
import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <div>Something went wrong</div>;
    }

    return this.props.children;
  }
}
```

## tRPC Router Patterns

### Router Structure

```typescript
// src/server/api/routers/countries.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";

export const countriesRouter = createTRPCRouter({
  // Public procedure
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.country.findMany({
      orderBy: { name: "asc" },
    });
  }),

  // With input validation
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.country.findUnique({
        where: { slug: input.slug },
      });
    }),

  // Protected procedure (requires auth)
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        population: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.country.create({
        data: {
          ...input,
          userId: ctx.session.userId,
        },
      });
    }),

  // Update with validation
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          population: z.number().positive().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
      });

      if (!country || country.userId !== ctx.session.userId) {
        throw new Error("Not authorized");
      }

      return ctx.db.country.update({
        where: { id: input.id },
        data: input.data,
      });
    }),
});
```

### Client Usage

```typescript
// Component using tRPC
import { api } from "~/lib/trpc";

export function CountryList() {
  const { data: countries, isLoading, error } = api.countries.getAll.useQuery();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {countries?.map((country) => (
        <CountryCard key={country.id} country={country} />
      ))}
    </div>
  );
}
```

### Mutations

```typescript
// Mutation with optimistic updates
export function CreateCountryForm() {
  const utils = api.useUtils();

  const createCountry = api.countries.create.useMutation({
    onSuccess: () => {
      // Invalidate and refetch
      utils.countries.getAll.invalidate();
    },
  });

  const handleSubmit = (data: CountryFormData) => {
    createCountry.mutate(data);
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

## Error Handling

### Try-Catch Pattern

```typescript
// ✅ Good: Comprehensive error handling
async function fetchCountryData(id: string): Promise<CountryData> {
  try {
    const response = await fetch(`/api/countries/${id}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch country:", error);

    // Rethrow with context
    if (error instanceof Error) {
      throw new Error(`Failed to fetch country ${id}: ${error.message}`);
    }

    throw new Error(`Failed to fetch country ${id}`);
  }
}
```

### Custom Error Types

```typescript
// lib/errors.ts
export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Usage
if (!country) {
  throw new NotFoundError("Country", countryId);
}
```

### tRPC Error Handling

```typescript
// Router with proper errors
export const countriesRouter = createTRPCRouter({
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
      });

      if (!country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country not found",
        });
      }

      if (country.userId !== ctx.session.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to delete this country",
        });
      }

      return ctx.db.country.delete({
        where: { id: input.id },
      });
    }),
});
```

## Comment and Documentation

### JSDoc Comments

```typescript
/**
 * Calculates the economic tier based on GDP per capita.
 *
 * Tiers range from 1 (Impoverished) to 7 (Extravagant) and determine
 * the maximum GDP growth rate for the country.
 *
 * @param gdpPerCapita - GDP per capita in USD
 * @returns Economic tier (1-7)
 *
 * @example
 * ```ts
 * const tier = calculateEconomicTier(45000);
 * console.log(tier); // 4 (Prosperous)
 * ```
 */
export function calculateEconomicTier(gdpPerCapita: number): EconomicTier {
  // Implementation
}
```

### Inline Comments

```typescript
// ✅ Good: Explain why, not what
function calculateGrowth(gdp: number, tier: EconomicTier): number {
  // Apply global growth factor first (3.21%)
  const baseGrowth = gdp * 1.0321;

  // Cap growth based on tier to model diminishing returns
  // Higher tier countries have lower max growth rates
  const tierCap = TIER_GROWTH_CAPS[tier];

  return Math.min(baseGrowth, gdp * (1 + tierCap));
}

// ❌ Bad: State the obvious
// Set x to 5
const x = 5;
```

### TODO Comments

```typescript
// TODO: Implement caching for better performance
// FIXME: This breaks when population is zero
// NOTE: This is a temporary workaround for Issue #123
// HACK: Non-standard approach, but works for now
```

## Import Organization

### Import Order

```typescript
// 1. External dependencies
import React, { useState, useEffect } from "react";
import { z } from "zod";

// 2. Internal absolute imports
import { api } from "~/lib/trpc";
import { calculateGDP } from "~/lib/calculations";
import { type CountryData } from "~/types";

// 3. Relative imports
import { CountryCard } from "./CountryCard";
import { useCountryData } from "../hooks/useCountryData";

// 4. CSS imports (if any)
import styles from "./component.module.css";
```

### Path Aliases

Use path aliases consistently:

```typescript
// ✅ Good: Use configured aliases
import { Button } from "~/components/ui/button";
import { calculateGDP } from "~/lib/calculations";
import { type CountryData } from "~/types";

// ❌ Bad: Relative paths for distant files
import { Button } from "../../../components/ui/button";
```

## ESLint and Prettier Configuration

### ESLint Rules

Key rules from `package.json`:

```json
{
  "eslintConfig": {
    "extends": [
      "next/core-web-vitals",
      "@typescript-eslint/recommended"
    ],
    "rules": {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn"
    }
  }
}
```

### Prettier Configuration

```json
{
  "prettier": {
    "semi": true,
    "trailingComma": "es5",
    "singleQuote": false,
    "tabWidth": 2,
    "useTabs": false,
    "printWidth": 100,
    "plugins": ["prettier-plugin-tailwindcss"]
  }
}
```

### Running Checks

```bash
# Format code
npm run format:write

# Check formatting
npm run format:check

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run typecheck

# Run all checks
npm run check
```

## Testing Standards

### Unit Tests

```typescript
// calculations.test.ts
import { calculateEconomicTier } from "./calculations";

describe("calculateEconomicTier", () => {
  it("returns tier 1 for GDP per capita under $10,000", () => {
    expect(calculateEconomicTier(5000)).toBe(1);
  });

  it("returns tier 4 for GDP per capita between $35,000-$50,000", () => {
    expect(calculateEconomicTier(45000)).toBe(4);
  });

  it("handles edge cases correctly", () => {
    expect(calculateEconomicTier(0)).toBe(1);
    expect(calculateEconomicTier(100000)).toBe(7);
  });
});
```

### Component Tests

```typescript
// CountryCard.test.tsx
import { render, screen } from "@testing-library/react";
import { CountryCard } from "./CountryCard";

describe("CountryCard", () => {
  const mockCountry = {
    id: "1",
    name: "Test Country",
    population: 1000000,
    gdp: 50000000000,
  };

  it("renders country name", () => {
    render(<CountryCard country={mockCountry} />);
    expect(screen.getByText("Test Country")).toBeInTheDocument();
  });
});
```

## Summary Checklist

Before submitting code, ensure:

- [ ] TypeScript strict mode compliance
- [ ] Proper naming conventions (camelCase, PascalCase, etc.)
- [ ] Files organized in correct directories
- [ ] React patterns followed (hooks, memoization)
- [ ] Error handling implemented
- [ ] JSDoc comments for public APIs
- [ ] Imports organized and using path aliases
- [ ] Code formatted with Prettier
- [ ] No ESLint errors or warnings
- [ ] Type checking passes
- [ ] Tests written (if applicable)

---

**Follow these standards to maintain code quality and consistency across the IxStats codebase.**

For contributing guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).
