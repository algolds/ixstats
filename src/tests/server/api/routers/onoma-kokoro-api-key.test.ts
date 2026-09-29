import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { onomaSpeechRouter } from "~/server/api/routers/onoma/speech";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(onomaSpeechRouter);

function adminCaller(db: ReturnType<typeof createMockPrisma>) {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      db,
    }) as never
  );
}

const SECRET = "sk-live-abcdef123456WXYZ";

const baseInput = {
  enabled: true,
  baseUrl: "",
  model: "model_q8f16",
  voice: "af_heart",
  speed: 1,
  engine: "kokoro-fastapi" as const,
  fastApiUrl: "",
};

function savedKeys(db: ReturnType<typeof createMockPrisma>): string[] {
  return db.systemConfig.upsert.mock.calls.map(
    (call: [{ where: { key: string } }]) => call[0].where.key
  );
}

describe("Kokoro API key never leaves the server", () => {
  it("getKokoroAdminConfig returns a masked hint, not the key", async () => {
    const db = createMockPrisma();
    db.systemConfig.findMany.mockResolvedValue([
      { key: "onoma.kokoro.apiKey", value: SECRET },
      { key: "onoma.kokoro.enabled", value: "true" },
    ]);

    const config = await adminCaller(db).getKokoroAdminConfig();

    expect(JSON.stringify(config)).not.toContain(SECRET);
    expect(config).not.toHaveProperty("apiKey");
    expect(config.hasApiKey).toBe(true);
    expect(config.apiKeyHint).toBe("••••WXYZ");
  });

  it("reports no key when none is saved", async () => {
    const db = createMockPrisma();
    db.systemConfig.findMany.mockResolvedValue([]);

    const config = await adminCaller(db).getKokoroAdminConfig();

    expect(config.hasApiKey).toBe(false);
    expect(config.apiKeyHint).toBe("");
  });

  it("updateKokoroConfig keeps the saved key when the field is left blank", async () => {
    const db = createMockPrisma();

    await adminCaller(db).updateKokoroConfig({ ...baseInput, apiKey: "" });

    expect(savedKeys(db)).not.toContain("onoma.kokoro.apiKey");
    expect(savedKeys(db)).toContain("onoma.kokoro.enabled");
  });

  it("updateKokoroConfig saves a newly typed key", async () => {
    const db = createMockPrisma();

    await adminCaller(db).updateKokoroConfig({ ...baseInput, apiKey: "  new-key  " });

    const call = db.systemConfig.upsert.mock.calls.find(
      (c: [{ where: { key: string } }]) => c[0].where.key === "onoma.kokoro.apiKey"
    );
    expect(call?.[0].update.value).toBe("new-key");
  });

  it("updateKokoroConfig clears the key only when asked", async () => {
    const db = createMockPrisma();

    await adminCaller(db).updateKokoroConfig({ ...baseInput, clearApiKey: true });

    const call = db.systemConfig.upsert.mock.calls.find(
      (c: [{ where: { key: string } }]) => c[0].where.key === "onoma.kokoro.apiKey"
    );
    expect(call?.[0].update.value).toBe("");
  });
});
