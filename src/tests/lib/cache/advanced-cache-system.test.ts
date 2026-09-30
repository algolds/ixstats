/** @jest-environment node */
// `jest` is the ambient global here (not imported) so the hoisted jest.mock factory can use it.
const mockStore = new Map<string, string>();

function mockGlobToRegExp(pattern: string): RegExp {
  const escaped = pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escaped.join(".*")}$`);
}

const mockRedis = {
  status: "ready",
  get: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setex: jest.fn(async (key: string, _ttl: number, value: string) => {
    mockStore.set(key, value);
    return "OK";
  }),
  del: jest.fn(async (key: string) => (mockStore.delete(key) ? 1 : 0)),
  scan: jest.fn(async (_cursor: string, _match: "MATCH", pattern: string) => {
    const re = mockGlobToRegExp(pattern);
    const keys = [...mockStore.keys()].filter((key) => re.test(key));
    return ["0", keys] as [string, string[]];
  }),
  unlink: jest.fn(async (...keys: string[]) => keys.filter((key) => mockStore.delete(key)).length),
  flushdb: jest.fn(async () => {
    mockStore.clear();
    return "OK";
  }),
};

jest.mock("~/lib/cache/redis-client", () => ({
  ...jest.requireActual("~/lib/cache/redis-client"),
  getSharedRedis: () => mockRedis,
  isRedisReady: (client: { status: string } | null) => client?.status === "ready",
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { globalCache } from "~/lib/cache/advanced-cache-system";

describe("globalCache Redis tier", () => {
  beforeEach(() => {
    mockStore.clear();
    globalCache.memoryCache.clear();
    jest.clearAllMocks();
  });

  it("set stores the prefixed key acs:k", async () => {
    await globalCache.set("k", { a: 1 });

    expect(mockStore.has("acs:k")).toBe(true);
    expect(mockStore.has("k")).toBe(false);
  });

  it("clear() never calls flushdb and unlinks only acs:* keys", async () => {
    mockStore.set("acs:a", "{}");
    mockStore.set("ratelimit:x", "1");

    await globalCache.clear();

    expect(mockRedis.flushdb).not.toHaveBeenCalled();
    expect(mockStore.has("acs:a")).toBe(false);
    expect(mockStore.has("ratelimit:x")).toBe(true);
  });

  it("deleteByPattern only touches prefixed keys", async () => {
    mockStore.set("acs:feed:1", "{}");
    mockStore.set("feed:1", "{}");

    await globalCache.deleteByPattern("feed:*");

    expect(mockStore.has("acs:feed:1")).toBe(false);
    expect(mockStore.has("feed:1")).toBe(true);
  });

  it("round-trips a value through the superjson envelope in Redis", async () => {
    // jest maps superjson to a pass-through mock (the real package is ESM-only), so this proves the
    // serialize -> JSON -> deserialize wiring, not Date revival itself.
    await globalCache.set("obj", { n: 1, s: "x" });
    expect(JSON.parse(mockStore.get("acs:obj") ?? "null")).toHaveProperty("json");

    globalCache.memoryCache.clear();
    await expect(globalCache.get("obj")).resolves.toEqual({ n: 1, s: "x" });
  });
});
