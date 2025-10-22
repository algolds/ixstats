# Load Testing Quick Reference Card

## NPM Scripts (Recommended)

```bash
# Run all tests (comprehensive suite)
npm run load:all

# Quick tests (reduced iterations, faster results)
npm run load:quick

# Individual tests
npm run load:api              # API load testing
npm run load:rate-limiting    # Rate limit validation
npm run load:database         # Database performance
npm run load:builder          # E2E builder flow

# Stress tests (high load scenarios)
npm run load:api:stress       # 200 concurrent users, 60s
npm run load:database:stress  # 20 concurrent writes, 100 iterations
npm run load:builder:stress   # 50 builds, 10 concurrent

# Pre-production validation (all load tests + verification)
npm run preproduction
```

## Direct Script Execution

```bash
# API Load Testing
tsx scripts/load-testing/test-api-load.ts
tsx scripts/load-testing/test-api-load.ts --users=100 --duration=60

# Rate Limiting
tsx scripts/load-testing/test-rate-limiting.ts

# Database Performance
tsx scripts/load-testing/test-database-performance.ts
tsx scripts/load-testing/test-database-performance.ts --concurrent=20

# Builder Flow
tsx scripts/load-testing/test-builder-flow.ts
tsx scripts/load-testing/test-builder-flow.ts --iterations=20
```

## Shell Script Runner

```bash
# All tests
./scripts/load-testing/run-all-tests.sh

# Quick mode (reduced iterations)
./scripts/load-testing/run-all-tests.sh --quick

# Selective execution
./scripts/load-testing/run-all-tests.sh --skip-database
./scripts/load-testing/run-all-tests.sh --api-only
```

## Common Options

### API Load Test
- `--users=N` - Concurrent users (default: 50)
- `--duration=N` - Test duration in seconds (default: 30)
- `--endpoint=NAME` - Specific endpoint or "all"
- `--url=URL` - Base URL
- `--token=TOKEN` - Auth token

### Rate Limiting Test
- `--url=URL` - Base URL
- `--token=TOKEN` - Auth token
- `--admin-token=TOKEN` - Admin token
- `--test-redis=true` - Show Redis fallback info

### Database Performance
- `--concurrent=N` - Concurrent writes (default: 10)
- `--iterations=N` - Test iterations (default: 50)
- `--skip-complex=true` - Skip complex queries
- `--skip-transactions=true` - Skip transaction tests
- `--cleanup=false` - Keep test data

### Builder Flow
- `--iterations=N` - Number of builds (default: 10)
- `--concurrent=N` - Concurrent builds (default: 3)
- `--test-rollback=true` - Test rollback
- `--test-synergies=true` - Test synergies
- `--cleanup=false` - Keep test data

## Environment Variables

Create `.env.test` or set in your shell:

```bash
BASE_URL=http://localhost:3000
TEST_AUTH_TOKEN=your_clerk_session_token
TEST_ADMIN_TOKEN=your_admin_session_token
```

## Performance Targets

| Test Type | p95 Target | p99 Target | Error Rate |
|-----------|-----------|-----------|------------|
| Read Operations | <500ms | <1000ms | <1% |
| Write Operations | <1000ms | <2000ms | <1% |
| Heavy Operations | <2000ms | <5000ms | <5% |

## Exit Codes

- **0** = All tests passed ✓
- **1** = One or more tests failed ✗

## Pre-Production Checklist

```bash
# 1. Run full load test suite
npm run load:all

# 2. Run verification tests
npm run verify:production

# 3. Combined pre-production check
npm run preproduction
```

All must pass before v1.2 deployment.

## Troubleshooting

```bash
# Check database connection
npm run db:setup

# View detailed logs
cat scripts/load-testing/load-test-results-*.log

# Clean up test data manually
tsx scripts/load-testing/cleanup-test-data.ts
```

## Example Workflow

### Development Testing
```bash
# Start dev server
npm run dev

# In another terminal, run quick tests
npm run load:quick
```

### Pre-Production Validation
```bash
# Build production
npm run build

# Start production server
npm run start:prod

# Run full load tests
npm run load:all

# Run verification
npm run verify:production
```

### CI/CD Integration
```yaml
- name: Load Testing
  run: npm run load:all

- name: Verify Production
  run: npm run verify:production
```

---

For detailed documentation, see: `scripts/load-testing/README.md`
