import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { narratorRouter } from "~/server/api/routers/narrator";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(narratorRouter);

function adminCaller(db: ReturnType<typeof createMockPrisma>) {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      db,
    }) as never
  );
}

const SECRET = "nvapi-live-abcdef123456WXYZ";

function upsertFor(db: ReturnType<typeof createMockPrisma>, key: string) {
  return db.systemConfig.upsert.mock.calls.find(
    (c: [{ where: { key: string } }]) => c[0].where.key === key
  );
}

describe("WK-12: the Narrator LLM API key never leaves the server", () => {
  it("getNarratorSettings returns a masked hint, not the key", async () => {
    const db = createMockPrisma();
    db.systemConfig.findMany.mockResolvedValue([
      { key: "narrator:llm:apiKey", value: SECRET },
      { key: "narrator:llm:provider", value: "nvidia" },
    ]);

    const settings = await adminCaller(db).getNarratorSettings();

    expect(JSON.stringify(settings)).not.toContain(SECRET);
    expect(settings).not.toHaveProperty("apiKey");
    expect(settings.hasApiKey).toBe(true);
    expect(settings.apiKeyHint).toBe("••••WXYZ");
  });

  it("saveNarratorSettings keeps the saved key when the field is left blank", async () => {
    const db = createMockPrisma();

    await adminCaller(db).saveNarratorSettings({ enabled: true, provider: "nvidia" });

    expect(upsertFor(db, "narrator:llm:apiKey")).toBeUndefined();
    expect(upsertFor(db, "narrator:llm:provider")).toBeDefined();
  });

  it("saveNarratorSettings saves a newly typed key", async () => {
    const db = createMockPrisma();

    await adminCaller(db).saveNarratorSettings({ enabled: true, apiKey: "  new-key  " });

    expect(upsertFor(db, "narrator:llm:apiKey")?.[0].update.value).toBe("new-key");
  });

  it("saveNarratorSettings clears the key only when asked", async () => {
    const db = createMockPrisma();

    await adminCaller(db).saveNarratorSettings({ enabled: true, clearApiKey: true });

    expect(upsertFor(db, "narrator:llm:apiKey")?.[0].update.value).toBe("");
  });
});
