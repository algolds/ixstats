/** @jest-environment node */
/**
 * The writes and reads the pre-production audit found on unthrottled builders (real in-memory RateLimiter, Redis
 * off): WikiOS's annotation, watchlist and stash writes are each limited per procedure (60 a minute per user) and a
 * caller past it is refused before anything is read or written; `wikiCache.getCountryProfile` is on the public
 * bucket. The popularity counters (`incrementComponentUsage` of both component catalogs and
 * `incrementArchetypeUsage`) take only signed-in callers and count one pick a day per player and item.
 */
jest.mock("~/env", () => ({
  env: { ...jest.requireActual("~/env").env, RATE_LIMIT_ENABLED: "true", REDIS_ENABLED: "false" },
}));
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/lib/wiki-os/adapters/ixstates/cache-service", () => ({
  wikiCacheService: { getCountryProfile: jest.fn().mockResolvedValue(null) },
}));

import { beforeAll, describe, expect, it } from "@jest/globals";
import { rateLimiter } from "~/lib/cache";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiCacheRouter } from "~/server/api/routers/wikiCache";
import { wikiosStashRouter } from "~/server/api/routers/wikios/stash";
import { wikiosWatchlistAnnotationsRouter } from "~/server/api/routers/wikios/watchlist-annotations";
import { governmentComponentsCatalogRouter } from "~/server/api/routers/governmentComponents/catalog";
import { economicComponentsCatalogRouter } from "~/server/api/routers/economicComponents/catalog";
import { economicArchetypesPublicRouter } from "~/server/api/routers/economicArchetypes/public";
import { createMockCallerContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

let run = 0;
/** A signed-in member with a bucket no other test has used, on `db`. */
function member(db: object = createMockPrisma()) {
  const id = `user_${++run}`;
  return {
    identifier: `user:${id}`,
    ctx: createMockCallerContext({
      auth: { userId: id },
      user: { id: `db_${id}`, clerkUserId: id, countryId: null, role: null },
      db,
      rateLimitIdentifier: `user:${id}`,
    }) as never,
  };
}

/** Uses up `n` requests of `identifier`'s `namespace` bucket the way the middleware does. */
async function spend(identifier: string, namespace: string, n: number, maxRequests: number) {
  for (let i = 0; i < n; i++)
    await rateLimiter.check(identifier, namespace, { maxRequests, windowMs: 60_000 });
}

beforeAll(() => {
  expect(rateLimiter.isEnabled()).toBe(true);
  for (const level of ["info", "log", "warn"] as const)
    jest.spyOn(console, level).mockImplementation(() => {});
});

const annotations = createCallerFactory(wikiosWatchlistAnnotationsRouter);
const stash = createCallerFactory(wikiosStashRouter);

describe("WikiOS personal writes are limited per procedure, before they touch anything", () => {
  it.each<[string, (ctx: never) => Promise<unknown>]>([
    [
      "addAnnotation",
      (ctx) => annotations(ctx).addAnnotation({ pageTitle: "Caphiria", selectedText: "x" }),
    ],
    ["deleteAnnotation", (ctx) => annotations(ctx).deleteAnnotation({ id: "a1" })],
    ["watchPage", (ctx) => annotations(ctx).watchPage({ pageTitle: "Caphiria" })],
    ["unwatchPage", (ctx) => annotations(ctx).unwatchPage({ pageTitle: "Caphiria" })],
    ["markAllWatchedVisited", (ctx) => annotations(ctx).markAllWatchedVisited()],
    ["createStash", (ctx) => stash(ctx).createStash({ name: "Reading", color: "blue" })],
    ["updateStash", (ctx) => stash(ctx).updateStash({ id: "s1", name: "Later" })],
    ["deleteStash", (ctx) => stash(ctx).deleteStash({ id: "s1" })],
    ["unstashPage", (ctx) => stash(ctx).unstashPage({ pageTitle: "Caphiria" })],
  ])("%s", async (path, call) => {
    const db = createMockPrisma();
    const { identifier, ctx } = member(db);
    await spend(identifier, `mutation:${path}`, 60, 60);

    await expect(call(ctx)).rejects.toThrow(/Too many requests/);
    const touched = Object.values(db).flatMap((model) =>
      Object.values(model as Record<string, jest.Mock>).filter((fn) => fn.mock?.calls.length)
    );
    expect(touched).toEqual([]);
  });
});

describe("wikiCache", () => {
  it("getCountryProfile is on the public bucket", async () => {
    const ctx = createMockCallerContext({
      auth: null,
      user: null,
      rateLimitIdentifier: "ip:198.51.100.9",
    }) as never;
    await spend("ip:198.51.100.9", "public", 100, 100);

    await expect(
      createCallerFactory(wikiCacheRouter)(ctx).getCountryProfile({ countryName: "Nowhere" })
    ).rejects.toThrow(/Too many requests/);
    expect(wikiCacheService.getCountryProfile).not.toHaveBeenCalled();
  });
});

describe("popularity counters", () => {
  const anonymous = () =>
    createMockCallerContext({ auth: null, user: null, rateLimitIdentifier: "ip:x" }) as never;

  it("refuse an anonymous caller", async () => {
    await expect(
      createCallerFactory(governmentComponentsCatalogRouter)(anonymous()).incrementComponentUsage({
        componentType: "PROFESSIONAL_BUREAUCRACY" as never,
      })
    ).rejects.toThrow(/Authentication required/);
    await expect(
      createCallerFactory(economicArchetypesPublicRouter)(anonymous()).incrementArchetypeUsage({
        archetypeId: "a1",
      })
    ).rejects.toThrow(/Authentication required/);
  });

  it.each([
    ["governmentComponents", "governmentComponentData", governmentComponentsCatalogRouter],
    ["economicComponents", "economicComponentData", economicComponentsCatalogRouter],
  ] as const)("%s counts one pick a day per player and component", async (_name, model, router) => {
    const db = createMockPrisma();
    const table = (db as unknown as Record<string, Record<string, jest.Mock>>)[model]!;
    table.count!.mockResolvedValue(1);
    table.findUnique!.mockResolvedValue({ usageCount: 4 });
    table.update!.mockResolvedValue({ usageCount: 5 });
    const componentType = (
      model === "governmentComponentData" ? "PROFESSIONAL_BUREAUCRACY" : "FREE_MARKET_SYSTEM"
    ) as never;

    // the two catalogs' routers differ only in what else they hold
    const callerOf = createCallerFactory(router as typeof governmentComponentsCatalogRouter);
    const ana = callerOf(member(db).ctx);
    await ana.incrementComponentUsage({ componentType });
    await ana.incrementComponentUsage({ componentType });
    expect(table.update).toHaveBeenCalledTimes(1);

    await callerOf(member(db).ctx).incrementComponentUsage({ componentType });
    expect(table.update).toHaveBeenCalledTimes(2);
  });

  it("incrementArchetypeUsage counts one pick a day per player and archetype", async () => {
    const db = createMockPrisma();
    db.economicArchetype.updateMany.mockResolvedValue({ count: 1 });

    const ana = createCallerFactory(economicArchetypesPublicRouter)(member(db).ctx);
    expect(await ana.incrementArchetypeUsage({ archetypeId: "a1" })).toEqual({ count: 1 });
    expect(await ana.incrementArchetypeUsage({ archetypeId: "a1" })).toEqual({ count: 0 });
    await ana.incrementArchetypeUsage({ archetypeId: "a2" });
    expect(db.economicArchetype.updateMany).toHaveBeenCalledTimes(2);
  });
});
