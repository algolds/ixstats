/** @jest-environment node */
/**
 * Roadmap M0 item 18 (PL-20): the Lorewards sync endpoints accept only the configured secret.
 */
jest.mock("~/lib/lorewards", () => ({
  syncFromStateFile: jest.fn().mockResolvedValue(3),
  grantLorewardBonuses: jest.fn().mockResolvedValue(1),
  syncTrophyCards: jest.fn().mockResolvedValue({ minted: 2, granted: 1 }),
  recomputeUserStats: jest.fn(),
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({ invalidateCache: jest.fn() }));

import { describe, expect, it, beforeAll } from "@jest/globals";
import { NextRequest } from "next/server";
import { entryStore, storedEntry, type StoredEntry } from "~/tests/helpers/loreward-entry-store";

const SECRET = "cron-s3cret";

describe("/api/lorewards/sync", () => {
  let POST: (req: NextRequest) => Promise<Response>;
  beforeAll(async () => {
    process.env.CRON_SECRET = SECRET;
    ({ POST } = await import("~/app/api/lorewards/sync/route"));
  });

  const call = (headers: Record<string, string>) =>
    POST(new NextRequest("http://localhost/api/lorewards/sync", { method: "POST", headers }));

  it("rejects a missing or wrong secret", async () => {
    expect((await call({})).status).toBe(401);
    expect((await call({ authorization: "Bearer nope" })).status).toBe(401);
    expect((await call({ "x-api-key": `${SECRET}x` })).status).toBe(401);
  });

  it("accepts the secret as a bearer token or x-api-key", async () => {
    expect((await call({ authorization: `Bearer ${SECRET}` })).status).toBe(200);
    expect((await call({ "x-api-key": SECRET })).status).toBe(200);
  });

  it("mints and grants trophy cards after the payouts and reports both", async () => {
    const lorewards = jest.requireMock("~/lib/lorewards") as {
      grantLorewardBonuses: jest.Mock;
      syncTrophyCards: jest.Mock;
    };
    const res = await call({ authorization: `Bearer ${SECRET}` });
    const body = (await res.json()) as { bonusesGranted: number; trophyCards: object };

    expect(body).toMatchObject({ bonusesGranted: 1, trophyCards: { minted: 2, granted: 1 } });
    expect(lorewards.grantLorewardBonuses.mock.invocationCallOrder.at(-1)).toBeLessThan(
      lorewards.syncTrophyCards.mock.invocationCallOrder.at(-1)!
    );
  });
});

describe("/api/lorewards/sync without CRON_SECRET (phase 4b)", () => {
  it("no longer accepts the retired XenForo API key", async () => {
    const saved = { cron: process.env.CRON_SECRET, xf: process.env.XENFORO_API_KEY };
    delete process.env.CRON_SECRET;
    process.env.XENFORO_API_KEY = "xf-key";
    let POST: ((req: NextRequest) => Promise<Response>) | undefined;
    jest.isolateModules(() => {
      ({ POST } = require("~/app/api/lorewards/sync/route"));
    });
    const res = await POST!(
      new NextRequest("http://localhost/api/lorewards/sync", {
        method: "POST",
        headers: { "x-api-key": "xf-key" },
      })
    );
    expect(res.status).toBe(401);
    process.env.CRON_SECRET = saved.cron;
    if (saved.xf === undefined) delete process.env.XENFORO_API_KEY;
    else process.env.XENFORO_API_KEY = saved.xf;
  });
});

describe("/api/bot/lorewards/sync", () => {
  let POST: (req: Request) => Promise<Response>;
  beforeAll(async () => {
    process.env.BOT_API_KEY = "bot-s3cret";
    ({ POST } = await import("~/app/api/bot/lorewards/sync/route"));
  });

  const call = (headers: Record<string, string>) =>
    POST(new Request("http://localhost/api/bot/lorewards/sync", { method: "POST", headers }));

  it("rejects a wrong bot key", async () => {
    expect((await call({ authorization: "Bearer bot-s3creT" })).status).toBe(401);
    expect((await call({ "x-bot-api-key": "nope" })).status).toBe(401);
  });

  it("lets the right bot key past authentication", async () => {
    // No JSON body, so it stops at parsing, after auth
    expect((await call({ "x-bot-api-key": "bot-s3cret" })).status).not.toBe(401);
  });
});

describe("/api/bot/lorewards/sync over an admin override", () => {
  let POST: (req: Request) => Promise<Response>;
  const { db } = jest.requireMock<{ db: { lorewardEntry?: object } }>("~/server/db");
  const OVERRIDDEN = new Date("2026-10-17T12:00:00.000Z");
  let store: ReturnType<typeof entryStore>;
  beforeAll(async () => {
    process.env.BOT_API_KEY = "bot-s3cret";
    ({ POST } = await import("~/app/api/bot/lorewards/sync/route"));
  });

  /** The bot pushes the daily of 16 October, naming Amy and Bee, onto the `rows` stored. */
  async function push(rows: StoredEntry[]) {
    store = entryStore(rows);
    db.lorewardEntry = store;
    const res = await POST(
      new Request("http://localhost/api/bot/lorewards/sync", {
        method: "POST",
        headers: { "x-bot-api-key": "bot-s3cret" },
        body: JSON.stringify({
          date: "2026-10-16",
          type: "daily",
          winnerUser: "Amy",
          winnerPage: "Amy's page",
          winnerScore: 90,
          runnerUpUser: "Bee",
          metadata: "[]",
        }),
      })
    );
    expect(res.status).toBe(200);
    return rows;
  }

  /** The daily of 16 October as an override left it: Cy and Dee, withheld, marked. */
  const overridden = storedEntry({
    id: "d1",
    winnerUser: "Cy",
    winnerPage: "Cy's page",
    runnerUpUser: "Dee",
    status: "withheld",
    overriddenAt: OVERRIDDEN,
  });

  it("keeps the places and the status of an entry an override wrote: only its metadata and syncedAt update", async () => {
    const [row] = await push([{ ...overridden }]);

    expect(row).toMatchObject({
      winnerUser: "Cy",
      winnerPage: "Cy's page",
      runnerUpUser: "Dee",
      status: "withheld",
      overriddenAt: OVERRIDDEN,
      metadata: "[]",
      syncedAt: expect.any(Date),
    });
  });

  it("checks for the override in the write itself, so one that commits meanwhile is never written over", async () => {
    await push([{ ...overridden }]);

    expect(store.updateMany).toHaveBeenCalledWith({
      where: { date: "2026-10-16", type: "daily", overriddenAt: null },
      data: expect.objectContaining({ winnerUser: "Amy", status: "approved" }),
    });
    expect(store.upsert.mock.calls[0]![0].update).toEqual({
      metadata: "[]",
      syncedAt: expect.any(Date),
    });
  });

  it("writes the places and the status of an entry no override wrote", async () => {
    const [row] = await push([{ ...overridden, overriddenAt: null }]);

    expect(row).toMatchObject({
      winnerUser: "Amy",
      winnerPage: "Amy's page",
      winnerScore: 90,
      runnerUpUser: "Bee",
      runnerUpPage: null,
      status: "approved",
      metadata: "[]",
    });
  });

  it("creates an entry the bot pushes first, with everything", async () => {
    const rows = await push([]);

    expect(rows).toEqual([
      expect.objectContaining({
        date: "2026-10-16",
        type: "daily",
        winnerUser: "Amy",
        runnerUpUser: "Bee",
        status: "approved",
        metadata: "[]",
        overriddenAt: null,
      }),
    ]);
  });
});
