# Testing Practices

**Last updated:** October 2025

IxStats combines automated Jest suites, wiring audits, and manual verification through the help system.

## Test Suites
- **Jest (unit/integration)** – Configured in `package.json`; targets `src/**/*.{test,spec}.ts`
- **Router Tests** – Located in `src/server/api/routers/__tests__` (e.g., `diplomaticIntelligence.test.ts`)
- **Playwright (planned)** – Configuration ready in `playwright.config.ts`; add scenarios as browser automation expands

## Commands
| Command | Description |
| --- | --- |
| `npm run test` | Executes Jest test suites |
| `npm run test:watch` | Watch mode for Jest |
| `npm run test:coverage` | Coverage report (text + lcov + HTML) |
| `npm run test:critical` | Limited smoke suite (CRUD, health, database) |
| `npm run audit:wiring` | Ensures tRPC procedures are wired to live implementations |
| `npm run test:crud` | Exercises CRUD endpoints for regression |
| `npm run test:economics` | Validates economic formulas and projections |

## Fixtures & Mocks
- `tests/__mocks__` – Contains SuperJSON and other mocks used by tRPC tests
- `tests/setup.ts` – Registers jest-dom and global test utilities

## Data Considerations
- **Migration Notice (October 2025)**: Tests now use PostgreSQL database (`localhost:5433/ixstats`)
- Local tests connect to PostgreSQL database (migrated from SQLite)
- Automated scripts may require seeded data; run `npm run db:setup` before executing test suites
- Legacy SQLite test databases archived in `prisma/backups/sqlite-legacy/`

## Manual QA Checklist
1. Verify MyCountry tabs load with seeded data
2. Check `/help` navigation and article rendering
3. Trigger diplomatic mission creation and ensure live feeds update (production WebSocket only)
4. Confirm achievements unlock flow using test data

Expand this document as new suites, tooling, or CI pipelines are introduced. Treat test updates as part of definition-of-done for features.
