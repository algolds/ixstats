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
  const upsert = jest.fn(async (_args: object) => ({ id: "e1" }));
  beforeAll(async () => {
    process.env.BOT_API_KEY = "bot-s3cret";
    ({ POST } = await import("~/app/api/bot/lorewards/sync/route"));
  });

  /** The bot pushes the daily of 16 October, naming Amy and Bee, onto an entry stored with `overriddenAt`. */
  async function push(overriddenAt: Date | null) {
    const findUnique = jest.fn(async (_args: object) => (overriddenAt ? { overriddenAt } : null));
    upsert.mockClear();
    db.lorewardEntry = { findUnique, upsert };
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
    expect(findUnique).toHaveBeenCalledWith({
      where: { date_type: { date: "2026-10-16", type: "daily" } },
      select: { overriddenAt: true },
    });
    return upsert.mock.calls[0]![0];
  }

  const places = {
    winnerUser: "Amy",
    winnerPage: "Amy's page",
    winnerScore: 90,
    winnerBytes: null,
    runnerUpUser: "Bee",
    runnerUpPage: null,
    runnerUpScore: null,
    runnerUpBytes: null,
  };

  it("keeps the places of an entry an override wrote, and still writes the rest", async () => {
    expect(await push(new Date("2026-10-17T12:00:00.000Z"))).toEqual({
      where: { date_type: { date: "2026-10-16", type: "daily" } },
      create: { date: "2026-10-16", type: "daily", ...places, status: "approved", metadata: "[]" },
      update: { status: "approved", metadata: "[]", syncedAt: expect.any(Date) },
    });
  });

  it("writes the places of an entry no override wrote", async () => {
    expect(await push(null)).toMatchObject({
      update: { ...places, status: "approved", metadata: "[]" },
    });
  });
});
