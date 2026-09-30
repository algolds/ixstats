# Testing & Type Safety Practices

**Test Runner**: Jest 30.4.2 (@swc/jest, jsdom) · TypeScript 7.0.2 · Bun 1.4 Runtime  
**Coverage**: Unit Tests, Integration Tests, Wire Audits, Type Partition Gates, Architecture Guards

---

## 1. Test Execution Commands

```bash
# Run all Jest unit and integration tests
bun run test

# Run src/tests/lib in parallel using Bun's native runner
bun run test:unit

# CI entrypoint: Jest with the flaky-test quarantine list
bun run test:ci

# Run a single test file or pattern
bun run test -- src/tests/lib/onoma/markov-chain.test.ts

# Run Jest in watch mode during development
bun run test:watch

# Generate code coverage report
bun run test:coverage
```

---

## 2. Type Safety Verification (TypeScript 7.0 Native Go Engine)

With **TypeScript 7.0**, `tsc` is a native Go binary featuring shared-memory parallel checking and multi-threading (`--checkers`), reducing memory footprint by ~80% and dropping typechecking time to ~2s:

```bash
# Sequentially run all four sub-project typechecks (0 error gate; CI runs ui, server and trpc)
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

# Cross-reference Prisma models against tRPC router endpoints (coverage gaps, unused models)
bun run audit:wiring

# Verify CRUD endpoint health
bun run test:crud

# Verify economic formula correctness and balance limits
bun run test:economics
```

---

## 4. Centralized Test Suite Layout (`src/tests/`)

Jest unit and integration test files are centralized in `src/tests/` (320+ files) organized by domain; a few legacy tests remain co-located (`src/app/builder/__tests__/`, `src/lib/sports/analysis.test.ts`):

```
src/tests/
├── app/                  # Route handlers & builder component tests
├── architecture/         # Entrypoint, Facet and import-boundary guard tests
├── auth/                 # Permissions, RBAC, and CASL abilities tests
├── components/           # UI components, modals, and panel tests
├── content/ · context/   # Help-content rendering, React context tests
├── fixtures/ · helpers/  # Shared fixtures and mock db / router-context helpers
├── hooks/                # Custom React hook tests
├── lib/                  # Library & engine tests (core, onoma, maps, worldgen, statecraft, realms, wiki-os)
├── scripts/              # Tests for audit/verification scripts (audit-arch, docs sync, quarantine)
├── security/             # XSS and server-side sanitization tests
├── server/               # tRPC routers, modules, realms, cron, and query tests
├── sports/               # Sports simulation, tactics, and transfers integration tests
├── trpc/                 # tRPC client transformer tests
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

For the August 2026 audit of the test suite (122 files at the time), value stack rankings (Tiers 0–4), test runner environment notes, and candidates for pruning, see:
- [**Test Suite Audit & Justification (August 2026)**](../audits/test-suite-audit-and-justification.md)


