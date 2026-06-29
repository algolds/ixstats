# Plan 088: Fix Cache Diagnostics Script

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat HEAD -- scripts/diagnostics/cache-test.ts`
> If the file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tools
- **Planned at**: commit `29dc7239`, 2026-06-26

## Why this matters

The script `scripts/diagnostics/cache-test.ts` is used to benchmark and diagnose caching latency, hit-rates, and connection details. However, it fails with `ERR_MODULE_NOT_FOUND` because it attempts to import the legacy `redis` package. The project has standardized on `ioredis` for all Redis interactions. Updating this diagnostic script to use `ioredis` ensures developers can run caching diagnostics successfully.

## Current state

- **Relevant Files**:
  - `scripts/diagnostics/cache-test.ts` — benchmarks Redis and in-memory caches.

- **Excerpts**:
  - `scripts/diagnostics/cache-test.ts:9-10`:
    ```typescript
    import { performance } from "perf_hooks";
    import { createClient } from "redis";
    ```
  - `scripts/diagnostics/cache-test.ts:119-129` (testRedisConnection):
    ```typescript
    async function testRedisConnection(): Promise<RedisStats> {
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

      try {
        const client = createClient({ url: redisUrl });

        client.on("error", () => {
          // Suppress error logging
        });

        await client.connect();
    ```
  - `scripts/diagnostics/cache-test.ts:186-192` (benchmarkRedisOperations):
    ```typescript
        // Benchmark SET operations
        for (let i = 0; i < TEST_ITERATIONS; i++) {
          const start = performance.now();
          await client.set(`${testKey}:${i}`, JSON.stringify({ test: i }), {
            EX: 60,
          });
          setTimes.push(performance.now() - start);
        }
    ```

- **Design Constraints**:
  - Use `ioredis` standard connection configuration (e.g. `new Redis(redisUrl, options)`).
  - Prevent the script from hanging or retrying indefinitely if Redis is down. Use `{ maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true }` and catch connection errors gracefully.
  - Match `ioredis` method signatures (`client.dbsize()`, `client.set(key, val, "EX", 60)`, `client.quit()`).

## Commands you will need

| Purpose   | Command                                         | Expected on success |
|-----------|-------------------------------------------------|---------------------|
| Run test  | `bun run scripts/diagnostics/cache-test.ts`     | Runs benchmark and prints stats |

## Scope

**In scope**:
- `scripts/diagnostics/cache-test.ts`

**Out of scope**:
- Direct production Redis configuration changes.

## Git workflow

- Branch: `advisor/088-fix-cache-diagnostics-script`
- Commit message style: `fix(diagnostics): switch cache test script to ioredis`

## Steps

### Step 1: Replace node-redis import with ioredis

Modify `scripts/diagnostics/cache-test.ts`:
Replace:
```typescript
import { createClient } from "redis";
```
With:
```typescript
import { Redis } from "ioredis";
```

### Step 2: Refactor testRedisConnection to ioredis syntax

Update `testRedisConnection` function in `scripts/diagnostics/cache-test.ts`:
1. Use `new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true })`.
2. Connect manually using `await client.connect()`.
3. Use `.dbsize()` (lowercase) instead of `.dbSize()`.
4. Use `.quit()` (or `.disconnect()`) instead of `.disconnect()`.
5. Ensure `info` parsing logic remains robust.

### Step 3: Refactor benchmarkRedisOperations to ioredis syntax

Update `benchmarkRedisOperations` function in `scripts/diagnostics/cache-test.ts`:
1. Initialize the client similarly with `maxRetriesPerRequest: 1`, `connectTimeout: 2000`, `lazyConnect: true`.
2. Change the `set` command syntax to: `await client.set(`${testKey}:${i}`, JSON.stringify({ test: i }), "EX", 60)`.
3. Use `.quit()` at the end instead of `.disconnect()`.

**Verify**: Run the script:
```bash
bun run scripts/diagnostics/cache-test.ts
```
Confirm it finishes successfully (or shows the fallback warning if Redis is local/offline, without throwing unhandled exceptions).

## Test plan

- Run `bun run scripts/diagnostics/cache-test.ts` to ensure it executes and prints summary.
- Run `bun run lint` to ensure no lint regressions.

## Done criteria

- [ ] Cache diagnostics script executes successfully without `MODULE_NOT_FOUND` error.
- [ ] No unhandled rejections if Redis server is down/unreachable.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- If `ioredis` library is not found (should be installed since it's in `package.json`).
