# IxStats Load Testing Suite v1.0

Comprehensive load testing infrastructure for IxStats v1.2 production deployment validation.

## Overview

This suite provides four specialized testing scripts to validate platform performance under production load:

1. **API Load Testing** - Tests endpoint performance under concurrent load
2. **Rate Limiting Validation** - Ensures rate limiting works correctly
3. **Database Performance** - Tests database operations and connection pool
4. **E2E Builder Flow** - Validates complete country builder workflow

## Prerequisites

### Required Environment Variables

Create a `.env.test` file in the project root with the following variables:

```bash
# Base URLs
BASE_URL=http://localhost:3000                    # For development testing
# BASE_URL=https://your-domain.com/projects/ixstats  # For production testing

# Authentication Tokens (optional but recommended)
TEST_AUTH_TOKEN=your_clerk_session_token_here     # For authenticated endpoints
TEST_ADMIN_TOKEN=your_admin_session_token_here    # For admin endpoints

# Database (will use default from .env)
DATABASE_URL=file:./prisma/dev.db                 # SQLite (dev)
# DATABASE_URL=postgresql://user:pass@host:5432/db  # PostgreSQL (prod)

# Rate Limiting
RATE_LIMIT_ENABLED=true
REDIS_ENABLED=false  # Set to true if testing with Redis
REDIS_URL=redis://localhost:6379  # Only if REDIS_ENABLED=true
```

### Dependencies

All dependencies are already included in the project's `package.json`. No additional installation required.

```bash
# Verify dependencies are installed
npm install
```

## Test Scripts

### 1. API Load Testing (`test-api-load.ts`)

Tests API endpoints under concurrent user load.

**What it tests:**
- Response times (p50, p95, p99)
- Error rates under load
- Concurrent user handling (50, 100, 200+ users)
- Rate limiting behavior
- Read vs. write vs. heavy operation performance

**Usage:**

```bash
# Basic test (50 users, 30 seconds per endpoint)
tsx scripts/load-testing/test-api-load.ts

# Custom configuration
tsx scripts/load-testing/test-api-load.ts \
  --users=100 \
  --duration=60 \
  --url=http://localhost:3000 \
  --token=your_auth_token

# Test specific endpoint
tsx scripts/load-testing/test-api-load.ts \
  --endpoint="Get All Countries" \
  --users=200
```

