# Design Spec: National Issues Engine Limits Configuration

## Purpose
To prevent bloat in the logs and database, and to limit issue generation frequency, we will implement dynamic global configuration limits for the National Issues Engine. Specifically, we will enforce:
1. **Max Issues Per Session**: The maximum number of issues generated during a single evaluation session.
2. **Max Issues Per Week**: The maximum number of issues generated for a country in any 7 IxDay (simulation days) period.

Admins will be able to manage these configuration values directly from the National Issues Admin panel on-the-fly, with changes persisted to a local configuration JSON file.

---

## Technical Details

### 1. Configuration Storage (`data/national-issues-config.json` [NEW])
A local JSON file will hold the limits:
```json
{
  "maxIssuesPerSession": 3,
  "maxIssuesPerWeek": 5
}
```

We will create a helper module [national-issues-config.ts](file:///ixwiki/public/projects/ixstats/src/lib/national-issues-config.ts) to handle synchronous reading and writing of this file:
* `getNationalIssuesConfig()`: returns active values (with default fallbacks).
* `saveNationalIssuesConfig(config)`: updates parameters in the JSON file.

### 2. tRPC Backend API Additions
* **File:** [engine.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/national-issues/engine.ts)
* **Endpoints**:
  * `getEngineConfig` (query, admin-only): Exposes configuration settings.
  * `updateEngineConfig` (mutation, admin-only): Validates inputs and saves them.
  * Update `triggerEvaluation`:
    * Add input parameter `bypassLimits: z.boolean().default(false)`.
    * Forward `bypassLimits` to `NationalIssuesEngine.evaluateCountry(...)`.

### 3. Engine Enforcement Logic
* **File:** [national-issues-engine.ts](file:///ixwiki/public/projects/ixstats/src/lib/national-issues-engine.ts)
* **Weekly Check in `shouldEvaluate`**:
  Before triggering automated/lazy evaluation, check the weekly issue count over the last 7 IxDays (simulation days):
  ```typescript
  const config = getNationalIssuesConfig();
  const sevenIxDaysMs = 7 * 24 * 60 * 60 * 1000;
  const weekAgoIxTime = IxTime.getCurrentIxTime() - sevenIxDaysMs;
  const weeklyCount = await db.nationalIssue.count({
    where: { countryId, createdIxTime: { gte: weekAgoIxTime } }
  });
  if (weeklyCount >= config.maxIssuesPerWeek) {
    return false; // Skip evaluation
  }
  ```
* **Capacity Cap in `evaluateCountry`**:
  Unless `options.bypassLimits` is explicitly true:
  * Check weekly issue count. If `weeklyCount >= config.maxIssuesPerWeek`, abort generation.
  * Restrict session limit: `const capacityRemaining = Math.max(0, config.maxIssuesPerWeek - weeklyCount);`
  * Limit issue selection: `const sessionLimit = Math.min(maxIssues, capacityRemaining);`
* **Log Bloat Prevention**:
  Only call `db.issueGenerationLog.create` if `result.issuesGenerated > 0` or `result.errors.length > 0`.

### 4. Admin UI Additions
* **File:** [page.tsx](file:///ixwiki/public/projects/ixstats/src/app/admin/national-issues/page.tsx)
* **Components**:
  * **Engine Limits Widget**: A card placed in the sticky Left Column featuring inputs for Session Limit and Weekly Limit, and a "Save Config" button.
  * **Override Cap Selector**: Add an "Override limits" checkbox next to the manual evaluation triggers.

---

## Verification Plan

### Automated Tests
* Add a test suite verifying limits enforcement in `src/lib/__tests__/national-issues-limits.test.ts`.
* Run `bun run test` to verify all tests pass.

### Manual Verification
* Access the redesigned admin panel.
* Edit weekly issues cap to `1`, trigger evaluation twice, and verify the second evaluation aborts with cap-reached logs.
* Verify checking "Override limits" bypasses the cap successfully.
