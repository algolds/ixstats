# IxStats Testing Guide

**Version:** 1.1.0
**Last Updated:** October 2025

This guide provides comprehensive testing strategies, patterns, and procedures for the IxStats platform, covering unit tests, integration tests, and end-to-end testing with Playwright.

---

## Table of Contents

1. [Testing Strategy Overview](#testing-strategy-overview)
2. [Testing Infrastructure](#testing-infrastructure)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Testing Atomic Components](#testing-atomic-components)
7. [Testing tRPC Routers](#testing-trpc-routers)
8. [Test File Organization](#test-file-organization)
9. [Running Tests](#running-tests)
10. [Mocking Strategies](#mocking-strategies)
11. [Test Data Setup](#test-data-setup)
12. [Coverage Requirements](#coverage-requirements)
13. [CI/CD Integration](#cicd-integration)

---

## Testing Strategy Overview

### Testing Pyramid

IxStats follows a comprehensive testing strategy:

```
                    /\
                   /  \
                  / E2E \         10% - Full user workflows
                 /______\
                /        \
               / Integra- \       30% - API & component integration
              /    tion    \
             /_____________ \
            /                \
           /   Unit Tests     \   60% - Business logic & calculations
          /____________________\
```

### Test Types

1. **Unit Tests** - Individual functions, calculations, utilities
2. **Integration Tests** - tRPC routers, database operations, API integrations
3. **Component Tests** - React components, atomic builders
4. **E2E Tests** - Complete user workflows with Playwright

### Testing Goals

- **Confidence**: Ensure core functionality works correctly
- **Documentation**: Tests serve as usage examples
- **Regression Prevention**: Catch breaking changes early
- **Performance**: Monitor calculation performance
- **Security**: Validate authentication and authorization

---

## Testing Infrastructure

### Test Framework Stack

```json
{
  "testing": {
    "unit": "Jest + ts-jest",
    "e2e": "Playwright",
    "coverage": "Jest coverage",
    "assertions": "@testing-library/jest-dom"
  }
}
```

### Jest Configuration

Located in `package.json`:

```json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "roots": [
      "<rootDir>/src",
      "<rootDir>/tests"
    ],
    "testMatch": [
      "**/__tests__/**/*.test.ts",
      "**/?(*.)+(spec|test).ts"
    ],
    "collectCoverageFrom": [
      "src/**/*.{ts,tsx}",
      "!src/**/*.d.ts",
      "!src/**/*.stories.{ts,tsx}",
      "!src/**/index.ts"
    ],
    "coverageReporters": ["text", "lcov", "html"],
    "setupFilesAfterEnv": ["<rootDir>/tests/setup.ts"]
  }
}
```

### Playwright Configuration

Located in `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PROD_CLONE_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/report.json' }],
  ],

  use: {
    baseURL,
    storageState: '.auth/prodclone.json',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  globalSetup: './tests/e2e/global.setup.ts',
});
```

---

## Unit Testing

### Testing Calculations

Economic calculations require precise unit tests:

```typescript
// src/lib/__tests__/atomic-client-calculations.test.ts
import { describe, it, expect } from '@jest/globals';
import { calculateGDPGrowth, calculatePopulationGrowth } from '../atomic-client-calculations';

describe('Economic Calculations', () => {
  describe('GDP Growth', () => {
    it('calculates baseline GDP growth correctly', () => {
      const result = calculateGDPGrowth({
        baselineGdp: 50000,
        populationGrowth: 1.5,
        tier: 'emerging',
        year: 2025
      });

      expect(result.growth).toBeGreaterThan(0);
      expect(result.growth).toBeLessThanOrEqual(8.0);
      expect(result.projectedGdp).toBeGreaterThan(50000);
    });

    it('applies tier-based growth caps', () => {
      const developed = calculateGDPGrowth({
        baselineGdp: 60000,
        tier: 'developed',
      });

      const emerging = calculateGDPGrowth({
        baselineGdp: 20000,
        tier: 'emerging',
      });

      // Emerging economies should have higher growth potential
      expect(emerging.maxGrowth).toBeGreaterThan(developed.maxGrowth);
    });

    it('handles negative growth scenarios', () => {
      const result = calculateGDPGrowth({
        baselineGdp: 30000,
        populationGrowth: -2.0,  // Population decline
        tier: 'stagnant',
      });

      expect(result.growth).toBeLessThan(0);
    });
  });

  describe('Population Growth', () => {
    it('calculates population projections', () => {
      const result = calculatePopulationGrowth({
        baselinePopulation: 1000000,
        growthRate: 1.2,
        years: 10
      });

      expect(result.projected).toBeGreaterThan(1000000);
      expect(result.yearlyGrowth).toHaveLength(10);
    });

    it('handles compound growth correctly', () => {
      const result = calculatePopulationGrowth({
        baselinePopulation: 1000000,
        growthRate: 2.0,
        years: 5
      });

      // Year 5 should be ~1000000 * (1.02)^5 = 1104081
      expect(result.projected).toBeCloseTo(1104081, 0);
    });
  });
});
```

### Testing Utilities

```typescript
// src/lib/__tests__/format-utils.test.ts
import { describe, it, expect } from '@jest/globals';
import { formatCurrency, formatNumber, formatPercentage } from '../format-utils';

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('formats USD correctly', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
      expect(formatCurrency(1234567.89, 'USD')).toBe('$1,234,567.89');
    });

    it('handles large numbers with abbreviations', () => {
      expect(formatCurrency(1500000, 'USD', { compact: true }))
        .toBe('$1.5M');
      expect(formatCurrency(2500000000, 'USD', { compact: true }))
        .toBe('$2.5B');
    });

    it('handles negative values', () => {
      expect(formatCurrency(-500, 'USD')).toBe('-$500.00');
    });
  });

  describe('formatPercentage', () => {
    it('formats percentages with correct decimals', () => {
      expect(formatPercentage(0.1234)).toBe('12.34%');
      expect(formatPercentage(0.1234, 1)).toBe('12.3%');
    });

    it('handles edge cases', () => {
      expect(formatPercentage(0)).toBe('0.00%');
      expect(formatPercentage(1)).toBe('100.00%');
      expect(formatPercentage(-0.05)).toBe('-5.00%');
    });
  });
});
```

### Testing Validators

```typescript
// src/tests/validators/governmentValidator.test.ts
import { describe, it, expect } from '@jest/globals';
import { GovernmentBuilderStateSchema } from '~/types/validation/government';

describe('GovernmentBuilder validation', () => {
  it('fails when totalBudget <= 0 and department name missing', () => {
    const invalid = {
      structure: {
        governmentName: '',
        governmentType: 'Unitary State',
        totalBudget: 0,
        fiscalYear: 'Calendar Year',
        budgetCurrency: 'USD',
      },
      departments: [{
        name: '',
        category: 'Other',
        organizationalLevel: 'Ministry',
        color: '#000000',
        priority: 50
      }],
      budgetAllocations: [],
      revenueSources: [],
    };

    const result = GovernmentBuilderStateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['structure', 'totalBudget']
          }),
          expect.objectContaining({
            path: ['departments', 0, 'name']
          })
        ])
      );
    }
  });

  it('passes for minimal valid structure', () => {
    const valid = {
      structure: {
        governmentName: 'Test Government',
        governmentType: 'Unitary State',
        totalBudget: 100000000,
        fiscalYear: 'Calendar Year',
        budgetCurrency: 'USD',
      },
      departments: [{
        name: 'Finance Ministry',
        category: 'Finance',
        organizationalLevel: 'Ministry',
        color: '#4A90E2',
        priority: 100
      }],
      budgetAllocations: [],
      revenueSources: [],
    };

    const result = GovernmentBuilderStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('validates budget allocation constraints', () => {
    const overAllocated = {
      structure: {
        governmentName: 'Test Gov',
        governmentType: 'Unitary State',
        totalBudget: 100,
        fiscalYear: 'Calendar Year',
        budgetCurrency: 'USD',
      },
      departments: [
        { name: 'Dept1', category: 'Finance', organizationalLevel: 'Ministry' }
      ],
      budgetAllocations: [
        { departmentId: 'dept1', amount: 60 },
        { departmentId: 'dept2', amount: 60 },
      ],
      revenueSources: [],
    };

    // Total allocation (120) exceeds budget (100)
    const result = GovernmentBuilderStateSchema.safeParse(overAllocated);
    expect(result.success).toBe(false);
  });
});
```

---

## Integration Testing

### Testing tRPC Routers

```typescript
// src/server/api/routers/__tests__/countries.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { appRouter } from '~/server/api/root';
import { createInnerTRPCContext } from '~/server/api/trpc';
import { db } from '~/server/db';

describe('Countries Router', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    // Create test context
    const ctx = await createInnerTRPCContext({
      session: null,
      headers: new Headers(),
    });

    caller = appRouter.createCaller(ctx);
  });

  describe('getAll', () => {
    it('returns paginated countries', async () => {
      const result = await caller.countries.getAll({
        limit: 10,
        offset: 0,
      });

      expect(result.countries).toBeInstanceOf(Array);
      expect(result.countries.length).toBeLessThanOrEqual(10);
      expect(result.total).toBeGreaterThan(0);
    });

    it('filters by search query', async () => {
      const result = await caller.countries.getAll({
        search: 'United',
        limit: 10,
      });

      result.countries.forEach(country => {
        expect(country.name.toLowerCase()).toContain('united');
      });
    });

    it('filters by economic tier', async () => {
      const result = await caller.countries.getAll({
        tier: 'developed',
        limit: 10,
      });

      result.countries.forEach(country => {
        expect(country.economicTier).toBe('developed');
      });
    });
  });

  describe('getBySlug', () => {
    it('returns country by slug', async () => {
      const country = await caller.countries.getBySlug({
        slug: 'burgundie',
      });

      expect(country).toBeDefined();
      expect(country?.slug).toBe('burgundie');
      expect(country?.name).toBeDefined();
    });

    it('returns null for non-existent slug', async () => {
      const country = await caller.countries.getBySlug({
        slug: 'non-existent-country-xyz',
      });

      expect(country).toBeNull();
    });
  });

  describe('getStats', () => {
    it('calculates global statistics', async () => {
      const stats = await caller.countries.getStats();

      expect(stats.totalCountries).toBeGreaterThan(0);
      expect(stats.totalPopulation).toBeGreaterThan(0);
      expect(stats.totalGDP).toBeGreaterThan(0);
      expect(stats.averageGDPPerCapita).toBeGreaterThan(0);
    });

    it('aggregates by tier correctly', async () => {
      const stats = await caller.countries.getStats();

      expect(stats.byTier).toBeDefined();
      expect(stats.byTier.developed).toBeDefined();
      expect(stats.byTier.emerging).toBeDefined();

      // Sum of tier counts should equal total
      const tierSum = Object.values(stats.byTier)
        .reduce((sum, count) => sum + count, 0);
      expect(tierSum).toBe(stats.totalCountries);
    });
  });
});
```

### Testing Database Operations

```typescript
// src/server/api/routers/__tests__/economics.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { db } from '~/server/db';

describe('Economics Database Operations', () => {
  let testCountryId: string;

  beforeEach(async () => {
    // Create test country
    const country = await db.country.create({
      data: {
        name: 'Test Country',
        slug: 'test-country',
        baselinePopulation: 1000000,
        baselineGdpPerCapita: 25000,
        economicTier: 'emerging',
      },
    });
    testCountryId = country.id;
  });

  afterEach(async () => {
    // Cleanup test data
    await db.country.delete({ where: { id: testCountryId } });
  });

  it('creates economic data record', async () => {
    const economicData = await db.economicData.create({
      data: {
        countryId: testCountryId,
        year: 2025,
        gdp: 25000000000,
        gdpPerCapita: 25000,
        gdpGrowthRate: 3.5,
        population: 1000000,
      },
    });

    expect(economicData.countryId).toBe(testCountryId);
    expect(economicData.gdp).toBe(25000000000);
  });

  it('retrieves historical economic data', async () => {
    // Create multiple years of data
    await Promise.all([2023, 2024, 2025].map(year =>
      db.economicData.create({
        data: {
          countryId: testCountryId,
          year,
          gdp: 20000000000 * (1 + (year - 2023) * 0.03),
          gdpPerCapita: 20000 * (1 + (year - 2023) * 0.03),
          gdpGrowthRate: 3.0,
          population: 1000000,
        },
      })
    ));

    const historicalData = await db.economicData.findMany({
      where: { countryId: testCountryId },
      orderBy: { year: 'asc' },
    });

    expect(historicalData).toHaveLength(3);
    expect(historicalData[0]?.year).toBe(2023);
    expect(historicalData[2]?.year).toBe(2025);
  });
});
```

---

## End-to-End Testing

### E2E Test Structure

All E2E tests are in `tests/e2e/` directory:

```
tests/e2e/
├── global.setup.ts              # Global test setup
├── auth.setup.ts                # Authentication setup
├── auth.spec.ts                 # Authentication flows
├── builder-country-from-scratch.spec.ts
├── builder-country-from-foundation.spec.ts
├── builder-country-from-wiki.spec.ts
├── government-builder.spec.ts
├── tax-builder-basic.spec.ts
├── diplomatic.spec.ts
├── intelligence.spec.ts
├── mycountry-datapoints.spec.ts
├── quickactions.spec.ts
└── thinkpages-thinktanks.spec.ts
```

### Authentication Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('sign-in page loads and redirects after login', async ({ page }) => {
  const base = process.env.PROD_CLONE_BASE_URL || 'http://localhost:3000';

  await page.goto(base + '/sign-in');
  await expect(page).toHaveTitle(/Sign/i);

  // Verify Clerk sign-in form is present
  await expect(page.getByRole('form')).toBeVisible();
});

test('protected routes redirect to sign-in', async ({ page }) => {
  await page.goto('/mycountry/builder');

  // Should redirect to sign-in
  await expect(page).toHaveURL(/sign-in/);
});

test('authenticated user can access protected routes', async ({ page }) => {
  // Authentication state loaded from .auth/prodclone.json
  await page.goto('/mycountry/builder');

  // Should stay on builder page
  await expect(page).toHaveURL(/builder/);
  await expect(page.getByText(/Country Builder/i)).toBeVisible();
});
```

### Country Builder Tests

```typescript
// tests/e2e/builder-country-from-scratch.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Country Builder - From Scratch', () => {
  test('creates a country successfully', async ({ page }) => {
    const prefix = process.env.TEST_TENANT_PREFIX || '__e2e__';
    const name = `${prefix}-${Date.now()}-land`;

    await page.goto('/mycountry/builder');

    // Fill in basic information
    await page.getByLabel(/Country name/i).fill(name);
    await page.getByLabel(/Population/i).fill('1000000');
    await page.getByLabel(/GDP per capita/i).fill('25000');

    // Select economic tier
    await page.getByLabel(/Economic tier/i).selectOption('emerging');

    // Create country
    await page.getByRole('button', { name: /Create Country/i }).click();

    // Verify redirect to country page
    await expect(page).toHaveURL(new RegExp(`/mycountry/${name}`));
    await expect(page.getByText(name)).toBeVisible();
  });

  test('validates required fields', async ({ page }) => {
    await page.goto('/mycountry/builder');

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /Create Country/i }).click();

    // Should show validation errors
    await expect(page.getByText(/required/i)).toBeVisible();
  });

  test('calculates economic projections', async ({ page }) => {
    await page.goto('/mycountry/builder');

    await page.getByLabel(/Population/i).fill('5000000');
    await page.getByLabel(/GDP per capita/i).fill('30000');

    // Should display calculated total GDP
    await expect(page.getByText(/150,000,000,000/)).toBeVisible(); // 5M * 30K
  });
});
```

### Government Builder Tests

```typescript
// tests/e2e/government-builder.spec.ts
import { test, expect } from '@playwright/test';

test('Government Builder - add/remove components', async ({ page }) => {
  await page.goto('/mycountry/government');

  // Add government component
  const addButton = page.getByRole('button', { name: /Add Component/i });
  if (await addButton.isVisible()) {
    await addButton.click();

    // Fill in component details
    await page.getByLabel(/Component name/i).fill('Ministry of Finance');
    await page.getByLabel(/Budget allocation/i).fill('1000000000');

    // Save component
    await page.getByRole('button', { name: /Save/i }).click();

    // Verify component was added
    await expect(page.getByText(/Component added|saved/i))
      .toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Ministry of Finance')).toBeVisible();
  }
});

test('validates budget allocation constraints', async ({ page }) => {
  await page.goto('/mycountry/government');

  // Set total budget
  await page.getByLabel(/Total budget/i).fill('100000000');

  // Try to allocate more than total budget
  await page.getByLabel(/Department allocation/i).fill('150000000');

  // Should show validation error
  await expect(page.getByText(/exceeds total budget/i)).toBeVisible();
});
```

### Tax Builder Tests

```typescript
// tests/e2e/tax-builder-basic.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Tax Builder - Basic Operations', () => {
  test('creates tax category', async ({ page }) => {
    await page.goto('/mycountry/tax-system');

    // Add tax category
    await page.getByRole('button', { name: /Add Tax Category/i }).click();
    await page.getByLabel(/Category name/i).fill('Income Tax');
    await page.getByLabel(/Rate/i).fill('25');

    // Save
    await page.getByRole('button', { name: /Save/i }).click();

    // Verify
    await expect(page.getByText('Income Tax')).toBeVisible();
    await expect(page.getByText(/25%/)).toBeVisible();
  });

  test('calculates total tax revenue', async ({ page }) => {
    await page.goto('/mycountry/tax-system');

    // Set base economic values
    await page.getByLabel(/Total GDP/i).fill('100000000000');

    // Add tax categories
    await page.getByLabel(/Income tax rate/i).fill('20');
    await page.getByLabel(/Corporate tax rate/i).fill('15');

    // Should display calculated revenue
    const revenueElement = page.getByTestId('total-tax-revenue');
    await expect(revenueElement).toBeVisible();

    const revenueText = await revenueElement.textContent();
    expect(revenueText).toMatch(/\d{1,3}(,\d{3})*/); // Formatted number
  });
});
```

### Intelligence Dashboard Tests

```typescript
// tests/e2e/intelligence.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Intelligence Dashboard', () => {
  test('displays intelligence metrics', async ({ page }) => {
    await page.goto('/mycountry/intelligence');

    // Verify key sections are present
    await expect(page.getByText(/Economic Vitality/i)).toBeVisible();
    await expect(page.getByText(/Diplomatic Status/i)).toBeVisible();
    await expect(page.getByText(/Security Index/i)).toBeVisible();
  });

  test('updates metrics in real-time', async ({ page }) => {
    await page.goto('/mycountry/intelligence');

    // Get initial metric value
    const metricElement = page.getByTestId('economic-vitality-score');
    const initialValue = await metricElement.textContent();

    // Wait for potential updates (WebSocket)
    await page.waitForTimeout(5000);

    // Check if value updated or remained stable
    const updatedValue = await metricElement.textContent();
    expect(updatedValue).toBeDefined();
  });

  test('filters intelligence by category', async ({ page }) => {
    await page.goto('/mycountry/intelligence');

    // Select category filter
    await page.getByRole('button', { name: /Filter/i }).click();
    await page.getByRole('option', { name: /Economic/i }).click();

    // Verify only economic intelligence shown
    await expect(page.getByText(/Economic/i)).toBeVisible();
    await expect(page.getByText(/Diplomatic/i)).not.toBeVisible();
  });
});
```

---

## Testing Atomic Components

### Component Test Structure

```typescript
// src/tests/components/SuggestionsPanel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionsPanel } from '~/components/builders/SuggestionsPanel';

