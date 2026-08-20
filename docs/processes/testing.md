# Testing & Type Safety Practices

**Test Runner**: Jest 30.4.2 · TypeScript 5.9.3 · Bun Runtime  
**Coverage**: Unit Tests, Integration Tests, Wire Audits, Type Partition Gates, Architecture Guards

---

## 1. Test Execution Commands

```bash
# Run all Jest unit and integration tests
bun run test

# Run a single test file or pattern
bun run test -- src/lib/wiki/roster-parser.test.ts

# Run Jest in watch mode during development
bun run test:watch

# Generate code coverage report
bun run test:coverage
```

---

## 2. Partitioned Type Safety Verification

Due to the size of the codebase (210+ routes, 90 routers, 296 Prisma models), typechecking is split across sub-projects with defined safe heap bounds to prevent out-of-memory errors on 8GB host servers:

```bash
# Sequentially run all four sub-project typechecks (0 error gate)
bun run typecheck

# Individual Sub-Project Checks:
bun run typecheck:ui      # Client-side components, pages, hooks (6144MB heap)
bun run typecheck:server  # Server routers, services, background jobs (6144MB heap)
bun run typecheck:trpc    # tRPC router definitions and schemas (4096MB heap)
bun run typecheck:db      # Prisma client and database helpers (4096MB heap)

# Typecheck a single file
bun run typecheck:file src/lib/onoma/language-families.ts
```

> [!CAUTION]
> **Strict Rule**: NEVER run unpartitioned global `tsc --noEmit` or `npm run typecheck:full`. It causes node heap exhaustion (>7GB RAM) and server OOM crashes.

---

## 3. Architecture & Wire Audits

```bash
# Verify all router files remain ≤700 lines and enforce zero cross-router imports
bun run audit:arch

# Validate that all tRPC procedures are wired to live implementations
bun run audit:wiring

# Verify CRUD endpoint health
bun run test:crud

# Verify economic formula correctness and balance limits
bun run test:economics
```

---

## 4. Centralized Test Suite Layout (`src/tests/`)

All Jest unit and integration test files are centralized in `src/tests/` organized by domain:

```
src/tests/
├── app/                  # Route handlers & builder component tests
├── auth/                 # Permissions, RBAC, and CASL abilities tests
├── components/           # UI components, modals, and panel tests
├── hooks/                # Custom React hook tests
├── lib/                  # Library & engine tests (core, onoma, maps, worldgen, statecraft, sports, wiki-os)
├── security/             # XSS sanitization and rate-limiting tests
├── server/               # tRPC routers, mutations, and query tests
├── sports/               # Sports simulation, tactics, and wages integration tests
└── validators/           # Government and tax schema validators
```

### Writing Tests with Canonical Path Aliases:
Always use `~/` path aliases rather than relative `../` traversal:

```typescript
// src/tests/lib/onoma/markov-chain.test.ts
import { MarkovChain } from "~/lib/onoma/markov-chain";

describe("MarkovChain", () => {
  it("should capitalize words correctly", () => {
    expect(MarkovChain.capitalize("roma")).toBe("Roma");
  });
});
```