**Options:**
- `--users=N` - Number of concurrent users (default: 50)
- `--duration=N` - Test duration in seconds per endpoint (default: 30)
- `--endpoint=NAME` - Test specific endpoint or "all" (default: all)
- `--url=URL` - Base URL (default: http://localhost:3000)
- `--token=TOKEN` - Authentication token for protected endpoints

**Performance Targets:**
- **Read operations**: p95 < 500ms, p99 < 1000ms, error rate < 1%
- **Write operations**: p95 < 1000ms, p99 < 2000ms, error rate < 1%
- **Heavy operations**: p95 < 2000ms, p99 < 5000ms, error rate < 5%

**Example Output:**

```
╔═══════════════════════════════════════════════════════════════════╗
║              IxStats API Load Testing Suite v1.0                 ║
╚═══════════════════════════════════════════════════════════════════╝

Testing: Get All Countries
Category: READ | Method: GET | Auth: Public

[========================================] 100.0% | Requests: 1500 | Success: 1450 | Failed: 0 | Rate Limited: 50

=== Test Results ===
Total Requests:      1500
Successful:          1450 (96.67%)
Failed:              0 (0.00%)
Rate Limited:        50 (3.33%)
Requests/Second:     50.00

=== Response Times ===
Average:             245.32ms
Min:                 89.12ms
Max:                 876.45ms
P50 (Median):        238.56ms ✓
P95:                 456.23ms ✓
P99:                 723.89ms ✓

Error Rate:          0.00% ✓

=== Overall Status ===
PASSED ✓
```

---

### 2. Rate Limiting Test (`test-rate-limiting.ts`)

Validates rate limiting configuration and behavior.

**What it tests:**
- Public endpoint limits (30 req/min)
- Standard query limits (120 req/min)
- Mutation limits (100, 60, 10 req/min depending on type)
- Admin endpoint limits (100 req/min)
- Legitimate traffic handling
- Excessive traffic blocking
- Redis fallback to in-memory

**Usage:**

```bash
# Basic test
tsx scripts/load-testing/test-rate-limiting.ts

# With authentication
tsx scripts/load-testing/test-rate-limiting.ts \
  --token=your_auth_token \
  --admin-token=your_admin_token

# Test Redis fallback (informational)
tsx scripts/load-testing/test-rate-limiting.ts \
  --test-redis=true
```

**Options:**
- `--url=URL` - Base URL (default: http://localhost:3000)
- `--token=TOKEN` - Authentication token for protected endpoints
- `--admin-token=TOKEN` - Admin token for admin endpoints
- `--test-redis=BOOL` - Show Redis fallback instructions (default: false)

**Expected Behavior:**
- Rate limits should trigger within ±10% of configured thresholds
- Legitimate traffic (50% of limit) should never be blocked
- Excessive traffic (150% of limit) should always be blocked
- Rate limit resets should work correctly after window expires

**Example Output:**

```
Testing: Public Endpoint (Countries)
Expected Limit: 30 req/min | Namespace: public

Sending 45 requests to test rate limiting...
[========================================] 100.0% | Success: 30 | Rate Limited: 15

Testing legitimate traffic (15 requests)...

=== Test Results ===
Expected Limit:      30 req/min
Actual Limit:        30 req/min (100.0% accurate) ✓
First Rate Limit:    Request #31

=== Request Statistics ===
Total Requests:      45
Successful:          30
Rate Limited:        15

=== Validation Checks ===
Rate Limit Active:   Yes ✓
Excessive Blocked:   Yes ✓
Legitimate Allowed:  Yes ✓

=== Overall Status ===
PASSED ✓
```

---

### 3. Database Performance Test (`test-database-performance.ts`)

Tests database operations under load.

**What it tests:**
- Complex queries with deep relations
- Concurrent write operations (10+ simultaneous)
- Query execution times
- Connection pool health
- Transaction handling under load
- Race condition detection

**Usage:**

```bash
# Basic test (10 concurrent, 50 iterations)
tsx scripts/load-testing/test-database-performance.ts

# Stress test
tsx scripts/load-testing/test-database-performance.ts \
  --concurrent=20 \
  --iterations=100

# Skip specific tests
tsx scripts/load-testing/test-database-performance.ts \
  --skip-complex=false \
  --skip-transactions=false

# Keep test data (no cleanup)
tsx scripts/load-testing/test-database-performance.ts \
  --cleanup=false
```

**Options:**
- `--concurrent=N` - Number of concurrent write operations (default: 10)
- `--iterations=N` - Number of test iterations (default: 50)
- `--skip-complex=BOOL` - Skip complex query tests (default: false)
- `--skip-transactions=BOOL` - Skip transaction tests (default: false)
- `--cleanup=BOOL` - Cleanup test data after completion (default: true)

**Performance Targets:**
- Complex queries: p95 < 500ms, p99 < 1000ms
- Concurrent writes: >95% success rate, no connection pool exhaustion
- Transactions: p95 < 2000ms, no deadlocks

**Example Output:**

```
=== Testing Complex Queries ===
Query: Country with full relations (economy, government, diplomatic, etc.)

[========================================] 100.0% | Success: 50 | Errors: 0

=== Complex Query Performance Results ===
Total Queries:       50
Successful:          50
Errors:              0

=== Query Times ===
Average:             342.56ms
Min:                 198.23ms
Max:                 756.89ms
P95:                 456.78ms ✓
P99:                 623.45ms ✓

Status: PASSED ✓

=== Testing Concurrent Writes ===
Concurrent Operations: 10

[========================================] 100.0% | Success: 50 | Failed: 0

=== Concurrent Write Results ===
Total Writes:        50
Successful:          50
Failed:              0
Success Rate:        100.00%
Average Time:        876.34ms

=== Health Checks ===
Connection Pool:     HEALTHY ✓
Race Conditions:     NONE ✓

Status: PASSED ✓
```

---

### 4. E2E Builder Flow Test (`test-builder-flow.ts`)

Simulates complete country builder workflow.

**What it tests:**
- 7-step builder process completion
- Complex configurations (tax system, government structure, atomic components)
- Data persistence validation
- Race condition detection
- Transaction rollback handling
- Atomic component synergy detection

**Usage:**

```bash
# Basic test (10 iterations, 3 concurrent)
tsx scripts/load-testing/test-builder-flow.ts

# Stress test
tsx scripts/load-testing/test-builder-flow.ts \
  --iterations=50 \
  --concurrent=10

# Test with additional features
tsx scripts/load-testing/test-builder-flow.ts \
  --test-rollback=true \
  --test-synergies=true

# Keep test data
tsx scripts/load-testing/test-builder-flow.ts \
  --cleanup=false
```

**Options:**
- `--iterations=N` - Number of complete builder flows to test (default: 10)
- `--concurrent=N` - Number of concurrent builder instances (default: 3)
- `--test-rollback=BOOL` - Test transaction rollback (default: false)
- `--test-synergies=BOOL` - Test atomic component synergies (default: true)
- `--cleanup=BOOL` - Cleanup test data after completion (default: true)

**Builder Steps Tested:**
1. National Identity creation
2. Economy setup
3. Government structure
4. Tax system configuration
5. Atomic economic components
6. Diplomatic relations (optional)
7. Final review & validation

**Performance Targets:**
- Success rate: >95%
- Data persistence: >99%
- No race conditions
- Average completion time: <10 seconds per build

**Example Output:**

```
=== Running E2E Builder Flow Tests ===

[========================================] 100.0% | Successful: 10 | Failed: 0

=== Builder Flow Test Results ===
Total Builds:        10
Successful:          10 (100.00%)
Failed:              0 (0.00%)
Avg Completion:      7845.23ms

=== Step Completion Rates ===
✓ Step 1: National Identity: 100.0% (10/10)
✓ Step 2: Economy Setup: 100.0% (10/10)
✓ Step 3: Government Structure: 100.0% (10/10)
✓ Step 4: Tax System: 100.0% (10/10)
✓ Step 5: Atomic Components: 100.0% (10/10)
✓ Step 6: Diplomatic Relations: 100.0% (10/10)
✓ Step 7: Final Review & Submit: 100.0% (10/10)

=== Data Integrity ===
Data Persistence:    100.00% ✓
Race Conditions:     NONE ✓

=== Overall Status ===
PASSED ✓
```

---

## Running All Tests

You can run all tests sequentially with a simple script:

```bash
#!/bin/bash
# run-all-load-tests.sh

echo "Starting IxStats Load Testing Suite..."

echo "\n=== 1/4: API Load Testing ==="
tsx scripts/load-testing/test-api-load.ts --users=50 --duration=30

echo "\n=== 2/4: Rate Limiting Test ==="
tsx scripts/load-testing/test-rate-limiting.ts

echo "\n=== 3/4: Database Performance ==="
tsx scripts/load-testing/test-database-performance.ts --concurrent=10 --iterations=50

echo "\n=== 4/4: E2E Builder Flow ==="
tsx scripts/load-testing/test-builder-flow.ts --iterations=10 --concurrent=3

echo "\n=== All tests complete ==="
```

Make it executable:

```bash
chmod +x run-all-load-tests.sh
./run-all-load-tests.sh
```

## Interpreting Results

### Exit Codes

All scripts follow standard exit code conventions:
- **0** = All tests passed
- **1** = One or more tests failed

You can use this in CI/CD pipelines:

```bash
tsx scripts/load-testing/test-api-load.ts
if [ $? -eq 0 ]; then
  echo "✓ Load tests passed - ready for deployment"
else
  echo "✗ Load tests failed - deployment blocked"
  exit 1
fi
```

### Performance Indicators

**Green ✓** - Metric passed, within acceptable range
**Yellow ⚠** - Metric borderline, monitor closely
**Red ✗** - Metric failed, investigation required

### Common Issues

#### High Error Rates
- **Symptom**: Error rate > 1% for read operations
- **Possible Causes**: Database connection issues, rate limiting too aggressive, server overload
- **Solution**: Check database connection pool, verify rate limits, scale server resources

#### Slow Response Times
- **Symptom**: p95 > target thresholds
- **Possible Causes**: Inefficient queries, missing indexes, insufficient server resources
- **Solution**: Analyze slow queries, optimize database indexes, upgrade server

#### Rate Limiting Issues
- **Symptom**: Legitimate traffic getting blocked
- **Possible Causes**: Rate limits too low, incorrect namespace configuration
- **Solution**: Review rate limit thresholds in `src/server/api/trpc.ts`

#### Connection Pool Exhaustion
- **Symptom**: "Too many connections" errors
- **Possible Causes**: Concurrent requests exceeding pool size, connections not properly released
- **Solution**: Increase pool size in Prisma config, check for connection leaks

#### Race Conditions
- **Symptom**: Unique constraint violations during concurrent tests
- **Possible Causes**: Missing unique constraints, inadequate transaction isolation
- **Solution**: Add unique indexes, use database transactions

## Production Testing Checklist

Before v1.2 production deployment, ensure:

- [ ] API Load Test passes with 100+ concurrent users
- [ ] All rate limits trigger at expected thresholds
- [ ] Database handles 50+ concurrent writes without errors
- [ ] E2E Builder Flow completes successfully 20+ times
- [ ] No connection pool exhaustion under load
- [ ] No race conditions detected
- [ ] p95 response times meet targets
- [ ] Error rates < 1% under normal load
- [ ] Redis rate limiting working (if enabled)
- [ ] All cleanup operations complete successfully

## Continuous Integration

### GitHub Actions Example

```yaml
name: Load Testing

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

jobs:
  load-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Setup test database
        run: npm run db:setup

      - name: Run API Load Tests
        run: tsx scripts/load-testing/test-api-load.ts --users=50 --duration=30

      - name: Run Rate Limiting Tests
        run: tsx scripts/load-testing/test-rate-limiting.ts

      - name: Run Database Performance Tests
        run: tsx scripts/load-testing/test-database-performance.ts --concurrent=10

      - name: Run E2E Builder Flow Tests
        run: tsx scripts/load-testing/test-builder-flow.ts --iterations=10
```

## Troubleshooting

### "Cannot find module" errors

Ensure you're running from the project root:

```bash
cd /ixwiki/public/projects/ixstats
tsx scripts/load-testing/test-api-load.ts
```

### Authentication failures

Generate fresh tokens from Clerk dashboard or use the test user setup:

```bash
tsx scripts/setup/create-test-user.ts
```

### Database connection errors

Verify database is accessible and migrations are applied:

```bash
npm run db:setup
```

### Redis connection errors

If Redis is not available, ensure `REDIS_ENABLED=false` in `.env`. The rate limiter will fall back to in-memory storage.

## Performance Baselines

Based on IxStats v1.1.3 production environment:

### API Response Times
- Simple queries: p95 ~200ms
- Complex queries: p95 ~450ms
- Light mutations: p95 ~600ms
- Standard mutations: p95 ~900ms
- Heavy mutations: p95 ~1800ms

### Database Performance
- Simple query: ~50ms average
- Complex query with relations: ~300ms average
- Transaction (3 operations): ~800ms average
- Concurrent writes (10x): 95%+ success rate

### Builder Flow
- Complete 7-step flow: ~8 seconds average
- Data persistence: 100%
- Step failure rate: <1%

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review test output for specific error messages
3. Check `/docs/` for system documentation
4. Contact the development team

---

**Version**: 1.0.0
**Last Updated**: 2025-10-22
**Compatible with**: IxStats v1.2+