describe('SuggestionsPanel', () => {
  it('renders suggestions based on economic tier', () => {
    render(
      <SuggestionsPanel
        economicTier="emerging"
        currentGDP={25000}
      />
    );

    expect(screen.getByText(/Emerging Economy/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus on infrastructure/i)).toBeInTheDocument();
  });

  it('updates suggestions when tier changes', () => {
    const { rerender } = render(
      <SuggestionsPanel economicTier="emerging" currentGDP={25000} />
    );

    expect(screen.getByText(/Emerging/i)).toBeInTheDocument();

    rerender(
      <SuggestionsPanel economicTier="developed" currentGDP={55000} />
    );

    expect(screen.getByText(/Developed/i)).toBeInTheDocument();
  });

  it('handles click events on suggestions', () => {
    const mockOnSelect = jest.fn();

    render(
      <SuggestionsPanel
        economicTier="emerging"
        onSelectSuggestion={mockOnSelect}
      />
    );

    const suggestion = screen.getByText(/Infrastructure/i);
    fireEvent.click(suggestion);

    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'infrastructure' })
    );
  });
});
```

### Testing Atomic Economic Components

```typescript
// src/components/economy/atoms/__tests__/AtomicEconomicComponents.test.tsx
import { render, screen } from '@testing-library/react';
import { EconomicMetricCard } from '~/components/economy/atoms/AtomicEconomicComponents';

