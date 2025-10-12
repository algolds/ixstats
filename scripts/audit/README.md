# IxStats v1.0 - Audit & Verification Scripts

Comprehensive test and verification scripts for the IxStats platform to ensure production readiness.

## 📋 Available Scripts

### 🧪 Master Test Runner
**File:** `run-all-tests.ts`

Runs all verification scripts in sequence and provides a comprehensive report.

```bash
# Run all tests
npx tsx scripts/audit/run-all-tests.ts

# Run specific tests only
npx tsx scripts/audit/run-all-tests.ts --only=crud,health

# Show help
npx tsx scripts/audit/run-all-tests.ts --help
```

**Exit Codes:**
- `0`: All tests passed
- `1`: Critical test failures
- `2`: Optional test failures (non-critical)

---

### 🔄 CRUD Operations Test
**File:** `test-all-crud-operations.ts`
**Status:** 🔴 CRITICAL

Tests Create, Read, Update, Delete operations for all major database models and tRPC routers.

```bash
npx tsx scripts/audit/test-all-crud-operations.ts
```

**What it tests:**
- Countries CRUD operations
- Users CRUD operations
- Diplomatic relations (embassies, missions)
- ThinkPages posts
- Activities and events
- Government structures
- Intelligence briefings
- Quick actions (meetings, policies)

**Expected Results:**
- ✅ All CRUD operations complete successfully
- ⏱️ Average operation time < 100ms

---

### 🏥 API Health Check
**File:** `test-api-health.ts`
**Status:** 🔴 CRITICAL

Tests all tRPC API endpoints for availability and performance.

```bash
npx tsx scripts/audit/test-api-health.ts
```

**What it tests:**
- All tRPC router endpoints
- Response times (< 100ms healthy, < 500ms acceptable)
- Error handling
- Database connectivity

**Expected Results:**
- ✅ 95%+ endpoints healthy (< 100ms)
- ⚠️ < 5% degraded (100-500ms)
- ❌ 0% down (> 500ms or error)

---

### 🗄️ Database Integrity Audit
**File:** `verify-database-integrity.ts`
**Status:** 🔴 CRITICAL

Verifies database schema, relationships, constraints, and data quality.

```bash
npx tsx scripts/audit/verify-database-integrity.ts
```

**What it tests:**
- Referential integrity (no orphaned records)
- Data consistency (valid values, no duplicates)
- Database statistics and record counts
- Index performance
- Data quality (completeness, freshness)

**Expected Results:**
- ✅ No orphaned records
- ✅ All foreign key relationships valid
- ✅ Unique constraints enforced
- ✅ Query performance < 50ms

---

### 💰 Economic Calculations Verification
**File:** `verify-economic-calculations.ts`
**Status:** 🟡 OPTIONAL

Verifies economic formulas, tier-based calculations, and projections.

```bash
npx tsx scripts/audit/verify-economic-calculations.ts
```

**What it tests:**
- GDP calculations and per capita values
- Tier assignment accuracy
- Growth rate calculations
- Economic indicators (unemployment, inflation)
- Budget balance calculations
- 5-year projections
- Historical data tracking

**Expected Results:**
- ✅ 90%+ calculations within expected ranges
- ✅ Tier assignments accurate
- ✅ Projections realistic

---

### 🔌 Live Data Wiring Verification
**File:** `verify-live-data-wiring.ts`
**Status:** 🟡 OPTIONAL

Analyzes component code to verify live data connections vs. mock data.

```bash
npx tsx scripts/audit/verify-live-data-wiring.ts
```

**What it tests:**
- tRPC API usage in components
- Mock data patterns
- Component data source analysis
- Coverage across all major features

**Expected Results:**
- ✅ 85%+ components using live data
- ⚠️ < 15% mixed (live + mock)
- ❌ 0% purely mock data

**Output:**
- Console summary
- Detailed JSON report in `scripts/audit/reports/`

---

## 🎯 Recommended Testing Workflow

### Before Deployment
Run the complete test suite:
```bash
npx tsx scripts/audit/run-all-tests.ts
```

### Quick Health Check
Run only critical tests:
```bash
npx tsx scripts/audit/run-all-tests.ts --only=crud,health,database
```

### Development Testing
Run specific tests during development:
```bash
# After database changes
npx tsx scripts/audit/verify-database-integrity.ts

# After API changes
npx tsx scripts/audit/test-api-health.ts

# After economic formula updates
npx tsx scripts/audit/verify-economic-calculations.ts
```

---

## 📊 Interpreting Results

### Status Indicators
- ✅ **PASS**: Test passed, no issues
- ⚠️ **WARNING**: Test passed with minor issues, review recommended
- ❌ **FAIL**: Test failed, immediate attention required

### Grading Scale
- **A+ (95-100%)**: Perfect, production-ready
- **A (90-95%)**: Excellent, production-ready
- **B (80-90%)**: Good, minor improvements recommended
- **C (70-80%)**: Acceptable, review issues before deployment
- **D (60-70%)**: Poor, significant issues present
- **F (< 60%)**: Critical issues, not production-ready

### Critical vs. Optional Tests
- **🔴 CRITICAL**: Must pass for production deployment
- **🟡 OPTIONAL**: Nice to have, but not blocking

---

## 🔧 Maintenance Scripts

Additional scripts in `scripts/maintenance/`:
- `update-flag-cache.js` - Update country flag cache
- `populate-country-slugs.ts` - Generate SEO-friendly slugs
- `recalculate-vitality-scores.ts` - Recalculate all vitality metrics
- `reset-engagement-data.ts` - Reset engagement metrics
- `generate-military-db.js` - Generate military equipment database

Setup scripts in `scripts/setup/`:
- `init-db.ts` - Initialize database schema
- `check-auth-config.js` - Verify authentication configuration
- `setup-clerk-dev.js` - Setup Clerk for development

---

## 📝 Adding New Tests

To add a new test script:

1. Create file in `scripts/audit/`
2. Follow the naming convention: `test-*.ts` or `verify-*.ts`
3. Export results with status indicators (PASS/FAIL/WARNING)
4. Add to `testSuites` array in `run-all-tests.ts`
5. Update this README

Example test structure:
```typescript
#!/usr/bin/env tsx
import { db } from "~/server/db";

interface TestResult {
  test: string;
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
}

async function runTests() {
  const results: TestResult[] = [];

  // Your test logic here

  // Print results
  console.log("Test Summary");
  results.forEach(r => {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} ${r.test}: ${r.message}`);
  });

  // Exit with appropriate code
  const failed = results.filter(r => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
```

---

## 🚀 CI/CD Integration

These scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run IxStats Tests
  run: |
    cd /ixwiki/public/projects/ixstats
    npx tsx scripts/audit/run-all-tests.ts
  continue-on-error: false  # Fail build on test failures
```

---

## 📞 Support

For issues with test scripts:
1. Check script output for detailed error messages
2. Review database logs
3. Verify environment configuration
4. Run individual tests for more specific diagnostics

---

**Last Updated:** October 2025
**Version:** 1.0
**Maintainer:** IxStats Development Team
