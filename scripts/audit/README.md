# Audit & Verification Scripts

**Last updated:** October 2025

Automation under `scripts/audit` provides fast confidence in API wiring, database health, and economic calculations. Invoke these scripts via `tsx` or the corresponding npm scripts.

## Script Catalog
| Script | npm alias | Purpose |
| --- | --- | --- |
| `run-all-tests.ts` | `npm run test:all` | Runs the full audit suite with optional filters (`--only=crud,health`) |
| `test-all-crud-operations.ts` | `npm run test:crud` | Exercises CRUD endpoints across countries, users, diplomacy, policies, and social content |
| `test-api-health.ts` | `npm run test:health` | Pings every tRPC procedure for availability and latency |
| `verify-database-integrity.ts` | `npm run test:db` | Checks referential integrity, indexes, and record counts |
| `verify-economic-calculations.ts` | `npm run test:economics` | Validates tier calculations, projections, and growth models |
| `verify-live-data-wiring.ts` | `npm run audit:wiring` | Confirms React components consume live tRPC data rather than mock fixtures |
| `audit-production-urls.ts` | `npm run audit:urls` | Ensures key routes resolve under the configured base path |
| `audit-flag-urls.ts` | `npm run audit:flags` | Verifies flag/coat-of-arms assets resolve |

## Usage Examples
```bash
# Run everything
npm run test:all

# Focus on CRUD + database integrity
npm run test:crud
npm run test:db

# Regenerate wiring report in JSON format
npm run audit:wiring -- --json-only
```

## Exit Codes
- `0` – All checks passed
- `1` – Critical failures (halting deployment)
- `2` – Non-blocking warnings; review output before proceeding

## Recommended Deployment Flow
1. `npm run audit:wiring`
2. `npm run test:crud`
3. `npm run test:db`
4. `npm run test:health`
5. `npm run test:economics`
6. Review reports under `scripts/audit/reports/` (if generated)

Update this README whenever new audit scripts are added or existing scripts change behaviour.
