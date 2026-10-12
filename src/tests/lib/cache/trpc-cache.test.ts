/** @jest-environment node */
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  cacheRealmKey,
  shouldSkipCache,
  createCacheMiddlewareFactory,
  clearTrpcMemoryCache,
} from "~/lib/cache/trpc-cache";

type CacheMiddlewareOpts = Parameters<ReturnType<typeof createCacheMiddlewareFactory>>[0];
const ctx = {} as CacheMiddlewareOpts["ctx"];

describe("cacheRealmKey", () => {
  it("shares Ixnay reads and keys other active realms", () => {
    expect(cacheRealmKey({ activeRealmId: "default" })).toBeUndefined();
    expect(cacheRealmKey({ activeRealmId: "r_eurth" })).toBe("r_eurth");
  });

  it("keeps a signed-in viewer's read of a named realm apart (staff may see a draft others may not)", () => {
    const staff = cacheRealmKey({ realmSlug: "draft", userId: "user_staff" });
    const anon = cacheRealmKey({ realmSlug: "draft" });
    expect(anon).toBeUndefined();
    expect(staff).toBe("v:user_staff");
    expect(staff).not.toBe(anon);
  });
});

describe("shouldSkipCache", () => {
  it("caches queries whose names used to match the mutation regexes", () => {
    expect(shouldSkipCache("query", "countries.getTopCountriesByImportance")).toBe(false);
    expect(shouldSkipCache("query", "countries.resolveBatch")).toBe(false);
  });

  it("always skips mutations and subscriptions", () => {
    expect(shouldSkipCache("mutation", "geoCore.seedBorderHistoryDev")).toBe(true);
    expect(shouldSkipCache("subscription", "x.onEvent")).toBe(true);
  });

  it("honours custom skip patterns for queries", () => {
    expect(shouldSkipCache("query", "a.b", [/^a\./])).toBe(true);
  });
});

describe("createCacheMiddlewareFactory (memory tier)", () => {
  beforeEach(() => {
    delete process.env.REDIS_ENABLED;
    clearTrpcMemoryCache();
  });

  it("caches an import-named query (next called once)", async () => {
    const mw = createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "t1" });
    const next = jest.fn(async () => ({ ok: true, data: { n: 1 }, ctx: { stale: true } }));
    const opts = { ctx, path: "countries.getImportData", type: "query" as const, input: { a: 1 } };

    const first = await mw({ ...opts, next });
    const second = await mw({ ...opts, next });

    expect(next).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ marker: "middlewareMarker", ok: true, data: { n: 1 } });
    expect(second.data).toEqual(first.data);
    // The cached hit carries this request's ctx, never the one from the request that filled it
    expect(second.ctx).toBe(ctx);
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

  it("does not cache a failed procedure result", async () => {
    const mw = createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "t1" });
    const next = jest.fn(async () => ({ ok: false }));
    const opts = { ctx, path: "countries.getAll", type: "query" as const, input: { a: 2 } };

    await mw({ ...opts, next });
    await mw({ ...opts, next });

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
  ) => mw({ ctx, path: "geoCore.getWorldMap", type: "query", input, next });

  it("evicts the least recently used entries by bytes, not by count", async () => {
    // Each 400-character result takes about 800 bytes serialised: three do not fit in 2,000
    const mod = withMemoryCap(2_000);
    const mw = mod.createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "bytes" });
    const next = jest.fn(async () => ({ ok: true, data: "x".repeat(400) }));

    for (const n of [1, 2, 3]) await run(mw, { n }, next);
    expect(next).toHaveBeenCalledTimes(3);

    await run(mw, { n: 3 }, next); // newest is still held
    expect(next).toHaveBeenCalledTimes(3);
    await run(mw, { n: 1 }, next); // oldest was evicted to make room
    expect(next).toHaveBeenCalledTimes(4);
  });

  it("does not hold a result larger than the whole cap", async () => {
    const mod = withMemoryCap(500);
    const mw = mod.createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "bytes" });
    const next = jest.fn(async () => ({ ok: true, data: "x".repeat(2_000) }));

    await run(mw, { n: 1 }, next);
    await run(mw, { n: 1 }, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("serves a copy, so a caller mutating its result cannot corrupt the cached one", async () => {
    const mod = withMemoryCap(100_000);
    const mw = mod.createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "copy" });
    const next = jest.fn(async () => ({ ok: true, data: { rows: [1, 2, 3] } }));
    const opts = { ctx, path: "geoCore.getWorldMap", type: "query" as const, input: { n: 1 } };

    const first = await mw({ ...opts, next });
    (first.data as { rows: number[] }).rows.push(99);
    const second = await mw({ ...opts, next });

    expect(next).toHaveBeenCalledTimes(1);
    expect(second.data).toEqual({ rows: [1, 2, 3] });
  });

  it("expires an entry after its TTL", async () => {
    const mod = withMemoryCap(100_000);
    const mw = mod.createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "ttl" });
    const next = jest.fn(async () => ({ ok: true, data: "v" }));
    jest.useFakeTimers({ now: new Date("2026-10-11T12:00:00Z") });
    try {
      await run(mw, { n: 1 }, next);
      jest.setSystemTime(new Date("2026-10-11T12:00:59Z"));
      await run(mw, { n: 1 }, next);
      expect(next).toHaveBeenCalledTimes(1);
      jest.setSystemTime(new Date("2026-10-11T12:01:01Z"));
      await run(mw, { n: 1 }, next);
      expect(next).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("invalidateCache drops the memory entries whose key matches a pattern", async () => {
    const mod = withMemoryCap(100_000);
    const mw = mod.createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "inv" });
    const next = jest.fn(async () => ({ ok: true, data: "v" }));
    const other = (input: object) =>
      mw({ ctx, path: "countries.getAll", type: "query", input, next });

    await run(mw, { n: 1 }, next);
    await other({ n: 1 });
    await mod.invalidateCache(["geoCore.getWorldMap"]);
    await run(mw, { n: 1 }, next);
    await other({ n: 1 });

    expect(next).toHaveBeenCalledTimes(3); // only the geoCore entry was refetched
  });

  it("does not cache a result it cannot serialise, and still returns it", async () => {
    const mod = withMemoryCap(100_000);
    const mw = mod.createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "bad" });
    const circular: { self?: object } = {};
    circular.self = circular;
    const next = jest.fn(async () => ({ ok: true, data: circular }));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await run(mw, { n: 1 }, next as never);
    await run(mw, { n: 1 }, next as never);

    expect(result.data).toBe(circular);
    expect(next).toHaveBeenCalledTimes(2);
    warn.mockRestore();
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

  it("two ixTimes on the same IxTime day share one entry", async () => {
    const mw = createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "ix" });
    const next = jest.fn(async () => ({ ok: true, data: 1 }));

    await call(mw, { ixTime: 20_000 * DAY + 1_000, realm: "eurth" }, next);
    await call(mw, { ixTime: 20_000 * DAY + DAY - 1, realm: "eurth" }, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("another IxTime day, or another realm on the same day, is its own entry", async () => {
    const mw = createCacheMiddlewareFactory({ ttlSeconds: 60, namespace: "ix" });
    const next = jest.fn(async () => ({ ok: true, data: 1 }));

    await call(mw, { ixTime: 20_000 * DAY, realm: "eurth" }, next);
    await call(mw, { ixTime: 20_001 * DAY, realm: "eurth" }, next);
    await call(mw, { ixTime: 20_000 * DAY, realm: "ixnay" }, next);

    expect(next).toHaveBeenCalledTimes(3);
  });
});
