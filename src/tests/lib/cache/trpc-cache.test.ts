/** @jest-environment node */
/**
 * The caches never serve one viewer's or realm's data to another, never cache a write or a failure, never hand out
 * the cached object itself, and stay inside their own keys and bounds: the tRPC cache keys by realm and viewer, a
 * stale memory entry never outlives Redis coming up, the global cache clears only its own `acs:` keys (never
 * FLUSHDB, which would drop the rate limits and sessions beside it), and the article cache is bounded by bytes.
 * Folds advanced-cache-system, redis-client and byte-bounded-cache.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { ByteBoundedCache } from "~/lib/cache/byte-bounded-cache";
import {
  cacheRealmKey,
  createCacheMiddlewareFactory,
  clearTrpcMemoryCache,
} from "~/lib/cache/trpc-cache";

type CacheMiddlewareOpts = Parameters<ReturnType<typeof createCacheMiddlewareFactory>>[0];
const ctx = {} as CacheMiddlewareOpts["ctx"];

describe("cacheRealmKey", () => {
  it("keeps a signed-in viewer's read of a named realm apart (staff may see a draft others may not)", () => {
    const staff = cacheRealmKey({ realmSlug: "draft", userId: "user_staff" });
    const anon = cacheRealmKey({ realmSlug: "draft" });
    expect(anon).toBeUndefined();
    expect(staff).toBe("v:user_staff");
    expect(staff).not.toBe(anon);
  });
});

describe("createCacheMiddlewareFactory (memory tier)", () => {
  beforeEach(() => {
    delete process.env.REDIS_ENABLED;
    clearTrpcMemoryCache();
  });
  it("never caches a mutation (next called every time)", async () => {
    const mw = createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "t1" });
    const next = jest.fn(async () => ({ ok: true }));
    const opts = {
      ctx,
      path: "countries.getImportData",
      type: "mutation" as const,
      input: { a: 1 },
    };

    await mw({ ...opts, next });
    await mw({ ...opts, next });

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("keys a query by the viewer's realm, so one realm's listing is never served to another", async () => {
    const mw = createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "t1" });
    const next = jest.fn(async () => ({ ok: true, data: 1 }));
    const opts = { ctx, path: "countries.getAll", type: "query" as const, input: { limit: 10 } };

    await mw({ ...opts, realmKey: "r_eurth", next });
    await mw({ ...opts, next });
    await mw({ ...opts, realmKey: "r_eurth", next });

    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe("createCacheMiddlewareFactory (Redis tier)", () => {
  it("a Redis miss does not fall back to memory once Redis is ready", async () => {
    const store = new Map<string, string>();
    const fakeRedis = {
      status: "wait",
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      setex: jest.fn(async (key: string, _ttl: number, value: string) => {
        store.set(key, value);
        return "OK";
      }),
    };
    let mod!: typeof import("~/lib/cache/trpc-cache");
    jest.isolateModules(() => {
      jest.doMock("~/lib/cache/redis-client", () => ({
        getSharedRedis: () => fakeRedis,
        isRedisReady: (client: { status: string } | null) => client?.status === "ready",
        deleteKeysByPattern: jest.fn(async () => 0),
      }));
      mod = require("~/lib/cache/trpc-cache");
    });

    const mw = mod.createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "t2" });
    // ctx with a `constructor` key is what superjson rejects when the whole envelope is stored
    const next = jest.fn(async () => ({ ok: true, data: 1, ctx: { constructor: "x" } }));
    const opts = { ctx, path: "countries.getAll", type: "query" as const, input: { a: 1 } };

    // Redis not ready: result goes to the memory tier only
    await mw({ ...opts, next });
    expect(fakeRedis.setex).not.toHaveBeenCalled();

    // Redis ready with an empty store: the memory entry must not be served
    fakeRedis.status = "ready";
    await mw({ ...opts, next });
    expect(next).toHaveBeenCalledTimes(2);
    expect(fakeRedis.setex).toHaveBeenCalledTimes(1);

    // The value written to Redis (superjson envelope) is now served from Redis
    const [, , raw] = fakeRedis.setex.mock.calls[0]!;
    expect(JSON.parse(raw)).toHaveProperty("json");
    await expect(mw({ ...opts, next })).resolves.toMatchObject({ ok: true, data: 1 });
    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe("createCacheMiddlewareFactory (memory tier bounds)", () => {
  function withMemoryCap(maxCacheBytes: number) {
    let mod!: typeof import("~/lib/cache/trpc-cache");
    jest.isolateModules(() => {
      jest.doMock("~/lib/system/dev-memory-config", () => ({
        memoryConfig: { trpc: { maxCacheBytes, defaultTTLSeconds: 60 } },
      }));
      jest.doMock("~/lib/cache/redis-client", () => ({
        getSharedRedis: () => null,
        isRedisReady: () => false,
        deleteKeysByPattern: jest.fn(async () => 0),
      }));
      mod = require("~/lib/cache/trpc-cache");
    });
    return mod;
  }

  const run = (
    mw: ReturnType<typeof createCacheMiddlewareFactory>,
    input: object,
    next: () => Promise<{ ok: boolean; data: string }>
  ) => mw({ ctx, path: "geoCore.getMapBundleDetail", type: "query", input, next });
  it("serves a copy, so a caller mutating its result cannot corrupt the cached one", async () => {
    const mod = withMemoryCap(100_000);
    const mw = mod.createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "copy" });
    const next = jest.fn(async () => ({ ok: true, data: { rows: [1, 2, 3] } }));
    const opts = {
      ctx,
      path: "geoCore.getMapBundleDetail",
      type: "query" as const,
      input: { n: 1 },
    };

    const first = await mw({ ...opts, next });
    (first.data as { rows: number[] }).rows.push(99);
    const second = await mw({ ...opts, next });

    expect(next).toHaveBeenCalledTimes(1);
    expect(second.data).toEqual({ rows: [1, 2, 3] });
  });
  it("invalidateCache drops the memory entries whose key matches a pattern", async () => {
    const mod = withMemoryCap(100_000);
    const mw = mod.createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "inv" });
    const next = jest.fn(async () => ({ ok: true, data: "v" }));
    const other = (input: object) =>
      mw({ ctx, path: "countries.getAll", type: "query", input, next });

    await run(mw, { n: 1 }, next);
    await other({ n: 1 });
    await mod.invalidateCache(["geoCore.getMapBundleDetail"]);
    await run(mw, { n: 1 }, next);
    await other({ n: 1 });

    expect(next).toHaveBeenCalledTimes(3); // only the geoCore entry was refetched
  });
});

describe("createCacheMiddlewareFactory (ixTime keys)", () => {
  beforeEach(() => {
    delete process.env.REDIS_ENABLED;
    clearTrpcMemoryCache();
  });

  const DAY = 86_400_000;
  const call = (
    mw: ReturnType<typeof createCacheMiddlewareFactory>,
    input: object,
    next: () => Promise<{ ok: boolean; data: number }>
  ) => mw({ ctx, path: "geoCore.getWorldMapAsOf", type: "query", input, next });

  it("another IxTime day, or another realm on the same day, is its own entry", async () => {
    const mw = createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "ix" });
    const next = jest.fn(async () => ({ ok: true, data: 1 }));

    await call(mw, { ixTime: 20_000 * DAY, realm: "eurth" }, next);
    await call(mw, { ixTime: 20_001 * DAY, realm: "eurth" }, next);
    await call(mw, { ixTime: 20_000 * DAY, realm: "ixnay" }, next);

    expect(next).toHaveBeenCalledTimes(3);
  });
});

describe("the global cache's Redis tier", () => {
  it("clears and deletes only its own acs: keys, never with FLUSHDB", async () => {
    const store = new Map([
      ["acs:a", "{}"],
      ["acs:feed:1", "{}"],
      ["feed:1", "{}"],
      ["ratelimit:x", "1"],
    ]);
    const glob = (pattern: string) =>
      new RegExp(
        `^${pattern
          .split("*")
          .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*")}$`
      );
    const redis = {
      status: "ready",
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      setex: jest.fn(
        async (key: string, _ttl: number, value: string) => store.set(key, value) && "OK"
      ),
      del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
      scan: jest.fn(async (_cursor: string, _match: "MATCH", pattern: string) => [
        "0",
        [...store.keys()].filter((key) => glob(pattern).test(key)),
      ]),
      unlink: jest.fn(async (...keys: string[]) => keys.filter((key) => store.delete(key)).length),
      flushdb: jest.fn(async () => store.clear()),
    };
    let globalCache!: typeof import("~/lib/cache/advanced-cache-system").globalCache;
    jest.isolateModules(() => {
      // The bounds suite above narrows the memory config for its own modules; this one reads the real one
      jest.dontMock("~/lib/system/dev-memory-config");
      jest.doMock("~/lib/cache/redis-client", () => ({
        ...jest.requireActual("~/lib/cache/redis-client"),
        getSharedRedis: () => redis,
        isRedisReady: (client: { status: string } | null) => client?.status === "ready",
      }));
      globalCache = require("~/lib/cache/advanced-cache-system").globalCache;
    });

    await globalCache.deleteByPattern("feed:*");
    expect([...store.keys()].sort()).toEqual(["acs:a", "feed:1", "ratelimit:x"]);
    await globalCache.clear();
    expect([...store.keys()].sort()).toEqual(["feed:1", "ratelimit:x"]);
    expect(redis.flushdb).not.toHaveBeenCalled();
  });
});

describe("ByteBoundedCache", () => {
  it("evicts the least recently used entries to fit a new one, and refuses one bigger than the whole cache", () => {
    const cache = new ByteBoundedCache<string>({
      maxBytes: 100,
      defaultTtlMs: 1_000,
      now: () => 0,
    });
    cache.set("a", "A", 40);
    cache.set("b", "B", 40);
    cache.get("a"); // b is now the least recently used
    cache.set("c", "C", 40);
    expect([cache.get("a"), cache.get("b"), cache.get("c"), cache.totalBytes]).toEqual([
      "A",
      undefined,
      "C",
      80,
    ]);
    cache.set("huge", "H", 101);
    expect([cache.get("huge"), cache.totalBytes]).toEqual([undefined, 80]);
  });
});
