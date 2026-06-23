# National Issues Engine Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement configuration controls to limit issues generated per session and per week, enforce these limits dynamically on evaluations, support admin bypass overrides, and prevent empty log entries.

**Architecture:** Use a local JSON file for dynamic configuration, read/write via a utility module, and enforce the limits in the evaluation engine's `shouldEvaluate` and `evaluateCountry` methods. Hook these up to tRPC procedures and an admin settings panel.

**Tech Stack:** TypeScript, Next.js, Prisma, tRPC.

## Global Constraints

- **Package manager**: `bun` exclusively (never npm/yarn/pnpm). Lockfile: `bun.lock`.
- **Active branch**: `v2`.
- **Database writes**: Database write commands are blocked (`db:migrate`, `db:push`, `db:reset`). Avoid modifying PostgreSQL schema.

---

### Task 1: Create Configuration Storage and Utility Module

**Files:**
- Create: `data/national-issues-config.json`
- Create: `src/lib/national-issues-config.ts`

**Interfaces:**
- Produces:
  - `getNationalIssuesConfig(): { maxIssuesPerSession: number; maxIssuesPerWeek: number }`
  - `saveNationalIssuesConfig(config: { maxIssuesPerSession: number; maxIssuesPerWeek: number }): void`

- [ ] **Step 1: Create default configuration JSON file**
  Create [national-issues-config.json](file:///ixwiki/public/projects/ixstats/data/national-issues-config.json) with defaults:
  ```json
  {
    "maxIssuesPerSession": 3,
    "maxIssuesPerWeek": 5
  }
  ```

- [ ] **Step 2: Implement configuration reading/writing module**
  Create [national-issues-config.ts](file:///ixwiki/public/projects/ixstats/src/lib/national-issues-config.ts):
  ```typescript
  import fs from "fs";
  import path from "path";

  export interface NationalIssuesConfig {
    maxIssuesPerSession: number;
    maxIssuesPerWeek: number;
  }

  const CONFIG_PATH = path.join(process.cwd(), "data", "national-issues-config.json");
  const DEFAULT_CONFIG: NationalIssuesConfig = {
    maxIssuesPerSession: 3,
    maxIssuesPerWeek: 5,
  };

  export function getNationalIssuesConfig(): NationalIssuesConfig {
    try {
      if (!fs.existsSync(CONFIG_PATH)) {
        // Ensure parent directory exists
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
        return DEFAULT_CONFIG;
      }
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(data);
      return {
        maxIssuesPerSession: typeof parsed.maxIssuesPerSession === "number" ? parsed.maxIssuesPerSession : DEFAULT_CONFIG.maxIssuesPerSession,
        maxIssuesPerWeek: typeof parsed.maxIssuesPerWeek === "number" ? parsed.maxIssuesPerWeek : DEFAULT_CONFIG.maxIssuesPerWeek,
      };
    } catch (err) {
      console.error("[NationalIssuesConfig] Failed to read config, returning default:", err);
      return DEFAULT_CONFIG;
    }
  }

  export function saveNationalIssuesConfig(config: NationalIssuesConfig): void {
    try {
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    } catch (err) {
      console.error("[NationalIssuesConfig] Failed to write config:", err);
      throw new Error("Failed to save national issues configuration");
    }
  }
  ```

- [ ] **Step 3: Run typecheck on server package**
  Run: `bun run typecheck:server`
  Expected: SUCCESS or baseline errors

- [ ] **Step 4: Commit config storage files**
  ```bash
  git add data/national-issues-config.json src/lib/national-issues-config.ts
  git commit -m "feat: add national issues config storage and utility module"
  ```

---

### Task 2: Extend tRPC API Router

**Files:**
- Modify: `src/server/api/routers/national-issues/engine.ts`

**Interfaces:**
- Consumes:
  - `getNationalIssuesConfig` (from `~/lib/national-issues-config`)
  - `saveNationalIssuesConfig` (from `~/lib/national-issues-config`)
- Produces:
  - `getEngineConfig` (query)
  - `updateEngineConfig` (mutation)
  - Update `triggerEvaluation` input schema and call arguments.

- [ ] **Step 1: Modify `src/server/api/routers/national-issues/engine.ts`**
  Import config functions at the top:
  ```typescript
  import { getNationalIssuesConfig, saveNationalIssuesConfig } from "~/lib/national-issues-config";
  ```
  Add input schemas for updating config:
  ```typescript
  const ConfigUpdateSchema = z.object({
    maxIssuesPerSession: z.number().int().min(1).max(10),
    maxIssuesPerWeek: z.number().int().min(1).max(50),
  });
  ```
  Add the following endpoints under `nationalIssuesEngineRouter` definitions:
  ```typescript
  getEngineConfig: adminProcedure.query(async () => {
    return getNationalIssuesConfig();
  }),

  updateEngineConfig: adminProcedure
    .input(ConfigUpdateSchema)
    .mutation(async ({ input }) => {
      saveNationalIssuesConfig(input);
      return { success: true };
    }),
  ```
  Modify `triggerEvaluation` to accept a `bypassLimits` parameter and pass it to `evaluateCountry`:
  ```typescript
  triggerEvaluation: adminProcedure
    .input(
      z.object({
        countryId: z.string(),
        maxIssues: z.number().int().min(1).max(10).optional(),
        domain: z.string().optional(),
        bypassLimits: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return NationalIssuesEngine.evaluateCountry(input.countryId, ctx.db as any, {
        maxIssues: input.maxIssues,
        forceDomain: input.domain,
        bypassLimits: input.bypassLimits,
      });
    }),
  ```

- [ ] **Step 2: Run typecheck**
  Run: `bun run typecheck:server`
  Expected: SUCCESS or baseline errors

- [ ] **Step 3: Commit extended router**
  ```bash
  git add src/server/api/routers/national-issues/engine.ts
  git commit -m "feat: extend national-issues tRPC router with config queries and bypass option"
  ```

---

### Task 3: Implement Engine Enforcement and Log Bloat Prevention

**Files:**
- Modify: `src/lib/national-issues-engine.ts`

**Interfaces:**
- Consumes:
  - `getNationalIssuesConfig` (from `~/lib/national-issues-config`)
- Produces:
  - Updated `evaluateCountry` options and execution logic.
  - Updated `shouldEvaluate` logic.

- [ ] **Step 1: Add imports and update `evaluateCountry` signature in `src/lib/national-issues-engine.ts`**
  Import config functions at the top of [national-issues-engine.ts](file:///ixwiki/public/projects/ixstats/src/lib/national-issues-engine.ts):
  ```typescript
  import { getNationalIssuesConfig } from "./national-issues-config";
  ```
  Update `evaluateCountry` options type signature:
  ```typescript
  static async evaluateCountry(
    countryId: string,
    db: PrismaClient,
    options?: { maxIssues?: number; forceDomain?: string; bypassLimits?: boolean }
  ): Promise<EvaluationResult> {
  ```

- [ ] **Step 2: Update `shouldEvaluate` logic in `src/lib/national-issues-engine.ts`**
  Modify the `shouldEvaluate` method to also check weekly issue limit:
  ```typescript
  static async shouldEvaluate(countryId: string, db: PrismaClient): Promise<boolean> {
    const config = getNationalIssuesConfig();
    const sevenIxDaysMs = 7 * 24 * 60 * 60 * 1000;
    const weekAgoIxTime = IxTime.getCurrentIxTime() - sevenIxDaysMs;
    
    // Count issues created for this country in the last 7 IxDays
    const weeklyCount = await (db as any).nationalIssue.count({
      where: { countryId, createdIxTime: { gte: weekAgoIxTime } },
    });

    if (weeklyCount >= config.maxIssuesPerWeek) {
      return false; // Skip evaluation entirely if weekly cap reached
    }

    const lastLog = await (db as any).issueGenerationLog.findFirst({
      where: { countryId },
      orderBy: { createdAt: "desc" },
      select: { ixTimeAtEvaluation: true },
    });

    if (!lastLog) return true;

    const currentIxTime = IxTime.getCurrentIxTime();
    const fiveIxMinutesMs = 5 * 60 * 1000;
    return currentIxTime - lastLog.ixTimeAtEvaluation > fiveIxMinutesMs;
  }
  ```

- [ ] **Step 3: Update `evaluateCountry` execution limits and session limits**
  In `evaluateCountry`, retrieve configuration:
  ```typescript
  const config = getNationalIssuesConfig();
  ```
  Determine the baseline weekly limit and capacity cap:
  ```typescript
  // In evaluateCountry, after snapshot is validated:
  // Suppress generation if too many pending issues
  if (snapshot.pendingIssueCount >= 10) {
    result.errors.push("Issue cap reached (10+ pending)");
    return result;
  }

  let maxIssues = options?.maxIssues ?? config.maxIssuesPerSession;

  if (!options?.bypassLimits) {
    const sevenIxDaysMs = 7 * 24 * 60 * 60 * 1000;
    const weekAgoIxTime = IxTime.getCurrentIxTime() - sevenIxDaysMs;
    const weeklyCount = await (db as any).nationalIssue.count({
      where: { countryId, createdIxTime: { gte: weekAgoIxTime } },
    });

    if (weeklyCount >= config.maxIssuesPerWeek) {
      // Abort normal template generation
      if (result.issuesGenerated === 0) {
        return result;
      }
    }

    const capacityRemaining = Math.max(0, config.maxIssuesPerWeek - weeklyCount);
    maxIssues = Math.min(maxIssues, capacityRemaining);
  }
  ```

- [ ] **Step 4: Restrict `issueGenerationLog` creation to prevent blank logs**
  In `evaluateCountry`, wrap logging query in conditional block check:
  ```typescript
  // Log the evaluation
  result.executionTimeMs = Date.now() - startTime;
  if (result.issuesGenerated > 0 || result.errors.length > 0) {
    await (db as any).issueGenerationLog
      .create({
        data: {
          countryId,
          templatesEvaluated: result.templatesEvaluated,
          templatesPassed: result.templatesPassed,
          issuesGenerated: result.issuesGenerated,
          issuesSkippedCooldown: result.issuesSkippedCooldown,
          issuesSkippedMaxActive: result.issuesSkippedMaxActive,
          executionTimeMs: result.executionTimeMs,
          ixTimeAtEvaluation: snapshot.currentIxTime,
          errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        },
      })
      .catch(() => {
        // Non-critical, don't fail evaluation
      });
  }
  ```

- [ ] **Step 5: Run typecheck**
  Run: `bun run typecheck:server`
  Expected: SUCCESS or baseline errors

- [ ] **Step 6: Commit changes to engine**
  ```bash
  git add src/lib/national-issues-engine.ts
  git commit -m "feat: enforce weekly and session limits in evaluation engine and conditional logs"
  ```

---

### Task 4: Redesign Left Column on Admin UI with Configuration Controls

**Files:**
- Modify: `src/app/admin/national-issues/page.tsx`

- [ ] **Step 1: Read code layout of page.tsx**
  Identify where the "Evaluate Engine" manual action is rendered in the Left Column.

- [ ] **Step 2: Add Configuration Inputs and Bypass Controls**
  In `src/app/admin/national-issues/page.tsx`, import `api` hooks.
  Add state for engine limits (`maxIssuesPerSession`, `maxIssuesPerWeek`) and a bypass checkbox.
  Implement query `getEngineConfig` and mutation `updateEngineConfig`.
  Add a beautiful settings card with inputs and Save button.
  Add a Checkbox for "Override Limits / Bypass weekly cap" and pass it in `triggerEvaluation.mutate({ ..., bypassLimits })`.

- [ ] **Step 3: Verify TypeScript compiling on UI**
  Run: `bun run typecheck:ui`
  Expected: SUCCESS

- [ ] **Step 4: Commit UI changes**
  ```bash
  git add src/app/admin/national-issues/page.tsx
  git commit -m "feat: add engine limits widget and bypass checkbox to admin UI"
  ```

---

### Task 5: Add Automated Limits Testing and Verification

**Files:**
- Create: `src/lib/__tests__/national-issues-limits.test.ts`

- [ ] **Step 1: Create unit test file**
  Create [national-issues-limits.test.ts](file:///ixwiki/public/projects/ixstats/src/lib/__tests__/national-issues-limits.test.ts) containing mock assertions for `shouldEvaluate` and `evaluateCountry` limits.
  Mock Prisma client calls to simulate various weekly counts, validating that `shouldEvaluate` returns false when cap is reached and `evaluateCountry` respects session limit cap.

- [ ] **Step 2: Run test suite**
  Run: `bun run test -- src/lib/__tests__/national-issues-limits.test.ts`
  Expected: PASS

- [ ] **Step 3: Run full typecheck and audits**
  Run: `bun run typecheck`
  Run: `bun run audit:arch`

- [ ] **Step 4: Commit test file**
  ```bash
  git add src/lib/__tests__/national-issues-limits.test.ts
  git commit -m "test: add unit tests for national issues engine limits"
  ```
