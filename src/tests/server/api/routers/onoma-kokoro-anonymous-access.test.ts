/**
 * PL-3: anonymous callers can't reach Kokoro with the admin API key, and the public usage
 * counters are rate-limited.
 */
import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { onomaSpeechRouter } from "~/server/api/routers/onoma/speech";
import { economicArchetypesPublicRouter } from "~/server/api/routers/economicArchetypes/public";
import { economicComponentsCatalogRouter } from "~/server/api/routers/economicComponents/catalog";
import { governmentComponentsCatalogRouter } from "~/server/api/routers/governmentComponents/catalog";
import { ComponentType, EconomicComponentType } from "@prisma/client";
import { rateLimiter } from "~/lib/cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

function anonCtx(db: ReturnType<typeof createMockPrisma>) {
  return createMockRouterContext({
    auth: null,
    user: null,
    db,
    rateLimitIdentifier: "ip:203.0.113.7",
  }) as never;
}

function kokoroDb() {
  const db = createMockPrisma();
  db.systemConfig.findMany.mockResolvedValue([
    { key: "onoma.kokoro.fastApiUrl", value: "http://kokoro.internal" },
    { key: "onoma.kokoro.apiKey", value: "sk-admin-key" },
  ]);
  return db;
}

describe("PL-3: Kokoro endpoints need a signed-in caller", () => {
  const fetchSpy = jest.spyOn(globalThis, "fetch");
  let warnSpy: ReturnType<typeof jest.spyOn>;

  afterEach(() => {
    fetchSpy.mockReset();
    warnSpy?.mockRestore();
  });

  it("suggestPhonemes rejects anonymous callers without calling Kokoro", async () => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const caller = createCallerFactory(onomaSpeechRouter)(anonCtx(kokoroDb()));

    await expect(caller.suggestPhonemes({ text: "Caphiria" })).rejects.toThrow(
      /Authentication required/
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("wakeKokoroServer rejects anonymous callers without calling Kokoro", async () => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const caller = createCallerFactory(onomaSpeechRouter)(anonCtx(kokoroDb()));

    await expect(caller.wakeKokoroServer()).rejects.toThrow(/Authentication required/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("suggestPhonemes still works for a signed-in user", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ phonemes: "kæˈfɪriə" }),
    } as never);
    const caller = createCallerFactory(onomaSpeechRouter)(
      createMockRouterContext({ db: kokoroDb() }) as never
    );

    await expect(caller.suggestPhonemes({ text: "Caphiria" })).resolves.toEqual({
      phonemes: "/kæˈfɪriə/",
    });
  });
});

describe("PL-3: public usage counters are rate-limited", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function exhaustRateLimit() {
    jest.spyOn(rateLimiter, "isEnabled").mockReturnValue(true);
    jest.spyOn(rateLimiter, "check").mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
    } as never);
    jest.spyOn(console, "warn").mockImplementation(() => {});
  }

  it("economicArchetypes.incrementArchetypeUsage stops once the limit is hit", async () => {
    exhaustRateLimit();
    const db = createMockPrisma();
    const caller = createCallerFactory(economicArchetypesPublicRouter)(anonCtx(db));

    await expect(caller.incrementArchetypeUsage({ archetypeId: "a1" })).rejects.toThrow(
      /Too many requests/
    );
    expect(db.economicArchetype.update).not.toHaveBeenCalled();
  });

  it("economicComponents.incrementComponentUsage stops once the limit is hit", async () => {
    exhaustRateLimit();
    const db = createMockPrisma();
    const caller = createCallerFactory(economicComponentsCatalogRouter)(anonCtx(db));

    await expect(
      caller.incrementComponentUsage({
        componentType: Object.values(EconomicComponentType)[0]!,
      })
    ).rejects.toThrow(/Too many requests/);
    expect(db.economicComponentData.update).not.toHaveBeenCalled();
  });

  it("governmentComponents.incrementComponentUsage stops once the limit is hit", async () => {
    exhaustRateLimit();
    const db = createMockPrisma();
    const caller = createCallerFactory(governmentComponentsCatalogRouter)(anonCtx(db));

    await expect(
      caller.incrementComponentUsage({ componentType: Object.values(ComponentType)[0]! })
    ).rejects.toThrow(/Too many requests/);
    expect(db.governmentComponentData.update).not.toHaveBeenCalled();
  });
});
