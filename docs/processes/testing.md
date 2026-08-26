# Testing & Type Safety Practices

**Test Runner**: Jest 30.4.2 (@swc/jest) · TypeScript 7.0.0 · Bun 1.4 Runtime  
**Coverage**: Unit Tests, Integration Tests, Wire Audits, Type Partition Gates, Architecture Guards

---

## 1. Test Execution Commands

```bash
# Run all Jest unit and integration tests
bun run test

# Run sub-second parallel unit tests using Bun's native runner
bun run test:unit

# Run a single test file or pattern
bun run test -- src/lib/wiki/roster-parser.test.ts

# Run Jest in watch mode during development
bun run test:watch

# Generate code coverage report
bun run test:coverage
```

---

## 2. Type Safety Verification (TypeScript 7.0 Native Go Engine)

With **TypeScript 7.0**, `tsc` is a native Go binary featuring shared-memory parallel checking and multi-threading (`--checkers`), reducing memory footprint by ~80% and dropping typechecking time to ~2s:

```bash
# Sequentially run all four sub-project typechecks (0 error gate)
bun run typecheck

# Individual Sub-Project Checks:
bun run typecheck:ui      # Client-side components, pages, hooks
bun run typecheck:server  # Server routers, services, background jobs
bun run typecheck:trpc    # tRPC router definitions and schemas
bun run typecheck:db      # Prisma client and database helpers

# Typecheck a single file
bun run typecheck:file src/lib/onoma/language-families.ts
```

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

---

## 5. Test Suite Invariants & Audit

For the comprehensive audit of all 122 test files, value stack rankings (Tiers 0–4), test runner environment notes, and candidates for pruning, see:
- [**Test Suite Audit & Justification (August 2026)**](../audits/test-suite-audit-and-justification.md)


