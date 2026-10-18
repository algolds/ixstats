/** @jest-environment node */
/**
 * Every old card address redirects permanently into the hub or the Store, keeping its query, and `/vault/cards` opens
 * Mine; a page that moved out of the Vault (the Exchange) redirects permanently too. `src/proxy.ts` answers them: a
 * redirect thrown by a page would stream as a 200 under the Vault's loading boundary, so the old pages are gone.
 */
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { NextRequest, type NextFetchEvent } from "next/server";

type Middleware = (req: NextRequest, event: NextFetchEvent) => Promise<Response>;
let middleware: Middleware;

beforeAll(async () => {
  // No Clerk keys: the simple middleware path. The redirect runs before Clerk either way.
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
  // The first request to pass through says Clerk is not configured.
  jest.spyOn(console, "log").mockImplementation(() => {});
  middleware = (await import("~/proxy")).default as Middleware;
});

afterAll(() => {
  jest.restoreAllMocks();
});

const BASE_PATH = "/projects/ixstates";
const run = (path: string, init: { basePath?: string; headers?: Record<string, string> } = {}) =>
  middleware(
    new NextRequest(`http://localhost${init.basePath ?? ""}${path}`, {
      headers: init.headers,
      nextConfig: { basePath: init.basePath },
    }),
    {} as NextFetchEvent
  );
const locationOf = (res: Response) => res.headers.get("location");

describe("proxy: old card addresses", () => {
  it.each([
    ["/vault/inventory?card=c1", "/vault/cards/mine?card=c1"],
    ["/vault/crafting", "/vault/cards/mine"],
    ["/vault/collections", "/vault/cards/sets"],
    ["/vault/collections/cl_9", "/vault/cards/sets?showcase=cl_9"],
    ["/explore/collections", "/vault/cards/sets"],
    ["/vault/lore-gallery", "/vault/cards/explore"],
    ["/vault/lore-generator", "/vault/cards/explore?suggest=1"],
    ["/vault/ns-library", "/vault/cards/explore?realm=nationstates"],
    ["/vault/ns-deck", "/vault/import"],
    ["/vault/ns-deck/testlandia", "/vault/cards/explore?realm=nationstates"],
    ["/vault/packs?tab=store", "/vault/store?view=packs"],
    ["/vault/market", "/vault/cards/market"],
    ["/vault/marketplace?tab=trading", "/vault/cards/market?tab=trades"],
    ["/vault/trading", "/vault/cards/market?tab=trades"],
    ["/vault/store?tab=auctions&card=c1", "/vault/cards/market?card=c1"],
  ])("sends %s on with a 308 to %s", async (path, target) => {
    const res = await run(path);
    expect(res.status).toBe(308);
    expect(locationOf(res)).toBe(`http://localhost${target}`);
  });

  it("keeps the base path and carries the query", async () => {
    const res = await run("/vault/trading?card=c1&card=c2&q=a+b", { basePath: BASE_PATH });
    expect(res.status).toBe(308);
    expect(locationOf(res)).toBe(
      `http://localhost${BASE_PATH}/vault/cards/market?card=c1&card=c2&q=a+b&tab=trades`
    );
  });

  it("still refuses a spoofed internal header before redirecting", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const res = await run("/vault/inventory", { headers: { "x-middleware-subrequest": "1" } });
      expect(res.status).toBe(403);
      expect(locationOf(res)).toBeNull();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("[Security] Blocked spoofed x-middleware-subrequest header")
      );
    } finally {
      warn.mockRestore();
    }
  });
});

describe("proxy: pages that moved", () => {
  it("sends the Vault's old Exchange address to Labs with a 308, keeping the query", async () => {
    const res = await run("/vault/exchange?tab=contracts");
    expect(res.status).toBe(308);
    expect(locationOf(res)).toBe("http://localhost/labs/exchange?tab=contracts");
  });

  it("keeps the base path", async () => {
    const res = await run("/vault/exchange", { basePath: BASE_PATH });
    expect(res.status).toBe(308);
    expect(locationOf(res)).toBe(`http://localhost${BASE_PATH}/labs/exchange`);
  });

  it("takes the address with a trailing slash", async () => {
    // NextURL keeps the request's trailing slash on the new path; Next's own redirect drops it.
    const res = await run("/vault/exchange/");
    expect(res.status).toBe(308);
    expect(locationOf(res)).toMatch(/^http:\/\/localhost\/labs\/exchange\/?$/);
  });

  it("keeps a question mark inside a query value", async () => {
    const res = await run("/vault/exchange?q=a?b&q=c");
    expect(locationOf(res)).toBe("http://localhost/labs/exchange?q=a%3Fb&q=c");
  });

  it.each(["/labs/exchange", "/vault/exchange-rates", "/vault/exchange/companies"])(
    "lets %s through",
    async (path) => {
      const res = await run(path);
      expect(locationOf(res)).toBeNull();
    }
  );
});

describe("proxy: the bare hub address", () => {
  it("opens Mine with a 307, keeping the query", async () => {
    const res = await run("/vault/cards?card=c1");
    expect(res.status).toBe(307);
    expect(locationOf(res)).toBe("http://localhost/vault/cards/mine?card=c1");
  });

  it("keeps the base path", async () => {
    const res = await run("/vault/cards", { basePath: BASE_PATH });
    expect(res.status).toBe(307);
    expect(locationOf(res)).toBe(`http://localhost${BASE_PATH}/vault/cards/mine`);
  });
});

describe("proxy: hub and Store addresses", () => {
  it.each([
    "/vault/cards/mine?card=c1",
    "/vault/cards/sets?showcase=s1",
    "/vault/cards/market?tab=selling",
    "/vault/cards/explore?suggest=1",
    "/vault/store",
    "/vault/store?view=packs",
    "/vault/import",
    "/vault",
  ])("lets %s through", async (path) => {
    const res = await run(path);
    expect(locationOf(res)).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("old card pages", () => {
  it.each([
    "cards/page.tsx",
    "inventory",
    "crafting",
    "collections",
    "lore-gallery",
    "lore-generator",
    "ns-library",
    "ns-deck",
    "packs",
    "market",
    "marketplace",
    "trading",
    "exchange",
  ])("src/app/vault/%s is gone: the proxy answers it", (route) => {
    expect(existsSync(`src/app/vault/${route}`)).toBe(false);
  });
});
