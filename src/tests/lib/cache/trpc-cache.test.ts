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
  it("shares IxWorld reads and keys other active realms", () => {
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
