/** @jest-environment node */
import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

jest.mock("~/env", () => ({ env: {} }));
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({
  syncSinglePage: jest.fn().mockResolvedValue(true),
  runAutoSyncCycle: jest.fn().mockResolvedValue({ pagesChecked: 0 }),
}));
jest.mock("~/lib/cache/rate-limiter", () => ({
  rateLimiter: { check: jest.fn() },
}));

import { POST } from "~/app/api/wiki/sync-webhook/route";
import { GET as inboundGet, POST as inboundPost } from "~/app/api/wikios/inbound-sync/route";
import { runAutoSyncCycle, syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { env } from "~/env";

const SECRET = randomBytes(24).toString("hex");
const setSecret = (value: string | undefined) =>
  Object.assign(env, { WIKI_SYNC_WEBHOOK_SECRET: value });

const request = (url: string, headers: Record<string, string>, body?: object) =>
  new NextRequest(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

const webhook = (headers: Record<string, string>, body: object = { title: "Main_Page" }) =>
  request("http://localhost:3000/api/wiki/sync-webhook", headers, body);

describe("POST /api/wiki/sync-webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSecret(SECRET);
    jest.mocked(rateLimiter.check).mockResolvedValue({
      success: true,
      remaining: 10,
      resetAt: new Date(),
    });
  });

  it("rejects a request without the secret", async () => {
    const res = await POST(webhook({}));
    expect(res.status).toBe(401);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it.each([
    ["same length", "x".repeat(SECRET.length)],
    ["different length", "short"],
  ])("rejects a wrong secret (%s)", async (_label, wrong) => {
    const res = await POST(webhook({ "x-wiki-webhook-secret": wrong }));
    expect(res.status).toBe(401);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("fails closed when no secret is configured", async () => {
    setSecret(undefined);
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(503);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("syncs the page with the correct secret", async () => {
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(200);
    expect(syncSinglePage).toHaveBeenCalledWith("Main_Page");
  });

  it("accepts the secret as a Bearer token", async () => {
    const res = await POST(webhook({ Authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limited", async () => {
    jest.mocked(rateLimiter.check).mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: new Date(),
    });
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(429);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("rejects a title longer than 255 characters", async () => {
    const res = await POST(
      webhook({ "x-wiki-webhook-secret": SECRET }, { title: "a".repeat(300) })
    );
    expect(res.status).toBe(400);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("does not echo internal error messages", async () => {
    jest.mocked(syncSinglePage).mockRejectedValueOnce(new Error("db password is hunter2"));
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Sync failed" });
  });
});

describe("POST /api/wiki/sync-webhook rate limiting", () => {
  const ok = { success: true, remaining: 10, resetAt: new Date() };
  const exhausted = { success: false, remaining: 0, resetAt: new Date() };

  beforeEach(() => {
    jest.clearAllMocks();
    setSecret(SECRET);
    jest.mocked(rateLimiter.check).mockResolvedValue(ok);
  });

  it("counts a valid-secret request against a per-secret bucket with a high ceiling", async () => {
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(200);
    expect(rateLimiter.check).toHaveBeenCalledTimes(1);
    expect(rateLimiter.check).toHaveBeenCalledWith(
      expect.stringMatching(/^secret:[0-9a-f]{16}$/),
      "wiki-sync-webhook",
      { maxRequests: 600, windowMs: 60_000 }
    );
  });

  it("never puts the secret in the bucket key", async () => {
    await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    const [identifier] = jest.mocked(rateLimiter.check).mock.calls[0] ?? [];
    expect(identifier).not.toContain(SECRET);
  });

  it("uses the same bucket wherever the request claims to come from", async () => {
    await POST(webhook({ "x-wiki-webhook-secret": SECRET, "x-forwarded-for": "1.1.1.1" }));
    await POST(
      webhook({
        Authorization: `Bearer ${SECRET}`,
        "cf-connecting-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      })
    );
    const [first, second] = jest.mocked(rateLimiter.check).mock.calls.map(([id]) => id);
    expect(first).toBe(second);
  });

  it("answers 429 and does not sync when the per-secret bucket is exhausted", async () => {
    jest.mocked(rateLimiter.check).mockResolvedValue(exhausted);
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(429);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("counts a request without the secret against a strict per-client bucket, then answers 401", async () => {
    const res = await POST(
      webhook({ "cf-connecting-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9" })
    );
    expect(res.status).toBe(401);
    expect(rateLimiter.check).toHaveBeenCalledWith("ip:2.2.2.2", "wiki-sync-webhook", {
      maxRequests: 10,
      windowMs: 60_000,
    });
  });

  it("counts a wrong secret against the strict bucket of the client, not a secret bucket", async () => {
    const res = await POST(
      webhook({ "x-wiki-webhook-secret": "x".repeat(SECRET.length), "x-real-ip": "4.4.4.4" })
    );
    expect(res.status).toBe(401);
    expect(rateLimiter.check).toHaveBeenCalledWith("ip:4.4.4.4", "wiki-sync-webhook", {
      maxRequests: 10,
      windowMs: 60_000,
    });
  });

  it("answers 429 instead of 401 once the strict bucket is exhausted", async () => {
    jest.mocked(rateLimiter.check).mockResolvedValue(exhausted);
    const res = await POST(webhook({ "cf-connecting-ip": "2.2.2.2" }));
    expect(res.status).toBe(429);
  });

  it("uses the strict per-client bucket when no secret is configured", async () => {
    setSecret(undefined);
    const res = await POST(
      webhook({ "x-wiki-webhook-secret": SECRET, "cf-connecting-ip": "5.5.5.5" })
    );
    expect(res.status).toBe(503);
    expect(rateLimiter.check).toHaveBeenCalledWith("ip:5.5.5.5", "wiki-sync-webhook", {
      maxRequests: 10,
      windowMs: 60_000,
    });
  });
});

describe("/api/wikios/inbound-sync", () => {
  const url = "http://localhost:3000/api/wikios/inbound-sync";

  beforeEach(() => {
    jest.clearAllMocks();
    setSecret(SECRET);
  });

  it("rejects a header-less POST", async () => {
    const res = await inboundPost(request(url, {}, { realm: "ixwiki" }));
    expect(res.status).toBe(401);
    expect(runAutoSyncCycle).not.toHaveBeenCalled();
  });

  it("rejects the old hard-coded fallback token", async () => {
    const res = await inboundPost(
      request(url, { Authorization: "Bearer dev-bot-secret-key-12345" }, { realm: "ixwiki" })
    );
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated GET without polling", async () => {
    const res = await inboundGet(request(url, {}));
    expect(res.status).toBe(401);
    expect(runAutoSyncCycle).not.toHaveBeenCalled();
  });

  it("fails closed when no secret is configured", async () => {
    setSecret(undefined);
    const res = await inboundGet(request(url, { "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(503);
  });

  it("runs the shared recent-changes sync cycle with the correct secret", async () => {
    const res = await inboundPost(
      request(url, { "x-wiki-webhook-secret": SECRET }, { realm: "ixwiki" })
    );
    expect(res.status).toBe(200);
    expect(runAutoSyncCycle).toHaveBeenCalledWith(50);
  });

  it("runs the shared recent-changes sync cycle on an authenticated GET", async () => {
    const res = await inboundGet(request(url, { Authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
    expect(runAutoSyncCycle).toHaveBeenCalledWith(25);
  });
});
