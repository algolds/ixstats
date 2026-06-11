# Testing Practices

**Last updated:** May 2026

IxStats combines automated Jest suites, wiring audits, and manual verification through the help system.

## Test Suites
- **Jest (unit/integration)** – Configured in `package.json`; targets `src/**/*.{test,spec}.ts`
- **Router Tests** – Located in `src/server/api/routers/__tests__` (e.g., `diplomaticIntelligence.test.ts`)
- **Playwright (planned)** — Add scenarios as browser automation expands

## Commands
| Command | Description |
| --- | --- |
| `bun run test` | Executes Jest test suites |
| `bun run test:watch` | Watch mode for Jest |
| `bun run test:coverage` | Coverage report (text + lcov + HTML) |
| `bun run test:critical` | Limited smoke suite (CRUD, health, database) |
| `bun run audit:wiring` | Ensures tRPC procedures are wired to live implementations |
| `bun run test:crud` | Exercises CRUD endpoints for regression |
| `bun run test:economics` | Validates economic formulas and projections |

## Fixtures & Mocks
- `tests/__mocks__` – Contains SuperJSON and other mocks used by tRPC tests
- `tests/setup.ts` – Registers jest-dom and global test utilities

## Data Considerations
- Local tests connect to PostgreSQL database
- Automated scripts may require seeded data; run `bun run db:setup` before executing test suites

## Manual QA Checklist
1. Verify MyCountry tabs load with seeded data
2. Check `/help` navigation and article rendering
3. Trigger diplomatic mission creation and ensure live feeds update (production WebSocket only)
4. Confirm achievements unlock flow using test data

Expand this document as new suites, tooling, or CI pipelines are introduced. Treat test updates as part of definition-of-done for features.

## Schema Validation

> **Merged from:** docs/processes/schema-validation.md

The IxStats platform uses a dual-validation approach: Prisma models define the database schema, and Zod schemas provide runtime validation for tRPC endpoints. Maintaining alignment between these two systems is critical for preventing runtime errors and ensuring data integrity.

### Schema Pattern Standards

**Create/Update/Response Schema Pattern** — For each model requiring CRUD operations, implement three schema types:
- Base schema with all fields and proper validation
- Create schema = base schema (all required fields with defaults)
- Update schema = base schema `.partial()` (all fields optional)
- Response schema = base schema (matches Prisma model for type safety)

**Common Field Validation:**
```typescript
const commonFields = {
  isActive: z.boolean().default(true),
  countryId: z.string().min(1, "Country ID is required"),
  userId: z.string().min(1, "User ID is required"),
  createdAt: z.date().optional(), // Auto-managed, exclude from input schemas
  updatedAt: z.date().optional(), // Auto-managed, exclude from input schemas
};
```

**Field Type Mappings:**

| Prisma Type | Zod Type | Notes |
|---|---|---|
| `String` | `z.string()` | Use `.min(1)` for required strings |
| `Int` | `z.number().int()` | Use `.nonnegative()` for counts |
| `Float` | `z.number()` | Use `.min(0)` for positive values |
| `Boolean` | `z.boolean()` | Use `.default(true)` for isActive |
| `DateTime` | `z.date()` | Exclude from input schemas |
| `Json` | `z.record()` or `z.array()` | Use appropriate JSON validation |

### Development Workflow

**Adding New Models:**
1. Define the Prisma model in `prisma/schema/`
2. Create corresponding Zod schemas following the pattern above
3. Add tRPC procedures using appropriate schemas
4. Run validation to ensure alignment

**Modifying Existing Models:**
1. Update Prisma schema with new fields
2. Update corresponding Zod schemas
3. Run migration to update database
4. Validate alignment before committing

**Adding New tRPC Endpoints:**
- Use appropriate schema (create vs update)
- Validate input with Zod before database operations
- Avoid spread operators without explicit validation
- Always prefer `modelCreateSchema.parse(input.data)` over `z.any()`

### Validation Scripts

| Script | Purpose |
|---|---|
| `validate:schemas` | Detects mismatches between Prisma models and Zod schemas (missing fields, type mismatches, default discrepancies) |
| `audit:coverage` | Ensures all user-facing models have proper CRUD operations; reports coverage by model and router |
| `validate:migrations` | Validates migration safety and schema drift (pending migrations, breaking changes, table existence) |
| `test:db` | Validates database integrity (referential integrity, isActive consistency, orphaned records) |

### Common Issues

| Issue | Solution |
|---|---|
| Missing `isActive` field | Add `isActive: z.boolean().default(true)` to Zod schema |
| Type mismatches | Ensure Prisma `Int` → Zod `.number().int()`, `Float` → `.number()`, `Boolean` → `.boolean()` |
| Spread operator without validation | Use `modelCreateSchema.parse(input.data)` instead of raw spread |
| Missing CRUD operations | Identify from coverage report, add appropriate tRPC procedures with proper schemas |

### Best Practices

- Always include `isActive` for models that need soft delete
- Use appropriate defaults for optional fields
- Validate required fields with proper constraints
- Exclude auto-managed fields (createdAt, updatedAt) from input schemas
- Run validation scripts before committing
- Test CRUD operations for all new models
- Review validation reports regularly
- Update schemas when Prisma models change
