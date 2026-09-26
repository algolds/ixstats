/**
 * RateLimiter — per-call limits and Redis resilience (plan 340, Step 1).
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below run before imports; see trpc-impersonation.test.ts.
 */
import { describe, it, expect, afterEach } from "@jest/globals";
import { RateLimiter } from "~/lib/cache/rate-limiter";

interface MockEnv {
  RATE_LIMIT_ENABLED: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  RATE_LIMIT_WINDOW_MS: string;
  REDIS_ENABLED: string;
  REDIS_URL: string | undefined;
}

jest.mock("~/env", () => ({
  env: {
    RATE_LIMIT_ENABLED: "true",
    RATE_LIMIT_MAX_REQUESTS: "5",
    RATE_LIMIT_WINDOW_MS: "60000",
    REDIS_ENABLED: "false",
    REDIS_URL: undefined,
  },
}));

type Listener = (error: Error) => void;

/** Minimal stand-in for an ioredis client: counts MULTI calls and returns a rising ZCARD. */
class MockRedis {
  status = "connecting";
  multiCalls = 0;
  private count = 0;
  private readonly listeners = new Map<string, Listener>();

  on(event: string, listener: Listener): this {
    this.listeners.set(event, listener);
    return this;
  }

  emit(event: string, error: Error): void {
    this.listeners.get(event)?.(error);
  }

  multi() {
    this.multiCalls++;
    this.count++;
    const count = this.count;
    const chain = {
      zremrangebyscore: () => chain,
      zadd: () => chain,
      zcard: () => chain,
      expire: () => chain,
      exec: async () => [
        [null, 0],
        [null, 1],
        [null, count],
        [null, 1],
      ],
    };
    return chain;
  }
}

const mockRedisInstances: MockRedis[] = [];

jest.mock("ioredis", () => ({
  __esModule: true,
  default: class extends MockRedis {
    constructor() {
      super();
      mockRedisInstances.push(this);
    }
  },
}));

const mockEnv = jest.requireMock<{ env: MockEnv }>("~/env").env;
const MINUTE = 60_000;

let bucket = 0;
/** A fresh identifier per call so the module-level in-memory store never leaks between tests. */
function uniqueId(): string {
  bucket++;
  return `test-client-${bucket}`;
}

async function callTimes(
  limiter: RateLimiter,
  times: number,
  ...args: Parameters<RateLimiter["check"]>
): Promise<boolean[]> {
  const outcomes: boolean[] = [];
  for (let i = 0; i < times; i++) {
    outcomes.push((await limiter.check(...args)).success);
  }
  return outcomes;
}

async function createRedisBackedLimiter(): Promise<{ limiter: RateLimiter; redis: MockRedis }> {
  mockEnv.REDIS_ENABLED = "true";
  mockEnv.REDIS_URL = "redis://mock:6379";
  const limiter = new RateLimiter();
  // initRedis() is fire-and-forget in the constructor; let its dynamic import settle.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const redis = mockRedisInstances[mockRedisInstances.length - 1];
  if (!redis) throw new Error("RateLimiter did not create a Redis client");
  return { limiter, redis };
}

afterEach(() => {
  mockEnv.RATE_LIMIT_ENABLED = "true";
  mockEnv.REDIS_ENABLED = "false";
  mockEnv.REDIS_URL = undefined;
  jest.restoreAllMocks();
});

describe("RateLimiter per-call limits (in-memory)", () => {
  it("enforces the limits passed to check(), not the global config", async () => {
    const limiter = new RateLimiter();
    const outcomes = await callTimes(limiter, 3, uniqueId(), "public", { maxRequests: 2, windowMs: MINUTE });
    expect(outcomes).toEqual([true, true, false]);
  });

  it("keeps namespaces with different limits independent", async () => {
    const limiter = new RateLimiter();
    const id = uniqueId();
    const strict = { maxRequests: 1, windowMs: MINUTE };
    const loose = { maxRequests: 3, windowMs: MINUTE };

    expect(await callTimes(limiter, 2, id, "strict", strict)).toEqual([true, false]);
    expect(await callTimes(limiter, 4, id, "loose", loose)).toEqual([true, true, true, false]);
  });

  it("falls back to the RATE_LIMIT_* env config when no limits are passed", async () => {
    const limiter = new RateLimiter();
    const outcomes = await callTimes(limiter, 6, uniqueId(), "default");
    expect(outcomes).toEqual([true, true, true, true, true, false]);
  });

  it("reports remaining requests against the per-call limit", async () => {
    const limiter = new RateLimiter();
    const result = await limiter.check(uniqueId(), "queries", { maxRequests: 120, windowMs: MINUTE });
    expect(result.remaining).toBe(119);
  });

  it("getStatus reads the same per-call limits without consuming a request", async () => {
    const limiter = new RateLimiter();
    const id = uniqueId();
    const limits = { maxRequests: 2, windowMs: MINUTE };
    await callTimes(limiter, 2, id, "status", limits);

    const limited = await limiter.getStatus(id, "status", limits);
    expect(limited).toMatchObject({ success: false, remaining: 0 });

    const underGlobal = await limiter.getStatus(id, "status");
    expect(underGlobal).toMatchObject({ success: true, remaining: 3 });
  });

  it("allows everything with a full per-call window when disabled", async () => {
    mockEnv.RATE_LIMIT_ENABLED = "false";
    const limiter = new RateLimiter();
    const outcomes = await callTimes(limiter, 3, uniqueId(), "public", { maxRequests: 1, windowMs: MINUTE });
    expect(outcomes).toEqual([true, true, true]);
    const result = await limiter.check(uniqueId(), "public", { maxRequests: 30, windowMs: MINUTE });
    expect(result.remaining).toBe(30);
  });
});

describe("RateLimiter Redis resilience", () => {
  it("uses in-memory limits while the Redis client is not ready", async () => {
    const { limiter, redis } = await createRedisBackedLimiter();
    const outcomes = await callTimes(limiter, 2, uniqueId(), "public", { maxRequests: 1, windowMs: MINUTE });

    expect(outcomes).toEqual([true, false]);
    expect(redis.multiCalls).toBe(0);
  });

  it("keeps the Redis client after an error and uses it again once it is ready", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { limiter, redis } = await createRedisBackedLimiter();

    redis.emit("error", new Error("ECONNRESET"));
    redis.status = "ready";
    const outcomes = await callTimes(limiter, 2, uniqueId(), "public", { maxRequests: 1, windowMs: MINUTE });

    expect(redis.multiCalls).toBe(2);
    expect(outcomes).toEqual([true, false]);
  });
});