describe('EconomicMetricCard', () => {
  it('displays metric value with correct formatting', () => {
    render(
      <EconomicMetricCard
        label="GDP"
        value={25000000000}
        format="currency"
      />
    );

    expect(screen.getByText('GDP')).toBeInTheDocument();
    expect(screen.getByText(/\$25\.0B/)).toBeInTheDocument();
  });

  it('shows trend indicator', () => {
    render(
      <EconomicMetricCard
        label="Growth Rate"
        value={3.5}
        format="percentage"
        trend="up"
      />
    );

    expect(screen.getByTestId('trend-up')).toBeInTheDocument();
  });

  it('handles missing data gracefully', () => {
    render(
      <EconomicMetricCard
        label="Unknown Metric"
        value={null}
        format="number"
      />
    );

    expect(screen.getByText(/N\/A|No data/i)).toBeInTheDocument();
  });
});
```

---

## Testing tRPC Routers

### Router Test Pattern

```typescript
// Pattern for testing any tRPC router
import { appRouter } from '~/server/api/root';
import { createInnerTRPCContext } from '~/server/api/trpc';

describe('Router Name', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const ctx = await createInnerTRPCContext({
      session: { user: { id: 'test-user' } },
      headers: new Headers(),
    });
    caller = appRouter.createCaller(ctx);
  });

  it('tests endpoint', async () => {
    const result = await caller.routerName.endpoint({ input: 'value' });
    expect(result).toBeDefined();
  });
});
```

### Testing Protected Endpoints

```typescript
// src/server/api/routers/__tests__/admin.test.ts
describe('Admin Router - Protected Endpoints', () => {
  it('rejects unauthorized users', async () => {
    const ctx = await createInnerTRPCContext({
      session: null, // No session
      headers: new Headers(),
    });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.deleteCountry({ id: 'test-id' })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('rejects non-admin users', async () => {
    const ctx = await createInnerTRPCContext({
      session: { user: { id: 'user-1', role: 'USER' } },
      headers: new Headers(),
    });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.deleteCountry({ id: 'test-id' })
    ).rejects.toThrow('FORBIDDEN');
  });

  it('allows admin users', async () => {
    const ctx = await createInnerTRPCContext({
      session: { user: { id: 'admin-1', role: 'ADMIN' } },
      headers: new Headers(),
    });
    const caller = appRouter.createCaller(ctx);

    // Should not throw
    await expect(
      caller.admin.getStats()
    ).resolves.toBeDefined();
  });
});
```

---

## Test File Organization

### Directory Structure

```
/ixwiki/public/projects/ixstats/
├── src/
│   ├── app/
│   │   └── builder/
│   │       └── __tests__/              # Component tests
│   ├── lib/
│   │   └── __tests__/                  # Utility tests
│   ├── server/
│   │   └── api/
│   │       └── routers/
│   │           └── __tests__/          # Router tests
│   └── tests/
│       ├── components/                 # Shared component tests
│       └── validators/                 # Validation tests
└── tests/
    ├── e2e/                            # E2E tests
    │   ├── global.setup.ts
    │   ├── auth.setup.ts
    │   └── *.spec.ts
    └── setup.ts                        # Jest setup
```

### Naming Conventions

- **Unit tests**: `*.test.ts` or `*.test.tsx`
- **E2E tests**: `*.spec.ts`
- **Test directories**: `__tests__/`
- **Setup files**: `setup.ts`, `*.setup.ts`

---

## Running Tests

### Test Commands

```bash
# Unit tests (Jest)
npm test                    # Run all unit tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report

# E2E tests (Playwright)
npx playwright test                    # Run all E2E tests
npx playwright test auth.spec.ts       # Run specific test
npx playwright test --headed           # With browser UI
npx playwright test --debug            # Debug mode
npx playwright show-report             # View HTML report

# Integration/Audit tests
npm run test:health         # API health check
npm run test:db             # Database integrity
npm run test:crud           # CRUD operations
npm run test:economics      # Economic calculations
npm run test:wiring         # Live data wiring
npm run test:critical       # All critical tests

# Comprehensive testing
npm run verify:production   # typecheck + lint + critical tests
```

### Running Specific Tests

```bash
# Jest - specific file
npm test -- atomic-client-calculations.test.ts

# Jest - specific test suite
npm test -- --testNamePattern="GDP Growth"

# Playwright - specific browser
npx playwright test --project=chromium

# Playwright - specific directory
npx playwright test tests/e2e/builder-*
```

### CI/CD Test Commands

```bash
# Pre-deployment verification
npm run verify:production

# Full test suite in CI
npm run test:coverage && npx playwright test --reporter=json
```

---

## Mocking Strategies

### Mocking External APIs

```typescript
// Mock IxWiki API
jest.mock('~/lib/country-flag-service', () => ({
  fetchCountryFlag: jest.fn().mockResolvedValue({
    url: 'https://example.com/flag.png',
    metadata: { width: 100, height: 60 }
  }),
  fetchCountryData: jest.fn().mockResolvedValue({
    name: 'Test Country',
    population: 1000000,
    gdp: 25000000000
  })
}));
```

### Mocking Database

```typescript
// Mock Prisma client
jest.mock('~/server/db', () => ({
  db: {
    country: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'test-id' }),
    },
  },
}));
```

### Mocking Authentication

```typescript
// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  auth: jest.fn(() => ({
    userId: 'test-user-id',
    sessionId: 'test-session-id',
  })),
  currentUser: jest.fn(() => ({
    id: 'test-user-id',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  })),
}));
```

### Mocking tRPC Context

```typescript
// Create mock tRPC context
export function createMockContext() {
  return {
    session: {
      user: { id: 'test-user', email: 'test@example.com' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    db: mockDb,
  };
}
```

---

## Test Data Setup

### Test Fixtures

```typescript
// tests/fixtures/countries.ts
export const testCountries = {
  developed: {
    name: 'Test Developed Country',
    slug: 'test-developed',
    baselinePopulation: 50000000,
    baselineGdpPerCapita: 55000,
    economicTier: 'developed',
  },
  emerging: {
    name: 'Test Emerging Country',
    slug: 'test-emerging',
    baselinePopulation: 10000000,
    baselineGdpPerCapita: 15000,
    economicTier: 'emerging',
  },
};

export const testEconomicData = {
  year2025: {
    year: 2025,
    gdp: 100000000000,
    gdpPerCapita: 50000,
    gdpGrowthRate: 3.5,
    population: 2000000,
  },
};
```

### Database Seeding

```typescript
// tests/helpers/seed.ts
export async function seedTestData() {
  const country = await db.country.create({
    data: testCountries.developed,
  });

  await db.economicData.create({
    data: {
      ...testEconomicData.year2025,
      countryId: country.id,
    },
  });

  return { country };
}

export async function cleanupTestData() {
  await db.economicData.deleteMany({
    where: { country: { slug: { startsWith: 'test-' } } },
  });
  await db.country.deleteMany({
    where: { slug: { startsWith: 'test-' } },
  });
}
```

---

## Coverage Requirements

### Coverage Goals

- **Unit Tests**: 80% coverage minimum
- **Integration Tests**: All tRPC endpoints covered
- **E2E Tests**: Critical user workflows covered

### Running Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Configuration

```json
{
  "collectCoverageFrom": [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{ts,tsx}",
    "!src/**/index.ts"
  ],
  "coverageThresholds": {
    "global": {
      "branches": 70,
      "functions": 70,
      "lines": 80,
      "statements": 80
    }
  }
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Pre-commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
npm run typecheck
npm test -- --findRelatedTests
```

---

## Additional Resources

- **Test Files**: `/ixwiki/public/projects/ixstats/tests/`
- **Audit Scripts**: `/ixwiki/public/projects/ixstats/scripts/audit/`
- **Documentation**: `/ixwiki/public/projects/ixstats/docs/`

### Related Documentation

- `DEPLOYMENT_GUIDE.md` - Production deployment procedures
- `README.md` - Project overview
- `CLAUDE.md` - Development guidelines

---

**Document Version**: 1.1.0
**Last Updated**: October 2025
**Maintained By**: IxStats Development Team
