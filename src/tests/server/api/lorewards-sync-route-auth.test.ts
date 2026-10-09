/** @jest-environment node */
/**
 * Roadmap M0 item 18 (PL-20): the Lorewards sync endpoints accept only the configured secret.
 */
jest.mock("~/lib/lorewards", () => ({
  syncFromStateFile: jest.fn().mockResolvedValue(3),
  grantLorewardBonuses: jest.fn().mockResolvedValue(1),
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
