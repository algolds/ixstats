# Audit & Verification Scripts

**Last updated:** October 2025

Automation under `scripts/audit` provides fast confidence in API wiring, database health, and economic calculations. Invoke these scripts via `tsx` or the corresponding bun scripts.

## Script Catalog
| Script | bun alias | Purpose |
| --- | --- | --- |
| `run-all-tests.ts` | `bun run test:all` | Runs the full audit suite with optional filters (`--only=crud,health`) |
| `test-all-crud-operations.ts` | `bun run test:crud` | Exercises CRUD endpoints across countries, users, diplomacy, policies, and social content |
| `test-api-health.ts` | `bun run test:health` | Pings every tRPC procedure for availability and latency |
| `verify-database-integrity.ts` | `bun run test:db` | Checks referential integrity, indexes, and record counts |
| `verify-economic-calculations.ts` | `bun run test:economics` | Validates tier calculations, projections, and growth models |
| `verify-live-data-wiring.ts` | `bun run audit:wiring` | Confirms React components consume live tRPC data rather than mock fixtures |
| `audit-production-urls.ts` | `bun run audit:urls` | Ensures key routes resolve under the configured base path |
| `audit-flag-urls.ts` | `bun run audit:flags` | Verifies flag/coat-of-arms assets resolve |

## Usage Examples
```bash
# Run everything
bun run test:all

# Focus on CRUD + database integrity
bun run test:crud
bun run test:db

# Regenerate wiring report in JSON format
bun run audit:wiring -- --json-only
```

## Exit Codes
- `0` – All checks passed
- `1` – Critical failures (halting deployment)
- `2` – Non-blocking warnings; review output before proceeding

## Recommended Deployment Flow
1. `bun run audit:wiring`
2. `bun run test:crud`
3. `bun run test:db`
4. `bun run test:health`
5. `bun run test:economics`
6. Review reports under `scripts/audit/reports/` (if generated)

Update this README whenever new audit scripts are added or existing scripts change behaviour.
