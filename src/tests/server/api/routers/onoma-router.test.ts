/** @jest-environment node */
/**
 * Onoma router guards (and the public usage counters audited with them, PL-3): Kokoro is reached only by a
 * signed-in caller, the usage counters are rate-limited, the Kokoro API key never leaves the server and a blank
 * field never erases it; another user's language pack is missing to you and never forked, and an invalid pack is
 * not published (SL-18).
 *
 * Folds: src/tests/server/api/routers/onoma-kokoro-anonymous-access.test.ts,
 * src/tests/server/api/routers/onoma-kokoro-api-key.test.ts,
 * src/tests/server/api/routers/onoma-pack-publish.test.ts
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { onomaSpeechRouter } from "~/server/api/routers/onoma/speech";
import { onomaMarketplaceRouter } from "~/server/api/routers/onoma/marketplace";
import { economicArchetypesPublicRouter } from "~/server/api/routers/economicArchetypes/public";
import { rateLimiter } from "~/lib/cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const anonymous = (db: MockPrismaProxy) =>
  createMockRouterContext({
    auth: null,
    user: null,
    db,
    rateLimitIdentifier: "ip:203.0.113.7",
  }) as never;
const packOwner = (db: MockPrismaProxy) =>
  createMockRouterContext({
    db,
    auth: { userId: "clerk_owner" },
    user: { id: "owner", clerkUserId: "clerk_owner", role: { name: "user", level: 100 } },
  }) as never;
const admin = (db: MockPrismaProxy) =>
  createCallerFactory(onomaSpeechRouter)(
    createMockRouterContext({
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      db,
    }) as never
  );

function kokoroDb() {
  const db = createMockPrisma();
  db.systemConfig.findMany.mockResolvedValue([
    { key: "onoma.kokoro.fastApiUrl", value: "http://kokoro.internal" },
    { key: "onoma.kokoro.apiKey", value: "sk-admin-key" },
  ]);
  return db;
}

const goodPack = {
  id: "pack1",
  userId: "owner",
  name: "Northern Towns",
  description: "Town names drawn from the northern dialects.",
  tags: ["towns"],
  visibility: "draft",
  versions: [
    {
      dictionaries: [
        {
          name: "Towns",
          category: "city",
          values: Array.from({ length: 12 }, (_, i) => `name${i}`),
        },
      ],
      phonologyRules: null,
      morphologyRules: null,
      orthographyRules: null,
      namingConventions: null,
    },
  ],
};
function packDb(pack: object) {
  const db = createMockPrisma();
  db.languagePack.findUnique.mockResolvedValue(pack);
  return db;
}
const marketplace = (db: MockPrismaProxy) =>
  createCallerFactory(onomaMarketplaceRouter)(packOwner(db));

afterEach(() => jest.restoreAllMocks());

/** An effect a refused call must not have had. */
type Effect = { mock: { calls: unknown[] } };

describe("refused without effect", () => {
  it.each<{
    name: string;
    refusal: () => { call: Promise<unknown>; effects: Effect[] };
    error: object;
  }>([
    {
      name: "an anonymous caller asks Kokoro for phonemes",
      refusal: () => {
        const fetchSpy = jest.spyOn(globalThis, "fetch");
        jest.spyOn(console, "warn").mockImplementation(() => {});
        const call = createCallerFactory(onomaSpeechRouter)(anonymous(kokoroDb())).suggestPhonemes({
          text: "Caphiria",
        });
        return { call, effects: [fetchSpy] };
      },
      error: { message: expect.stringMatching(/Authentication required/) },
    },
    {
      name: "an anonymous caller wakes the Kokoro server",
      refusal: () => {
        const fetchSpy = jest.spyOn(globalThis, "fetch");
        jest.spyOn(console, "warn").mockImplementation(() => {});
        const call = createCallerFactory(onomaSpeechRouter)(
          anonymous(kokoroDb())
        ).wakeKokoroServer();
        return { call, effects: [fetchSpy] };
      },
      error: { message: expect.stringMatching(/Authentication required/) },
    },
    {
      name: "a public usage counter bumped past its rate limit",
      refusal: () => {
        jest.spyOn(rateLimiter, "isEnabled").mockReturnValue(true);
        jest.spyOn(rateLimiter, "check").mockResolvedValue({
          success: false,
          remaining: 0,
          resetAt: new Date(Date.now() + 60_000),
        } as never);
        jest.spyOn(console, "warn").mockImplementation(() => {});
        const db = createMockPrisma();
        const call = createCallerFactory(economicArchetypesPublicRouter)(
          anonymous(db)
        ).incrementArchetypeUsage({ archetypeId: "a1" });
        return { call, effects: [db.economicArchetype.updateMany] };
      },
      error: { message: expect.stringMatching(/Too many requests/) },
    },
    {
      name: "publishing someone else's pack (it is missing to you)",
      refusal: () => {
        const db = packDb({ ...goodPack, userId: "someone_else" });
        return {
          call: marketplace(db).publishPack({ packId: "pack1" }),
          effects: [db.languagePack.update],
        };
      },
      error: { code: "NOT_FOUND" },
    },
    {
      name: "forking another user's draft",
      refusal: () => {
        const db = packDb({ ...goodPack, userId: "someone_else" });
        return {
          call: marketplace(db).fork({ packId: "pack1" }),
          effects: [db.languagePack.create],
        };
      },
      error: { code: "NOT_FOUND" },
    },
    {
      name: "publishing the owner's pack that fails validation, with the reasons",
      refusal: () => {
        const db = packDb({ ...goodPack, description: null });
        return {
          call: marketplace(db).publishPack({ packId: "pack1" }),
          effects: [db.languagePack.update],
        };
      },
      error: { code: "BAD_REQUEST", message: expect.stringContaining("description") },
    },
  ])("$name", async ({ refusal, error }) => {
    const { call, effects } = refusal();
    await expect(call).rejects.toMatchObject(error);
    expect(effects.filter((effect) => effect.mock.calls.length > 0)).toEqual([]);
  });
});

describe("the Kokoro API key never leaves the server", () => {
  const SECRET = "sk-live-abcdef123456WXYZ";

  it("the admin config shows a masked hint, never the key", async () => {
    const db = createMockPrisma();
    db.systemConfig.findMany.mockResolvedValue([
      { key: "onoma.kokoro.apiKey", value: SECRET },
      { key: "onoma.kokoro.enabled", value: "true" },
    ]);

    const config = await admin(db).getKokoroAdminConfig();

    expect(JSON.stringify(config)).not.toContain(SECRET);
    expect(config).not.toHaveProperty("apiKey");
    expect([config.hasApiKey, config.apiKeyHint]).toEqual([true, "••••WXYZ"]);
  });

  it("saving the config with the key field left blank keeps the saved key", async () => {
    const db = createMockPrisma();

    await admin(db).updateKokoroConfig({
      enabled: true,
      baseUrl: "",
      model: "model_q8f16",
      voice: "af_heart",
      speed: 1,
      engine: "kokoro-fastapi",
      fastApiUrl: "",
      apiKey: "",
    });

    const saved: string[] = db.systemConfig.upsert.mock.calls.map(
      (call: [{ where: { key: string } }]) => call[0].where.key
    );
    expect(saved).toContain("onoma.kokoro.enabled");
    expect(saved).not.toContain("onoma.kokoro.apiKey");
  });
});
