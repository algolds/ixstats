# Audit & Verification Scripts

**Last updated:** September 2026

Automation under `scripts/audit` provides fast confidence in architecture boundaries, API wiring, database health, and economic calculations. Invoke these scripts with `bun <path>` or the corresponding `bun run` alias.

## Script Catalog
| Script | bun alias | Purpose |
| --- | --- | --- |
| `run-all-tests.ts` | `bun run test:all` | Runs the full audit suite with optional filters (`--only=crud,health`) |
| `test-all-crud-operations.ts` | `bun run test:crud` | Exercises CRUD endpoints across countries, users, diplomacy, policies, and social content |
| `test-api-health.ts` | `bun run test:health` | Pings every tRPC procedure for availability and latency |
| `test-builder-performance.ts` | `bun run test:builder-perf` | Benchmarks builder system performance (government create, queries with limits) |
| `verify-database-integrity.ts` | `bun run test:db` | Checks referential integrity, indexes, and record counts |
| `verify-economic-calculations.ts` | `bun run test:economics` | Validates tier calculations, projections, and growth models |
| `verify-live-data-wiring.ts` | `bun run test:wiring` | Confirms React components consume live tRPC data rather than mock fixtures |
| `audit-trpc-wiring.ts` | `bun run audit:wiring` (`audit:wiring:json`) | Cross-references Prisma models against tRPC router endpoints; flags missing endpoints and unused models |
| `audit-arch.ts` (+ `router-residue.ts`) | `bun run audit:arch` (`audit:arch:update`) | Architecture guard (CI): file-size ceilings with a ratchet baseline (`arch-baseline.json`), no cross-router imports, server boundary leaks, split residue (`router-residue-baseline.json`) |
| `audit-country-idor.ts` | `bun run audit:idor` | Plan 332: every country-data mutation must check caller ownership (`idor-allowlist.json`) |
| `audit-components.ts` | `bun run audit:components` (`:json`) | Import-graph reachability audit for unused components |
| `audit-schema-coverage.ts` | `bun run audit:coverage` | Schema coverage report (writes to `scripts/audit/reports/`) |
| `audit-v1.ts` | `bun run audit:v1` (`:prod`) | Legacy V1 production-readiness audit |
| `audit-vault-exploits.ts` | `bun run audit:vault-exploits` (`:json`, `:apply`) | Vault ledger report for the M0 exploits (store charges not matching item prices, repeat cosmetic buys, repeated one-time / NS deck-import bonuses) plus the planned corrections; `:apply` writes them as idempotent `ADMIN_ADJUSTMENT` rows (rules in `src/lib/vault/exploit-corrections.ts`; back up first) |
| `audit-wikios-db.ts` | `bun run audit:wikios-db` | WikiOS PostgreSQL store self-audit |
| `audit-wikios-parity.ts` | `bun run audit:wikios-parity` | MediaWiki ↔ PostgreSQL WikiOS parity audit |
| `verify-country-links.ts` | `bun run audit:country-links` | User ↔ country linkage integrity |
| `validate-schema-alignment.ts` | `bun run validate:schemas` | Prisma model fields vs Zod input schemas |
| `validate-migration-safety.ts` | `bun run validate:migrations` | Migration safety and schema drift |
| `validate-script-targets.ts` | `bun run validate:script-targets` | `package.json` / tsconfig / CI script targets exist; no banned package managers (CI) |

URL and flag audits live one level up: `scripts/audit-production-urls.ts` (`bun run audit:urls`, route resolution under the base path) and `scripts/audit-flag-urls.ts` (`bun run audit:flags`, flag asset resolution).

## Usage Examples
```bash
# Run everything
bun run test:all

# Focus on CRUD + database integrity
bun run test:crud
bun run test:db

# Regenerate wiring report in JSON format
bun run audit:wiring:json
```

## Exit Codes
- `0` – All checks passed
- `1` – Critical failures (halting deployment)
- `2` – Non-critical failures (`run-all-tests.ts`); review output before proceeding

## Recommended Deployment Flow
`bun run verify:production` bundles `test:critical` (crud, health, database), `validate:schemas`, and `lint`. For a fuller pass:

1. `bun run audit:arch`
2. `bun run audit:wiring`
3. `bun run test:crud`
4. `bun run test:db`
5. `bun run test:health`
6. `bun run test:economics`
7. Review reports under `scripts/audit/reports/` (if generated)

Update this README whenever new audit scripts are added or existing scripts change behaviour.
